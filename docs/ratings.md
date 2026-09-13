# Ratings, participation and block-production ranks

XBT Pulse separates three measurements:

- **Block-production rank:** attributed blocks in a selected window, affected by luck and attribution quality. It is not a decentralization score.
- **Telemetry Contributor:** approved, active reporting with positive work within 30 minutes. This recognizes participation, not an independent audit.
- **Published pilot scorecard:** reviewer-assessed decentralization and transparency totals, each out of 100, with scope, evidence and dates.

The public framework is at `/ratings`; numerical pilot v0.2 rules are at `/scoring-rules`. See [scorecards](scorecards.md) for publication requirements and [assessment checks](assessment-checks.md) for automation limits. Documented, Verified and Leading Decentralization tiers remain proposed; the app does not award these higher tiers.

Historical work may remain in the 24-hour telemetry table after contributor recognition pauses. Badge freshness and work coverage are separate. Recognition is recalculated on dashboard responses, cached for up to five seconds; the browser refreshes every 30 seconds.

## Link a provider to a pool

Pool badges require an explicitly reviewed mapping in `config/pools.json`, using the exact pool ID:

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

A provider mapping is not a block-attribution rule. Do not add tags or fee addresses without evidence. Record the relationship and supporting review, deploy the config and retain the review in Git. Do not infer common control from matching names, payouts or applicant claims alone. Unknown blocks cannot receive contributor recognition. The repository includes a scoped Soveroot example; it does not establish every aspect of template independence.

## API interpretation

The legacy pool `rating` object contains participation/framework status and null numerical fields. Published reviewer scores are separate in `scorecard` and `/api/scorecard?pool=ID`. Consumers must not treat legacy null fields as zero or ignore a separately published scorecard.

Private and public operators use the same evidence rules; private operators need not publish commercial fees. A single private operator is not multiple independent ownership groups. Neither payment, sponsorship nor merely installing a collector should determine points. Missing evidence remains unassessed. See the [operator decision guide](operators.md) before applying.
