# Opt-in operator telemetry

## Public onboarding

Operators can apply at https://xbtpulse.tech/contribute. Applications are stored in the private SQLite `applications` table. Contact details and setup notes remain private; consenting names/statuses and reviewed profiles may be public. See the [operator decision guide](operators.md) for publication choices and collector alternatives. The form has durable global intake limits (30 new requests/hour, 1,000 pending) and rejects credentials in website URLs. Pending submissions are purged after 90 days when new intake is processed. This form does not send email automatically; administrators review the queue and can reply through private application conversations. Applicants must save their conversation link and return to check replies; an external contact channel can also be used manually. Submitted content is untrusted; never run commands or visit private endpoints requested in application notes.

Prefer the authenticated `/admin` review desk for approval, tokens and conversations; see [administration](admin.md). The following SSH commands remain an operations fallback:

```
docker exec xbtpulse-xbtpulse-1 node ops.mjs list
docker exec xbtpulse-xbtpulse-1 node ops.mjs approve APPLICATION_ID REVIEWED_PROVIDER_ID
docker exec xbtpulse-xbtpulse-1 node ops.mjs revoke REVIEWED_PROVIDER_ID
docker exec xbtpulse-xbtpulse-1 node ops.mjs reject APPLICATION_ID
```

Approval generates a random token and prints it once to the administrator's terminal; only its hash is stored. Deliver it privately after checking operator identity and data scope. Approval is not an independent audit. Database-backed tokens work immediately without a restart. Never approve an unsolicited application automatically. The report form on `/contribute` accepts actual JSON telemetry from approved operators, clears the token after success, and does not persist tokens in browser storage. The JSON placeholder is intentionally invalid until real measurements are provided. Existing environment-configured tokens remain supported; remove them from the environment and restart to revoke those.

No telemetry provider is active by default. A provider represents the operator controlling the submitted templates, not automatically the payout pool. Establish its identity and scope outside this API. Do not submit the same work under multiple provider keys.

Generate a random token with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` in a private terminal. Give the raw token only to its provider, configure its SHA-256 hex digest in `TELEMETRY_KEYS_JSON`, and restart the app. The variable is JSON mapping provider IDs to digests. Use HTTPS and `Authorization: Bearer TOKEN`; never URL query parameters.

POST `/api/telemetry` with `Content-Type: application/json`:

```json
{
  "id": "gateway-a-unique-interval-001",
  "start": 1789300000000,
  "end": 1789300060000,
  "found": 0,
  "segments": [
    { "shareDifficultySum": 1000000000, "networkDifficulty": 3417233412.77 }
  ]
}
```

The timestamps above illustrate the format; use actual UTC Unix milliseconds. Intervals must be recent, at most 15 minutes long, and non-overlapping for a provider. Retrying an identical report is idempotent; reusing its ID with different content is rejected. Payloads are limited to 32 KB.

Each segment sums accepted share difficulty for work under that network difficulty. Split intervals at difficulty changes. Both share and network difficulty must use the same normalized convention; do not confuse difficulty units from different miner profiles. Report each accepted share exactly once. Exclude invalid and duplicate shares. Count found blocks consistently before orphaning and do not call this count canonical-chain blocks. This first API stores operator-reported found counts; it does not independently verify them.

Expected blocks = sum(shareDifficultySum / networkDifficulty). Reported work share = provider's sum of share difficulty / all reporting providers' sum over included intervals. This is **not network-wide coverage**. The dashboard includes whole intervals within the last 24 hours and labels reporting providers as partial coverage. Missing intervals and stale sources can bias the comparison. Authentication is accountability, not a proof that the report is true or the provider independent.

Template refresh counts are intentionally not used as work or an attack detector. Future adapters should export aggregates from audited share ledgers and attach verifiable block outcomes before offering stronger withholding diagnostics.

## Retention and integrations

Accepted telemetry is retained for 35 days to support observation-period review; the public dashboard summarizes the last 24 hours. Retention does not guarantee complete reporting history. Revoking a token stops new reports, not historical display.

The [DATUM download](https://xbtpulse.tech/collector) is one compatible uploader. Operator-owned adapters may implement this contract without installing our scraper. Verify local counter units, reset handling and template scope first; see [adapter guidance](operators.md#bring-your-own-adapter). Release checksums have detached signatures; see [verification](release-signing.md). Public data consumers should use the separate [read API](api.md), with no provider token.

## Operator-owned upload transport

The [adapter kit](https://xbtpulse.tech/adapter) provides local validation and durable single-pending-report upload without gateway scraping. Operators still implement and verify their measurement layer. Its [compatibility checklist](../collector/adapter-kit/COMPATIBILITY.md) covers scope, units and reset handling. Its checksum has a detached signature; it does not automate credential challenges or assessments.

## Accepted-work-only reports

`found` remains required, but may explicitly be JSON `null` when block outcomes are not measured reliably. Numeric zero means measured zero, never unknown. Existing numeric reports remain supported. For example, use `"found": null` with genuine measured work segments and interval timestamps. Work-only reports count toward work totals and reporting coverage; they do not establish block outcomes or template control.

Public summary `found` is null if any included interval lacks outcomes. No partial found total is compared against the full expected total. Reviewer views follow the same rule; this does not award or publish a score. The original signed adapter kit v0.1.0 validator still requires numeric found and cannot transport work-only reports unchanged. Use the updated RATUM preview or an operator-owned client against a server with this change deployed; do not replace missing outcomes with zero to satisfy an older validator.
