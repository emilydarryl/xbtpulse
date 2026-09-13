# Gateway compatibility checklist

Send answers and a sanitized JSON sample through your private application conversation. Do not send full configurations, passwords, tokens, miner addresses or private endpoints. No SSH access is needed.

## Identity and scope

- Gateway/pool software, full version or commit, and whether modified.
- Which component builds transaction templates? Which distributes jobs and coordinates payouts?
- Does this report cover a gateway, the whole upstream pool, solo work, or a mixture?
- Does another reporting provider include the same work? Identify overlap rather than summing it twice.
- State whether miners choose templates or receive pool-built jobs. An SV1 connection or DATUM label alone does not answer this.

## Required measurements

| Field or behavior | What to establish |
| --- | --- |
| Accepted work | Authoritative cumulative accepted share difficulty, or an equivalent exact interval ledger; exclude invalid/duplicate shares |
| Units | Share and network difficulty use the same normalization; document any conversion |
| Difficulty changes | Work segmented at actual network-difficulty boundaries; skip uncertain boundaries |
| Found blocks | Define discovery/submission/acceptance semantics; deduplicate outcomes; distinguish orphaning from original discovery |
| Clock | UTC timestamp, units, freshness and interval boundaries |
| Restart/reset identity | Detect process restart, counter reset, build/config changes and chain changes |
| Scope continuity | Detect upstream/template-policy changes; do not bridge uncertain intervals |
| Durable state | Persist baseline, ID and unsent intervals before upload; replay identically after a crash |

Estimated hashrate, worker counts, template-refresh counts and a rolling payout-window total do not replace accepted-work accounting. Window expiry can decrease rolling totals without a restart. A zero is a real measurement, not a substitute for missing data.

## Sanitized example to send

Describe field names and units, then provide two or three genuine consecutive snapshots with private identities redacted. Include elapsed times, accepted-work changes, network difficulty, process/reset indicators and any known block event. Explain what happens at a retarget or restart. Exact schema names are your choice; the uploader only needs the normalized interval contract.

Do not modify your status page to mimic stock DATUM. A local JSON export or file-log adapter can be suitable when its measurement semantics are established. Prefer existing monotonic counters; never infer truthful scope from the presence of fields alone.

## Before enabling uploads

1. Reviewer agrees the provider identity and measurement scope.
2. Operator reconciles several interval deltas with their local accepted-work ledger.
3. Check retargets, process resets, duplicate events, clock rollback, unavailable data and overlapping intervals.
4. Run local uploader validation without a token or network upload.
5. Test transport failure/retry behavior with local mocks; do not upload synthetic reports to the production endpoint.
6. Install the approved token privately, submit a real interval, and confirm ingestion with the reviewer.

The kit does not construct measurements, prove template independence, or assign a score. Review remains necessary even after reports arrive successfully.
