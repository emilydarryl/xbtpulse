const [application, token] = location.hash.slice(1).split(":");
const $ = (s) => document.querySelector(s);
let messageId = crypto.randomUUID(),
  busy = false;
async function request(body) {
  const r = await fetch(
    "/api/conversation?application=" + encodeURIComponent(application || ""),
    {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + (token || ""),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
async function refresh() {
  try {
    const data = await request();
    $("#title").textContent = data.name + " · " + data.status;
    $("#messages").replaceChildren();
    for (const m of data.messages) {
      const article = document.createElement("article"),
        heading = document.createElement("h3"),
        body = document.createElement("p");
      heading.textContent =
        (m.role === "admin" ? "XBT Pulse" : "You") +
        " · " +
        new Date(m.time).toLocaleString();
      body.textContent = m.body;
      body.style.whiteSpace = "pre-wrap";
      article.append(heading, body);
      $("#messages").append(article);
    }
    if (!data.messages.length)
      $("#messages").textContent =
        "No messages yet. You can ask a question below.";
    $("#status").textContent =
      "Messages checked " + new Date().toLocaleTimeString();
  } catch (e) {
    $("#status").textContent = e.message;
  }
}
$("#reply").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  busy = true;
  const b = e.target.querySelector("button");
  b.disabled = true;
  try {
    await request({ id: messageId, message: e.target.elements.message.value });
    e.target.reset();
    messageId = crypto.randomUUID();
    await refresh();
  } catch (error) {
    $("#status").textContent = error.message;
  } finally {
    busy = false;
    b.disabled = false;
  }
});
$("#refresh").addEventListener("click", refresh);
refresh();
setInterval(() => {
  if (!document.hidden && !busy) refresh();
}, 30000);
