# Public API reference

Base URL: `https://xbtpulse.tech`. Public read endpoints return JSON and require **no API key**. They read XBT Pulse's retained data; they do not query a pool on demand. Polling every 30 seconds is sufficient. This is an unversioned beta API: handle missing/null fields, empty results, stale data and errors. There is no uptime or schema-stability guarantee.

**Reading versus contributing:** use the GET endpoints below to build your own dashboard or analysis. The downloadable DATUM collector sends measurements **to** XBT Pulse through authenticated POST endpoints. You do not need to download the collector to read public data. Private admin and conversation endpoints are not part of the public API.

## Endpoints

| GET path | Parameters | Main response fields |
| --- | --- | --- |
| `/api/dashboard` | `window=144` (default), `576` or `2016` | `sample`, `pools`, `blocks`, `addresses`, `telemetry`, `onboarding`, `privatePools`, `status`, `source`, `updatedAt` |
| `/api/pool` | Required `id`; same optional `window` | `id`, `name`, `sample`, `requested`, `blocks`, `share`, `interval`, `recent`, `addresses`, `status`, `updatedAt`, `evidence`, `rating`, `profile`, `assessment`, `scorecard`, `telemetry`, `attributionReview`, `freshness` |
| `/api/pools` | `q` pool-name substring, `type=all/public/private/unspecified`, `page=1` | `rows`, `total`, `page`, `pages`, `lastSuccess` |
| `/api/trends` | None | `oldest`, `windows`, `daily`, `lastSuccess`, `stale`, `changesStarted`, `changes` |
| `/api/scoring-rules` | None | `rubric`, `criteria` |
| `/api/scorecard` | Required `pool` profile ID | `card`, `criteria`; 404 if no publicly available scorecard |
| `/healthz` | None | `{ "ok": true }` when the process responds |
| `/readyz` | None | `{ "ready": true/false }`; HTTP 503 when collection is not ready |

Profile IDs are opaque strings. Obtain them from `pools[].id`, directory rows, or profile links; do not manufacture them from names. Examples include `explorer:soveroot` and `private:example`. URL-encode IDs. A directory-only approved listing can have `profileUrl: null`; it does not yet have a published profile. Directory results are alphabetical, 30 per page, with case-insensitive name matching. `total` describes the filtered results; `pages` is zero for no matches.

```sh
curl 'https://xbtpulse.tech/api/dashboard?window=144'
curl 'https://xbtpulse.tech/api/pools?q=soveroot&type=all&page=1'
curl 'https://xbtpulse.tech/api/pool?id=explorer%3Asoveroot&window=576'
curl 'https://xbtpulse.tech/api/trends'
curl 'https://xbtpulse.tech/api/scoring-rules'
```

Node.js 24 example:

```js
const response = await fetch('https://xbtpulse.tech/api/dashboard?window=144');
if (!response.ok) throw new Error(`XBT Pulse returned HTTP ${response.status}`);
const data = await response.json();
console.log({ status: data.status, observations: data.sample });
for (const pool of data.pools ?? []) {
  console.log(pool.name, pool.blocks, `${(pool.share * 100).toFixed(1)}%`);
}
```

No cross-origin browser CORS policy is currently exposed by the app. Use a server-side HTTP client or your own backend when integrating into a different website. Do not put admin cookies or provider tokens into a public frontend.

## Units and interpretation

- Shares and confidence interval bounds are fractions (0.25 means 25%). Wilson intervals cover sampling uncertainty, not attribution accuracy.
- Raw block `time` uses Unix **seconds**. Telemetry intervals, `lastSuccess`, directory `lastObserved`, trend bucket boundaries and change times use Unix **milliseconds**. Dashboard/profile `updatedAt` is an ISO timestamp or null. Reviewed profile dates and some checklist timestamps are ISO strings; scorecard observation dates are `YYYY-MM-DD` UTC.
- Use `sample`, not the requested window, as the observed denominator. Backfill can be incomplete.
- Pool `share` and block counts can be null when a private profile has no reviewed attribution link. Null is unavailable, not zero. Directory zero counts mean no matching retained observations, not an offline pool.
- Unknown blocks remain in network denominators. “Other attributed groups” is a UI grouping of named pools outside the top four, not a distinct pool. The full API pool list preserves the individual groups.
- Directory `recentBlocks` uses the newest 144 retained network blocks. `retainedBlocks` covers the configured retained history, not all-time production. `lastObserved` is the latest attributed block timestamp, not the last telemetry report.
- Telemetry is authenticated **operator-reported** work. It is neither network-wide coverage nor proof of template independence. `expected` and `found` are measured-work expectations and reported outcomes, not proof of an attack.
- The pool `rating` object remains the participation/framework status. A reviewed numerical pilot assessment, when published, is separate in `scorecard` and `/api/scorecard`. Do not interpret Telemetry Contributor or block-production rank as a numerical decentralization score.
- `profile` can contain dated public research or reviewed operator submissions. Terms and fees do not automatically refresh with mining observations. A retrieved website claim is not independently verified evidence.

## History and changes

`windows` has `days` values 1, 7 and 30. Each bucket contains `start`, `end`, `complete`, `blocks` and `pools`. `daily` has 30 UTC calendar-day buckets; today is partial even if older history covers its start. `complete` indicates retained history reaches the bucket start. Always examine `stale` separately and do not fill missing days with synthetic zero mining activity.

`changes` contains the latest 30 currently public operator status observations (up to 90 days retained): `time`, `name`, `profileUrl`, `previous`, `status`. A null `previous` means first observed by this tracker, not the operator's joining or approval date. This feed currently tracks onboarding/participation status, not rating revisions or every network event. See [trends](trends.md).

## Freshness, caching and errors

Dashboard `status` can be `live`, `stale`, `connecting` or `unconfigured`; sample mode is generated in the browser and is not real API evidence. JSON responses use `Cache-Control: no-store`, while the server can reuse dashboard results for five seconds and directory/trend calculations for ten seconds. Collector cycles normally run every 30 seconds. Do not infer a new block from a changed response timestamp.

Errors use `{ "error": "message" }`. Invalid observation windows return 400; missing profiles/scorecards return 404. Handle non-200 responses and retry with backoff rather than tight loops. `/healthz` establishes process responsiveness, not source accuracy. `/readyz` checks source freshness.

## Pool evidence and comparison clients

Pool responses include `attributionReview` (null if unavailable): curated public address/tag evidence, dated range, snapshot counts and source links. These counts do not refresh with the requested block window and are not template-control measurements.

Pool `freshness` includes `checkedAt` (Unix milliseconds), `reviewPeriodDays`, review objects (`status`, `reviewedAt`, `dueAt` as ISO timestamps or null) for attribution/profile/assessment, and reviewed linked provider telemetry (`name`, `status`, `lastReport`, `lastWorkReport` in Unix milliseconds or null). Missing retained reports differ from a known stale report. Current credentials determine inactive status. Review age does not change score values or attribution rules.

The comparison page uses `/api/pools` for selection and one `/api/pool` request per selected ID with the same `window`. There is no separate comparison or PNG API endpoint. Responses can have different timestamps or sample sizes; preserve that distinction. PNG cards are rendered locally in the browser from the loaded public comparison and include a creation timestamp and source links.

## Submitting telemetry

Published profiles resolve telemetry providers from both curated registry links and their approved, consenting application. This links work, reporting freshness and profile history without creating block attribution. Revoked providers remain linked so their freshness can show inactive status.

`POST /api/telemetry` requires a reviewed provider's bearer token. `POST /api/telemetry/challenge` answers a one-time credential challenge with that same token. See [telemetry contract](telemetry.md) and [collector installation](../collector/INSTALL.md). Approval, profile publication, participation badges and scorecard publication are separate actions.

## Pool change history

`/api/pool` includes `history` (null when no eligible public profile exists). Fields: `startedAt`, `lastObserved` (Unix milliseconds or null), `retentionDays` (90), `total`, `limit` (50), and newest-first `events`. Each event contains `time`, `kind` (`baseline` or `change`), `changes` (`field`, `before`, `after`), source provenance/review date/links, and optional `gap` (`from`, `to`). Baselines have no previously observed values. A gap-only event can have an empty changes array. No per-block or hashrate changes are recorded here. API values describe observations, not operator-confirmed event times. Events use an explicit public-field allowlist; private applications and conversations are excluded.

### Missing telemetry outcomes

Telemetry provider summaries return `found: null` if any included interval has unavailable block outcomes. `expected`, `work` and `workShare` still summarize accepted work across all included intervals. Clients must suppress found/expected ratios for null outcomes; do not coerce null to zero. Historical numeric reports retain their meaning.

## Recipient details

`GET /api/address?address=URL_ENCODED_RECIPIENT&window=144` (also 576/2016) returns observed coinbase receipts for an exact address/script from the local retained chain. Fields: `window` and `retained` aggregates (`blocks`, `outputs`, `sats`, `first`, `last`, `sample`), reviewed `roles`, block-attribution `groups`, latest 20 `recent` matching blocks, `updatedAt`, `source`, and `stale`. First/last/block times are Unix seconds; updatedAt is ISO. Repeated outputs sum amounts but each block is counted once. Missing recipients return 404. This endpoint does not query wallet balances or infer ownership, spending or maturity.

Pool `characteristics` contains `pool` and `network` aggregates for the requested window: `blocks`, `transactions`, `sizeBytes`, `weight` (each metric has `observations` and nullable `average`), `coinbaseOnly` (`observations`, nullable `count` and `share`) and `recipients` (`observations`, nullable `average`, `single`, `multiple`). Transaction count includes coinbase. Recipient metrics count distinct positive-value scripts/addresses per block. Missing source metadata is excluded from that metric denominator; historical coverage can be partial during enrichment. No pool rating is derived from these fields.
