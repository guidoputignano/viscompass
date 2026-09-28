"use client";
import {useState} from 'react';
import type {ProductAbcRow} from '@/lib/analytics/private-pillar-product';
import {ATTENTION_KEYS,ATTENTION_LABELS,attentionMatrix,cellProducts,emptyCellMessage,type AttentionKey,type ProductAttention,type AttentionSource} from '@/lib/analytics/operational-attention';
import {itNumberFormat} from '@/lib/format/it-number';

const eur=(v:number)=>itNumberFormat({style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const percent=(v:number)=>itNumberFormat({maximumFractionDigits:1,minimumFractionDigits:1}).format(v);
/** One group of products in a cell. The evidence string explains each row. */
function DetailTable({list,signal,lookup,caption}:{list:ProductAbcRow[];signal:AttentionKey;lookup:Map<string,ProductAttention>;caption:string}){
 // aria-live="off" because this sits inside the polite region that announces the
 // headings: band C of the registry column is most of an organisation's products,
 // and queueing that whole table as one announcement is unusable.
 // tabIndex makes the scroll box reachable without a mouse.
 return <div className="max-h-80 overflow-auto" tabIndex={0} role="group" aria-label={caption} aria-live="off">
  <table className="w-full text-sm [&_td]:p-2 [&_th]:p-2 [&_th]:text-left">
  <caption className="sr-only">{caption}</caption>
  <thead><tr><th scope="col">AIC</th><th scope="col">Prodotto</th><th scope="col">CF</th><th scope="col">Evidenza</th></tr></thead>
  <tbody>{list.map(r=><tr key={r.aic} className="border-t"><td>{r.aic}</td><td>{r.product_name}</td><td className="whitespace-nowrap">{eur(r.cf)}</td><td>{lookup.get(r.aic)?.signals[signal].detail??'Nessuna evidenza registrata per questo prodotto'}</td></tr>)}</tbody>
 </table></div>;
}

export function OperationalAttentionChart({rows,evidence,sources}:{rows:ProductAbcRow[];evidence:ProductAttention[];sources:Record<string,AttentionSource>}){
 const [selected,setSelected]=useState<{key:AttentionKey;band:string}|null>(null);
 const matrix=attentionMatrix(rows,evidence);
 const total=rows.reduce((s,r)=>s+r.cf,0);
 const lookup=new Map(evidence.map(e=>[e.aic,e]));
 const groups=selected?cellProducts(rows,evidence,selected.band,selected.key)
  :{listed:[] as ProductAbcRow[],unknown:[] as ProductAbcRow[]};
 const sum=(list:ProductAbcRow[])=>list.reduce((t,r)=>t+r.cf,0);
 const cellStats=selected?matrix.find(c=>c.key===selected.key)?.bands.find(b=>b.band===selected.band):undefined;
 const bandHasProducts=!!cellStats&&(cellStats.listed.count+cellStats.not_listed.count+cellStats.unknown.count)>0;
 const max=Math.max(1,...matrix.flatMap(c=>c.bands.map(b=>b.listed.spend)));
 return <section className="space-y-4 rounded-xl border bg-background p-4" aria-labelledby="attention-title">
  <div><h3 id="attention-title" className="text-lg font-semibold">ABC × attenzione operativa</h3>
  <p className="mt-1 text-sm text-muted-foreground">Incrocia la concentrazione della spesa CF con le evidenze disponibili. Seleziona una cella per vedere i prodotti da verificare.</p></div>
  <p className="text-sm">Spesa {rows[0]?.year??'N/D'} confrontata con fotografie delle fonti 2026: non ricostruisce lo stato regolatorio o le carenze nell’anno di spesa.</p>
  <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-separate border-spacing-2 text-sm"><caption className="sr-only">Spesa e numero di prodotti con evidenza presente, per banda ABC e indicatore</caption><thead><tr><th scope="col" className="text-left">Banda</th>{ATTENTION_KEYS.map(k=><th scope="col" key={k}>{ATTENTION_LABELS[k]}</th>)}</tr></thead><tbody>
   {(['A','B','C'] as const).map(band=><tr key={band}><th scope="row">{band}</th>{matrix.map(col=>{const cell=col.bands.find(b=>b.band===band)!;return <td key={col.key} className="align-top"><button type="button" onClick={()=>setSelected({key:col.key,band})} aria-pressed={selected?.key===col.key&&selected.band===band} className="w-full rounded-lg border bg-card p-3 text-left hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
    <span className="block font-semibold">{eur(cell.listed.spend)}</span><span className="block text-xs">{cell.listed.count} {cell.listed.count===1?'prodotto':'prodotti'} con evidenza</span>
    <span className="my-2 block h-2 rounded bg-muted" aria-hidden="true"><span className="block h-2 rounded bg-teal-600 dark:bg-teal-400" style={{width:`${cell.listed.spend/max*100}%`}}/></span>
    <span className="block text-xs text-muted-foreground">Non determinati: {cell.unknown.count} · {eur(cell.unknown.spend)}{(cell.listed.count+cell.unknown.count)>0&&' · apri per l’elenco'}</span>
   </button></td>;})}</tr>)}
  </tbody></table></div>
  <p className="text-xs text-muted-foreground">Barre su scala comune in euro. Gli indicatori si sovrappongono: non sommare le colonne. Zero significa nessuna evidenza positiva trovata, non assenza di criticità. PHT riporta il flag locale, non una nuova verifica regolatoria.</p>
  <div className="grid gap-3 sm:grid-cols-2">{matrix.map(col=>{const known=col.bands.reduce((s,b)=>s+b.listed.spend+b.not_listed.spend,0);return <p key={col.key} className="text-xs text-muted-foreground">{ATTENTION_LABELS[col.key]} · quota di spesa risolta nella fonte acquisita: {total>0?`${percent(100*known/total)}%`:'N/D'} · fonte {sources[col.key]?.date??'non disponibile'}</p>;})}</div>
  {/* Always present so a screen reader has a region to announce into: a live
      region created at the same instant it gains content is not reliably read. */}
  <div className="space-y-2" aria-live="polite">{selected&&<><h4 className="font-medium">Banda {selected.band} · {ATTENTION_LABELS[selected.key]}</h4>{groups.listed.length>0&&<p className="text-sm">{selected.key==='shortage'?'Per i prodotti con evidenza: verificare disponibilità e continuità della fornitura con la farmacia.':selected.key==='registry'?'Per i prodotti con evidenza: verificare l’indicazione e gli adempimenti applicabili; il collegamento al registro non prova l’obbligo per ogni utilizzo locale.':selected.key==='pht'?'Per i prodotti con evidenza: verificare percorso distributivo e aggiornamento del flag PHT.':'Per i prodotti con evidenza: approfondire quelli a maggiore spesa nella classificazione ospedaliera.'}</p>}
   {groups.listed.length>0&&<><h5 className="text-sm font-medium">Con evidenza nella fonte · {groups.listed.length} {groups.listed.length===1?'prodotto':'prodotti'} · {eur(sum(groups.listed))}</h5>
    <DetailTable list={groups.listed} signal={selected.key} lookup={lookup} caption={"Prodotti con evidenza nella fonte · banda "+selected.band+" · "+ATTENTION_LABELS[selected.key]}/></>}
   {groups.unknown.length>0&&<><h5 className="text-sm font-medium">Esito non determinato · {groups.unknown.length} {groups.unknown.length===1?'prodotto':'prodotti'} · {eur(sum(groups.unknown))}</h5>
    <p className="text-sm">La fonte acquisita non dà un esito per questi prodotti. Risolvere la corrispondenza prima di trarne conclusioni: non determinato non equivale a esito negativo.</p>
    <DetailTable list={groups.unknown} signal={selected.key} lookup={lookup} caption={"Prodotti con esito non determinato · banda "+selected.band+" · "+ATTENTION_LABELS[selected.key]}/></>}
   {!groups.listed.length&&!groups.unknown.length&&<p className="text-sm text-muted-foreground">{emptyCellMessage(selected.key,bandHasProducts)}</p>}
  </>}</div>
  <details className="text-sm"><summary className="cursor-pointer">Metodo e fonti</summary><div className="mt-2 space-y-2 text-muted-foreground"><p>Classe H e carenze: corrispondenza AIC esatta. Registri/PT: nome commerciale e ATC5 esatti; indicazioni da verificare. Un AIC assente dalle liste A/H resta non determinato. Nessuna assegnazione V/E/N, punteggio clinico o deduzione di assenza di alternative terapeutiche.</p>{Object.entries(sources).map(([k,s])=><p key={k}>{k==='a'?'Lista A (controllo classificazione)':ATTENTION_LABELS[k as AttentionKey]??k}: {s.date} {s.url&&<a className="underline" href={s.url} target="_blank" rel="noreferrer">Fonte AIFA</a>}{s.label&&` · ${s.label}`}</p>)}</div></details>
 </section>;
}
