"use client";
import {useState} from 'react';
import type {ProductAbcRow} from '@/lib/analytics/private-pillar-product';
import {ATTENTION_KEYS,ATTENTION_LABELS,attentionMatrix,type AttentionKey,type ProductAttention,type AttentionSource} from '@/lib/analytics/operational-attention';
import {itNumberFormat} from '@/lib/format/it-number';

const eur=(v:number)=>itNumberFormat({style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const percent=(v:number)=>itNumberFormat({maximumFractionDigits:1,minimumFractionDigits:1}).format(v);
export function OperationalAttentionChart({rows,evidence,sources}:{rows:ProductAbcRow[];evidence:ProductAttention[];sources:Record<string,AttentionSource>}){
 const [selected,setSelected]=useState<{key:AttentionKey;band:string}|null>(null);
 const matrix=attentionMatrix(rows,evidence);
 const total=rows.reduce((s,r)=>s+r.cf,0);
 const lookup=new Map(evidence.map(e=>[e.aic,e]));
 const detail=selected?rows.filter(r=>r.band===selected.band&&lookup.get(r.aic)?.signals[selected.key].status==='listed'):[];
 const max=Math.max(1,...matrix.flatMap(c=>c.bands.map(b=>b.listed.spend)));
 return <section className="space-y-4 rounded-xl border bg-background p-4" aria-labelledby="attention-title">
  <div><h3 id="attention-title" className="text-lg font-semibold">ABC × attenzione operativa</h3>
  <p className="mt-1 text-sm text-muted-foreground">Incrocia la concentrazione della spesa CF con le evidenze disponibili. Seleziona una cella per vedere i prodotti da verificare.</p></div>
  <p className="text-sm">Spesa {rows[0]?.year??'N/D'} confrontata con fotografie delle fonti 2026: non ricostruisce lo stato regolatorio o le carenze nell’anno di spesa.</p>
  <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-separate border-spacing-2 text-sm"><caption className="sr-only">Spesa e numero di prodotti con evidenza presente, per banda ABC e indicatore</caption><thead><tr><th scope="col" className="text-left">Banda</th>{ATTENTION_KEYS.map(k=><th scope="col" key={k}>{ATTENTION_LABELS[k]}</th>)}</tr></thead><tbody>
   {(['A','B','C'] as const).map(band=><tr key={band}><th scope="row">{band}</th>{matrix.map(col=>{const cell=col.bands.find(b=>b.band===band)!;return <td key={col.key} className="align-top"><button type="button" onClick={()=>setSelected({key:col.key,band})} aria-pressed={selected?.key===col.key&&selected.band===band} className="w-full rounded-lg border bg-card p-3 text-left hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
    <span className="block font-semibold">{eur(cell.listed.spend)}</span><span className="block text-xs">{cell.listed.count} {cell.listed.count===1?'prodotto':'prodotti'} con evidenza</span>
    <span className="my-2 block h-2 rounded bg-muted" aria-hidden="true"><span className="block h-2 rounded bg-teal-600 dark:bg-teal-400" style={{width:`${cell.listed.spend/max*100}%`}}/></span>
    <span className="block text-xs text-muted-foreground">Non determinati: {cell.unknown.count} · {eur(cell.unknown.spend)}</span>
   </button></td>;})}</tr>)}
  </tbody></table></div>
  <p className="text-xs text-muted-foreground">Barre su scala comune in euro. Gli indicatori si sovrappongono: non sommare le colonne. Zero significa nessuna evidenza positiva trovata, non assenza di criticità. PHT riporta il flag locale, non una nuova verifica regolatoria.</p>
  <div className="grid gap-3 sm:grid-cols-2">{matrix.map(col=>{const known=col.bands.reduce((s,b)=>s+b.listed.spend+b.not_listed.spend,0);return <p key={col.key} className="text-xs text-muted-foreground">{ATTENTION_LABELS[col.key]} · quota di spesa con esito determinato: {total>0?`${percent(100*known/total)}%`:'N/D'} · fonte {sources[col.key]?.date??'non disponibile'}</p>;})}</div>
  {selected&&<div className="space-y-2" aria-live="polite"><h4 className="font-medium">Banda {selected.band} · {ATTENTION_LABELS[selected.key]}</h4><p className="text-sm">{selected.key==='shortage'?'Verificare disponibilità e continuità della fornitura con la farmacia.':selected.key==='registry'?'Verificare l’indicazione e gli adempimenti applicabili: il collegamento al registro non prova l’obbligo per ogni utilizzo locale.':selected.key==='pht'?'Verificare percorso distributivo e aggiornamento del flag PHT.':'Approfondire i prodotti a maggiore spesa nella classificazione ospedaliera.'}</p>
   {!detail.length?<p className="text-sm text-muted-foreground">Nessun prodotto con evidenza positiva in questa cella.</p>:<div className="max-h-80 overflow-auto"><table className="w-full text-sm [&_td]:p-2 [&_th]:p-2 [&_th]:text-left"><thead><tr><th>AIC</th><th>Prodotto</th><th>CF</th><th>Evidenza</th></tr></thead><tbody>{detail.map(r=><tr key={r.aic} className="border-t"><td>{r.aic}</td><td>{r.product_name}</td><td className="whitespace-nowrap">{eur(r.cf)}</td><td>{lookup.get(r.aic)?.signals[selected.key].detail}</td></tr>)}</tbody></table></div>}
  </div>}
  <details className="text-sm"><summary className="cursor-pointer">Metodo e fonti</summary><div className="mt-2 space-y-2 text-muted-foreground"><p>Classe H e carenze: corrispondenza AIC esatta. Registri/PT: nome commerciale e ATC5 esatti; indicazioni da verificare. Un AIC assente dalle liste A/H resta non determinato. Nessuna assegnazione V/E/N, punteggio clinico o deduzione di assenza di alternative terapeutiche.</p>{Object.entries(sources).map(([k,s])=><p key={k}>{k==='a'?'Lista A (controllo classificazione)':ATTENTION_LABELS[k as AttentionKey]??k}: {s.date} {s.url&&<a className="underline" href={s.url} target="_blank" rel="noreferrer">Fonte AIFA</a>}{s.label&&` · ${s.label}`}</p>)}</div></details>
 </section>;
}
