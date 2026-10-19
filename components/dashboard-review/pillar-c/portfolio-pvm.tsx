"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Coins, Scale, Shuffle } from "lucide-react";
import { cPortfolioPvm, type CPortfolioPvm } from "@/lib/dashboard-review/pillar-c/portfolio-pvm";
import type { CPortfolioView } from "@/lib/dashboard-review/pillar-c/portfolio";
import { cAttrPercent } from "@/lib/dashboard-review/pillar-c/attribution-format";
import { cWorkbookDecimal, parseCWorkbookSection, type CWorkbookIndex, type CWorkbookSection } from "@/lib/dashboard-review/pillar-c/workbook";

const money = (n:string)=>`${cWorkbookDecimal(n,2)} €`;
const signed = (n:string)=>`${Number(n)>0?"+":""}${money(n)}`;

export function CPortfolioPvmReading({result}:{result:CPortfolioPvm}) {
  if(result.status === "unsupported")return <p className="text-sm leading-6 text-muted-foreground" data-c-pvm-status="unsupported">Il dettaglio per portafoglio disponibile riguarda l’aggregato delle quattro Aziende, tutti i canali, nel confronto 2024–2025. Non viene applicato a questa selezione.</p>;
  if(result.status === "unavailable")return <p className="text-sm text-muted-foreground" data-c-pvm-status="unavailable">La scomposizione non è disponibile con evidenza compatibile. Nessun effetto viene sostituito con zero.</p>;
  const coverage = <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-secondary/40 p-3"><p className="text-xs text-muted-foreground">Copertura degli importi assoluti · 2024</p><p className="mt-1 text-lg font-semibold">{cAttrPercent(Number(result.coverage.earlier))}</p></div><div className="rounded-lg bg-secondary/40 p-3"><p className="text-xs text-muted-foreground">Copertura degli importi assoluti · 2025</p><p className="mt-1 text-lg font-semibold">{cAttrPercent(Number(result.coverage.later))}</p></div></div>;
  return <div className="space-y-4" data-c-pvm-status={result.status} data-coverage-earlier={result.coverage.earlier} data-coverage-later={result.coverage.later}>
    <p className="text-xs leading-5 text-muted-foreground">2024 → 2025 · aggregato delle quattro Aziende · tutti i canali. La copertura si riferisce alla spesa assoluta dei prodotti presenti nei due periodi, distinti per AIC, Azienda e canale.</p>
    {coverage}
    {result.status === "insufficient" ? <p className="text-sm leading-6">La copertura è inferiore al 50% in almeno un periodo. Sono visibili solo il supporto disponibile e i contributi contabili; quantità, mix e costo unitario non vengono stimati per questa selezione.</p>:<>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[.035] p-4"><div><p className="text-xs font-medium text-primary">{result.support==="partial"?"Scomposizione parziale del sottoinsieme ammesso":"Scomposizione del sottoinsieme ammesso"}</p><p className="mt-2 text-sm">Variazione della sola spesa ammessa al confronto</p></div><strong className="text-xl tabular-nums" data-c-pvm-admitted-change={result.admittedChange}>{signed(result.admittedChange)}</strong></div>
      <div className="grid gap-3 md:grid-cols-3">{[
        {id:"quantity",label:"Quantità",value:result.effects.quantity,Icon:Scale,meaning:"Variazione delle quantità normalizzate"},
        {id:"mix",label:"Mix",value:result.effects.mix,Icon:Shuffle,meaning:"Variazione della composizione fra prodotti"},
        {id:"unitCost",label:"Costo unitario",value:result.effects.unitCost,Icon:Coins,meaning:"Variazione del costo per unità normalizzata"},
      ].map(({id,label,value,Icon,meaning})=><div key={id} className="rounded-xl border border-border p-4" data-c-pvm-effect={id} data-value={value}><p className="flex items-center gap-2 text-xs font-medium"><Icon size={15} className="text-primary" aria-hidden="true"/>{label}</p><p className="mt-3 text-lg font-semibold tabular-nums">{signed(value)}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{meaning}</p></div>)}</div>
      {Number(result.rounding.displayResidual)!==0&&<p className="text-xs text-muted-foreground">{`La somma delle tre componenti arrotondate differisce dal saldo arrotondato di ${signed(result.rounding.displayResidual)}. Gli importi non sono corretti artificialmente per farli coincidere.`}</p>}
      <p className="text-xs leading-5 text-muted-foreground">Questi effetti riguardano soltanto gli strati ammessi: non scompongono l’intera variazione del portafoglio né il contributo dei prodotti presenti calcolato sopra, che aggrega diversamente le Aziende e i canali. Gli importi esclusi non sono rappresentati dagli effetti mostrati.</p>
    </>}
    <p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">Stima da dati reali: registro AIFA, convenzione Q dai campi del ledger. La convenzione delle unità non è convalidata dall’Azienda; mappatura terapeutica in bozza. Il costo riportato non è un prezzo netto negoziato né un risparmio realizzato.</p>
  </div>;
}

/** Reuse the existing authenticated, hash-pinned snapshot; load only on request. */
export function CPortfolioPriceQuantityMix({view,workbook}:{view:CPortfolioView;workbook?:CWorkbookIndex|null}) {
  const [open,setOpen]=useState(false),[section,setSection]=useState<CWorkbookSection|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const supported=view.scope.org==="Regione"&&view.scope.channel==="Tutti"&&["FY2024","FY2025"].includes(view.scope.period);
  useEffect(()=>{
    if(!open||!supported||!workbook||section)return;
    let active=true;const controller=new AbortController();
    fetch('/api/pillar-c/workbook?section=costi',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error('unavailable');return parseCWorkbookSection(await r.json(),'costi',workbook);})
      .then(data=>{if(active){setSection(data);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;controller.abort();};
  },[open,supported,workbook,section,attempt]);
  const result=!supported?{status:'unsupported' as const,reason:'scope' as const}:section?cPortfolioPvm(section,view):null;
  return <details className="rounded-xl border border-border bg-card" onToggle={e=>setOpen(e.currentTarget.open)} data-c-portfolio-pvm>
    <summary className="cursor-pointer px-5 py-4 text-sm font-medium">Quantità, mix e costo unitario · evidenza disponibile</summary>
    <div className="space-y-4 border-t border-border p-5">{result?<CPortfolioPvmReading result={result}/>:!workbook?<p className="text-sm text-muted-foreground">Nessuna scomposizione compatibile è disponibile.</p>:failed?<div role="status"><p className="text-sm">La scomposizione non è disponibile al momento.</p><button type="button" className="mt-3 min-h-10 rounded-lg border border-border px-3 text-xs" onClick={()=>{setFailed(false);setAttempt(n=>n+1);}}>Riprova</button></div>:<p role="status" className="text-sm text-muted-foreground">Lettura della scomposizione verificata…</p>}
      <a className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-primary" href="#costi">Apri supporto, confronti e dettaglio dei costi<ArrowRight size={14}/></a>
    </div>
  </details>;
}
