import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,summarizeTags} from '../lib/analytics.mjs';
test('tag distribution uses full window, preserves exact text and includes missing tags',()=>{
 const blocks=Array.from({length:144},(_,i)=>({height:i,hash:String(i),time:i,tag:i<100?'Same':i<143?' Same ':'',outputs:[],reportedPool:{slug:'one',name:'One'}}));
 const d=summarize(blocks,[]);
 assert.equal(d.blocks.length,24);assert.equal(d.pools.length,1);
 assert.deepEqual(d.tags.map(t=>t.blocks),[100,43,1]);
 assert.equal(d.tags[1].tag,' Same ');assert.equal(d.tags[2].unknown,true);
 assert.equal(d.tags.reduce((n,t)=>n+t.blocks,0),144);
 assert.ok(Math.abs(d.tags.reduce((n,t)=>n+t.share,0)-1)<1e-12);
 assert.deepEqual(summarizeTags([]),[]);
});
