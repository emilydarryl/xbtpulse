import {createHash} from 'node:crypto';

const hex = value => typeof value === 'string' && value.length % 2 === 0 && /^[a-f0-9]*$/i.test(value);
export const digest = value => createHash('sha256').update(value).digest('hex');

// A short BLAKE2b work commitment is not a serialized coinbase transaction.
// Only parse complete, bounded Bitcoin-style coinbase transactions.
export function coinbaseOutputs(raw) {
  if (!hex(raw) || raw.length > 200000) throw Error('Invalid transaction encoding');
  const b=Buffer.from(raw,'hex'); let at=0;
  const take=n=>{if(n<0||at+n>b.length)throw Error('Truncated transaction');const v=b.subarray(at,at+n);at+=n;return v;};
  const count=()=>{const n=take(1)[0];if(n<253)return n;if(n===253)return take(2).readUInt16LE();if(n===254)return take(4).readUInt32LE();throw Error('Oversized count');};
  const version=take(4).readUInt32LE();if(version!==1&&version!==2)throw Error('Unsupported transaction version');
  let witness=false;
  if(b[at]===0&&b[at+1]===1){take(2);witness=true;}
  if(count()!==1)throw Error('Not a coinbase');
  if(!take(32).equals(Buffer.alloc(32))||take(4).readUInt32LE()!==0xffffffff)throw Error('Not a coinbase');
  const scriptSize=count();if(scriptSize<2||scriptSize>1000)throw Error('Unsupported coinbase input');
  take(scriptSize);take(4);
  const n=count();if(n<1||n>512)throw Error('Unsupported output count');
  const outputs=[];
  for(let i=0;i<n;i++){
    const sats=take(8).readBigUInt64LE();
    if(sats>21000000n*100000000n)throw Error('Invalid output amount');
    const size=count();if(size>10000)throw Error('Oversized script');
    outputs.push({sats:String(sats),script:take(size).toString('hex')});
  }
  if(witness){const n=count();if(n>100)throw Error('Oversized witness');for(let i=0;i<n;i++){const size=count();if(size>10000)throw Error('Oversized witness');take(size);}}
  take(4);if(at!==b.length)throw Error('Trailing transaction bytes');
  return outputs;
}

export function inspectJob(params, subscription) {
  if(!Array.isArray(params)||params.length<9) return {format:'unsupported',payoutVisibility:'Unavailable: unrecognized job layout'};
  const [job,previous,part1,part2,branches,version,bits,time,clean]=params;
  const base={jobDigest:digest(JSON.stringify(params)),previousField:typeof previous==='string'?previous.slice(0,128):null,
    part1Bytes:hex(part1)?part1.length/2:null,part2Bytes:hex(part2)?part2.length/2:null,
    timeBytes:hex(time)?time.length/2:null,branchCount:Array.isArray(branches)?branches.length:null};
  if(hex(part1)&&[35,39].includes(part1.length/2)&&part2===''&&hex(time)&&time.length===16)
    return {...base,format:'blake2b-commitment',payoutVisibility:'Unavailable: job exposes a short work commitment, not the payout transaction'};
  if(!hex(part1)||!hex(part2)||!hex(subscription?.extra1)||!Number.isInteger(subscription?.extra2Size)||subscription.extra2Size<0||subscription.extra2Size>32)
    return {...base,format:'unparsed',payoutVisibility:'Unavailable: missing or unsupported transaction/extranonce fields'};
  try {
    const outputs=coinbaseOutputs(part1+subscription.extra1+'00'.repeat(subscription.extra2Size)+part2);
    const payoutScripts=[...new Set(outputs.filter(o=>BigInt(o.sats)>0n).map(o=>o.script))].sort();
    return {...base,format:'serialized-coinbase',payoutVisibility:'Payout scripts decoded from sampled job',outputs,payoutScripts,
      payoutScriptDigest:digest(JSON.stringify(payoutScripts))};
  } catch {
    return {...base,format:'unparsed',payoutVisibility:'Unavailable: payload did not validate as a supported coinbase transaction'};
  }
}

export function compareEndpoints(rows) {
  const matches=[];
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
    const a=rows[i],b=rows[j];
    // Compare only within the same round. Shared previous-block fields are not evidence of shared work.
    const rounds=[];
    for(const x of a.runs||[]){const y=(b.runs||[]).find(y=>y.round===x.round);if(!y)continue;
      const scripts=x.jobs.filter(j=>j.payoutScripts?.length).flatMap(j=>j.payoutScripts);
      const other=new Set(y.jobs.flatMap(j=>j.payoutScripts||[]));
      const common=[...new Set(scripts.filter(s=>other.has(s)))];
      if(common.length)rounds.push({round:x.round,scripts:common});
    }
    if(rounds.length)matches.push({poolIds:[a.id,b.id],rounds,meaning:'Shared payout scripts observed; this does not establish proxying, common ownership or template control'});
  }
  return matches;
}
