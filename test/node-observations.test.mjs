import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../lib/store.mjs';
import { advertisedVersion, parseNodeObservations, createNodeObserver, NODE_POLL_MS, NODE_STALE_MS } from '../lib/node-observations.mjs';

const now = 1790000000000;
function fixture(time = now) {
  const t = Math.floor(time/1000);
  return {schema:'btcb2.nodes/1',generated_at_epoch:t,
    crawl:{started_at_epoch:t-400,finished_at_epoch:t-1,partial:false,exit_code:0,max_nodes:2000},
    raw_records:2000,handshake_ok:3,seed_health:{publishable:true},totals:{blake2b_reachable:2},
    nodes:[
      {address:'8.8.8.8',port:8333,network:'ipv4',services:268435457,last_seen_epoch:t-10,subver:'/Satoshi:29.4.1/Knots:20260508/'},
      {address:'2001:4860:4860::8888',port:8333,network:'ipv6',services:268435457,last_seen_epoch:t-8,subver:'/Satoshi:29.4.2(Example)/Knots:20260508rc2/'},
    ]};
}
test('node observations retain full release and RC versions, strip comments from grouping, and expose only aggregates', () => {
  const parsed=parseNodeObservations(fixture(),now);
  assert.equal(parsed.reachable,2);
  assert.equal(parsed.candidateLimitReached,true);
  assert.deepEqual(parsed.networks,{ipv4:1,ipv6:1,tor:0});
  assert.equal(advertisedVersion('/Satoshi:29.4.2(mempool.guide)/Knots:20260508/'),'Knots 29.4.2 / 20260508');
  assert.equal(parsed.versions[1].version,'Knots 29.4.2 / 20260508rc2');
  assert.equal(advertisedVersion('/Satoshi:29.4.1/'),'Other / unrecognized');
  const json=JSON.stringify(parsed);
  assert.ok(!json.includes('8.8.8.8') && !json.includes('2001:4860'));
});
test('node parser rejects wrong scope, duplicate endpoints, timestamps and inconsistent counts', () => {
  for (const mutate of [
    b=>b.schema='bitcoin.nodes/1', b=>b.nodes[0].services=1,
    b=>b.nodes[1]={...b.nodes[0]}, b=>b.totals.blake2b_reachable=50,
    b=>b.generated_at_epoch+=600, b=>b.nodes[0].last_seen_epoch-=500,
    b=>b.nodes[0].network='__proto__', b=>b.nodes[0].subver='bad\nagent',
    b=>b.nodes[0].port=0, b=>b.handshake_ok=0,
  ]) {const b=fixture();mutate(b);assert.throws(()=>parseNodeObservations(b,now));}
  const b=fixture();b.nodes[0].address='a'.repeat(56)+'.onion';b.nodes[0].network='tor';
  assert.equal(parseNodeObservations(b,now).networks.tor,1);
  b.seed_health.publishable=false;assert.equal(parseNodeObservations(b,now).partial,true);
});
test('background polling persists snapshots without visitor fetches; failures retain dated data and restart preserves history', async () => {
  const store=new Store(':memory:');let time=now,calls=0,fail=false;
  const observer=createNodeObserver(store,{clock:()=>time,fetcher:async()=>{
    calls++;if(fail) throw Error();return new Response(JSON.stringify(fixture(time)));
  }});
  assert.equal(observer.view().snapshot,null);assert.equal(calls,0);
  await Promise.all([observer.poll(),observer.poll()]);assert.equal(calls,1);
  assert.equal(observer.view().status,'current');const observed=observer.view().snapshot.observedAt;
  for(let i=0;i<5;i++) observer.view();assert.equal(calls,1);
  await observer.poll();assert.equal(calls,1);
  time+=NODE_POLL_MS;fail=true;await observer.poll();
  assert.equal(observer.view().status,'unavailable');assert.equal(observer.view().snapshot.observedAt,observed);
  assert.equal(observer.view().lastFetchedAt,now);
  time+=NODE_STALE_MS;assert.equal(observer.view().stale,true);
  fail=false;time+=86400000;await observer.poll();
  assert.equal(observer.view().history.length,2);
  const restarted=createNodeObserver(store,{clock:()=>time,fetcher:async()=>{throw Error();}});
  assert.deepEqual(restarted.view().history,observer.view().history);
  assert.equal(createNodeObserver(store,{enabled:false,clock:()=>time}).view().status,'disabled');
  store.db.close();
});
test('invalid, oversized and regressed feeds cannot replace a valid snapshot; unchanged stale feeds remain stale', async () => {
  const store=new Store(':memory:');let time=now,body=fixture(),oversize=false;
  const observer=createNodeObserver(store,{clock:()=>time,fetcher:async()=>new Response(oversize?'x'.repeat(2*1024*1024+1):JSON.stringify(body))});
  await observer.poll();const snapshot=observer.view().snapshot;
  time+=NODE_POLL_MS;body=fixture(now-1000);await observer.poll();assert.equal(observer.view().status,'unavailable');
  assert.deepEqual(observer.view().snapshot,snapshot);
  time+=NODE_POLL_MS;oversize=true;await observer.poll();assert.equal(observer.view().status,'unavailable');
  time+=NODE_POLL_MS;oversize=false;body=fixture();body.nodes[0].services=1;await observer.poll();assert.equal(observer.view().status,'unavailable');
  time+=NODE_STALE_MS;body=fixture();await observer.poll();assert.equal(observer.view().status,'stale');
  assert.equal(observer.view().history.length,1);store.db.close();
});
test('zero observations are distinct from no snapshot and partial scans remain labeled',async()=>{
  const store=new Store(':memory:');const body=fixture();body.nodes=[];body.totals.blake2b_reachable=0;body.crawl.partial=true;
  const observer=createNodeObserver(store,{clock:()=>now,fetcher:async()=>new Response(JSON.stringify(body))});
  await observer.poll();assert.equal(observer.view().snapshot.reachable,0);assert.equal(observer.view().status,'partial');store.db.close();
});
