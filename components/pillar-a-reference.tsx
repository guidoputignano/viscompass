"use client";

import { useState } from "react";

type Candidate = {atc5:string; ingredient_or_reference_names:string; aware:string; aware_status:string};
const awareLabel=(r:Candidate)=>r.aware||(r.aware_status==='not_applicable'?'Non applicabile':r.aware_status==='ambiguous_or_non_aware_reference'?'Da disambiguare':'Non trovato nel riferimento');

export function PillarAReference({candidates}:{candidates:Candidate[]}) {
  const [category,setCategory]=useState("");
  const categories=[...new Set(candidates.map(r=>r.atc5.slice(0,5)))].sort();
  const selected=categories.includes(category)?category:"";
  const rows=candidates.filter(r=>!selected||r.atc5.startsWith(selected));
  return <>
    <label className="mb-4 block text-sm font-semibold">Categoria ATC4
      <select value={selected} onChange={e=>setCategory(e.target.value)} className="mt-2 block h-11 w-full rounded-lg border bg-background px-3">
        <option value="">Tutte le categorie</option>
        {categories.map(code=><option key={code} value={code}>{code} · {candidates.filter(r=>r.atc5.startsWith(code)).length} codici</option>)}
      </select>
    </label>
    <div className="mb-4 flex flex-wrap gap-2">{["Access","Watch","Reserve","Da disambiguare","Non trovato nel riferimento","Non applicabile"].map(label=>{
      const count=rows.filter(r=>awareLabel(r)===label).length;
      return count>0?<span key={label} className="rounded-full bg-secondary px-3 py-1 text-xs">{label}: {count}</span>:null;
    })}</div>
    <p className="mb-3 text-xs text-muted-foreground">{rows.length} codici di riferimento · non quote di consumo · WHO AWaRe 2025</p>
    <div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-card text-xs text-muted-foreground"><tr><th className="p-2">ATC</th><th className="p-2">Principio attivo / voce di riferimento</th><th className="p-2">AWaRe</th></tr></thead><tbody>{rows.map(r=><tr key={r.atc5} className="border-t"><td className="p-2 font-mono">{r.atc5}</td><td className="p-2">{r.ingredient_or_reference_names}</td><td className="p-2">{awareLabel(r)}</td></tr>)}</tbody></table></div>
  </>;
}
