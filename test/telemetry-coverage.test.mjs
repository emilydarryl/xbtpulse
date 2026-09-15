import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeTelemetry} from '../lib/analytics.mjs';
import {coverageLabel,outcomeLabel} from '../public/telemetry-context.js';

test('reporting coverage uses the union of intervals per provider and preserves unknown outcomes', () => {
  const now=200000000, day=86400000;
  const row=(provider,start,end,found=null)=>({provider,start,end,found,work:10,expected:0.1});
  const result=summarizeTelemetry([
    row('a',now-120000,now-60000),
    row('a',now-90000,now-30000),
    row('a',now-15000,now,0),
    row('b',now-day,now-day+60000,0),
    row('a',now-day-1,now-day+60000), // boundary intervals are not prorated
    row('a',now,now+1),
  ],now);
  const [a,b]=result.providers;
  assert.equal(a.coveredMs,105000);
  assert.equal(a.coverage,105000/day);
  assert.equal(a.reportCount,3);
  assert.equal(a.found,null);
  assert.equal(a.windowStart,now-day);
  assert.equal(a.windowEnd,now);
  assert.equal(b.coveredMs,60000);
  assert.equal(b.stale,true);
  assert.match(outcomeLabel(a),/unavailable/);
  assert.match(outcomeLabel(b),/outcomes reported/);
  assert.equal(coverageLabel({}),'Coverage not available');
});

test('a full day of interval reports covers 100 percent; no reports remain absent', () => {
  const now=200000000;
  const records=Array.from({length:96},(_,i)=>({provider:'a',start:now-86400000+i*900000,end:now-86400000+(i+1)*900000,found:0,work:0,expected:0}));
  const p=summarizeTelemetry(records,now).providers[0];
  assert.equal(p.coverage,1);
  assert.equal(p.lastWorkReport,0);
  assert.equal(p.found,0);
  assert.deepEqual(summarizeTelemetry([],now).providers,[]);
});
