# AlphaPool collection-address attribution review

Reviewed 2026-09-13. Research credit: [BLAKE2b MINER, One address, three names](https://blog.blake2bminer.com/blog/one-address-three-names/).

## What we reproduced

XBT Pulse's retained, explorer-sourced coinbases cover heights **963202–971931** for this comparison: 8,730 contiguous observations. The article starts at activation, 961640; our earlier history was not yet indexed. We therefore reproduce the observed counts below, not a complete independent node audit since activation.

The exact collection address is:

`bc1qlrmjpgg0e5jrhmzyjmtgc6dfpdr66sps8vjl2q`

| Tag classification | Blocks with this sole positive-value recipient |
| --- | ---: |
| Contains AlphaPool | 1,656 |
| Contains CEO of LukeCoin | 42 |
| Contains Test Test | 42 |
| Total | 1,740 |

We also found 14 AlphaPool-containing tags paying elsewhere. The 1,656 category includes some tags such as AlphaPool DATUM User; it is not an assertion that all use the identical doubled tag string.

[Machine-readable results and example hashes](alphapool-reproduction.json) record the range, source and matching outputs. Representative coinbases at heights 971931, 971868 and 971473 were re-fetched from mempool.guide and confirmed to have the single matching positive output. This is another check against the same explorer source, not independent full-node consensus verification.

## Rule used by XBT Pulse

The local registry maps this exact address to the existing `explorer:alphapool` group **only when it is the sole positive-value coinbase output**. Zero-value commitment outputs do not count. Merely including this address as one recipient among several cannot trigger this rule. The rule does not match CEO/Test tag text by itself, infer additional addresses from co-spends, or identify template builders.

Other blocks retain their existing explorer attribution. Consequently the dashboard's AlphaPool group may include explorer-labeled blocks paying elsewhere; it is a pool-attribution view, not precisely the article's collection-address-only series. Original tags, outputs and explorer labels remain stored on each observation. No blocks are duplicated or removed from the denominator. Attribution changes also affect historical charts computed from the current registry.

For the snapshot ending at 971934, the rule changed AlphaPool's attributed counts from 41 to 60 of 144, 147 to 229 of 576, and 679 to 763 of 2,016. These are dated comparison counts, not current figures or evidence of an attack.

## Reproduce or challenge the result

Export normalized public block observations (an array with height, hash, previousHash, time, difficulty, tag, source, reportedPool and outputs containing address/sats), then run:

```sh
node scripts/check-alphapool.mjs blocks.json 971931
```

The script checks contiguous hash-linked observations and reports the retained starting height. These structural checks do not validate proof of work or establish source independence. A fork-aware node's coinbases can be normalized using `lib/source.mjs` to repeat the analysis independently. Share block hashes and contradictory outputs in a repository issue if the rule needs correction.

This review does **not** reproduce spend clustering, miner counts, geographic claims, ownership, payout-batch analysis, or statistical claims about luck. A recipient address is not a person; payout coordination is separate from template autonomy. No score or participation badge is awarded by this attribution change.
