# Rating framework: draft v0.1

The public framework is at `/ratings`. Launch implementation deliberately does not calculate numerical scores or award Documented, Verified, or Leading Decentralization. The proposal needs detailed rubrics, minimum evidence coverage, review governance, expiry schedules, and an appeal procedure before those tiers can launch. Pool concentration, reported protocol support, payouts, and luck cannot supply missing template-control evidence.

Only approved active telemetry providers reporting nonzero work within 30 minutes are eligible for Telemetry Contributor recognition. The public report remains operator-reported, not audited. Historical work may remain in the 24-hour table after recognition pauses; badge status and work coverage are separate. Recognition is recalculated at each dashboard response (cache up to 5 seconds, browser refresh every 30 seconds).

Pool badges additionally require explicit operator-reviewed mapping in `config/pools.json`. Add `providerIds` to the record with the exact pool ID returned by `/api/dashboard`:

```json
[
  {
    "id": "explorer:reviewed-pool-slug",
    "name": "Reviewed Pool",
    "providerIds": ["approved-template-operator-id"],
    "source": "https://operator.example/evidence-of-relationship"
  }
]
```

This mapping alone is not a block-attribution rule: do not add tags or fee addresses without evidence. Verify the relationship, record supporting evidence, deploy the updated config, and retain the review in Git. Never infer links from matching names, addresses, shared payouts, or applicant claims alone. Unknown blocks cannot receive contributor recognition. No mappings are preloaded and no existing pool has been awarded a score.

Both numerical score fields remain null even for contributors. The framework version and a scope explanation are returned in each pool's `rating` field. Payment or sponsorship must never affect eligibility or future points.
