import test from "node:test";
import assert from "node:assert/strict";
import {parseXorMetrics, createPoolMetrics} from "../lib/pool-metrics.mjs";
const sample = {name:"Bitcoin Xor",stratum:"stratum.xorpool.com:23334",pool_ths:500,network_ths:25000,height:973034,updated:1000};
test("pool metrics keep endpoint scope, units, timestamp and missing values explicit", () => {
  const parsed = parseXorMetrics(sample,1000000);
  assert.equal(parsed.reportedHashrate,5e14);
  assert.equal(parsed.reportedNetworkShare,.02);
  assert.equal(parsed.metricsStale,false);
  assert.match(parsed.metricsScope,/excludes separate DATUM/);
  assert.equal(parseXorMetrics(sample,1400000).metricsStale,true);
  assert.throws(()=>parseXorMetrics({...sample,pool_ths:null}));
  assert.throws(()=>parseXorMetrics({...sample,stratum:"other:123"}));
  assert.equal(parseXorMetrics({...sample,pool_ths:0},1000000).reportedHashrate,0);
});
test("pool metrics share a cached request and retain stale results on failure", async () => {
  let now=1000000,calls=0,fail=false;
  const get=createPoolMetrics(async()=>{calls++;if(fail)throw Error();return new Response(JSON.stringify(sample));},()=>now);
  const [a,b]=await Promise.all([get(),get()]);
  assert.equal(calls,1);assert.deepEqual(a,b);
  await get();assert.equal(calls,1);
  now+=61000;fail=true;
  const stale=await get();
  assert.equal(stale.metricsStale,true);assert.equal(stale.metricsUnavailable,true);
  assert.equal(stale.metricsFetchedAt,1000000);assert.equal(stale.reportedHashrate,5e14);
});
