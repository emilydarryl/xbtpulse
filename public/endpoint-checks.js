const add=(parent,tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;parent.append(n);return n;};
const labels={'jobs-observed':'Mining jobs observed','dns-unavailable':'DNS lookup unavailable from test host','connection-error':'Connection failed from test host','connection-closed':'Connection closed before a job','subscription-refused':'Subscription not accepted','authorization-refused':'Authorization not accepted','no-job-observed':'No job observed within 50 seconds','response-limit':'Response exceeded pilot limit','unsupported-response':'Unrecognized response','non-public-address-refused':'Non-public destination refused'};
const date=v=>new Date(v).toLocaleString();
try{
 const response=await fetch('/endpoint-report.json',{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Results unavailable');const d=await response.json();
 const pools=d.pools,attempted=pools.filter(p=>p.runs.length),observed=pools.filter(p=>p.runs.some(r=>r.jobs.length));
 const jobs=pools.flatMap(p=>p.runs.flatMap(r=>r.jobs));
 const decoded=jobs.filter(j=>j.payoutScripts?.length);
 document.querySelector('#inspection-status').textContent=`${d.finishedAt?'Completed':'Partial run'}: ${date(d.finishedAt||d.updatedAt)}. ${attempted.length} of ${pools.length} groups tested; ${observed.length} supplied sampled jobs. This snapshot does not update automatically.`;
 const summary=document.querySelector('#inspection-summary');
 add(summary,'p',`Selection: ${d.selection.sample.toLocaleString()} network blocks, as observed ${date(d.selection.updatedAt)}. Ranked by attributed blocks, not decentralization. Unknown blocks remain in share denominators.`);
 add(summary,'p',`${jobs.filter(j=>j.format==='blake2b-commitment').length} retained jobs had short BLAKE2b commitment layouts; ${decoded.length} had decodable payout scripts. ${jobs.filter(j=>!['blake2b-commitment','serialized-coinbase'].includes(j.format)).length} had other or unsupported layouts.`);
 add(summary,'p',decoded.length?`${d.matches.length} pairs shared payout scripts in the same sampling round. Such matches do not prove proxying; inspect the JSON evidence and connection scope.`:'Payout comparisons could not be established from these sampled jobs. No conclusion about proxying or independence follows.');
 const root=document.querySelector('#inspection-results');
 for(const p of pools){
  const card=add(root,'section');card.className='panel intake-panel';
  add(card,'p',`SNAPSHOT RANK ${p.rank} · ${p.blocks} attributed blocks · ${(p.share*100).toFixed(2)}% of observations`).className='eyebrow';
  const title=add(card,'h2');const link=add(title,'a',p.name);link.href='/pool?id='+encodeURIComponent(p.id);
  add(card,'p',p.scope);
  if(p.host)add(card,'p',`Tested endpoint: ${p.host}:${p.port}`).className='mono';
  const source=add(card,'a','Published endpoint source / research starting point →');source.href=p.source;source.rel='noopener noreferrer';
  if(!p.runs.length)add(card,'p','Not tested. Missing evidence is not a failing grade.');
  for(const r of p.runs){
   const detail=add(card,'details');add(detail,'summary',`Round ${r.round}: ${labels[r.status]||r.status} · ${r.jobs.length} retained jobs`);
   add(detail,'p',`${date(r.startedAt)} – ${date(r.finishedAt)}. Subscribe accepted: ${r.subscribed?'yes':'no'}. Authorization: ${r.authorized===null?'not confirmed':r.authorized?'accepted':'not accepted'}.`);
   for(const j of r.jobs){add(detail,'p',`${date(j.observedAt)} · ${j.format} · ${j.part1Bytes??'unknown'} bytes in first work field · ${j.payoutVisibility}`);}
  }
  add(card,'p','Template control and upstream relationship: not established by this test.').className='small muted';
 }
}catch{
 document.querySelector('#inspection-status').textContent='The published results could not be loaded. Please reload or use the JSON link. No live endpoint checks run from this page.';
}
