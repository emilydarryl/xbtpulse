const source = "https://xorpool.com/api/pool";
export function parseXorMetrics(body, now = Date.now()) {
  if (body.name !== "Bitcoin Xor" || body.stratum !== "stratum.xorpool.com:23334") throw Error("Unexpected pool scope");
  for (const key of ["pool_ths", "network_ths", "height", "updated"]) {
    if (typeof body[key] !== "number" || !Number.isFinite(body[key])) throw Error("Invalid metric");
  }
  if (body.pool_ths < 0 || body.network_ths <= 0 || !Number.isSafeInteger(body.height) || body.height < 961640 || body.updated <= 0) throw Error("Invalid metric range");
  return {reportedHashrate:body.pool_ths * 1e12, reportedNetworkShare:body.pool_ths / body.network_ths,
    reportedTip:body.height, metricsUpdatedAt:body.updated * 1000,
    metricsFetchedAt:now, metricsStale:now - body.updated * 1000 > 300000 || body.updated * 1000 > now + 60000,
    metricsSource:source, metricsScope:"stratum.xorpool.com:23334 only; excludes separate DATUM service"};
}
export function createPoolMetrics(fetcher = fetch, clock = Date.now) {
  let cache = null, checked = null, pending = null;
  return async () => {
    if (checked !== null && clock() - checked < 60000) return cache;
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetcher(source, {signal:AbortSignal.timeout(8000),redirect:"error",headers:{Accept:"application/json"}});
        if (!response.ok) throw Error("Unavailable");
        let length = 0, text = "";
        const decoder = new TextDecoder();
        for await (const chunk of response.body) {
          length += chunk.length;
          if (length > 32768) throw Error("Too large");
          text += decoder.decode(chunk, {stream:true});
        }
        cache = {...parseXorMetrics(JSON.parse(text + decoder.decode()), clock()), metricsUnavailable:false};
      } catch {
        cache = {...cache, metricsSource:source, metricsStale:true, metricsUnavailable:true};
      }
      checked = clock();
      return cache;
    })();
    try { return await pending; } finally { pending = null; }
  };
}
