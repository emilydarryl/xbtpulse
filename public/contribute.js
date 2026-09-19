async function loadParticipants() {
  const root = document.querySelector("#operator-list");
  try {
    const response = await fetch("/api/dashboard?window=144", {signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error();
    const data = await response.json();
    root.replaceChildren();
    for (const p of data.onboarding || []) {
      const card = document.createElement("article"); card.className = "onboarding-card";
      const title = document.createElement("h3");
      if (p.profileUrl?.startsWith("/pool?")) {
        const link = document.createElement("a"); link.href = p.profileUrl; link.textContent = p.name; title.append(link);
      } else title.textContent = p.name;
      card.append(title);
      for (const text of [p.poolType === "private" ? "Private pool · Not accepting miners" : "Pool / gateway", p.status, `Rating: ${p.ratingStatus || "Not assessed"}`, p.lastReport ? `Last report: ${new Date(p.lastReport).toLocaleString()}` : "No report yet"]) {
        const line = document.createElement("p"); line.textContent = text; line.className = "small"; card.append(line);
      }
      root.append(card);
    }
    if (!root.children.length) root.textContent = "No public contribution listings yet.";
  } catch { root.textContent = "Unable to load participants. Refresh to try again."; }
}
loadParticipants();
const conversationToken = Array.from(
  crypto.getRandomValues(new Uint8Array(32)),
  (v) => v.toString(16).padStart(2, "0"),
).join("");
const applicationId = crypto.randomUUID();
async function post(path, body, token) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Unable to submit. Please try again.");
  return result;
}
function wire(id, submit) {
  const form = document.getElementById(id),
    result = document.getElementById(
      id === "operator-form" ? "operator-result" : "report-result",
    );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    result.textContent = "Submitting…";
    try {
      await submit(form, result);
    } catch (error) {
      result.textContent =
        error.message === "Failed to fetch"
          ? "Unable to reach XBT Pulse. Please try again."
          : error.message;
    } finally {
      button.disabled = form.dataset.complete === "true";
      result.focus();
    }
  });
}
wire("operator-form", async (form, result) => {
  const fields = Object.fromEntries(new FormData(form));
  const response = await post("/api/operator-applications", {
    ...fields,
    id: applicationId,
    conversationToken,
    consent: fields.consent === "on",
    profileConsent: fields.profileConsent === "on",
    listingConsent: fields.listingConsent === "on",
  });
  result.textContent = `Details received for review. Reference: ${response.reference}. An administrator will use your contact details to follow up; telemetry is not enabled yet.`;
  const link = document.createElement("a");
  link.href = "/conversation#" + applicationId + ":" + conversationToken;
  link.textContent = "Open and bookmark your private conversation";
  result.append(document.createElement("br"), link);
  result.append(
    " — Save this link to read replies. Anyone with it can access this conversation. No email or Discord notifications are sent.",
  );
  for (const control of form.elements) control.disabled = true;
  form.dataset.complete = "true";
});
wire("report-form", async (form, result) => {
  const fields = new FormData(form);
  let report;
  try {
    report = JSON.parse(fields.get("report"));
  } catch {
    throw new Error("The report must be valid JSON.");
  }
  const response = await post(
    "/api/telemetry",
    report,
    fields.get("token").trim(),
  );
  form.elements.token.value = "";
  result.textContent = response.duplicate
    ? "This report was already received. No work was counted twice."
    : "Report received. Eligible intervals appear in Template Control after the next refresh.";
});
