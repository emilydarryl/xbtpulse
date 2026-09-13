# Crypto-Eire compatibility review

Public endpoint inspected September 13, 2026:
https://crypto-eire.com/api/pools/knots/stats

The operator reports modified RATUM Prime v0.1.22 and has no public fork. This endpoint wraps dashboard data under `pool`, including `networkStats`, `poolStats`, `totalBlocks`, `totalBlocks24h`, `roundDiffSum`, and `effort`. The sampled response had zero pool hashrate, miners, blocks and round work. These values alone do not establish inactivity or the underlying service's reporting scope.

The response does not expose the preview adapter's cumulative accepted share difficulty, snapshot timestamp, build identity or pool identity. `roundDiffSum` has unconfirmed reset and accounting semantics; neither it nor estimated hashrate can safely substitute for a monotonic work counter. The current DATUM collector and RATUM preview must not be enabled against this URL.

Next request: a sanitized JSON sample from Prime's underlying local stats endpoint (commonly `/stats.json` in the inspected upstream source), its full build string, and definitions of any added counters. Remove miner addresses, worker names, tokens and private network details. Confirm whether counters cover the whole Prime pool, a gateway, or solo mining. If no cumulative accepted-work counter exists, ask the operator to expose a small local metrics extension and validate it with successive snapshots before packaging the adapter. XBT Pulse does not need SSH or a full private repository for this review.

The supplied announcement describes fees, payout mechanics and anti-block-withholding settings. Treat these as operator claims pending independent evidence. In particular, protocol settings do not justify an absolute guarantee that withholding is impossible. Do not infer template independence from the dashboard API.
