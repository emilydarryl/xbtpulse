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
      card.className = `market-ticker ${row.id}`;
      const source = add(card, "div", ""); source.className = "market-ticker-source";
      const link = add(source, "a", row.name);
      link.href = row.url; link.rel = "noopener noreferrer"; link.target = "_blank";
      link.title = `${row.pair} exchange quote · source API`;
      add(source, "span", row.quote);
      const price = add(card, "strong", row.price == null ? "—" : `${row.price.toLocaleString(undefined,{maximumFractionDigits:2})}`);
      price.className = "market-ticker-price";
      add(card, "span", row.price == null ? "Price unavailable" : row.quote).className = "market-ticker-unit";
      const change = add(card, "span", row.change == null ? "24h —" : `24h ${row.change >= 0 ? "+" : ""}${row.change.toFixed(2)}%`);
      change.className = `market-ticker-change ${row.change == null ? "" : row.change >= 0 ? "up" : "down"}`;
      if (row.stale) add(card, "span", "STALE").className = "market-ticker-stale";
      const meta = add(card, "span", row.fetchedAt ? `Updated ${new Date(row.fetchedAt).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})}` : "No recent fetch"); meta.className = "market-ticker-meta";
      if (row.unavailable) meta.textContent = "Source unavailable";
    }
  } catch { root.textContent = "Exchange quotes unavailable. Please try again shortly."; }
  finally { busy = false; }
}
refreshPrices();
setInterval(refreshPrices,60000);
document.addEventListener("visibilitychange",refreshPrices);
