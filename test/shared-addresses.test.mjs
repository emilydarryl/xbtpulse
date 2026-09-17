import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedAddresses} from '../lib/shared-addresses.mjs';
const block=(height,label,tag,outputs)=>({height,time:height*60,hash:String(height).padStart(64,'0'),reportedPool:{slug:label.toLowerCase(),name:label},tag,outputs});
test('shared recipients preserve original labels and tags without merging and aggregate repeated outputs',()=>{
 const blocks=[block(3,'A','new',[{address:'x',sats:25},{address:'x',sats:25},{address:'y',sats:50}]),block(2,'A','old',[{address:'x',sats:100}]),block(1,'B','other',[{address:'x',sats:100}])];
 const before=JSON.stringify(blocks),d=sharedAddresses(blocks);
 assert.equal(d.total,1);assert.equal(d.rows[0].blocks,3);assert.equal(d.rows[0].groups.length,3);assert.equal(d.rows[0].soleRecipientBlocks,2);assert.equal(d.rows[0].groups.find(g=>g.tag==='new').minRewardShare,.5);assert.equal(d.rows[0].firstSeen,60);assert.equal(d.rows[0].lastSeen,180);assert.equal(JSON.stringify(blocks),before);
 assert.equal(sharedAddresses([blocks[0]]).total,0); // removed/reorganized history disappears
});
test('zero and missing outputs cannot create overlap; same label/tag is not a match',()=>{
 const d=sharedAddresses([block(3,'A','same',[{address:'x',sats:1}]),block(2,'A','same',[{address:'x',sats:2}]),block(1,'B','other',[{address:'x',sats:0}])]);
 assert.equal(d.total,0);assert.equal(d.recipientCoverage,2);
});
test('documented roles sort first, ordinary shared miner recipients remain unclassified, rows are bounded',()=>{
 const blocks=['A','B'].map((n,i)=>block(i+1,n,n,[{address:'miner',sats:99},{address:'fee',sats:1}]));
 const d=sharedAddresses(blocks,[{name:'Reviewed',addresses:[{address:'fee',role:'fee',source:'https://example.com/evidence'}]}],1);
 assert.equal(d.total,2);assert.equal(d.rows.length,1);assert.equal(d.rows[0].address,'fee');assert.equal(d.rows[0].documentedRoles[0].pool,'Reviewed');assert.equal(sharedAddresses(blocks).rows.find(r=>r.address==='miner').documentedRoles.length,0);
});
