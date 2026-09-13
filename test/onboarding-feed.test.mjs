import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Store } from "../lib/store.mjs";
import { onboardingFeed } from "../lib/onboarding-feed.mjs";

test("public onboarding respects consent and excludes private application fields", () => {
  const s = new Store(":memory:");
  try {
    const add = (extra = {}) => {
      const a = {
        id: randomUUID(),
        name: "Example",
        contact: "secret-contact",
        notes: "secret-notes",
        profile: { poolType: "private", fee: "35" },
        ...extra,
      };
      s.addApplication(a);
      return a;
    };
    add();
    const legacy = add({ profileConsent: true });
    assert.deepEqual(onboardingFeed(s), []);
    s.approveApplication(legacy.id, "legacy", "a".repeat(64));
    const pending = add({ listingConsent: true });
    const rows = onboardingFeed(s);
    assert.equal(rows.length, 2);
    assert.ok(rows.some((r) => r.status === "Submitted · awaiting review"));
    assert.ok(
      rows.some(
        (r) => r.status === "Approved for telemetry · awaiting reports",
      ),
    );
    assert.equal(JSON.stringify(rows).includes("secret"), false);
    assert.equal(JSON.stringify(rows).includes("35"), false);
    assert.equal(JSON.stringify(rows).includes(legacy.id), false);
    s.rejectApplication(pending.id);
    assert.equal(onboardingFeed(s).length, 1);
  } finally {
    s.close();
  }
});

test("approval is distinct from recent positive telemetry and revocation removes contributor status", () => {
  const s = new Store(":memory:"),
    now = Date.now();
  try {
    const a = {
      id: randomUUID(),
      name: "Private example",
      profileConsent: true,
      profile: { poolType: "private" },
    };
    s.addApplication(a, now);
    s.approveApplication(a.id, "example", "b".repeat(64));
    s.set("pool-profile:private:example", { applicationId: a.id });
    s.addTelemetry({
      provider: "example",
      id: randomUUID(),
      start: now - 60000,
      end: now,
      work: 100,
      expected: 0.1,
      found: 0,
    });
    let row = onboardingFeed(s, now)[0];
    assert.equal(row.status, "Telemetry Contributor");
    assert.equal(row.ratingStatus, "Not assessed");
    assert.equal(row.profileUrl, "/pool?id=private%3Aexample");
    assert.equal(
      onboardingFeed(s, now + 31 * 60000)[0].status,
      "Reporting paused",
    );
    s.revokeProvider("example");
    assert.equal(onboardingFeed(s, now)[0].status, "Reporting access inactive");
  } finally {
    s.close();
  }
});
