# Optional operator block-find feed

Operators can publish individual finds at [Report blocks](https://xbtpulse.tech/report-blocks), or POST events from software they control. Use the existing telemetry provider token; the work-only collector does not need changes. No new Prime counter, public stats endpoint, worker identities, wallet addresses or mining credentials are required.

Reports appear on the linked pool profile under **Operator-reported block finds**. The manual form requires explicit confirmation to publish or withdraw, clears the token after each request, and does not save it in browser storage.

## What the feed establishes

- The authenticated provider **reports** finding a particular block. This is not independent verification of the finder.
- XBT Pulse compares the submitted height and hash with its retained chain observations. That verifies a match against the configured source, not a separate proof-of-work validation by XBT Pulse.
- A matching block's existing chain attribution is displayed separately. It can name a different payout pool.
- Reports do not change canonical attribution, pool block totals, work totals, numerical scores, or telemetry `found`/expected comparisons. Optional reports are not a complete outcome ledger.
- Empty means **Not reported**, never zero finds. Different providers may report the same hash; do not sum their reports as unique network blocks.

## Eligibility

Use an active provider token linked to an approved, consenting published profile. Application ownership and curated provider mappings resolve the link. The API rejects new public reports if no eligible profile exists. Withdrawing consent or declining the application hides its reports. Revoking a token stops submissions; historical published reports remain unless withdrawn or consent is removed.

## POST contract

`POST https://xbtpulse.tech/api/block-reports`

Headers: `Authorization: Bearer TOKEN`, `Content-Type: application/json`.

```json
{
  "height": 972232,
  "hash": "REPLACE_WITH_THE_ACTUAL_64_CHARACTER_BLOCK_HASH"
}
```

This placeholder is deliberately invalid. Do not upload an illustrative block. Obtain both fields from the operator's actual mining records. Emit events only for your own recorded finds; forwarding every new block observed by a node would make false finder claims. Candidate counts and submission counts cannot be converted into this feed without identifying the actual block.

Only these fields are accepted:

| Field | Meaning |
| --- | --- |
| `hash` | Required 64-character hexadecimal block hash; normalized to lowercase |
| `height` | Required integer, at least the pinned XBT fork height (961640), maximum 100000000 |
| `action` | Optional `report` (default) or `withdraw` |

The provider comes from authentication, never the request body. The provider and hash identify the report. HTTP 201 means a new report or state change was accepted; 200 means an identical retry was already received. Both return `accepted: true`, `duplicate`, `action`, `hash`, and public `profiles` links (IDs and names). Acceptance means stored, **not chain-verified**.

Errors: 400 invalid input, 401 invalid/revoked token, 403 missing eligible public profile, 404 withdrawal has no matching report, 409 height conflict or an attempt to republish a withdrawn report, 415 wrong content type, 429 provider change limit. HTTP 429 includes `Retry-After: 3600`. Request bodies are limited to 32 KB and changes to 60 per provider per hour. Identical retries do not consume this allowance.

## Delivery from operator software

Persist each real event before sending. Use a serialized queue per provider, preserve each event until HTTP 200/201 acknowledges that exact hash/action, and retry unchanged after uncertain network failures. Wait at least one minute after temporary transport/server failures; wait one hour after HTTP 429. Pause for other errors and inspect the report and account configuration. Stop retrying after acknowledgment; do not run an old report file forever. Queue and mining-event detection remain under the operator's control.

The optional [Python sender](https://xbtpulse.tech/downloads/xbtpulse-block-reporter.py) needs Python 3.9+ and the standard library only. Its source is `public/downloads/xbtpulse-block-reporter.py`; it is a separate optional utility, not a replacement for signed collector packages.

```sh
# Local format check: no token read, no network request.
python3 xbtpulse-block-reporter.py block.json

# Explicit submission using the existing private token file.
python3 xbtpulse-block-reporter.py block.json --submit --token-file /path/to/token.txt
```

On Linux restrict the token file to its owner (`chmod 600`). The sender posts only to the fixed HTTPS endpoint, disables inherited proxies and redirects, prints no token or server response body, and leaves the input file unchanged. Exit 0 means a successful local check or acknowledged submission depending on mode; submission failures return 1, CLI misuse returns 2. A scheduler or mining-event hook may invoke the sender for each pending event. It does not discover blocks, parse DATUM logs, run a timer, or manage an automatic queue.

## Corrections and withdrawals

Send the original hash and height with `"action": "withdraw"` to remove a report from the public list. Another provider's report is unaffected. Repeating the withdrawal is safe. A delayed original upload cannot restore the same withdrawn report (409); contact XBT Pulse if withdrawal was accidental. For a wrong height, first withdraw using the original height, then send the same hash with the corrected height. For a wrong hash, withdraw it and submit the correct hash. Serialize these changes with your delivery queue.

Reports and withdrawal records are retained for 90 days from the latest change, not the block's timestamp. Unchanged retries do not extend retention. Public lists contain the newest 50 reports with a total count. Retention expiry is not a statement about lifetime production.

## Public read feed and chain states

`GET /api/pool?id=PROFILE_ID` now includes `blockReports`, regardless of the selected block window. Obtain the actual profile ID from `/api/pools`. No token is required for this read endpoint.

`blockReports` contains `total`, `limit`, `retentionDays`, `checkedAt`, `chainUpdatedAt`, `chainStale`, and `reports`. Each report exposes provider, hash, height, reported/updated timestamps, `chainStatus`, `finderStatus: "operator-reported"`, observed `blockTime` or null, and existing `attribution` or null. Report/check timestamps are Unix milliseconds; block time is Unix seconds. Private application fields and credentials are never included.

| `chainStatus` | Display | Meaning |
| --- | --- | --- |
| `observed` | Observed on chain | Hash matches the retained block at that height |
| `different-block` | Different block at this height | A different hash occupies that height in the collected chain; this alone does not establish why |
| `awaiting-data` | Awaiting chain data | No block at that height is currently retained; it may be ahead of collection or in a gap |
| `outside-history` | Outside retained chain history | Claimed height is older than the oldest retained block |

Statuses are recomputed from the retained chain on every profile request, so collection and reorg replacements update them without rewriting the operator's claim. Delayed source data is explicitly flagged; no external request is made to an operator-supplied URL. Older reports outside local chain coverage remain unverified rather than being presented as rejected or orphaned.
