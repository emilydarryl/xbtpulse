import {publicHistoryProfile} from './pool-history.mjs';
const labels={fee:'Published fee',payout:'Payout terms',protocols:'Connection options',template:'Template-control claim',assessment:'Published assessment',attributionReview:'Attribution review',sources:'Evidence sources'};
export function profileChanges(store,research,registry,now=Date.now()){
 const rows=store.db.prepare('SELECT pool,time,body FROM pool_history WHERE time>=? ORDER BY time DESC,id DESC LIMIT 500').all(now-30*86400000);
 return rows.flatMap(r=>{
  const p=publicHistoryProfile(store,r.pool,research);if(!p)return [];
  const event=JSON.parse(r.body);if(event.kind!=='change')return [];
  const changes=event.changes.filter(c=>labels[c.field]);if(!changes.length)return [];
  return [{pool:r.pool,name:p.name||registry.find(x=>x.id===r.pool)?.name||r.pool.replace(/^explorer:/,''),time:r.time,labels:changes.map(c=>labels[c.field]),changes:changes.map(c=>({field:c.field,before:c.before,after:c.after})),gap:!!event.gap}];
 }).slice(0,4);
}
export function shareChanges(daily){
 const days=daily.filter(d=>d.complete&&d.end-d.start===86400000&&d.blocks>=100).slice(-2);
 if(days.length!==2||days[0].end!==days[1].start)return [];
 const [a,b]=days,ids=new Set([...a.pools,...b.pools].filter(p=>!p.unknown).map(p=>p.id));
 return [...ids].map(id=>{const before=a.pools.find(p=>p.id===id),after=b.pools.find(p=>p.id===id);return {pool:id,name:after?.name||before.name,before:before?.share||0,after:after?.share||0,start:a.start,end:b.end,beforeBlocks:a.blocks,afterBlocks:b.blocks};}).filter(p=>Math.abs(p.after-p.before)>=.05).sort((a,b)=>Math.abs(b.after-b.before)-Math.abs(a.after-a.before)).slice(0,2);
}
