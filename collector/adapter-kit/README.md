# Operator-controlled adapter kit v0.1.0

This is a small upload transport, **not a gateway collector**. You supply genuine measured intervals from software you control. No systemd unit, status-page scraper, file-log format, SSH access or vendoring of the XBT Pulse application is required. Linux uploads use Python 3.9+ standard library only; local validation also works on Windows.

Read COMPATIBILITY.md and agree your provider scope with XBT Pulse before sending data. This kit has automated transport tests, not a live integration approval for Lazarus, RATUM or any other gateway. Public pool-built Stratum jobs do not prove miner-controlled templates.

## Install and validate without sending

Unzip into a directory you control. Keep tokens, state and generated reports outside source checkouts. No root installation or mining restart is required.

```sh
python3 uploader.py validate your-measured-report.json
```

Validation does not read a token, create state or make network requests. It checks the JSON contract and bounds, not whether counters or template claims are true. `report.example.json` is deliberately old, synthetic and rejected as current telemetry; do not retime and upload it. Build a report from real measurements instead.

Your adapter must persist interval boundaries and a stable unique ID before handing the report to the uploader. JSON fields are id, start/end (UTC Unix milliseconds), found and segments (accepted shareDifficultySum and matching networkDifficulty). Segments must reflect actual work at each difficulty. Intervals must not overlap and must be at most 15 minutes. The server accepts reports up to seven days old.

## Explicit submission

Save the privately issued provider token in a file owned by your Linux user, readable only by that user. Do not put it in command-line arguments, sample files, logs or version control.

```sh
mkdir -m 700 "$HOME/.xbtpulse-adapter"
# Create token.txt there using your private editor, then:
chmod 600 "$HOME/.xbtpulse-adapter/token.txt"
python3 uploader.py submit your-measured-report.json \
  --state-dir "$HOME/.xbtpulse-adapter/state" \
  --token-file "$HOME/.xbtpulse-adapter/token.txt"
```

Only the aggregate report is sent to the fixed HTTPS endpoint https://xbtpulse.tech/api/telemetry. Redirects and environment proxy settings are disabled. Gateway endpoints, worker identities and credentials other than the provider token are not required. Do not add private fields to reports: the validator rejects extra keys.

## Retries and failures

```sh
python3 uploader.py retry \
  --state-dir "$HOME/.xbtpulse-adapter/state" \
  --token-file "$HOME/.xbtpulse-adapter/token.txt"
```

The pending report is atomically saved and flushed before sending. A network failure or ambiguous acknowledgment keeps it intact. Retries send the same ID, timestamps and measurements; server idempotency handles a lost success response. After confirmed acknowledgment, local state records its digest/end time to reject altered duplicates or overlapping work.

The uploader attempts at most one request per invocation. It records exponential backoff (30 seconds to 30 minutes); numeric Retry-After on HTTP 429 can extend this up to a day. An operator scheduler may call retry every minute; it returns without sending while backoff is active. Non-retryable HTTP failures pause the pending report. Inspect the HTTP status in private state, correct the issue, then use `retry --resume` deliberately. This overrides the pause/backoff, not payload validation.

A different report cannot replace pending work. Your adapter must keep its own durable queue and measurement baseline while delivery is blocked; the kit holds **one pending report**, not an unlimited spool. Use one state directory and one process pipeline per provider. Linux file locking prevents concurrent writers in that directory. Do not run multiple independent uploaders for the same measured work.

Expired or invalid reports stop locally and remain saved. Do not change their dates or silently skip them. Investigate with the reviewer; if a report must be abandoned, archive private state with the uploader stopped and document the resulting gap before starting a new queue. Never delete state just to get around a server rejection.

Exit 0 means accepted/already acknowledged/no pending work. Exit 1 means an error, pause or deferred retry; CLI usage errors return 2. Console errors exclude tokens and server response bodies. Token rotation is picked up from the token file on the next actual attempt.

Credential challenges remain a separate operator/reviewer step under the documented telemetry API; this kit does not automate them. It neither approves providers nor awards ratings.

## Tests, source and release verification

```sh
python3 -m unittest discover -s . -p test_uploader.py
```

Source: https://github.com/emilydarryl/xbtpulse/tree/main/collector/adapter-kit
Contract: https://github.com/emilydarryl/xbtpulse/blob/main/docs/telemetry.md

The ZIP includes only this guide, the compatibility checklist, uploader, synthetic example, tests and license. It contains no configured tokens or operator data. Its separately published SHA-256 checksum is **unsigned**; it detects differences from that digest but is not a publisher signature. This does not replace or alter the existing DATUM v1.0.0 package.

License: AGPL-3.0-or-later; see LICENSE.
