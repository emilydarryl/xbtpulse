import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Store } from "../lib/store.mjs";
import {
  initializeMessages,
  conversationLink,
  authorizeConversation,
  conversation,
  addMessage,
  unreadMessages,
} from "../lib/messages.mjs";
function fixture(t) {
  const s = new Store(":memory:");
  t.after(() => s.close());
  initializeMessages(s);
  s.addApplication({
    id: "a",
    name: "Example",
    contact: "private",
    notes: "internal",
  });
  s.addApplication({ id: "b", name: "Other" });
  return s;
}
test("private links are hashed, isolated and revoked when replaced", (t) => {
  const s = fixture(t),
    token = "a".repeat(64);
  conversationLink(s, "a", token);
  assert.equal(authorizeConversation(s, "a", token), true);
  assert.equal(authorizeConversation(s, "b", token), false);
  assert.notEqual(
    s.db.prepare("SELECT token_hash FROM conversations").get().token_hash,
    token,
  );
  conversationLink(s, "a", "b".repeat(64));
  assert.equal(authorizeConversation(s, "a", token), false);
  assert.equal(JSON.stringify(conversation(s, "a")).includes("private"), false);
  s.rejectApplication("a");
  assert.equal(authorizeConversation(s, "a", "b".repeat(64)), false);
});
test("messages are idempotent, private and counted unread until read", (t) => {
  const s = fixture(t),
    id = randomUUID();
  conversationLink(s, "a");
  addMessage(s, "a", "operator", id, "Hello", 100);
  addMessage(s, "a", "operator", id, "Hello", 100);
  assert.equal(conversation(s, "a").messages.length, 1);
  assert.equal(conversation(s, "b").messages.length, 0);
  assert.equal(unreadMessages(s, "a"), 1);
  s.db
    .prepare("UPDATE conversations SET admin_read=100 WHERE application=?")
    .run("a");
  assert.equal(unreadMessages(s, "a"), 0);
  assert.throws(() => addMessage(s, "b", "operator", id, "Hello"));
  assert.throws(() => addMessage(s, "a", "operator", randomUUID(), " "));
});
test("operator rate and message size limits prevent unbounded intake", (t) => {
  const s = fixture(t);
  for (let i = 0; i < 10; i++)
    addMessage(s, "a", "operator", randomUUID(), "Hi", 1000 + i);
  assert.throws(
    () => addMessage(s, "a", "operator", randomUUID(), "More", 1020),
    /wait/,
  );
  assert.throws(() =>
    addMessage(s, "a", "admin", randomUUID(), "x".repeat(4001)),
  );
  addMessage(s, "a", "admin", randomUUID(), "Reply", 1020);
  assert.equal(conversation(s, "a").messages.length, 11);
});
