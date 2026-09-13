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
    consent: fields.consent === "on",
  });
  result.textContent = `Details received for review. Reference: ${response.reference}. An administrator will use your contact details to follow up; telemetry is not enabled yet.`;
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
