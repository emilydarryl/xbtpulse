import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../lib/store.mjs';
import { profileProviderIds } from '../lib/profile-providers.mjs';
import { initializePoolHistory, capturePoolHistory, poolHistory } from '../lib/pool-history.mjs';
import { summarizeTelemetry } from '../lib/analytics.mjs';

test('published application links only its own providers, retaining curated links without duplicates', () => {
  const store = new Store(':memory:');
  try {
    for (const [id, hash] of [['a', 'a'], ['b', 'b']]) {
      store.addApplication({ id, profileConsent: true });
      store.approveApplication(id, id + '-prime', hash.repeat(64));
    }
    store.set('pool-profile:operator:a', { applicationId: 'a' });
    const registry = [{ id: 'operator:a', providerIds: ['legacy', 'a-prime'] }];
    assert.deepEqual(profileProviderIds(store, [], 'operator:a'), ['a-prime']);
    assert.deepEqual(profileProviderIds(store, registry, 'operator:a'), ['legacy', 'a-prime']);
    assert.deepEqual(profileProviderIds(store, [], 'operator:b'), []);
    store.revokeProvider('a-prime');
    assert.deepEqual(profileProviderIds(store, [], 'operator:a'), ['a-prime']);
    // Preserve the association so freshness can label revoked credentials inactive.
    store.db.prepare("UPDATE applications SET status='declined' WHERE id='a'").run();
    assert.deepEqual(profileProviderIds(store, [], 'operator:a'), []);
    store.db.prepare("UPDATE applications SET status='approved', body=? WHERE id='a'").run(JSON.stringify({ profileConsent: false }));
    assert.deepEqual(profileProviderIds(store, [], 'operator:a'), []);
    store.set('pool-profile:operator:a', { applicationId: 'missing' });
    assert.deepEqual(profileProviderIds(store, [], 'operator:a'), []);
  } finally { store.close(); }
});

test('application-linked work-only reporting appears in profile history and excludes other providers', () => {
  const store = new Store(':memory:');
  const now = Date.now();
  try {
    initializePoolHistory(store);
    store.addApplication({ id: 'a', profileConsent: true });
    store.approveApplication('a', 'prime', 'a'.repeat(64));
    store.set('pool-profile:operator:a', { applicationId: 'a', name: 'Example' });
    for (const provider of ['prime', 'unrelated']) store.addTelemetry({ provider, id: 'interval', start: now - 60000, end: now, work: 123, expected: 0.1, found: null });
    const ids = profileProviderIds(store, [], 'operator:a');
    const reports = summarizeTelemetry(store.telemetry(), now).providers.filter(p => ids.includes(p.name));
    assert.equal(reports.length, 1);
    assert.equal(reports[0].work, 123);
    assert.equal(reports[0].found, null);
    capturePoolHistory(store, [], {}, now);
    const change = poolHistory(store, 'operator:a', {}, now).events[0].changes.find(c => c.field === 'telemetry');
    assert.deepEqual(change.after, [{ name: 'prime', status: 'Reporting' }]);
  } finally { store.close(); }
});
