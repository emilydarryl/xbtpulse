# Reachable XBT endpoints and Knots versions

`/nodes` shows third-party P2P observations from [The BTC Network](https://thebtc.network/) and its public [nodes feed](https://thebtc.network/data/nodes.json). This is not an XBT Pulse crawl, a full network census, or a count of independent operators. No miner installation or pool telemetry token is needed.

## Scope and versions

The source says it counts endpoints that completed a handshake and advertised `NODE_BLAKE2B`. Knots defines this as service bit 28; see the [upstream protocol definition](https://github.com/bitcoinknots/bitcoin/blob/v29.4.2.knots20260508/src/protocol.h). XBT shares mainnet port 8333 and message magic with SHA256 Bitcoin, so a Knots user agent alone cannot identify XBT. Service flags and user agents are peer claims, not independent validation of their chain or installed binary.

The adapter checks schema `btcb2.nodes/1`, BLAKE2b flags, endpoint uniqueness, observation timestamps and total consistency. It derives version groups from full `subver` strings: `/Satoshi:29.4.2/Knots:20260508/` becomes `Knots 29.4.2 / 20260508`. Parenthesized user-agent comments do not create separate release groups; release-candidate suffixes remain distinct. Full advertised strings are available in an expandable list. Non-Knots strings remain Other / unrecognized.

Only aggregates and user-agent strings are stored. Endpoint addresses are processed transiently to detect duplicates and are not published or persisted. IPv4, IPv6 and Tor are separate. Multiple addresses may represent one machine; multiple machines may have one owner. No geolocation, unique-operator estimate, software authenticity claim, score or upgrade recommendation is inferred.

## Collection and freshness

The server polls the fixed HTTPS source in the background every 15 minutes, independently of page views. Requests reject redirects and have a 12-second timeout and 2 MiB response limit. Visitor API requests only read SQLite. `NODE_OBSERVATIONS_ENABLED=false` disables source polling; the page labels any retained snapshot as disabled. The feature adds a `node_observations` table and three metadata entries to the existing database without changing mining records.

The source timestamp, scan start/end, fetch time, candidate attempts and completed handshakes are separate. A source timestamp older than two hours is stale even when fetched successfully now. Failed/invalid/regressed source responses retain the last snapshot and mark the source unavailable; no previous observation is silently replaced with zero. An empty valid scan can report zero. Partial scans, nonzero exit status or missing/unpublishable source health mark a snapshot partial. Reaching `crawl.max_nodes` is labeled capped even if the source says `partial: false`.

The last snapshot is kept for failure visibility. Other snapshots have 30-day retention. The public daily history uses the last recorded source observation per UTC day, not the sum of sightings or a deduplicated lifetime total. No pre-installation history is backfilled. History reflects the crawler's changing discovery and reachability conditions, not just network growth.

## Public API and maintenance

`GET /api/nodes` returns source attribution, `status` (current/partial/stale/unavailable/disabled), `stale`, last attempt/fetch timestamps, refresh intervals, a nullable aggregate `snapshot`, and daily `history`. No endpoints are returned. The browser refreshes this cached response every minute while visible. Failure to load the API hides the displayed results rather than implying they are fresh.

Tests cover XBT scope, full version and RC grouping, duplicate endpoints, invalid timestamps/totals, no address leakage, background fetch coalescing, persistence, stale/failed responses, oversized payloads, zero versus unknown, and partial scans. Source schema changes require a reviewed adapter update; do not relax validation merely to make the counter display.

### Regenerated source summaries

The source can emit `crawl.resummarised_only: true` instead of a full scan window. This is accepted only when its raw-file timestamp is within 60 seconds of an already retained scan finish and candidate/handshake/reachable totals match. All endpoint, service and timestamp validation still applies using that retained window. `summaryGeneratedAt` changes, but `observedAt`, the scan window and daily observation age do not. A resummary cannot bootstrap an empty database or masquerade as a fresh scan. The page explicitly says no new probes ran.
