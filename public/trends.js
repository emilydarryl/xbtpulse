const $ = (s) => document.querySelector(s);
const pct = (n) => (n * 100).toFixed(1) + "%";
const date = (n) => new Date(n).toLocaleString();
let data;
function text(tag, value, parent) {
  const e = document.createElement(tag);
  e.textContent = value;
  parent.append(e);
  return e;
}
function render() {
  const w = data.windows.find(
    (w) => w.days === Number($("#trend-window").value),
  );
  $("#trend-coverage").textContent =
    `${w.complete ? "Retained history covers this window" : "Partial coverage · collecting older history"} · ${w.blocks} observed blocks. Requested ${date(w.start)} to ${date(w.end)}.`;
  const table = $("#trend-pools");
  table.replaceChildren();
  for (const p of w.pools) {
    const row = document.createElement("tr");
    table.append(row);
    const cell = document.createElement("td");
    row.append(cell);
    if (p.unknown) cell.textContent = p.name;
    else {
      const a = text("a", p.name, cell);
      a.href = "/pool?id=" + encodeURIComponent(p.id);
    }
    text("td", p.blocks, row);
    text("td", pct(p.share), row);
    text("td", p.interval.map(pct).join("–"), row);
  }
  if (!w.blocks) {
    const row = text("tr", "", table);
    const cell = text("td", "No blocks retained for this window.", row);
    cell.colSpan = 4;
  }
  const select = $("#trend-operator"),
    old = select.value;
  select.replaceChildren();
  for (const p of data.windows.at(-1).pools) {
    const o = text("option", p.name, select);
    o.value = p.id;
  }
  if ([...select.options].some((o) => o.value === old)) select.value = old;
  renderDaily();
  const feed = $("#change-feed");
  feed.replaceChildren();
  for (const c of data.changes) {
    const li = text("li", "", feed);
    const time = text("time", date(c.time), li);
    time.dateTime = new Date(c.time).toISOString();
    const label = text("strong", c.name, li);
    if (c.profileUrl) {
      label.textContent = "";
      const a = text("a", c.name, label);
      a.href = c.profileUrl;
    }
    text(
      "p",
      c.previous
        ? `${c.previous} → ${c.status}`
        : `First observed: ${c.status}`,
      li,
    );
  }
  if (!data.changes.length)
    text("li", "No public status observations recorded yet.", feed);
  $("#changes-coverage").textContent =
    `Tracking since ${date(data.changesStarted)}. Latest 30 visible changes; up to 90 days retained.`;
}
function renderDaily() {
  const chart = $("#daily-chart");
  chart.replaceChildren();
  $("#daily-detail").textContent = "Select a day to inspect its evidence.";
  for (const d of data.daily) {
    const p = d.pools.find((p) => p.id === $("#trend-operator").value),
      n = p?.blocks || 0,
      share = d.blocks ? n / d.blocks : null;
    const day = new Date(d.start).toISOString().slice(0, 10),
      partial = !d.complete || d.end - d.start < 86400000;
    const description = `${day} UTC: ${share === null ? "No observations" : `${n} of ${d.blocks} blocks (${pct(share)})`}${partial ? " · partial day" : ""}`;
    const col = text("div", "", chart);
    col.className = "day-column";
    const button = text("button", "", col);
    button.type = "button";
    button.className = partial ? "partial" : "";
    button.title = description;
    button.setAttribute("aria-label", description);
    button.setAttribute("aria-pressed", "false");
    if (share !== null) {
      const bar = text("span", "", button);
      bar.style.height = share * 100 + "%";
      bar.setAttribute("aria-hidden", "true");
    }
    text("small", day.slice(8), col);
    button.addEventListener("click", () => {
      chart
        .querySelectorAll("button")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      $("#daily-detail").textContent =
        description +
        (p ? ` · 95% interval ${p.interval.map(pct).join("–")}` : "");
    });
  }
}
async function load() {
  try {
    const r = await fetch("/api/trends");
    if (!r.ok) throw Error();
    data = await r.json();
    $("#history-status").textContent =
      `${data.stale ? "Source stale · history may be out of date" : "Source responding"} · Oldest retained block: ${data.oldest ? date(data.oldest) : "not available"}. Refreshes every 30 seconds.`;
    render();
  } catch {
    $("#history-status").textContent =
      "Unable to refresh history. Any displayed figures are from the previous successful load.";
  }
}
$("#trend-window").addEventListener("change", () => data && render());
$("#trend-operator").addEventListener("change", () => data && renderDaily());
load();
setInterval(() => {
  if (!document.hidden) load();
}, 30000);
