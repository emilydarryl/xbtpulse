import test from "node:test";
import assert from "node:assert/strict";
import { validateProfile, publishProfile } from "../lib/profiles.mjs";
import { Store } from "../lib/store.mjs";
test("profile validates costs and rejects executable or credential links", () => {
  assert.equal(validateProfile({ fee: "0" }).fee, "0");
  for (const fee of ["-1", "101", "free"])
    assert.throws(() => validateProfile({ fee }));
  for (const setup of [
    "javascript:alert(1)",
    "https://secret:password@example.com",
  ])
    assert.throws(() => validateProfile({ setup }));
});
test("publication requires consent, review and a known pool; private fields never publish", () => {
  const s = new Store(":memory:");
  try {
    s.addApplication({
      id: "a",
      profileConsent: true,
      profile: { fee: "0" },
      website: "https://example.com",
      contact: "private@example.com",
      notes: "private notes",
    });
    const ids = new Set(["explorer:test"]);
    assert.throws(() =>
      publishProfile(s, { application: "a", poolId: "explorer:test" }, ids),
    );
    assert.throws(() =>
      publishProfile(
        s,
        { application: "a", poolId: "wrong", reviewed: true },
        ids,
      ),
    );
    const result = publishProfile(
      s,
      { application: "a", poolId: "explorer:test", reviewed: true },
      ids,
    );
    assert.equal(result.fee, "0");
    assert.equal(JSON.stringify(result).includes("private"), false);
    assert.ok(result.reviewedAt);
  } finally {
    s.close();
  }
});
