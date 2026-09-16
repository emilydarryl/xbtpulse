# XBT Pulse — Codex handoff

Prepared September 14, 2026. Read this before continuing work from another computer.

## September 16 endpoint observation pilot

Added `/endpoint-checks` and static `/endpoint-report.json`, linked from Tools and the homepage. Two bounded rounds tested seven confirmed endpoints among a frozen top ten: six supplied short work commitments, PyBLOCK's LOTTO endpoint had connection errors, and three groups lacked sufficient endpoint/mapping evidence. No full coinbase payouts were decoded, so no proxy comparison was established. No scores, telemetry semantics, credentials or chain attribution changed. Operators are invited through `/contribute`; no messages were sent. See [method and findings](endpoint-inspection.md). There is no automatic probe schedule. Read `/opt/xbtpulse/DEPLOYED_COMMIT` for the current deployed revision.

## September 15 mission and voice

The homepage now leads with "Know your pool. Make your own choice." `/about` explains the mission, fair evidence standards, corrections and shared ownership with Soveroot. It is linked from shared navigation, the homepage introduction and footer. No scoring or operator data changes. Validation: 76 tests, syntax and collector package checks.

## September 15 public evidence audit

Deployed application: `bd156f4` (full revision in `/opt/xbtpulse/DEPLOYED_COMMIT`). Live health/readiness and browser checks passed for dashboard telemetry, Crypto-Eire profile, two-provider comparison and contribution guidance. Explorer briefly returned an inconsistent block range after startup; it recovered without code changes and readiness returned true. Crypto-Eire retained its one reported block and unknown interval outcomes.

See [audit findings](audit-2026-09-15.md). Added 24-hour reporting coverage/count and explicit outcome availability to dashboard, profiles and comparisons; clearer setup paths and delivery diagnostics; explorer links for reported blocks; sourced-claim labels; and suppression of misleading zero-block characteristics on unlinked profiles. No schema, token, score or attribution changes. Validate with 76 Node tests, syntax and collector package checks. Read `/opt/xbtpulse/DEPLOYED_COMMIT` for the deployed revision; older revision references below are historical.

## September 15 update — profile linking and optional block reports

- Mission clarified with the owner: an independent, evidence-based resource for informed pool choices, assessing decentralization and transparency separately. Statistics and optional feeds support these assessments; participation is not proof of decentralization. See the README mission section.
- Awoken Lazarus confirmed `totals.lifetime_work` as persistent accepted pool-split difficulty-work across connected DATUM gateways and house Stratum, excluding solo work, rejects and duplicates. Counter-definition questions are resolved; live delivery remains to be validated. Use work-only reports and the operator's own adapter, not the stock scraper or unchanged v0.1.0 uploader. See [Lazarus Prime compatibility](lazarus-prime-compatibility.md) for exact scope, reset/retarget handling and the next validation step.

This update supersedes older deployment and Crypto-Eire reporting notes below. Deployed application revision: `eed2db6c40ff20c85f02e39aca8e11655e07020b`; recorded in `/opt/xbtpulse/DEPLOYED_COMMIT`.

- Crypto-Eire's approved application owns `crypto-eire-prime`. Positive work is arriving, and the profile now resolves application-owned providers for telemetry, freshness and history (`49ee599`). No collector reinstall or token change was needed.
- Pool profiles now show **Operator-reported block finds**, with chain match status separate from finder claims and existing chain attribution. No reports are added to block-production totals, work-only outcomes, or scores. Crypto-Eire currently has no individual block reports; Liam must supply the actual hash and height.
- `/report-blocks` provides an optional manual form and feed instructions. Authenticated `POST /api/block-reports` reuses existing provider tokens and supports report/withdraw actions. The downloadable Python sender validates locally by default; `--submit` sends a saved event. It does not discover mining events or install an automatic feed. See [block reporting](block-reporting.md).
- Reports require an approved, consenting published profile. Duplicates, withdrawals, ownership, consent, source gaps/replacements and rate limits have tests. The database change only adds block-report and rate-limit tables; existing mining data was preserved.
- Validation: 74 Node tests, 3 Python sender tests, syntax checks, signed collector packaging verification, isolated synthetic browser submission, live health/readiness, public profile fields, unauthenticated submission rejection, and exact deployed sender-source comparison passed. Live browser verified the new section and reporting-page link. No synthetic report was submitted to production and no message was sent to an operator.

The sections below describe earlier state and historical context.

## Current state

- Live site: https://xbtpulse.tech
- Public repository: https://github.com/emilydarryl/xbtpulse
- Branch: `main`.
- Last deployed application revision: `c091786c46056e3bb407e2c4d468be1023fb81c6` (September 14, 2026). Later documentation-only commits do not require a service rebuild.
- Latest application validation: 57 Node tests, syntax and collector packaging checks, isolated synthetic token-claim browser issuance, and live invalid-link/health/readiness checks passed. The earlier RATUM adapter follow-through passed 8 Python tests. This handoff update is documentation-only; those checks were not rerun for it.
- No active feature request remains unfinished. The owner requested this handoff to continue on another computer. Do not invent a previously approved next feature.

The mission is **Making XBT mining decentralization visible.** This is a public network observatory, not the owner's private mining pool. Preserve that separation.

## Start on the other computer

1. Clone the public repository and check out the latest `main`. Existing clones from before the public release should be recloned because the owner explicitly authorized a history scrub before publication.
2. Read `README.md`, this file, `docs/site-guide.md`, `docs/operators.md`, and `docs/deployment.md`. Check for any applicable `AGENTS.md` in the actual checkout.
3. Use Node.js 24. Runtime code uses Node's built-in SQLite with no third-party runtime dependencies. Python is used for collector packaging/tests, not the web server.
4. Copy `.env.example` to `.env` for local development. Never copy production credentials into examples. Run `npm start`, `npm run check`, and `npm test`. The local default port is 4317.
5. Source code access does not provide production SSH access, admin access, database contents, or release-signing authority. Configure access through the owner's existing secure process; do not ask for passwords or tokens in chat.

Original workstation checkout: `D:\websites\Github\wannabe-digital-classic\xbtpulse`. Its parent directory is an unrelated project. On another computer, use the new checkout path rather than assuming this Windows path exists.

## Implemented features

- Homepage: 144/576/2,016-block windows, observed pool share, Wilson sampling intervals, concentration signals, recent blocks, coinbase recipients and opt-in template-work telemetry. Refreshes every 30 seconds while visible.
- Distribution donut and legend are ordered by share. “Other attributed groups” opens ranked bars and per-pool statistics. Production rank is distinct from decentralization scores.
- `/pools`: searchable directory covering retained observations, published profiles and eligible consenting operator listings, including small/private operators.
- `/pool?id=...`: observed production, recipients, sourced fees/payout/protocol terms, participation, evidence freshness, reviewed attribution maps where available, published assessments, watch and compare links.
- `/compare`: up to three profiles, shared requested window, compact search, removable selections, dated claims and explicit missing data. Selection is shareable in the URL. PNG cards render in the browser with dates, sources and separate scores; copy the comparison link alongside the image for Discord.
- `/watchlist`: up to 20 browser-local favorites, current 144-block statistics, fee/telemetry/assessment differences since the previous saved visit, and a two/three-pool comparison shortcut. No account, cross-device synchronization or notifications.
- `/miner-checker`: “Who builds my block?” lets visitors choose hosted mining or their own DATUM gateway. Displays illustrative paths, public claims, source dates and missing evidence. It does not inspect equipment, certify template independence or calculate an endpoint-specific fee.
- Pool **What changed?** history: persisted by server collection cycles; public-field allowlist; baseline followed by before/after changes to terms, claims, reviews, published assessments, linked telemetry status and sources. Retains 90 days, returns latest 50 events plus total. Labels observation gaps longer than three minutes or three configured collection intervals, whichever is longer. Does not reconstruct earlier history.
- `/trends`: 24-hour/7-day/30-day observations, daily charts, partial-history labels and public participation/status-change feed. This older feed is separate from the new per-pool change history.
- `/mining-map`: curated relationships, currently including the dated Soveroot–Lazarus inspection, with explicit scope limitations.
- `/contribute`, `/admin`, `/conversation`: registration, consent, private application conversations, provider approval/token management, profile review/publication and assessment tools. No automatic email or Discord sending.
- `/ratings`, `/scoring-rules`, `/scorecard`: separate pilot decentralization and transparency scores out of 100. Automation assists evidence gathering and form prefilling; publication still requires review. Higher-tier badges remain proposed/disabled.
- `/collector`, `/adapter`, `/verify-downloads`: stock-compatible DATUM collector, operator-controlled uploader kit, and signed release verification.
- Public JSON read API, documented in `docs/api.md`. No API key or collector installation is needed to read it. The collector sends authenticated reports to XBT Pulse; it is not an API download for reading data.

## Important code locations

- `server.mjs`: routes, response policy, collection scheduling and pool API assembly.
- `lib/store.mjs`: SQLite persistence. Schema additions use `CREATE TABLE IF NOT EXISTS`.
- `lib/analytics.mjs`, `lib/collector.mjs`, `lib/source.mjs`: attribution, source collection and canonical-chain handling.
- `config/pools.json`, `config/researched-profiles.json`: curated public attribution/provider links and researched public terms.
- `lib/evidence-freshness.mjs`: review/telemetry age labels.
- `lib/pool-history.mjs`: persistent per-pool snapshots/history, consent gating and retention. Exposed as `history` in `/api/pool`; rendered in `public/pool.js`.
- `public/compare.js`, `public/share-card.js`: comparison and PNG export.
- `public/watch-store.js`, `public/watchlist.js`: browser-local favorites and visit differences.
- `public/miner-checker-model.js`, `public/miner-checker.js`: setup explanations and profile search.
- `lib/scorecards.mjs`, assessment modules and `docs/assessment-checks.md`: numerical review workflow.
- `collector/adapter-kit`: transport-only custom uploader. `collector/ratum`: compatibility preview, not a universally supported RATUM collector.

## Measurement and privacy boundaries

1. Block share estimates observed production over a window, not live hashrate, independence or an attack. Unknown blocks remain in denominators.
2. Coinbase recipients do not establish common ownership. DATUM payouts can connect unrelated miners. Never merge pools merely because miners switch pools or addresses co-occur.
3. Template-work telemetry is authenticated operator reporting, not cryptographic proof of truthful counters or independent template construction. Telemetry Contributor is not a numerical rating.
4. Missing scores stay Not assessed, not zero. Private commercial fields are not applicable. Fees/protocols are dated claims and may differ by hosted, own-gateway or solo endpoint.
5. Pool IDs are opaque: get them from the API/directory; do not construct them from display names. Example Soveroot ID is `explorer:soveroot`.
6. Published profiles/assessments and public history must respect consent. Never include application notes, contacts, conversations, tokens or drafts in public output.
7. Review age is generally 30 days; telemetry stale threshold is 30 minutes. These notices do not automatically change score values or establish pool downtime.
8. History timestamps indicate observation, not exact change time. The collector can miss intermediate changes. Preserve first-observed baselines, retention limits and gaps.

The documented AlphaPool sole-positive-recipient rule groups its reviewed collection address across differing tags. Read `docs/alphapool-attribution.md` and its reproduction before changing attribution. This is explorer-backed evidence, not a full independent node audit or template-control proof.

## Operator work still pending

- **Awoken Lazarus:** reviewed the code and DATUM archive; their gateway does not match the stock scraper (different status page, file logs, no systemd). They prefer an adapter they control, POSTing agreed aggregates. The uploader kit exists, but gateway-specific measurements/integration still require sanitized JSON/counter definitions and scope agreement. Do not request SSH access or tell them to install the stock collector. Public Stratum jobs may be pool-built and cannot establish DATUM-side template control.
- **Crypto-Eire:** approved public profile, owner-confirmed fee 3.5%, awaiting verified telemetry delivery. Liam's top-level string-u128 `cumulative_accepted_work` is consumed by the source RATUM adapter in `prime-cumulative` mode. It sends `found: null`; no additional block counter or stats sample is required. The owner reports sending the token-claim instructions/link to Liam. Claim redemption, installation and incoming reports have not been verified in this follow-up. Liam must save `token.txt` beside `ratum.py`, follow `collector/ratum/QUICKSTART.md`, run the local check, and enable scheduled `--submit` runs. Scope is whole Prime pool; avoid overlapping gateway reports and do not infer template control. Earlier requests to resolve found-event accounting before enabling work-only reporting are superseded.
- **Soveroot:** private operator with reviewed provider mapping and numeric reporting; private gateway is separate infrastructure. The September 13 connection inspection identified Lazarus upstream. Neither that inspection nor reporting establishes complete independence or automatic score eligibility. Current telemetry status must be checked rather than assumed.

Do not send messages to operators unless the owner explicitly authorizes sending. Drafting and posting are separate actions.

## Deployment

Hosting is the owner's existing Hostinger VPS. Use `docs/deployment.md` for the established SSH destination and routing details. Source is `/opt/xbtpulse`; container `xbtpulse-xbtpulse-1`; database `/app/data/pulse.sqlite` in volume `xbtpulse_pulse-data`.

The shared Caddy configuration also serves unrelated sites. Preserve those routes and all existing volumes. Do not run `down -v`.

Established deployment process:

1. Check intended diff, run appropriate tests and commit/push `main`.
2. Export committed source using `git archive --format=tar --output <release.tar> HEAD`.
3. Transfer to the VPS and extract into `/opt/xbtpulse`, preserving `.env` and data. Archives do not remove obsolete files automatically.
4. Run `docker compose -f compose.yaml -f deploy/compose.vps.yaml up -d --build` from `/opt/xbtpulse`.
5. Record the full application commit in `DEPLOYED_COMMIT`; check `/healthz`, `/readyz` and changed browser flows.

Documentation-only changes do not require a service rebuild. Never commit or publish production database copies or configuration secrets. Local `.env` and `data/` are ignored and are not part of the public clone.

## Releases and recovery

- Public code license: AGPL-3.0-or-later; preserve upstream notices.
- Current DATUM archive version: 1.0.0. Adapter kit: 0.1.0. Their manifests have detached OpenSSH signatures.
- Release-key fingerprint: `SHA256:rn5J0wzL/7dY5OdKiSz+J2+nu0INP1ShjIb+cB7uZh0`.
- Do not alter released archive bytes without a version bump. Do not regenerate or rotate the signing key simply because this is a new machine.
- Read `docs/release-signing.md`. Private signing material remains outside Git/VPS/CI. The original workstation has account/machine-protected storage; a separately encrypted portable backup and recovery process exist. The owner must supply access through a secure channel if signing is actually needed.
- A local backup copy is not proof that it was moved to disconnected media. Do not claim offline recovery readiness without checking that step with the owner.

Verification for package/release changes includes packaging checks, collector/adapter tests and `python scripts/verify-releases.py public/downloads --self-test`, in addition to web application tests. Do not modify package versions or signatures for ordinary website changes.

## Working preferences

The owner prefers action and concise progress updates. Preserve the compact layouts, common coin-and-pulse logo, Bitcoin-orange primary actions, clear main-site links and distinct chart colors. Features should be understandable to miners, with evidence limitations visible but without overwhelming boilerplate.

Update the README feature list, visitor/operator/API guides as appropriate with each feature. Use real browser checks for visible changes and tests for substantive logic. Keep reversible local work moving; do not repeatedly ask for permission already granted. Never assume a new machine has the old machine's tools, SSH keys or signing secrets.

## Deployed continuation: work-only telemetry

The owner requested reducing Crypto-Eire integration work. Deployed changes add explicit `found: null` ingestion and incomplete-outcome handling throughout public and reviewer summaries. RATUM preview mode `prime-cumulative` consumes Liam's new top-level counter and sends unknown outcomes, so a new block counter is no longer required. Deployed September 14 at the application revision above; `/healthz` and `/readyz` passed. Existing telemetry and current network collection were verified in the live browser. Crypto-Eire remains awaiting reports; no operator installation or message was performed. Validate fresh operator schema/build, units and process/reset assumptions before activation. Signed downloads remain unchanged; adapter kit v0.1.0 does not accept null outcomes.

Local validation: 52 Node tests and 4 RATUM Python tests passed, syntax checks passed, and real-browser checks with isolated synthetic data confirmed unavailable outcomes on dashboard and pool profile. No synthetic reports were stored in production. Production configuration and signed archives were preserved.

## Operator-ready adapter follow-through

The owner requested proceeding with the information already supplied, without another operator questionnaire. See `collector/ratum/QUICKSTART.md`: local setup pins identity automatically and supports systemd or a maintained PID file; the default two-snapshot check never uploads; explicit `--submit` uses the existing provider token. No new stats sample or block counter is requested. The remaining step is Liam running the local setup/check and enabling delivery. We have not run it on his host or sent him a message. Eight RATUM tests pass, including setup, no-upload checks, process races, counter boundaries and redirect refusal. Signed public downloads and the web application are unchanged by this client-only follow-through.

Directory search correction deployed September 14: accented and unaccented names now match without merging identities. All 53 Node tests, syntax and packaging checks passed. Live browser search for Crypto-Éire finds its approved listing; its public profile remains unpublished. Public health/readiness checks passed.

Public operator profiles without attributed blocks deployed September 14. All 54 Node tests, syntax and collector packaging checks passed; local and live browser checks plus public health/readiness passed. Crypto-Eire's existing consented profile is now published as `operator:1a92015f-7e74-47a1-9844-593d8b692b98`. The owner corrected its submitted fee to 3.5%; correction and publication are in the private admin audit log. Telemetry and attribution links remain separate and unconfigured for this new ID. No score awarded.

Mining-map operator links now load the requested public profile as an operator view with unverified connections and no invented arrows. Crypto-Eire is linked from the main map. Live browser verification confirmed its published claims; health/readiness, syntax, 54 Node tests and collector packaging checks passed.

Directory card spacing and View pool action deployed: heading separated from a wrapping action row, with primary View pool and secondary Compare. Syntax, collector package, local screenshot and live browser/health/readiness checks passed.

Soveroot private-pool walkthrough deployed September 14: homepage and profile navigation connect real profile, telemetry and dated connection evidence. Current feed verified live; missing reports and sample mode checked locally, syntax/package and production health/readiness checks passed. No rating or independence claim added.

Prominent Pool scores panel deployed below profile names; published totals, observation dates, evidence link and unassessed/error states are explicit. Local and live browser, syntax/package and health/readiness checks passed. Soveroot private draft version 1 saved at owner request for September 13–14 with all eight percentages null, evidence notes and remaining checks. No public scorecard was published. Draft is accessible via Admin → Soveroot → Assessment scorecard.

Private token claim links deployed: Admin provider action creates a one-use 24-hour link bound to the current provider credential. Claiming explicitly rotates the token and permits token.txt download; only hashes are stored. Existing conversation links gain no issuance power. Rotation/revocation/approval loss invalidate claims. No live links created or provider tokens rotated by this deployment. 57 Node tests, syntax/package checks, local synthetic browser issuance and live invalid-link/health/readiness checks passed.

## Latest operator handoff — September 14, 2026

The owner reports that the private token-link message was sent to Liam. This is user-reported delivery, not confirmation that he redeemed the link or started reporting. No operator-host access or new live feed verification was performed during this documentation update. Do not include the private link or raw token in GitHub, public examples or handoffs.

- Token access: Admin → Providers → the Crypto-Eire provider → **Create token claim link**. The link is single-use and expires after 24 hours. Creating it leaves the existing token unchanged; explicit redemption rotates the credential and offers a `token.txt` download. If a replacement is needed, use this flow rather than asking Liam to post a token in chat.
- Operator setup: save `token.txt` in the same folder as the XBT Pulse `ratum.py` script. Follow `collector/ratum/QUICKSTART.md`. Claiming a token does not start reporting. The first submission run saves a baseline; a subsequent run at least ten seconds later measures and uploads. The guide schedules runs once per minute. Default check mode does not upload; scheduling must include `--submit`.
- Confirm delivery: check Liam's local `status.json` for successful reporting, then verify report arrival on XBT Pulse and that the **Last report** timestamp continues advancing over successive scheduled runs. The onboarding listing shows a last-report time; recent qualifying positive work can earn **Telemetry Contributor**. Token issuance alone is not success.
- Profile visibility: verify the reviewed provider-to-profile mapping before expecting measurements on the pool page. If onboarding shows arrivals but the profile does not, inspect that mapping rather than asking for another token. The earlier published-profile entry records that the new profile's telemetry link was unconfigured at that time; do not assume it was subsequently linked without checking.
- Expected display: block outcomes remain **Not available** for this work-only integration. Reports older than 30 minutes are stale. Telemetry participation does not automatically award a numerical score or prove template independence.

Next action is to verify fresh Crypto-Eire reports once Liam finishes setup, including profile linkage and continued delivery. No additional Prime development request is pending. No monitoring automation was created; this handoff does not imply automatic notification when a report arrives.
