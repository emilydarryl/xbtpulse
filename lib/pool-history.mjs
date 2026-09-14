import {evidenceFreshness} from './evidence-freshness.mjs';
import {publicScorecard} from './scorecards.mjs';
const DAY=86400000;
export function initializePoolHistory(store){store.db.exec(`CREATE TABLE IF NOT EXISTS pool_history_state(pool TEXT PRIMARY KEY, observed INTEGER NOT NULL, started INTEGER NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS pool_history(id INTEGER PRIMARY KEY, pool TEXT NOT NULL, time INTEGER NOT NULL, body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS pool_history_lookup ON pool_history(pool,time);`);}
export function publicHistoryProfile(store,id,research){const p=store.get('pool-profile:'+id);if(p?.applicationId){const a=store.applications().find(a=>a.id===p.applicationId);if(a?.body.profileConsent!==true||a.status!=='approved')return null;}return p||research[id]||null;}
export function recordPoolHistory(store,id,fields,sources,now=Date.now(),gapMs=180000){
 const old=store.db.prepare('SELECT * FROM pool_history_state WHERE pool=?').get(id),before=old?JSON.parse(old.body):null;
 const changes=Object.keys(fields).filter(k=>!before||JSON.stringify(before[k])!==JSON.stringify(fields[k])).map(field=>({field,before:before?.[field]??null,after:fields[field]}));
 const gap=old&&now-old.observed>gapMs?{from:old.observed,to:now}:null;
 if(changes.length||gap)store.db.prepare('INSERT INTO pool_history(pool,time,body) VALUES (?,?,?)').run(id,now,JSON.stringify({kind:old?'change':'baseline',changes,sources,gap}));
 store.db.prepare('INSERT INTO pool_history_state(pool,observed,started,body) VALUES (?,?,?,?) ON CONFLICT(pool) DO UPDATE SET observed=excluded.observed,body=excluded.body').run(id,now,old?.started||now,JSON.stringify(fields));
}
export function capturePoolHistory(store,registry,research,now=Date.now(),gapMs=180000){
 const ids=new Set([...Object.keys(research),...registry.map(p=>p.id),...store.db.prepare("SELECT key FROM meta WHERE key LIKE 'pool-profile:%'").all().map(r=>r.key.slice(13))]);
 store.db.exec('BEGIN IMMEDIATE');try{
 for(const id of ids){const p=publicHistoryProfile(store,id,research);if(!p)continue;
 const card=publicScorecard(store,id),rule=registry.find(r=>r.id===id);
 const providers=(rule?.providerIds||[]).map(name=>({name,active:!!store.db.prepare('SELECT active FROM providers WHERE id=?').get(name)?.active,...store.db.prepare("SELECT MAX(end) AS lastReport, MAX(CASE WHEN json_extract(body,'$.work')>0 THEN end END) AS lastWorkReport FROM telemetry WHERE provider=?").get(name)}));
 const telemetry=evidenceFreshness({providers},now).telemetry.map(t=>({name:t.name,status:t.status})).sort((a,b)=>a.name.localeCompare(b.name));
 const fields={fee:p.poolType==='private'?'Not applicable — private pool':p.fee||null,payout:p.poolType==='private'?'Not applicable — private pool':p.payout||null,template:p.template||null,protocols:p.protocols||null,profileReview:p.reviewedAt||null,assessment:card?{publishedAt:card.publishedAt,decentralization:card.totals?.decentralization??null,transparency:card.totals?.transparency??null}:null,telemetry,attributionReview:rule?.attributionReview?.reviewedAt||null};
 const sources=(p.sources||[]).filter(s=>{try{const u=new URL(s.url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}).map(s=>({title:s.title||'Public source',url:s.url}));
 fields.sources=sources;recordPoolHistory(store,id,fields,{provenance:p.provenance==='public-research'?'Public research':'Published operator profile',reviewedAt:p.reviewedAt||null,links:sources},now,gapMs);
 }
 store.db.prepare('DELETE FROM pool_history WHERE time < ?').run(now-90*DAY);store.db.exec('COMMIT');
 }catch(e){store.db.exec('ROLLBACK');throw e;}
}
export function poolHistory(store,id,research,now=Date.now()){
 if(!publicHistoryProfile(store,id,research))return null;
 const state=store.db.prepare('SELECT observed,started FROM pool_history_state WHERE pool=?').get(id);
 const count=store.db.prepare('SELECT COUNT(*) AS n FROM pool_history WHERE pool=? AND time>=?').get(id,now-90*DAY).n;
 return {startedAt:state?.started??null,lastObserved:state?.observed??null,retentionDays:90,total:count,limit:50,events:store.db.prepare('SELECT time,body FROM pool_history WHERE pool=? AND time>=? ORDER BY id DESC LIMIT 50').all(id,now-90*DAY).map(r=>({time:r.time,...JSON.parse(r.body)}))};
}
