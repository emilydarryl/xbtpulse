import {createHash} from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
export const marketCategories = ['mining','electronics','digital','services','other'];
export function initializeMarketplace(store) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS market_listings(id TEXT PRIMARY KEY,created INTEGER NOT NULL,updated INTEGER NOT NULL,expires INTEGER NOT NULL,status TEXT NOT NULL,token_hash TEXT NOT NULL,body TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS market_status ON market_listings(status,expires);`);
}
export function validateListing(b) {
  if (!b || b.fax || b.consent !== true) throw Error('Confirm the listing rules and permission to publish your contact details.');
  const field=(key,min,max)=>{const s=typeof b[key]==='string'?b[key].trim():'';if(s.length<min||s.length>max||/[\x00-\x08\x0b-\x1f]/.test(s))throw Error(`Please check ${key}.`);return s;};
  const title=field('title',5,100),description=field('description',30,2000),seller=field('seller',2,80),region=field('region',2,150);
  let contact=field('contact',5,250);
  const price=field('price',1,24);
  if(!/^(0|[1-9]\d{0,9})(\.\d{1,8})?$/.test(price)||BigInt(price.replace('.',''))===0n)throw Error('Enter a positive XBT price with up to 8 decimal places.');
  if(!marketCategories.includes(b.category)||!['shipping','pickup','digital'].includes(b.delivery))throw Error('Choose a category and delivery option.');
  if(!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(contact)) {
    let u;try{u=new URL(contact);}catch{throw Error('Use a public email address or HTTPS seller contact link.');}
    if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))throw Error('Use a public email address or HTTPS seller contact link.');
    contact=u.href;
  }
  return {title,description,seller,contact,region,price,category:b.category,delivery:b.delivery,consent:true};
}
function identity(id,token){if(!/^[a-f0-9-]{36}$/.test(id||'')||!/^[a-f0-9]{64}$/.test(token||''))throw Error('Invalid private listing key.');}
export function submitListing(store,b,token,now=Date.now()) {
  identity(b?.id,token);const body=validateListing(b),encoded=JSON.stringify(body);
  const old=store.db.prepare('SELECT token_hash,body,status FROM market_listings WHERE id=?').get(b.id);
  if(old){if(old.token_hash!==hash(token)||old.body!==encoded)throw Error('Submission identifier already used.');return {id:b.id,status:old.status};}
  const bucket=Math.floor(now/3600000),limit=store.get('market-intake-limit'),count=limit?.bucket===bucket?limit.count:0;
  if(count>=30)throw Error('Listing submissions are busy. Please try again in an hour.');
  store.db.prepare('INSERT INTO market_listings VALUES (?,?,?,?,?,?,?)').run(b.id,now,now,now+30*86400000,'pending',hash(token),encoded);
  store.set('market-intake-limit',{bucket,count:count+1});
  return {id:b.id,status:'pending'};
}
function publicRow(r){return {id:r.id,created:r.created,updated:r.updated,expires:r.expires,status:r.status,...JSON.parse(r.body)};}
export function marketListings(store,now=Date.now()) {
  return store.db.prepare("SELECT * FROM market_listings WHERE status='published' AND expires>? ORDER BY created DESC LIMIT 500").all(now).map(publicRow);
}
export function marketQueue(store){return store.db.prepare('SELECT * FROM market_listings ORDER BY created DESC LIMIT 500').all().map(publicRow);}
export function manageListing(store,id,token,action=null,now=Date.now()) {
  identity(id,token);
  const r=store.db.prepare('SELECT * FROM market_listings WHERE id=? AND token_hash=?').get(id,hash(token));
  if(!r)throw Error('Private listing link is unavailable.');
  if(action!==null){
    if(!['sold','withdrawn'].includes(action))throw Error('Unsupported listing action.');
    if(!['pending','published','sold','withdrawn'].includes(r.status))throw Error('This listing is closed by the moderator.');
    store.db.prepare('UPDATE market_listings SET status=?,updated=? WHERE id=?').run(action,now,id);
    r.status=action;r.updated=now;
  }
  return {...publicRow(r),expired:r.expires<=now};
}
export function moderateListing(store,id,action,now=Date.now()) {
  const r=store.db.prepare('SELECT * FROM market_listings WHERE id=?').get(id);
  if(!r||!['publish','reject','remove'].includes(action))throw Error('Unknown listing or action.');
  if(action==='publish'&&(r.status!=='pending'||r.expires<=now))throw Error('Only an unexpired pending listing can be published.');
  const status={publish:'published',reject:'rejected',remove:'removed'}[action];
  store.db.prepare('UPDATE market_listings SET status=?,updated=? WHERE id=?').run(status,now,id);
  return {id,status};
}
export function pruneMarketplace(store,now=Date.now()){store.db.prepare('DELETE FROM market_listings WHERE created<?').run(now-90*86400000);}
