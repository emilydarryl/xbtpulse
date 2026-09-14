# XBT Pulse

**Making XBT mining decentralization visible.** Independent Bitcoin Blake2b network observatory for **xbtpulse.tech**. Public source code, dashboard and read API. Requires Node.js 24, with no third-party runtime dependencies. Node's built-in SQLite provides persistent storage.

## Start locally

Copy `.env.example` to `.env`, then run `npm start`. Open http://127.0.0.1:4317. Run `npm test` and `npm run check` for validation.

The sample UI is explicitly illustrative. Live data starts only when `EXPLORER_API` or `RPC_URL` is configured. The example config uses the public mempool.guide API; **its pool labels are third-party attribution, not independently verified ownership**. Public visitors query a cached local database, never directly trigger source requests. The collector fetches up to 24 blocks per cycle and gradually backfills the configured retention (30,000 by default and on the VPS). Dashboard windows remain 144 / 576 / 2,016 blocks. History coverage is labeled while indexing.

## What is implemented

- `/simulator`: hypothetical observed-share shifts to one pool or equally among other named pools, before/after bars, concentration watch levels, shareable choices and a dated PNG scenario card. Unknown attribution remains unchanged; no hashrate forecast or independence claim.

- Persistent “What changed?” history on pool profiles: dated baselines, before/after public terms and assessment changes, linked telemetry states, source links and observation-gap notices. Latest 50 events shown from 90-day retention.

- `/miner-checker`: “Who builds my block?” explains hosted versus own-gateway paths using published template, payout and protocol claims, source dates and clear evidence gaps. No endpoint fee or template-independence verification is inferred from selection.

- Browser-local `/watchlist`: save up to 20 pools, see mining share and published scores, highlight fee/telemetry/assessment changes since the previous visit, and compare two or three selections. No account or notifications.

- Pilot reviewer scorecards: separate decentralization and transparency scores out of 100, private drafts, public preview, explicit publication and revision history. Missing criteria remain Not assessed; higher-tier awards remain disabled. `/ratings` explains the framework and `/scoring-rules` publishes the pilot rubric.
- Assessment assistant: telemetry coverage/gaps, bounded public-source retrieval, dated excerpts and content-change checks, conditional suggestions, follow-up drafts and automatic prefilling of empty form fields. Existing scores are preserved; saving, publishing and sending require separate action.
- Searchable `/pools` directory for retained block attributions, published profiles and approved consenting listings, including small/private operators. Homepage search links directly to it.
- `/pool?id=...` profiles show block statistics, sourced terms, participation and published scorecard links where available.
- Side-by-side `/compare` views for two or three pools: compact name search, removable selections, a shared observation window and shareable comparison URLs.
- Downloadable comparison PNG cards for Discord: preview a dated snapshot with block statistics, sourced fees, telemetry status, separate published scores and source links; copy the live comparison link alongside it.
- Evidence freshness on pool profiles and comparisons: dated terms, attribution and assessment reviews, plus reporting/stale/inactive telemetry states. Missing evidence remains visible without automatically changing scores.
- Reviewed attribution maps on pool profiles, with tag groups, documented collection addresses, dated counts and reproducible source evidence where available.
- `/trends`: 24-hour / 7-day / 30-day windows, daily operator charts and persistent public onboarding/status observations. Partial history and stale sources remain visible.
- `/mining-map`: selectable operators and relationships with scoped evidence labels. Soveroot–Lazarus is a dated inspected example; illustrative links and unknown relationships are explicit.
- Donut and legend ordered largest first. Clicking Other attributed groups opens a graph and statistics with tied block-production ranks, network share and within-group share. These ranks are not decentralization scores.

- Public operator registration at `/contribute`, private application conversations, profile publication and approved-token report submission. Optional listing consent controls pending homepage visibility; contact details remain private. No email or Discord notifications are sent automatically.
- Operator-installed DATUM collector at `/collector`; separate RATUM compatibility preview in `collector/ratum`. The collector uploads telemetry; it is not the public read API.
- Operator-controlled adapter starter kit at `/adapter`, with payload validation and durable retry delivery for custom measurement integrations. It does not measure gateways itself.
- Signed checksums for both download packages, a pinned release-key fingerprint and `/verify-downloads` instructions.
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

## Source code and deployment

See [deployment](docs/deployment.md), [telemetry contract](docs/telemetry.md), and [attribution rules](docs/attribution.md). Never commit `.env`, node credentials, wallet data, or the SQLite database. No private mining infrastructure is required.

## Documentation index

- [Codex / maintainer handoff and current project state](docs/HANDOFF.md)

- [For operators: benefits, privacy, requirements and custom adapters](docs/operators.md)

- [Visitor guide and page navigation](docs/site-guide.md)
- [Pool comparisons and Discord share cards](docs/comparisons.md)
- [Public API reference and examples](docs/api.md)
- [Operator onboarding and telemetry](docs/telemetry.md)
- [Administration and conversations](docs/admin.md)
- [Ratings, badges and rankings](docs/ratings.md)
- [Scorecards and publication requirements](docs/scorecards.md)
- [Assessment assistant and prefilling](docs/assessment-checks.md)
- [Historical trends and change feed](docs/trends.md)
- [Attribution rules](docs/attribution.md)
- [Reviewed AlphaPool attribution and reproduction](docs/alphapool-attribution.md)
- [Signed downloads and signing-key recovery](docs/release-signing.md)
- [Custom adapter kit](collector/adapter-kit/README.md)
- [Deployment, retention and recovery](docs/deployment.md)
- [DATUM installation](collector/INSTALL.md) and [RATUM preview](collector/ratum/README.md)
- [Crypto-Eire compatibility findings](docs/crypto-eire-compatibility.md)

The header uses the shared coin-and-pulse SVG (`public/favicon.svg`), wordmark and a Main site link on secondary pages. Bitcoin orange marks primary actions; green remains participation/evidence styling. The collector guide HTML is generated by `python collector/package.py`: update the generator rather than editing that generated header alone.

## License and contributions

XBT Pulse is licensed under **AGPL-3.0-or-later**. See [LICENSE](LICENSE). This license applies to the original application and collector code, including the collector source distributed in the download archive. Existing third-party copyright and license notices remain in force; the RATUM metrics patch targets AGPL-licensed upstream code, credited in [its guide](collector/ratum/README.md).

Operators can review the code without installing the scraper, or implement the [telemetry contract](docs/telemetry.md) in their own adapter. Start with the [operator guide](docs/operators.md). See [CONTRIBUTING](CONTRIBUTING.md) for patches and compatibility reports, and [SECURITY](SECURITY.md) for private vulnerability reporting.

The public repository contains source and examples, not production databases, operator conversations or credentials. Both download packages have signed checksum files. See [release verification and key fingerprint](docs/release-signing.md).

Custom gateway operators can use the [adapter kit and compatibility checklist](https://xbtpulse.tech/adapter). Source lives in `collector/adapter-kit`; reproducible packaging uses `python collector/package-adapter.py`. The kit uploads operator-supplied measurements and is separate from the DATUM scraper.

## Accepted-work-only telemetry

Reports may explicitly use `found: null` when block outcomes are unavailable. Accepted work and expected blocks remain usable; public and reviewer views suppress found/expected comparisons for any window containing missing outcomes. The RATUM preview supports the operator-reported `cumulative_accepted_work` field. Server support is deployed; Crypto-Eire still requires operator validation before its reports go live.

Crypto-Éire can use the [Prime work-only quickstart](collector/ratum/QUICKSTART.md) to capture identity locally, check without uploading, and explicitly enable reporting with its existing provider token. No additional Prime block counter is required.

Public operators can have reviewed profiles before any attributed blocks. In Admin, use Review & publish profile and leave Pool ID blank to create a stable operator profile (or reuse that application's existing profile). Publication requires profile consent and identity/scope review. It does not establish block attribution, link telemetry, or award a rating. Existing attributed pool IDs should only be selected after verifying the relationship.

Mining-map links from other pool profiles open that operator's own view with published claims and explicitly unmapped connections. They no longer select the unrelated Soveroot–Lazarus example. New operators do not receive inferred connection arrows.

Soveroot is featured as a real private-pool walkthrough: homepage links lead to its profile, reported work and dated Lazarus connection. Current reporting status is derived from the dashboard response, with missing/delayed and sample states explicit. The example does not imply accepting miners, independent templates or an awarded rating.

Pool profiles show a prominent Pool scores panel below the name, above mining statistics and navigation. Decentralization and Transparency each show the published score out of 100 or Not assessed. The panel links to the evidence and scoring rules, dates published assessments, and flags historical observation periods. Private drafts are never displayed; comparisons continue to use published scores only.

## Private token claim links

Admins can select **Create token claim link** beside an approved active provider in Admin. Share that one-use private link with the intended operator through their existing private contact channel. It expires after 24 hours; a newer link supersedes the previous link. Creating or opening it does not change the current token.

The operator confirms replacement, generates the token and downloads `token.txt`. Only claiming replaces the previous token. Tokens are never placed in application conversations or stored in recoverable form; the server stores hashes. Revocation, loss of approval or an intervening token rotation blocks the claim. Anyone holding the private link can claim it, so never publish it. No message is sent automatically. A lost response or lost download requires a new admin-issued link; do not assume the old token still works.
