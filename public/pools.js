const $ = (s) => document.querySelector(s);
let page = 1,
  request = 0,
  timer;
const params = new URL(location.href).searchParams;
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
    for (const p of d.rows) {
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
        const compare = add(card, "a", "Compare this pool →");
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
        `${p.retainedBlocks} retained blocks · ${p.recentBlocks ? p.recentBlocks + " in the latest 144 network blocks" : "No blocks in the latest 144 network observations"}`,
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
      `${d.total} matching listings · ${d.lastSuccess ? "Chain last checked " + new Date(d.lastSuccess).toLocaleString() : "Chain collection not yet available"}`;
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
