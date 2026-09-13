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
    records = [];
    providers = [];
    $("#applications").innerHTML = "";
    $("#providers").innerHTML = "";
    $("#audit").innerHTML = "";
  }
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
            `<article class="panel intake-panel"><p class="eyebrow">${esc(r.status)} · ${new Date(r.created).toLocaleString()}</p><h2>${esc(r.body.name)}</h2><dl class="rating-criteria"><dt>Contact</dt><dd>${esc(r.body.contact)}</dd><dt>Website</dt><dd>${esc(r.body.website || "Not provided")}</dd><dt>Software / template role</dt><dd>${esc(r.body.software)} / ${esc(r.body.role)}</dd><dt>Setup notes</dt><dd class="admin-notes">${esc(r.body.notes || "No notes")}</dd></dl><p class="small muted">Reference: ${esc(r.id)}</p><div class="admin-actions">${r.status === "pending" ? `<button class="primary-button" data-action="approve" data-id="${esc(r.id)}">Review & approve</button><button class="quiet-button" data-action="reject" data-id="${esc(r.id)}">Decline</button>` : r.status === "declined" ? `<button class="quiet-button" data-action="reopen" data-id="${esc(r.id)}">Reopen application</button>` : ""}</div></article>`,
        )
        .join("")
    : '<p class="empty">No applications in this view.</p>';
  $("#providers").innerHTML = providers.length
    ? `<div class="table-scroll"><table><thead><tr><th>Provider</th><th>Status</th><th>Manage access</th></tr></thead><tbody>${providers.map((p) => `<tr><td>${esc(p.id)}</td><td>${p.active ? "Active" : "Revoked"}</td><td><button class="quiet-button" data-action="rotate" data-id="${esc(p.id)}">Issue new token</button> ${p.active ? `<button class="quiet-button" data-action="revoke" data-id="${esc(p.id)}">Revoke</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
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
    approve: "Approve operator",
    reject: "Decline application",
    reopen: "Reopen application",
    revoke: "Revoke provider access",
    rotate: "Issue replacement token",
  }[action.type];
  $("#action-info").textContent = ["rotate", "revoke"].includes(action.type)
    ? "This changes access for " +
      action.id +
      ". Existing tokens will stop working."
    : "Review this application before changing its status. Declined applications can be reopened.";
  $("#provider-label").hidden = action.type !== "approve";
  $("#provider-label input").required = action.type === "approve";
  $("#review-label").hidden = action.type !== "approve";
  $("#review-label input").required = action.type === "approve";
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
      reviewed: e.target.elements.reviewed.checked,
      provider:
        action.type === "approve"
          ? e.target.elements.provider.value
          : action.id,
    });
    $("#action-dialog").close();
    if (result.token) {
      $("#token-value").textContent = result.token;
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
