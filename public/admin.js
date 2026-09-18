const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let csrf = "",
  configured = true,
  records = [],
  providers = [],
  action = null;
async function api(path, body) {
  const response = await fetch("/api/admin/" + path, {
    method: body ? "POST" : "GET",
    headers: body
      ? { "Content-Type": "application/json", "X-CSRF-Token": csrf }
      : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== "login") await session();
    throw Error(result.error || "Request failed");
  }
  return result;
}
async function session() {
  const s = await api("session");
  csrf = s.csrf || "";
  configured = s.configured;
  $("#login-panel").hidden = s.authenticated;
  $("#desk").hidden = !s.authenticated;
  $("#logout").hidden = !s.authenticated;
  $("#setup-label").hidden = configured;
  $("#setup-help").hidden = configured;
  $("#login-title").textContent = configured
    ? "Admin login"
    : "Set up your admin account";
  $("#login-form").elements.code.required = !configured;
  $("#login-form").elements.password.autocomplete = configured
    ? "current-password"
    : "new-password";
  if (s.authenticated) await refresh();
  else {
    ++tagSearchSequence;
    $("#tag-search-results").innerHTML = "";
    $("#tag-search-status").textContent = "";
    records = [];
    providers = [];
    $("#applications").innerHTML = "";
    $("#providers").innerHTML = "";
    $("#audit").innerHTML = "";
  }
}
function reviewCard(review) {
  if (!review) return "";
  return `<section><h3>Automated checks · ${esc(review.status)}</h3><p class="small muted">Checked ${esc(new Date(review.checkedAt).toLocaleString())}. Readiness is for human review, not a rating.</p>${review.checks.map((c) => `<p><strong>${esc(c.label)} — ${esc(c.status)}</strong><br>${esc(c.detail)}</p>`).join("")}<h4>Human review still required</h4><ul>${review.manual.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>${review.providerIds.map((id) => `<button class="quiet-button" data-challenge="${esc(id)}">Issue credential challenge for ${esc(id)}</button>`).join("")}</section>`;
}
function render() {
  const filter = $("#filter").value,
    list = records.filter((r) => filter === "all" || r.status === filter);
  $("#queue-title").textContent =
    `Applications · ${records.filter((r) => r.status === "pending").length} pending`;
  $("#applications").innerHTML = list.length
    ? list
        .map(
          (r) =>
            `<article class="panel intake-panel"><p class="eyebrow">${esc(r.status)} · ${new Date(r.created).toLocaleString()}</p><h2>${esc(r.body.name)}</h2><button class="quiet-button" data-conversation="${esc(r.id)}">Messages${r.unread ? ` · ${r.unread} unread` : ""}</button><p><a class="primary-button" href="/scorecard?application=${encodeURIComponent(r.id)}">Assessment scorecard →</a></p>${reviewCard(r.review)}<dl class="rating-criteria"><dt>Contact</dt><dd>${esc(r.body.contact)}</dd><dt>Website</dt><dd>${esc(r.body.website || "Not provided")}</dd><dt>Software / template role</dt><dd>${esc(r.body.software)} / ${esc(r.body.role)}</dd><dt>Setup notes</dt><dd class="admin-notes">${esc(r.body.notes || "No notes")}</dd></dl>${r.body.profileConsent ? `<h3>Public profile submission</h3><pre>${esc(JSON.stringify(r.body.profile, null, 2))}</pre><button class="quiet-button" data-action="publish-profile" data-id="${esc(r.id)}">Review & publish profile</button>` : ""}<p class="small muted">Reference: ${esc(r.id)}</p><div class="admin-actions">${r.status === "pending" ? `<button class="primary-button" data-action="approve" data-id="${esc(r.id)}">Review & approve</button><button class="quiet-button" data-action="reject" data-id="${esc(r.id)}">Decline</button>` : r.status === "declined" ? `<button class="quiet-button" data-action="reopen" data-id="${esc(r.id)}">Reopen application</button>` : ""}</div></article>`,
        )
        .join("")
    : '<p class="empty">No applications in this view.</p>';
  $("#providers").innerHTML = providers.length
    ? `<div class="table-scroll"><table><thead><tr><th>Provider</th><th>Status</th><th>Manage access</th></tr></thead><tbody>${providers.map((p) => `<tr><td>${esc(p.id)}</td><td>${p.active ? "Active" : "Revoked"}</td><td><button class="quiet-button" data-action="rotate" data-id="${esc(p.id)}">Issue new token</button> ${p.active ? `<button class="quiet-button" data-action="token-claim" data-id="${esc(p.id)}">Create token claim link</button> <button class="quiet-button" data-action="revoke" data-id="${esc(p.id)}">Revoke</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
    : '<p class="small muted">No database-managed providers yet.</p>';
}
async function refresh() {
  const data = await api("applications");
  records = data.applications;
  providers = data.providers;
  render();
  $("#audit").innerHTML =
    data.audit
      .map(
        (a) =>
          `<p class="small">${new Date(a.time).toLocaleString()} · ${esc(a.action)} · ${esc(a.target)}</p>`,
      )
      .join("") || '<p class="small muted">No activity yet.</p>';
}
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target,
    button = form.querySelector("button");
  button.disabled = true;
  try {
    const result = await api(configured ? "login" : "setup", {
      password: form.elements.password.value,
      code: form.elements.code.value,
    });
    csrf = result.csrf;
    form.reset();
    $("#message").textContent = "";
    await session();
  } catch (err) {
    $("#message").textContent = err.message;
  } finally {
    button.disabled = false;
  }
});
$("#logout").addEventListener("click", async () => {
  try {
    await api("logout", {});
    location.reload();
  } catch (e) {
    $("#message").textContent = e.message;
  }
});
$("#refresh").addEventListener("click", () =>
  refresh().catch((e) => ($("#message").textContent = e.message)),
);
$("#filter").addEventListener("change", render);
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  action = { type: button.dataset.action, id: button.dataset.id };
  $("#action-form").reset();
  $("#action-error").textContent = "";
  $("#action-title").textContent = {
    "publish-profile": "Publish profile (replaces current details)",
    approve: "Approve operator",
    reject: "Decline application",
    reopen: "Reopen application",
    revoke: "Revoke provider access",
    rotate: "Issue replacement token",
    "token-claim": "Create a private token claim link",
  }[action.type];
  $("#action-info").textContent = ["rotate", "revoke"].includes(action.type)
    ? "This changes access for " +
      action.id +
      ". Existing tokens will stop working."
    : "Review this application before changing its status. Declined applications can be reopened.";
  if (action.type === "token-claim") $("#action-info").textContent = "Creates a one-use link valid for 24 hours for this approved provider. Share it privately with the operator. Their existing token changes only when they claim the new one. A new link replaces any earlier unclaimed link.";
  $("#pool-label").hidden = action.type !== "publish-profile";
  $("#pool-label input").required = false;
  $("#provider-label").hidden = action.type !== "approve";
  $("#provider-label input").required = action.type === "approve";
  $("#review-label").hidden = !["approve", "publish-profile"].includes(
    action.type,
  );
  $("#review-label input").required = ["approve", "publish-profile"].includes(
    action.type,
  );
  $("#action-dialog").showModal();
});
$("#cancel").addEventListener("click", () => $("#action-dialog").close());
$("#action-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("[type=submit]");
  button.disabled = true;
  try {
    const result = await api(action.type, {
      application: action.id,
      poolId: e.target.elements.poolId.value,
      reviewed: e.target.elements.reviewed.checked,
      provider:
        action.type === "approve"
          ? e.target.elements.provider.value
          : action.id,
    });
    $("#action-dialog").close();
    if (result.token || result.claimLink) {
      $("#token-dialog h2").textContent = result.claimLink ? "Send this private claim link" : "Save this provider token";
      $("#token-dialog .small").textContent = result.claimLink ? "One use, expires in 24 hours. Share only with this operator through a private channel. Anyone with the link can claim the token. No message has been sent." : "Shown once. Send privately to the reviewed operator; it cannot be recovered after closing.";
      $("#copy-token").textContent = result.claimLink ? "Copy private link" : "Copy token";
      $("#token-value").textContent = result.claimLink ? new URL(result.claimLink, location.origin).href : result.token;
      $("#copy-status").textContent = "";
      $("#token-dialog").showModal();
    }
    await refresh();
  } catch (err) {
    $("#action-error").textContent = err.message;
  } finally {
    button.disabled = false;
  }
});
$("#copy-token").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#token-value").textContent);
    $("#copy-status").textContent = "Copied.";
  } catch {
    $("#copy-status").textContent = "Select and copy the token manually.";
  }
});
$("#close-token").addEventListener("click", () => $("#token-dialog").close());
$("#token-dialog").addEventListener(
  "close",
  () => ($("#token-value").textContent = ""),
);
session().catch((e) => ($("#message").textContent = e.message));

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-challenge]");
  if (!b) return;
  b.disabled = true;
  try {
    const c = await api("review-challenge", { provider: b.dataset.challenge });
    $("#challenge-text").textContent =
      `Provider: ${b.dataset.challenge}\nPOST https://xbtpulse.tech/api/telemetry/challenge\nAuthorization: Bearer YOUR_PROVIDER_TOKEN\nContent-Type: application/json\n\n${JSON.stringify({ code: c.code })}\n\nExpires: ${new Date(c.expires).toLocaleString()}`;
    $("#challenge-dialog").showModal();
  } catch (error) {
    $("#message").textContent = error.message;
  } finally {
    b.disabled = false;
  }
});
$("#close-challenge").addEventListener("click", () =>
  $("#challenge-dialog").close(),
);
$("#challenge-dialog").addEventListener(
  "close",
  () => ($("#challenge-text").textContent = ""),
);
setInterval(() => {
  if (csrf && !document.hidden && !document.querySelector("dialog[open]"))
    refresh().catch((e) => ($("#message").textContent = e.message));
}, 60000);

let conversationId = "",
  replyId = crypto.randomUUID();
async function loadMessages() {
  const data = await api(
    "conversation?application=" + encodeURIComponent(conversationId),
  );
  $("#messages-title").textContent = data.name + " · conversation";
  $("#message-history").innerHTML =
    data.messages
      .map(
        (m) =>
          `<article><h3>${m.role === "admin" ? "XBT Pulse" : "Operator"} · ${new Date(m.time).toLocaleString()}</h3><p class="admin-notes">${esc(m.body)}</p></article>`,
      )
      .join("") || "<p>No messages yet.</p>";
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-conversation]");
  if (!b) return;
  conversationId = b.dataset.conversation;
  replyId = crypto.randomUUID();
  $("#admin-reply").reset();
  $("#operator-link").value = "";
  $("#operator-link").hidden = true;
  $("#copy-message-link").hidden = true;
  $("#message-error").textContent = "";
  $("#messages-dialog").showModal();
  try {
    await loadMessages();
  } catch (error) {
    $("#message-error").textContent = error.message;
  }
});
$("#admin-reply").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = e.target.querySelector("button");
  b.disabled = true;
  try {
    await api("message", {
      application: conversationId,
      id: replyId,
      message: e.target.elements.message.value,
    });
    e.target.reset();
    replyId = crypto.randomUUID();
    await loadMessages();
    $("#message-error").textContent =
      "Reply saved for the operator. Share their link if they do not have it yet.";
  } catch (error) {
    $("#message-error").textContent = error.message;
  } finally {
    b.disabled = false;
  }
});
$("#create-message-link").addEventListener("click", async (e) => {
  e.target.disabled = true;
  try {
    const data = await api("conversation-link", {
      application: conversationId,
    });
    $("#operator-link").value = location.origin + data.link;
    $("#operator-link").hidden = false;
    $("#copy-message-link").hidden = false;
  } catch (error) {
    $("#message-error").textContent = error.message;
  } finally {
    e.target.disabled = false;
  }
});
$("#copy-message-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#operator-link").value);
    $("#message-error").textContent = "Link copied. Share it privately.";
  } catch {
    $("#operator-link").select();
    $("#message-error").textContent = "Copy the selected link manually.";
  }
});
$("#close-messages").addEventListener("click", () =>
  $("#messages-dialog").close(),
);
$("#messages-dialog").addEventListener("close", () => {
  $("#operator-link").value = "";
  $("#message-history").innerHTML = "";
  refresh().catch(() => {});
});

let tagPage = 1, tagSearchSequence = 0;
async function searchTags(page = 1) {
  const sequence = ++tagSearchSequence;
  $("#tag-prev").disabled = $("#tag-next").disabled = true;
  $("#tag-search-results").innerHTML = "";
  $("#tag-search-status").textContent = "Searching retained blocks…";
  try {
    const d = await api("tag-search?" + new URLSearchParams({ q: $("#tag-query").value.trim(), page }));
    if (sequence !== tagSearchSequence || $("#desk").hidden) return;
    tagPage = d.page;
    $("#tag-search-status").textContent = `${d.total} tag matches for “${d.q}” · Page ${d.page} of ${d.pages} · ${d.searched} retained blocks${d.searched ? ` (#${d.oldest}–#${d.newest})` : ""}. Last collection: ${d.collectedAt ? new Date(d.collectedAt).toLocaleString() : "unavailable"}.`;
    $("#tag-search-results").innerHTML = d.blocks.length ? `<table><thead><tr><th>Block</th><th>Time (UTC)</th><th>Explorer pool label</th><th>Original coinbase text</th></tr></thead><tbody>${d.blocks.map(b => `<tr><td><a href="https://mempool.guide/block/${encodeURIComponent(b.hash)}" target="_blank" rel="noopener noreferrer">#${Number(b.height)}</a></td><td>${esc(new Date(b.time * 1000).toISOString())}</td><td>${esc(b.pool)}</td><td class="recipient-full">${esc(b.tag)}</td></tr>`).join("")}</tbody></table>` : "<p>No matches in retained history.</p>";
    $("#tag-prev").disabled = d.page <= 1;
    $("#tag-next").disabled = d.page >= d.pages;
  } catch (error) {
    if (sequence === tagSearchSequence) $("#tag-search-status").textContent = error.message;
  }
}
$("#tag-search-form").addEventListener("submit", e => { e.preventDefault(); searchTags(); });
$("#tag-prev").addEventListener("click", () => searchTags(tagPage - 1));
$("#tag-next").addEventListener("click", () => searchTags(tagPage + 1));
$("#tag-query").addEventListener("input", () => {
  ++tagSearchSequence;
  $("#tag-prev").disabled = $("#tag-next").disabled = true;
});
