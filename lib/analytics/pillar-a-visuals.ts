export type PublicAnnual = {year:number;region:string;group:string;channel:string;spend:number|null;packs:number|null;missingSpendCells:number;missingPackCells:number};

export function expenditureBridge(before:PublicAnnual|undefined,after:PublicAnnual|undefined){
  if(!before||!after||after.year!==before.year+1||before.region!==after.region||before.group!==after.group||before.channel!==after.channel)return null;
  if([before,after].some(r=>r.spend===null||r.packs===null||!Number.isFinite(r.spend)||!Number.isFinite(r.packs)||r.spend<0||r.packs<=0))return null;
  const start=before.spend!,end=after.spend!,q0=before.packs!,q1=after.packs!;
  const p0=start/q0,p1=end/q1;
  const volume=(q1-q0)*(p0+p1)/2;
  const average=(p1-p0)*(q0+q1)/2;
  if(Math.abs(end-start-volume-average)>Math.max(.01,Math.abs(end)*1e-10))throw Error('Expenditure bridge does not reconcile');
  return {start,end,volume,average,intermediate:start+volume,missingCells:before.missingSpendCells+before.missingPackCells+after.missingSpendCells+after.missingPackCells};
}

export function spendingComposition(rows:PublicAnnual[],region:string,year:number){
  const channels=['direct','convenzionata'],groups=['antibiotics','antifungals'];
  const links=[];
  for(let source=0;source<2;source++)for(let target=0;target<2;target++){
    const match=rows.filter(r=>r.region===region&&r.year===year&&r.channel===channels[source]&&r.group===groups[target]);
    if(match.length!==1||match[0].spend===null||!Number.isFinite(match[0].spend)||match[0].spend<0)return null;
    links.push({source,target,value:match[0].spend});
  }
  const total=links.reduce((s,l)=>s+l.value,0);
  return total>0?{links,total}:null;
}
