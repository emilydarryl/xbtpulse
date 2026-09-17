const root=document.querySelector('#change-summary-body');
const add=(parent,tag,text)=>{const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;};
async function refresh(){
 try{
  const r=await fetch('/api/trends',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const d=await r.json();root.replaceChildren();
  add(root,'p',d.stale?'Chain source delayed; share changes may be out of date.':'Recorded profile updates and changes between completed UTC days.');
  const list=add(root,'ul','');
  for(const p of d.summary?.profiles||[]){const li=add(list,'li','');const a=add(li,'a',p.name);a.href='/pool?id='+encodeURIComponent(p.pool)+'#pool-history';add(li,'span',` — ${p.labels.join(', ')} updated · observed ${new Date(p.time).toLocaleDateString()}${p.gap?' (after an observation gap)':''}.`);const fee=p.changes.find(c=>c.field==='fee');if(fee)add(li,'p',`Recorded fee: ${fee.before??'not recorded'} → ${fee.after??'not recorded'}`);}
  for(const p of d.summary?.shares||[]){const li=add(list,'li','');const a=add(li,'a',p.name);a.href='/pool?id='+encodeURIComponent(p.pool);add(li,'span',` — observed block share ${(p.before*100).toFixed(1)}% → ${(p.after*100).toFixed(1)}%, ${new Date(p.start).toISOString().slice(0,10)} vs ${new Date(p.end-86400000).toISOString().slice(0,10)} UTC (${p.beforeBlocks} / ${p.afterBlocks} network blocks).`);}
  if(!list.children.length)add(root,'p','No qualifying changes in the available history. Missing history does not mean nothing changed.');
 }catch{root.textContent='Change summary unavailable. Open Trends & changes for the full history.';}
}
refresh();setInterval(refresh,60000);
