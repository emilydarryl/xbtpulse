const root=document.querySelector('#shared-watch-results'),status=document.querySelector('#shared-watch-status');
const add=(p,t,v)=>{const e=document.createElement(t);if(v!==undefined)e.textContent=v;p.append(e);return e;};
const date=t=>new Date(t*1000).toLocaleString(),pct=v=>(v*100).toFixed(2)+'%';
const query=document.querySelector('#watch-query'),type=document.querySelector('#watch-type'),share=document.querySelector('#watch-share');
const initial=new URL(location.href).searchParams;
query.value=initial.get('q')||'';type.value=['documented','unclassified'].includes(initial.get('type'))?initial.get('type'):'all';share.value=['50','90','100'].includes(initial.get('share'))?initial.get('share'):'0';
let page=1,exact=initial.get('address')||'',controller;
function params(){const p=new URLSearchParams({q:query.value,type:type.value,share:share.value,page:String(page)});if(exact)p.set('address',exact);return p;}

async function refresh(updateURL=false){
 controller?.abort();controller=new AbortController();const current=controller;
 const timeout=setTimeout(()=>current.abort(),20000);
 const p=params();if(updateURL)history.replaceState(null,'','/endpoint-checks?'+p+'#shared-address-watch');
 document.querySelector('#watch-exact').textContent=exact?'Showing a linked address. Clear to search all recipients.':'';
 const expanded=new Set([...root.querySelectorAll('details[open]')].map(e=>e.dataset.address));
 try{
  const r=await fetch('/api/shared-addresses?'+p,{signal:current.signal});if(!r.ok)throw Error();const d=await r.json();if(controller!==current)return;root.replaceChildren();page=d.page;document.querySelector("#watch-page").textContent=`Page ${d.page} of ${d.pages||1}`;document.querySelector("#watch-prev").disabled=page<=1;document.querySelector("#watch-next").disabled=page>=d.pages;
  status.textContent=`${d.stale?'Source delayed':'Current retained observations'} · ${d.updatedAt?new Date(d.updatedAt).toLocaleString():'No collection yet'} · ${d.source||'Source unavailable'}. ${d.recipientCoverage.toLocaleString()} of ${d.sample.toLocaleString()} retained blocks have positive recipient data. ${d.total} matching recipients out of ${d.allMatches}; showing ${d.rows.length}.`;
  for(const a of d.rows){
   const card=add(root,'details');card.dataset.address=a.address;card.open=expanded.has(a.address)||exact===a.address;card.className='panel intake-panel';
   add(card,'summary',`${a.documentedRoles.length?'Documented collection/fee recipient':a.soleRecipientBlocks?'Includes sole-recipient blocks':'Shared recipient'} · ${a.groupCount} label/tag combinations · ${a.blocks} blocks`);
   const permalink=add(card,'a','Link to this finding →');permalink.href='/endpoint-checks?'+new URLSearchParams({address:a.address})+'#shared-address-watch';
   add(card,'p',a.address).className='mono recipient-full';
   add(card,'p',`First / last seen in retained blocks: ${date(a.firstSeen)} — ${date(a.lastSeen)}. Sole positive recipient in ${a.soleRecipientBlocks} blocks.`);
   for(const role of a.documentedRoles){const link=add(card,'a',`${role.pool}: documented ${role.role} address →`);link.href=role.source;}
   add(card,'p',`Showing ${a.groups.length} of ${a.groupCount} label/tag combinations, matching label/tag text first, then largest block counts. Raw tag variations may include changing coinbase data, not distinct pool names.`);
   for(const g of a.groups){
    add(card,'h3',g.label);add(card,'p','Original coinbase tag: '+(g.tag||'(empty)')).className='mono recipient-full';
    add(card,'p',`${g.blocks} blocks · reward share ${pct(g.minRewardShare)}–${pct(g.maxRewardShare)} · ${date(g.firstSeen)} — ${date(g.lastSeen)}`);
    const list=add(card,'ul');for(const b of g.examples){const li=add(list,'li'),link=add(li,'a',`Block ${b.height} · ${pct(b.rewardShare)} of coinbase reward`);link.href='https://mempool.guide/block/'+encodeURIComponent(b.hash);}
   }
  }
  if(!d.rows.length)add(root,'p','No shared recipients across different source labels or tags in available retained blocks. This does not prove pools are independent.');
 }catch{if(controller!==current)return;status.textContent='Shared-address watch unavailable. Try again shortly.';root.replaceChildren();}finally{clearTimeout(timeout);}
}
document.querySelector('#shared-watch-filter').addEventListener('submit',e=>{e.preventDefault();exact='';page=1;refresh(true);});
document.querySelector('#watch-reset').addEventListener('click',()=>{query.value='';type.value='all';share.value='0';exact='';page=1;refresh(true);});
document.querySelector('#watch-prev').addEventListener('click',()=>{page=Math.max(1,page-1);refresh(true);});
document.querySelector('#watch-next').addEventListener('click',()=>{page++;refresh(true);});
refresh();setInterval(()=>{if(!document.hidden)refresh();},30000);
