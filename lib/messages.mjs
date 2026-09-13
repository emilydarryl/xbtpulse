import { randomBytes, createHash } from "node:crypto";
const digest = (s) => createHash("sha256").update(s).digest("hex");
export function initializeMessages(store) {
  store.db
    .exec(`CREATE TABLE IF NOT EXISTS conversations(application TEXT PRIMARY KEY,token_hash TEXT NOT NULL,admin_read INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,application TEXT NOT NULL,role TEXT NOT NULL,body TEXT NOT NULL,time INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS message_application ON messages(application,time);`);
}
function exists(store, id) {
  if (!store.db.prepare("SELECT id FROM applications WHERE id=?").get(id))
    throw Error("Application not found");
}
export function conversationLink(
  store,
  id,
  token = randomBytes(32).toString("hex"),
) {
  exists(store, id);
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error("Invalid conversation token");
  store.db
    .prepare(
      "INSERT INTO conversations(application,token_hash) VALUES (?,?) ON CONFLICT(application) DO UPDATE SET token_hash=excluded.token_hash",
    )
    .run(id, digest(token));
  return "/conversation#" + id + ":" + token;
}
export function authorizeConversation(store, id, token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return false;
  return !!store.db
    .prepare(
      "SELECT c.application FROM conversations c JOIN applications a ON a.id=c.application WHERE c.application=? AND c.token_hash=?",
    )
    .get(id, digest(token));
}
export function conversation(store, id) {
  exists(store, id);
  const app = store.db
    .prepare("SELECT status,body FROM applications WHERE id=?")
    .get(id);
  return {
    name: JSON.parse(app.body).name,
    status: app.status,
    messages: store.db
      .prepare(
        "SELECT id,role,body,time FROM messages WHERE application=? ORDER BY time,id",
      )
      .all(id),
  };
}
export function addMessage(store, app, role, id, body, now = Date.now()) {
  exists(store, app);
  if (
    !["admin", "operator"].includes(role) ||
    typeof id !== "string" ||
    !/^[a-f0-9-]{36}$/.test(id) ||
    typeof body !== "string" ||
    !body.trim() ||
    body.length > 4000
  )
    throw Error("Enter a message of 1–4000 characters.");
  const previous = store.db
    .prepare("SELECT * FROM messages WHERE id=?")
    .get(id);
  if (previous) {
    if (
      previous.application === app &&
      previous.role === role &&
      previous.body === body.trim()
    )
      return;
    throw Error("Message reference already used");
  }
  if (
    store.db
      .prepare("SELECT COUNT(*) AS n FROM messages WHERE application=?")
      .get(app).n >= 200
  )
    throw Error("Conversation limit reached; contact the administrator.");
  if (
    role === "operator" &&
    store.db
      .prepare(
        "SELECT COUNT(*) AS n FROM messages WHERE application=? AND role='operator' AND time>?",
      )
      .get(app, now - 3600000).n >= 10
  )
    throw Error("Please wait before sending more messages (10 per hour).");
  store.db
    .prepare("INSERT INTO messages VALUES (?,?,?,?,?)")
    .run(id, app, role, body.trim(), now);
}
export function unreadMessages(store, id) {
  return store.db
    .prepare(
      "SELECT COUNT(*) AS n FROM messages WHERE application=? AND role='operator' AND time>COALESCE((SELECT admin_read FROM conversations WHERE application=?),0)",
    )
    .get(id, id).n;
}
