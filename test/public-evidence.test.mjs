import test from 'node:test';
import assert from 'node:assert/strict';
import {publicEvidence,publicEvidenceSection} from '../public/public-evidence.js';
test('public evidence combines repeated recipients and ignores zero-value outputs',()=>{
 const result=publicEvidence([{requested:2016,recent:[{outputs:[{address:'a',sats:40},{address:'a',sats:50},{address:'b',sats:10},{address:'c',sats:0}]}]}]);
 assert.equal(result.examples[0].recipients,2);assert.equal(result.examples[0].largestShare,.9);
});
test('missing attribution and malformed payout values remain unknown',()=>{
 const d=[{requested:2016,blocks:null,recent:[{outputs:[]},{outputs:[{address:'a',sats:-1}]},{outputs:[{address:'a',sats:null}]}]}];
 assert.deepEqual(publicEvidence(d).examples,[]);assert.match(publicEvidenceSection(d),/not linked/);assert.match(publicEvidenceSection(d),/Missing data is not zero/);
});
test('public evidence selects wider window and never creates links from untrusted hashes',()=>{
 const d=[{requested:144,blocks:1},{requested:2016,blocks:5,recent:[{height:'<script>',hash:'javascript:alert(1)',outputs:[{address:'a',sats:1}]}]}];
 assert.equal(publicEvidence(d).blocks,5);const html=publicEvidenceSection(d);assert.ok(!html.includes('javascript:'));assert.ok(html.includes('&lt;script&gt;'));
});
