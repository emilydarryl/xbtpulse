import test from "node:test";
import assert from "node:assert/strict";
import { validateTelemetry, summarizeTelemetry } from "../lib/analytics.mjs";
import { intervalMetrics } from "../lib/assessment-checks.mjs";
import { reviewEvidence } from "../lib/review.mjs";
import { Store } from "../lib/store.mjs";

test("work-only reports persist null, preserve work and cannot become zero outcomes", () => {
  const now = Date.now();
  const input = { id: "work", start: now - 60000, end: now,
    found: null, segments: [{ shareDifficultySum: 200, networkDifficulty: 100 }] };
  const report = { ...validateTelemetry(input, now), provider: "prime" };
  for (const found of [undefined, -1, "0", false, 1.5, 10001])
    assert.throws(() => validateTelemetry({ ...input, found }, now));
  const store = new Store(":memory:");
  try {
    store.addApplication({ id: "a", name: "Prime" });
    store.approveApplication("a", "prime", "a".repeat(64));
    store.addTelemetry(report);
    assert.equal(store.telemetry()[0].found, null);
    store.addTelemetry(report); // Identical retry remains valid.
    assert.throws(() => store.addTelemetry({ ...report, found: 0 }), /different/);
    const known = { ...report, id: "known", start: now - 120000, end: now - 60000, found: 1 };
    for (const records of [[report], [report, known], [known, report]]) {
      const p = summarizeTelemetry(records, now).providers[0];
      assert.equal(p.found, null);
      assert.equal(p.work, records.length * 200);
      assert.equal(p.expected, records.length * 2);
      assert.equal(p.workShare, 1);
      assert.equal(intervalMetrics(records, now - 120000, now).found, null);
    }
    assert.equal(summarizeTelemetry([{ ...report, found: 0 }], now).providers[0].found, 0);
    assert.equal(summarizeTelemetry([known], now).providers[0].found, 1);
    const outcomes = reviewEvidence(store, { id: "a" }, now).checks.find(c => c.label.includes("block outcomes"));
    assert.match(outcomes.detail, /unavailable/);
    assert.doesNotMatch(outcomes.detail, /0 reported found/);
  } finally { store.close(); }
});
