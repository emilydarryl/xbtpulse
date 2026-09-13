import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../lib/store.mjs";
import {
  criteria,
  validateScorecard,
  scoreTotals,
  saveScorecard,
  publishScorecard,
  publicScorecard,
} from "../lib/scorecards.mjs";
const now = Date.parse("2026-09-13T12:00:00Z");
const card = () => ({
  reviewer: "Test reviewer",
  scope: "Synthetic test coverage and complete documented scope.",
  reason: "Initial synthetic assessment for test only.",
  start: "2026-08-14",
  end: "2026-09-13",
  rows: criteria.map((c) => ({
    id: c.id,
    percent: 100,
    evidence: "Synthetic reviewed evidence with a reproducible calculation.",
    checked: "2026-09-13",
  })),
});
test("scorecard weights total 100 per axis; missing criteria do not rescale", () => {
  const c = validateScorecard(card(), now);
  assert.deepEqual(scoreTotals(c), {
    decentralization: 100,
    transparency: 100,
  });
  c.rows[0].percent = null;
  assert.equal(scoreTotals(c).decentralization, null);
  assert.equal(scoreTotals(c).transparency, 100);
  assert.throws(() =>
    validateScorecard(
      { ...card(), rows: card().rows.map((r) => ({ ...r, percent: 101 })) },
      now,
    ),
  );
  assert.throws(() =>
    validateScorecard(
      { ...card(), rows: card().rows.map((r) => ({ ...r, evidence: "" })) },
      now,
    ),
  );
});
test("publication requires current preview, consent, profile ownership, complete recent evidence and history", () => {
  const s = new Store(":memory:");
  try {
    s.addApplication({ id: "one", name: "Example", profileConsent: true });
    s.approveApplication("one", "one", "a".repeat(64));
    s.set("pool-profile:private:one", {
      applicationId: "one",
      name: "Example",
    });
    const c = card();
    c.rows[0].percent = null;
    saveScorecard(s, "one", c, 0, now);
    assert.equal(publicScorecard(s, "private:one"), null);
    const body = {
      application: "one",
      poolId: "private:one",
      version: 1,
      reviewed: true,
    };
    assert.throws(() => publishScorecard(s, body, now));
    assert.throws(() => saveScorecard(s, "one", card(), 0, now));
    saveScorecard(s, "one", card(), 1, now);
    assert.throws(() => publishScorecard(s, body, now));
    body.version = 2;
    assert.throws(() =>
      publishScorecard(s, { ...body, poolId: "private:other" }, now),
    );
    assert.throws(() => publishScorecard(s, { ...body, reviewed: false }, now));
    const published = publishScorecard(s, body, now);
    assert.equal(published.totals.decentralization, 100);
    publishScorecard(s, body, now);
    assert.equal(s.get("score-history:one").length, 1);
    assert.equal(publicScorecard(s, "private:one").totals.transparency, 100);
    saveScorecard(
      s,
      "one",
      { ...card(), reason: "Revised evidence after review." },
      2,
      now + 1,
    );
    assert.equal(publicScorecard(s, "private:one").reason, card().reason);
    s.db
      .prepare("UPDATE applications SET body=? WHERE id=?")
      .run(JSON.stringify({ profileConsent: false }), "one");
    assert.equal(publicScorecard(s, "private:one"), null);
  } finally {
    s.close();
  }
});
test("short observations and stale evidence cannot be published", () => {
  const s = new Store(":memory:");
  try {
    s.addApplication({ id: "one", name: "Example", profileConsent: true });
    s.approveApplication("one", "one", "a".repeat(64));
    s.set("pool-profile:one", { applicationId: "one" });
    saveScorecard(s, "one", { ...card(), start: "2026-09-12" }, 0, now);
    assert.throws(
      () =>
        publishScorecard(
          s,
          { application: "one", poolId: "one", version: 1, reviewed: true },
          now,
        ),
      /30 calendar/,
    );
  } finally {
    s.close();
  }
});
