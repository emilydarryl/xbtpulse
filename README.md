# XBT Pulse

**Making XBT mining decentralization visible.** Independent Bitcoin Blake2b network observatory for **xbtpulse.tech**. Private application source; public dashboard and read API. Requires Node.js 24, with no third-party runtime dependencies. Node's built-in SQLite provides persistent storage.

## Start locally

Copy `.env.example` to `.env`, then run `npm start`. Open http://127.0.0.1:4317. Run `npm test` and `npm run check` for validation.

The sample UI is explicitly illustrative. Live data starts only when `EXPLORER_API` or `RPC_URL` is configured. The example config uses the public mempool.guide API; **its pool labels are third-party attribution, not independently verified ownership**. Public visitors query a cached local database, never directly trigger source requests. The collector fetches up to 24 blocks per cycle and gradually backfills the configured retention (30,000 by default and on the VPS). Dashboard windows remain 144 / 576 / 2,016 blocks. History coverage is labeled while indexing.

## What is implemented

- Pilot reviewer scorecards: separate decentralization and transparency scores out of 100, private drafts, public preview, explicit publication and revision history. Missing criteria remain Not assessed; higher-tier awards remain disabled. `/ratings` explains the framework and `/scoring-rules` publishes the pilot rubric.
- Assessment assistant: telemetry coverage/gaps, bounded public-source retrieval, dated excerpts and content-change checks, conditional suggestions, follow-up drafts and automatic prefilling of empty form fields. Existing scores are preserved; saving, publishing and sending require separate action.
- Searchable `/pools` directory for retained block attributions, published profiles and approved consenting listings, including small/private operators. Homepage search links directly to it.
- `/pool?id=...` profiles show block statistics, sourced terms, participation and published scorecard links where available.
- `/trends`: 24-hour / 7-day / 30-day windows, daily operator charts and persistent public onboarding/status observations. Partial history and stale sources remain visible.
- `/mining-map`: selectable operators and relationships with scoped evidence labels. Soveroot–Lazarus is a dated inspected example; illustrative links and unknown relationships are explicit.
- Donut and legend ordered largest first. Clicking Other attributed groups opens a graph and statistics with tied block-production ranks, network share and within-group share. These ranks are not decentralization scores.

- Public operator registration at `/contribute`, private application conversations, profile publication and approved-token report submission. Optional listing consent controls pending homepage visibility; contact details remain private. No email or Discord notifications are sent automatically.
- Operator-installed DATUM collector at `/collector`; separate RATUM compatibility preview in `collector/ratum`. The collector uploads telemetry; it is not the public read API.
- Public JSON endpoints for dashboard, profiles, directory, trends, rubric and published scorecards. See [API reference](docs/api.md).

- 144 / 576 / 2,016-block observation windows; pool block share and Wilson intervals.
- Explicit unknown attribution; local evidence registry plus labeled explorer attribution.
- Coinbase recipient search and detail, integer-satoshi accounting, no balance or ownership inference.
- Concentration watch levels at 25%, 33%, and 50% in the dashboard.
- Canonical-chain checks and reorg/window reset observations; no unsupported reorg-depth claims.
- Authenticated, opt-in telemetry ingestion, replay/overlap protection, and difficulty-weighted expected-block accounting.
- Distinct live, delayed, unconfigured, and sample states; responsive UI.
- Docker deployment and a Caddy site snippet for the user's existing VPS.

## Measurement limits

Block attribution is a clue, not cryptographic operator identity. A pool may proxy work or use multiple names. Payout recipients are not assumed to be pools. DATUM/V1 cannot be reliably inferred from blocks. Template measurements represent only authenticated operator reports: neither the existence of one key per provider nor authentication proves independent ownership. A fresh installation has no approved reporting providers. No automated withholding accusation is made. Alerts are dashboard signals, not email or push notifications.

The initial pinned fork checkpoint is height 961640, hash `0000000000000050c1e5f69672f459293be14f46e5a494e7a8c8541396f18eeb`, retrieved from mempool.guide on 2026-09-13. It prevents accidentally indexing the SHA256 chain but is not independent validation of the explorer. A dedicated fork-aware full node is preferred before making stronger claims.

## Private repository and VPS

See [deployment](docs/deployment.md), [telemetry contract](docs/telemetry.md), and [attribution rules](docs/attribution.md). Never commit `.env`, node credentials, wallet data, or the SQLite database. No private mining infrastructure is required.

## Documentation index

- [For operators: benefits, privacy, requirements and custom adapters](docs/operators.md)

- [Visitor guide and page navigation](docs/site-guide.md)
- [Public API reference and examples](docs/api.md)
- [Operator onboarding and telemetry](docs/telemetry.md)
- [Administration and conversations](docs/admin.md)
- [Ratings, badges and rankings](docs/ratings.md)
- [Scorecards and publication requirements](docs/scorecards.md)
- [Assessment assistant and prefilling](docs/assessment-checks.md)
- [Historical trends and change feed](docs/trends.md)
- [Attribution rules](docs/attribution.md)
- [Deployment, retention and recovery](docs/deployment.md)
- [DATUM installation](collector/INSTALL.md) and [RATUM preview](collector/ratum/README.md)
- [Crypto-Eire compatibility findings](docs/crypto-eire-compatibility.md)

The header uses the shared coin-and-pulse SVG (`public/favicon.svg`), wordmark and a Main site link on secondary pages. Bitcoin orange marks primary actions; green remains participation/evidence styling. The collector guide HTML is generated by `python collector/package.py`: update the generator rather than editing that generated header alone.
