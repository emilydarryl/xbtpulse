import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Store } from '../lib/store.mjs';

test('HTTP feed enforces authentication and exposes reports only on the linked profile', { timeout: 20000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'xbtpulse-block-feed-'));
  const token = 'synthetic-block-report-test-token';
  const s = new Store(join(dir, 'pulse.sqlite'));
  s.addApplication({ id: 'feed-test', name: 'Test operator', profileConsent: true });
  s.approveApplication('feed-test', 'test-prime', createHash('sha256').update(token).digest('hex'));
  s.set('pool-profile:operator:feed-test', { applicationId: 'feed-test', name: 'Test operator', poolType: 'public' });
  s.close();
  const listener = createServer().listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(done => listener.close(done));
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, RPC_URL: '', EXPLORER_API: '', TELEMETRY_KEYS_JSON: '{}' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  t.after(async () => {
    if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
    if (resolve(dir).startsWith(resolve(tmpdir()) + '\\') || resolve(dir).startsWith(resolve(tmpdir()) + '/')) rmSync(dir, { recursive: true, force: true });
  });
  await Promise.race([
    once(child.stdout, 'data'),
    once(child, 'exit').then(() => { throw Error('Test server exited before startup'); }),
  ]);
  const base = 'http://127.0.0.1:' + port;
  const body = { height: 972232, hash: 'a'.repeat(64) };
  const post = (auth = token, content = body, type = 'application/json') => fetch(base + '/api/block-reports', {
    method: 'POST', headers: { 'Content-Type': type, Authorization: 'Bearer ' + auth }, body: JSON.stringify(content),
  });
  assert.equal((await post('bad-token')).status, 401);
  assert.equal((await post(token, body, 'text/plain')).status, 415);
  assert.equal((await post(token, { ...body, worker: 'private' })).status, 400);
  assert.equal((await post()).status, 201);
  assert.equal((await post()).status, 200);
  const profile = await (await fetch(base + '/api/pool?id=operator%3Afeed-test')).json();
  assert.equal(profile.blockReports.total, 1);
  assert.equal(profile.blockReports.reports[0].chainStatus, 'awaiting-data');
  assert.equal(profile.blocks, null);
  assert.equal(profile.telemetry.length, 0);
  assert.ok(!JSON.stringify(profile).includes(token));
  assert.equal((await fetch(base + '/api/block-reports', { method: 'DELETE' })).status, 405);
  assert.equal((await post(token, { ...body, action: 'withdraw' })).status, 201);
  const withdrawn = await (await fetch(base + '/api/pool?id=operator%3Afeed-test')).json();
  assert.equal(withdrawn.blockReports.total, 0);
  const db = new Store(join(dir, 'pulse.sqlite'));
  db.revokeProvider('test-prime'); db.close();
  assert.equal((await post()).status, 401);
  const page = await fetch(base + '/report-blocks');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Connect your own block feed/);
  const sender = await fetch(base + '/downloads/xbtpulse-block-reporter.py');
  assert.match(sender.headers.get('content-type'), /text\/plain/);
  assert.match(await sender.text(), /class NoRedirect/);
});
