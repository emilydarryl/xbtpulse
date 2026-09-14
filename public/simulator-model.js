export function simulate(pools,from,to,portion){
 if(!Array.isArray(pools)||pools.length<2||!Number.isFinite(portion)||portion<0||portion>100)throw Error('Choose a shift between 0 and 100 percent.');
 if(pools.some(p=>!Number.isFinite(p.share)||p.share<0)||new Set(pools.map(p=>p.id)).size!==pools.length||Math.abs(pools.reduce((s,p)=>s+p.share,0)-1)>1e-6)throw Error('Source shares are incomplete. Reload observations.');
 const source=pools.find(p=>p.id===from&&!p.unknown);
 const targets=pools.filter(p=>!p.unknown&&p.id!==from&&(to==='*'||p.id===to));
 if(!source||!targets.length)throw Error('Choose different named source and destination pools.');
 const moved=source.share*portion/100,each=moved/targets.length;
 const rows=pools.map(p=>({...p,before:p.share,after:p.share+(p.id===from?-moved:targets.some(t=>t.id===p.id)?each:0)})).sort((a,b)=>b.after-a.after||a.name.localeCompare(b.name));
 const named=rows.filter(p=>!p.unknown),beforeLeader=[...named].sort((a,b)=>b.before-a.before)[0],afterLeader=named[0];
 return {rows,moved,beforeLeader,afterLeader,targets:targets.map(t=>t.name),crossings:[.25,.33,.5].map(level=>({level,before:named.filter(p=>p.before>=level-1e-12).map(p=>p.name),after:named.filter(p=>p.after>=level-1e-12).map(p=>p.name)}))};
}
export function chartRows(result,from,to){
 const chosen=new Set([from,...(to==='*'?[]:[to]),...result.rows.filter(p=>p.unknown).map(p=>p.id),...result.rows.slice(0,8).map(p=>p.id)]);
 const rows=result.rows.filter(p=>chosen.has(p.id));const rest=result.rows.filter(p=>!chosen.has(p.id));
 if(rest.length)rows.push({name:'Other named groups ('+rest.length+')',before:rest.reduce((n,p)=>n+p.before,0),after:rest.reduce((n,p)=>n+p.after,0)});return rows;
}
