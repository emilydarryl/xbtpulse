import {createHash} from 'node:crypto';
const digest=v=>createHash('sha256').update(v).digest('hex');
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v||'');
const key=v=>/^[a-f0-9]{64}$/.test(v||'');
const text=(v,min,max)=>{if(typeof v!=='string'||v.trim().length<min||v.trim().length>max||/[\x00-\x08\x0b-\x1f]/.test(v))throw Error('Please check the required fields.');return v.trim();};
function limit(s,name,now,max){const bucket=Math.floor(now/3600000),old=s.get(name),count=old?.bucket===bucket?old.count:0;if(count>=max)throw Error('Too many requests. Please try again later.');s.set(name,{bucket,count:count+1});}
export function initializeTrades(s){s.db.exec(`CREATE TABLE IF NOT EXISTS market_sellers(id TEXT PRIMARY KEY,created INTEGER NOT NULL,key_hash TEXT NOT NULL,name TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS market_orders(id TEXT PRIMARY KEY,created INTEGER NOT NULL,updated INTEGER NOT NULL,seller_id TEXT NOT NULL,buyer_hash TEXT NOT NULL,status TEXT NOT NULL,body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS market_order_events(order_id TEXT NOT NULL,time INTEGER NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS market_event_order ON market_order_events(order_id,time);
CREATE INDEX IF NOT EXISTS market_order_seller ON market_orders(seller_id,created);`);if(!s.db.prepare("PRAGMA table_info(market_sellers)").all().some(c=>c.name==='published'))s.db.exec("ALTER TABLE market_sellers ADD COLUMN published INTEGER NOT NULL DEFAULT 0");}
export function sellerAccess(s,id,token){if(!uuid(id)||!key(token))throw Error('Private seller link unavailable.');const r=s.db.prepare('SELECT id,created,name FROM market_sellers WHERE id=? AND key_hash=?').get(id,digest(token));if(!r)throw Error('Private seller link unavailable.');return r;}
export function createSeller(s,b,token,now=Date.now()){if(!uuid(b.id)||!key(token)||b.consent!==true||b.fax)throw Error('Check the profile details and consent.');const name=text(b.name,2,80),old=s.db.prepare('SELECT * FROM market_sellers WHERE id=?').get(b.id);if(old){if(old.key_hash!==digest(token)||old.name!==name)throw Error('Profile identifier already used.');return {id:old.id,name:old.name,created:old.created};}limit(s,'market-profile-limit',now,30);s.db.prepare('INSERT INTO market_sellers(id,created,key_hash,name) VALUES(?,?,?,?)').run(b.id,now,digest(token),name);return {id:b.id,name,created:now};}
const listing=r=>({...JSON.parse(r.body),id:r.id,status:r.status,created:r.created,expires:r.expires});
const order=r=>({...JSON.parse(r.body),id:r.id,status:r.status,created:r.created,updated:r.updated});
export function sellerDashboard(s,id,token){const profile=sellerAccess(s,id,token);return {profile,listings:s.db.prepare("SELECT * FROM market_listings WHERE json_extract(body,'$.profileId')=? ORDER BY created DESC LIMIT 100").all(id).map(listing),orders:s.db.prepare('SELECT * FROM market_orders WHERE seller_id=? ORDER BY created DESC LIMIT 100').all(id).map(order)};}
export function publicSeller(s,id,now=Date.now()){if(!uuid(id))throw Error('Seller profile unavailable.');const profile=s.db.prepare('SELECT id,created,name FROM market_sellers WHERE id=? AND published=1').get(id);const listings=s.db.prepare("SELECT * FROM market_listings WHERE json_extract(body,'$.profileId')=? AND status='published' AND expires>? ORDER BY created DESC LIMIT 100").all(id,now).map(listing);if(!profile)throw Error('Seller profile is not public yet. It appears after the first offer is approved.');return {profile,listings};}
export function attachListing(s,b,token){const profile=sellerAccess(s,b.sellerId,token);if(!uuid(b.listingId)||!key(b.listingToken))throw Error('Private listing link unavailable.');const r=s.db.prepare('SELECT * FROM market_listings WHERE id=? AND token_hash=?').get(b.listingId,digest(b.listingToken));if(!r)throw Error('Private listing link unavailable.');const body=JSON.parse(r.body);if(body.profileId&&body.profileId!==profile.id)throw Error('Listing already belongs to a different profile.');if(!['pending','published'].includes(r.status))throw Error('Only open listings can be linked.');body.profileId=profile.id;body.seller=profile.name;
// Changing the public seller identity requires a fresh moderation decision.
s.db.prepare("UPDATE market_listings SET body=?,status='pending',updated=? WHERE id=?").run(JSON.stringify(body),Date.now(),r.id);return {id:r.id,status:'pending'};}
export function createOrder(s,b,token,now=Date.now()){if(!uuid(b.id)||!uuid(b.listingId)||!key(token)||b.consent!==true||b.fax)throw Error('Check your request and consent.');const old=s.db.prepare('SELECT * FROM market_orders WHERE id=?').get(b.id);
const proposed={listingId:b.listingId,buyer:text(b.buyer,2,80),contact:text(b.contact,5,250),terms:text(b.terms,20,1500),total:text(b.total,1,24)};
if(!/^(0|[1-9]\d{0,9})(\.\d{1,8})?$/.test(proposed.total)||BigInt(proposed.total.replace('.',''))===0n)throw Error('Enter a positive total in XBT with up to eight decimals.');
if(!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(proposed.contact)){let u;try{u=new URL(proposed.contact);}catch{throw Error('Use a contact email or HTTPS link.');}if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))throw Error('Use a contact email or HTTPS link.');}
if(old){const saved=JSON.parse(old.body);if(old.buyer_hash!==digest(token)||Object.keys(proposed).some(k=>saved[k]!==proposed[k]))throw Error('Request identifier already used.');return order(old);}
const r=s.db.prepare("SELECT * FROM market_listings WHERE id=? AND status='published' AND expires>?").get(b.listingId,now);if(!r)throw Error('This offer is no longer available.');const item=listing(r);if(!item.profileId||!s.db.prepare('SELECT id FROM market_sellers WHERE id=?').get(item.profileId))throw Error('This seller has not enabled order requests. Contact them directly.');limit(s,'market-order-limit',now,60);
const body={...proposed,title:item.title,description:item.description,listedPrice:item.price,delivery:item.delivery,region:item.region,seller:item.seller,sellerContact:item.contact,profileId:item.profileId};
s.db.exec('BEGIN IMMEDIATE');try{s.db.prepare('INSERT INTO market_orders VALUES(?,?,?,?,?,?,?)').run(b.id,now,now,item.profileId,digest(token),'requested',JSON.stringify(body));s.db.prepare('INSERT INTO market_order_events VALUES(?,?,?,?)').run(b.id,now,'buyer','request');s.db.exec('COMMIT');}catch(e){s.db.exec('ROLLBACK');throw e;}return {id:b.id,status:'requested',...body,created:now,updated:now};}
export function accessOrder(s,id,token,sellerId){if(!uuid(id)||!key(token))throw Error('Private order unavailable.');if(sellerId)sellerAccess(s,sellerId,token);const r=sellerId?s.db.prepare('SELECT * FROM market_orders WHERE id=? AND seller_id=?').get(id,sellerId):s.db.prepare('SELECT * FROM market_orders WHERE id=? AND buyer_hash=?').get(id,digest(token));if(!r)throw Error('Private order unavailable.');return {...order(r),role:sellerId?'seller':'buyer',history:s.db.prepare('SELECT time,actor,action FROM market_order_events WHERE order_id=? ORDER BY rowid').all(id)};}
const txid=v=>{if(!/^[a-fA-F0-9]{64}$/.test(v||''))throw Error('Enter the 64-character transaction ID from your wallet.');return v.toLowerCase();};
function saveOrder(s,current,body,next,action,now){s.db.exec('BEGIN IMMEDIATE');try{const changed=s.db.prepare('UPDATE market_orders SET status=?,body=?,updated=? WHERE id=? AND status=?').run(next,JSON.stringify(body),now,current.id,current.status);if(changed.changes!==1)throw Error('Order status changed. Refresh before continuing.');s.db.prepare('INSERT INTO market_order_events VALUES(?,?,?,?)').run(current.id,now,current.role,action);s.db.exec('COMMIT');}catch(e){s.db.exec('ROLLBACK');throw e;}}
function issueMessage(body,actor,b,now){if(!uuid(b.messageId))throw Error('Missing message identifier.');const message=text(b.message,5,1200),old=body.issue?.messages.find(m=>m.id===b.messageId);if(old){if(old.actor!==actor||old.text!==message)throw Error('Message identifier already used.');return false;}if((body.issue?.messages.length||0)>=40&&b.action!=='resolve_issue')throw Error('This issue thread is full. Use the contact form with your order ID.');body.issue.messages.push({id:b.messageId,actor,text:message,time:now});return true;}
export function changeOrder(s,b,token,now=Date.now()){
 const current=accessOrder(s,b.id,token,b.sellerId),body=JSON.parse(s.db.prepare('SELECT body FROM market_orders WHERE id=?').get(b.id).body);let next=current.status;
 if(b.confirm!==true)throw Error('Confirm the order action.');
 if(['open_issue','issue_note','resolve_issue'].includes(b.action)){
  if(['requested','cancelled','refunded'].includes(current.status))throw Error('This request cannot open an issue; cancel a pending request or use the contact form.');
  if(b.action==='open_issue'){body.issue??={open:false,messages:[]};if(!body.issue.open){body.issue.open=true;body.issue.openedBy=current.role;}}
  if(!body.issue)throw Error('Open an issue first.');
  if(b.action==='resolve_issue'){if(body.issue.openedBy!==current.role)throw Error('Only the participant who opened the issue can mark it resolved.');if(!body.issue.open)return current;body.issue.open=false;body.issue.resolvedAt=now;}
  if(b.action==='issue_note'&&!body.issue.open)throw Error('This issue is already resolved.');
  if(!issueMessage(body,current.role,b,now))return current;
 }else if(b.action==='report_refund'){
  if(current.role!=='seller'||!body.issue?.open||!body.paymentTxid||!['payment_sent','paid','fulfilled','complete'].includes(current.status))throw Error('A full-refund report requires a paid order with an open issue.');const value=txid(b.txid);if(body.refundTxid){if(body.refundTxid!==value)throw Error('A refund reference has already been recorded.');return current;}body.refundTxid=value;
 }else if(b.action==='confirm_refund'){
  if(current.role!=='buyer'||!body.refundTxid)throw Error('No seller refund report is available.');if(current.status==='refunded')return current;next='refunded';if(body.issue){body.issue.open=false;body.issue.resolvedAt=now;}
 }else{
  const rules={accept:['seller','requested','agreed'],reject:['seller','requested','cancelled'],cancel:['buyer','requested','cancelled'],report_payment:['buyer','agreed','payment_sent'],confirm_payment:['seller','payment_sent','paid'],fulfill:['seller','paid','fulfilled'],complete:['buyer','fulfilled','complete']};const rule=rules[b.action];
  if(!rule||rule[0]!==current.role)throw Error('Action is not available for this participant.');
  if(current.status===rule[2]){if(b.action==='report_payment'&&body.paymentTxid!==txid(b.txid))throw Error('A different payment reference is already recorded.');return current;}
  if(body.issue?.open)throw Error('Resolve the open issue before continuing this order.');
  if(current.status!==rule[1])throw Error('Order status changed. Refresh before continuing.');
  if(b.action==='accept'){
   const live=s.db.prepare("SELECT body FROM market_listings WHERE id=? AND status='published' AND expires>?").get(current.listingId,now);if(!live||JSON.parse(live.body).profileId!==current.profileId)throw Error('The offer is no longer available for acceptance.');
   const address=text(b.address,20,120);if(!/^[a-zA-Z0-9]+$/.test(address))throw Error('Enter a receiving address, not a wallet key or payment URL.');
   const confirmations=Number(b.confirmations);if(!Number.isInteger(confirmations)||confirmations<1||confirmations>100)throw Error('Choose 1–100 confirmations to wait for.');
   body.payment={network:'Bitcoin BLAKE2b (XBT)',address,confirmations,instructions:text(b.instructions,10,600)};
  }
  if(b.action==='report_payment')body.paymentTxid=txid(b.txid);
  next=rule[2];
 }
 saveOrder(s,current,body,next,b.action,now);return accessOrder(s,b.id,token,b.sellerId);
}
export function marketIssues(s){return s.db.prepare("SELECT * FROM market_orders WHERE json_extract(body,'$.issue.open')=1 ORDER BY updated DESC LIMIT 100").all().map(order);}
export function supportOrderNote(s,b,now=Date.now()){const r=s.db.prepare('SELECT * FROM market_orders WHERE id=?').get(b.id);if(!r)throw Error('Order unavailable.');const body=JSON.parse(r.body);if(!body.issue?.open)throw Error('Issue is not open.');if(!issueMessage(body,'support',b,now))return {id:b.id};saveOrder(s,{id:b.id,status:r.status,role:'support'},body,r.status,'support_note',now);return {id:b.id};}
export function pruneTrades(s,now=Date.now()){s.db.prepare('DELETE FROM market_order_events WHERE order_id IN (SELECT id FROM market_orders WHERE created<?)').run(now-180*86400000);s.db.prepare('DELETE FROM market_orders WHERE created<?').run(now-180*86400000);s.db.prepare("DELETE FROM market_sellers WHERE created<? AND id NOT IN (SELECT seller_id FROM market_orders) AND id NOT IN (SELECT json_extract(body,'$.profileId') FROM market_listings WHERE json_extract(body,'$.profileId') IS NOT NULL)").run(now-365*86400000);}
