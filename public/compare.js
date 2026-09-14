import { cardSnapshot, renderCard } from "/share-card.js";
const $=s=>document.querySelector(s);
const query=new URL(location.href).searchParams;
let ids=[...new Set(query.getAll('pool').filter(id=>id&&id.length<=200))].slice(0,3);
let searchPage=1,searchRequest=0,comparisonRequest=0,timer;
let exportData=null,exportCanvas=null,exportUrl="";
$('#compare-window').value=['144','576','2016'].includes(query.get('window'))?query.get('window'):'144';
const add=(parent,tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
const text=v=>v===null||v===undefined||v===''?'Not provided':String(v);
const percent=v=>v===null||v===undefined?'Not available':(v*100).toFixed(1)+'%';
const date=v=>v ? (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v)+' (UTC date)' : new Date(v).toLocaleString()) : 'Not reviewed';
const names=new Map();
function renderSelected(){
 const root=$('#selected-pools');root.replaceChildren();
 for(const id of ids){const button=add(root,'button',(names.get(id)||id)+' ×');button.type='button';button.className='selected-pool-chip';button.setAttribute('aria-label','Remove '+(names.get(id)||id));button.addEventListener('click',()=>{ids=ids.filter(value=>value!==id);updateUrl();renderSelected();load();search();$('#compare-query').focus();});}
}
function updateUrl(){const p=new URLSearchParams();ids.forEach(id=>p.append('pool',id));p.set('window',$('#compare-window').value);history.replaceState(null,'','/compare?'+p);}
async function search(){
 const request=++searchRequest;
 const term=$('#compare-query').value.trim();
 $('#compare-results').hidden=true;$('#compare-pagination').hidden=true;
 if(!term){$('#compare-results').replaceChildren();$('#search-status').textContent=ids.length>=3?'Three pools selected. Remove one to add another.':'Type a pool name to see matches.';return;}
 $('#search-status').textContent='Searching…';
 $('#results-prev').disabled=true;$('#results-next').disabled=true;
 try {
  const r=await fetch('/api/pools?'+new URLSearchParams({q:term,page:String(searchPage)}),{signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error();const d=await r.json();if(request!==searchRequest)return;
  $('#compare-results').replaceChildren();$('#compare-results').hidden=false;$('#compare-pagination').hidden=d.pages<=1;
  for(const p of d.rows){
   const button=add($('#compare-results'),'button',(ids.includes(p.id)?'Selected: ':'Add: ')+p.name+(p.profileUrl?'':' (profile not published)'));
   button.className='quiet-button';button.type='button';button.disabled=!p.profileUrl||ids.includes(p.id)||ids.length>=3;
   button.addEventListener('click',()=>{if(ids.length>=3||ids.includes(p.id))return;ids.push(p.id);names.set(p.id,p.name);$('#compare-query').value='';searchPage=1;updateUrl();renderSelected();load();search();$('#compare-query').focus();});
  }
  $('#search-status').textContent=d.total?`${d.total} matching listings · Page ${d.page} of ${d.pages}${ids.length>=3?' · Remove a selected pool to add another.':''}`:'No matching pools. Try a shorter name.';
  $('#results-prev').disabled=searchPage<=1;$('#results-next').disabled=searchPage>=d.pages;
 }catch{if(request===searchRequest){$('#compare-results').replaceChildren();$('#search-status').textContent='Search unavailable. Please try again.';}}
}
function terms(d,key){return d.profile?.poolType==='private'&&['fee','payout','minimum','withdrawal','setup'].includes(key)?'Not applicable — private pool':text(d.profile?.[key]);}
async function load(){
 exportData=null;$("#share-card").disabled=true;
 const request=++comparisonRequest,selected=[...ids],window=$('#compare-window').value;
 if(!selected.length){$('#comparison').replaceChildren();$('#compare-status').textContent='Select two or three pools above to compare.';return;}
 $('#compare-status').textContent='Loading comparison…';
 const results=await Promise.all(selected.map(async id=>{try{const r=await fetch('/api/pool?'+new URLSearchParams({id,window}),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();return await r.json();}catch{return {id,name:id,unavailable:true};}}));
 if(request!==comparisonRequest)return;
 for(const d of results)if(!d.unavailable)names.set(d.id,d.name);renderSelected();
 const root=$('#comparison');root.replaceChildren();const table=add(root,'table');table.className='comparison-table';
 add(table,'caption',`Pool comparison — last ${Number(window).toLocaleString()} network blocks`);
 const header=add(add(table,'thead'),'tr');add(header,'th','Metric').scope='col';
 for(const d of results){const cell=add(header,'th');cell.scope='col';if(!d.unavailable){const a=add(cell,'a',d.name);a.href='/pool?id='+encodeURIComponent(d.id);}else add(cell,'span',d.name);}
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
 if(results.length>=2&&!results.some(p=>p.unavailable)){exportData={pools:results,window};$('#share-card').disabled=false;}
 const snapshots=new Set(results.filter(d=>!d.unavailable).map(d=>`${d.sample}:${d.updatedAt}`));
 $('#compare-status').textContent=`${selected.length} pool${selected.length===1?' selected — add another to compare':'s compared'}. Auto-refreshes every 30 seconds.${results.some(d=>d.unavailable)?' Some profiles could not be loaded.':''}${snapshots.size>1?' Source snapshots differ; refresh before comparing close results.':''}`;
}
$('#compare-search').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);searchPage=1;search();});
$('#compare-query').addEventListener('input',()=>{clearTimeout(timer);searchRequest++;timer=setTimeout(()=>{searchPage=1;search();},300);});
$('#results-prev').addEventListener('click',()=>{searchPage--;search();});$('#results-next').addEventListener('click',()=>{searchPage++;search();});
$('#compare-window').addEventListener('change',()=>{updateUrl();load();});$('#compare-refresh').addEventListener('click',load);
updateUrl();renderSelected();search();load();setInterval(()=>{if(!document.hidden)load();},30000);

$('#share-card').addEventListener('click',()=>{
 try {
  if(!exportData)return;
  const snapshot=cardSnapshot(exportData.pools,exportData.window);
  exportUrl=snapshot.url;exportCanvas=renderCard(snapshot);
  $('#share-card-preview').replaceChildren(exportCanvas);
  $('#share-card-link').value=exportUrl;
  $('#share-card-note').textContent='Dated snapshot. Download the PNG and attach it to Discord; paste the comparison link alongside it.';
  $('#share-card-dialog').showModal();
 }catch {$('#compare-status').textContent='Unable to prepare the image. Try refreshing the comparison.';}
});
$('#close-share-card').addEventListener('click',()=>$('#share-card-dialog').close());
$('#download-share-card').addEventListener('click',()=>{
 if(!exportCanvas)return;
 exportCanvas.toBlob(blob=>{
  if(!blob){$('#share-card-note').textContent='Image export failed. Please try again.';return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='xbtpulse-comparison-'+new Date().toISOString().slice(0,10)+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 },'image/png');
});
$('#copy-share-card-link').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(exportUrl);$('#share-card-note').textContent='Comparison link copied. Attach the PNG separately.';}
 catch{$('#share-card-link').focus();$('#share-card-link').select();$('#share-card-note').textContent='Copy the selected link manually.';}
});
