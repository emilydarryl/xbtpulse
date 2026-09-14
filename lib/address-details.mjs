import {attribute} from './analytics.mjs';
export function addressDetails(blocks,address,registry=[],limit=144){
 const matching=blocks.filter(b=>b.outputs.some(o=>o.address===address));if(!matching.length)return null;
 const selected=new Set(blocks.slice(0,limit).map(b=>b.hash));
 const records=matching.map(b=>{const outputs=b.outputs.filter(o=>o.address===address),pool=attribute(b,registry);return {height:b.height,hash:b.hash,time:b.time,tag:b.tag,sats:outputs.reduce((n,o)=>n+o.sats,0),outputs:outputs.length,pool:{id:pool.id,name:pool.name,unknown:!!pool.unknown},inWindow:selected.has(b.hash)};});
 const aggregate=rows=>({blocks:rows.length,outputs:rows.reduce((n,r)=>n+r.outputs,0),sats:rows.reduce((n,r)=>n+r.sats,0),first:rows.length?Math.min(...rows.map(r=>r.time)):null,last:rows.length?Math.max(...rows.map(r=>r.time)):null});
 const groups=new Map();for(const r of records){if(!groups.has(r.pool.id))groups.set(r.pool.id,{...r.pool,blocks:0,sats:0});const g=groups.get(r.pool.id);g.blocks++;g.sats+=r.sats;}
 const roles=registry.flatMap(p=>(p.addresses||[]).filter(a=>a.address===address).map(a=>({pool:p.name,role:a.role,source:a.source||null})));
 return {address,window:{...aggregate(records.filter(r=>r.inWindow)),sample:Math.min(limit,blocks.length),requested:limit},retained:{...aggregate(records),sample:blocks.length},roles,groups:[...groups.values()].sort((a,b)=>b.blocks-a.blocks),recent:records.sort((a,b)=>b.height-a.height).slice(0,20)};
}
