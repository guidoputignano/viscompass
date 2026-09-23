/** Floating ranges remain correct even when an intermediate total is negative. */
export function benchmarkWaterfall(r: {baseline:number;price:number;mix:number;interaction:number;actual:number}) {
  if (Object.values(r).some(v=>!Number.isFinite(v))) throw Error('Non-finite waterfall');
  if (Math.abs(r.baseline+r.price+r.mix+r.interaction-r.actual)>.01) throw Error('Waterfall does not reconcile');
  let running=r.baseline;
  const rows=[{name:'Riferimento',range:[0,r.baseline],signed:r.baseline}];
  for(const [name,delta] of [['Costo medio',r.price],['Mix',r.mix],['Interazione',r.interaction]] as const){
    const next=running+delta;
    rows.push({name,range:[Math.min(running,next),Math.max(running,next)],signed:delta});
    running=next;
  }
  rows.push({name:'Osservato',range:[0,r.actual],signed:r.actual});
  return rows;
}
