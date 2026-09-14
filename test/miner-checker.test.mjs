import test from 'node:test';
import assert from 'node:assert/strict';
import {explainSetup} from '../public/miner-checker-model.js';
test('connection selection cannot promote claims to verified control or route fees',()=>{const p={id:'example',profile:{fee:'3 hosted / 1 own gateway',template:'Own templates'}};const h=explainSetup(p,'hosted'),g=explainSetup(p,'gateway');assert.notDeepEqual(h.path,g.path);assert.equal(g.fee,h.fee);assert.equal(g.templateClaim,'Own templates');assert.match(g.template,/does not establish/);assert.match(g.upstream,/No reviewed/);assert.throws(()=>explainSetup(p,'solo'));});
test('private setup and missing evidence stay explicit',()=>{const p=explainSetup({id:'explorer:soveroot',profile:{poolType:'private',fee:'3'}},'gateway');assert.equal(p.private,true);assert.match(p.fee,/Not applicable/);assert.match(p.upstream,/September 13, 2026/);assert.match(p.templateClaim,/No published/);assert.equal(p.reviewedAt,null);});
