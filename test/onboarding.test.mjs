import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Store } from "../lib/store.mjs";
import { validateApplication } from "../lib/onboarding.mjs";
const application = () => ({
  id: randomUUID(),
  name: "Test Operator",
  contact: "operator@example.test",
  website: "https://example.test",
  software: "RATUM test",
  role: "own-templates",
  notes: "",
  consent: true,
});
test("operator details are validated and credential URLs rejected", () => {
  assert.equal(validateApplication(application()).name, "Test Operator");
  assert.throws(() =>
    validateApplication({ ...application(), consent: false }),
  );
  assert.throws(() =>
    validateApplication({
      ...application(),
      website: "https://user:secret@example.test",
    }),
  );
  assert.throws(() => validateApplication({ ...application(), fax: "bot" }));
  assert.throws(() =>
    validateApplication({ ...application(), role: "made-up" }),
  );
});
test("pending applications cannot authenticate; approval and revocation gate telemetry", () => {
  const s = new Store(":memory:"),
    a = validateApplication(application()),
    hash = createHash("sha256").update("test-token").digest("hex");
  try {
    assert.equal(s.addApplication(a), true);
    assert.equal(s.addApplication(a), false);
    assert.equal(s.applications().length, 1);
    assert.equal(s.providerForHash(hash), null);
    s.approveApplication(a.id, "test-operator", hash);
    assert.equal(s.providerForHash(hash), "test-operator");
    assert.throws(() => s.approveApplication(a.id, "second", hash));
    assert.equal(s.applications()[0].status, "approved");
    s.revokeProvider("test-operator");
    assert.equal(s.providerForHash(hash), null);
    assert.equal(
      JSON.stringify(s.telemetry()).includes("operator@example.test"),
      false,
    );
  } finally {
    s.close();
  }
});
test("intake rate limits persist and rejected requests do not consume an application slot", () => {
  const s = new Store(":memory:"),
    now = Date.now();
  try {
    for (let i = 0; i < 30; i++)
      s.addApplication(validateApplication(application()), now);
    assert.throws(
      () => s.addApplication(validateApplication(application()), now),
      /busy/,
    );
    assert.equal(s.applications().length, 30);
    const id = s.applications()[0].id;
    s.rejectApplication(id);
    assert.equal(s.applications().length, 29);
    assert.equal(
      s.addApplication(validateApplication(application()), now + 3600000),
      true,
    );
  } finally {
    s.close();
  }
});
