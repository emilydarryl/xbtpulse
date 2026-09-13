# XBT Pulse DATUM collector v1.0.0

You install and control this collector. XBT Pulse does not need SSH access, your gateway password, node RPC credentials or wallet keys. Public and private operators are welcome.

## 1. Register and check compatibility

Submit your operator details at https://xbtpulse.tech/contribute. After review, an administrator supplies a provider token. Keep it private. One provider token should represent one reporting source; do not run multiple collectors with it.

This release supports Linux hosts with Python 3.9+, systemd, journalctl and cron, running a compatible BLAKE2b DATUM gateway. It is tested against the gateway described in README.md, not every DATUM fork, RATUM server, Docker deployment or Windows host. Run as the gateway's normal user. That user must be able to read the gateway process and service journal. Ask your own administrator for appropriate read access if necessary; do not run the collector as root just to bypass a failed check.

The gateway status page must expose Local Shares Accepted with its difficulty sum, Connected and Ready, the exact Secondary/Miner Tag, Block Difficulty, Bits and Block Height. Local share difficulty and network difficulty must both use bdiff units. Successful block submissions must be recorded in that same service's journal as `Block HASH submitted to upstream node successfully!`. A readable journal alone does not prove this format. Confirm it from a past event or the gateway source. An incompatible logger could silently undercount found blocks.

## 2. Download and inspect

Run on the gateway host as its normal user. Use a new directory; leave an existing installation and its state intact.

```sh
umask 077
mkdir -p "$HOME/xbtpulse-collector-v1"
chmod 700 "$HOME/xbtpulse-collector-v1"
cd "$HOME/xbtpulse-collector-v1"
curl -fSLO https://xbtpulse.tech/downloads/xbtpulse-datum-collector-1.0.0.zip
curl -fSLO https://xbtpulse.tech/downloads/SHA256SUMS.txt
sha256sum -c SHA256SUMS.txt
python3 -m zipfile -e xbtpulse-datum-collector-1.0.0.zip .
```

The checksum checks download integrity, not independent publisher identity. Read INSTALL.md, README.md and the Python source before running it. The archive contains only source, documentation, tests and a placeholder configuration. It never contains another operator's token or address.

## 3. Configure locally

```sh
python3 configure.py
python3 check.py
```

Enter your loopback status URL (port 7152 is only an example), the matching service name, your exact secondary tag, and the supplied token. Token entry is hidden and stored in config.json with mode 0600. No command-line token is required. `check.py` reads local data only and sends nothing. Do not proceed if it fails. Confirm the service and status port refer to the same gateway, especially on machines running multiple gateways.

Alternatively, copy config.example.json to config.json, edit it locally and run `chmod 600 config.json`. Never upload config.json, state.json, or challenge.json to support or GitHub.

## 4. Complete the credential challenge

Ask the XBT Pulse administrator for a credential challenge. Save only the supplied JSON body in challenge.json beside datum.py:

```json
{"code":"REPLACE_WITH_THE_ISSUED_CHALLENGE"}
```

```sh
chmod 600 challenge.json
python3 datum.py
cat status.json
```

The collector responds using your token and removes challenge.json on success. Challenges expire after 30 minutes and are single-use. Ask for another if expired. Delete an expired challenge.json before resuming regular collection, since a failed challenge prevents that run from reporting. Successful credential evidence lasts 30 days; request renewal through admin. It proves access to the credential, not pool ownership or truthful measurements.

## 5. Run a measured interval and schedule

The first successful run saves a baseline. Wait at least one minute, run `python3 datum.py` again, and inspect status.json. Look for `Measured interval accepted`. No historical shares are backfilled.

To run every minute, use `crontab -e` and add the following line, replacing YOUR_USER with your actual account name. Preserve all existing entries.

```cron
* * * * * /usr/bin/python3 /home/YOUR_USER/xbtpulse-collector-v1/datum.py >/dev/null 2>&1 # xbtpulse-collector
```

Confirm `command -v python3` matches the path and that your cron service is active. No active SSH session is needed. A lock prevents concurrent runs. Do not start a second installation using the same token.

## 6. Verify and understand the result

Check status.json after several minutes and your XBT Pulse profile. Approved, linked providers with recent positive work can earn Telemetry Contributor. Review readiness needs a successful challenge, recent work, consistency, and at least 95% complete interval coverage over the last 24 hours. Higher ratings still require human review. A profile must be linked to your provider by an administrator before its telemetry appears there.

Only report ID, interval timestamps, accepted difficulty delta, network difficulty and the unique successful-submission count are uploaded over HTTPS to xbtpulse.tech. Local URLs, client addresses, gateway logs, config, RPC credentials and wallet keys are not uploaded. The token is sent only as the HTTPS authorization header.

The collector does not alter or restart your gateway. It skips uncertain intervals around restarts, counter resets, target changes and long gaps. It saves pending reports before upload, so retries use the same ID. Found counts reflect gateway-logged successful submissions, not guaranteed canonical confirmations. See README.md for measurement limitations.

## Troubleshooting, updates and removal

- First run says baseline saved: normal; wait for a real interval.
- HTTPError: confirm token, internet access and challenge expiry. An expired or permanently rejected pending report needs support; do not change its numbers to force acceptance.
- ValueError/KeyError: status format, connection state, tag or configuration may have changed. Re-run check.py.
- FileNotFoundError/CalledProcessError: inspect the service name and process/journal permissions.
- Skipped interval: check gateway restarts, target changes, clock changes or host downtime. Coverage gaps are retained honestly.
- Status timestamp stops advancing: check cron, its path and the host clock. Cron does not automatically alert XBT Pulse about local failures; stale telemetry loses freshness recognition.

To update, stop only the collector's cron entry, back up its private directory locally, replace source files, and keep config.json and state.json. Never overwrite credentials with example files. Re-run compatibility checks before restarting the same cron entry.

To stop, remove only the line marked xbtpulse-collector from your crontab. Ask the administrator to revoke the token when retiring the integration. This does not stop mining. Other gateway software can use the documented telemetry API at https://xbtpulse.tech/contribute; do not fabricate zero measurements to make an unsupported adapter work.
