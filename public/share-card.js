// Public comparison snapshots only. No network calls or external image assets.
const value=v=>v===null||v===undefined||v===''?'Not provided':String(v);
const percent=v=>v===null||v===undefined?'Not available':(v*100).toFixed(1)+'%';
const date=v=>!v?'Not reviewed':/^\d{4}-\d{2}-\d{2}$/.test(String(v))?String(v)+' UTC':new Date(v).toISOString().replace('T',' ').replace(/\.\d{3}Z$/,' UTC');
export function cardSnapshot(pools,window,createdAt=new Date().toISOString()){
 if(pools.length<2||pools.length>3||pools.some(p=>p.unavailable)||![144,576,2016].includes(Number(window)))throw Error('Load two or three pools before exporting');
 const terms=(p,key)=>p.profile?.poolType==='private'?'N/A — private pool':value(p.profile?.[key]);
 const score=(p,axis)=>p.scorecard?.totals?.[axis]===null||p.scorecard?.totals?.[axis]===undefined?'Not assessed':`${p.scorecard.totals[axis]}/100 · ${p.freshness?.assessment.status||'Review date unavailable'}`;
 const rows=[
 ['Observed block share',p=>percent(p.share)],
 ['Blocks / observations',p=>`${p.blocks??'Not attributed'} / ${p.sample}`],
 ['95% sampling interval',p=>p.interval?p.interval.map(percent).join(' – '):'Not available'],
 ['Fees (%) · sourced terms',p=>terms(p,'fee')],
 ['Payout method',p=>terms(p,'payout')],
 ['Protocols · sourced claim',p=>value(p.profile?.protocols)],
 ['Linked telemetry',p=>p.freshness?.telemetry?.length?p.freshness.telemetry.map(t=>`${t.name}: ${t.status}`).join('; '):'No reviewed provider link'],
 ['Decentralization',p=>score(p,'decentralization')],
 ['Transparency',p=>score(p,'transparency')],
 ['Terms review & provenance',p=>!p.profile?'No published terms':`${date(p.profile.reviewedAt)} · ${p.profile.provenance==='public-research'?'Public research':'Operator-provided'} · ${p.freshness?.profile.status||'Review status unavailable'}`],
 ['Chain source freshness',p=>`${p.status} · ${date(p.updatedAt)}`]
 ];
 const params=new URLSearchParams();pools.forEach(p=>params.append('pool',p.id));params.set('window',String(window));
 return {createdAt:date(createdAt),window:Number(window),url:'https://xbtpulse.tech/compare?'+params,
  names:pools.map(p=>p.name),types:pools.map(p=>p.profile?.poolType==='private'?'Private · not accepting miners':value(p.profile?.poolType)),
  rows:rows.map(([label,render])=>({label,values:pools.map(render)})),
  sources:pools.map(p=>({name:p.name,urls:[...new Set(['https://xbtpulse.tech/pool?id='+encodeURIComponent(p.id),...(p.profile?.sources||[]).map(s=>s.url).filter(u=>{try{return new URL(u).protocol==='https:';}catch{return false;}})])]})),
  warning:new Set(pools.map(p=>`${p.sample}:${p.updatedAt}`)).size>1?'Source snapshots differ; compare with caution.':'Common observation window; snapshot times shown below.'};
}
export function renderCard(snapshot){
 const canvas=document.createElement('canvas');canvas.width=1500;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas is unavailable');
 const margin=48,labelWidth=280,colWidth=(1500-2*margin-labelWidth)/snapshot.names.length;
 const font=(size,bold=false)=>{ctx.font=`${bold?'600':'400'} ${size}px Arial, sans-serif`;};
 const lines=(text,width,max=100)=>{
  const result=[];let current='';
  for(const token of String(text).split(/\s+/)){
   if(ctx.measureText(current+(current?' ':'')+token).width<=width){current+=(current?' ':'')+token;continue;}
   if(current){result.push(current);current='';}
   for(const ch of token){if(ctx.measureText(current+ch).width>width){result.push(current);current='';}current+=ch;}
  }
  if(current)result.push(current);
  if(result.length>max){result.length=max;let last=result[max-1];while(ctx.measureText(last+'…').width>width)last=last.slice(0,-1);result[max-1]=last+'…';}
  return result;
 };
 font(23);
 const rows=snapshot.rows.map(r=>({...r,labelLines:lines(r.label,labelWidth-28,3),cells:r.values.map(v=>lines(v,colWidth-30,4))}));
 rows.forEach(r=>r.height=Math.max(r.labelLines.length,...r.cells.map(c=>c.length))*30+30);
 font(19);
 const sourceLines=snapshot.sources.flatMap(s=>[...lines(s.name+':',1404),...s.urls.flatMap(u=>lines(u,1404))]);
 const urlLines=lines(snapshot.url,1404);
 canvas.height=330+rows.reduce((n,r)=>n+r.height,0)+230+(sourceLines.length+urlLines.length)*25;
 ctx.fillStyle='#f5f7f2';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f7931a';ctx.fillRect(0,0,1500,10);
 const draw=(text,x,y,size=23,color='#163a31',bold=false)=>{font(size,bold);ctx.fillStyle=color;ctx.fillText(text,x,y);};
 draw('XBT PULSE',margin,72,32,'#a64b00',true);draw('Pool comparison',margin,126,42,'#163a31',true);
 draw(`Last ${snapshot.window.toLocaleString()} network blocks · Created ${snapshot.createdAt}`,margin,170,23);
 draw(snapshot.warning,margin,206,21,'#655c3d');
 snapshot.names.forEach((name,i)=>{const x=margin+labelWidth+i*colWidth;font(27,true);lines(name,colWidth-25,2).forEach((s,j)=>draw(s,x,264+j*30,27,'#163a31',true));draw(snapshot.types[i],x,316,18,'#52675f');});
 let y=334;
 rows.forEach((r,index)=>{ctx.fillStyle=index%2?'#f5f7f2':'#ffffff';ctx.fillRect(margin,y,1404,r.height);r.labelLines.forEach((s,j)=>draw(s,margin+12,y+30+j*30,22,'#52675f',true));r.cells.forEach((cell,i)=>cell.forEach((s,j)=>draw(s,margin+labelWidth+i*colWidth,y+30+j*30,23)));y+=r.height;});
 y+=36;draw('Block share is not decentralization. Missing evidence stays unassessed.',margin,y,22,'#163a31',true);
 y+=30;draw('Fees and protocols are dated claims. Scores require published reviewer assessments.',margin,y,21,'#52675f');
 y+=30;draw('Long fields may be shortened; full evidence and terms are linked below.',margin,y,20,'#52675f');
 y+=38;draw('Sources & full profiles',margin,y,22,'#163a31',true);
 sourceLines.forEach(line=>{y+=25;draw(line,margin,y,19,'#52675f');});
 y+=35;draw('Reopen this comparison (live data may change):',margin,y,20,'#a64b00',true);
 urlLines.forEach(line=>{y+=25;draw(line,margin,y,19,'#52675f');});
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Comparison of ${snapshot.names.join(', ')} over ${snapshot.window} blocks, created ${snapshot.createdAt}.`);
 return canvas;
}
