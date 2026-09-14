import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceFreshness } from '../lib/evidence-freshness.mjs';
const now=Date.parse('2026-09-13T12:00:00Z');
test('evidence freshness separates unknown, current, expired and future review dates',()=>{
 const d=evidenceFreshness({attribution:{reviewedAt:'2026-09-13'},profile:{reviewedAt:'2026-08-01'}},now);
 assert.equal(d.attribution.status,'Within review period');assert.equal(d.profile.status,'Review due');assert.equal(d.assessment.status,'Not assessed');
 assert.equal(evidenceFreshness({attribution:{reviewedAt:'2027-01-01'}},now).attribution.status,'Not reviewed');
});
test('assessment freshness follows oldest evidence or observation end rather than publication',()=>{
 const d=evidenceFreshness({scorecard:{end:'2026-09-12',publishedAt:now,rows:[{checked:'2026-08-01'},{checked:'2026-09-12'}]}},now);
 assert.equal(d.assessment.status,'Review due');
});
test('linked providers distinguish missing, stale, inactive and zero-work reporting',()=>{
 const providers=[{name:'waiting',active:true},{name:'stale',active:true,lastReport:now-1800001},{name:'revoked',active:false,lastReport:now},{name:'empty',active:true,lastReport:now},{name:'live',active:true,lastReport:now,lastWorkReport:now}];
 assert.deepEqual(evidenceFreshness({providers},now).telemetry.map(p=>p.status),['Awaiting reports','Stale','Inactive','Reporting; no recent positive work','Reporting']);
});
