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
  pools
    .filter((p) => !p.unknown)
    .forEach((p, index) => {
      poolColors.set(
        p.id,
        colors[index] || `hsl(${(index * 137.508) % 360} 55% 42%)`,
      );
    });
  // These two categories never borrow a named pool's color.
  poolColors.set("other", "#E2B526");
}
function poolLink(p) {
  if (p.id === "other")
    return '<button class="text-link" data-other-groups>Other attributed groups ↗</button>';
  return !demo && !p.unknown && p.id !== "other"
    ? `<a href="/pool?id=${encodeURIComponent(p.id)}">${escape(p.name)}</a>`
    : escape(p.name);
}
function poolColor(p) {
  if (p.unknown) return "#84919F";
  return poolColors.get(p.id) || "#84919F";
}
function chartGroups(pools) {
  const known = pools
    .filter((p) => !p.unknown)
    .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));
  const top = known.slice(0, 4);
  const rest = known.slice(4);
  if (rest.length)
    top.push({
      id: "other",
      name: "Other attributed groups",
      share: rest.reduce((s, p) => s + p.share, 0),
    });
  return [...top, ...pools.filter((p) => p.unknown)].sort(
    (a, b) => b.share - a.share || a.name.localeCompare(b.name),
  );
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
  const example = data.telemetry?.providers?.find(p => p.name === "soveroot");
  $("#example-status").textContent = demo
    ? "Sample mode is on. The example links open real observations; current reporting is not shown in sample mode."
    : example
      ? `${example.stale ? "Reporting delayed" : example.participationBadge === "Telemetry Contributor" ? "Telemetry reporting current" : "Reporting participation needs review"} · Last report: ${new Date(example.lastReport).toLocaleString()}.`
      : "No Soveroot reports available in this dashboard window. The profile still explains the setup; missing reports do not prove downtime.";
  const pools = data.pools || [],
    blocks = data.blocks || [],
    chart = chartGroups(pools);
  assignPoolColors(pools);
  $("#onboarding-cards").innerHTML = demo
    ? "<p>Return to network mode to see real participating operators.</p>"
    : data.onboarding?.length
      ? data.onboarding
          .map(
            (p) =>
              `<article class="onboarding-card"><p class="eyebrow">${p.poolType === "private" ? "PRIVATE POOL · NOT ACCEPTING MINERS" : p.poolType === "public" ? "PUBLIC POOL" : "POOL / GATEWAY"}</p><h3>${p.profileUrl ? `<a href="${escape(p.profileUrl)}">${escape(p.name)} ↗</a>` : escape(p.name)}</h3><p class="rating-badge ${p.status === "Telemetry Contributor" ? "contributor" : ""}">${escape(p.status)}</p><p class="small muted">Joined ${new Date(p.submittedAt).toLocaleDateString()}${p.lastReport ? "<br>Last report " + new Date(p.lastReport).toLocaleString() : ""}</p><p class="small">Rating: ${escape(p.ratingStatus)}</p></article>`,
          )
          .join("")
      : "<p>No public onboarding listings yet. Public and private DATUM operators are welcome.</p>";
  $("#private-pools").innerHTML =
    !demo && data.privatePools?.length
      ? `<h3>Participating private pool profiles</h3><p class="small muted">Not accepting miners. A listing is not a rating or proof of decentralization.</p>${data.privatePools.map((p) => `<p><a href="/pool?id=${encodeURIComponent(p.id)}">${escape(p.name)}</a> · Private pool</p>`).join("")}`
      : "";
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
            `<div class="legend-row"><i class="swatch" style="background:${poolColor(p)}"></i><span>${poolLink(p)}</span><strong>${pct(p.share)}</strong></div>`,
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
            `<tr><td><span class="pool-name"><i class="swatch" style="background:${poolColor(p)}"></i>${poolLink(p)}</span></td><td>${p.blocks}</td><td><div class="share-cell"><span>${pct(p.share)}</span><div class="bar"><span style="width:${p.share * 100}%;background:${poolColor(p)}"></span></div></div></td><td>${pct(p.interval[0])}–${pct(p.interval[1])}</td><td><span class="evidence">${escape(p.evidence)}</span></td><td><a href="/ratings" class="rating-badge ${p.rating?.status === "Telemetry Contributor" ? "contributor" : ""}" title="${escape(p.rating?.evidence || "No completed assessment; not a failing grade.")}">${demo ? "Sample only" : escape(p.rating?.status || "Not assessed")}</a></td></tr>`,
        )
        .join("")
    : emptyRow(
        6,
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
    ? `<div class="table-scroll"><table><thead><tr><th>Provider</th><th>Reported work share</th><th>Expected blocks</th><th>Reported found</th><th>Found / expected</th></tr></thead><tbody>${providers.map((p) => `<tr><td>${escape(p.name)}${p.stale ? " · report delayed" : ""}<br><a href="/ratings" class="rating-badge ${p.participationBadge === "Telemetry Contributor" ? "contributor" : ""}">${escape(p.participationBadge || "Not assessed")}</a></td><td>${pct(p.workShare)}</td><td>${p.expected.toFixed(2)}</td><td>${p.found == null ? "Not available" : p.found}</td><td>${p.found != null && p.expected > 0 ? ((p.found / p.expected) * 100).toFixed(1) + "%" : "—"}</td></tr>`).join("")}</tbody></table></div>`
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
const requestedView = new URL(location.href).searchParams.get("view");
if (["overview", "payouts", "templates", "method"].includes(requestedView)) {
  document.querySelector(`[data-view="${requestedView}"]`).click();
}
$("#demo").addEventListener("click", () => {
  demo = !demo;
  refresh();
});
$("#window").addEventListener("change", refresh);
$("#threshold").addEventListener("change", renderAlerts);
$("#address-search").addEventListener("input", renderAddresses);
$("#close-detail").addEventListener("click", () => $("#detail").close());
$("#close-other").addEventListener("click", () => $("#other-detail").close());
function openOtherGroups() {
  if (!data) return;
  const groups = data.pools
    .filter((p) => !p.unknown)
    .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name))
    .slice(4);
  const total = groups.reduce((sum, p) => sum + p.blocks, 0);
  const share = groups.reduce((sum, p) => sum + p.share, 0);
  const largest = Math.max(1, ...groups.map((p) => p.blocks));
  const rank = (p) =>
    1 + data.pools.filter((q) => !q.unknown && q.blocks > p.blocks).length;
  $("#other-content").innerHTML =
    `<p class="small muted">${demo ? "Illustrative sample · " : ""}Snapshot of ${data.sample} observed network blocks${data.updatedAt ? " · " + escape(new Date(data.updatedAt).toLocaleString()) : ""}${data.status === "stale" ? " · Source stale" : ""}. Close and reopen for the latest breakdown.</p><div class="other-metrics"><p><strong>${groups.length}</strong>Named groups</p><p><strong>${total}</strong>Combined blocks</p><p><strong>${pct(share)}</strong>Of network observations</p></div><p>The four largest named pools and Unknown are excluded. These are separate attributed groups, not one operator. Ranks compare all named pools by observed block count; tied counts share a rank. This is not a decentralization rating.</p><h3>Blocks by group · largest first</h3><p class="small muted">Bar lengths compare block counts within this breakdown.</p><div class="other-bars">${groups.map((p) => `<div class="other-bar-row"><span><b>#${rank(p)}</b> ${poolLink(p)}</span><div class="bar"><span style="width:${(p.blocks / largest) * 100}%;background:${poolColor(p)}"></span></div><strong>${p.blocks}</strong></div>`).join("")}</div><h3>Group statistics</h3><div class="table-scroll"><table><thead><tr><th>Block rank</th><th>Group</th><th>Blocks</th><th>Network share</th><th>Share of Other</th><th>Network share · 95% interval</th></tr></thead><tbody>${groups.map((p) => `<tr><td>#${rank(p)}</td><td>${poolLink(p)}</td><td>${p.blocks}</td><td>${pct(p.share)}</td><td>${total ? pct(p.blocks / total) : "—"}</td><td>${p.interval ? p.interval.map(pct).join("–") : "—"}</td></tr>`).join("")}</tbody></table></div><p class="small muted">Network share uses all ${data.sample} observed blocks, including Unknown. Share of Other uses only these ${total} blocks. Block share is an estimate, not live hashrate or proof of common ownership.</p>`;
  $("#other-detail").showModal();
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-other-groups]")) {
    openOtherGroups();
    return;
  }
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
    if(!demo)loadAddressDetails(a.address);
  }
});
refresh();
setInterval(() => {
  if (!demo) refresh();
}, 30000);

let addressRequest=0;
document.querySelector('#detail').addEventListener('close',()=>{addressRequest++;});
async function loadAddressDetails(address){const request=++addressRequest;const root=document.querySelector('#detail-content');root.innerHTML='<p>Loading recipient history…</p>';try{const r=await fetch('/api/address?'+new URLSearchParams({address,window:document.querySelector('#window').value}),{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();const d=await r.json();if(request!==addressRequest||!document.querySelector('#detail').open)return;const amount=s=>(s/1e8).toLocaleString(undefined,{minimumFractionDigits:4,maximumFractionDigits:8}),date=t=>t?new Date(t*1000).toLocaleString():'No observation';root.innerHTML=`<p class="eyebrow">COINBASE RECIPIENT · ${d.stale?'SOURCE STALE':'OBSERVED DATA'}</p><h3>Address activity</h3><p class="mono recipient-full">${escape(d.address)}</p><button class="quiet-button" id="copy-recipient">Copy full address / script</button><p id="copy-recipient-status" role="status"></p><div class="table-scroll"><table><thead><tr><th>Activity</th><th>Selected window</th><th>Retained history</th></tr></thead><tbody><tr><th>Network blocks examined</th><td>${d.window.sample} / ${d.window.requested}</td><td>${d.retained.sample}</td></tr><tr><th>Blocks paying recipient</th><td>${d.window.blocks}</td><td>${d.retained.blocks}</td></tr><tr><th>Coinbase outputs</th><td>${d.window.outputs}</td><td>${d.retained.outputs}</td></tr><tr><th>Total received (XBT)</th><td>${amount(d.window.sats)}</td><td>${amount(d.retained.sats)}</td></tr><tr><th>First observed</th><td>${escape(date(d.window.first))}</td><td>${escape(date(d.retained.first))}</td></tr><tr><th>Last observed</th><td>${escape(date(d.window.last))}</td><td>${escape(date(d.retained.last))}</td></tr></tbody></table></div><p class="small muted">Retained history is not all-time history. These are coinbase receipts, not balance, spending, maturity or spendable funds. Data updated ${escape(d.updatedAt||'unknown')}.</p><h3>Documented role</h3>${d.roles.length?d.roles.map(x=>`<p>${escape(x.pool)} · ${escape(x.role||'Unclassified')}</p>`).join(''):'<p>No documented role. Owner identity is unknown.</p>'}<div id="recipient-sources"></div><h3>Block attribution context</h3><p class="small muted">Pools attributed to blocks that paid this recipient. This does not identify the address owner or establish common pool ownership.</p><ul>${d.groups.map(g=>`<li>${g.unknown?escape(g.name):`<a href="/pool?id=${encodeURIComponent(g.id)}">${escape(g.name)}</a>`}: ${g.blocks} blocks · ${amount(g.sats)} XBT</li>`).join('')}</ul><h3>Latest ${d.recent.length} matching blocks</h3><div class="table-scroll"><table><thead><tr><th>Height / time</th><th>Attributed pool</th><th>Coinbase amount</th><th>Tag / block hash</th></tr></thead><tbody>${d.recent.map(b=>`<tr><td>#${b.height}<br>${escape(date(b.time))}</td><td>${escape(b.pool.name)}</td><td>${amount(b.sats)} XBT</td><td><details><summary>Show tag and hash</summary><p class="recipient-full">${escape(b.tag||'No readable tag')}</p><p class="mono recipient-full">${escape(b.hash)}</p></details></td></tr>`).join('')}</tbody></table></div>`;
for(const role of d.roles){try{const u=new URL(role.source);if(u.protocol!=='https:'||u.username||u.password)continue;const p=document.createElement('p'),a=document.createElement('a');a.href=u.href;a.textContent='Source for '+role.pool+' recipient role';a.target='_blank';a.rel='noopener noreferrer';p.append(a);document.querySelector('#recipient-sources').append(p);}catch{}}
document.querySelector('#copy-recipient').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(address);document.querySelector('#copy-recipient-status').textContent='Copied.';}catch{document.querySelector('#copy-recipient-status').textContent='Select and copy the full address above.';}});
}catch{if(request===addressRequest)root.innerHTML='<h3>Recipient details unavailable</h3><p>Close and reopen to retry.</p>';}}
