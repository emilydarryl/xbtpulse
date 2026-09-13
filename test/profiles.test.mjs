import test from "node:test";
import assert from "node:assert/strict";
import {
  validateProfile,
  publishProfile,
  privateProfiles,
} from "../lib/profiles.mjs";
import { Store } from "../lib/store.mjs";
test("private pools can publish without blocks, omit connection and fee fields, and expose only directory identity", () => {
  const s = new Store(":memory:");
  try {
    assert.throws(() => validateProfile({ poolType: "invented" }));
    s.addApplication({
      id: "private-app",
      name: "Test private pool",
      contact: "secret@example.test",
      notes: "private notes",
      profileConsent: true,
      profile: {
        poolType: "private",
        fee: "1",
        setup: "https://example.test/internal",
        ethos: "We run our own node.",
      },
    });
    const profile = publishProfile(
      s,
      { application: "private-app", poolId: "private:test", reviewed: true },
      new Set(),
    );
    assert.equal(profile.poolType, "private");
    assert.equal(profile.fee, "");
    assert.equal(profile.setup, "");
    assert.equal(profile.ethos, "We run our own node.");
    assert.deepEqual(privateProfiles(s), [
      { id: "private:test", name: "Test private pool" },
    ]);
    assert.equal(profile.rating, undefined);
    assert.throws(() =>
      publishProfile(
        s,
        {
          application: "private-app",
          poolId: "explorer:invented",
          reviewed: true,
        },
        new Set(),
      ),
    );
  } finally {
    s.close();
  }
});
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
