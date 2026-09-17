import test from 'node:test';import assert from 'node:assert/strict';
import {shareChanges,profileChanges} from '../lib/change-summary.mjs';
import {Store} from '../lib/store.mjs';
import {initializePoolHistory,recordPoolHistory} from '../lib/pool-history.mjs';
test('share summary requires consecutive complete days and sufficient samples',()=>{
 const day=(start,share)=>({start,end:start+86400000,complete:true,blocks:150,pools:[{id:'a',name:'A',share}]});const a=day(0,.1),b=day(86400000,.2);
 assert.equal(shareChanges([a,b]).length,1);assert.equal(shareChanges([a,{...b,complete:false}]).length,0);assert.equal(shareChanges([a,{...b,blocks:10}]).length,0);assert.equal(shareChanges([a,day(172800000,.3)]).length,0);
});
test('profile summary excludes baselines, freshness-only changes and withdrawn private records',()=>{
 const s=new Store(':memory:');try{initializePoolHistory(s);const research={a:{name:'A'}};recordPoolHistory(s,'a',{fee:'1',telemetry:[]},{},1000);assert.equal(profileChanges(s,research,[],1000).length,0);recordPoolHistory(s,'a',{fee:'2',telemetry:[]},{},2000);assert.equal(profileChanges(s,research,[],2000)[0].changes[0].before,'1');assert.equal(profileChanges(s,{},[],2000).length,0);}finally{s.close();}
});
