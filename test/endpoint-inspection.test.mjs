import test from 'node:test';
import assert from 'node:assert/strict';
import {coinbaseOutputs,inspectJob,compareEndpoints} from '../lib/endpoint-inspection.mjs';
const tx='01000000'+'01'+'00'.repeat(32)+'ffffffff'+'02'+'0101'+'ffffffff'+'01'+'0100000000000000'+'01'+'51'+'00000000';
test('only complete coinbase transactions expose payout scripts',()=>{
  assert.deepEqual(coinbaseOutputs(tx),[{sats:'1',script:'51'}]);
  assert.throws(()=>coinbaseOutputs(tx.slice(0,-2)));
  assert.throws(()=>coinbaseOutputs(tx+'00'));
  assert.throws(()=>coinbaseOutputs(tx.replace('ffffffff','00000000')));
  const p=['job','00'.repeat(32),tx,'',[],'00','00','00'.repeat(4),true];
  assert.equal(inspectJob(p,{extra1:'',extra2Size:0}).format,'serialized-coinbase');
  assert.equal(inspectJob(p,{}).format,'unparsed');
});
test('BLAKE2b short commitments never become payout identities',()=>{
  for(const size of [35,39]){
    const r=inspectJob(['1','00'.repeat(32),'00'.repeat(size),'',[],'','', '00'.repeat(8),true],{extra1:'00',extra2Size:4});
    assert.equal(r.format,'blake2b-commitment');assert.equal(r.payoutScripts,undefined);
  }
  assert.equal(inspectJob([]).format,'unsupported');
});
test('shared chain parents and commitment digests are not proxy evidence',()=>{
  const job={jobDigest:'same',previousField:'same'};
  assert.deepEqual(compareEndpoints([{id:'a',runs:[{round:1,jobs:[job]}]},{id:'b',runs:[{round:1,jobs:[job]}]}]),[]);
  const rows=[{id:'a',runs:[{round:1,jobs:[{payoutScripts:['51']}]}]},{id:'b',runs:[{round:2,jobs:[{payoutScripts:['51']}]}]}];
  assert.deepEqual(compareEndpoints(rows),[]);
  rows[1].runs[0].round=1;assert.equal(compareEndpoints(rows).length,1);
});
