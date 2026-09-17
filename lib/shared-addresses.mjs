// Exact public recipients only. Preserve source labels/tags before local attribution.
export function sharedAddresses(blocks, registry = [], limit = 100) {
 const addresses = new Map(); let covered = 0;
 for (const b of blocks) {
  const positive = (b.outputs || []).filter(o => Number.isSafeInteger(o.sats) && o.sats > 0 && typeof o.address === 'string' && o.address);
  if (!positive.length) continue;
  covered++;
  const amounts = new Map(); let total = 0;
  for (const o of positive) { amounts.set(o.address,(amounts.get(o.address)||0)+o.sats); total+=o.sats; }
  const label=b.reportedPool?.name || 'Unknown source label', tag=b.tag || '';
  const key=JSON.stringify([b.reportedPool?.slug || '',label,tag]);
  for (const [address,sats] of amounts) {
   if (!addresses.has(address)) addresses.set(address,{address,blocks:0,firstSeen:b.time,lastSeen:b.time,groups:new Map(),soleRecipientBlocks:0});
   const a=addresses.get(address);a.blocks++;a.firstSeen=Math.min(a.firstSeen,b.time);a.lastSeen=Math.max(a.lastSeen,b.time);
   if(amounts.size===1)a.soleRecipientBlocks++;
   if(!a.groups.has(key))a.groups.set(key,{label,tag,blocks:0,firstSeen:b.time,lastSeen:b.time,minRewardShare:1,maxRewardShare:0,examples:[]});
   const g=a.groups.get(key);g.blocks++;g.firstSeen=Math.min(g.firstSeen,b.time);g.lastSeen=Math.max(g.lastSeen,b.time);g.minRewardShare=Math.min(g.minRewardShare,sats/total);g.maxRewardShare=Math.max(g.maxRewardShare,sats/total);
   g.examples.push({height:b.height,hash:b.hash,time:b.time,rewardShare:sats/total});g.examples.sort((x,y)=>y.height-x.height);g.examples.length=Math.min(g.examples.length,3);
  }
 }
 const rows=[...addresses.values()].filter(a=>a.groups.size>1).map(a=>({...a,documentedRoles:registry.flatMap(p=>(p.addresses||[]).filter(r=>r.address===a.address&&r.source&&['collection','fee'].includes(r.role)).map(r=>({pool:p.name,role:r.role,source:r.source}))),groups:[...a.groups.values()].sort((x,y)=>y.blocks-x.blocks)}));
 rows.sort((a,b)=>Number(!!b.documentedRoles.length)-Number(!!a.documentedRoles.length)||b.soleRecipientBlocks-a.soleRecipientBlocks||b.lastSeen-a.lastSeen||b.blocks-a.blocks||a.address.localeCompare(b.address));
 return {sample:blocks.length,recipientCoverage:covered,total:rows.length,rows:rows.slice(0,limit).map(a=>({...a,groupCount:a.groups.length,groups:a.groups.slice(0,30)})),limit};
}
