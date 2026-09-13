import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../lib/store.mjs";
import {
  intervalMetrics,
  runAssessmentChecks,
} from "../lib/assessment-checks.mjs";
import { publicIPv4, sourceURL } from "../lib/public-source.mjs";
test("public-source requests reject private destinations and credential-bearing URLs", () => {
  for (const ip of [
    "127.0.0.1",
    "10.2.3.4",
    "172.16.1.1",
    "192.168.1.140",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "198.18.0.1",
  ])
    assert.equal(publicIPv4(ip), false);
  assert.equal(publicIPv4("8.8.8.8"), true);
  for (const url of [
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com:8080",
    "https://example.com/?token=secret",
    "https://[::1]/",
  ])
    assert.throws(() => sourceURL(url));
});
test("coverage unions intervals without double counting and distinguishes uncovered ranges", () => {
  const r = (start, end) => ({ start, end, work: 1, found: 0, expected: 1 });
  const m = intervalMetrics([r(10, 30), r(20, 40), r(60, 80)], 0, 100);
  assert.equal(m.coverage, 50);
  assert.equal(m.overlap, true);
  assert.equal(m.gaps, 3);
});
test("assessment checks keep drafts untouched, retain sources, and compare repeated checks", async () => {
  const s = new Store(":memory:"),
    now = Date.now(),
    date = new Date(now).toISOString().slice(0, 10);
  try {
    s.addApplication({
      id: "a",
      name: "Example",
      website: "https://example.com",
    });
    s.approveApplication("a", "one", "a".repeat(64));
    const original = { sentinel: "existing review" };
    s.set("score-draft:a", original);
    let hash = "first";
    const fetch = async (url) => ({
      url,
      hash,
      snippets: ["Fee 1% claimed by site"],
      status: "Retrieved",
    });
    const one = await runAssessmentChecks(
      s,
      { application: "a", start: date, end: date },
      now,
      fetch,
    );
    assert.deepEqual(s.get("score-draft:a"), original);
    assert.equal(one.suggestions[0].candidatePercent, null);
    assert.equal(one.historyComplete, false);
    assert.equal(one.sources[0].hash, "first");
    assert.match(one.followup, /No SSH access/);
    hash = "second";
    const two = await runAssessmentChecks(
      s,
      { application: "a", start: date, end: date },
      now + 61000,
      fetch,
    );
    assert.ok(two.differences.some((x) => x.includes("page content changed")));
    assert.equal(s.get("score-published:a"), null);
  } finally {
    s.close();
  }
});
test("only one consistent provider with retained scope can receive conditional coverage suggestion", async () => {
  const s = new Store(":memory:"),
    now = Date.parse("2026-09-13T12:00:00Z"),
    start = Date.parse("2026-09-13");
  try {
    s.addApplication({ id: "a", name: "Example" });
    s.approveApplication("a", "one", "a".repeat(64));
    s.set("assessment-history-start", start);
    const r = {
      provider: "one",
      id: "r",
      start,
      end: now,
      work: 10,
      expected: 1,
      found: 0,
    };
    s.db
      .prepare("INSERT INTO telemetry VALUES (?,?,?,?,?)")
      .run("one", "r", start, now, JSON.stringify(r));
    const result = await runAssessmentChecks(
      s,
      { application: "a", start: "2026-09-13", end: "2026-09-13" },
      now,
    );
    assert.equal(result.suggestions[0].candidatePercent, 100);
    assert.equal(
      result.suggestions.filter((x) => x.candidatePercent !== null).length,
      1,
    );
  } finally {
    s.close();
  }
});
