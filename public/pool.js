const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const pct = (n) => (n === null ? "Not available" : (n * 100).toFixed(1) + "%");
const labels = {
  fee: "Pool fee (%)",
  payout: "Payout method",
  minimum: "Minimum payout (XBT)",
  withdrawal: "Withdrawal fees",
  protocols: "Mining protocols",
  regions: "Server regions",
  setup: "Setup guide",
  template: "Template control",
  website: "Website",
};
const id = new URL(location.href).searchParams.get("id");
async function load() {
  try {
    if (!id)
      throw Error(
        "Choose a pool from the network dashboard to open its profile.",
      );
    const windows = await Promise.all(
      [144, 576, 2016].map(async (window) => {
        const r = await fetch(
          "/api/pool?id=" + encodeURIComponent(id) + "&window=" + window,
          { signal: AbortSignal.timeout(15000) },
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        return d;
      }),
    );
    const d = windows[0],
      profile = d.profile;
    document.title = d.name + " · XBT Pulse";
    document.querySelector("#name").textContent = d.name;
    document.querySelector("#status").textContent =
      (d.status === "live"
        ? "Network observations"
        : "Data delayed or unavailable") +
      " · " +
      (d.updatedAt
        ? new Date(d.updatedAt).toLocaleString()
        : "No update recorded");
    document.querySelector("#content").innerHTML =
      `<p class="small muted">Pool ID: <code>${esc(d.id)}</code> · ${esc(d.evidence)}</p><section class="panel intake-panel"><p class="eyebrow">OBSERVED MINING ACTIVITY</p><h2>Block production across windows</h2><p class="small muted">These overlapping windows estimate mining share from observed blocks. They are not live hashrate readings or evidence of an attack.</p><div class="table-scroll"><table><thead><tr><th>Network window</th><th>Pool blocks</th><th>Observed share</th><th>95% interval</th></tr></thead><tbody>${windows.map((w) => `<tr><td>${w.sample} / ${w.requested} blocks</td><td>${w.blocks}</td><td>${pct(w.share)}</td><td>${w.interval ? w.interval.map(pct).join(" – ") : "Insufficient observations"}</td></tr>`).join("")}</tbody></table></div></section><section class="panel intake-panel"><p class="eyebrow">OPERATOR-PROVIDED INFORMATION</p><h2>Fees, payouts & connections</h2><p class="small muted">${profile ? "Reviewed for publication " + esc(new Date(profile.reviewedAt).toLocaleString()) + ". Terms are operator claims; confirm current terms with the pool." : "No operator details have been reviewed yet. Missing fees do not mean zero fees."}</p><dl class="rating-criteria">${Object.entries(
        labels,
      )
        .map(
          ([key, label]) =>
            `<dt>${label}</dt><dd>${profile?.[key] ? (["setup", "website"].includes(key) ? `<a href="${esc(profile[key])}" rel="noopener noreferrer">${esc(profile[key])}</a>` : esc(profile[key])) : "Not provided"}</dd>`,
        )
        .join(
          "",
        )}</dl><a href="/contribute">Submit or update this pool’s details ↗</a></section><section class="panel intake-panel"><p class="eyebrow">TRANSPARENCY & DECENTRALIZATION</p><h2>${esc(d.rating.status)}</h2><p>${esc(d.rating.evidence)}</p><p class="small muted">Publishing a profile does not award a rating. Template telemetry requires reviewed provider mappings and reporting participation.</p><h3>Template telemetry</h3>${d.telemetry.length ? d.telemetry.map((p) => `<p>${esc(p.name)} · ${esc(p.participationBadge)}<br>Last report: ${esc(new Date(p.lastReport).toLocaleString())}<br>Expected blocks: ${p.expected.toFixed(2)} · Reported found: ${p.found} · Found / expected: ${p.expected > 0 ? (p.found / p.expected).toFixed(2) : "Not available"}</p>`).join("") : "<p>No reports from reviewed, linked providers in the last 24 hours.</p>"}<p class="small muted">Telemetry is operator-reported and covers participating providers only.</p><a href="/ratings">Read the rating criteria ↗</a></section><section class="panel intake-panel"><h2>Recent attributed blocks</h2><p class="small muted">Up to 24 matching blocks from the latest ${d.sample} network blocks.</p>${d.recent.length ? d.recent.map((b) => `<p><strong>#${b.height}</strong> · ${esc(new Date(b.time * 1000).toLocaleString())}<br><span class="mono">${esc(b.hash)}</span></p>`).join("") : "<p>No matching blocks in this window.</p>"}</section><section class="panel intake-panel"><h2>Coinbase payout recipients</h2><p class="small muted">Recipients in this pool’s attributed blocks within the latest ${d.sample} network blocks. Addresses do not establish pool ownership or template control. Amounts are observed rewards, not wallet balances.</p><div class="table-scroll"><table><thead><tr><th>Address</th><th>Blocks</th><th>Received XBT</th></tr></thead><tbody>${d.addresses.map((a) => `<tr><td class="mono">${esc(a.address)}</td><td>${a.blocks}</td><td>${a.amount.toFixed(8)}</td></tr>`).join("") || '<tr><td colspan="3">No recipients in this window.</td></tr>'}</tbody></table></div></section>`;
  } catch (e) {
    document.querySelector("#status").textContent = e.message;
    document.querySelector("#name").textContent = "Pool profile unavailable";
  }
}
load();
