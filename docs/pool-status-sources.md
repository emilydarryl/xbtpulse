# Public pool status sources

Initial integration: Bitcoin Xor, September 19, 2026. The pool homepage links to https://xorpool.com/api/pool. Its response identifies `Bitcoin Xor` and `stratum.xorpool.com:23334`. This covers that endpoint only, not the separate DATUM service. Attach to `explorer:bitcoinxor` with the scope visible; do not interpret it as total operator hashrate or merge additional identities.

`pool_ths` and `network_ths` are TH/s; convert pool rate to H/s internally. Reported network share is their ratio. `height` is the source-reported chain tip, not the last block found. `updated` is Unix seconds. Source data older than five minutes or over a minute in the future is marked stale. Fetch time is separate from source time.

`/api/pools?view=status` enriches directory rows before sorting and pagination. One fixed HTTPS source is fetched at most once a minute, with concurrent requests coalesced, redirects refused, an eight-second timeout and a 32KB body cap. Failures retain the previous values with explicit stale/unavailable state and unchanged timestamps; a first failure produces missing metrics. Missing never becomes zero. UI refreshes every 30 seconds.

Other pools remain unavailable until source-specific fields, scope and identity have been checked. Reported figures do not replace block observations, modify suggested-pool eligibility or certify template control. No automatic offline or chain-lag verdict is inferred.
