import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../lib/store.mjs";
import {
  issueChallenge,
  answerChallenge,
  reviewEvidence,
} from "../lib/review.mjs";
const now = Date.now();
function fixture(t) {
  const s = new Store(":memory:");
  t.after(() => s.close());
  s.addApplication({ id: "a", name: "Test" });
  s.approveApplication("a", "test", "a".repeat(64));
  return s;
}
test("challenge requires correct active credential, expires and cannot be replayed", (t) => {
  const s = fixture(t),
    c = issueChallenge(s, "test", now);
  assert.throws(() => answerChallenge(s, "test", "x".repeat(48), now));
  assert.throws(() => answerChallenge(s, "test", c.code, c.expires));
  assert.deepEqual(answerChallenge(s, "test", c.code, now), { verified: true });
  assert.throws(() => answerChallenge(s, "test", c.code, now));
  const c2 = issueChallenge(s, "test", now);
  s.db.prepare("UPDATE providers SET token_hash=?").run("b".repeat(64));
  assert.throws(() => answerChallenge(s, "test", c2.code, now));
  assert.equal(
    reviewEvidence(s, { id: "a" }, now).checks.find((c) =>
      c.label.includes("challenge"),
    ).status,
    "Missing evidence",
  );
});
test("readiness needs approval, proof, coverage and fresh positive work without auto-rating", (t) => {
  const s = fixture(t);
  assert.equal(
    reviewEvidence(s, { id: "absent" }, now).status,
    "Needs evidence",
  );
  const c = issueChallenge(s, "test", now);
  answerChallenge(s, "test", c.code, now);
  for (let i = 0; i < 96; i++)
    s.addTelemetry({
      provider: "test",
      id: String(i),
      start: now - 86400000 + i * 900000,
      end: now - 86400000 + (i + 1) * 900000,
      work: 100,
      expected: 1,
      found: 0,
    });
  const r = reviewEvidence(s, { id: "a" }, now);
  assert.equal(r.status, "Ready for review");
  assert.equal(r.rating, undefined);
  assert.ok(r.manual.length);
  assert.equal(
    reviewEvidence(s, { id: "a" }, now + 1800001).status,
    "Needs evidence",
  );
  s.revokeProvider("test");
  assert.equal(reviewEvidence(s, { id: "a" }, now).status, "Needs evidence");
});
test("empty work and sparse reports cannot satisfy readiness", (t) => {
  const s = fixture(t),
    c = issueChallenge(s, "test", now);
  answerChallenge(s, "test", c.code, now);
  s.addTelemetry({
    provider: "test",
    id: "1",
    start: now - 900000,
    end: now,
    work: 0,
    expected: 0,
    found: 0,
  });
  const r = reviewEvidence(s, { id: "a" }, now);
  assert.equal(r.status, "Needs evidence");
  assert.equal(
    r.checks.find((c) => c.label.includes("recent work")).status,
    "Missing evidence",
  );
  assert.equal(
    r.checks.find((c) => c.label.includes("coverage")).status,
    "Missing evidence",
  );
});
