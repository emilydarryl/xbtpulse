const $=id=>document.getElementById(id),labels={mining:'Mining & hardware',electronics:'Electronics',digital:'Digital goods',services:'Services',other:'Other goods'};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let page=1;const pageSize=12;
let sellerProfile=null;
let listings=[],privateId='',privateToken='',submission=null,privateUrl='';
async function api(path,{body,token}={}){const r=await fetch('/api/market/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(sellerProfile&&path==='listings'&&body?{'X-Market-Seller-Key':sellerProfile.token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),cache:'no-store'});const d=await r.json();if(!r.ok){const e=Error(d.error||'Request failed.');e.status=r.status;throw e;}return d;}
function render(){
  const f=new FormData($('filters')),q=String(f.get('q')||'').toLowerCase(),category=f.get('category');
  const rows=listings.filter(l=>(!category||l.category===category)&&[l.title,l.description,l.region,l.seller].join(' ').toLowerCase().includes(q));
  $('listing-count').textContent=`${listings.length} live offer${listings.length===1?'':'s'}`;
  $('empty').hidden=listings.length>0;$('market-status').textContent=listings.length&&!rows.length?'No matching offers. Try another category or search.':'';
  const pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages);
  $('page-status').textContent=`Page ${page} of ${pages}`;$('previous-page').disabled=page===1;$('next-page').disabled=page===pages;
  $('listing-grid').replaceChildren(...rows.slice((page-1)*pageSize,page*pageSize).map(l=>{
    const card=el('article',undefined,'listing');card.id='listing-'+l.id;
    card.append(el('p',labels[l.category],'eyebrow'),el('h3',l.title),el('p',l.price+' XBT','price'),el('p',`${l.delivery==='digital'?'Digital / remote':l.delivery==='pickup'?'Pickup':'Shipping'} · ${l.region}`));
    const details=el('details'),summary=el('summary','Offer details');details.append(summary,el('p',l.description,'description'));card.append(details);
    card.append(el('p','Seller: '+l.seller),el('p',`Listed ${new Date(l.created).toLocaleDateString()} · Expires ${new Date(l.expires).toLocaleDateString()}`,'small'));
    if(l.profileId){const profile=el('a','Seller profile','button');profile.href='/market/profile?id='+encodeURIComponent(l.profileId);const request=el('a','Request this offer','button primary');request.href='/market/order?listing='+encodeURIComponent(l.id);card.append(profile,request);}
    const a=el('a','Contact seller ↗','button');a.href=l.contact.startsWith('https://')?l.contact:'mailto:'+encodeURIComponent(l.contact);a.rel='noopener noreferrer';if(l.contact.startsWith('https://'))a.target='_blank';card.append(a,el('p','Listing ID: '+l.id,'small'));return card;
  }));
}
async function load(){if(!$('filters'))return;try{const d=await api('listings');listings=d.listings;render();}catch{$('listing-count').textContent='Offers unavailable';$('empty').hidden=true;$('market-status').textContent='Unable to load offers. Please refresh in a moment.';}}
if($('filters')){const reset=()=>{page=1;render();};$('filters').addEventListener('submit',e=>{e.preventDefault();reset();});$('filters').elements.category.addEventListener('change',reset);for(const [id,delta] of [['previous-page',-1],['next-page',1]])$(id).addEventListener('click',()=>{page+=delta;render();$('browse').scrollIntoView();});}
async function manage(action){
  try{const d=await api(action?'manage':'manage?id='+encodeURIComponent(privateId),{token:privateToken,...(action?{body:{id:privateId,action}}:{})});
    $('manage').hidden=false;$('manage-status').textContent=`${d.title} — ${d.expired?'expired':d.status}. ${d.status==='pending'?'Your offer is awaiting review and is not public.':''}`;
    const closed=d.expired||!['pending','published'].includes(d.status);$('sold').hidden=closed;$('withdraw').hidden=closed;if(action)await load();
  }catch(e){$('manage').hidden=false;$('manage-status').textContent=e.message;$('sold').hidden=true;$('withdraw').hidden=true;}
}
$('listing-form')?.addEventListener('submit',async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;
  const data=Object.fromEntries(new FormData(e.target));data.consent=e.target.elements.consent.checked;if(sellerProfile)data.profileId=sellerProfile.id;
  if(!submission)submission={id:crypto.randomUUID(),token:Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join(''),body:data};
  // Keep the exact request for retries after an ambiguous network response.
  try{await api('listings',{body:{...submission.body,id:submission.id},token:submission.token});
    privateId=submission.id;privateToken=submission.token;privateUrl=location.origin+'/market/manage#manage='+privateId+':'+privateToken;
    $('private-link').value=privateUrl;$('private-link-box').hidden=false;
    $('submit-status').textContent='Submitted for review. Save your private management link below.';e.target.reset();submission=null;await manage();$('manage').scrollIntoView({behavior:'smooth'});
  }catch(e){if(e.status&&e.status<500){submission=null;$('submit-status').textContent=e.message;}else{$('submit-status').textContent=e.message+' Your original submission is kept for retry; reload to start a different submission.';}}
  finally{button.disabled=false;}
});
$('copy-link')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(privateUrl);$('copy-link').textContent='Copied';}catch{$('private-link').select();$('copy-link').textContent='Select and copy the link above';}});
for(const action of ['sold','withdraw'])$(action)?.addEventListener('click',()=>{if(confirm(action==='sold'?'Mark this offer sold and remove it from the public board?':'Withdraw this offer from review or the public board?'))manage(action==='withdraw'?'withdrawn':'sold');});
const fragment=location.hash.match(/^#manage=([a-f0-9-]{36}):([a-f0-9]{64})$/);
if(fragment&&!$('manage')){location.replace('/market/manage'+location.hash);}else if(fragment){privateId=fragment[1];privateToken=fragment[2];history.replaceState(null,'',location.pathname+location.search+'#manage');manage();}
// Preserve existing section bookmarks after splitting the original page.
if(location.pathname==='/market'||location.pathname==='/'){const section=location.hash.slice(1);if(['browse','how','sell','rules'].includes(section))location.replace('/market/'+section);}
load();
setInterval(()=>{if(!document.hidden)load();},60000);

const sellerFragment=location.hash.match(/^#seller=([a-f0-9-]{36}):([a-f0-9]{64})$/);
if(sellerFragment&&$('listing-form')){sellerProfile={id:sellerFragment[1],token:sellerFragment[2]};history.replaceState(null,'',location.pathname);api('seller?id='+encodeURIComponent(sellerProfile.id),{token:sellerProfile.token}).then(d=>{$('listing-form').elements.seller.value=d.profile.name;$('listing-form').elements.seller.defaultValue=d.profile.name;for(const a of document.querySelectorAll('header a[href="/market/seller"]'))a.href='/market/seller#seller='+sellerProfile.id+':'+sellerProfile.token;$('listing-form').elements.seller.readOnly=true;$('seller-profile-note').textContent='Linked to seller profile: '+d.profile.name;}).catch(e=>{$('seller-profile-note').textContent=e.message;});}

window.addEventListener('hashchange',()=>{if(/^#(seller|manage)=/.test(location.hash))location.reload();});
