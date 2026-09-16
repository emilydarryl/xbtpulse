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
  add(card,'h4','What remains unproven');
  add(card,'p','Recipient scripts are not people. These outputs do not establish template control, upstream routing, fee correctness or whether all miners received their promised shares. The explorer attribution can combine services.');
  add(card,'h4','Evidence requested from the operator');
  add(card,'p',c?.question||'Can you confirm the explorer label and service behind these blocks, explain the payout outputs, and document who selects transactions on each mining path?');
  const a=add(card,'a','Submit supporting evidence or a correction →');a.href='/contribute';
 }
}catch{add(root,'p','The block evidence snapshot could not be loaded. Use the JSON download or try again.');}
