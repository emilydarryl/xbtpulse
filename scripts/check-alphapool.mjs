// Read an export containing only normalized public block observations.
// Usage: node scripts/check-alphapool.mjs blocks.json [end-height]
import { readFileSync } from 'node:fs';
import { validateChain } from '../lib/collector.mjs';
const address = 'bc1qlrmjpgg0e5jrhmzyjmtgc6dfpdr66sps8vjl2q';
const end = Number(process.argv[3] || 971931);
const input = JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
const blocks = input.filter(b => b.height <= end).sort((a,b) => b.height-a.height);
validateChain(blocks);
if (!blocks.length || blocks[0].height !== end) throw Error('Requested tip is not covered');
const matches = blocks.filter(b => b.outputs.filter(o=>o.sats>0).length===1 && b.outputs.some(o=>o.address===address && o.sats>0));
const groups = {};
for (const b of matches) {
  const label = b.tag.includes('CEO of LukeCoin') ? 'CEO of LukeCoin' : b.tag.includes('Test Test') ? 'Test Test' : b.tag.includes('AlphaPool') ? 'AlphaPool-containing tag' : 'Other tag';
  const g = groups[label] ||= { count:0, examples:[] };
  g.count++;
  if(g.examples.length<2) g.examples.push({height:b.height,hash:b.hash,tag:b.tag,outputs:b.outputs,explorerLabel:b.reportedPool?.name});
}
console.log(JSON.stringify({
  address, requestedEnd:end, retainedStart:blocks.at(-1).height, observedBlocks:blocks.length,
  activationHeight:961640, coversActivation:blocks.at(-1).height===961640,
  source:[...new Set(blocks.map(b=>b.source))], addressMatchedBlocks:matches.length, groups,
  alphaTaggedElsewhere:blocks.filter(b=>b.tag.includes('AlphaPool')&&!matches.includes(b)).length,
  scope:'Single positive coinbase output to the exact address; not an ownership or template-control proof. No spend analysis.'
},null,2));
