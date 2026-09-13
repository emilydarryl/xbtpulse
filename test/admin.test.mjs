import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../lib/store.mjs";

test('scorecard endpoints require login, origin and CSRF before mutations', async t => {
  const {store,call}=fixture(t);
  assert.equal((await call('scorecard?application=missing')).status,401);
  assert.equal((await call('publish-scorecard',{})).status,401);
  assert.equal((await call('assessment-checks',{})).status,401);
  const code=bootstrap(store);
  await call('setup',{code,password:'test-scorecard-password-long'});
  assert.equal((await call('save-scorecard',{}, {'x-csrf-token':''})).status,403);
  assert.equal((await call('assessment-checks',{}, {'x-csrf-token':''})).status,403);
  assert.equal((await call('assessment-checks',{}, {origin:'https://evil.test'})).status,403);
  assert.equal((await call('publish-scorecard',{}, {origin:'https://evil.test'})).status,403);
});
import {
  initializeAdmin,
  bootstrap,
  adminRoute,
  digest,
} from "../lib/admin.mjs";

function fixture(t) {
  const store = new Store(":memory:");
  initializeAdmin(store);
  t.after(() => store.close());
  let cookie = "",
    csrf = "";
  async function call(path, body, headers = {}) {
    const result = { headers: {} };
    await adminRoute({
      store,
      req: {
        method: body ? "POST" : "GET",
        headers: {
          origin: "https://xbtpulse.tech",
          "content-type": "application/json",
          cookie,
          "x-csrf-token": csrf,
          ...headers,
        },
      },
      res: {
        setHeader(k, v) {
          result.headers[k] = v;
        },
      },
      url: new URL("https://xbtpulse.tech/api/admin/" + path),
      send(_res, status, data) {
        result.status = status;
        result.data = data;
      },
      jsonBody: async () => body,
      cache: new Map(),
      origin: "https://xbtpulse.tech",
    });
    if (result.headers["Set-Cookie"])
      cookie = result.headers["Set-Cookie"].split(";")[0];
    if (result.data.csrf) csrf = result.data.csrf;
    return result;
  }
  return { store, call };
}
test("admin setup, login, origin, CSRF and session controls protect private data", async (t) => {
  const { store, call } = fixture(t),
    password = "test-only-long-password";
  assert.equal((await call("applications")).status, 401);
  const code = bootstrap(store);
  assert.equal(
    (await call("setup", { code, password }, { origin: "https://evil.test" }))
      .status,
    403,
  );
  assert.equal((await call("setup", { code: "wrong", password })).status, 403);
  const setup = await call("setup", { code, password });
  assert.equal(setup.status, 200);
  assert.match(
    setup.headers["Set-Cookie"],
    /HttpOnly; Secure; SameSite=Strict/,
  );
  assert.equal(store.get("admin-bootstrap"), null);
  assert.notEqual(store.get("admin-password"), password);
  assert.equal((await call("setup", { code, password })).status, 403);
  assert.equal(
    (await call("logout", {}, { "x-csrf-token": "wrong" })).status,
    403,
  );
  assert.equal((await call("applications")).status, 200);
  await call("logout", {});
  assert.equal((await call("applications")).status, 401);
  assert.equal(
    (await call("login", { password: "incorrect-password" })).status,
    401,
  );
  assert.equal((await call("login", { password })).status, 200);
  store.db.exec("UPDATE admin_sessions SET expires=0");
  assert.equal((await call("applications")).status, 401);
});
test("reviewed approval issues tokens once and rotation/revocation invalidate old tokens", async (t) => {
  const { store, call } = fixture(t);
  await call("setup", {
    code: bootstrap(store),
    password: "test-only-long-password",
  });
  store.addApplication({
    id: "test-application",
    name: "Test",
    contact: "private@example.test",
  });
  assert.equal(
    (
      await call("approve", {
        application: "test-application",
        provider: "test",
      })
    ).status,
    400,
  );
  const approval = await call("approve", {
    application: "test-application",
    provider: "test",
    reviewed: true,
  });
  assert.equal(approval.status, 201);
  assert.equal(store.providerForHash(digest(approval.data.token)), "test");
  const listing = await call("applications");
  assert.equal(JSON.stringify(listing.data).includes("token_hash"), false);
  assert.equal(
    JSON.stringify(listing.data).includes(approval.data.token),
    false,
  );
  const rotated = await call("rotate", { provider: "test" });
  assert.equal(store.providerForHash(digest(approval.data.token)), null);
  assert.equal(store.providerForHash(digest(rotated.data.token)), "test");
  await call("revoke", { provider: "test" });
  assert.equal(store.providerForHash(digest(rotated.data.token)), null);
});
test("expired bootstrap and excessive login attempts fail closed", async (t) => {
  const { store, call } = fixture(t),
    code = bootstrap(store);
  store.set("admin-bootstrap", { hash: digest(code), expires: 0 });
  assert.equal(
    (await call("setup", { code, password: "test-only-long-password" })).status,
    403,
  );
  store.set("admin-login-limit", {
    bucket: Math.floor(Date.now() / 900000),
    count: 20,
  });
  assert.equal(
    (await call("login", { password: "test-only-long-password" })).status,
    429,
  );
});
