const root=document.querySelector('#chain-evidence');
const add=(parent,tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;parent.append(e);return e;};
const claims={
 'explorer:alphapool':{text:'The website describes PPLNS payouts after 100-confirmation maturity and a pool-node-built template on the direct mining path.',url:'https://knots.alphapool.tech/',question:'Can you publish payout transaction links tied to the originating rewards and clarify template control for each offered path?'},
 'explorer:bitcoinxor':{text:'The website lists separate legacy solo and shared coinbase payouts. It currently advertises 1% for own-template DATUM and 2% for the pooled template path.',url:'https://xorpool.com/',question:'Can you identify which attributed blocks belong to solo versus shared services and publish the gateway/pool fee breakdown over the work window?'},
 'explorer:b2pool':{text:'The website describes separate shared TIDES and solo services, with a zero-fee DATUM port and pool-node templates on the direct mining path.',url:'https://b2pool.io/',question:'Can you map attributed blocks to shared versus solo services and supply payout transactions showing how shared rewards reach miners?'}
};
try{
 const response=await fetch('/chain-evidence.json',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();const d=await response.json();
 add(root,'p',`Explorer checks completed ${new Date(d.finishedAt).toLocaleString()}. These block observations were collected separately from the earlier endpoint snapshot.`);
 add(root,'p',d.method);
 for(const p of d.pools){
  const card=add(root,'section');card.className='panel intake-panel';add(card,'h3',p.name);
  const c=claims[p.id];
  add(card,'h4','Published claim');
  add(card,'p',c?c.text:'No current payout/template claim was verified in this follow-up. The explorer label alone does not establish an operator or service.');
  if(c){const a=add(card,'a','Operator source · reviewed September 16, 2026');a.href=c.url;}
  add(card,'h4','Observed block evidence');
  if(p.error)add(card,'p','Evidence unavailable: '+p.error);
  for(const b of p.examples){
   const line=add(card,'p'),a=add(line,'a',`Block ${b.height}`);a.href=b.blockUrl;
   add(line,'span',b.status==='explorer-checked'?` — ${b.positiveScripts} distinct positive-value scripts; largest recipient ${(b.largestRecipientShare*100).toFixed(2)}% of the coinbase value.`:' — transaction check unavailable.');
   if(b.transactionUrl){const tx=add(card,'a','Inspect coinbase transaction JSON →');tx.href=b.transactionUrl;}
  }
  if(!p.examples.length&&!p.error)add(card,'p','No eligible recent block examples available.');
  if(p.id==='explorer:alphapool'){
   const heading=add(card,'h4');
   const flag=add(heading,'img');flag.src='/red-flag.svg';flag.alt='Red flag: finding to review';flag.width=28;flag.height=28;flag.style.verticalAlign='middle';flag.style.marginRight='0.4em';
   heading.append(document.createTextNode('Shared reward address across coinbase names'));
   add(card,'p','Checked September 17, 2026: a scan of all 3,068 confirmed transactions returned for the address below found 1,961 coinbase transactions, spanning block heights 964368–972623. Of these, 1,877 contained AlphaPool, 42 contained CEO of LukeCoin, and 42 contained Test. All paid this same address. This address-history check was not limited to the ten groups in the endpoint pilot.');
   const recipient=add(card,'p','bc1qlrmjpgg0e5jrhmzyjmtgc6dfpdr66sps8vjl2q');recipient.className='mono recipient-full';
   const sources=add(card,'ul');
   for(const [label,url] of [
    ['Address history','https://mempool.guide/address/bc1qlrmjpgg0e5jrhmzyjmtgc6dfpdr66sps8vjl2q'],
    ['Block 971473 — CEO of LukeCoin','https://mempool.guide/block/0000000000000000b302487172487f19ff97828ed63b91c136b84d3adf5af90d'],
    ['Block 971868 — Test','https://mempool.guide/block/0000000000000000a916b46d537522cc4e3acfba89b4f87a8855ab257ce65b73']
   ]){const a=add(add(sources,'li'),'a',label);a.href=url;}
   add(card,'p','The explorer attributed both linked examples to AlphaPool when checked. These are observed coinbase names, not proof of three separate pools. A shared reward destination is consistent with changing tags or shared payout infrastructure; it does not establish common ownership, miner identity or template control. This dated check covers one address on mempool.guide, not other addresses or independent node verification.');
  }
  add(card,'h4','What remains unproven');
  add(card,'p','Recipient scripts are not people. These outputs do not establish template control, upstream routing, fee correctness or whether all miners received their promised shares. The explorer attribution can combine services.');
  add(card,'h4','Evidence requested from the operator');
  add(card,'p',c?.question||'Can you confirm the explorer label and service behind these blocks, explain the payout outputs, and document who selects transactions on each mining path?');
  const a=add(card,'a','Submit supporting evidence or a correction →');a.href='/contribute';
 }
}catch{add(root,'p','The block evidence snapshot could not be loaded. Use the JSON download or try again.');}
