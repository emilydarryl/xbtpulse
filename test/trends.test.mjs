import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../lib/store.mjs";
import {
  networkTrends,
  initializeChanges,
  captureChanges,
  changeFeed,
} from "../lib/trends.mjs";
test("time windows keep unknown blocks and distinguish partial history from zero share", () => {
  const now = Date.now(),
    day = 86400000;
  const b = (time, pool) => ({
    time: time / 1000,
    tag: "",
    outputs: [],
    reportedPool: pool,
  });
  const result = networkTrends(
    [
      b(now - 2 * day),
      b(now - 1000, { slug: "one", name: "One" }),
      b(now - 2000),
      b(now + 1000),
    ],
    [],
    now,
  );
  assert.equal(result.windows[0].blocks, 2);
  assert.equal(result.windows[0].complete, true);
  assert.equal(result.windows[1].complete, false);
  assert.equal(result.windows[0].pools.find((p) => p.unknown).share, 0.5);
  assert.equal(result.daily.length, 30);
  assert.equal(result.daily[0].blocks, 0);
});
test("change tracking is persistent, deduplicated, consent filtered and does not expose private fields", () => {
  const s = new Store(":memory:");
  try {
    initializeChanges(s);
    const now = Date.now();
    s.addApplication(
      { id: "a", name: "Visible", listingConsent: true, contact: "secret" },
      now,
    );
    s.addApplication({ id: "b", name: "Hidden", contact: "private" }, now);
    captureChanges(s, now);
    captureChanges(s, now + 1);
    assert.equal(changeFeed(s, now).length, 1);
    assert.equal(changeFeed(s, now)[0].previous, null);
    s.approveApplication("a", "visible", "a".repeat(64));
    captureChanges(s, now + 2);
    const feed = changeFeed(s, now);
    assert.equal(feed.length, 2);
    assert.match(feed[0].status, /Approved/);
    assert.ok(!JSON.stringify(feed).includes("secret"));
    assert.ok(!JSON.stringify(feed).includes("Hidden"));
    s.db
      .prepare("UPDATE applications SET body=? WHERE id=?")
      .run(JSON.stringify({ name: "Visible", listingConsent: false }), "a");
    assert.deepEqual(changeFeed(s, now), []);
  } finally {
    s.close();
  }
});
