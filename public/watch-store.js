export const KEY='xbtpulse-watchlist-v1';
export function readWatch(storage=localStorage){
 const raw=storage.getItem(KEY);if(!raw)return [];
 const data=JSON.parse(raw);if(!Array.isArray(data))throw Error('Invalid saved watchlist');
 return data.filter((p,i,a)=>p&&typeof p.id==='string'&&p.id.length<=200&&typeof p.name==='string'&&a.findIndex(x=>x?.id===p.id)===i).slice(0,20);
}
export function saveWatch(rows,storage=localStorage){storage.setItem(KEY,JSON.stringify(rows));}
export function snapshot(p){return {seenAt:Date.now(),fee:p.profile?.poolType==='private'?'N/A — private pool':p.profile?.fee??'Not provided',telemetry:(p.freshness?.telemetry||[]).map(t=>t.name+': '+t.status).sort().join('; ')||'No reviewed provider link',decentralization:p.scorecard?.totals?.decentralization??null,transparency:p.scorecard?.totals?.transparency??null,assessment:p.scorecard?.publishedAt??null};}
export function changes(before,after){if(!before)return [];const labels={fee:'Fee terms',telemetry:'Telemetry status',decentralization:'Decentralization score',transparency:'Transparency score',assessment:'Published assessment'};return Object.entries(labels).filter(([key])=>before[key]!==after[key]).map(([key,label])=>label+': '+(before[key]??'Not assessed')+' → '+(after[key]??'Not assessed'));}
