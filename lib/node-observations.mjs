import { isIP } from 'node:net';

export const NODE_SOURCE = 'https://thebtc.network/data/nodes.json';
export const NODE_POLL_MS = 15 * 60 * 1000;
export const NODE_STALE_MS = 2 * 60 * 60 * 1000;
const RETENTION_MS = 30 * 86400000;
const integer = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const text = value => typeof value === 'string' && value.length <= 256 && /^[\x20-\x7e]*$/.test(value);

export function advertisedVersion(subver) {
  if (!text(subver)) throw Error('Invalid user agent');
  const knots = subver.match(/\/Knots:([a-zA-Z0-9._+-]+)(?:\([^/]*\))?\//);
  const base = subver.match(/\/Satoshi:([a-zA-Z0-9._+-]+)(?:\([^/]*\))?\//);
  return knots ? `Knots ${base ? base[1] + ' / ' : ''}${knots[1]}` : 'Other / unrecognized';
}

// Only aggregates leave this adapter. Endpoints are used for deduplication, never persisted.
export function parseNodeObservations(body, now = Date.now()) {
  if (body?.schema !== 'btcb2.nodes/1' || !Array.isArray(body.nodes) || body.nodes.length > 10000) throw Error('Unknown node feed');
  const crawl = body.crawl;
  if (!integer(body.generated_at_epoch) || body.generated_at_epoch === 0 || !crawl ||
      !integer(crawl.started_at_epoch) || !integer(crawl.finished_at_epoch) ||
      crawl.started_at_epoch > crawl.finished_at_epoch || crawl.finished_at_epoch > body.generated_at_epoch ||
      body.generated_at_epoch * 1000 > now + 60000 ||
      typeof crawl.partial !== 'boolean' || !integer(crawl.exit_code) ||
      !integer(crawl.max_nodes) || !integer(body.raw_records) || !integer(body.handshake_ok) ||
      !integer(body.totals?.blake2b_reachable) || body.nodes.length !== body.totals.blake2b_reachable) throw Error('Invalid scan metadata');
  const endpoints = new Set(), versions = new Map(), networks = {ipv4:0, ipv6:0, tor:0};
  for (const node of body.nodes) {
    if (!integer(node.services) || (BigInt(node.services) & (1n << 28n)) === 0n) throw Error('Missing BLAKE2b handshake flag');
    if (!integer(node.port, 65535) || node.port === 0 || typeof node.address !== 'string') throw Error('Invalid endpoint');
    const network = node.network;
    if (!(network in networks) || !['ipv4','ipv6','tor'].includes(network) ||
        (network === 'ipv4' && isIP(node.address) !== 4) ||
        (network === 'ipv6' && isIP(node.address) !== 6) ||
        (network === 'tor' && !/^[a-z2-7]{56}\.onion$/.test(node.address))) throw Error('Invalid network');
    const address = network === 'ipv6' ? new URL(`http://[${node.address}]/`).hostname : node.address;
    const key = `${address}:${node.port}`;
    if (endpoints.has(key)) throw Error('Duplicate endpoint');
    endpoints.add(key);
    if (!integer(node.last_seen_epoch) || node.last_seen_epoch < crawl.started_at_epoch || node.last_seen_epoch > crawl.finished_at_epoch + 60) throw Error('Invalid observation time');
    const version = advertisedVersion(node.subver);
    const group = versions.get(version) || {version, count:0, userAgents:new Set()};
    group.count++;
    group.userAgents.add(node.subver || '(empty)');
    versions.set(version, group);
    networks[network]++;
  }
  if (body.handshake_ok < endpoints.size || body.raw_records < body.handshake_ok) throw Error('Inconsistent scan totals');
  return {
    observedAt: body.generated_at_epoch * 1000,
    scanStartedAt: crawl.started_at_epoch * 1000,
    scanFinishedAt: crawl.finished_at_epoch * 1000,
    reachable: endpoints.size,
    versions: [...versions.values()].map(v => ({...v, userAgents:[...v.userAgents].sort()})).sort((a,b) => b.count-a.count || a.version.localeCompare(b.version)),
    networks,
    partial: crawl.partial || crawl.exit_code !== 0 || body.seed_health?.publishable !== true,
    candidateLimitReached: crawl.max_nodes > 0 && body.raw_records >= crawl.max_nodes,
    candidatesAttempted: body.raw_records,
    handshakes: body.handshake_ok,
  };
}

export function createNodeObserver(store, {fetcher = fetch, clock = Date.now, enabled = true} = {}) {
  store.db.exec('CREATE TABLE IF NOT EXISTS node_observations(time INTEGER PRIMARY KEY,body TEXT NOT NULL)');
  let pending = null;
  function view() {
    const now = clock();
    const latest = store.db.prepare('SELECT body FROM node_observations ORDER BY time DESC LIMIT 1').get();
    const snapshot = latest ? JSON.parse(latest.body) : null;
    const attempt = store.get('node-observer-attempt');
    const stale = !!snapshot && (now - snapshot.observedAt > NODE_STALE_MS || snapshot.observedAt > now + 60000);
    const status = !enabled ? 'disabled' : !snapshot ? 'unavailable' : attempt?.failed ? 'unavailable' : stale ? 'stale' : snapshot.partial ? 'partial' : 'current';
    const daily = new Map();
    for (const row of store.db.prepare('SELECT body FROM node_observations WHERE time IN (SELECT MAX(time) FROM node_observations WHERE time >= ? GROUP BY CAST(time / 86400000 AS INTEGER)) ORDER BY time').all(now-RETENTION_MS)) {
      const s = JSON.parse(row.body), day = new Date(s.observedAt).toISOString().slice(0,10);
      daily.set(day, {day, observedAt:s.observedAt, reachable:s.reachable, partial:s.partial, candidateLimitReached:s.candidateLimitReached});
    }
    return {source:NODE_SOURCE, sourceName:'The BTC Network', status, stale,
      lastAttempt:attempt?.at ?? null, lastFetchedAt:store.get('node-observer-fetched-at'),
      refreshMinutes:NODE_POLL_MS/60000, staleAfterMinutes:NODE_STALE_MS/60000,
      snapshot, history:[...daily.values()]};
  }
  async function poll() {
    if (!enabled) return;
    if (pending) return pending;
    const last = store.get('node-observer-attempt');
    if (last && clock() >= last.at && clock()-last.at < NODE_POLL_MS) return;
    pending = (async () => {
      try {
        const response = await fetcher(NODE_SOURCE, {signal:AbortSignal.timeout(12000), redirect:'error', headers:{Accept:'application/json','User-Agent':'XBT-Pulse/0.1 (+https://xbtpulse.tech/nodes)'}});
        if (!response.ok) throw Error('Feed unavailable');
        let size = 0, raw = '';
        const decoder = new TextDecoder();
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) throw Error('Feed too large');
          raw += decoder.decode(chunk, {stream:true});
        }
        const snapshot = parseNodeObservations(JSON.parse(raw+decoder.decode()), clock());
        const latest = store.db.prepare('SELECT MAX(time) AS time FROM node_observations').get().time;
        if (latest !== null && snapshot.observedAt < latest) throw Error('Regressed source timestamp');
        store.db.prepare('INSERT OR IGNORE INTO node_observations VALUES (?,?)').run(snapshot.observedAt, JSON.stringify(snapshot));
        store.db.prepare('DELETE FROM node_observations WHERE time < ? AND time != (SELECT MAX(time) FROM node_observations)').run(clock()-RETENTION_MS);
        store.set('node-observer-fetched-at', clock());
        store.set('node-observer-attempt', {at:clock(),failed:false});
      } catch {
        store.set('node-observer-attempt', {at:clock(),failed:true});
      }
    })();
    try { await pending; } finally { pending = null; }
  }
  return {view, poll};
}
