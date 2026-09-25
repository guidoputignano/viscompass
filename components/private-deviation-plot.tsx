"use client";
import {itNumberFormat} from "@/lib/format/it-number";
type Point={org:string;year:number;intensityDeviation:number;costDeviation:number|null};
const palette=['#2a78d6','#eb6834','#1baf7a','#eda100'];
const percent=(v:number)=>itNumberFormat({style:'percent',maximumFractionDigits:2}).format(v);
export function PrivateDeviationPlot({rows,label}:{rows:Point[];label:(org:string)=>string}){
 const points=rows.filter((r):r is Point & {costDeviation:number}=>r.costDeviation!==null);
 if(!points.length)return <p>Scostamenti non disponibili: riferimento senza costo medio positivo.</p>;
 const orgs=[...new Set(points.map(r=>r.org))];
 const limit=Math.max(.05,...points.flatMap(r=>[Math.abs(r.intensityDeviation),Math.abs(r.costDeviation)]))*1.15;
 const x=(v:number)=>350+v/limit*260,y=(v:number)=>235-v/limit*165;
 return <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Traiettorie degli scostamenti · 2023–2025</h2>
 <p className="text-sm text-muted-foreground">Asse X: scostamento DDD/100 A3; asse Y: scostamento CF/DDD. Ogni valore è il rapporto Azienda/perimetro nello stesso anno meno uno. Il riferimento include l’Azienda. I quadranti descrivono differenze, non qualità clinica o risparmi.</p>
 <svg viewBox="0 0 700 480" role="img" aria-label="Traiettorie di intensità e costo medio per Azienda; valori nella tabella seguente" className="w-full">
 {[-1,-.5,0,.5,1].map(t=><g key={t}><line x1={x(t*limit)} x2={x(t*limit)} y1="70" y2="400" stroke="currentColor" opacity={t===0?.5:.12}/><line x1="90" x2="610" y1={y(t*limit)} y2={y(t*limit)} stroke="currentColor" opacity={t===0?.5:.12}/><text x={x(t*limit)} y="423" textAnchor="middle" fill="currentColor" fontSize="11">{percent(t*limit)}</text><text x="83" y={y(t*limit)+4} textAnchor="end" fill="currentColor" fontSize="11">{percent(t*limit)}</text></g>)}
 <text x="350" y="455" textAnchor="middle" fill="currentColor">Scostamento DDD/100 A3</text><text x="350" y="30" textAnchor="middle" fill="currentColor">Scostamento CF/DDD</text>
 {orgs.map((org,i)=>{const sequence=points.filter(r=>r.org===org).sort((a,b)=>a.year-b.year);return <g key={org}><polyline points={sequence.map(r=>`${x(r.intensityDeviation)},${y(r.costDeviation)}`).join(' ')} fill="none" stroke={palette[i%4]} strokeWidth="2"/>{sequence.map(r=><g key={r.year}><circle cx={x(r.intensityDeviation)} cy={y(r.costDeviation)} r="5" fill={palette[i%4]}><title>{label(org)} · {r.year}: {percent(r.intensityDeviation)}, {percent(r.costDeviation)}</title></circle><text x={x(r.intensityDeviation)+8} y={y(r.costDeviation)-8} fontSize="11" fill="currentColor">{r.year}</text></g>)}</g>;})}
 </svg><div className="flex flex-wrap gap-4">{orgs.map((org,i)=><span key={org} className="flex items-center gap-2"><span className="size-3 rounded-full" style={{background:palette[i%4]}}/>{label(org)}</span>)}</div>
 <details><summary>Valori e anni delle traiettorie</summary><div className="overflow-auto"><table className="w-full text-sm text-left [&_td]:p-2 [&_th]:p-2"><thead><tr><th>Azienda</th><th>Anno</th><th>Scostamento DDD/100 A3</th><th>Scostamento CF/DDD</th></tr></thead><tbody>{rows.map(r=><tr key={`${r.org}/${r.year}`}><td>{label(r.org)}</td><td>{r.year}</td><td>{percent(r.intensityDeviation)}</td><td>{r.costDeviation===null?'N/D':percent(r.costDeviation)}</td></tr>)}</tbody></table></div></details></section>;
}
