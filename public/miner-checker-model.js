export function explainSetup(pool,mode){
 if(!['hosted','gateway'].includes(mode))throw Error('Choose a connection method');
 const p=pool.profile;
 return {
 private:p?.poolType==='private',
 path:mode==='hosted'?['Your miner','Selected operator’s hosted service','XBT network']:['Your miner','Your DATUM gateway','Selected upstream operator','XBT network'],
 template:mode==='hosted'?'With hosted work, your miner receives jobs from the service. The actual template builder and any upstream dependency still need evidence.':'Your own gateway can provide a place to construct templates locally. This selection does not establish that local construction is configured, active or independent.',
 templateClaim:p?.template||'No published template-role claim.',
 payout:p?.payout||'No published payout description.',
 fee:p?.poolType==='private'?'Not applicable — private operator; not accepting miners.':p?.fee||'No published fee terms.',
 protocols:p?.protocols||'No published protocol description.',
 upstream:pool.id==='explorer:soveroot'?'Reviewed snapshot: Soveroot’s gateway identified Lazarus as upstream on September 13, 2026. This does not establish its current connection, template independence or payout role.':'No reviewed connection map is available for this selected setup.',
 provenance:!p?'No published profile terms':p.provenance==='public-research'?'Public-source research':'Operator-provided profile',
 reviewedAt:p?.reviewedAt||null
 };
}
