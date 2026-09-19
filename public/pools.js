const $ = (s) => document.querySelector(s);
let page = 1,
  request = 0,
  timer;
const params = new URL(location.href).searchParams;
let statusView = params.get("view") === "status";
$("#directory-query").value = params.get("q") || "";
$("#directory-type").value = ["public", "private", "unspecified"].includes(
  params.get("type"),
)
  ? params.get("type")
  : "all";
const add = (parent, tag, value) => {
  const el = document.createElement(tag);
  el.textContent = value;
  parent.append(el);
  return el;
};
async function load() {
  const id = ++request;
  const q = $("#directory-query").value,
    type = $("#directory-type").value;
  const query = new URLSearchParams({ q, type, page: String(page) });
  if (statusView) query.set("view", "status");
  $("#status-explanation").hidden = !statusView;
  $("#view-status").setAttribute("aria-pressed", String(statusView));
  $("#view-directory").setAttribute("aria-pressed", String(!statusView));
  history.replaceState(null, "", "/pools?" + query);
  $("#directory-status").textContent = "Searching…";
  $("#directory-prev").disabled = true;
  $("#directory-next").disabled = true;
  try {
    const r = await fetch("/api/pools?" + query);
    if (!r.ok) throw Error();
    const d = await r.json();
    if (id !== request) return;
    const results = $("#directory-results");
    results.replaceChildren();
    results.className = statusView ? "panel table-scroll" : "directory-grid";
    let tbody;
    if (statusView) {
      const table = add(results, "table", "");
      const head = add(add(table, "thead", ""), "tr", "");
      ["Pool", "Observed block share", "Latest attributed block", "Reported hashrate", "Reported pool tip", "Published protocols / source"].forEach(t => add(head, "th", t));
      tbody = add(table, "tbody", "");
    }
    for (const p of d.rows) {
      if (statusView) {
        const row = add(tbody, "tr", ""), st = p.status || {};
        const name = add(row, "td", "");
        if (p.profileUrl) add(name, "a", p.name).href = p.profileUrl;
        else name.textContent = p.name;
        add(row, "td", st.observedShare == null ? "Unavailable" : `${(st.observedShare * 100).toFixed(2)}% of ${st.sample} blocks`);
        const latest = add(row, "td", "");
        if (st.latestBlock) {
          add(latest, "a", "#" + st.latestBlock.height).href = "https://mempool.guide/block/" + encodeURIComponent(st.latestBlock.hash);
          add(latest, "p", new Date(st.latestBlock.time * 1000).toLocaleString());
          const hours = Math.max(0, Math.floor((Date.now()/1000 - st.latestBlock.time)/3600));
          add(latest, "p", hours < 1 ? "Less than an hour ago" : hours < 24 ? `${hours} hours ago` : `${Math.floor(hours/24)} days ago`);
        } else latest.textContent = "No linked block in retained history";
        add(row, "td", "Not available");
        add(row, "td", "Not available");
        const protocols = add(row, "td", st.protocols || "Not documented");
        if (st.source && /^https?:\/\//.test(st.source.url)) add(protocols, "a", ` Source (${st.reviewedAt || "undated"})`).href = st.source.url;
        continue;
      }
      const card = add(results, "article", "");
      card.className = "panel intake-panel";
      add(
        card,
        "p",
        p.poolType === "private"
          ? "PRIVATE · NOT ACCEPTING MINERS"
          : p.poolType === "public"
            ? "PUBLIC POOL"
            : "TYPE NOT SPECIFIED",
      ).className = "eyebrow";
      const title = add(card, "h2", "");
      if (p.profileUrl) {
        const a = add(title, "a", p.name);
        a.href = p.profileUrl;
        const actions = add(card, "div", "");
        actions.className = "directory-actions";
        const view = add(actions, "a", "View pool →");
        view.href = p.profileUrl;
        view.className = "primary-button";
        const compare = add(actions, "a", "Compare this pool →");
        compare.href = "/compare?pool=" + encodeURIComponent(p.id);
        compare.className = "quiet-button";
      } else title.textContent = p.name;
      add(card, "p", p.participation);
      add(
        card,
        "p",
        p.lastObserved
          ? "Last attributed block: " +
              new Date(p.lastObserved).toLocaleString()
          : "No attributed blocks in retained history",
      );
      add(
        card,
        "p",
        p.retainedBlocks == null ? "Block attribution not linked; activity is not measured for this listing." : `${p.retainedBlocks} retained blocks · ${p.recentBlocks ? p.recentBlocks + " in the latest 144 network blocks" : "No blocks in the latest 144 network observations"}`,
      );
      if (!p.profileUrl) add(card, "p", "Public profile not published yet.");
    }
    if (!d.rows.length)
      add(
        results,
        "p",
        "No matching pools. Try a shorter name or select All types.",
      );
    $("#directory-status").textContent =
      `${d.total} matching listings${d.stale ? " · STALE chain data" : ""} · ${d.source || "Chain source unavailable"} · ${d.lastSuccess ? "Chain last checked " + new Date(d.lastSuccess).toLocaleString() : "Chain collection not yet available"}`;
    $("#directory-page").textContent = d.pages
      ? `Page ${d.page} of ${d.pages}`
      : "No results";
    $("#directory-prev").disabled = page <= 1;
    $("#directory-next").disabled = page >= d.pages;
  } catch {
    if (id === request) {
      $("#directory-results").replaceChildren();
      $("#directory-status").textContent =
        "Unable to load the directory. Please try Search again.";
    }
  }
}
$("#directory-search").addEventListener("submit", (e) => {
  e.preventDefault();
  clearTimeout(timer);
  page = 1;
  load();
});
$("#directory-query").addEventListener("input", () => {
  clearTimeout(timer);
  request++;
  timer = setTimeout(() => {
    page = 1;
    load();
  }, 300);
});
$("#directory-type").addEventListener("change", () => {
  page = 1;
  load();
});
$("#directory-prev").addEventListener("click", () => {
  page--;
  load();
});
$("#directory-next").addEventListener("click", () => {
  page++;
  load();
});
load();

$("#view-status").addEventListener("click", () => { statusView = true; page = 1; load(); });
$("#view-directory").addEventListener("click", () => { statusView = false; page = 1; load(); });
setInterval(() => { if (statusView && !document.hidden) load(); }, 30000);
