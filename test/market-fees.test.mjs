import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHmac,randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {Store} from '../lib/store.mjs';
import {initializeMarketplace,submitListing,moderateListing} from '../lib/marketplace.mjs';
import {createSeller,createOrder,changeOrder,accessOrder,pruneTrades} from '../lib/market-trades.mjs';
import {MarketFeeClient} from '../lib/market-fee-client.mjs';
import {MarketFees} from '../lib/market-fees.mjs';
import {feePolicy,xbtToSats,satsToXbt} from '../lib/market-fee-policy.mjs';

const sellerKey='aa'.repeat(32),buyerKey='bb'.repeat(32),otherKey='cc'.repeat(32),listingKey='dd'.repeat(32);
const apiKey='mock-store-invoice-token-123456',secret='mock-webhook-secret-12345678901234567890';
const now=1792699000000;

async function fixture(t,{disk=false}={}) {
  const directory=await mkdtemp(join(tmpdir(),'xbt-fee-test-'));
  let store=new Store(disk?join(directory,'pulse.sqlite'):':memory:');initializeMarketplace(store);
  const sellerId=randomUUID(),listingId=randomUUID();
  createSeller(store,{id:sellerId,name:'Fee test seller',consent:true},sellerKey,now);
  submitListing(store,{id:listingId,profileId:sellerId,title:'An isolated test item',description:'A synthetic item used only for transaction tests.',seller:'Ignored name',contact:'seller@example.test',category:'other',price:'1',region:'Test',delivery:'shipping',consent:true},listingKey,now,sellerKey);
  moderateListing(store,listingId,'publish',now);
  const invoices=new Map();let posts=0,loseReply=false,hideSearch=false,failSearch=false;
  const server=http.createServer(async(req,res)=>{
    assert.equal(req.headers.authorization,'token '+apiKey);
    res.setHeader('Content-Type','application/json');
    const url=new URL(req.url,'http://localhost');
    if(req.method==='POST'){
      assert.equal(url.pathname,'/api/v1/stores/store1/invoices');
      let body='';for await(const chunk of req)body+=chunk;
      const input=JSON.parse(body);assert.deepEqual(input.checkout.paymentMethods,['XBT-CHAIN']);assert.equal(input.checkout.paymentTolerance,0);
      const invoice={...input,id:'invoice'+(++posts),storeId:'store1',checkoutLink:origin+'/i/invoice'+posts,status:'New',additionalStatus:'None',paymentMethods:[{paymentMethodId:'XBT-CHAIN',currency:'XBT',payments:[]}]};
      invoices.set(invoice.id,invoice);
      if(loseReply){loseReply=false;res.destroy();return;}
      res.end(JSON.stringify(invoice));return;
    }
    if(url.pathname==='/api/v1/stores/store1/invoices'){
      if(failSearch){res.statusCode=503;res.end('{}');return;}
      res.end(JSON.stringify(hideSearch?[]:[...invoices.values()].filter(i=>i.metadata.orderId===url.searchParams.get('orderId'))));return;
    }
    const id=url.pathname.split('/').at(-1);
    assert.equal(url.searchParams.get('includePaymentMethods'),'true');
    if(!invoices.has(id)){res.statusCode=404;res.end('{}');return;}
    res.end(JSON.stringify(invoices.get(id)));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const client=new MarketFeeClient({baseUrl:origin,storeId:'store1',apiKey,webhookSecret:secret,allowLoopback:true});
  let fees=new MarketFees(store,{enabled:true,client,clock:()=>now});
  const view=id=>accessOrder(store,id,sellerKey,sellerId);
  const seller=(id,action,extra={})=>changeOrder(store,{id,sellerId,action,confirm:true,...extra},sellerKey,now);
  const buyer=(id,action,extra={})=>changeOrder(store,{id,action,confirm:true,...extra},buyerKey,now);
  function order({total='1',enabled=true,complete=true}={}){
    const id=randomUUID();createOrder(store,{id,listingId,buyer:'Mock buyer',contact:'buyer@example.test',terms:'An isolated test sale including delivery and full refund terms.',total,consent:true},buyerKey,now,enabled);
    if(complete){seller(id,'accept',{acceptFee:true,address:'TestReceivingAddress1234567890',confirmations:1,instructions:'Use an XBT mainnet wallet within one day.'});buyer(id,'report_payment',{txid:'1'.repeat(64)});seller(id,'confirm_payment');seller(id,'fulfill');buyer(id,'complete');}
    return id;
  }
  function settle(invoice,{paymentId=invoice.id+':1'}={}){
    invoice.status='Settled';invoice.additionalStatus='None';
    invoice.paymentMethods=[{paymentMethodId:'XBT-CHAIN',currency:'XBT',payments:[{id:paymentId,status:'Settled',value:invoice.amount}]}];
  }
  function callback(invoice,{deliveryId='delivery1',...extra}={}){
    const raw=Buffer.from(JSON.stringify({deliveryId,storeId:'store1',invoiceId:invoice.id,type:'InvoiceSettled',...extra}));
    return {raw,signature:'sha256='+createHmac('sha256',secret).update(raw).digest('hex')};
  }
  t.after(async()=>{store.close();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  return {get store(){return store;},get fees(){return fees;},client,invoices,order,view,buyer,seller,settle,callback,
    get posts(){return posts;},set loseReply(value){loseReply=value;},set hideSearch(value){hideSearch=value;},set failSearch(value){failSearch=value;},
    restart(){assert.ok(disk);store.close();store=new Store(join(directory,'pulse.sqlite'));initializeMarketplace(store);fees=new MarketFees(store,{enabled:true,client,clock:()=>now});},
    invoice(id){return [...invoices.values()].find(i=>i.metadata.orderId===id);}};
}

test('fee quotes use exact satoshis, round once, and cannot retrofit old orders',async t=>{
  assert.equal(feePolicy('0.05000001').feeSats,'100001');assert.equal(feePolicy('0.00000001').feeSats,'1');
  assert.equal(satsToXbt('100001'),'0.00100001');assert.equal(xbtToSats('21000000'),2100000000000000n);
  for(const value of ['1e-8','0.000000001','21000000.00000001',0.1])assert.throws(()=>feePolicy(value));
  const f=await fixture(t),old=f.order({enabled:false});await f.fees.tick();assert.equal(f.posts,0);assert.equal(f.fees.view(f.view(old)),null);
  const fresh=f.order({complete:false});assert.throws(()=>f.seller(fresh,'accept',{address:'TestReceivingAddress1234567890',confirmations:1,instructions:'Pay before tomorrow.'}));
  assert.equal(f.view(fresh).status,'requested');
});

test('cancellation, open issues and below-minimum fees never request a payment',async t=>{
  const f=await fixture(t),cancelled=f.order({complete:false});f.buyer(cancelled,'cancel');
  assert.equal(f.fees.view(f.view(cancelled)).status,'waived');
  const small=f.order({total:'0.00000001'}),held=f.order();
  f.buyer(held,'open_issue',{messageId:randomUUID(),message:'Resolve this delivery concern first.'});
  await f.fees.tick();assert.equal(f.posts,0);assert.equal(f.fees.view(f.view(small)).status,'below_minimum');assert.equal(f.fees.view(f.view(held)).status,'on_hold');
});

test('settled credits, callback replay and reorg review survive process restart',async t=>{
  const f=await fixture(t,{disk:true}),id=f.order();await f.fees.tick();assert.equal(f.posts,1);
  const invoice=f.invoice(id);assert.ok(f.fees.view(f.view(id)).checkoutLink);
  invoice.status='Processing';await f.fees.synchronize(id);assert.equal(f.fees.view(f.view(id)).status,'processing');assert.equal(f.fees.view(f.view(id)).checkoutLink,null);
  f.settle(invoice);const event=f.callback(invoice);f.fees.callback(event.raw,event.signature);await f.fees.tick();
  assert.equal(f.fees.view(f.view(id)).status,'settled');f.restart();
  f.fees.callback(event.raw,event.signature);await f.fees.tick();
  assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM market_fee_credits').get().n,1);assert.equal(f.posts,1);
  assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM market_fee_callbacks').get().n,1);
  invoice.status='Processing';await f.fees.synchronize(id);assert.equal(f.fees.view(f.view(id)).status,'review');
  assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM market_fee_credits').get().n,1);
  f.settle(invoice);await f.fees.synchronize(id);assert.equal(f.fees.view(f.view(id)).status,'settled');
});

test('an accepted POST with a lost reply is recovered without posting twice',async t=>{
  const f=await fixture(t,{disk:true}),id=f.order();f.loseReply=true;await f.fees.tick();
  assert.equal(f.posts,1);assert.equal(f.fees.view(f.view(id)).status,'creation_unknown');
  f.restart();f.hideSearch=true;await f.fees.tick();assert.equal(f.posts,1);assert.equal(f.fees.view(f.view(id)).checkoutLink,null);
  f.hideSearch=false;await f.fees.tick();assert.equal(f.posts,1);assert.equal(f.fees.view(f.view(id)).status,'pending');
});

test('wrong asset, metadata, manual settlement and incorrect values fail closed',async t=>{
  const f=await fixture(t),id=f.order();await f.fees.tick();const invoice=f.invoice(id);
  const clean=JSON.parse(JSON.stringify(invoice));
  const patches=[i=>i.currency='BTC',i=>i.storeId='store2',i=>i.metadata.orderId=randomUUID(),i=>i.additionalStatus='Marked',
    i=>i.additionalStatus='PaidOver',i=>i.paymentMethods[0].currency='BTC',i=>i.paymentMethods[0].paymentMethodId='BTC-CHAIN',
    i=>i.paymentMethods[0].payments[0].value='0.01999999',i=>i.paymentMethods[0].payments[0].value='0.02000001',
    i=>i.paymentMethods[0].payments[0].value=0.02];
  for(const patch of patches){Object.assign(invoice,JSON.parse(JSON.stringify(clean)));f.settle(invoice);patch(invoice);await f.fees.synchronize(id);
    assert.equal(f.fees.view(f.view(id)).status,'review');assert.equal(f.fees.view(f.view(id)).checkoutLink,null);assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM market_fee_credits').get().n,0);}
});

test('one chain-payment reference cannot credit two different fee invoices',async t=>{
  const f=await fixture(t),first=f.order(),second=f.order();await f.fees.tick();
  f.settle(f.invoice(first),{paymentId:'same-output:1'});f.settle(f.invoice(second),{paymentId:'same-output:1'});
  await f.fees.synchronize(first);await f.fees.synchronize(second);
  assert.equal(f.fees.view(f.view(first)).status,'settled');assert.equal(f.fees.view(f.view(second)).status,'review');
  assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM market_fee_credits').get().n,1);
});

test('a full sale refund preserves the credit and creates a fee refund obligation',async t=>{
  const f=await fixture(t),id=f.order();await f.fees.tick();f.settle(f.invoice(id));await f.fees.synchronize(id);
  f.buyer(id,'open_issue',{messageId:randomUUID(),message:'The delivered item needs a full refund.'});
  f.seller(id,'report_refund',{txid:'2'.repeat(64)});f.buyer(id,'confirm_refund');
  assert.equal(f.fees.view(f.view(id)).status,'refund_due');assert.equal(f.fees.view(f.view(id)).checkoutLink,null);
  await f.fees.synchronize(id);assert.equal(f.store.db.prepare('SELECT state FROM market_fee_credits').get().state,'refund_due');assert.equal(f.posts,1);
});

test('late sale refunds durably record the obligation after restart and payment-service downtime',async t=>{
  const f=await fixture(t,{disk:true}),id=f.order();await f.fees.tick();f.settle(f.invoice(id));await f.fees.synchronize(id);
  f.buyer(id,'open_issue',{messageId:randomUUID(),message:'A late full refund needs review.'});
  f.seller(id,'report_refund',{txid:'3'.repeat(64)});f.buyer(id,'confirm_refund');
  f.store.db.prepare('UPDATE market_order_fees SET created=?,dirty=0 WHERE order_id=?').run(now-10*86400000,id);
  f.restart();f.fees.client.read=async()=>{throw Error('Service offline');};await f.fees.tick();
  assert.equal(f.store.db.prepare('SELECT state FROM market_fee_credits').get().state,'refund_due');
  assert.equal(f.fees.view(f.view(id)).status,'refund_due');assert.equal(f.posts,1);
});

test('an old callback retries after a payment-service outage instead of losing reconciliation',async t=>{
  const f=await fixture(t,{disk:true}),id=f.order();await f.fees.tick();const invoice=f.invoice(id);f.settle(invoice);
  f.store.db.prepare('UPDATE market_order_fees SET created=?,dirty=0 WHERE order_id=?').run(now-10*86400000,id);
  const event=f.callback(invoice);f.fees.callback(event.raw,event.signature);
  const read=f.client.read.bind(f.client);f.client.read=async()=>{throw Error('Service offline');};await f.fees.tick();
  assert.equal(f.store.db.prepare('SELECT dirty FROM market_order_fees').get().dirty,1);
  f.client.read=read;f.restart();await f.fees.tick();assert.equal(f.store.db.prepare('SELECT count(*) n FROM market_fee_credits').get().n,1);
  assert.equal(f.fees.view(f.view(id)).status,'settled');assert.equal(f.posts,1);
});

test('seller capabilities, callback signatures and authoritative reads gate fee state',async t=>{
  const f=await fixture(t),id=f.order();
  await assert.rejects(()=>f.fees.request(id,buyerKey));await assert.rejects(()=>f.fees.request(id,otherKey,f.view(id).profileId));assert.equal(f.posts,0);
  await f.fees.tick();const invoice=f.invoice(id),event=f.callback(invoice);
  assert.throws(()=>f.fees.callback(event.raw,'sha256='+'0'.repeat(64)));
  assert.throws(()=>f.fees.callback(Buffer.from(event.raw.toString()+' '),event.signature));
  f.fees.callback(event.raw,event.signature);await f.fees.tick();assert.equal(f.fees.view(f.view(id)).status,'pending');
  const buyer=accessOrder(f.store,id,buyerKey);assert.equal(f.fees.view(buyer).checkoutLink,null);assert.equal(f.fees.view(buyer).invoiceId,null);
  assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM market_fee_credits').get().n,0);
});

test('duplicate remote invoices and payment-service failures do not create extra charges',async t=>{
  const f=await fixture(t),id=f.order();f.failSearch=true;await f.fees.tick();assert.equal(f.posts,0);assert.equal(f.fees.view(f.view(id)).serviceUnavailable,true);
  f.failSearch=false;await f.fees.tick();assert.equal(f.posts,1);
  const invoice=f.invoice(id);f.invoices.set('duplicate',{...invoice,id:'duplicate',checkoutLink:invoice.checkoutLink.replace(invoice.id,'duplicate')});
  // An unbound recovery search must refuse multiple remote matches.
  f.store.db.prepare('UPDATE market_order_fees SET invoice_id=NULL,checkout_link=NULL WHERE order_id=?').run(id);
  await f.fees.synchronize(id);assert.equal(f.fees.view(f.view(id)).status,'review');assert.equal(f.posts,1);
});

test('fee retention removes orphaned private records together with expired orders',async t=>{
  const f=await fixture(t),id=f.order();await f.fees.tick();f.settle(f.invoice(id));await f.fees.synchronize(id);
  pruneTrades(f.store,now+181*86400000);f.fees.prune(now+181*86400000);
  for(const table of ['market_order_fees','market_fee_credits','market_fee_payment_refs'])assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM '+table).get().n,0);
});

test('HTTP routes enforce seller access and Origin while callbacks reconcile from the provider',async t=>{
  const f=await fixture(t,{disk:true}),id=f.order();
  const probe=http.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const origin='http://127.0.0.1:'+port;
  const database=f.store.db.location();
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,
    HOST:'127.0.0.1',PORT:String(port),DATA_DIR:join(database,'..'),EXPLORER_API:'',RPC_URL:'',TELEMETRY_KEYS_JSON:'{}',NODE_OBSERVATIONS_ENABLED:'false',
    ADMIN_ORIGIN:origin,MARKET_ORIGIN:origin,MARKET_FEES_ENABLED:'true',MARKET_FEE_ALLOW_LOOPBACK:'true',
    MARKET_FEE_API_ORIGIN:f.client.origin,MARKET_FEE_CHECKOUT_ORIGIN:f.client.origin,MARKET_FEE_STORE_ID:'store1',MARKET_FEE_API_KEY:apiKey,MARKET_FEE_WEBHOOK_SECRET:secret},stdio:['ignore','pipe','pipe']});
  let errors='';child.stderr.on('data',chunk=>errors+=chunk.toString());
  const request=async(path,options={})=>fetch(origin+path,{...options,signal:AbortSignal.timeout(5000)});
  try{
    let ready=false;
    for(let i=0;i<50;i++){
      try{const r=await request('/healthz');if(r.ok){ready=true;break;}}catch{}
      if(child.exitCode!==null)throw Error('Isolated server stopped: '+errors);
      await new Promise(resolve=>setTimeout(resolve,30));
    }
    assert.ok(ready,errors);
    const feeUrl='/api/market/fees';
    assert.equal((await request(feeUrl,{method:'POST',headers:{Origin:'https://wrong.example','Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal((await request(feeUrl,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+otherKey},body:JSON.stringify({id,sellerId:f.view(id).profileId})})).status,400);
    assert.equal((await request('/api/market/fee-webhook',{method:'POST',headers:{'BTCPay-Sig':'sha256='+'0'.repeat(64)},body:'{}'})).status,403);
    assert.equal((await request('/market-fees.js')).status,200);
    const sellerQuery='/api/market/orders?id='+id+'&sellerId='+f.view(id).profileId;
    const getSeller=async()=>{const r=await request(sellerQuery,{headers:{Authorization:'Bearer '+sellerKey}});assert.equal(r.status,200);return r.json();};
    let current;
    for(let i=0;i<40;i++){current=await getSeller();if(current.platformFee?.checkoutLink)break;await new Promise(resolve=>setTimeout(resolve,25));}
    assert.equal(current.platformFee.status,'pending');assert.equal(f.posts,1);
    const buyerResponse=await request('/api/market/orders?id='+id,{headers:{Authorization:'Bearer '+buyerKey}});
    const buyer=await buyerResponse.json();assert.equal(buyer.platformFee.checkoutLink,null);assert.equal(buyer.platformFee.invoiceId,null);
    f.settle(f.invoice(id));const event=f.callback(f.invoice(id),{deliveryId:'http-delivery'});
    const deliver=()=>request('/api/market/fee-webhook',{method:'POST',headers:{'BTCPay-Sig':event.signature},body:event.raw});
    assert.equal((await deliver()).status,202);
    for(let i=0;i<40;i++){current=await getSeller();if(current.platformFee.status==='settled')break;await new Promise(resolve=>setTimeout(resolve,25));}
    assert.equal(current.platformFee.status,'settled');assert.equal((await deliver()).status,202);
    assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM market_fee_credits').get().n,1);assert.equal(f.posts,1);
  }finally{
    child.kill('SIGTERM');if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));
  }
});
