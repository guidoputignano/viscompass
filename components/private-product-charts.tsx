"use client";
import {useState} from 'react';
import {ResponsiveContainer,BarChart,Bar,LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip} from 'recharts';
import type {ProductAbcRow,Atc5Series} from '@/lib/analytics/private-pillar-product';

const n=(v:number)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:2}).format(v);
export function PrivateProductCharts({abc,series,names}:{abc:ProductAbcRow[];series:Atc5Series[];names:Record<string,string>}){
 const orgs=[...new Set(abc.map(r=>r.org_code))].sort();
 const [org,setOrg]=useState(orgs[0]);
 const years=[...new Set(abc.filter(r=>r.org_code===org).map(r=>r.year))].sort((a,b)=>a-b);
 const [selectedYear,setYear]=useState<number|null>(null);
 const year=selectedYear!==null&&years.includes(selectedYear)?selectedYear:years.at(-1);
 const rows=abc.filter(r=>r.org_code===org&&r.year===year);
 const molecules=series.filter(r=>r.org_code===org);
 const [selectedAtc,setAtc]=useState('');
 const molecule=molecules.find(r=>r.atc5===selectedAtc)??molecules[0];
 const points=molecule?.years.map((y,i)=>({year:y,cf:molecule.points[i]?.cf??null,ddd:molecule.points[i]?.ddd??null}))??[];
 const selectStyle='rounded-md border bg-background p-2 text-sm';
 return <section className="space-y-5 rounded-xl border bg-card p-5">
  <h2 className="text-xl font-semibold">Prodotti · concentrazione ABC e molecole ATC5</h2>
  <div className="flex flex-wrap gap-4">
   <label className="grid gap-1 text-sm">Azienda<select className={selectStyle} value={org} onChange={e=>setOrg(e.target.value)}>{orgs.map(o=><option key={o} value={o}>{names[o]??o}</option>)}</select></label>
   <label className="grid gap-1 text-sm">Anno ABC<select className={selectStyle} value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y}>{y}</option>)}</select></label>
  </div>
  <p className="text-sm text-muted-foreground">ABC è calcolata sulla spesa CF della singola Azienda e del singolo anno. La categoria che supera la soglia resta nella banda iniziale: A fino all’80%, B fino al 95%, C il resto, usando la quota cumulata precedente. Non misura efficacia o criticità clinica.</p>
  <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows.slice(0,12)}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="aic" tick={{fontSize:10}}/><YAxis/><Tooltip formatter={value=>[`€ ${n(Number(value))}`,'CF']}/><Bar dataKey="cf" fill="#168f89"/></BarChart></ResponsiveContainer></div>
  <p className="text-xs text-muted-foreground">Grafico: primi 12 prodotti. Tabella: tutti i {rows.length} prodotti dell’anno selezionato.</p>
  <div className="max-h-96 overflow-auto"><table className="w-full text-sm [&_td]:p-2 [&_th]:p-2 [&_th]:text-left [&_tr]:border-b"><thead><tr>{['AIC','Prodotto','ATC5','CF €','Quota','Cumulata','ABC'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.aic}><td>{r.aic}</td><td>{r.product_name}</td><td>{r.atc5}</td><td>{n(r.cf)}</td><td>{n(r.share*100)}%</td><td>{n(r.cumulativeShare*100)}%</td><td>{r.band}</td></tr>)}</tbody></table></div>
  <label className="grid max-w-sm gap-1 text-sm">Serie della molecola<select className={selectStyle} value={molecule?.atc5??''} onChange={e=>setAtc(e.target.value)}>{molecules.map(m=><option key={m.atc5}>{m.atc5}</option>)}</select></label>
  <p className="text-sm text-muted-foreground">Spesa CF e DDD per ATC5, mantenute in unità separate. N/D indica assenza di righe, non consumo zero. La classe AWaRe del singolo prodotto non è automaticamente estesa all’intera molecola.</p>
  <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={points}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="year"/><YAxis/><Tooltip formatter={value=>[`€ ${n(Number(value))}`,'CF']}/><Line dataKey="cf" stroke="#168f89" connectNulls={false}/></LineChart></ResponsiveContainer></div>
  <table className="w-full text-sm [&_td]:p-2 [&_th]:p-2 [&_th]:text-left"><thead><tr><th>Anno</th><th>CF €</th><th>DDD</th></tr></thead><tbody>{points.map(p=><tr key={p.year}><td>{p.year}</td><td>{p.cf===null?'N/D':n(p.cf)}</td><td>{p.ddd===null?'N/D':n(p.ddd)}</td></tr>)}</tbody></table>
  <p className="text-sm text-muted-foreground">ABC–VEN: nessuna classificazione clinica approvata è attualmente disponibile per questa versione. Nessun prodotto è classificato automaticamente come non essenziale.</p>
 </section>;
}
