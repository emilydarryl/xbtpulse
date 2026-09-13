import test from "node:test";
import assert from "node:assert/strict";
import { participation, poolRating } from "../lib/ratings.mjs";
import { summarizeTelemetry } from '../lib/analytics.mjs';
test('empty fresh reports do not keep recognition alive after work stops',()=>{
  const now=Date.now();
  const providers=summarizeTelemetry([
    {provider:'gateway',start:now-3700000,end:now-3600000,work:100,expected:1,found:0},
    {provider:'gateway',start:now-2000,end:now-1000,work:0,expected:0,found:0}
  ],now).providers;
  assert.equal(participation(providers[0],new Set(['gateway']),now),false);
});
test("participation needs active approval, fresh nonzero work, and no future report", () => {
  const now = Date.now(),
    p = { name: "gateway", work: 100, lastReport: now - 1000 },
    active = new Set(["gateway"]);
  assert.equal(participation(p, active, now), true);
  assert.equal(participation({ ...p, work: 0 }, active, now), false);
  assert.equal(
    participation({ ...p, lastReport: now - 1800001 }, active, now),
    false,
  );
  assert.equal(
    participation({ ...p, lastReport: now + 1 }, active, now),
    false,
  );
  assert.equal(participation(p, new Set(), now), false);
});
test("pool recognition requires explicit mapping and never generates scores or verified tiers", () => {
  const pool = { id: "explorer:pool", unknown: false },
    c = new Set(["gateway"]);
  assert.equal(poolRating(pool, [], c).status, "Not assessed");
  const registry = [{ id: pool.id, providerIds: ["gateway"] }];
  const rating = poolRating(pool, registry, c);
  assert.equal(rating.status, "Telemetry Contributor");
  assert.equal(rating.decentralizationScore, null);
  assert.equal(rating.transparencyScore, null);
  assert.equal(
    poolRating({ ...pool, unknown: true }, registry, c).status,
    "Not assessed",
  );
  assert.equal(poolRating(pool, registry, new Set()).status, "Not assessed");
});
