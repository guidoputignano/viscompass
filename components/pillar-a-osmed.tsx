"use client";

import { useEffect,useState } from "react";
import { territorialPosition } from "@/lib/analytics/pillar-a-osmed-rank";
type Evidence={edition:number;rows:{region:string;rates:Record<string,number>}[]};
const number=(n:number)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:2}).format(n);

export function PillarAOsmed({region,name}:{region:string;name:string}) {
  const [data,setData]=useState<Evidence|null>(null);
  useEffect(()=>{const c=new AbortController();fetch('/api/pillar-a/osmed',{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setData).catch(()=>{});return()=>c.abort();},[]);
  const row=data?.rows.find(r=>r.region===region),italy=data?.rows.find(r=>r.region==='000');
  if(!row||!italy)return <p className="text-sm text-muted-foreground">Riferimento OSMED non disponibile al momento.</p>;
  const baseline=row.rates['2022'], latest=row.rates['2024'], threshold=baseline*.95;
  // Position among the territories. Reported descriptively: a lower intensity is
  // not automatically better, and the reduction is the indicator the plan targets.
  const position=territorialPosition(data?.rows??[],region,'2022','2024',0.05);
  return <>
    <div className="grid gap-4 sm:grid-cols-3">{[
      ['2022 · riferimento',number(baseline)],['2024 · osservato',number(latest)],['2025 · soglia obiettivo',`< ${number(threshold)}`]
    ].map(([label,value])=><div key={label} className="rounded-xl bg-secondary/50 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs">DDD / 100 giornate</p></div>)}</div>
    <p className="mt-4 text-sm leading-relaxed">{name}: variazione 2024/2022 pari a {number((latest/baseline-1)*100)}%. Il PNCAR 2022–2025 richiede una riduzione superiore al 5% nel 2025 rispetto al 2022. Il valore 2024 {latest<threshold?'è sotto':'non è sotto'} la soglia di riferimento; non è una verifica del risultato finale 2025.</p>
    {region!=='000'&&<p className="mt-3 text-sm">Italia 2024: {number(italy.rates['2024'])} DDD/100 giornate. Scostamento descrittivo: {number((latest/italy.rates['2024']-1)*100)}%.</p>}
    {position&&position.levelRank>0&&<div className="mt-4 rounded-xl border bg-secondary/40 p-4 text-sm leading-relaxed">
      <p><span className="font-semibold">Posizione fra i {position.peers} territori.</span> {name} è {position.levelRank}° per intensità di consumo nel 2024 (1° = valore più basso) e {position.changeRank}° per variazione 2024/2022 (1° = riduzione maggiore).</p>
      <p className="mt-2 text-muted-foreground">{position.meetingThreshold} territori su {position.peers} sono già sotto la soglia del −5% nel 2024. La posizione descrive la distribuzione osservata: un consumo più basso non è di per sé un risultato migliore, perché attività, casistica e composizione variano fra territori.</p>
      <p className="mt-2 text-muted-foreground">Il posizionamento è territoriale e non è trasferibile a una singola Azienda o a un presidio: il denominatore è l’attività regionale complessiva e non esiste una versione per struttura. Questa pagina non pubblica alcun confronto fra ospedali.</p>
    </div>}
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Definizione e fonte</summary><p className="mt-2 leading-relaxed text-muted-foreground">OSMED, L’uso degli antibiotici in Italia, anno 2024, tabella 5.2, pagina 165. Antibiotici J01: acquisti delle strutture pubbliche al netto della distribuzione diretta; denominatore SDO ordinario e day hospital/day surgery. Questa serie è distinta dai flussi AIFA selezionati sopra. Tutti gli anni usano l’edizione 2024, che rivede anche il 2023. Differenze di attività e composizione possono influenzare il confronto territoriale.</p></details>
  </>;
}
