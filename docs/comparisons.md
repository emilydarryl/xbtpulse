# Pool comparisons and Discord share cards

Use [Compare pools](https://xbtpulse.tech/compare) to examine two or three published pool profiles side by side. Open it from the homepage navigation, pool directory or a pool profile.

## Build a comparison

1. Enter a pool name in **Find a pool**. Suggestions appear as you type; Search also submits the query.
2. Choose **Add** beside a result. The query clears after selection. Repeat for another pool, up to three.
3. Remove a selection using its named chip above the comparison.
4. Choose the last **144**, **576** or **2,016** network blocks. The same requested window applies to each pool.

The table includes observed block share, attributed counts, sampling intervals, fees and payout terms, protocols, template-role claims, regions, telemetry, review dates, sources and separate published decentralization/transparency scores. A listing without a published profile cannot yet be selected.

Comparisons refresh every 30 seconds while the page is visible. Each profile is fetched separately; a notice identifies differing snapshot timestamps or sample sizes. Refresh before interpreting close results. Pool selection and window are retained in the URL for sharing.

## Share a PNG on Discord

1. Load two or three available profiles, then click **Share comparison card**.
2. Inspect the preview and click **Download PNG**.
3. Click **Copy comparison link**, then attach the downloaded image and paste the link into your Discord message.

Export is disabled until at least two profiles load successfully. If copying is unavailable, select and copy the displayed URL manually. Nothing is posted to Discord automatically.

The card includes pool names, observed share/counts, sampling intervals, sourced fees and payout method, protocols, linked telemetry status, the two published scores, review provenance, chain source freshness, creation time in UTC, observation window and source/profile URLs. Long fields may be shortened; follow the source links for complete terms. A PNG is an image, so paste the comparison link alongside it for clickable navigation.

The preview stays fixed while the underlying comparison refreshes. Close and reopen it to capture newer data. A shared URL opens current data; it does not reconstruct the historical PNG. Rendering happens in the browser without a new image-upload service.

## Interpret the evidence

- Block-production share and rank are separate from decentralization or transparency scores. No automatic winner is selected.
- Missing scores stay **Not assessed**, not zero. A participation badge is not a numerical rating.
- Private pools are labeled as not accepting miners; commercial terms are not applicable.
- Fees and protocol descriptions are dated sourced claims. They do not refresh whenever block statistics refresh.
- Attribution review counts describe a dated evidence snapshot, not the selected live window. Recipient addresses alone do not establish common ownership or template independence.
- Stale or absent telemetry describes reporting coverage, not proof that mining has stopped.

For full field definitions, see the [public API reference](api.md). Operators can [submit details](https://xbtpulse.tech/contribute) and follow the [operator guide](operators.md).
