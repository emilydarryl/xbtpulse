import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../lib/store.mjs';
import { initializeBlockReports, validateBlockReport, submitBlockReport, publicBlockReports } from '../lib/block-reports.mjs';
import { blockReportSection } from '../public/block-report-view.js';

const hash = 'a'.repeat(64), otherHash = 'b'.repeat(64), height = 972232;
const report = { hash, height };
function fixture(t) {
  const store = new Store(':memory:');
  t.after(() => store.close());
  initializeBlockReports(store);
  for (const [id, digest] of [['one', '1'], ['two', '2']]) {
    store.addApplication({ id, profileConsent: true });
    store.approveApplication(id, id + '-prime', digest.repeat(64));
    store.set('pool-profile:operator:' + id, { applicationId: id, name: id });
  }
  return store;
}
const view = (s, now = Date.now()) => publicBlockReports(s, [], 'operator:one', now);
function block(value = hash, number = height) {
  return { hash: value, height: number, time: 1789450000, tag: '', outputs: [], reportedPool: { name: 'Another payout pool', slug: 'another' } };
}

test('block reports require exact aggregate schema and normalize hashes', () => {
  assert.deepEqual(validateBlockReport({ hash: hash.toUpperCase(), height }), { ...report, action: 'report' });
  for (const bad of [null, [], {}, { ...report, token: 'private' }, { ...report, height: '972232' },
    { ...report, height: 1 }, { ...report, hash: 'bad' }, { ...report, action: 'found' }, { ...report, action: false }, { ...report, action: null }]) {
    assert.throws(() => validateBlockReport(bad));
  }
});

test('reports are idempotent, provider-scoped, withdrawable and correctable', t => {
  const s = fixture(t);
  assert.equal(submitBlockReport(s, [], 'one-prime', report).duplicate, false);
  assert.equal(submitBlockReport(s, [], 'one-prime', report).duplicate, true);
  submitBlockReport(s, [], 'two-prime', report);
  assert.equal(view(s).total, 1);
  assert.equal(view(s).reports[0].provider, 'one-prime');
  assert.throws(() => submitBlockReport(s, [], 'one-prime', { ...report, height: height + 1 }), { status: 409 });
  submitBlockReport(s, [], 'one-prime', { ...report, action: 'withdraw' });
  assert.equal(view(s).total, 0);
  assert.equal(publicBlockReports(s, [], 'operator:two').total, 1);
  assert.equal(submitBlockReport(s, [], 'one-prime', { ...report, action: 'withdraw' }).duplicate, true);
  assert.throws(() => submitBlockReport(s, [], 'one-prime', report), { status: 409 });
  submitBlockReport(s, [], 'one-prime', { ...report, height: height + 1 });
  assert.equal(view(s).reports[0].height, height + 1);
  assert.equal(s.telemetry().length, 0);
  assert.equal(s.blocks().length, 0);
});

test('chain status follows collected data, gaps, staleness and replacement without certifying the finder', t => {
  const s = fixture(t), now = Date.now();
  submitBlockReport(s, [], 'one-prime', report, now);
  assert.equal(view(s, now).reports[0].chainStatus, 'awaiting-data');
  assert.equal(view(s, now).chainStale, true);
  s.saveBlocks([block()], 30000);
  s.set('lastSuccess', now);
  let feed = view(s, now);
  assert.equal(feed.chainStale, false);
  assert.equal(feed.reports[0].chainStatus, 'observed');
  assert.equal(feed.reports[0].finderStatus, 'operator-reported');
  assert.equal(feed.reports[0].attribution.name, 'Another payout pool');
  s.saveBlocks([block(otherHash)], 30000);
  assert.equal(view(s, now).reports[0].chainStatus, 'different-block');
  s.reset({ reason: 'test reorg' });
  assert.equal(view(s, now).reports[0].chainStatus, 'awaiting-data');
  s.saveBlocks([block(otherHash, height + 100)], 1);
  assert.equal(view(s, now).reports[0].chainStatus, 'outside-history');
  assert.equal(view(s, now + 120001).chainStale, true);
});

test('publication requires consent and approval; withdrawn consent hides reports but permits withdrawal', t => {
  const s = fixture(t);
  assert.throws(() => submitBlockReport(s, [], 'unlinked', report), { status: 403 });
  submitBlockReport(s, [], 'one-prime', report);
  s.db.prepare("UPDATE applications SET body=? WHERE id='one'").run(JSON.stringify({ profileConsent: false }));
  assert.equal(view(s).total, 0);
  assert.throws(() => submitBlockReport(s, [], 'one-prime', { ...report, hash: otherHash }), { status: 403 });
  submitBlockReport(s, [], 'one-prime', { ...report, action: 'withdraw' });
  s.db.prepare("UPDATE applications SET body=?,status='declined' WHERE id='one'").run(JSON.stringify({ profileConsent: true }));
  assert.throws(() => submitBlockReport(s, [], 'one-prime', report), { status: 403 });
});

test('limits bound new changes but allow identical retries; expired reports disappear', t => {
  const s = fixture(t), now = Date.now();
  for (let i = 0; i < 60; i++) submitBlockReport(s, [], 'one-prime', { hash: i.toString(16).padStart(64, '0'), height }, now);
  assert.equal(view(s, now).reports.length, 50);
  assert.equal(view(s, now).total, 60);
  assert.equal(submitBlockReport(s, [], 'one-prime', { hash: '0'.repeat(64), height }, now).duplicate, true);
  assert.throws(() => submitBlockReport(s, [], 'one-prime', report, now), { status: 429 });
  assert.equal(view(s, now + 91 * 86400000).total, 0);
  submitBlockReport(s, [], 'one-prime', report, now + 91 * 86400000);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM block_reports').get().n, 1);
});

test('public rendering labels absent reports and escapes operator names', t => {
  const s = fixture(t);
  assert.match(blockReportSection(view(s)), /Not reported/);
  submitBlockReport(s, [], 'one-prime', report);
  const feed = view(s);
  feed.reports[0].provider = '<img src=x onerror=alert(1)>';
  const html = blockReportSection(feed);
  assert.ok(!html.includes('<img'));
  assert.match(html, /Finder: operator-reported/);
  assert.match(html, /does not verify who found it/);
});
