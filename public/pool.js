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
  ethos: "Operator statement (self-described)",
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
document.querySelector("#mining-map-link").href =
  "/mining-map" + (id ? "?pool=" + encodeURIComponent(id) : "");
function freshnessSection(d) {
  const f=d.freshness;
  if (!f) return "";
  const date=value=>value ? new Date(value).toLocaleDateString() : "No date available";
  const row=(title,item)=>`<div><strong>${title}</strong><p class="${item.status === 'Review due' ? 'freshness-due' : 'muted'}">${esc(item.status)}</p><p class="small muted">${item.reviewedAt ? 'Evidence date: '+esc(date(item.reviewedAt)) : 'No published review'}${item.dueAt ? '<br>Review due: '+esc(date(item.dueAt)) : ''}</p></div>`;
  return `<section class="panel intake-panel"><p class="eyebrow">EVIDENCE FRESHNESS</p><h2>How current is the evidence?</h2><div class="freshness-grid">${row('Block attribution',f.attribution)}${row('Profile & public terms',f.profile)}${row('Published assessment',f.assessment)}<div><strong>Linked telemetry</strong>${f.telemetry.length ? f.telemetry.map(p=>`<p>${esc(p.name)} · ${esc(p.status)}<br><span class="small muted">${p.lastReport ? 'Last report: '+esc(new Date(p.lastReport).toLocaleString()) : 'No retained reports'}</span></p>`).join('') : '<p class="muted">No reviewed provider link</p>'}</div></div><p class="small muted">Reviews are due after ${f.reviewPeriodDays} days; a date within that period is not a guarantee of accuracy. Assessment freshness uses the oldest evidence check or observation end. Telemetry is stale after 30 minutes; absence from retained history does not prove a provider never reported. These notices do not change ratings or remove attribution.</p><a href="/contribute">Submit corrected details or new evidence →</a></section>`;
}
function attributionSection(d) {
  const r = d.attributionReview;
  if (!r) return `<section class="panel intake-panel"><p class="eyebrow">BLOCK ATTRIBUTION</p><h2>Why blocks appear under this pool</h2><p>${esc(d.evidence)}</p><p class="small muted">No reviewed address-and-tag map has been published for this pool. Explorer labels and payout recipients do not establish ownership or template control.</p></section>`;
  const link = (url, label) => {
    try { if (new URL(url).protocol === "https:") return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`; } catch {}
    return esc(label);
  };
  return `<section class="panel intake-panel" id="attribution-map"><p class="eyebrow">BLOCK ATTRIBUTION · REVIEWED ${esc(r.reviewedAt)}</p><h2>Why these blocks are grouped together</h2><p class="small muted">Dated evidence snapshot · heights ${Number(r.startHeight).toLocaleString()}–${Number(r.endHeight).toLocaleString()}. Counts below are from the review, not the current observation window.</p><div class="attribution-flow"><div><h3>Observed tag groups</h3>${r.groups.map(g=>`<p><strong>${esc(g.name)}</strong><br>${Number(g.blocks).toLocaleString()} blocks</p>`).join("")}</div><span class="attribution-arrow" aria-hidden="true">→</span><div><h3>Same collection address</h3><p class="mono attribution-address">${esc(r.address)}</p><p>One positive-value recipient</p></div><span class="attribution-arrow" aria-hidden="true">→</span><div><h3>${esc(d.name)}</h3><p>${r.groups.reduce((n,g)=>n+g.blocks,0).toLocaleString()} address-matched blocks in the reviewed snapshot</p></div></div><p>${esc(r.scope)}</p><p class="small muted">${esc(r.limitation)}</p><p>${link(r.source,"Reproduction, block examples & matching rule")} · Research credit: ${link(r.researchUrl,r.researchName)}</p></section>`;
}
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
    const scoreLink = document.querySelector("#scorecard-link");
    scoreLink.replaceChildren();
    scoreLink.hidden = !d.scorecard;
    if (d.scorecard) {
      const a = document.createElement("a");
      a.href = "/scorecard?pool=" + encodeURIComponent(id);
      a.textContent = `Reviewed pilot scorecard: Decentralization ${d.scorecard.totals.decentralization}/100 · Transparency ${d.scorecard.totals.transparency}/100 →`;
      scoreLink.append(a);
    }
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
      `${profile?.poolType === "private" ? `<p class="rating-badge">Private pool · Not accepting miners</p>` : profile?.poolType === "public" ? `<p class="rating-badge">Public pool</p>` : ""}<p class="small muted">Pool ID: <code>${esc(d.id)}</code> · ${esc(d.evidence)}</p>${d.assessment ? `<section class="panel intake-panel"><p class="eyebrow">OPEN REVIEW EXAMPLE</p><h2>${esc(d.assessment.status)}</h2><p>This pool is sharing its onboarding progress. Checks use real submitted evidence; this is not a completed decentralization rating.</p><dl class="rating-criteria">${d.assessment.checks.map((c) => `<dt>${esc(c.label)}</dt><dd>${esc(c.status)}</dd>`).join("")}</dl><p class="small muted">Credential access does not prove independent ownership or template control. Those require human review. Fresh work and 95% reporting coverage over 24 hours are needed for review readiness.</p><a href="/contribute">Submit your pool for assessment →</a></section>` : ""}<section class="panel intake-panel"><p class="eyebrow">OBSERVED MINING ACTIVITY</p><h2>Block production across windows</h2><p class="small muted">Auto-refreshes every 30 seconds. These overlapping windows estimate mining share from observed blocks.</p><div class="table-scroll"><table><thead><tr><th>Network window</th><th>Pool blocks</th><th>Observed share</th><th>95% interval</th></tr></thead><tbody>${windows.map((w) => `<tr><td>${w.sample} / ${w.requested} blocks</td><td>${w.blocks ?? "Not attributed"}</td><td>${pct(w.share)}</td><td>${w.interval ? w.interval.map(pct).join(" – ") : "Insufficient observations"}</td></tr>`).join("")}</tbody></table></div></section>${freshnessSection(d)}${attributionSection(d)}<section class="panel intake-panel"><p class="eyebrow">${profile?.provenance === "public-research" ? "RESEARCHED PUBLIC DATA" : "OPERATOR-PROVIDED INFORMATION"}</p><h2>${profile?.poolType === "private" ? "Private pool details" : "Fees, payouts & connections"}</h2><p class="small muted">${profile ? (profile.provenance === "public-research" ? "Researched by XBT Pulse from public pool websites; not submitted or confirmed through our operator program. Last checked: " : "Operator submission reviewed for publication: ") + esc(profile.reviewedAt) + ". Fee and setup information is a dated snapshot, not refreshed every 30 seconds. Confirm current terms with the pool." : "No sourced details available yet. Missing fees do not mean zero fees."}${profile?.researchNotes ? "<br>" + esc(profile.researchNotes) : ""}</p><dl class="rating-criteria">${Object.entries(
        labels,
      )
        .map(
          ([key, label]) =>
            `<dt>${label}</dt><dd>${profile?.poolType === "private" && ["fee", "payout", "minimum", "withdrawal", "setup"].includes(key) ? "Not applicable — private pool" : profile?.[key] ? (["setup", "website"].includes(key) ? `<a href="${esc(profile[key])}" rel="noopener noreferrer">${esc(profile[key])}</a>` : esc(profile[key])) : "Not provided"}</dd>`,
        )
        .join(
          "",
        )}</dl>${profile?.sources?.length ? `<p class="small">Sources: ${profile.sources.map((source) => `<a href="${esc(source.url)}" rel="noopener noreferrer">${esc(source.title)}</a>`).join(" · ")}</p>` : ""}<a href="/contribute">Submit or update this pool’s details ↗</a></section><section class="panel intake-panel"><p class="eyebrow">TRANSPARENCY & DECENTRALIZATION</p><h2>${esc(d.rating.status)}</h2><p>${esc(d.rating.evidence)}</p><p class="small muted">Publishing a profile does not award a rating. Template telemetry requires reviewed provider mappings and reporting participation.</p><h3>Template telemetry</h3>${d.telemetry.length ? d.telemetry.map((p) => `<p>${esc(p.name)} · ${esc(p.participationBadge)}<br>Last report: ${esc(new Date(p.lastReport).toLocaleString())}<br>Expected blocks: ${p.expected.toFixed(2)} · Reported found: ${p.found} · Found / expected: ${p.expected > 0 ? (p.found / p.expected).toFixed(2) : "Not available"}</p>`).join("") : "<p>No reports from reviewed, linked providers in the last 24 hours.</p>"}<p class="small muted">Telemetry is operator-reported and covers participating providers only.</p><a href="/ratings">Read the rating criteria ↗</a></section><section class="panel intake-panel"><h2>Recent attributed blocks</h2><p class="small muted">Up to 24 matching blocks from the latest ${d.sample} network blocks.</p>${d.recent.length ? d.recent.map((b) => `<p><strong>#${b.height}</strong> · ${esc(new Date(b.time * 1000).toLocaleString())}<br><span class="mono">${esc(b.hash)}</span></p>`).join("") : "<p>No attributed blocks available in this window. Unlinked attribution does not imply zero mining activity.</p>"}</section><section class="panel intake-panel"><h2>Coinbase payout recipients</h2><p class="small muted">Recipients in this pool’s attributed blocks within the latest ${d.sample} network blocks. Addresses do not establish pool ownership or template control. Amounts are observed rewards, not wallet balances.</p><div class="table-scroll"><table><thead><tr><th>Address</th><th>Blocks</th><th>Received XBT</th></tr></thead><tbody>${d.addresses.map((a) => `<tr><td class="mono">${esc(a.address)}</td><td>${a.blocks}</td><td>${a.amount.toFixed(8)}</td></tr>`).join("") || '<tr><td colspan="3">No recipients in this window.</td></tr>'}</tbody></table></div></section>`;
  } catch (e) {
    document.querySelector("#status").textContent = e.message;
    document.querySelector("#name").textContent = "Pool profile unavailable";
  }
}
load();

setInterval(() => {
  if (!document.hidden) load();
}, 30000);
