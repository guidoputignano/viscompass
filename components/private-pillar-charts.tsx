"use client";
import {useState} from 'react';
import {ResponsiveContainer,BarChart,Bar,CartesianGrid,XAxis,YAxis,Tooltip,Legend,LineChart,Line,ReferenceLine,Cell} from 'recharts';
import {privatePillarAnalysis,type PrivateFact} from '@/lib/analytics/private-pillar-a';
import {privateComparisons} from '@/lib/analytics/private-pillar-comparison';
import {benchmarkWaterfall} from '@/lib/analytics/benchmark-waterfall';
import {PrivateDeviationPlot} from '@/components/private-deviation-plot';
const colors=['#2a78d6','#eb6834','#1baf7a','#eda100'];
const n=(v:number)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:0}).format(v);
const money=(v:number)=>`€ ${n(v)}`;
const precise=(v:number)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:6}).format(v);
const panel='rounded-xl border bg-card p-5 space-y-4';
export function PrivatePillarCharts({facts,regional}:{facts:PrivateFact[];regional:boolean}){
 const orgs=[...new Set(facts.map(r=>r.org_code))].sort();
 const [selection,setSelection]=useState('all'),[year,setYear]=useState(2025),[measure,setMeasure]=useState<'cf'|'ddd'|'share'>('cf');
 const label=(org:string)=>({'201':'ASL 1','202':'ASL 2','203':'ASL 3','204':'ASL 4'}[org]??'Azienda autorizzata');
 const selected=selection==='all'?facts:facts.filter(r=>r.org_code===selection);
 const history=privatePillarAnalysis(selected),current=history.find(r=>r.year===year)!;
 const comparisons=regional?privateComparisons(facts):[];
 const available=comparisons.filter(r=>r.available);
 const chosen=available.find(r=>r.org===(selection==='all'?orgs[0]:selection)&&r.year===year);
 const peers=available.filter(r=>r.year===year).map(r=>({...r,name:label(r.org)}));
 const composition=current.categories.map(r=>({name:{A:'Access',W:'Watch',R:'Reserve'}[r.category],value:measure==='cf'?r.cf:measure==='ddd'?r.ddd:(r.dddShare??0)*100}));
 const total=composition.reduce((s,r)=>s+r.value,0);
 let used=0;
 const waterfall=chosen?benchmarkWaterfall(chosen):[];
 const trajectories=[2023,2024,2025].map(y=>Object.fromEntries([['year',y],...orgs.map(o=>[o,available.find(r=>r.org===o&&r.year===y)?.intensityDeviation??null])]));
 return <div className="space-y-6">
  <section className={panel}><h2 className="text-xl font-semibold">Composizione e andamento · dati riservati</h2>
   <div className="flex flex-wrap gap-4">{regional&&<label>Azienda <select className="rounded border bg-background p-2" value={selection} onChange={e=>setSelection(e.target.value)}><option value="all">Perimetro autorizzato</option>{orgs.map(o=><option key={o} value={o}>{label(o)}</option>)}</select></label>}
    <label>Anno <select className="rounded border bg-background p-2" value={year} onChange={e=>setYear(Number(e.target.value))}>{[2023,2024,2025].map(y=><option key={y}>{y}</option>)}</select></label>
    <label>Misura <select className="rounded border bg-background p-2" value={measure} onChange={e=>setMeasure(e.target.value as typeof measure)}><option value="cf">Spesa CF (€)</option><option value="ddd">DDD</option><option value="share">Quota DDD (%)</option></select></label></div>
   <p className="text-sm text-muted-foreground">Ripartizione AWaRe nell’anno selezionato; le bande non rappresentano trasferimenti di pazienti o farmaci. Classificazione della fonte.</p>
   <div className="overflow-auto"><svg viewBox="0 0 850 330" className="min-w-[650px] w-full" role="img" aria-label="Sankey della composizione AWaRe">
    <rect x="170" y="45" width="14" height="220" fill="#173b49"/><text x="155" y="140" textAnchor="end" fill="currentColor">Totale {year}</text>
    <text x="155" y="163" textAnchor="end" fill="currentColor">{n(total)} {measure==='cf'?'€':measure==='share'?'%':'DDD'}</text>
    {composition.map((r,i)=>{const h=total?r.value/total*220:0,a=45+used,b=a+i*14;used+=h;return <g key={r.name}><path d={`M184 ${a} C370 ${a},400 ${b},620 ${b} L620 ${b+h} C400 ${b+h},370 ${a+h},184 ${a+h}Z`} fill={colors[i]} opacity=".5"/><rect x="620" y={b} width="14" height={h} fill={colors[i]}/><text x="650" y={b+h/2} fill="currentColor">{r.name}: {n(r.value)}</text></g>;})}
   </svg></div>
   <details><summary>Valori della composizione · {year}</summary><table className="w-full text-left text-sm [&_td]:p-2 [&_th]:p-2"><caption className="text-left">{measure==='cf'?'Spesa CF (€)':measure==='ddd'?'DDD':'Quota DDD (%)'} · {selection==='all'?'Perimetro autorizzato':label(selection)} · fino a sei decimali</caption><thead><tr><th>Categoria</th><th>Valore</th></tr></thead><tbody>{composition.map(r=><tr key={r.name}><td>{r.name}</td><td>{precise(r.value)}</td></tr>)}<tr><th>Totale</th><td>{precise(total)}</td></tr></tbody></table></details>
   <div className="h-64"><ResponsiveContainer><LineChart data={history}><CartesianGrid strokeDasharray="3 5"/><XAxis dataKey="year"/><YAxis width={80} tickFormatter={n}/><Tooltip formatter={v=>money(Number(v))}/><Line dataKey="cf" name="Spesa CF" stroke={colors[0]}/><Line dataKey="cmr" name="Valorizzazione CMR" stroke={colors[1]}/><Legend/></LineChart></ResponsiveContainer></div>
  </section>
  {regional&&<section className={panel}><h2 className="text-xl font-semibold">Confronto interno a DDD totali costanti · {year}</h2>
   <p className="text-sm text-muted-foreground">Il riferimento è il perimetro autorizzato con dati disponibili, inclusa l’Azienda selezionata. Non è un confronto nazionale. Costo medio = CF/DDD nella classe AWaRe: include mix interno alla classe, non misura il solo prezzo di acquisto. Nessuna attribuzione di colpa o risparmio.</p>
   {!chosen?<p>Confronto non disponibile: servono almeno due Aziende e DDD positive in ogni categoria.</p>:<><p>Waterfall: {label(chosen.org)}. Seleziona un’Azienda sopra per cambiare dettaglio.</p><div className="grid gap-6 xl:grid-cols-2">
    <div className="h-80"><ResponsiveContainer><BarChart data={waterfall}><CartesianGrid strokeDasharray="3 5"/><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis width={85} tickFormatter={n}/><ReferenceLine y={0}/><Tooltip formatter={(_v,_name,p)=>money(p.payload.signed)}/><Bar dataKey="range" name="CF €">{waterfall.map((r,i)=><Cell key={r.name} fill={i===0||i===4?'#617b91':colors[i-1]}/>)}</Bar></BarChart></ResponsiveContainer></div>
    <div className="h-80"><ResponsiveContainer><BarChart data={peers} stackOffset="sign"><CartesianGrid strokeDasharray="3 5"/><XAxis dataKey="name"/><YAxis width={85} tickFormatter={n}/><ReferenceLine y={0}/><Tooltip formatter={v=>money(Number(v))}/><Legend/><Bar dataKey="price" name="Costo medio" stackId="a" fill={colors[0]}/><Bar dataKey="mix" name="Mix AWaRe" stackId="a" fill={colors[1]}/><Bar dataKey="interaction" name="Interazione" stackId="a" fill={colors[2]}/></BarChart></ResponsiveContainer></div>
   </div><p className="text-sm">Riferimento {money(chosen.baseline)} + costo medio {money(chosen.price)} + mix {money(chosen.mix)} + interazione {money(chosen.interaction)} = osservato {money(chosen.actual)}.</p></>}
   <details><summary>Formule</summary><p className="text-sm">Per classe: q = DDD aziendali, p = CF/q; qᵣ = DDD totali aziendali × quota DDD del riferimento, pᵣ = CF riferimento / DDD riferimento. Costo medio = Σqᵣ(p−pᵣ); mix = Σ(q−qᵣ)pᵣ; interazione = Σ(q−qᵣ)(p−pᵣ). Le tre componenti sommano alla differenza rispetto allo scenario.</p></details>
  </section>}
  {regional&&available.length>0&&<><PrivateDeviationPlot rows={available} label={label}/><section className={panel}><h2 className="text-xl font-semibold">Componenti del confronto · dettaglio per Azienda</h2><p className="text-sm text-muted-foreground">Tre componenti rispetto al riferimento di ciascun anno. Scala in euro comune a tutte le Aziende; non è una scomposizione della variazione annua.</p><div className="grid gap-6 lg:grid-cols-2">{orgs.map(org=><div key={org}><h3 className="font-semibold">{label(org)}</h3><div className="h-64"><ResponsiveContainer><BarChart data={available.filter(r=>r.org===org)} stackOffset="sign"><CartesianGrid strokeDasharray="3 5"/><XAxis dataKey="year"/><YAxis width={85} domain={[-Math.max(1,...available.map(r=>Math.abs(r.price)+Math.abs(r.mix)+Math.abs(r.interaction))),Math.max(1,...available.map(r=>Math.abs(r.price)+Math.abs(r.mix)+Math.abs(r.interaction)))]} tickFormatter={n}/><ReferenceLine y={0}/><Tooltip formatter={v=>money(Number(v))}/><Legend/><Bar dataKey="price" name="Costo medio" stackId="a" fill={colors[0]}/><Bar dataKey="mix" name="Mix AWaRe" stackId="a" fill={colors[1]}/><Bar dataKey="interaction" name="Interazione" stackId="a" fill={colors[2]}/></BarChart></ResponsiveContainer></div></div>)}</div></section></>}
  {regional&&available.length>0&&<section className={panel}><h2 className="text-xl font-semibold">Scostamento di intensità nel tempo</h2><p className="text-sm">DDD/100 A3 dell’Azienda ÷ DDD/100 A3 del perimetro − 1. Stessa definizione e anno; zero indica il riferimento, non un obiettivo clinico.</p><div className="h-72"><ResponsiveContainer><LineChart data={trajectories}><CartesianGrid strokeDasharray="3 5"/><XAxis dataKey="year"/><YAxis tickFormatter={v=>`${n(Number(v)*100)}%`}/><ReferenceLine y={0}/><Tooltip formatter={v=>`${n(Number(v)*100)}%`}/><Legend/>{orgs.map((o,i)=><Line key={o} dataKey={o} name={label(o)} stroke={colors[i%4]} connectNulls={false}/>)}</LineChart></ResponsiveContainer></div></section>}
 </div>;
}
