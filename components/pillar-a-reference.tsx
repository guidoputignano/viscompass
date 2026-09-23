"use client";

import { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

type Candidate = {atc5:string; ingredient_or_reference_names:string; aware:string; aware_status:string};
const awareLabel=(r:Candidate)=>r.aware||(r.aware_status==='not_applicable'?'Non applicabile':r.aware_status==='ambiguous_or_non_aware_reference'?'Da disambiguare':'Non trovato nel riferimento');
// Categorical slots 1-3 of the validated theme. Access/Watch/Reserve is an
// identity split, not a ranking, so no traffic-light ramp is used here.
const AWARE_COLORS:Record<string,string>={Access:"#2a78d6",Watch:"#eb6834",Reserve:"#1baf7a"};
const CLASSIFIED=["Access","Watch","Reserve"];
const RESIDUAL=["Da disambiguare","Non trovato nel riferimento","Non applicabile"];
const tipStyle={borderRadius:12,border:"1px solid #d5e3e5",background:"#fff",color:"#173343",boxShadow:"0 12px 30px #17334312"};
const share=(v:number,total:number)=>total>0?`${new Intl.NumberFormat("it-IT",{maximumFractionDigits:1}).format(100*v/total)}%`:"";

export function PillarAReference({candidates}:{candidates:Candidate[]}) {
  const [category,setCategory]=useState("");
  const categories=[...new Set(candidates.map(r=>r.atc5.slice(0,5)))].sort();
  const selected=categories.includes(category)?category:"";
  const rows=candidates.filter(r=>!selected||r.atc5.startsWith(selected));
  // Quote calcolate sui soli codici con classe AWaRe assegnata.
  const composition=CLASSIFIED.map(name=>({name,value:rows.filter(r=>awareLabel(r)===name).length})).filter(d=>d.value>0);
  const classified=composition.reduce((a,d)=>a+d.value,0);
  const unclassified=rows.length-classified;
  return <>
    <label className="mb-4 block text-sm font-semibold">Categoria ATC4
      <select value={selected} onChange={e=>setCategory(e.target.value)} className="mt-2 block h-11 w-full rounded-lg border bg-background px-3">
        <option value="">Tutte le categorie</option>
        {categories.map(code=><option key={code} value={code}>{code} · {candidates.filter(r=>r.atc5.startsWith(code)).length} codici</option>)}
      </select>
    </label>
    <div className="mb-4 flex flex-wrap gap-2">{[...CLASSIFIED,...RESIDUAL].map(label=>{
      const count=rows.filter(r=>awareLabel(r)===label).length;
      return count>0?<span key={label} className="rounded-full bg-secondary px-3 py-1 text-xs">{label}: {count}</span>:null;
    })}</div>
    {composition.length>0&&<div className="mb-5 grid items-center gap-5 rounded-xl border bg-background/60 p-4 sm:grid-cols-[11rem_1fr]">
      <div className="relative h-44" role="img" aria-label={`Composizione AWaRe${selected?` della categoria ${selected}`:""}: ${composition.map(d=>`${d.name} ${d.value} codici`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={composition} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {composition.map(d=><Cell key={d.name} fill={AWARE_COLORS[d.name]}/>)}
            </Pie>
            <Tooltip contentStyle={tipStyle} formatter={(v,n)=>[`${v} codici · ${share(Number(v),classified)}`,String(n)]}/>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-semibold tabular-nums">{classified}</span>
          <span className="text-[11px] text-muted-foreground">codici classificati</span>
        </div>
      </div>
      <dl className="space-y-2 text-sm">
        {composition.map(d=><div key={d.name} className="flex items-center gap-3">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background:AWARE_COLORS[d.name]}}/>
          <dt className="grow">{d.name}</dt>
          <dd className="font-mono tabular-nums">{d.value} · {share(d.value,classified)}</dd>
        </div>)}
        {unclassified>0&&<p className="border-t pt-2 text-xs text-muted-foreground">{unclassified === 1 ? "1 codice non classificato è escluso" : `${unclassified} codici non classificati sono esclusi`} dalle quote.</p>}
      </dl>
    </div>}
    <p className="mb-3 text-xs text-muted-foreground">{rows.length} codici di riferimento · non quote di consumo · WHO AWaRe 2025</p>
    <div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-card text-xs text-muted-foreground"><tr><th className="p-2">ATC</th><th className="p-2">Principio attivo / voce di riferimento</th><th className="p-2">AWaRe</th></tr></thead><tbody>{rows.map(r=><tr key={r.atc5} className="border-t"><td className="p-2 font-mono">{r.atc5}</td><td className="p-2">{r.ingredient_or_reference_names}</td><td className="p-2">{awareLabel(r)}</td></tr>)}</tbody></table></div>
  </>;
}
