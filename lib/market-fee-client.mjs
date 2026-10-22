import {createHmac, timingSafeEqual} from 'node:crypto';
import {satsToXbt, xbtToSats} from './market-fee-policy.mjs';

const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
export class FeeProtocolError extends Error {}
const origin = (value, allowLoopback) => {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || (allowLoopback && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))) {
    throw Error('Configure a dedicated HTTPS payment origin.');
  }
  return url.origin;
};

export class MarketFeeClient {
  constructor({baseUrl, checkoutOrigin = baseUrl, storeId, apiKey, webhookSecret, allowLoopback = false}) {
    this.origin = origin(baseUrl, allowLoopback);
    this.checkoutOrigin = origin(checkoutOrigin, allowLoopback);
    if (!safeId(storeId) || typeof apiKey !== 'string' || apiKey.length < 16 || apiKey.length > 1024 || /[\r\n]/.test(apiKey) ||
        typeof webhookSecret !== 'string' || webhookSecret.length < 32 || webhookSecret.length > 1024) {
      throw Error('Dedicated store invoice credentials and a webhook secret are required.');
    }
    this.storeId = storeId;
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
  }

  async request(path, body) {
    const response = await fetch(this.origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {Authorization: 'token ' + this.apiKey, ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { await response.body?.cancel(); throw Error('Payment service request failed (' + response.status + ').'); }
    const chunks = []; let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > 262144) { throw Error('Payment service response exceeded its limit.'); }
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }

  assertInvoice(invoice, expected) {
    try { if (!safeId(invoice.id) || invoice.storeId !== this.storeId || invoice.currency !== 'XBT' ||
        xbtToSats(invoice.amount) !== BigInt(expected.feeSats) || invoice.metadata?.orderId !== expected.orderId ||
        invoice.metadata?.purpose !== 'xbt-market-fee' || invoice.metadata?.contractHash !== expected.contractHash ||
        invoice.metadata?.paymentMethod !== 'XBT-CHAIN') throw Error('Mismatch'); }
    catch { throw new FeeProtocolError('Fee invoice does not match its order and quote.'); }
    return invoice;
  }

  async find(expected) {
    const invoices = await this.request('/api/v1/stores/' + this.storeId + '/invoices?orderId=' + encodeURIComponent(expected.orderId) + '&includeArchived=true');
    if (!Array.isArray(invoices)) throw new FeeProtocolError('Invalid fee-invoice search response.');
    const ours = invoices.filter(invoice => invoice.metadata?.purpose === 'xbt-market-fee');
    if (ours.length > 1) throw new FeeProtocolError('Multiple fee invoices require support review.');
    return ours[0] ? this.assertInvoice(ours[0], expected) : null;
  }

  async create(expected) {
    const invoice = await this.request('/api/v1/stores/' + this.storeId + '/invoices', {
      amount: satsToXbt(expected.feeSats), currency: 'XBT',
      metadata: {orderId: expected.orderId, purpose: 'xbt-market-fee', contractHash: expected.contractHash, paymentMethod: 'XBT-CHAIN'},
      checkout: {paymentMethods: ['XBT-CHAIN'], paymentTolerance: 0, expirationMinutes: 30},
    });
    return this.assertInvoice(invoice, expected);
  }

  checkoutLink(invoice) {
    const link = new URL(invoice.checkoutLink);
    if (link.origin !== this.origin || link.search || link.hash || link.pathname !== '/i/' + invoice.id) throw new FeeProtocolError('Unexpected fee checkout destination.');
    return this.checkoutOrigin + link.pathname;
  }

  async read(invoiceId, expected) {
    if (!safeId(invoiceId)) throw Error('Invalid fee invoice identifier.');
    const invoice = this.assertInvoice(await this.request('/api/v1/invoices/' + invoiceId + '?includePaymentMethods=true'), expected);
    if (invoice.id !== invoiceId) throw new FeeProtocolError('Fee invoice identifier changed.');
    const exceptional = invoice.additionalStatus !== 'None';
    if (invoice.status !== 'Settled' || exceptional) return {invoice, settled: false, review: exceptional || !['New','Processing','Expired','Invalid'].includes(invoice.status)};
    const methods = invoice.paymentMethods;
    if (!Array.isArray(methods) || methods.length !== 1) throw new FeeProtocolError('Unexpected fee payment methods.');
    const method = methods[0];
    if (method.paymentMethodId !== 'XBT-CHAIN' || method.currency !== 'XBT' || !Array.isArray(method.payments)) throw new FeeProtocolError('Unexpected fee payment asset.');
    if (!method.payments.length || method.payments.some(payment => payment.status !== 'Settled')) return {invoice, settled:false, review:true};
    const payments = method.payments.map(payment => {
      if (typeof payment.id !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(payment.id)) throw new FeeProtocolError('Missing fee payment reference.');
      let amount; try { amount = xbtToSats(payment.value); } catch { throw new FeeProtocolError('Invalid fee payment amount.'); }
      return {id:payment.id, amountSats:String(amount)};
    });
    const paid = payments.reduce((sum, payment) => sum + BigInt(payment.amountSats), 0n);
    if (paid !== BigInt(expected.feeSats) || new Set(payments.map(payment => payment.id)).size !== payments.length) throw new FeeProtocolError('Settled fee payment amount does not match.');
    return {invoice, settled: true, review: false, payments};
  }

  webhook(raw, signature) {
    if (!Buffer.isBuffer(raw) || raw.length > 32768 || !/^sha256=[a-f0-9]{64}$/.test(signature || '')) throw Error('Invalid payment callback signature.');
    const expected = createHmac('sha256', this.webhookSecret).update(raw).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) throw Error('Invalid payment callback signature.');
    const event = JSON.parse(raw.toString('utf8'));
    if (event.storeId !== this.storeId || !safeId(event.invoiceId) || !safeId(event.deliveryId) ||
        !['InvoiceCreated','InvoiceReceivedPayment','InvoiceProcessing','InvoiceSettled','InvoiceExpired','InvoiceInvalid'].includes(event.type)) throw Error('Unsupported payment callback.');
    return {invoiceId: event.invoiceId, deliveryId: event.deliveryId, type: event.type};
  }
}
