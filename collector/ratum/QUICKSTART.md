# Crypto-Éire: connect Prime to XBT Pulse

The adapter uses the `cumulative_accepted_work` counter Liam has already added. No additional Prime code change, block counter, stats sample to send, or SSH access for XBT Pulse is required. It reports pool-wide accepted work; block outcomes stay unavailable. XBT Pulse's server already supports this mode.

These instructions are for the Linux host running Prime, using Python 3.9+ and its standard library. Run as the normal operator user who can read Prime's local stats and process information. The client has automated tests; it has not yet been run on Crypto-Éire's host.

## 1. Get the source

Use a new private directory, leaving existing reporting installations alone:

```sh
umask 077
git clone https://github.com/emilydarryl/xbtpulse.git xbtpulse-prime
cd xbtpulse-prime/collector/ratum
chmod 700 .
python3 -m unittest discover -s . -p test_ratum.py
```

This is the repository's source adapter, separate from the signed DATUM and generic adapter ZIPs. Do not install those packages for this integration.

## 2. Configure locally, without a token

Replace the local stats port and service name with the values already used on this host:

```sh
python3 ratum.py --setup   --stats-url http://127.0.0.1:YOUR_STATS_PORT/stats.json   --unit YOUR_PRIME_SERVICE.service
```

For a supervisor other than systemd, use its maintained Prime PID file instead:

```sh
python3 ratum.py --setup   --stats-url http://127.0.0.1:YOUR_STATS_PORT/stats.json   --pid-file /absolute/path/to/prime.pid
```

The PID must identify the Prime process serving this endpoint, not a wrapper or gateway. The supervisor must update the file on restarts. Run inside the same process namespace if Prime is containerized. Do not guess a port or use the mining Stratum port. No remote endpoint is needed.

Setup reads the existing local JSON and saves the exact build and public pool identity in private `config.json`. They are not sent to XBT Pulse. It refuses to overwrite an existing configuration. Keep configuration, token and state private. Following a build or pool-identity change, review and update the pinned values locally; do not silently disable the check.

## 3. Check without uploading

```sh
python3 ratum.py --check
```

The check reads twice, ten seconds apart. It does not read a token, upload, or alter the reporting baseline or pending queue. A zero delta is valid but only confirms schema/process compatibility, not active accepted work. A positive delta shows observed counter growth. If it fails, check the local URL, service/PID access, clock, build and new counter. No mining restart is requested.

This uses Liam's stated difficulty units and persistence semantics. Work and network difficulty must share a normalization. Counter decreases, process restarts, difficulty changes and uncertain intervals are omitted. Stop this adapter before replacing/deleting the ledger and restart Prime before resuming, so a new accounting baseline is detected. The check cannot independently audit the truth of ledger counters or template control.

## 4. Enable with the privately issued provider token

After the local check passes, put the approved Crypto-Éire pool-wide provider token in `token.txt` using your local editor. Do not put it in a command, screenshot or message. If it is not available, ask XBT Pulse for a private token claim link. Open it, confirm replacement and download token.txt; place that file beside ratum.py on the Prime host. The link expires after 24 hours and can be used once. Do not create a second provider for the same pool work.

```sh
chmod 600 token.txt
python3 ratum.py --submit
```

The first submission run saves a baseline; a later run at least ten seconds later measures and uploads its interval. Only interval IDs/timestamps, accepted difficulty-work, network difficulty and `found: null` are submitted. Miner identities, the pool public key, payout data and build string stay local.

To run once per minute, add a line with the actual absolute source path to the operator user's crontab (`crontab -e`):

```cron
* * * * * /usr/bin/python3 /absolute/path/xbtpulse-prime/collector/ratum/ratum.py --submit
```

Running without `--submit` only checks; older schedules must add that flag. Read `status.json` locally for the last successful reporting action and check cron output for failures. XBT Pulse will verify arrival on our side. Do not run a second collector for this same pool work.

The client serializes runs, saves an identical pending report before sending, and retries it before measuring again. On persistent rejection, stop scheduling and inspect the configuration/token; preserve `state.json` rather than deleting or retiming reports. A delivery failure can mean the server accepted the report but the response was lost; retrying preserves its ID. Long gaps are omitted rather than invented. Removing the cron line stops reporting and leaves Prime mining unchanged.
