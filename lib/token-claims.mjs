import { randomBytes, createHash } from "node:crypto";
const hash = value => createHash("sha256").update(value).digest("hex");
export function initializeTokenClaims(store) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS token_claims(provider TEXT PRIMARY KEY,claim_hash TEXT NOT NULL,prior_hash TEXT NOT NULL,expires INTEGER NOT NULL);`);
}
export function createTokenClaim(store, provider, now = Date.now()) {
  const row = store.db.prepare("SELECT p.* FROM providers p JOIN applications a ON a.id=p.application WHERE p.id=? AND p.active=1 AND a.status='approved'").get(provider);
  if (!row) throw Error("An approved, active provider is required.");
  const secret = randomBytes(32).toString("hex"), expires = now + 86400000;
  store.db.prepare("INSERT OR REPLACE INTO token_claims VALUES (?,?,?,?)").run(provider, hash(secret), row.token_hash, expires);
  return { claimLink: "/token-claim#" + encodeURIComponent(provider) + ":" + secret, expires };
}
function claimRow(store, provider, secret, now) {
  if (typeof secret !== "string" || !/^[a-f0-9]{64}$/.test(secret)) return null;
  return store.db.prepare(`SELECT c.provider,c.expires FROM token_claims c
    JOIN providers p ON p.id=c.provider JOIN applications a ON a.id=p.application
    WHERE c.provider=? AND c.claim_hash=? AND c.expires>? AND p.active=1
    AND a.status='approved' AND p.token_hash=c.prior_hash`).get(provider, hash(secret), now);
}
export function inspectTokenClaim(store, provider, secret, now = Date.now()) {
  const row = claimRow(store, provider, secret, now);
  if (!row) throw Error("This link is invalid, expired, already used, or superseded. Ask XBT Pulse for a new claim link.");
  return { provider: row.provider, expires: row.expires };
}
export function redeemTokenClaim(store, provider, secret, now = Date.now()) {
  store.db.exec("BEGIN IMMEDIATE");
  try {
    inspectTokenClaim(store, provider, secret, now);
    const token = randomBytes(32).toString("hex");
    store.db.prepare("UPDATE providers SET token_hash=? WHERE id=?").run(hash(token), provider);
    store.db.prepare("DELETE FROM token_claims WHERE provider=?").run(provider);
    store.db.prepare("INSERT INTO admin_audit(time,action,target) VALUES (?,?,?)").run(now, "operator-claimed-token", provider);
    store.db.exec("COMMIT");
    return { provider, token };
  } catch (e) { store.db.exec("ROLLBACK"); throw e; }
}
