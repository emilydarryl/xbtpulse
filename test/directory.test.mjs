import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../lib/store.mjs";
import { poolDirectory, directorySearchText } from "../lib/directory.mjs";

test("directory search matches accented and decomposed names without merging identities", () => {
  const rows = [
    { id: "listing:a", name: "Crypto-Eire" },
    { id: "listing:b", name: "Crypto-Éire" },
    { id: "listing:c", name: "Unrelated" },
  ];
  for (const query of ["Crypto-Éire", "CRYPTO-EIRE", "Crypto-E\u0301ire", "Éire"])
    assert.deepEqual(rows.filter(p => directorySearchText(p.name).includes(directorySearchText(query))).map(p => p.id), ["listing:a", "listing:b"]);
  assert.equal(rows[1].name, "Crypto-Éire");
});
test("directory includes older small pools, excludes unknown, and counts latest window separately", () => {
  const s = new Store(":memory:");
  try {
    s.saveBlocks(
      Array.from({ length: 145 }, (_, i) => ({
        height: 200 - i,
        hash: String(i).padStart(64, "0"),
        time: 1000 - i,
        tag: "",
        outputs: [],
        reportedPool: {
          name: i === 144 ? "Tiny" : "Large",
          slug: i === 144 ? "tiny" : "large",
        },
      })),
      30000,
    );
    const rows = poolDirectory(s, []);
    assert.equal(rows.length, 2);
    const tiny = rows.find((r) => r.name === "Tiny");
    assert.equal(tiny.retainedBlocks, 1);
    assert.equal(tiny.recentBlocks, 0);
    assert.equal(tiny.lastObserved, 856000);
  } finally {
    s.close();
  }
});
test("directory merges explicit profiles and omits nonconsenting and pending operator listings", () => {
  const s = new Store(":memory:");
  try {
    for (const [id, consent] of [
      ["visible", true],
      ["hidden", false],
      ["pending", true],
    ])
      s.addApplication({
        id,
        name: id,
        profileConsent: consent,
        listingConsent: consent,
        contact: "secret",
        profile: { poolType: "private" },
      });
    s.approveApplication("visible", "visible", "a".repeat(64));
    s.approveApplication("hidden", "hidden", "b".repeat(64));
    s.set("pool-profile:private:visible", {
      name: "visible",
      applicationId: "visible",
      poolType: "private",
    });
    const rows = poolDirectory(s, []);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].poolType, "private");
    assert.equal(rows[0].lastObserved, null);
    assert.match(rows[0].participation, /Approved/);
    assert.ok(!JSON.stringify(rows).includes("secret"));
  } finally {
    s.close();
  }
});
