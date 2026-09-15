import {coverageLabel,outcomeLabel,coverageExplanation} from "/telemetry-context.js";
import {blockReportSection} from '/block-report-view.js';
import {readWatch,saveWatch,snapshot} from '/watch-store.js';
let watchProfile;
let firstProfileRender = true;
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
  protocols: "Mining protocols (sourced claim)",
  regions: "Server regions",
  setup: "Setup guide",
  template: "Template control (sourced claim)",
  website: "Website",
};
const id = new URL(location.href).searchParams.get("id");
document.querySelector("#miner-checker-link").href="/miner-checker"+(id?"?pool="+encodeURIComponent(id):"");
document.querySelector("#compare-pool-link").href = "/compare" + (id ? "?pool=" + encodeURIComponent(id) : "");
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
    document.querySelector("#soveroot-example").hidden = id !== "explorer:soveroot" || profile?.poolType !== "private";
    watchProfile=d;document.querySelector('#watch-pool').disabled=false;updateWatchButton();
    document.title = d.name + " · XBT Pulse";
    const scoreLink = document.querySelector("#scorecard-link");
    for (const axis of ["decentralization", "transparency"]) {
      const score = d.scorecard?.totals?.[axis];
      document.querySelector("#pool-" + axis).textContent = score == null ? "Not assessed" : `${score} / 100`;
    }
    document.querySelector("#pool-score-status").textContent = d.scorecard
      ? `Published ${new Date(d.scorecard.publishedAt).toLocaleDateString()} · Observation period: ${d.scorecard.start} to ${d.scorecard.end}. ${Date.now() - Date.parse(d.scorecard.end) > 30 * 86400000 ? "Historical assessment — review due. " : ""}Scores are scoped reviewer assessments, not mining-share rankings.`
      : "No published assessment yet. Not assessed does not mean zero. Telemetry participation and profile publication do not automatically award scores.";
    scoreLink.replaceChildren();
    scoreLink.hidden = !d.scorecard;
    if (d.scorecard) {
      const a = document.createElement("a");
      a.href = "/scorecard?pool=" + encodeURIComponent(id);
      a.textContent = "Read the assessment and evidence →";
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
      `${profile?.poolType === "private" ? `<p class="rating-badge">Private pool · Not accepting miners</p>` : profile?.poolType === "public" ? `<p class="rating-badge">Public pool</p>` : ""}<p class="small muted">Pool ID: <code>${esc(d.id)}</code> · ${esc(d.evidence)}</p>${d.assessment ? `<section class="panel intake-panel"><p class="eyebrow">OPEN REVIEW EXAMPLE</p><h2>${esc(d.assessment.status)}</h2><p>This pool is sharing its onboarding progress. Checks use real submitted evidence; this is not a completed decentralization rating.</p><dl class="rating-criteria">${d.assessment.checks.map((c) => `<dt>${esc(c.label)}</dt><dd>${esc(c.status)}</dd>`).join("")}</dl><p class="small muted">Credential access does not prove independent ownership or template control. Those require human review. Fresh work and 95% reporting coverage over 24 hours are needed for review readiness.</p><a href="/contribute">Submit your pool for assessment →</a></section>` : ""}<section class="panel intake-panel"><p class="eyebrow">OBSERVED MINING ACTIVITY</p><h2>Block production across windows</h2><p class="small muted">Auto-refreshes every 30 seconds. These overlapping windows estimate mining share from observed blocks.</p><div class="table-scroll"><table><thead><tr><th>Network window</th><th>Pool blocks</th><th>Observed share</th><th>95% interval</th></tr></thead><tbody>${windows.map((w) => `<tr><td>${w.sample} / ${w.requested} blocks</td><td>${w.blocks ?? "Not attributed"}</td><td>${pct(w.share)}</td><td>${w.interval ? w.interval.map(pct).join(" – ") : "Insufficient observations"}</td></tr>`).join("")}</tbody></table></div></section>${blockReportSection(d.blockReports)}${characteristicsSection(windows)}${freshnessSection(d)}${historySection(d)}${attributionSection(d)}<section class="panel intake-panel"><p class="eyebrow">${profile?.provenance === "public-research" ? "RESEARCHED PUBLIC DATA" : "OPERATOR-PROVIDED INFORMATION"}</p><h2>${profile?.poolType === "private" ? "Private pool details" : "Fees, payouts & connections"}</h2><p class="small muted">${profile ? (profile.provenance === "public-research" ? "Researched by XBT Pulse from public pool websites; not submitted or confirmed through our operator program. Last checked: " : "Operator submission reviewed for publication: ") + esc(profile.reviewedAt) + ". Fee and setup information is a dated snapshot, not refreshed every 30 seconds. Confirm current terms with the pool." : "No sourced details available yet. Missing fees do not mean zero fees."}${profile?.researchNotes ? "<br>" + esc(profile.researchNotes) : ""}</p><dl class="rating-criteria">${Object.entries(
        labels,
      )
        .map(
          ([key, label]) =>
            `<dt>${label}</dt><dd>${profile?.poolType === "private" && ["fee", "payout", "minimum", "withdrawal", "setup"].includes(key) ? "Not applicable — private pool" : profile?.[key] ? (["setup", "website"].includes(key) ? `<a href="${esc(profile[key])}" rel="noopener noreferrer">${esc(profile[key])}</a>` : esc(profile[key])) : "Not provided"}</dd>`,
        )
        .join(
          "",
        )}</dl>${profile?.sources?.length ? `<p class="small">Sources: ${profile.sources.map((source) => `<a href="${esc(source.url)}" rel="noopener noreferrer">${esc(source.title)}</a>`).join(" · ")}</p>` : ""}<a href="/contribute">Submit or update this pool’s details ↗</a></section><section class="panel intake-panel"><p class="eyebrow">TRANSPARENCY & DECENTRALIZATION</p><h2>${esc(d.rating.status)}</h2><p>${esc(d.rating.evidence)}</p><p class="small muted">Publishing a profile does not award a rating. Template telemetry requires reviewed provider mappings and reporting participation.</p><h3>Accepted-work telemetry · last 24 hours</h3>${d.telemetry.length ? d.telemetry.map((p) => `<p>${esc(p.name)} · ${esc(p.participationBadge)}${p.stale ? " · report delayed" : ""}<br>${esc(coverageLabel(p))}<br>${esc(outcomeLabel(p))}<br>Last report: ${esc(new Date(p.lastReport).toLocaleString())}<br>Expected blocks: ${p.expected.toFixed(2)} · Reported found: ${p.found == null ? "Not available" : p.found} · Found / expected: ${p.found != null && p.expected > 0 ? (p.found / p.expected).toFixed(2) : "Not available"}</p>`).join("") : "<p>No reports from reviewed, linked providers in the last 24 hours.</p>"}<p class="small muted">${esc(coverageExplanation)}</p><a href="/ratings">Read the rating criteria ↗</a></section><section class="panel intake-panel"><h2 id="recent-blocks-title">Recent attributed blocks</h2><p class="small muted">Newest first · up to 24 matching blocks from the latest ${d.sample} network blocks. Scroll to see more.</p>${d.recent.length ? `<div class="table-scroll profile-activity-scroll" role="region" aria-labelledby="recent-blocks-title" tabindex="0"><table><thead><tr><th>Block</th><th>Time</th><th>Block hash</th></tr></thead><tbody>${d.recent.map((b) => `<tr><td><strong>#${b.height}</strong></td><td>${esc(new Date(b.time * 1000).toLocaleString())}</td><td class="mono">${esc(b.hash)}</td></tr>`).join("")}</tbody></table></div>` : "<p>No attributed blocks available in this window. Unlinked attribution does not imply zero mining activity.</p>"}</section><section class="panel intake-panel"><h2 id="pool-recipients-title">Coinbase payout recipients</h2><p class="small muted">Recipients in this pool’s attributed blocks within the latest ${d.sample} network blocks. Addresses do not establish pool ownership or template control. Amounts are observed rewards, not wallet balances. Scroll to see more.</p><div class="table-scroll profile-activity-scroll" role="region" aria-labelledby="pool-recipients-title" tabindex="0"><table><thead><tr><th>Address</th><th>Blocks</th><th>Received XBT</th></tr></thead><tbody>${d.addresses.map((a) => `<tr><td class="mono">${esc(a.address)}</td><td>${a.blocks}</td><td>${a.amount.toFixed(8)}</td></tr>`).join("") || '<tr><td colspan="3">No recipients in this window.</td></tr>'}</tbody></table></div></section>`;
    if (firstProfileRender && location.hash === '#reported-blocks') document.querySelector('#reported-blocks')?.scrollIntoView();
    firstProfileRender = false;
  } catch (e) {
    for (const axis of ["decentralization", "transparency"]) document.querySelector("#pool-" + axis).textContent = "Unavailable";
    document.querySelector("#pool-score-status").textContent = "Unable to load the published assessment. Please try again.";
    document.querySelector("#scorecard-link").hidden = true;
    document.querySelector("#status").textContent = e.message;
    document.querySelector("#name").textContent = "Pool profile unavailable";
  }
}
load();

setInterval(() => {
  if (!document.hidden) load();
}, 30000);

function updateWatchButton(){try{const active=readWatch().some(p=>p.id===id);document.querySelector('#watch-pool').textContent=active?'★ Watching · remove':'☆ Watch this pool';document.querySelector('#watch-pool').setAttribute('aria-pressed',String(active));}catch{document.querySelector('#watch-note').textContent='Browser storage is unavailable or the saved watchlist is invalid.';}}
document.querySelector('#watch-pool').addEventListener('click',()=>{try{let rows=readWatch();if(rows.some(p=>p.id===id))rows=rows.filter(p=>p.id!==id);else{if(rows.length>=20)throw Error('Your watchlist holds up to 20 pools. Remove one before adding another.');rows.push({id,name:watchProfile.name,last:snapshot(watchProfile)});}saveWatch(rows);updateWatchButton();document.querySelector('#watch-note').textContent='Watchlist saved in this browser.';}catch(e){document.querySelector('#watch-note').textContent=e.message||'Unable to save watchlist.';}});
window.addEventListener('storage',updateWatchButton);

function historySection(d){const h=d.history;if(!h)return '';const labels={fee:'Fee terms',payout:'Payout policy',template:'Template-control claim',protocols:'Protocol claim',profileReview:'Profile review date',assessment:'Published assessment',telemetry:'Telemetry status',attributionReview:'Attribution review date',sources:'Profile sources'};const format=v=>v===null?'Not provided / not assessed':Array.isArray(v)?(v.length?v.map(x=>x.status?x.name+': '+x.status:x.title+' ('+x.url+')').join('; '):'None published'):typeof v==='object'?'Published '+new Date(v.publishedAt).toLocaleString()+'; decentralization '+(v.decentralization??'Not assessed')+'; transparency '+(v.transparency??'Not assessed'):String(v);return `<section class="panel intake-panel" id="pool-history"><p class="eyebrow">PUBLIC OBSERVATION HISTORY</p><h2>What changed?</h2><p class="small muted">Tracking began ${h.startedAt?esc(new Date(h.startedAt).toLocaleString()):'not yet'}. Last observed ${h.lastObserved?esc(new Date(h.lastObserved).toLocaleString()):'not yet'}. Latest ${h.events.length} of ${h.total} events retained for ${h.retentionDays} days. Times indicate when XBT Pulse observed a value, not when the operator changed it. Changes between observations may be missed.</p>${h.events.length?h.events.map(e=>`<details><summary>${esc(new Date(e.time).toLocaleString())} · ${e.kind==='baseline'?'First observed baseline':e.changes.length?e.changes.map(c=>esc(labels[c.field]||c.field)).join(', '):'Observation resumed after a gap'}</summary>${e.gap?`<p>Observation gap: ${esc(new Date(e.gap.from).toLocaleString())} – ${esc(new Date(e.gap.to).toLocaleString())}. Exact change times are unknown.</p>`:''}<ul>${e.changes.map(c=>`<li><strong>${esc(labels[c.field]||c.field)}</strong>: ${e.kind==='baseline'?'':esc(format(c.before))+' → '}${esc(format(c.after))}</li>`).join('')}</ul><p class="small muted">${esc(e.sources.provenance)} · Review date: ${esc(e.sources.reviewedAt||'Not available')}. Evidence describes public claims; telemetry does not prove template independence.</p>${e.sources.links.map(l=>`<p><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.title)}</a></p>`).join('')}</details>`).join(''):'<p>No history captured yet. Collection starts with a baseline; earlier changes are not reconstructed.</p>'}</section>`;}

function characteristicsSection(windows){if(windows[0]?.blocks==null)return '<section class="panel intake-panel"><h2>Block characteristics</h2><p>Pool block attribution is not linked, so pool characteristics are not available. This does not mean this pool produced zero blocks. Individual operator-reported finds appear separately above.</p></section>';const number=v=>v==null?'Not available':Number(v).toLocaleString(undefined,{maximumFractionDigits:1});const metric=(v,suffix='')=>number(v.average)+ (v.average==null?'':suffix)+` (${v.observations} measured)`;return `<section class="panel intake-panel"><p class="eyebrow">PUBLIC BLOCK OBSERVATIONS · NO POOL TELEMETRY REQUIRED</p><h2>Block characteristics</h2><p>Compare blocks attributed to this pool with all network blocks in the same window. Network figures include this pool.</p>${windows.map((w,i)=>{const c=w.characteristics;if(!c)return '';const row=(label,f)=>`<tr><th>${label}</th><td>${esc(f(c.pool))}</td><td>${esc(f(c.network))}</td></tr>`;return `<details ${i===0?'open':''}><summary>Last ${w.requested.toLocaleString()} network blocks · ${c.pool.blocks} pool / ${c.network.blocks} network observed</summary><div class="table-scroll"><table><thead><tr><th>Metric</th><th>This pool</th><th>Network</th></tr></thead><tbody>${row('Average transactions incl. coinbase',x=>metric(x.transactions))}${row('Average block size',x=>metric(x.sizeBytes,' bytes'))}${row('Average block weight',x=>metric(x.weight,' WU'))}${row('Coinbase-only blocks',x=>x.coinbaseOnly.share===null?'Not available':x.coinbaseOnly.count+' / '+x.coinbaseOnly.observations+' ('+(x.coinbaseOnly.share*100).toFixed(1)+'%)')}${row('Average positive-value recipients',x=>metric(x.recipients))}${row('Single-recipient blocks',x=>x.recipients.single===null?'Not available':x.recipients.single+' / '+x.recipients.observations)}${row('Multiple-recipient blocks',x=>x.recipients.multiple===null?'Not available':x.recipients.multiple+' / '+x.recipients.observations)}</tbody></table></div></details>`;}).join('')}<p class="small muted">Counts beside each metric show its available coverage. Older metadata is being filled in; missing fields are not zero. Recipients are distinct positive-value addresses/scripts per coinbase, not people. Coinbase-only means no ordinary transactions; it does not establish censorship or misconduct. Block weight is shown in weight units, not an assumed percentage of this fork’s limit. These observations do not award a rating or prove template independence.</p></section>`;}
