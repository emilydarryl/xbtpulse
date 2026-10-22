const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};

export function feeSection(order,{seller,onUpdate}) {
  const fee=order.platformFee;
  if(!fee)return null;
  const section=el('section',undefined,'trade-record fee-record');
  section.append(el('h2','Seller platform fee'));
  if(!fee.amountXbt){section.append(el('p','Fee details need support review. No payment is requested.'));return section;}
  section.append(el('p',fee.amountXbt+' XBT · 2% of the agreed total, including delivery.'),
    el('p','The seller pays this fee after the buyer confirms completion. Purchase payment goes directly to the seller.'));
  const messages={
    not_due:'Not due yet. Cancelled orders owe no platform fee.',
    due:'Order complete. The platform fee is due.',
    creating:'Preparing one fee invoice. Refresh shortly; do not create another payment.',
    pending:'Invoice ready. Pay once using your own XBT wallet.',
    processing:'Payment detected; waiting for confirmation. Do not pay again.',
    settled:'Platform fee payment verified.',
    on_hold:'Fee collection is on hold while the order issue is open.',
    waived:'No platform fee is due for this cancelled or fully refunded order.',
    refund_due:'The sale was fully refunded. The paid platform fee needs a refund review with support.',
    below_minimum:'This fee is below the on-chain invoice minimum. No payment is requested in this pilot.',
    creation_unknown:'Invoice creation needs review after a connection failure. Do not send a second payment.',
    review:'Payment details need support review. Do not send another payment.',
    expired:'This fee invoice expired. Contact support before sending payment.',
    invalid:'This fee invoice needs support review. No new payment is requested.',
    paused:'Platform fee collection is paused. No payment is requested.',
  };
  section.append(el('p',messages[fee.status]||'Check the fee status with support.'));
  if(fee.serviceUnavailable)section.append(el('p','Payment-service check is unavailable. The last recorded status is shown.'));
  const actions=el('div',undefined,'actions');
  if(fee.checkoutLink&&seller){
    const pay=el('a','Pay platform fee ↗','button primary');
    pay.href=fee.checkoutLink;pay.target='_blank';pay.rel='noopener noreferrer';pay.referrerPolicy='no-referrer';actions.append(pay);
  }
  if(seller&&order.status==='complete'&&!order.issue?.open&&!['settled','below_minimum','paused','refund_due'].includes(fee.status)){
    const update=el('button',fee.status==='due'?'Prepare fee invoice':'Check fee payment','button');
    update.addEventListener('click',async()=>{update.disabled=true;try{await onUpdate();}finally{update.disabled=false;}});
    actions.append(update);
  }
  if(actions.childElementCount)section.append(actions);
  if(fee.lastChecked)section.append(el('p','Payment status checked '+new Date(fee.lastChecked).toLocaleString(),'small'));
  return section;
}
