const root=document.querySelector('#shared-watch-results'),status=document.querySelector('#shared-watch-status');
const add=(p,t,v)=>{const e=document.createElement(t);if(v!==undefined)e.textContent=v;p.append(e);return e;};
const date=t=>new Date(t*1000).toLocaleString(),pct=v=>(v*100).toFixed(2)+'%';
let busy=false;
async function refresh(){
 if(busy)return;busy=true;
 const expanded=new Set([...root.querySelectorAll('details[open]')].map(e=>e.dataset.address));
 try{
  const r=await fetch('/api/shared-addresses',{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();const d=await r.json();root.replaceChildren();
  status.textContent=`${d.stale?'Source delayed':'Current retained observations'} · ${d.updatedAt?new Date(d.updatedAt).toLocaleString():'No collection yet'} · ${d.source||'Source unavailable'}. ${d.recipientCoverage.toLocaleString()} of ${d.sample.toLocaleString()} retained blocks have positive recipient data. ${d.total} overlapping recipients; showing ${d.rows.length}.`;
  for(const a of d.rows){
   const card=add(root,'details');card.dataset.address=a.address;card.open=expanded.has(a.address);card.className='panel intake-panel';
   add(card,'summary',`${a.documentedRoles.length?'Documented collection/fee recipient':a.soleRecipientBlocks?'Includes sole-recipient blocks':'Shared recipient'} · ${a.groupCount} label/tag combinations · ${a.blocks} blocks`);
   add(card,'p',a.address).className='mono recipient-full';
   add(card,'p',`First / last seen in retained blocks: ${date(a.firstSeen)} — ${date(a.lastSeen)}. Sole positive recipient in ${a.soleRecipientBlocks} blocks.`);
   for(const role of a.documentedRoles){const link=add(card,'a',`${role.pool}: documented ${role.role} address →`);link.href=role.source;}
   add(card,'p',`Showing ${a.groups.length} of ${a.groupCount} label/tag combinations, largest block counts first. Raw tag variations may include changing coinbase data, not distinct pool names.`);
   for(const g of a.groups){
    add(card,'h3',g.label);add(card,'p','Original coinbase tag: '+(g.tag||'(empty)')).className='mono recipient-full';
    add(card,'p',`${g.blocks} blocks · reward share ${pct(g.minRewardShare)}–${pct(g.maxRewardShare)} · ${date(g.firstSeen)} — ${date(g.lastSeen)}`);
    const list=add(card,'ul');for(const b of g.examples){const li=add(list,'li'),link=add(li,'a',`Block ${b.height} · ${pct(b.rewardShare)} of coinbase reward`);link.href='https://mempool.guide/block/'+encodeURIComponent(b.hash);}
   }
  }
  if(!d.rows.length)add(root,'p','No shared recipients across different source labels or tags in available retained blocks. This does not prove pools are independent.');
 }catch{status.textContent='Shared-address watch unavailable. Try again shortly.';root.replaceChildren();}finally{busy=false;}
}
refresh();setInterval(()=>{if(!document.hidden)refresh();},30000);
