// Display-only text rules. Never use these groups for pool attribution.
const names = [
 ['AlphaPool', /alphapool/i], ['Lazarus', /lazarus/i],
 ['Bitcoin Xor', /bitcoin\s+xor|xorpool\.com/i], ['CONVOY', /convoy/i],
 ['B2Pool', /b2pool(?:\.io)?/i], ['RIPTIDE', /riptide/i],
 ['Quai Network', /quai\s+network/i], ['PyBLOCK', /pyblock/i],
 ['OmegaPool', /omegapool\.tech/i], ['nodeStratum', /nodestratum/i],
 ['CEO of LukeCoin', /ceo\s+of\s+lukecoin/i], ['Test Test', /test\s+test/i],
 ['RATUM', /ratum/i], ['Mining-Dutch', /mining[- ]dutch/i],
 ['Blockvase', /blockvase/i], ['Soveroot', /soveroot/i],
];
export function readableTag(tag) {
 if (!tag) return 'No recorded tag';
 const matches = names.filter(([,re]) => {
   const bounded = new RegExp('(?:^|[^a-z0-9])(?:'+re.source+')(?![a-z0-9])','i');
   return bounded.test(tag);
 }).map(([name])=>name);
 return matches.length ? matches.join(' + ') : 'Unclassified tag text';
}
export function readableTagGroups(tags) {
 const groups=new Map();
 for(const t of tags){
  const name=readableTag(t.tag);
  if(!groups.has(name))groups.set(name,{id:'readable:'+name,name,blocks:0,share:0,variants:0,unknown:name==='No recorded tag'||name==='Unclassified tag text'});
  const g=groups.get(name);g.blocks+=t.blocks;g.share+=t.share;g.variants++;
 }
 return [...groups.values()].sort((a,b)=>b.blocks-a.blocks||a.name.localeCompare(b.name));
}
