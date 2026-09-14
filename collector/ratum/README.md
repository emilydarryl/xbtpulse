# RATUM Prime adapter — compatibility preview

**Ready for an operator-run local check; live compatibility is not yet verified.** This adapter is tested with synthetic source-schema fixtures, not their running service. No code or configuration has been changed on their machines. No telemetry has been submitted on their behalf. The existing DATUM status-page collector is not the appropriate adapter for Prime's JSON API.

## Source inspection

Upstream has no `v0.1.22` tag. The version was introduced by commit `e69bf1780dbd4b8b4035df3e0941576088e4f07c`. Inspection is pinned to that commit, not current main:

- https://github.com/iohzrd/ratum/blob/e69bf1780dbd4b8b4035df3e0941576088e4f07c/prime/src/stats.rs
- https://github.com/iohzrd/ratum/blob/e69bf1780dbd4b8b4035df3e0941576088e4f07c/prime/src/ledger.rs

`/stats.json` exposes pool.version, pool.pubkey, network.difficulty, network.tip_height, generated_at, a rolling payout window, estimated hashrate and recorded blocks. `window.work` is not cumulative; it can shrink when shares leave the payout window. Estimated hashrate is based on recent work and is not a valid substitute for a monotonic accepted-work counter. The ledger has a persisted cumulative_work method, but stock stats.json does not export its live value.

## Proposed metrics extension

`ratum-0.1.22-metrics.patch` adds only the following snapshot object, reading work and block count under the existing ledger lock:

```json
{"xbtpulse":{"schema":1,"cumulative_share_difficulty":"123456789","blocks_found":12}}
```

The values here are illustrative, not Crypto-Eire measurements. This is a proposed source patch against the pinned commit. It has been checked for clean application; Rust compilation and runtime validation are still required before use. Do not apply it blindly to another build. The underlying RATUM source is AGPL-3.0-or-later at this commit; retain its notices and meet its source-distribution obligations when deploying modified software. The patch does not change payout, share validation or mining protocol logic.

## What the adapter does

`ratum.py` runs on the Prime host, reads its loopback stats URL, checks the exact configured build string and public key, and calculates cumulative-counter deltas. The default mode refuses stock JSON without the extension; the optional prime-cumulative mode below reads the operator-added top-level counter. It rejects stale snapshots, counter decreases, process restarts, retarget boundaries, backward heights, changed network difficulty, and intervals longer than 15 minutes. It persists pending reports for identical retries and supports the existing credential challenge.

Only numeric interval aggregates reach XBT Pulse. The per-miner identities, balances, gateway lists, public key and version used for local validation are not uploaded. The configuration must be private (0600 in a 0700 directory). No SSH access is needed by XBT Pulse.

The counter is **whole Prime-pool accepted work**, spanning its connected gateways. It does not establish who built each template, and must not be combined with child gateway work as if those sources were disjoint. Pool SV1 access on port 3380 does not identify the stats port or prove this schema exists. `blocks_found` is the ledger's recorded accepted-block count; later orphaning is a separate chain outcome. Difficulty is sampled from the node snapshot, so boundary ambiguity is omitted rather than reconstructed.

## Historical preview checklist (superseded for Crypto-Éire)

For Crypto-Éire, use [the quickstart](QUICKSTART.md). It captures identity locally and requires no further sample or block-counter development. The checklist below documents the original extension review, not a new request to Liam.

1. Obtain their full `--version` / pool.version build string, repo/fork or commit, and an optional public stats.json URL. Do not request RPC credentials, wallet keys, a full configuration or SSH access.
2. Confirm whether their build already exports equivalent cumulative counters. If so, adapt the schema directly rather than asking them to patch.
3. If a patch is needed, check it against their exact source, compile and run the upstream test suite, and have the operator validate it on staging before any planned restart. This task has not compiled the Rust patch.
4. Compare several local snapshots and known block events: counters must remain monotonic across payout-window expiry; resetting the ledger must cause a baseline reset. Check that systemd service identity and stats URL identify the same process and mainnet chain.
5. Only then create a separate whole-pool provider token, populate config.json from config.example.json, run `python3 ratum.py --check` (no uploads), complete the challenge and schedule one run per minute. Keep provider identity separate from gateway collectors to disclose overlapping coverage.

## Tests

`python3 -m unittest discover -s collector/ratum -p test_ratum.py` checks schema refusal, identity checks, stale timestamps, exact deltas and reset boundaries. These fixtures are not evidence about the live Crypto-Eire pool. This preview is intentionally separate from the public v1.0.0 DATUM download until compatibility is confirmed.

## Work-only mode for Liam's counter

Add `"counterSource": "prime-cumulative"` to private config.json to read top-level string-u128 `cumulative_accepted_work`. This mode deliberately ignores `blocks.found` and sends `found: null`. It requires the work-only API update to be deployed first. It does not require the proposed source patch or another block counter.

Exact configured build/public-key checks remain local, as do systemd process checks. Supply the new build string locally; do not send credentials or miner identities. Work is subtracted as Python integers before serialization, with deltas above JavaScript's safe integer limit omitted. Restarts, decreasing counters, difficulty/retarget changes and intervals outside existing limits start a new baseline. Counter-source changes also start a baseline. Confirm ledger replacement requires a process restart; otherwise reset detection needs adjustment.

Validate a fresh sample, unit normalization and local process supervision with the operator before enabling. This is synthetic-fixture-tested preview support, not live integration approval. The legacy proposed extension uses mutable block history; do not enable its numeric outcomes on a build allowing undetectable record removal. Work-only mode avoids that dependency. Signed public packages are unchanged.

## Operator-ready work-only setup

Follow [QUICKSTART.md](QUICKSTART.md). `--setup` captures build/identity locally, `--check` samples twice without uploads, and `--submit` explicitly enables the existing durable delivery flow. Normal invocation is now check-only. A maintained Prime PID file can replace the systemd service lookup. Proxy inheritance and redirects are disabled for local reads and authenticated uploads.
