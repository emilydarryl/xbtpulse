import test from "node:test";
import assert from "node:assert/strict";
import {parseMarket, createMarketPrices} from "../lib/market-prices.mjs";
const neox = {success:true,pair:"BTCB2_USDC",ticker:{lastPrice:296,changePercent:-2,computedAt:1000000}};
const nonkyc = {ticker_id:"BTCB2_USDT",base_currency:"BTCB2",target_currency:"USDT",last_price:"298.6",change_percent:"-9.02"};
test("market adapters require BLAKE2b pairs and preserve quote units and absent timestamps", () => {
  assert.equal(parseMarket("neoxex",neox).price,296);
  assert.equal(parseMarket("nonkyc",nonkyc).sourceTime,null);
  assert.throws(()=>parseMarket("nonkyc",{...nonkyc,base_currency:"BTC"}));
  assert.throws(()=>parseMarket("neoxex",{...neox,pair:"BTC_USDC"}));
  assert.throws(()=>parseMarket("nonkyc",{...nonkyc,last_price:"NaN"}));
});
test("price cache coalesces requests and failed refresh retains stale quote without new fetch time", async () => {
  let now=1000000, calls=0, fail=false;
  const get=createMarketPrices(async url=>{ calls++; if(fail) throw Error(); return new Response(JSON.stringify(url.includes("neoxa")?neox:nonkyc)); },()=>now);
  const [first,second]=await Promise.all([get(),get()]);
  assert.equal(calls,2); assert.deepEqual(first,second);
  assert.equal(first.rows[0].stale,false); assert.equal(first.rows[1].quote,"USDT");
  await get(); assert.equal(calls,2);
  now+=61000; fail=true;
  const stale=await get(); assert.equal(stale.rows[0].stale,true);
  assert.equal(stale.rows[0].price,296); assert.equal(stale.rows[0].fetchedAt,1000000);
});
