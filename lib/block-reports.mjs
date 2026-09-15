import { attribute } from './analytics.mjs';
import { profileProviderIds } from './profile-providers.mjs';
import { forkHeight } from './source.mjs';

const DAY = 86400000;
export const reportRetentionDays = 90;
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }

export function pruneBlockReports(store, now = Date.now()) {
  store.db.prepare('DELETE FROM block_reports WHERE updated < ?').run(now - reportRetentionDays * DAY);
  store.db.prepare('DELETE FROM block_report_limits WHERE bucket < ?').run(Math.floor(now / 3600000) - 1);
}

export function initializeBlockReports(store) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS block_reports(
    provider TEXT NOT NULL, hash TEXT NOT NULL, height INTEGER NOT NULL,
    reported INTEGER NOT NULL, updated INTEGER NOT NULL, withdrawn INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(provider,hash));
    CREATE INDEX IF NOT EXISTS block_reports_recent ON block_reports(updated);
    CREATE TABLE IF NOT EXISTS block_report_limits(provider TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(provider,bucket));`);
  pruneBlockReports(store);
}

export function validateBlockReport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(k => !['hash', 'height', 'action'].includes(k)) ||
      typeof body.hash !== 'string' || !/^[a-fA-F0-9]{64}$/.test(body.hash) ||
      !Number.isSafeInteger(body.height) || body.height < forkHeight || body.height > 100000000 ||
      !['report', 'withdraw'].includes(body.action === undefined ? 'report' : body.action)) {
    fail('Use a 64-character block hash, an integer XBT block height, and optional action report or withdraw. No additional fields.');
  }
  return { hash: body.hash.toLowerCase(), height: body.height, action: body.action ?? 'report' };
}

function publicProfiles(store, registry, provider) {
  return store.db.prepare("SELECT key,value FROM meta WHERE key LIKE 'pool-profile:%'").all().flatMap(row => {
    const profile = JSON.parse(row.value), id = row.key.slice(13);
    const owner = store.applications().find(a => a.id === profile?.applicationId);
    if (!owner || owner.status !== 'approved' || owner.body.profileConsent !== true ||
        !profileProviderIds(store, registry, id).includes(provider)) return [];
    return [{ id, name: profile.name || id }];
  });
}

export function submitBlockReport(store, registry, provider, input, now = Date.now()) {
  const report = validateBlockReport(input);
  // Authentication happens at the route. Withdrawals remain available after consent is removed.
  const profiles = publicProfiles(store, registry, provider);
  if (report.action === 'report' && !profiles.length) fail('An approved, consenting published profile must be linked to this provider before publishing block reports.', 403);
  store.db.exec('BEGIN IMMEDIATE');
  try {
    store.db.prepare('DELETE FROM block_reports WHERE updated < ?').run(now - reportRetentionDays * DAY);
    const old = store.db.prepare('SELECT * FROM block_reports WHERE provider=? AND hash=?').get(provider, report.hash);
    if (old?.withdrawn && report.action === 'report' && old.height === report.height)
      fail('This report was withdrawn. An old retry cannot republish it. Contact XBT Pulse if the withdrawal was a mistake.', 409);
    if (old && old.height !== report.height && !(old.withdrawn && report.action === 'report')) fail('This hash was reported at a different height. Withdraw the original report before submitting a correction.', 409);
    const withdrawn = report.action === 'withdraw' ? 1 : 0;
    if (!old && withdrawn) fail('No report for this hash exists under your provider.', 404);
    const duplicate = !!old && old.withdrawn === withdrawn && old.height === report.height;
    if (!duplicate) {
      const bucket = Math.floor(now / 3600000);
      store.db.prepare('DELETE FROM block_report_limits WHERE bucket < ?').run(bucket - 1);
      const count = store.db.prepare('SELECT count FROM block_report_limits WHERE provider=? AND bucket=?').get(provider, bucket)?.count || 0;
      if (count >= 60) fail('Block reporting limit reached. Retry after one hour.', 429);
      store.db.prepare('INSERT INTO block_report_limits VALUES (?,?,1) ON CONFLICT(provider,bucket) DO UPDATE SET count=count+1').run(provider, bucket);
      store.db.prepare(`INSERT INTO block_reports VALUES (?,?,?,?,?,?)
        ON CONFLICT(provider,hash) DO UPDATE SET height=excluded.height,updated=excluded.updated,withdrawn=excluded.withdrawn`).run(provider, report.hash, report.height, now, now, withdrawn);
    }
    store.db.exec('COMMIT');
    return { accepted: true, duplicate, action: report.action, hash: report.hash, profiles };
  } catch (e) { store.db.exec('ROLLBACK'); throw e; }
}

export function publicBlockReports(store, registry, id, now = Date.now()) {
  const ids = profileProviderIds(store, registry, id);
  const allowed = ids.filter(provider => publicProfiles(store, registry, provider).some(p => p.id === id));
  const cutoff = now - reportRetentionDays * DAY;
  const rows = allowed.length ? store.db.prepare(`SELECT provider,hash,height,reported,updated FROM block_reports
    WHERE withdrawn=0 AND updated>=? AND provider IN (${allowed.map(() => '?').join(',')}) ORDER BY reported DESC,provider,hash LIMIT 50`).all(cutoff, ...allowed) : [];
  const total = allowed.length ? store.db.prepare(`SELECT COUNT(*) AS n FROM block_reports WHERE withdrawn=0 AND updated>=? AND provider IN (${allowed.map(() => '?').join(',')})`).get(cutoff, ...allowed).n : 0;
  const range = store.db.prepare('SELECT MIN(height) AS oldest,MAX(height) AS newest FROM blocks').get();
  const lastSuccess = store.get('lastSuccess');
  const stale = !lastSuccess || lastSuccess > now || now - lastSuccess > 120000 || !!store.get('lastError');
  return {
    total, limit: 50, retentionDays: reportRetentionDays, checkedAt: now, chainUpdatedAt: lastSuccess, chainStale: stale,
    reports: rows.map(row => {
      const stored = store.db.prepare('SELECT body FROM blocks WHERE height=?').get(row.height);
      const block = stored ? JSON.parse(stored.body) : null;
      const matches = block?.hash === row.hash;
      const status = block ? matches ? 'observed' : 'different-block' : range.oldest && row.height < range.oldest ? 'outside-history' : 'awaiting-data';
      const attribution = matches ? attribute(block, registry) : null;
      return { ...row, chainStatus: status, finderStatus: 'operator-reported',
        blockTime: matches ? block.time : null,
        attribution: attribution ? { name: attribution.name, evidence: attribution.evidence } : null };
    }),
  };
}
