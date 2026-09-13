import test from "node:test";
import assert from "node:assert/strict";
import {
  summarize,
  attribute,
  wilson,
  validateTelemetry,
  summarizeTelemetry,
} from "../lib/analytics.mjs";
import { Store } from "../lib/store.mjs";
import { Collector, validateChain } from "../lib/collector.mjs";
import { forkHeight } from "../lib/source.mjs";
const block = (height, extra = {}) => ({
  height,
  hash: height.toString(16).padStart(64, "0"),
  previousHash: (height - 1).toString(16).padStart(64, "0"),
  time: 1789300000 + height,
  difficulty: 100,
  tag: "",
  outputs: [],
  ...extra,
});
test("unknown blocks stay in the denominator; multiple outputs count once per recipient per block", () => {
  const d = summarize([
    block(3, {
      reportedPool: { slug: "alpha", name: "Alpha" },
      outputs: [
        { address: "a", sats: 100 },
        { address: "a", sats: 200 },
        { address: "b", sats: 50 },
      ],
    }),
    block(2),
  ]);
  assert.equal(d.pools.find((p) => p.name === "Alpha").share, 0.5);
  assert.equal(d.pools.find((p) => p.unknown).share, 0.5);
  assert.equal(d.addresses.find((a) => a.address === "a").blocks, 1);
  assert.equal(d.addresses.find((a) => a.address === "a").sats, 300);
  assert.equal(d.addresses.find((a) => a.address === "a").amount, 0.000003);
});
test("miner recipients never imply pool ownership; conflicting evidence is unknown", () => {
  const b = block(3, {
    tag: "Alpha Beta",
    outputs: [{ address: "recipient", sats: 50 }],
  });
  assert.equal(
    attribute(b, [
      {
        id: "a",
        name: "Alpha",
        addresses: [
          { address: "recipient", role: "miner", source: "verified" },
        ],
      },
    ]).unknown,
    true,
  );
  assert.equal(
    attribute(b, [
      { id: "a", name: "Alpha", tags: ["Alpha"] },
      { id: "b", name: "Beta", tags: ["Beta"] },
    ]).evidence,
    "Conflicting evidence",
  );
});
test("Wilson interval includes uncertainty at zero and full observed share", () => {
  assert.ok(wilson(0, 100)[1] > 0.03);
  assert.ok(wilson(100, 100)[0] < 0.97);
  assert.deepEqual(wilson(0, 0), [0, 1]);
});
test("expected blocks use the network difficulty for each segment", () => {
  const now = Date.now(),
    r = validateTelemetry(
      {
        id: "one",
        start: now - 120000,
        end: now - 60000,
        found: 1,
        segments: [
          { shareDifficultySum: 1000, networkDifficulty: 100 },
          { shareDifficultySum: 1000, networkDifficulty: 200 },
        ],
      },
      now,
    );
  assert.equal(r.expected, 15);
  assert.equal(r.work, 2000);
  assert.throws(() =>
    validateTelemetry(
      { id: "bad", start: now, end: now - 1, found: 0, segments: [] },
      now,
    ),
  );
  assert.throws(() =>
    validateTelemetry(
      {
        id: "bad",
        start: now - 10,
        end: now,
        found: 0,
        segments: [{ shareDifficultySum: 100, networkDifficulty: 0 }],
      },
      now,
    ),
  );
  assert.equal(
    summarizeTelemetry(
      [
        { ...r, provider: "a" },
        { ...r, provider: "b", work: 6000 },
      ],
      now,
    ).providers[0].workShare,
    0.25,
  );
});
test("telemetry retries are idempotent and overlapping reports cannot inflate work", () => {
  const s = new Store(":memory:"),
    now = Date.now(),
    r = {
      provider: "a",
      id: "one",
      start: now - 100000,
      end: now - 50000,
      work: 100,
      expected: 1,
      found: 0,
    };
  try {
    assert.equal(s.addTelemetry(r), true);
    assert.equal(s.addTelemetry(r), false);
    assert.throws(() => s.addTelemetry({ ...r, id: "two" }), /overlap/);
    assert.throws(() => s.addTelemetry({ ...r, found: 1 }), /different/);
    assert.equal(s.telemetry().length, 1);
  } finally {
    s.close();
  }
});
test("collector backfills, advances and rebuilds after a canonical mismatch", async () => {
  const s = new Store(":memory:");
  let tip = forkHeight + 5,
    alternate = false;
  const make = (h) =>
    block(h, alternate && h === forkHeight + 6 ? { hash: "f".repeat(64) } : {});
  const source = {
    name: "fixture",
    verify: async () => {},
    tip: async () => tip,
    hash: async (h) => make(h).hash,
    range: async (high, low) =>
      Array.from({ length: high - low + 1 }, (_, i) => make(high - i)),
  };
  const c = new Collector(s, source, { batch: 3, retention: 6 });
  try {
    await c.poll();
    assert.equal(s.blocks().length, 3);
    await c.poll();
    assert.equal(s.blocks().length, 6);
    tip++;
    await c.poll();
    assert.equal(s.blocks()[0].height, tip);
    assert.equal(s.blocks().length, 6);
    alternate = true;
    await c.poll();
    assert.equal(s.blocks()[0].hash, "f".repeat(64));
    assert.equal(s.events().length, 1);
    assert.equal(s.get("lastError"), null);
  } finally {
    s.close();
  }
});
test("inconsistent source windows never enter canonical accounting", () => {
  assert.throws(() => validateChain([block(3), block(1)]), /Non-contiguous/);
});
