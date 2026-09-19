const sources = [
  {id:"neoxex", name:"NeoxEX", quote:"USDC", pair:"BTCB2_USDC", url:"https://neoxa.exchange/api/exchange/ticker/BTCB2_USDC"},
  {id:"nonkyc", name:"NonKYC", quote:"USDT", pair:"BTCB2_USDT", url:"https://api.nonkyc.io/api/v2/ticker/BTCB2_USDT"},
];
export function parseMarket(id, body) {
  const source = sources.find(s => s.id === id);
  if (!source) throw Error("Unknown source");
  const neox = id === "neoxex";
  if (neox ? body.success !== true || body.pair !== source.pair : body.ticker_id !== source.pair || body.base_currency !== "BTCB2" || body.target_currency !== source.quote) throw Error("Market mismatch");
  const ticker = neox ? body.ticker : body;
  const rawPrice = neox ? ticker?.lastPrice : ticker?.last_price;
  const rawChange = neox ? ticker?.changePercent : ticker?.change_percent;
  const price = Number(rawPrice), change = Number(rawChange);
  if (rawPrice == null || !Number.isFinite(price) || price <= 0) throw Error("Invalid price");
  return {price, change: rawChange == null || rawChange === "" || !Number.isFinite(change) ? null : change,
    sourceTime: neox && Number.isFinite(ticker.computedAt) ? ticker.computedAt : null};
}
export function createMarketPrices(fetcher = fetch, clock = Date.now) {
  let cache = null, pending = null, checked = 0;
  return async function prices() {
    if (cache && clock() - checked < 60000) return cache;
    if (pending) return pending;
    pending = (async () => {
      const rows = await Promise.all(sources.map(async source => {
        const previous = cache?.rows.find(r => r.id === source.id);
        try {
          const response = await fetcher(source.url, {signal:AbortSignal.timeout(8000), redirect:"error", headers:{Accept:"application/json"}});
          if (!response.ok) throw Error("Source unavailable");
          let text = "";
          for await (const part of response.body) {
            if (text.length + part.length > 32768) throw Error("Response too large");
            text += new TextDecoder().decode(part);
          }
          const parsed = parseMarket(source.id, JSON.parse(text));
          const fetchedAt = clock();
          const stale = parsed.sourceTime != null && (fetchedAt - parsed.sourceTime > 300000 || parsed.sourceTime > fetchedAt + 60000);
          return {...source, ...parsed, fetchedAt, stale, unavailable:false};
        } catch {
          return {...source, price:previous?.price ?? null, change:previous?.change ?? null, sourceTime:previous?.sourceTime ?? null, fetchedAt:previous?.fetchedAt ?? null, stale:true, unavailable:true};
        }
      }));
      checked = clock();
      cache = {asset:"Bitcoin BLAKE2b (XBT / BTCB2)", rows};
      return cache;
    })();
    try { return await pending; } finally { pending = null; }
  };
}
