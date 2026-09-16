import {readFile,writeFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('config/endpoint-pilot.json','utf8'));
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r;};
const report={observedAt:new Date().toISOString(),method:'Same ten groups as the endpoint pilot. Latest up to 24 attributed blocks returned per group; select the fewest and most distinct positive recipients (up to two examples). Check height/hash and fetch coinbase transaction from mempool.guide. Same explorer source, not independent node verification. Deliberate contrasting examples, not a random sample.',pools:[]};
for(const p of manifest.pools){
 const row={id:p.id,name:p.name,examples:[]};report.pools.push(row);
 try{
  const d=await (await get('https://xbtpulse.tech/api/pool?id='+encodeURIComponent(p.id)+'&window=2016')).json();
  row.sourceUpdatedAt=d.updatedAt;row.networkSample=d.sample;row.characteristics=d.characteristics.pool;
  const count=b=>new Set((b.outputs||[]).filter(o=>o.sats>0).map(o=>o.address)).size;
  const recent=d.recent.filter(b=>Array.isArray(b.outputs)).sort((a,b)=>count(a)-count(b)||b.height-a.height);
  row.availableRecent=recent.length;
  const selected=recent.length?[recent[0],recent.at(-1)].filter((b,i,a)=>a.findIndex(x=>x.hash===b.hash)===i):[];
  for(const b of selected){
   const example={height:b.height,hash:b.hash,blockUrl:'https://mempool.guide/block/'+b.hash};row.examples.push(example);
   try{
    const base='https://mempool.guide/api';
    const canonical=(await (await get(base+'/block-height/'+b.height)).text()).trim();
    if(canonical!==b.hash)throw Error('Explorer height/hash changed');
    const txid=(await (await get(base+'/block/'+b.hash+'/txid/0')).text()).trim();
    if(!/^[0-9a-f]{64}$/.test(txid))throw Error('Invalid transaction id');
    const tx=await (await get(base+'/tx/'+txid)).json();
    if(tx.txid!==txid||tx.vin?.length!==1||tx.vin[0].is_coinbase!==true||!Array.isArray(tx.vout))throw Error('Unsupported coinbase data');
    example.outputs=tx.vout.map(o=>({script:o.scriptpubkey,address:o.scriptpubkey_address||null,sats:o.value}));
    if(example.outputs.some(o=>typeof o.script!=='string'||!Number.isSafeInteger(o.sats)||o.sats<0))throw Error('Invalid outputs');
    const positive=example.outputs.filter(o=>o.sats>0),byScript=new Map();
    for(const o of positive)byScript.set(o.script,(byScript.get(o.script)||0)+o.sats);
    example.totalSats=positive.reduce((s,o)=>s+o.sats,0);example.positiveScripts=byScript.size;
    example.largestRecipientShare=example.totalSats?Math.max(...byScript.values())/example.totalSats:null;
    example.txid=txid;example.transactionUrl=base+'/tx/'+txid;example.status='explorer-checked';
   }catch(e){example.status='unavailable';example.error=e.message;delete example.outputs;}
  }
 }catch(e){row.error=e.message;}
 console.log(row.name,row.examples.map(e=>e.status+':'+e.positiveScripts).join(','));
}
report.finishedAt=new Date().toISOString();await writeFile('public/chain-evidence.json',JSON.stringify(report,null,2)+'\n');
