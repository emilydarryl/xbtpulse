const $ = (s) => document.querySelector(s);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const colors = [
  "#0072B2", // Blue
  "#D55E00", // Vermilion
  "#8B4BA8", // Purple
  "#009E73", // Teal
  "#CC79A7",
  "#56B4E9",
  "#663F23",
  "#C52F42",
  "#4856B0",
  "#708322",
  "#A03E88",
  "#255B42",
  "#B8874D",
  "#50316F",
  "#3B879B",
  "#BA5870",
  "#7D6718",
  "#2C4057",
  "#8F532F",
  "#624F59",
];
let poolColors = new Map();
function assignPoolColors(pools) {
  poolColors = new Map();
  pools.filter((p) => !p.unknown).forEach((p, index) => {
    poolColors.set(p.id, colors[index] || `hsl(${(index * 137.508) % 360} 55% 42%)`);
  });
  // These two categories never borrow a named pool's color.
  poolColors.set("other", "#E2B526");
}
function poolColor(p) {
  if (p.unknown) return "#84919F";
  return poolColors.get(p.id) || "#84919F";
}
function chartGroups(pools) {
  const known = pools.filter((p) => !p.unknown);
  const top = known.slice(0, 4);
  const rest = known.slice(4);
  if (rest.length)
    top.push({
      id: "other",
      name: "Other attributed groups",
      share: rest.reduce((s, p) => s + p.share, 0),
    });
  return [...top, ...pools.filter((p) => p.unknown)];
}
const pct = (n) => `${(Number(n) * 100).toFixed(1)}%`;
const short = (s) => (s.length > 30 ? `${s.slice(0, 16)}…${s.slice(-9)}` : s);
let data = null,
  demo = false,
  requestId = 0;
function sampleInterval(k, n) {
  const p = k / n,
    d = 1 + 3.8416 / n,
    c = (p + 3.8416 / (2 * n)) / d,
    r = (1.96 * Math.sqrt((p * (1 - p)) / n + 3.8416 / (4 * n * n))) / d;
  return [Math.max(0, c - r), Math.min(1, c + r)];
}
function sampleData() {
  const count = Number($("#window").value);
  const pools = [
    ["Northstar · example", 0.32],
    ["Meadow · example", 0.24],
    ["Orbit · example", 0.18],
    ["Cedar · example", 0.12],
    ["Unknown", 0.14],
  ].map(([name, share], i) => ({
    id: `example-${i}`,
    name,
    blocks: Math.floor(count * share),
    share,
    interval: [Math.max(0, share - 0.07), Math.min(1, share + 0.08)],
    evidence: i === 4 ? "Unattributed" : "Illustrative only",
    unknown: i === 4,
  }));
  pools.forEach((p) => {
    p.interval = sampleInterval(p.blocks, count);
  });
  pools[4].blocks = count - pools.slice(0, 4).reduce((a, p) => a + p.blocks, 0);
  pools.forEach((p) => {
    p.share = p.blocks / count;
    p.interval = sampleInterval(p.blocks, count);
  });
  return {
    status: "sample",
    sample: count,
    pools,
    blocks: Array.from({ length: 12 }, (_, i) => ({
      height: 970000 - i,
      hash: `sample-block-${i}`,
      time: Math.floor(Date.now() / 1000) - i * 210,
      pool: pools[i % 5].name,
      outputs: [{ address: `sample-recipient-${(i % 4) + 1}`, value: 3.125 }],
    })),
    addresses: Array.from({ length: 4 }, (_, i) => ({
      address: `sample-recipient-${i + 1}`,
      blocks: 20 - i * 3,
      amount: 62.5 - i * 9.375,
      role: "Example recipient",
    })),
    telemetry: null,
    updatedAt: new Date().toISOString(),
    source: "Illustrative data",
  };
}
function emptyRow(n, text) {
  return `<tr><td colspan="${n}" class="empty">${text}</td></tr>`;
}
function render() {
  if (!data) return;
  const pools = data.pools || [],
    blocks = data.blocks || [],
    chart = chartGroups(pools);
  assignPoolColors(pools);
  $("#source-status").textContent = demo
    ? "Sample mode"
    : data.status === "live"
      ? "Observing network"
      : data.status === "stale"
        ? "Source delayed"
        : "Awaiting data";
  $("#source-status").classList.toggle("live", !demo && data.status === "live");
  $("#demo").textContent = demo ? "Return to network" : "Explore sample data";
  $("#notice").hidden = !demo && data.status === "live";
  $("#notice").textContent = demo
    ? "SAMPLE DATA — Illustrative pools, addresses, and block history. These are not measurements of the XBT network."
    : data.status === "stale"
      ? "The data source is delayed. Showing the last indexed observations; check the timestamp before interpreting changes."
      : "Network data is not connected yet. Explore the sample to see how the observatory works.";
  $("#sample").textContent = data.sample ? data.sample.toLocaleString() : "—";
  $("#donut-count").textContent = data.sample
    ? data.sample.toLocaleString()
    : "—";
  $("#range").textContent = data.sample
    ? `${data.sample.toLocaleString()} of ${Number($("#window").value).toLocaleString()} requested blocks`
    : "No indexed blocks yet";
  const largest = pools
    .filter((p) => !p.unknown)
    .sort((a, b) => b.share - a.share)[0];
  $("#largest").textContent = largest ? pct(largest.share) : "—";
  $("#largest-name").textContent = largest?.name || "Attribution pending";
  $("#unknown").textContent = data.sample
    ? pct(pools.filter((p) => p.unknown).reduce((a, p) => a + p.share, 0))
    : "—";
  $("#coverage").textContent = data.telemetry?.providers?.length
    ? String(data.telemetry.providers.length)
    : "—";
  $("#coverage-label").textContent = data.telemetry?.providers?.length
    ? "Reporting providers · partial coverage"
    : "No participating sources yet";
  $("#updated").textContent = data.updatedAt
    ? `${data.source || "Observations"} · ${new Date(data.updatedAt).toLocaleString()}`
    : "Waiting for observations";
  let angle = 0;
  $("#donut").style.background = pools.length
    ? `conic-gradient(${chart
        .map((p, i) => {
          const start = angle;
          angle += p.share * 360;
          const edge = angle - Math.min(1, (angle - start) / 8);
          return `${poolColor(p)} ${start}deg ${edge}deg, #fff ${edge}deg ${angle}deg`;
        })
        .join(",")})`
    : "#e9eee5";
  $("#legend").innerHTML = pools.length
    ? chart
        .map(
          (p, i) =>
            `<div class="legend-row"><i class="swatch" style="background:${poolColor(p)}"></i><span>${escape(p.name)}</span><strong>${pct(p.share)}</strong></div>`,
        )
        .join("")
    : '<p class="small muted">Pool distribution will appear after blocks are indexed.</p>';
  $("#pool-count").textContent = data.sample
    ? `${pools.filter((p) => !p.unknown).length} attributed groups`
    : "No observations";
  $("#pool-rows").innerHTML = pools.length
    ? pools
        .map(
          (p, i) =>
            `<tr><td><span class="pool-name"><i class="swatch" style="background:${poolColor(p)}"></i>${escape(p.name)}</span></td><td>${p.blocks}</td><td><div class="share-cell"><span>${pct(p.share)}</span><div class="bar"><span style="width:${p.share * 100}%;background:${poolColor(p)}"></span></div></div></td><td>${pct(p.interval[0])}–${pct(p.interval[1])}</td><td><span class="evidence">${escape(p.evidence)}</span></td></tr>`,
        )
        .join("")
    : emptyRow(
        5,
        "No blocks indexed yet. Attribution will always include an unknown category.",
      );
  $("#block-feed").innerHTML = blocks.length
    ? blocks
        .slice(0, 12)
        .map(
          (b, i) =>
            `<button class="block" data-block="${i}"><strong>#${Number(b.height).toLocaleString()}</strong><span>${escape(b.pool || "Unknown")}</span><span class="block-time">${new Date(b.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></button>`,
        )
        .join("")
    : '<p class="empty">New blocks will appear here.</p>';
  renderAlerts();
  renderAddresses();
  renderTelemetry();
}
function renderAlerts() {
  const threshold = Number($("#threshold").value) / 100;
  const signals = (data?.pools || []).filter(
    (p) => !p.unknown && p.share >= threshold,
  );
  $("#alerts").innerHTML = signals.length
    ? signals
        .map(
          (p) =>
            `<article class="signal warning"><h3>${escape(p.name)} is above ${pct(threshold)}</h3><p>${pct(p.share)} of ${data.sample} observed blocks. The 95% interval is ${pct(p.interval[0])}–${pct(p.interval[1])}.${p.interval[0] < threshold ? " The interval spans the watch level." : ""}</p></article>`,
        )
        .join("")
    : `<article class="signal"><h3>${data?.sample ? "No attributed pool above this watch level" : "Waiting for a measurable window"}</h3><p>${data?.sample ? "Unknown operators and sampling uncertainty can conceal concentration. Review the attribution register below." : "Concentration signals appear once chain observations are available."}</p></article>`;
}
function renderAddresses() {
  const query = $("#address-search").value.toLowerCase();
  const list = (data?.addresses || []).filter((a) =>
    a.address.toLowerCase().includes(query),
  );
  $("#address-rows").innerHTML = list.length
    ? list
        .map(
          (a) =>
            `<tr><td><button class="address-button mono" data-address="${escape(a.address)}" title="${escape(a.address)}">${escape(short(a.address))}</button></td><td>${a.blocks}</td><td>${Number(a.amount).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })}</td><td><span class="evidence">${escape(a.role || "Unclassified recipient")}</span></td></tr>`,
        )
        .join("")
    : emptyRow(
        4,
        query
          ? "No matching recipients in this window."
          : "Coinbase recipients will appear once blocks are indexed.",
      );
}
function renderTelemetry() {
  const providers = data?.telemetry?.providers || [];
  $("#telemetry-title").textContent = providers.length
    ? "Reported template work"
    : "Template telemetry is not connected";
  $("#telemetry-description").textContent = providers.length
    ? "Authenticated operator reports for the last 24 hours. Shares below are within reporting coverage only, not percentages of the entire network. Operator identities are not independently proven."
    : "Winning blocks do not reveal every attempted template. We need participating operators to measure template-control share and actual versus expected blocks.";
  $("#telemetry-data").innerHTML = providers.length
    ? `<div class="table-scroll"><table><thead><tr><th>Provider</th><th>Reported work share</th><th>Expected blocks</th><th>Reported found</th><th>Found / expected</th></tr></thead><tbody>${providers.map((p) => `<tr><td>${escape(p.name)}${p.stale ? " · report delayed" : ""}</td><td>${pct(p.workShare)}</td><td>${p.expected.toFixed(2)}</td><td>${p.found}</td><td>${p.expected > 0 ? ((p.found / p.expected) * 100).toFixed(1) + "%" : "—"}</td></tr>`).join("")}</tbody></table></div>`
    : "";
}
async function refresh() {
  const id = ++requestId;
  if (demo) {
    data = sampleData();
    render();
    return;
  }
  try {
    const r = await fetch(`/api/dashboard?window=${$("#window").value}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw Error("Unavailable");
    const next = await r.json();
    if (id !== requestId) return;
    data = next;
    render();
  } catch {
    if (id !== requestId) return;
    if (data && data.status !== "sample") {
      data.status = "stale";
      render();
    } else {
      data = {
        status: "unavailable",
        sample: 0,
        pools: [],
        blocks: [],
        addresses: [],
      };
      render();
    }
  }
}
document.querySelectorAll("[data-view]").forEach((button) =>
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".view")
      .forEach((v) => (v.hidden = v.id !== button.dataset.view));
    document.querySelectorAll("[data-view]").forEach((b) => {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
  }),
);
$("#demo").addEventListener("click", () => {
  demo = !demo;
  refresh();
});
$("#window").addEventListener("change", refresh);
$("#threshold").addEventListener("change", renderAlerts);
$("#address-search").addEventListener("input", renderAddresses);
$("#close-detail").addEventListener("click", () => $("#detail").close());
document.addEventListener("click", (e) => {
  const block = e.target.closest("[data-block]");
  const address = e.target.closest("[data-address]");
  if (block) {
    const b = data.blocks[Number(block.dataset.block)];
    $("#detail-content").innerHTML =
      `<p class="eyebrow">${demo ? "ILLUSTRATIVE BLOCK" : "BLOCK OBSERVATION"}</p><h3>Block #${b.height.toLocaleString()}</h3><p>${escape(b.pool || "Unknown")} · ${new Date(b.time * 1000).toLocaleString()}</p><p class="mono">${escape(b.hash)}</p><p>Coinbase recipients</p><pre>${escape(JSON.stringify(b.outputs, null, 2))}</pre>`;
    $("#detail").showModal();
  }
  if (address) {
    const a = data.addresses.find((a) => a.address === address.dataset.address);
    $("#detail-content").innerHTML =
      `<p class="eyebrow">COINBASE RECIPIENT</p><h3>${escape(a.role || "Unclassified recipient")}</h3><p class="mono">${escape(a.address)}</p><p>Appears in ${a.blocks} observed blocks, receiving ${a.amount.toFixed(8)} XBT in coinbase outputs.</p><p>This is not a balance lookup. Receipt of rewards does not prove ownership of a pool or control of its templates.</p>`;
    $("#detail").showModal();
  }
});
refresh();
setInterval(() => {
  if (!demo) refresh();
}, 30000);
