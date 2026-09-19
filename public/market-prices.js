const root = document.querySelector("#market-prices");
let busy = false;
const add = (parent, tag, text) => { const el = document.createElement(tag); el.textContent = text; parent.append(el); return el; };
async function refreshPrices() {
  if (busy || document.hidden) return;
  busy = true;
  try {
    const response = await fetch("/api/market-prices", {signal:AbortSignal.timeout(12000), cache:"no-store"});
    if (!response.ok) throw Error();
    const data = await response.json();
    root.replaceChildren();
    for (const row of data.rows) {
      const card = add(root, "div", "");
      add(card, "strong", row.name + " · " + row.pair);
      add(card, "p", row.price == null ? "Price unavailable" : `${row.price.toLocaleString(undefined,{maximumFractionDigits:2})} ${row.quote}${row.stale ? " — STALE" : ""}`);
      add(card, "p", row.change == null ? "24h change unavailable" : `24h: ${row.change >= 0 ? "+" : ""}${row.change.toFixed(2)}%`);
      add(card, "p", row.fetchedAt ? "Fetched " + new Date(row.fetchedAt).toLocaleString() : "No successful fetch yet").className = "small muted";
      if (row.sourceTime) add(card, "p", "Source computed " + new Date(row.sourceTime).toLocaleString()).className = "small muted";
      if (row.unavailable) add(card, "p", "Latest source request failed.").className = "small muted";
      const link = add(card, "a", "Source API ↗"); link.href = row.url; link.rel = "noopener noreferrer"; link.target = "_blank";
    }
  } catch { root.textContent = "Exchange quotes unavailable. Please try again shortly."; }
  finally { busy = false; }
}
refreshPrices();
setInterval(refreshPrices,60000);
document.addEventListener("visibilitychange",refreshPrices);
