# Pool evidence registry

`config/pools.json` starts empty. Explorer pool names are shown as `Explorer attribution`, with source metadata retained on each block. Do not silently describe these as independently verified pools.

To add a local rule after checking evidence, use this schema (illustrative, not a live rule):

```json
[
  {
    "id": "example-pool",
    "name": "Example Pool",
    "source": "https://operator.example/pool-identity",
    "tags": ["/EXAMPLE-POOL/"],
    "addresses": [
      { "address": "DOCUMENTED_ADDRESS", "role": "fee", "source": "https://operator.example/fee-address" }
    ]
  }
]
```

Tags are case-sensitive substring matches and are spoofable. Only documented `collection` or `fee` address roles can attribute a block. A `miner` role may label a recipient but never attributes the block to its pool. Conflicting local matches remain unknown. Local evidence takes priority over explorer labels; review it carefully and restart after registry changes. Avoid grouping ordinary recipients by co-occurrence: DATUM directly pays many unrelated miners in one coinbase.

Observations retain coinbase tag text, hash, previous hash, height, difficulty, timestamp, pool source, and output values. Use those details to audit a match. New blocks and replayed history may carry mutable third-party labels. A list of keys, tags, or payout addresses cannot prove how many independent people control templates.
