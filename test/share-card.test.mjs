import test from 'node:test';
import assert from 'node:assert/strict';
import {cardSnapshot} from '../public/share-card.js';
const pool=(id)=>({id,name:id,share:null,blocks:null,sample:144,status:'fresh',updatedAt:'2026-09-13T12:00:00Z',profile:{poolType:'private',fee:'3',payout:'test',reviewedAt:'2026-09-13'},freshness:{profile:{status:'Within review period'}}});
test('share cards preserve missing scores, private terms and dated snapshots',()=>{
 const pools=[pool('one'),pool('two')];const card=cardSnapshot(pools,144,'2026-09-13T13:00:00Z');
 const row=label=>card.rows.find(r=>r.label===label).values;
 assert.deepEqual(row('Decentralization'),['Not assessed','Not assessed']);
 assert.deepEqual(row('Fees (%) · sourced terms'),['N/A — private pool','N/A — private pool']);
 assert.equal(row('Observed block share')[0],'Not available');
 assert.match(row('Terms review & provenance')[0],/2026-09-13 UTC/);
 pools[0].name='changed';pools[0].profile.fee='9';
 assert.equal(card.names[0],'one');assert.equal(new URL(card.url).searchParams.getAll('pool').length,2);
});
test('share cards flag differing sources and reject incomplete comparisons',()=>{
 const pools=[pool('one'),pool('two')];pools[1].sample=130;
 assert.match(cardSnapshot(pools,576).warning,/differ/);
 assert.throws(()=>cardSnapshot([pools[0]],144));
 assert.throws(()=>cardSnapshot(pools,12));
 pools[1].unavailable=true;assert.throws(()=>cardSnapshot(pools,144));
});
