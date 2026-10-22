import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../lib/store.mjs';
import {initializeMarketplace,validateListing,submitListing,marketListings,marketQueue,manageListing,moderateListing,pruneMarketplace} from '../lib/marketplace.mjs';
const token='ab'.repeat(32),now=1792660000000;
const offer=()=>({id:randomUUID(),title:'A useful mining tool',description:'A real item with a clearly described condition and delivery cost.',seller:'Example seller',contact:'seller@example.test',category:'mining',price:'0.00000001',region:'Ireland',delivery:'shipping',consent:true});
function setup(t){const s=new Store(':memory:');initializeMarketplace(s);t.after(()=>s.close());return s;}
test('listing validation preserves exact XBT prices and rejects unsafe links and missing consent',()=>{
 assert.equal(validateListing(offer()).price,'0.00000001');
 assert.equal(validateListing({...offer(),contact:'HTTPS://example.test/contact'}).contact,'https://example.test/contact');
 for(const patch of [{price:'0'},{price:'-1'},{price:'1e8'},{price:'0.000000001'},{contact:'javascript:alert(1)'},{contact:'https://u:p@example.test'},{consent:false},{fax:'spam'},{category:'tokens'}])assert.throws(()=>validateListing({...offer(),...patch}));
});
test('pending listings stay private; reviewed offers publish then seller can close only their own',t=>{
 const s=setup(t),o=offer();submitListing(s,o,token,now);assert.equal(marketListings(s,now).length,0);
 assert.throws(()=>manageListing(s,o.id,'cc'.repeat(32),null,now));
 assert.equal(manageListing(s,o.id,token,null,now).status,'pending');
 moderateListing(s,o.id,'publish',now);const rows=marketListings(s,now);assert.equal(rows.length,1);assert.ok(!JSON.stringify(rows).includes('token_hash'));assert.ok(!JSON.stringify(marketQueue(s)).includes(token));
 manageListing(s,o.id,token,'sold',now);assert.equal(marketListings(s,now).length,0);assert.throws(()=>moderateListing(s,o.id,'publish',now));
});
test('safe retries do not duplicate listings; expired and moderator-removed offers cannot reappear',t=>{
 const s=setup(t),o=offer();submitListing(s,o,token,now);submitListing(s,o,token,now);assert.equal(marketQueue(s).length,1);
 assert.throws(()=>submitListing(s,{...o,price:'2'},token,now));assert.throws(()=>submitListing(s,o,'cc'.repeat(32),now));
 moderateListing(s,o.id,'publish',now);assert.equal(marketListings(s,now+31*86400000).length,0);
 moderateListing(s,o.id,'remove',now);assert.throws(()=>manageListing(s,o.id,token,'sold',now));
 pruneMarketplace(s,now+91*86400000);assert.equal(marketQueue(s).length,0);
});
test('intake is bounded and old pending offers cannot be published',t=>{
 const s=setup(t),o=offer();submitListing(s,o,token,now);
 assert.throws(()=>moderateListing(s,o.id,'publish',now+31*86400000));
 for(let i=1;i<30;i++)submitListing(s,offer(),token,now);
 assert.throws(()=>submitListing(s,offer(),token,now));
});
