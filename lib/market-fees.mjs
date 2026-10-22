import {accessOrder} from './market-trades.mjs';
import {feeBinding, feePolicy, satsToXbt} from './market-fee-policy.mjs';
import {MarketFeeClient, FeeProtocolError} from './market-fee-client.mjs';

export function initializeMarketFees(store) {
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS market_order_fees(
      order_id TEXT PRIMARY KEY, created INTEGER NOT NULL, updated INTEGER NOT NULL,
      contract_hash TEXT NOT NULL, fee_sats TEXT NOT NULL, state TEXT NOT NULL,
      invoice_id TEXT UNIQUE, checkout_link TEXT, post_attempted INTEGER NOT NULL DEFAULT 0,
      lease_until INTEGER NOT NULL DEFAULT 0, last_checked INTEGER NOT NULL DEFAULT 0,
      dirty INTEGER NOT NULL DEFAULT 1, error_code TEXT, remote_status TEXT);
    CREATE TABLE IF NOT EXISTS market_fee_credits(
      invoice_id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, amount_sats TEXT NOT NULL,
      created INTEGER NOT NULL, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS market_fee_payment_refs(
      payment_id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, amount_sats TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS market_fee_callbacks(
      delivery_id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS market_fee_poll ON market_order_fees(last_checked);
  `);
}

const transaction = (store, run) => {
  store.db.exec('BEGIN IMMEDIATE');
  try { const result=run(); store.db.exec('COMMIT'); return result; }
  catch (error) { store.db.exec('ROLLBACK'); throw error; }
};
const storedOrder = (store,id) => {
  const row=store.db.prepare('SELECT * FROM market_orders WHERE id=?').get(id);
  return row ? {...JSON.parse(row.body),id:row.id,status:row.status} : null;
};

export class MarketFees {
  constructor(store,{enabled=false,client=null,minInvoiceSats='600',clock=Date.now}={}) {
    initializeMarketFees(store);
    if (!/^\d{1,10}$/.test(minInvoiceSats) || BigInt(minInvoiceSats)<546n) throw Error('On-chain fee invoice minimum must be at least 546 sats.');
    if (enabled && !client) throw Error('The fee pilot needs a dedicated payment client.');
    this.store=store; this.enabled=enabled; this.client=client;
    this.minInvoiceSats=BigInt(minInvoiceSats); this.clock=clock; this.busy=false;
  }

  view(order) {
    if (!order.platformFeePolicy) return null;
    const policy=feePolicy(order.total);
    if (JSON.stringify(order.platformFeePolicy)!==JSON.stringify(policy)) return {status:'review',checkoutLink:null};
    const fee=this.store.db.prepare('SELECT * FROM market_order_fees WHERE order_id=?').get(order.id);
    const credit=this.store.db.prepare('SELECT * FROM market_fee_credits WHERE order_id=?').get(order.id);
    let status=fee?.state || 'not_due';
    if (!this.enabled) status='paused';
    else if (order.status==='refunded') status=credit ? 'refund_due' :
      (fee && (fee.state==='review' || ((fee.invoice_id || fee.post_attempted) && !['New','Expired'].includes(fee.remote_status))) ? 'review' : 'waived');
    else if (order.status==='cancelled') status='waived';
    else if (order.issue?.open && !credit) status='on_hold';
    else if (credit) status=credit.state;
    else if (order.status!=='complete') status='not_due';
    else if (!fee) status=BigInt(policy.feeSats)<this.minInvoiceSats ? 'below_minimum' : 'due';
    const canPay=this.enabled && order.role==='seller' && order.status==='complete' && !order.issue?.open && status==='pending';
    return {status,feeSats:policy.feeSats,amountXbt:satsToXbt(policy.feeSats),rateBps:200,
      payer:'seller',basis:policy.basis,issueOpen:!!order.issue?.open,
      checkoutLink:canPay ? fee?.checkout_link || null : null,
      invoiceId:order.role==='seller' ? fee?.invoice_id || null : null,
      lastChecked:fee?.last_checked || null, serviceUnavailable:!!fee?.error_code};
  }

  ensure(orderId) {
    const order=storedOrder(this.store,orderId);
    if (!this.enabled || !order || order.status!=='complete' || order.issue?.open) return null;
    const binding=feeBinding(order),now=this.clock();
    this.store.db.prepare(`INSERT OR IGNORE INTO market_order_fees
      (order_id,created,updated,contract_hash,fee_sats,state) VALUES(?,?,?,?,?,?)`)
      .run(order.id,now,now,binding.contractHash,binding.feeSats,BigInt(binding.feeSats)<this.minInvoiceSats?'below_minimum':'due');
    const fee=this.store.db.prepare('SELECT * FROM market_order_fees WHERE order_id=?').get(orderId);
    if (fee.contract_hash!==binding.contractHash || fee.fee_sats!==binding.feeSats) throw Error('Fee quote changed; support review is required.');
    return fee;
  }

  async synchronize(orderId) {
    if (!this.enabled) return;
    let fee=this.store.db.prepare('SELECT * FROM market_order_fees WHERE order_id=?').get(orderId) || this.ensure(orderId);
    if (!fee || fee.state==='below_minimum') return;
    const now=this.clock();
    const acquired=this.store.db.prepare('UPDATE market_order_fees SET lease_until=?,last_checked=?,dirty=0 WHERE order_id=? AND lease_until<=?')
      .run(now+90000,now,orderId,now);
    if (!acquired.changes) return;
    try {
      let order=storedOrder(this.store,orderId);
      if (!order) return;
      const binding=feeBinding(order);
      if (binding.contractHash!==fee.contract_hash || binding.feeSats!==fee.fee_sats) throw new FeeProtocolError('Fee quote changed.');
      if (!fee.invoice_id) {
        if (order.status!=='complete' || order.issue?.open) return;
        let invoice=await this.client.find(binding);
        if (!invoice) {
          order=storedOrder(this.store,orderId);
          if (!order || order.status!=='complete' || order.issue?.open) return;
          if (fee.post_attempted) {
            this.store.db.prepare("UPDATE market_order_fees SET state='creation_unknown',error_code='creation_uncertain' WHERE order_id=?").run(orderId);
            return;
          }
          // Commit the one permitted POST intent before making the network call.
          // A timeout is recovered by searching, never by blindly posting again.
          this.store.db.prepare("UPDATE market_order_fees SET post_attempted=1,state='creating' WHERE order_id=?").run(orderId);
          invoice=await this.client.create(binding);
        }
        const checkoutLink=this.client.checkoutLink(invoice);
        this.store.db.prepare("UPDATE market_order_fees SET invoice_id=?,checkout_link=?,state='pending',updated=? WHERE order_id=?")
          .run(invoice.id,checkoutLink,this.clock(),orderId);
        fee=this.store.db.prepare('SELECT * FROM market_order_fees WHERE order_id=?').get(orderId);
      }
      const result=await this.client.read(fee.invoice_id,binding);
      transaction(this.store,()=>{
        order=storedOrder(this.store,orderId);
        if (!order) return;
        const current=feeBinding(order);
        if (current.contractHash!==binding.contractHash) throw new FeeProtocolError('Order terms changed.');
        const credit=this.store.db.prepare('SELECT * FROM market_fee_credits WHERE order_id=?').get(orderId);
        let state=result.review ? 'review' : ({New:'pending',Processing:'processing',Settled:'settled',Expired:'expired',Invalid:'invalid'}[result.invoice.status] || 'review');
        if (result.settled) {
          for (const payment of result.payments) {
            const seen=this.store.db.prepare('SELECT * FROM market_fee_payment_refs WHERE payment_id=?').get(payment.id);
            if (seen && (seen.invoice_id!==fee.invoice_id || seen.amount_sats!==payment.amountSats)) throw new FeeProtocolError('A payment reference belongs to another invoice.');
            this.store.db.prepare('INSERT OR IGNORE INTO market_fee_payment_refs VALUES(?,?,?)').run(payment.id,fee.invoice_id,payment.amountSats);
          }
          state=order.status==='refunded' ? 'refund_due' : 'settled';
          this.store.db.prepare('INSERT OR IGNORE INTO market_fee_credits VALUES(?,?,?,?,?)')
            .run(fee.invoice_id,orderId,binding.feeSats,this.clock(),state);
          this.store.db.prepare('UPDATE market_fee_credits SET state=? WHERE order_id=?').run(state,orderId);
        } else if (credit) {
          state=order.status==='refunded' ? 'refund_due' : 'review';
          this.store.db.prepare('UPDATE market_fee_credits SET state=? WHERE order_id=?').run(state,orderId);
        }
        this.store.db.prepare('UPDATE market_order_fees SET state=?,remote_status=?,updated=?,error_code=NULL WHERE order_id=?')
          .run(state,result.invoice.status,this.clock(),orderId);
      });
    } catch (error) {
      const protocol=error instanceof FeeProtocolError;
      this.store.db.prepare(`UPDATE market_order_fees SET error_code=?,state=CASE
        WHEN ? THEN 'review' WHEN invoice_id IS NULL AND post_attempted=1 THEN 'creation_unknown' ELSE state END,
        dirty=CASE WHEN ? THEN dirty ELSE 1 END WHERE order_id=?`)
        .run(protocol?'payment_mismatch':'payment_service_unavailable',protocol?1:0,protocol?1:0,orderId);
      if (protocol) this.store.db.prepare("UPDATE market_fee_credits SET state='review' WHERE order_id=?").run(orderId);
    } finally {
      this.store.db.prepare('UPDATE market_order_fees SET lease_until=0 WHERE order_id=?').run(orderId);
    }
  }

  async request(orderId,token,sellerId) {
    const order=accessOrder(this.store,orderId,token,sellerId);
    if (order.role!=='seller') throw Error('Only the seller can request a platform-fee invoice.');
    if (!this.enabled) throw Error('Platform-fee collection is not enabled.');
    this.ensure(orderId); await this.synchronize(orderId);
    return this.view(accessOrder(this.store,orderId,token,sellerId));
  }

  callback(raw,signature) {
    if (!this.enabled) throw Error('Platform-fee collection is not enabled.');
    const event=this.client.webhook(raw,signature),now=this.clock();
    const fee=this.store.db.prepare('SELECT order_id FROM market_order_fees WHERE invoice_id=?').get(event.invoiceId);
    if (!fee) return {accepted:true}; // No orphan/order creation from callbacks.
    transaction(this.store,()=>{
      const old=this.store.db.prepare('SELECT invoice_id FROM market_fee_callbacks WHERE delivery_id=?').get(event.deliveryId);
      if (old && old.invoice_id!==event.invoiceId) throw Error('Callback identifier conflict.');
      this.store.db.prepare('INSERT OR IGNORE INTO market_fee_callbacks VALUES(?,?,?)').run(event.deliveryId,event.invoiceId,now);
      this.store.db.prepare('UPDATE market_order_fees SET dirty=1 WHERE order_id=?').run(fee.order_id);
    });
    return {accepted:true};
  }

  async tick() {
    if (!this.enabled || this.busy) return;
    this.busy=true;
    try {
      // Refund obligations must be recorded even after ordinary polling ages out.
      // The completed sale refund is durable in the order, so restart repairs this
      // transition without needing a payment-service response or another callback.
      transaction(this.store,()=>{
        const refunded=this.store.db.prepare(`SELECT c.order_id FROM market_fee_credits c
          JOIN market_orders o ON o.id=c.order_id WHERE o.status='refunded' AND c.state!='refund_due'`).all();
        for(const row of refunded){
          this.store.db.prepare("UPDATE market_fee_credits SET state='refund_due' WHERE order_id=?").run(row.order_id);
          this.store.db.prepare("UPDATE market_order_fees SET state='refund_due',dirty=1 WHERE order_id=?").run(row.order_id);
        }
      });
      const recent=this.store.db.prepare(`SELECT id FROM market_orders WHERE status='complete'
        AND json_extract(body,'$.platformFeePolicy.version')='seller-success-v1'
        AND id NOT IN (SELECT order_id FROM market_order_fees) ORDER BY updated LIMIT 20`).all();
      for (const row of recent) this.ensure(row.id);
      const rows=this.store.db.prepare(`SELECT order_id FROM market_order_fees WHERE state!='below_minimum'
        AND (dirty=1 OR created>?) ORDER BY last_checked,created LIMIT 4`).all(this.clock()-7*86400000);
      for (const row of rows) await this.synchronize(row.order_id);
    } finally { this.busy=false; }
  }

  prune(now=this.clock()) {
    transaction(this.store,()=>{
      this.store.db.prepare('DELETE FROM market_fee_callbacks WHERE created<?').run(now-180*86400000);
      this.store.db.exec(`DELETE FROM market_order_fees WHERE order_id NOT IN (SELECT id FROM market_orders);
        DELETE FROM market_fee_credits WHERE order_id NOT IN (SELECT id FROM market_orders);
        DELETE FROM market_fee_payment_refs WHERE invoice_id NOT IN (SELECT invoice_id FROM market_order_fees WHERE invoice_id IS NOT NULL);`);
    });
  }
}

export function marketFeesFromEnvironment(store,env=process.env) {
  const enabled=env.MARKET_FEES_ENABLED==='true';
  const client=enabled ? new MarketFeeClient({baseUrl:env.MARKET_FEE_API_ORIGIN,checkoutOrigin:env.MARKET_FEE_CHECKOUT_ORIGIN || env.MARKET_FEE_API_ORIGIN,
    storeId:env.MARKET_FEE_STORE_ID,apiKey:env.MARKET_FEE_API_KEY,webhookSecret:env.MARKET_FEE_WEBHOOK_SECRET,allowLoopback:env.MARKET_FEE_ALLOW_LOOPBACK==='true'}) : null;
  return new MarketFees(store,{enabled,client,minInvoiceSats:env.MARKET_FEE_MIN_INVOICE_SATS || '600'});
}
