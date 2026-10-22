/** Offline escrow contract prototype. No wallet, signing, broadcasting or production route. */
import {createHash,ECDH} from 'node:crypto';
const satoshis=value=>{if(typeof value!=='string'||!/^[1-9][0-9]{0,15}$/.test(value)||BigInt(value)>2100000000000000n)throw Error('Use positive integer XBT satoshis.');return BigInt(value);};
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(value);
export function escrowQuote({totalSats,networkReserveSats,feeBps=200,delivery='shipping',signatureRequired=true,carrier,shipBy,inspectionHours=72,keys}){
 const total=satoshis(totalSats),reserve=satoshis(networkReserveSats);
 if(!Number.isSafeInteger(feeBps)||feeBps<0||feeBps>1000)throw Error('Invalid marketplace fee.');
 if(!['shipping','pickup','digital'].includes(delivery))throw Error('Invalid delivery method.');
 if(delivery==='shipping'&&(signatureRequired!==true||typeof carrier!=='string'||carrier.trim().length<2))throw Error('Pilot escrow shipments require tracking, a carrier and a delivery signature.');
 if(!Number.isSafeInteger(shipBy)||shipBy<=0||!Number.isSafeInteger(inspectionHours)||inspectionHours<24||inspectionHours>336)throw Error('Choose a shipping deadline and 24–336 hour inspection period.');
 if(!keys||Object.keys(keys).length!==3||['buyer','seller','resolver'].some(role=>typeof keys[role]!=='string'||!/^(02|03)[a-f0-9]{64}$/.test(keys[role])))throw Error('Three compressed public keys are required.');
 for(const value of Object.values(keys))try{ECDH.convertKey(Buffer.from(value,'hex'),'secp256k1',undefined,undefined,'compressed');}catch{throw Error('Invalid secp256k1 public key.');}
 const publicKeys=['buyer','seller','resolver'].map(role=>keys[role]);if(new Set(publicKeys).size!==3)throw Error('Each participant needs a different key.');
 const fee=(total*BigInt(feeBps)+9999n)/10000n;if(fee>=total)throw Error('Fee consumes the sale.');
 const sorted=[...publicKeys].sort();const witnessScript='52'+sorted.map(key=>'21'+key).join('')+'53ae';
 const contract={version:1,mode:'offline-prototype',network:'XBT-BLAKE2b',totalSats:total.toString(),networkReserveSats:reserve.toString(),depositSats:(total+reserve).toString(),feeBps,feeSats:fee.toString(),sellerSats:(total-fee).toString(),delivery,signatureRequired:delivery==='shipping',trackingRequired:delivery==='shipping',carrier:delivery==='shipping'?carrier.trim():null,shipBy,inspectionHours,keys:{buyer:keys.buyer,seller:keys.seller,resolver:keys.resolver},descriptor:'wsh(sortedmulti(2,'+sorted.join(',')+'))',witnessScript,witnessScriptHash:hash(Buffer.from(witnessScript,'hex'))};
 return {...contract,contractHash:hash(canonical(contract))};
}
export function newSimulation(contract){if(contract.mode!=='offline-prototype')throw Error('Only prototype contracts are supported.');const {contractHash,...rest}=contract;if(hash(canonical(rest))!==contractHash)throw Error('Contract changed.');return {contract,state:'awaiting_funding',events:[],tracking:null,issue:null,proposal:null,approvals:[]};}
function record(sim,action,actor,now,details={}){sim.events.push({action,actor,time:now,...details});}
const participant=actor=>['buyer','seller','resolver'].includes(actor);
export function simulateAction(previous,{action,actor,now=Date.now(),...data}){
 const sim=structuredClone(previous);if(!participant(actor))throw Error('Unknown participant.');
 if(['released','refunded','split'].includes(sim.state))throw Error('This simulation has settled.');
 if(action==='observe_funding'){
  if(actor!=='resolver'||sim.state!=='awaiting_funding'||data.contractHash!==sim.contract.contractHash||data.network!=='XBT-BLAKE2b'||data.outputScript!=='0020'+sim.contract.witnessScriptHash||data.valueSats!==sim.contract.depositSats||!Number.isSafeInteger(data.confirmations)||!Number.isSafeInteger(data.requiredConfirmations)||data.requiredConfirmations<1||data.confirmations<data.requiredConfirmations)throw Error('Funding evidence must match the contract, chain, output, amount and confirmation policy.');
  sim.state='funded';
 }else if(action==='ship'){
  if(actor!=='seller'||sim.state!=='funded'||sim.issue||now>sim.contract.shipBy||sim.contract.delivery!=='shipping'||typeof data.tracking!=='string'||data.tracking.trim().length<5||data.signatureService!==true)throw Error('Shipment requires funded escrow, an open deadline, tracking and signature service.');
  sim.tracking={reference:data.tracking.trim(),signatureService:true};sim.state='shipped';
 }else if(action==='delivery_report'){
  if(actor!=='resolver'||sim.state!=='shipped'||sim.issue||data.tracking!==sim.tracking.reference||data.signatureRecorded!==true)throw Error('Signed delivery evidence must match this shipment.');
  sim.deliveryReportedAt=now;sim.inspectionEnds=now+sim.contract.inspectionHours*3600000;sim.state='inspection';
 }else if(action==='open_issue'){
  if(!['buyer','seller'].includes(actor)||sim.state==='awaiting_funding'||typeof data.reason!=='string'||data.reason.trim().length<5)throw Error('A participant must explain the issue after funding.');
  sim.issue={openedBy:actor,reason:data.reason.trim(),previousState:sim.issue?.previousState||sim.state};sim.state='disputed';sim.proposal=null;sim.approvals=[];
 }else if(action==='propose_settlement'){
  const returnSats=BigInt(data.buyerSats||'0'),sellerSats=BigInt(data.sellerSats||'0'),feeSats=BigInt(data.feeSats||'0'),minerSats=BigInt(data.minerSats||'0');
  if([returnSats,sellerSats,feeSats,minerSats].some(v=>v<0n)||returnSats+sellerSats+feeSats+minerSats!==BigInt(sim.contract.depositSats)||minerSats>BigInt(sim.contract.networkReserveSats))throw Error('Settlement outputs must conserve the deposit and respect the fee reserve.');
  if(!['funded','inspection','disputed'].includes(sim.state)||typeof data.reason!=='string'||data.reason.trim().length<5)throw Error('Settlement needs an eligible state and explanation.');
  if(sim.state==='disputed'&&actor!=='resolver')throw Error('The resolver proposes disputed outcomes.');
  if(sim.state==='inspection'&&!sim.issue){if(sellerSats!==BigInt(sim.contract.sellerSats)||feeSats!==BigInt(sim.contract.feeSats)||returnSats!==BigInt(sim.contract.networkReserveSats)-minerSats)throw Error('Normal release must include the agreed seller payout, success fee and reserve change.');}
  if(sim.state==='funded'&&(sellerSats!==0n||feeSats!==0n||returnSats!==BigInt(sim.contract.depositSats)-minerSats))throw Error('Before shipment, settlement is a refund with no success fee.');
  if(sim.state==='disputed'&&feeSats!==0n&&feeSats!==BigInt(sim.contract.feeSats))throw Error('Dispute proposal must waive or retain the agreed success fee explicitly.');
  const proposal={buyerSats:returnSats.toString(),sellerSats:sellerSats.toString(),feeSats:feeSats.toString(),minerSats:minerSats.toString(),reason:data.reason.trim(),contractHash:sim.contract.contractHash};sim.proposal={...proposal,hash:hash(canonical(proposal))};sim.approvals=[];
 }else if(action==='approve_settlement'){
  if(!sim.proposal||data.proposalHash!==sim.proposal.hash)throw Error('Approve the exact settlement proposal.');
  if(!sim.approvals.includes(actor))sim.approvals.push(actor);
 }else if(action==='settle'){
  if(actor!=='resolver'||!sim.proposal||data.proposalHash!==sim.proposal.hash||new Set(sim.approvals).size<2)throw Error('Two independent simulated approvals are required.');
  if(sim.state==='inspection'&&(!sim.approvals.includes('buyer')||!sim.approvals.includes('seller')))throw Error('Normal release requires buyer and seller; silence is reviewed through a dispute.');
  if(sim.state==='disputed'&&(!sim.approvals.includes('resolver')||!sim.approvals.some(v=>['buyer','seller'].includes(v))))throw Error('A disputed outcome requires the resolver and a participant.');
  if(sim.state==='funded'&&(!sim.approvals.includes('buyer')||!sim.approvals.includes('seller')))throw Error('A cooperative pre-shipment refund requires both parties.');
  sim.state=sim.proposal.sellerSats==='0'?'refunded':sim.proposal.buyerSats===String(BigInt(sim.contract.networkReserveSats)-BigInt(sim.proposal.minerSats))?'released':'split';
 }else throw Error('Unsupported simulation action.');
 record(sim,action,actor,now,{note:'Simulation only; approvals are not signatures and funding is not independently verified.'});return sim;
}
