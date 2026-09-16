// Offline, operator-run pilot. Never exposes an arbitrary-target network API.
import net from 'node:net';
import {lookup} from 'node:dns/promises';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {publicIPv4} from '../lib/public-source.mjs';
import {inspectJob,compareEndpoints} from '../lib/endpoint-inspection.mjs';

const input=process.argv[2], output=process.argv[3];
if(!input||!output)throw Error('Usage: node scripts/inspect-endpoints.mjs manifest.json report.json');
const manifest=JSON.parse(await readFile(input,'utf8'));
if(manifest.pools.length!==10)throw Error('Pilot requires ten reviewed rows');
// Fresh throwaway address for protocol authorization; no wallet, user credentials or shares are used.
const body=Buffer.concat([Buffer.from([0]),randomBytes(20)]);
const sha=b=>createHash('sha256').update(b).digest();
const addressBytes=Buffer.concat([body,sha(sha(body)).subarray(0,4)]);
let n=BigInt('0x'+addressBytes.toString('hex')),address='';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
while(n){address=alphabet[Number(n%58n)]+address;n/=58n;}
for(const byte of addressBytes){if(byte!==0)break;address='1'+address;}
const worker=address+'.xbtpulse-inspection';
const report={...manifest,startedAt:new Date().toISOString(),probeVersion:1,
  method:'Two bounded rounds, 30 seconds apart after completion; up to 50 seconds per endpoint, one public IPv4 address per hostname. Subscribe and authorize only. No shares submitted. Latest 12 distinct sampled jobs retained per run. No port scanning or DATUM handshake.',
  pools:manifest.pools.map(p=>({...p,runs:[]}))};
async function probe(p,round){
  const result={round,startedAt:new Date().toISOString(),jobs:[],authorized:null,subscribed:false,status:'no-response'};
  let addresses,dnsTimer;
  try{addresses=await Promise.race([lookup(p.host,{family:4,all:true}).then(rows=>rows.map(r=>r.address)),new Promise((_,reject)=>{dnsTimer=setTimeout(()=>reject(Error('DNS timeout')),5000);})]);}
  catch{return {...result,status:'dns-unavailable',finishedAt:new Date().toISOString()};}
  finally{clearTimeout(dnsTimer);}
  if(!addresses.length||addresses.some(a=>!publicIPv4(a)))return {...result,status:'non-public-address-refused',finishedAt:new Date().toISOString()};
  if(!Number.isInteger(p.port)||p.port<1||p.port>65535)throw Error('Invalid reviewed port');
  return new Promise(resolve=>{
    let buffer='',bytes=0,lines=0,done=false,subscription;
    const socket=net.createConnection({host:addresses[0],port:p.port});
    const finish=status=>{if(done)return;done=true;clearTimeout(timer);socket.destroy();result.status=status;result.finishedAt=new Date().toISOString();resolve(result);};
    const timer=setTimeout(()=>finish(result.jobs.length?'jobs-observed':result.authorized===false?'authorization-refused':'no-job-observed'),50000);
    socket.on('connect',()=>socket.write(JSON.stringify({id:1,method:'mining.subscribe',params:['XBTPulse-Inspection/0.1']})+'\n'));
    socket.on('error',()=>finish('connection-error'));
    socket.on('end',()=>finish(result.jobs.length?'jobs-observed':'connection-closed'));
    socket.on('data',chunk=>{
      bytes+=chunk.length;if(bytes>262144)return finish('response-limit');buffer+=chunk.toString('utf8');
      while(buffer.includes('\n')){
        const at=buffer.indexOf('\n'),line=buffer.slice(0,at);buffer=buffer.slice(at+1);
        if(++lines>256)return finish('response-limit');
        let msg;try{msg=JSON.parse(line);}catch{return finish('unsupported-response');}
        if(!msg||typeof msg!=='object'||Array.isArray(msg))return finish('unsupported-response');
        if(msg.id===1){
          result.subscribed=Array.isArray(msg.result);
          if(!result.subscribed)return finish('subscription-refused');
          subscription={extra1:msg.result[1],extra2Size:msg.result[2]};
          socket.write(JSON.stringify({id:2,method:'mining.authorize',params:[worker,'x']})+'\n');
        }
        if(msg.id===2)result.authorized=msg.result===true;
        if(msg.method==='mining.notify'){
          const job={observedAt:new Date().toISOString(),...inspectJob(msg.params,subscription)};
          if(!result.jobs.some(j=>j.jobDigest===job.jobDigest)){result.jobs.push(job);if(result.jobs.length>12)result.jobs.shift();}
        }
      }
    });
  });
}
for(let round=1;round<=2;round++){
  const eligible=report.pools.filter(p=>p.host);
  // One short connection per eligible endpoint; all targets start in the same round.
  await Promise.all(eligible.map(async p=>{p.runs.push(await probe(p,round));console.log(p.name,round,p.runs.at(-1).status);}));
  report.matches=compareEndpoints(report.pools);report.updatedAt=new Date().toISOString();
  await writeFile(output,JSON.stringify(report,null,2)+'\n');
  if(round===1)await new Promise(r=>setTimeout(r,30000));
}
report.finishedAt=new Date().toISOString();await writeFile(output,JSON.stringify(report,null,2)+'\n');
