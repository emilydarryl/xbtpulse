# Lazarus Prime accepted-work integration

Status recorded September 15, 2026: **counter semantics confirmed by operator; live delivery not yet validated here.** Source: Awoken Lazarus's supplied sanitized Prime snapshot and written field definitions. This is operator-confirmed information, not a source-code audit or a completed live integration.

## Confirmed fields and scope

| Field or behavior | Operator-confirmed meaning |
| --- | --- |
| `totals.lifetime_work` | Cumulative sum of accepted **pool-split share difficulty**; each accepted share adds `2^target_pot` |
| Units | Same units as `node.difficulty`: Bitcoin difficulty-1 normalization, `1 = 2^32` hashes |
| Interval work | Successive differences of `totals.lifetime_work` supply `shareDifficultySum`; the counter is a sum, not the current share difficulty |
| Network retarget | Does not rescale the cumulative counter; it resizes the TIDES window |
| Persistence | Persists across Prime restarts in the ledger's `window.json` |
| Reset | Resets when that ledger is wiped; a downward jump means ledger reset, not difficulty change |
| `totals.work_accepted` | Process-lifetime counter that resets on restart; do **not** use it for these intervals |
| Included work | Pool-split work across every connected DATUM client and house Stratum on this Prime |
| Excluded work | Empty-solo and gateway-solo shares, rejects and duplicates |
| Block outcomes | `found: null` is correct for v1; no extra block counter is requested |

This scope is not all mining activity accepted by Prime, since accepted solo shares are excluded. It does not establish which party built templates or prove independent control. Do not sum this Prime aggregate with reports from included gateways as if their work were disjoint.

## Interval construction

1. Capture genuine consecutive snapshots with their source timestamps (`ts`, Unix seconds). Convert interval boundaries to Unix milliseconds for the API.
2. Subtract cumulative work exactly before serializing the interval. Preserve large counters without floating-point rounding; do not derive work from hashrate, share counts or the rolling TIDES window.
3. Use the matching `node.difficulty` for the work. Split at actual difficulty boundaries. If only endpoint snapshots are available and the difficulty changed, omit the ambiguous interval instead of assigning all work to either difficulty or inventing a split.
4. A decrease in `totals.lifetime_work` means a ledger wipe: skip that interval and establish a new baseline. Restart alone does not reset the confirmed persistent counter. If ledger continuity is uncertain, do not bridge the gap; a wiped counter could grow again before the next sample.
5. Persist the interval boundaries, work and stable ID before upload. Follow the existing time limits, overlap protection and identical-retry rules in [the telemetry contract](telemetry.md).
6. Send `found: null`. Do not reinterpret candidates or submissions as found-block outcomes.

## Transport and next validation

Lazarus prefers an operator-controlled adapter. No public stats URL, SSH access, extra block counter, full configuration or private miner information is required. The loopback `/stats.json` sample is a schema example, not a public endpoint. The supplied snapshot and example POST remain illustrative and must not be uploaded or retimed as real telemetry.

XBT Pulse's server accepts work-only reports. The original adapter-kit v0.1.0 validator requires numeric `found` and cannot send null unchanged; do not replace null with zero to satisfy it. The existing RATUM preview also expects a different source schema. Neither is a ready-made measurement adapter for this Lazarus snapshot.

Next: reconcile genuine interval deltas locally, send a real interval from the operator's adapter with its approved provider token, then verify positive work, ongoing delivery and correct profile linkage on XBT Pulse. Counter-definition questions are resolved; this does not mark live reporting as validated.

[Individual block-find reporting](block-reporting.md) is a separate optional feed using a concrete hash and height. It is not a requirement for Lazarus's work-only integration and does not require a new Prime block counter.
