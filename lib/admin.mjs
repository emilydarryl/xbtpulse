import {
  initializeMessages,
  conversationLink,
  conversation,
  addMessage,
  unreadMessages,
} from "./messages.mjs";
import { reviewEvidence, issueChallenge } from "./review.mjs";
import { publishProfile } from "./profiles.mjs";
import { initializeTokenClaims, createTokenClaim } from "./token-claims.mjs";
import { runAssessmentChecks } from "./assessment-checks.mjs";
import {
  getScorecard,
  saveScorecard,
  publishScorecard,
} from "./scorecards.mjs";
import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function passwordHash(password) {
  if (
    typeof password !== "string" ||
    password.length < 14 ||
    password.length > 256
  )
    throw new Error("Use a password between 14 and 256 characters.");
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await derive(password, salt, 64)).toString("hex");
}
export async function passwordMatches(password, encoded) {
  if (typeof password !== "string" || password.length > 256 || !encoded)
    return false;
  const [salt, hash] = encoded.split(":");
  const candidate = await derive(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}
export function initializeAdmin(store) {
  initializeTokenClaims(store);
  initializeMessages(store);
  store.db
    .exec(`CREATE TABLE IF NOT EXISTS admin_sessions(hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_audit(id INTEGER PRIMARY KEY,time INTEGER NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL);`);
}
export function bootstrap(store) {
  if (store.get("admin-password"))
    throw new Error(
      "Admin is already configured. Use admin-reset through SSH to reset access.",
    );
  const code = randomBytes(32).toString("hex");
  store.set("admin-bootstrap", {
    hash: digest(code),
    expires: Date.now() + 30 * 60000,
  });
  return code;
}
export function adminSession(store, req) {
  const token = (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("__Host-xbt_admin="))
    ?.slice("__Host-xbt_admin=".length);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    store.db
      .prepare(
        "SELECT hash,csrf,expires FROM admin_sessions WHERE hash=? AND expires>?",
      )
      .get(digest(token), Date.now()) || null
  );
}
export function newSession(store, res) {
  const token = randomBytes(32).toString("hex"),
    csrf = randomBytes(32).toString("hex");
  store.db
    .prepare("DELETE FROM admin_sessions WHERE expires<=?")
    .run(Date.now());
  store.db
    .prepare("INSERT INTO admin_sessions VALUES (?,?,?)")
    .run(digest(token), csrf, Date.now() + 8 * 3600000);
  res.setHeader(
    "Set-Cookie",
    `__Host-xbt_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
  );
  return csrf;
}
export function audit(store, action, target = "") {
  store.db
    .prepare("INSERT INTO admin_audit(time,action,target) VALUES (?,?,?)")
    .run(Date.now(), action, target);
}
export async function adminRoute({
  req,
  res,
  url,
  store,
  send,
  jsonBody,
  cache,
  origin,
  knownPoolIds = new Set(),
}) {
  const session = adminSession(store, req);
  if (req.method === "GET" && url.pathname === "/api/admin/session") {
    send(res, 200, {
      authenticated: !!session,
      configured: !!store.get("admin-password"),
      csrf: session?.csrf,
    });
    return;
  }
  if (req.method === "POST") {
    if (req.headers.origin !== origin) {
      send(res, 403, { error: "Request origin not allowed" });
      return;
    }
    if (!req.headers["content-type"]?.startsWith("application/json")) {
      send(res, 415, { error: "Use application/json" });
      return;
    }
  }
  if (
    ["/api/admin/login", "/api/admin/setup"].includes(url.pathname) &&
    req.method === "POST"
  ) {
    const now = Date.now(),
      bucket = Math.floor(now / (15 * 60000));
    const limits = store.get("admin-login-limit");
    const count = limits?.bucket === bucket ? limits.count : 0;
    if (count >= 20) {
      send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
      return;
    }
    store.set("admin-login-limit", { bucket, count: count + 1 });
    const body = await jsonBody(req);
    if (url.pathname.endsWith("/setup")) {
      const initial = store.get("admin-bootstrap");
      if (
        store.get("admin-password") ||
        !initial ||
        initial.expires < now ||
        typeof body.code !== "string" ||
        digest(body.code) !== initial.hash
      ) {
        send(res, 403, {
          error: "Setup code is invalid, expired, or already used.",
        });
        return;
      }
      const encoded = await passwordHash(body.password);
      // Recheck after async hashing: only one concurrent setup may claim access.
      if (
        store.get("admin-password") ||
        store.get("admin-bootstrap")?.hash !== initial.hash ||
        initial.expires < Date.now()
      ) {
        send(res, 409, { error: "Setup already completed or replaced." });
        return;
      }
      store.set("admin-password", encoded);
      store.set("admin-bootstrap", null);
      audit(store, "setup");
    } else {
      if (
        !(await passwordMatches(body.password, store.get("admin-password")))
      ) {
        send(res, 401, { error: "Invalid login." });
        return;
      }
      audit(store, "login");
    }
    store.set("admin-login-limit", { bucket, count: 0 });
    send(res, 200, { csrf: newSession(store, res) });
    return;
  }
  if (!session) {
    send(res, 401, { error: "Admin login required" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/admin/tag-search") {
    res.setHeader("Cache-Control", "no-store");
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2 || q.length > 100) {
      return send(res, 400, { error: "Enter 2–100 characters of coinbase text." });
    }
    const blocks = store.blocks(-1);
    const matches = blocks.filter(b => String(b.tag || "").toLowerCase().includes(q.toLowerCase()));
    const pages = Math.max(1, Math.ceil(matches.length / 25));
    const page = Math.min(pages, Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1)));
    return send(res, 200, {
      q, page, pages, total: matches.length, searched: blocks.length,
      newest: blocks[0]?.height ?? null, oldest: blocks.at(-1)?.height ?? null,
      collectedAt: store.get("lastSuccess"),
      blocks: matches.slice((page - 1) * 25, page * 25).map(b => ({
        height: b.height, hash: b.hash, time: b.time, tag: b.tag,
        pool: b.reportedPool?.name || "Unknown",
      })),
    });
  }
  if (req.method === "GET" && url.pathname === "/api/admin/applications") {
    const providers = store.db
      .prepare("SELECT id,application,active FROM providers ORDER BY id")
      .all();
    send(res, 200, {
      applications: store.applications().map((a) => ({
        ...a,
        review: reviewEvidence(store, a),
        unread: unreadMessages(store, a.id),
      })),
      providers,
      audit: store.db
        .prepare(
          "SELECT time,action,target FROM admin_audit ORDER BY id DESC LIMIT 30",
        )
        .all(),
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/admin/scorecard") {
    send(res, 200, getScorecard(store, url.searchParams.get("application")));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/admin/conversation") {
    const id = url.searchParams.get("application");
    const result = conversation(store, id);
    store.db
      .prepare("UPDATE conversations SET admin_read=? WHERE application=?")
      .run(Date.now(), id);
    send(res, 200, result);
    return;
  }
  if (req.method !== "POST") {
    send(res, 404, { error: "Not found" });
    return;
  }
  if (req.headers["x-csrf-token"] !== session.csrf) {
    send(res, 403, { error: "Refresh the page before making changes." });
    return;
  }
  const body = await jsonBody(req);
  if (url.pathname === "/api/admin/assessment-checks") {
    const result = await runAssessmentChecks(store, body);
    audit(store, "assessment-checks", body.application);
    send(res, 200, result);
    return;
  }
  if (url.pathname === "/api/admin/save-scorecard") {
    const card = saveScorecard(
      store,
      body.application,
      body.card,
      body.version,
    );
    audit(store, "save-scorecard", body.application);
    send(res, 200, card);
    return;
  }
  if (url.pathname === "/api/admin/publish-scorecard") {
    const card = publishScorecard(store, body);
    audit(store, "publish-scorecard", body.poolId);
    cache.clear();
    send(res, 200, card);
    return;
  }
  if (url.pathname === "/api/admin/conversation-link") {
    const link = conversationLink(store, body.application);
    audit(store, "conversation-link", body.application);
    send(res, 200, { link });
    return;
  }
  if (url.pathname === "/api/admin/message") {
    addMessage(store, body.application, "admin", body.id, body.message);
    audit(store, "message", body.application);
    send(res, 200, { ok: true });
    return;
  }
  if (url.pathname === "/api/admin/logout") {
    store.db
      .prepare("DELETE FROM admin_sessions WHERE hash=?")
      .run(session.hash);
    res.setHeader(
      "Set-Cookie",
      "__Host-xbt_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
    );
    send(res, 200, { ok: true });
    return;
  }
  if (url.pathname === "/api/admin/review-challenge") {
    const challenge = issueChallenge(store, String(body.provider));
    audit(store, "review-challenge", String(body.provider));
    send(res, 200, challenge);
    return;
  }
  if (url.pathname === "/api/admin/publish-profile") {
    publishProfile(store, body, knownPoolIds);
    audit(store, "publish-profile", body.poolId);
    cache.clear();
    send(res, 200, { ok: true });
    return;
  }
  if (url.pathname === "/api/admin/approve") {
    if (body.reviewed !== true) {
      send(res, 400, {
        error: "Confirm that you reviewed the operator first.",
      });
      return;
    }
    const token = randomBytes(32).toString("hex");
    store.approveApplication(body.application, body.provider, digest(token));
    audit(store, "approve", body.provider);
    cache.clear();
    send(res, 201, { provider: body.provider, token });
    return;
  }
  if (url.pathname === "/api/admin/reject") {
    // Keep a review trail. Decline in the browser is reversible.
    store.db
      .prepare(
        "UPDATE applications SET status='declined' WHERE id=? AND status='pending'",
      )
      .run(String(body.application));
    audit(store, "decline", String(body.application));
    send(res, 200, { ok: true });
    return;
  }
  if (url.pathname === "/api/admin/reopen") {
    store.db
      .prepare(
        "UPDATE applications SET status='pending' WHERE id=? AND status='declined'",
      )
      .run(String(body.application));
    audit(store, "reopen", String(body.application));
    send(res, 200, { ok: true });
    return;
  }
  if (url.pathname === "/api/admin/revoke") {
    store.revokeProvider(String(body.provider));
    audit(store, "revoke", String(body.provider));
    cache.clear();
    send(res, 200, { ok: true });
    return;
  }
  if (url.pathname === "/api/admin/rotate") {
    const token = randomBytes(32).toString("hex");
    const updated = store.db
      .prepare("UPDATE providers SET token_hash=?,active=1 WHERE id=?")
      .run(digest(token), String(body.provider));
    if (!updated.changes) {
      send(res, 404, { error: "Provider not found" });
      return;
    }
    audit(store, "rotate", String(body.provider));
    cache.clear();
    send(res, 200, { provider: body.provider, token });
    return;
  }
  if (url.pathname === "/api/admin/token-claim") {
    const result = createTokenClaim(store, String(body.provider));
    audit(store, "create-token-claim", String(body.provider));
    send(res, 201, result);
    return;
  }
  send(res, 404, { error: "Not found" });
}
