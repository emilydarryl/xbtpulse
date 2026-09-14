const $=s=>document.querySelector(s);
const query=new URL(location.href).searchParams;
let ids=[...new Set(query.getAll('pool').filter(id=>id.length<=200))].slice(0,3);
let searchPage=1,searchRequest=0,comparisonRequest=0,timer;
$('#compare-window').value=['144','576','2016'].includes(query.get('window'))?query.get('window'):'144';
const add=(parent,tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
const text=v=>v===null||v===undefined||v===''?'Not provided':String(v);
const percent=v=>v===null||v===undefined?'Not available':(v*100).toFixed(1)+'%';
const date=v=>v?new Date(v).toLocaleString():'Not reviewed';
function updateUrl(){const p=new URLSearchParams();ids.forEach(id=>p.append('pool',id));p.set('window',$('#compare-window').value);history.replaceState(null,'','/compare?'+p);}
async function search(){
 const request=++searchRequest;
 $('#search-status').textContent='Searching…';
 $('#results-prev').disabled=true;$('#results-next').disabled=true;
 try {
  const r=await fetch('/api/pools?'+new URLSearchParams({q:$('#compare-query').value,page:String(searchPage)}),{signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error();const d=await r.json();if(request!==searchRequest)return;
  $('#compare-results').replaceChildren();
  for(const p of d.rows){
   const button=add($('#compare-results'),'button',(ids.includes(p.id)?'Selected: ':'Add: ')+p.name+(p.profileUrl?'':' (profile not published)'));
   button.className='quiet-button';button.type='button';button.disabled=!p.profileUrl||ids.includes(p.id)||ids.length>=3;
   button.addEventListener('click',()=>{if(ids.length>=3||ids.includes(p.id))return;ids.push(p.id);updateUrl();load();search();});
  }
  $('#search-status').textContent=d.total?`${d.total} matching listings · Page ${d.page} of ${d.pages}${ids.length>=3?' · Remove a selected pool to add another.':''}`:'No matching pools. Try a shorter name.';
  $('#results-prev').disabled=searchPage<=1;$('#results-next').disabled=searchPage>=d.pages;
 }catch{if(request===searchRequest){$('#compare-results').replaceChildren();$('#search-status').textContent='Search unavailable. Please try again.';}}
}
function terms(d,key){return d.profile?.poolType==='private'&&['fee','payout','minimum','withdrawal','setup'].includes(key)?'Not applicable — private pool':text(d.profile?.[key]);}
async function load(){
 const request=++comparisonRequest,selected=[...ids],window=$('#compare-window').value;
 if(!selected.length){$('#comparison').replaceChildren();$('#compare-status').textContent='Select two or three pools above to compare.';return;}
 $('#compare-status').textContent='Loading comparison…';
 const results=await Promise.all(selected.map(async id=>{try{const r=await fetch('/api/pool?'+new URLSearchParams({id,window}),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();return await r.json();}catch{return {id,name:id,unavailable:true};}}));
 if(request!==comparisonRequest)return;
 const root=$('#comparison');root.replaceChildren();const table=add(root,'table');table.className='comparison-table';
 add(table,'caption',`Pool comparison — last ${Number(window).toLocaleString()} network blocks`);
 const header=add(add(table,'thead'),'tr');add(header,'th','Metric').scope='col';
 for(const d of results){const cell=add(header,'th');cell.scope='col';if(!d.unavailable){const a=add(cell,'a',d.name);a.href='/pool?id='+encodeURIComponent(d.id);}else add(cell,'span',d.name);const button=add(cell,'button','Remove');button.className='quiet-button';button.setAttribute('aria-label','Remove '+d.name);button.addEventListener('click',()=>{ids=ids.filter(id=>id!==d.id);updateUrl();load();search();});}
 const body=add(table,'tbody');
 const rows=[
 ['Pool type',d=>d.profile?.poolType==='private'?'Private — not accepting miners':text(d.profile?.poolType)],
 ['Observed block share',d=>percent(d.share)],['Attributed blocks / observations',d=>`${d.blocks??'Not attributed'} / ${d.sample}`],
 ['95% interval',d=>d.interval?d.interval.map(percent).join(' – '):'Not available'],
 ['Chain data',d=>`${d.status} · ${date(d.updatedAt)}`],
 ['Fees (%) — sourced terms',d=>terms(d,'fee')],['Payout method',d=>terms(d,'payout')],['Minimum payout',d=>terms(d,'minimum')],['Withdrawal fees',d=>terms(d,'withdrawal')],
 ['Protocols — sourced claim',d=>terms(d,'protocols')],['Template role — sourced claim',d=>terms(d,'template')],['Server regions — sourced claim',d=>terms(d,'regions')],
 ['Terms provenance',d=>!d.profile?'No published terms':d.profile.provenance==='public-research'?'Public-source research':'Operator-provided; reviewed for publication'],
 ['Terms last reviewed',d=>d.profile?date(d.profile.reviewedAt):'Not reviewed'],
 ['Terms review status',d=>d.freshness?.profile.status??'Not reviewed'],
 ['Linked telemetry',d=>d.freshness?.telemetry.length?d.freshness.telemetry.map(p=>`${p.name}: ${p.status}`).join('; '):'No reviewed provider link'],
 ['Last linked report',d=>d.freshness?.telemetry.some(p=>p.lastReport)?date(Math.max(...d.freshness.telemetry.map(p=>p.lastReport||0))):'No retained reports'],
 ['Decentralization / 100',d=>d.scorecard?.totals.decentralization??'Not assessed'],['Transparency / 100',d=>d.scorecard?.totals.transparency??'Not assessed'],
 ['Assessment review status',d=>d.freshness?.assessment.status??'Not assessed'],
 ['Attribution evidence',d=>d.evidence],['Attribution review status',d=>d.freshness?.attribution.status??'Not reviewed']
 ];
 for(const [label,render] of rows){const tr=add(body,'tr');add(tr,'th',label).scope='row';for(const d of results)add(tr,'td',d.unavailable?'Unavailable — try Refresh':String(render(d)));}
 const links=add(body,'tr');add(links,'th','Sources & details').scope='row';
 for(const d of results){const td=add(links,'td');if(d.unavailable){td.textContent='Unavailable';continue;}
  const profile=add(td,'a','Full profile & evidence');profile.href='/pool?id='+encodeURIComponent(d.id);
  for(const source of d.profile?.sources||[]){try{if(new URL(source.url).protocol!=='https:')continue;}catch{continue;}add(td,'br');const a=add(td,'a',source.title||'Source');a.href=source.url;a.rel='noopener noreferrer';a.target='_blank';}
  if(d.scorecard){add(td,'br');const a=add(td,'a','Read scored evidence');a.href='/scorecard?pool='+encodeURIComponent(d.id);}
 }
 const snapshots=new Set(results.filter(d=>!d.unavailable).map(d=>`${d.sample}:${d.updatedAt}`));
 $('#compare-status').textContent=`${selected.length} pool${selected.length===1?' selected — add another to compare':'s compared'}. Auto-refreshes every 30 seconds.${results.some(d=>d.unavailable)?' Some profiles could not be loaded.':''}${snapshots.size>1?' Source snapshots differ; refresh before comparing close results.':''}`;
}
$('#compare-search').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);searchPage=1;search();});
$('#compare-query').addEventListener('input',()=>{clearTimeout(timer);searchRequest++;timer=setTimeout(()=>{searchPage=1;search();},300);});
$('#results-prev').addEventListener('click',()=>{searchPage--;search();});$('#results-next').addEventListener('click',()=>{searchPage++;search();});
$('#compare-window').addEventListener('change',()=>{updateUrl();load();});$('#compare-refresh').addEventListener('click',load);
updateUrl();search();load();setInterval(()=>{if(!document.hidden)load();},30000);
