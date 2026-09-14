# Crypto-Eire compatibility review

Public endpoint inspected September 13, 2026:
https://crypto-eire.com/api/pools/knots/stats

The operator reports modified RATUM Prime v0.1.22 and has no public fork. This endpoint wraps dashboard data under `pool`, including `networkStats`, `poolStats`, `totalBlocks`, `totalBlocks24h`, `roundDiffSum`, and `effort`. The sampled response had zero pool hashrate, miners, blocks and round work. These values alone do not establish inactivity or the underlying service's reporting scope.

The response does not expose the preview adapter's cumulative accepted share difficulty, snapshot timestamp, build identity or pool identity. `roundDiffSum` has unconfirmed reset and accounting semantics; neither it nor estimated hashrate can safely substitute for a monotonic work counter. The current DATUM collector and RATUM preview must not be enabled against this URL.

The original request for an underlying stats sample and counter scope was answered by the operator sample below. XBT Pulse does not need SSH or a full private repository for this review.

The supplied announcement describes fees, payout mechanics and anti-block-withholding settings. Treat these as operator claims pending independent evidence. In particular, protocol settings do not justify an absolute guarantee that withholding is impossible. Do not infer template independence from the dashboard API.

## Operator sample reviewed September 14, 2026

The owner supplied Crypto-Éire's sanitized `/stats.json` sample and counter definitions. This is operator-provided evidence, not a fresh inspection of the running service. Miner identities, gateway tags, pool public key and payout script were redacted. This review records only the compatibility findings, not the full payload.

- Reported build: `0.1.22 (e69bf1780dbd-dirty)`. The base revision matches the preview's pinned version prefix; `dirty` means the exact source differs and patch compatibility remains unverified.
- `window.work` is a string integer (`221652992` in the sample). The operator defines it as accepted difficulty-work retained in the rolling TIDES payout window, targeted at `window_multiple × network difficulty` (8× here), not a lifetime cumulative counter.
- `window.shares` is the accepted share count retained in that same window. Both counters cover the entire Prime pool across connected gateways. Per-miner window work does not solve rolling-window expiry and need not be shared with XBT Pulse.
- `hashrate.pool_hs` is an accepted-work hashrate estimate over 600 seconds. It is not an exact interval accepted-work total for telemetry.
- The sample supplies `generated_at`, `network.difficulty`, height and hash, but does not contain the preview's `xbtpulse.cumulative_share_difficulty` extension.
- `blocks.found` is present and zero in this sample. Its lifetime/retention, reset and acceptance/orphan semantics still need confirmation; a single zero does not validate a found-block counter.
- `pool.fee_bps=100` expresses 1% in this snapshot. It does not establish fees for every hosted, own-gateway or solo endpoint, or authorize a public fee-profile change.

### Initial sample compatibility decision (superseded in part below)

Not ready to enable the RATUM preview or stock DATUM collector. For a rolling total, `new - old = newly accepted work - expired work`; even a positive difference can undercount accepted work. Dropping negative deltas does not repair this. Neither multiplying estimated hashrate by elapsed time nor differencing share counts meets the exact accepted-difficulty contract.

Pool-wide accepted work also does not identify which gateway built the templates. Agree on public provider scope before activation, and prevent overlapping pool and child-gateway reports from being aggregated as disjoint work.

### Initial follow-up questions (see operator response below)

1. Can the modified build expose a cumulative accepted share-difficulty total that does not decrease when TIDES shares expire, or produce exact interval aggregates from its accepted-share ledger? Confirm difficulty normalization against `network.difficulty`, treatment of invalid/duplicate shares, persistence across restart and a reliable ledger-reset marker.
2. What precisely does `blocks.found` count, and can records expire or be removed after orphaning? Define a consistent found-block counter for the same measured scope.
3. Can they provide several sanitized aggregate snapshots, including window expiry and restart/reset behavior, plus reconciliation against their accepted-work ledger? A zero-block sample alone cannot validate block-event handling. Work crossing a network-difficulty change must be segmented correctly or the ambiguous interval omitted.
4. If using our preview patch, provide the relevant modified stats/ledger diff or have the operator check it locally against their exact build, compile, test and validate on staging. The existing patch remains a proposal, not an installation instruction. Confirm process supervision too: the preview's process checks assume systemd; an operator-owned adapter is an alternative.

Only after these checks and scope agreement should provider activation and upload be considered. No operator message, telemetry submission, profile publication or software installation was performed as part of this review.

## Liam's cumulative-counter follow-up

Received through the owner after the initial review. These are operator-reported implementation semantics; the modified source and a new endpoint sample have not yet been inspected.

- New top-level `cumulative_accepted_work`: string-encoded u128, summing accepted share difficulty across the entire Prime ledger. Liam reports that it is updated in the same database transaction as the accepted share.
- Persisted in redb ledger metadata across process restarts. TIDES expiry, `--ledger-keep` pruning, payouts and orphaning do not reduce it. Deleting the ledger starts a new counter at zero.
- `blocks.found` is the length of stored block history since the current ledger/version began. Orphaning alone does not decrement it, but explicit `--void-block` removal does.
- Prime is the accounting authority across all connected gateways. Liam reports that gateways relay shares and do not submit separate cumulative reports. Register this as pool-wide accounting; it is not evidence of a single template builder. Recheck overlap against XBT Pulse's own provider mappings before activation.

### Updated decision and next step

The reported work-counter design resolves the rolling-window limitation in principle. Do not ask for the older proposed metrics patch merely to obtain this counter. The existing preview still expects `xbtpulse.cumulative_share_difficulty` and cannot consume this new top-level field unchanged. No adapter change or live validation has yet occurred.

The block-history count is not an immutable found-event counter. The preview rejects visible decreases, but that is insufficient: one newly recorded block and one voided record between samples can leave the count unchanged and silently hide a found event. Do not substitute zero for unknown found counts or claim that rejecting negative deltas solves this.

Request a fresh sanitized aggregate sample containing the exact new build string, `generated_at`, `cumulative_accepted_work`, network difficulty/height and `blocks.found`, followed by a second snapshot after accepted work. No miner list, pool public key, gateway tags or payout script need be sent; identity configuration stays local. Confirm accepted-share difficulty uses the same normalization as network difficulty, including any chain-specific scaling, and excludes invalid/duplicate submissions. Counter deltas need reconciliation against the operator's ledger before live use.

For reliable found accounting, prefer a separate persisted cumulative found-event counter with a defined recording event, never reduced by `--void-block`. Alternatively, an atomic void/revision marker can let the adapter omit any interval containing a correction; intervals across a marker change must be omitted even if `blocks.found` rises. Define what happens to rejected submissions versus recorded blocks and subsequent orphaning.

A stable ledger-generation identifier, captured with the counters, would distinguish replacement/reset from normal growth even if a fresh ledger exceeds the previous baseline before the next poll. The preview currently omits intervals across process restarts, but that alone is not proof that all ledger replacements are detected. Confirm ledger replacement requires a restart or supply a generation marker. Keep counter timestamps/snapshots coherent and omit ambiguous difficulty-transition intervals.

Remaining work is to inspect the new schema/build, settle found-event and reset detection, adapt the preview with meaningful fixtures, and validate locally with the operator before token activation. No need to request SSH, install the stock scraper, or modify released downloads at this stage.

## Reduced operator work: accepted-work-only integration

The owner authorized moving integration effort to XBT Pulse. Local server changes now support explicit `found: null`; dashboard, pool and review summaries suppress outcome comparisons for incomplete windows. The RATUM preview can select `counterSource: "prime-cumulative"` and read Liam's top-level counter directly, ignoring mutable block history. No extra found-event counter or void marker is required for this mode. Earlier requests for those fields are optional future outcome support, not onboarding blockers.

This is tested implementation against synthetic fixtures, not verification of the running Prime build. Server support was deployed September 14 as `ba863f5cd892c07083fabeac66c4a25a1bb839f4`; health/readiness and existing live telemetry were verified. Operator activation remains pending. Minimal remaining operator work: validate a fresh sample/build and normalized units, confirm the existing process/reset assumptions, then run a local no-upload check when the integration is ready. The client omits restart, counter-decrease, difficulty-boundary and uncertain intervals. If their process supervisor differs from systemd or ledger replacement can occur without restart, adapt locally before enabling. Pool-wide scope and overlap review still apply.

## Operator-ready adapter follow-through

The owner requested proceeding with the information already supplied, without another operator questionnaire. See `collector/ratum/QUICKSTART.md`: local setup pins identity automatically and supports systemd or a maintained PID file; the default two-snapshot check never uploads; explicit `--submit` uses the existing provider token. No new stats sample or block counter is requested. The remaining step is Liam running the local setup/check and enabling delivery. We have not run it on his host or sent him a message. Eight RATUM tests pass, including setup, no-upload checks, process races, counter boundaries and redirect refusal. Signed public downloads and the web application are unchanged by this client-only follow-through.
