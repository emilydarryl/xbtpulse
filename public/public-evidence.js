export function publicEvidence(windows) {
  const d=windows.find(w=>w.requested===2016)||windows.at(-1);
  const examples=(d?.recent||[]).flatMap(b=>{
    if(!Array.isArray(b.outputs)||!b.outputs.length)return [];
    if(b.outputs.some(o=>!Number.isSafeInteger(o.sats)||o.sats<0||typeof o.address!=='string'||!o.address))return [];
    const sums=new Map();for(const o of b.outputs)if(o.sats>0)sums.set(o.address,(sums.get(o.address)||0)+o.sats);
    const total=[...sums.values()].reduce((a,b)=>a+b,0);if(!total||!Number.isSafeInteger(total))return [];
    return [{height:b.height,hash:b.hash,recipients:sums.size,largestShare:Math.max(...sums.values())/total}];
  });
  return {sample:d?.sample??0,blocks:d?.blocks??null,updatedAt:d?.updatedAt??null,status:d?.status,characteristics:d?.characteristics?.pool,examples};
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function publicEvidenceSection(windows){
 const d=publicEvidence(windows),c=d.characteristics;
 const stamp=d.updatedAt?new Date(d.updatedAt).toLocaleString():'No update recorded';
 const rows=d.examples.map(b=>`<tr><td>${/^[a-f0-9]{64}$/.test(b.hash)?`<a href="https://mempool.guide/block/${b.hash}" rel="noopener noreferrer">${esc(b.height)} ↗</a>`:esc(b.height)}</td><td>${b.recipients}</td><td>${(b.largestShare*100).toFixed(2)}%</td></tr>`).join('');
 return `<section class="panel intake-panel"><p class="eyebrow">PUBLIC EVIDENCE · NO OPERATOR FEED REQUIRED</p><h2>What we can observe ourselves</h2><p>Automatically collected chain data, with ${d.status==='live'?'the latest available observations':'delayed or unavailable observations'} as of ${esc(stamp)}. Refreshes with this profile every 30 seconds; freshness depends on our upstream source.</p><p>${d.blocks===null?'Block attribution is not linked to this profile. Activity cannot be measured for this listing.':`${d.blocks} attributed blocks within the latest ${d.sample} observed network blocks.`}</p>${d.blocks!==null&&c?`<p>Recipient data covers ${c.recipients.observations} / ${c.blocks} attributed blocks: ${c.recipients.single??'unknown'} have one positive-value recipient and ${c.recipients.multiple??'unknown'} have several. Transaction-count data covers ${c.transactions.observations} / ${c.blocks} blocks.</p>`:''}<details data-profile-detail="concentration"><summary>Recent reward distribution · inspect blocks</summary><p class="small muted">Up to 24 recent attributed blocks from that window; ${d.examples.length} have usable payout amounts. Largest recipient share combines repeated outputs to the same address or script and includes fees. This is a recent sample, not a pool-wide payout audit.</p>${rows?`<div class="table-scroll profile-activity-scroll"><table><thead><tr><th>Inspect block</th><th>Positive recipients</th><th>Largest recipient share</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p>No usable recent payout examples. Missing data is not zero activity.</p>'}</details><p class="small muted">Our explorer supplies these observations and most pool labels; this is not independent full-node verification. Recipients are not people, and reward patterns do not prove template control, ownership or fair payment. Later payouts are not tracked here. Operator telemetry can add accepted-work detail, but is optional.</p></section>`;
}
