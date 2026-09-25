"use client";
import {itNumberFormat} from "@/lib/format/it-number";
import {placeLabels} from "@/lib/charts/label-placement";
type Point={org:string;year:number;intensityDeviation:number;costDeviation:number|null};
const palette=['#2a78d6','#eb6834','#1baf7a','#eda100'];
const percent=(v:number)=>itNumberFormat({style:'percent',maximumFractionDigits:2}).format(v);

// Year labels used to sit at a fixed +8/-8 from every point, so where the
// trajectories converge near the origin they printed over each other and read
// as "20242024". Only the first and last year of each trajectory is labelled
// now — they carry the direction, and the middle years are in the hover title
// and the table — and placeLabels drops any that still cannot find room rather
// than stacking them. See lib/charts/label-placement.ts.
// An SVG <title> must hold ONE text child. React 19 treats <title> as
// hoistable document metadata, and a title built from several adjacent
// expressions ({a} · {b}: {c}) server-renders with comment separators between
// the text nodes while the client builds a different child list — React then
// reports "Hydration failed because the server rendered HTML didn't match the
// client" and regenerates the subtree. It is recoverable, so the page still
// works and the only symptom in production is a minified #418 in the console.
// Build the string first and pass it as a single child.
export function PrivateDeviationPlot({rows,label}:{rows:Point[];label:(org:string)=>string}){
 const points=rows.filter((r):r is Point & {costDeviation:number}=>r.costDeviation!==null);
 if(!points.length)return <p>Scostamenti non disponibili: riferimento senza costo medio positivo.</p>;
 const orgs=[...new Set(points.map(r=>r.org))];
 const limit=Math.max(.05,...points.flatMap(r=>[Math.abs(r.intensityDeviation),Math.abs(r.costDeviation)]))*1.15;
 const x=(v:number)=>350+v/limit*260,y=(v:number)=>235-v/limit*165;
 const series=orgs.map(org=>points.filter(r=>r.org===org).sort((a,b)=>a.year-b.year));
 // Endpoints only, in a stable org-then-year order so placement is reproducible.
 const labels=placeLabels(series.flatMap(s=>(s.length>1?[s[0],s[s.length-1]]:s)
   .map(r=>({text:String(r.year),cx:x(r.intensityDeviation),cy:y(r.costDeviation)}))));
 return <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Traiettorie degli scostamenti · 2023–2025</h2>
 <p className="text-sm text-muted-foreground">Asse X: scostamento DDD/100 A3; asse Y: scostamento CF/DDD. Ogni valore è il rapporto Azienda/perimetro nello stesso anno meno uno. Il riferimento include l’Azienda. I quadranti descrivono differenze, non qualità clinica o risparmi. Sono indicati solo il primo e l’ultimo anno di ogni traiettoria; tutti i valori sono nella tabella.</p>
 <svg viewBox="0 0 700 480" role="img" aria-label="Traiettorie di intensità e costo medio per Azienda; valori nella tabella seguente" className="w-full">
 {[-1,-.5,0,.5,1].map(t=><g key={t}><line x1={x(t*limit)} x2={x(t*limit)} y1="70" y2="400" stroke="currentColor" opacity={t===0?.5:.12}/><line x1="90" x2="610" y1={y(t*limit)} y2={y(t*limit)} stroke="currentColor" opacity={t===0?.5:.12}/><text x={x(t*limit)} y="423" textAnchor="middle" fill="currentColor" fontSize="11">{percent(t*limit)}</text><text x="83" y={y(t*limit)+4} textAnchor="end" fill="currentColor" fontSize="11">{percent(t*limit)}</text></g>)}
 <text x="350" y="455" textAnchor="middle" fill="currentColor">Scostamento DDD/100 A3</text><text x="350" y="30" textAnchor="middle" fill="currentColor">Scostamento CF/DDD</text>
 {series.map((sequence,i)=><g key={orgs[i]}><polyline points={sequence.map(r=>`${x(r.intensityDeviation)},${y(r.costDeviation)}`).join(' ')} fill="none" stroke={palette[i%4]} strokeWidth="2"/>{sequence.map(r=><circle key={r.year} cx={x(r.intensityDeviation)} cy={y(r.costDeviation)} r="5" fill={palette[i%4]}><title>{`${label(orgs[i])} · ${r.year}: ${percent(r.intensityDeviation)}, ${percent(r.costDeviation)}`}</title></circle>)}</g>)}
 {/* Drawn after every trajectory so no line crosses a label. */}
 {labels.map((l,i)=><text key={i} x={l.lx} y={l.ly} textAnchor={l.anchor} fontSize="11" fill="currentColor">{l.text}</text>)}
 </svg><div className="flex flex-wrap gap-4">{orgs.map((org,i)=><span key={org} className="flex items-center gap-2"><span className="size-3 rounded-full" style={{background:palette[i%4]}}/>{label(org)}</span>)}</div>
 <details><summary>Valori e anni delle traiettorie</summary><div className="overflow-auto"><table className="w-full text-sm text-left [&_td]:p-2 [&_th]:p-2"><thead><tr><th>Azienda</th><th>Anno</th><th>Scostamento DDD/100 A3</th><th>Scostamento CF/DDD</th></tr></thead><tbody>{rows.map(r=><tr key={`${r.org}/${r.year}`}><td>{label(r.org)}</td><td>{r.year}</td><td>{percent(r.intensityDeviation)}</td><td>{r.costDeviation===null?'N/D':percent(r.costDeviation)}</td></tr>)}</tbody></table></div></details></section>;
}
