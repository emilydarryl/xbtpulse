# XBT Pulse

Independent Bitcoin Blake2b network observatory for **xbtpulse.tech**. Private application source; public dashboard. Requires Node.js 24, with no third-party runtime dependencies. Node's built-in SQLite provides persistent storage.

## Start locally

Copy `.env.example` to `.env`, then run `npm start`. Open http://127.0.0.1:4317. Run `npm test` and `npm run check` for validation.

The sample UI is explicitly illustrative. Live data starts only when `EXPLORER_API` or `RPC_URL` is configured. The example config uses the public mempool.guide API; **its pool labels are third-party attribution, not independently verified ownership**. Public visitors query a cached local database, never directly trigger source requests. The collector fetches 24 blocks per cycle and gradually backfills 2,016 blocks. Window selectors show the actual available sample during indexing.

## What is implemented

- 144 / 576 / 2,016-block observation windows; pool block share and Wilson intervals.
- Explicit unknown attribution; local evidence registry plus labeled explorer attribution.
- Coinbase recipient search and detail, integer-satoshi accounting, no balance or ownership inference.
- Concentration watch levels at 25%, 33%, and 50% in the dashboard.
- Canonical-chain checks and reorg/window reset observations; no unsupported reorg-depth claims.
- Authenticated, opt-in telemetry ingestion, replay/overlap protection, and difficulty-weighted expected-block accounting.
- Distinct live, delayed, unconfigured, and sample states; responsive UI.
- Docker deployment and a Caddy site snippet for the user's existing VPS.

## Measurement limits

Block attribution is a clue, not cryptographic operator identity. A pool may proxy work or use multiple names. Payout recipients are not assumed to be pools. DATUM/V1 cannot be reliably inferred from blocks. Template measurements represent only authenticated operator reports: neither the existence of one key per provider nor authentication proves independent ownership. No operator telemetry is connected initially. No automated withholding accusation is made. Alerts are dashboard signals, not email or push notifications.

The initial pinned fork checkpoint is height 961640, hash `0000000000000050c1e5f69672f459293be14f46e5a494e7a8c8541396f18eeb`, retrieved from mempool.guide on 2026-09-13. It prevents accidentally indexing the SHA256 chain but is not independent validation of the explorer. A dedicated fork-aware full node is preferred before making stronger claims.

## Private repository and VPS

See [deployment](docs/deployment.md), [telemetry contract](docs/telemetry.md), and [attribution rules](docs/attribution.md). Never commit `.env`, node credentials, wallet data, or the SQLite database. No private mining infrastructure is required.
