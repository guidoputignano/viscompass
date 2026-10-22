"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, GitCompareArrows } from "lucide-react";
import { cPortfolioExplanation, cPortfolioExplanationSteps, C_CHANGE_KIND_LABELS } from "@/lib/dashboard-review/pillar-c/change-explanation";
import type { CPortfolioProductChange, CPortfolioView } from "@/lib/dashboard-review/pillar-c/portfolio";
import { C_PERIOD_LABELS } from "@/lib/dashboard-review/pillar-c/review";
import { cAudienceLabel } from "@/lib/dashboard-review/pillar-c/audience-view";
import { usePillarCAudience } from "@/components/dashboard-review/pillar-c/audience-context";
import { cWorkbookDecimal } from "@/lib/dashboard-review/pillar-c/workbook";
import { itNumber } from "@/lib/format/it-number";

const money = (s:string) => `${cWorkbookDecimal(s,2)} €`;
const signed = (s:string) => `${Number(s)>0?"+":""}${money(s)}`;
const shortKind = {continuing:"Presenti nei due periodi",entry:"Entrati nel portafoglio",exit:"Usciti dal portafoglio"};

/** The audience is mandatory: without one, or for a view of an organisation the audience does not hold, nothing renders. */
export function CPortfolioChangeSummary({view,onPickProduct}:{view:CPortfolioView;onPickProduct?:(key:string)=>void}) {
  const audience = usePillarCAudience(), orgLabel = audience ? cAudienceLabel(audience, view.scope.org) : null;
  if (!audience || orgLabel === null) return null;
  const explanation = cPortfolioExplanation(view), steps = cPortfolioExplanationSteps(view);
  const from = C_PERIOD_LABELS[view.changePeriods.from], to = C_PERIOD_LABELS[view.changePeriods.to];
  const headline = explanation.direction === "increase" ? `La spesa aumenta di ${money(explanation.net!)}`
    : explanation.direction === "decrease" ? `La spesa diminuisce di ${money(explanation.net!).replace(/^[-−]/,"")}`
    : explanation.direction === "unchanged" ? "Il saldo della spesa è invariato" : "Il confronto non ha osservazioni a portafoglio singolo";
  const lo = Math.min(0,...steps.flatMap(s=>[Number(s.from),Number(s.to)]));
  const hi = Math.max(0,...steps.flatMap(s=>[Number(s.from),Number(s.to)]));
  const span = hi-lo || 1, y = (v:number) => 130-(v-lo)/span*105;
  function productList(rows:CPortfolioProductChange[],remainder:string|null,totalCount:number,rising:boolean) {
    return <div className="min-w-0 rounded-xl bg-secondary/35 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">{rising?<ArrowUpRight size={17} className="text-primary"/>:<ArrowDownRight size={17} className="text-amber-700"/>}{rising?"Maggiori contributi in aumento":"Maggiori contributi in riduzione"}</p>
      {!rows.length?<p className="mt-3 text-xs text-muted-foreground">Nessun contributo di questo segno.</p>:<ol className="mt-3 space-y-3">{rows.map(r=><li key={`${r.key}|${r.atc}`} className="text-xs">
        <div className="flex items-start justify-between gap-3"><a href="#portfolio-product-detail" onClick={()=>onPickProduct?.(r.key)} className="min-w-0 font-medium text-primary underline decoration-primary/25 underline-offset-4">{r.label}</a><strong className="shrink-0 tabular-nums">{signed(r.delta)}</strong></div>
        <span className="mt-1 block text-[11px] text-muted-foreground">{`${shortKind[r.kind]} · ${r.key}`}</span>
      </li>)}</ol>}
      {totalCount>rows.length&&remainder!==null&&<p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{`Altre ${itNumber(totalCount-rows.length)} voci: ${signed(remainder)}`}</p>}
    </div>;
  }
  return <article className="rounded-2xl border border-primary/20 bg-card p-5 shadow-sm md:p-6" aria-labelledby="portfolio-explanation-title" data-c-change-summary data-change={explanation.net??"unavailable"} data-increases={explanation.positive??"unavailable"} data-reductions={explanation.negative??"unavailable"}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium text-primary">La lettura del cambiamento</p><h3 id="portfolio-explanation-title" className="mt-1 text-xl font-semibold">Che cosa spiega la variazione?</h3><p className="mt-2 text-xs text-muted-foreground">{`${from} → ${to} · ${orgLabel} · ${view.scope.channel === "Tutti"?"tutti i canali":view.scope.channel} · parte a portafoglio singolo`}</p></div><GitCompareArrows size={23} className="shrink-0 text-primary" aria-hidden="true"/></div>
    <p className="mt-5 text-lg font-semibold" data-c-change-headline>{headline}</p>
    {explanation.state === "available" ? <>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{explanation.dominant?`La componente netta di maggiore entità riguarda i ${C_CHANGE_KIND_LABELS[explanation.dominant.kind].toLocaleLowerCase('it')}: ${signed(explanation.dominant.value!)}.`:"Nessuna delle tre componenti presenta una variazione netta."} {explanation.direction==="unchanged"&&explanation.hasOffsets?"Il saldo zero nasconde aumenti e riduzioni che si compensano.":explanation.hasOffsets?"Gli aumenti sono compensati in parte da riduzioni su altri prodotti.":""}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{[
        ["Contributi in aumento",explanation.positive!,`${itNumber(explanation.increases.count)} voci`],
        ["Contributi in riduzione",explanation.negative!,`${itNumber(explanation.decreases.count)} voci`],
        ["Variazione netta",explanation.net!,`${itNumber(explanation.unchangedProducts)} ${explanation.unchangedProducts===1?"voce":"voci"} senza variazione`],
      ].map(([label,value,note])=><div key={label} className="rounded-xl border border-border px-4 py-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{signed(value)}</p><p className="mt-1 text-[11px] text-muted-foreground">{note}</p></div>)}</div>
      <details className="mt-4 rounded-xl border border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Prodotti presenti, entrati e usciti · ponte della variazione</summary>
        <div className="px-4 pb-4"><p className="text-xs leading-5 text-muted-foreground">Il ponte parte da zero e arriva alla variazione netta, non alla spesa finale. Le rettifiche restano incluse.</p>
          <div className="mt-2 overflow-x-auto"><svg viewBox="0 0 700 192" className="min-w-[560px] w-full" role="img" aria-label="Ponte contabile della variazione a portafoglio singolo">
            <line x1={20} x2={680} y1={y(0)} y2={y(0)} stroke="var(--border)"/>
            {steps.map((s,i)=><g key={s.kind}><title>{`${shortKind[s.kind]}: ${signed(s.value!)}`}</title><rect x={30+i*170} y={Math.min(y(Number(s.from)),y(Number(s.to)))} width={100} height={Math.max(2,Math.abs(y(Number(s.from))-y(Number(s.to))))} rx={5} fill={Number(s.value)<0?"#b47a37":"#19998f"}/><text x={80+i*170} y={Math.min(y(Number(s.from)),y(Number(s.to)))-7} textAnchor="middle" fill="currentColor" fontSize={10}>{signed(s.value!)}</text><text x={80+i*170} y={163} textAnchor="middle" fill="currentColor" fontSize={10}>{s.kind==="continuing"?"Presenti":s.kind==="entry"?"Entrati":"Usciti"}</text></g>)}
            <rect x={540} y={Math.min(y(0),y(Number(explanation.net)))} width={100} height={Math.max(2,Math.abs(y(Number(explanation.net))-y(0)))} rx={5} fill="#8e7ab5"/>
            <text x={590} y={Math.min(y(0),y(Number(explanation.net)))-7} textAnchor="middle" fill="currentColor" fontSize={10}>{signed(explanation.net!)}</text><text x={590} y={163} textAnchor="middle" fill="currentColor" fontSize={10}>Saldo</text>
          </svg></div>
          <dl className="grid gap-3 sm:grid-cols-3">{explanation.components.map(c=><div key={c.kind} className="rounded-lg bg-secondary/35 p-3" data-change-kind={c.kind} data-change-value={c.value}><dt className="text-xs">{shortKind[c.kind]}</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{signed(c.value!)}</dd><dd className="mt-1 text-xs text-muted-foreground">{`${itNumber(c.count)} voci prodotto`}</dd></div>)}</dl>
        </div>
      </details>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{productList(explanation.increases.top,explanation.increases.remainder,explanation.increases.count,true)}{productList(explanation.decreases.top,explanation.decreases.remainder,explanation.decreases.count,false)}</div>
      <a href="#portfolio-product-detail" className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-primary" onClick={()=>onPickProduct?.("")}>Apri tutti i contributi e gli importi dei due periodi<ArrowRight size={14}/></a>
    </> : <p className="mt-2 text-sm text-muted-foreground">Nessun saldo o contributo viene trasformato in zero. L’eventuale esposizione condivisa rimane nell’analisi di attribuzione.</p>}
    <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">Entrato o uscito significa presente in un solo periodo di questo portafoglio: non è un lancio sul mercato né un passaggio di pazienti. Questi sono contributi di spesa, non effetti di prezzo, quantità o crescita delle persone trattate. I prodotti condivisi sono analizzati separatamente. Importi al centesimo: gli arrotondamenti delle singole voci possono differire dal totale.</p>
  </article>;
}
