# DATUM measured-work collector

Runs on the gateway host as its normal user, once a minute via cron. It uses only the local status page, systemd process identity and the service's readable journal. It never edits gateway configuration, accesses wallet/RPC credentials, opens a listening port or restarts mining.

Create a private directory containing `datum.py` and a mode-0600 `config.json` with `token`, `gateway` (loopback status URL), `unit` (the exact systemd unit) and `secondaryTag`. A private optional `challenge.json` containing the issued `code` is consumed after a successful challenge response. Never commit these files.

The implementation measures the change in **local accepted share difficulty**, using the same bdiff convention as the matching gateway source. Network difficulty comes from the current job. The source and binary were checked on Soveroot at setup: gateway binary SHA-256 `e29e074c103f9adcd9ed2e394e2b72119a0ba5b723f179a9888a751ba366d28d`, source commit `e894b8a` with a clean worktree. This is an operational inspection, not a reproducible-build or independent template-control attestation.

`found` counts unique block hashes logged as successfully submitted to the upstream node by this service. It is a measured submission-success counter; it is not a count of permanently confirmed canonical blocks. The journal includes duplicate submissions, so hashes are deduplicated. Timing follows the logged submission success, which can differ slightly from discovery time. Gateway logs themselves remain operator-controlled evidence.

Reports use actual counter deltas, not estimated hashrate, historical backfill or invented blocks. Intervals spanning process changes, counter decreases, target changes, retarget boundaries, backward heights, or gaps over 15 minutes are skipped. Status-read failures and disconnected status prevent reporting. A failed upload remains on disk with the same report ID for an idempotent retry. `status.json` records the last result without credentials. A report rejected permanently needs operator investigation; the collector does not silently replace it with fabricated data.

The user crontab entry is marked `# xbtpulse-soveroot`. Remove only that entry to stop collection. Existing entries are backed up in `crontab.before`. Directory mode is 0700 and credential/state files are 0600. There is no dependency on an active SSH session.

Sampling introduces boundary uncertainty; a status-page snapshot cannot prove every share's template or exact difficulty at submission. Uncertain intervals are omitted. Credential proof expires after 30 days and must be renewed through admin. Telemetry Contributor recognition is participation only; full review still requires coverage, identity, attribution and template-control evidence.

