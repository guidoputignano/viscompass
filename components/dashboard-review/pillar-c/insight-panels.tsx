"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, LineChart as LineIcon, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { C_WORKBOOK_SECTIONS, cWorkbookAxisLabel, cWorkbookComparableColumns, cWorkbookLabel, cWorkbookLabelColumn, cWorkbookMetricUnits, cWorkbookPlotRows, cWorkbookRaw, cWorkbookRows, parseCWorkbookSection, type CWorkbookIndex, type CWorkbookSection, type CWorkbookSectionId, type CWorkbookTable } from '@/lib/dashboard-review/pillar-c/workbook';
import { C_INSIGHT_DEFAULTS, C_INSIGHT_TITLES, cInsightBlockName, cInsightCellText, cInsightRowName, cInsightScope, cInsightText, cInsightVisibleColumns } from '@/lib/dashboard-review/pillar-c/insights';
import { itNumber } from '@/lib/format/it-number';

const select='mt-1.5 h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm';
const action='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs hover:bg-secondary disabled:opacity-40';
const questions:Partial<Record<CWorkbookSectionId,[string,string]>>={
  composizione:['Dove si concentra la spesa?','Classi ATC, portafogli terapeutici e variazioni delle quote.'],
  attribuzione:['Quanta spesa è condivisa fra più aree?','Evidenza di attribuzione, spesa condivisa e intervalli per area. I portafogli sono proxy ATC, non reparti osservati.'],
  costi:['Quanto pesano quantità, mix e costo dei prodotti?','Scomposizione descrittiva sui soli confronti ammessi. Le unità imputate rimangono una vista separata.'],
  confronti:['Le differenze rimangono dopo aver considerato il mix?','Confronti nei perimetri supportati e compatibilità delle fonti.'],
  attivita:['Qual è il contesto demografico e ospedaliero?','Fonti pubbliche con anno, territorio e unità propri. Non sono conteggi di persone trattate.'],
  tendenze:['Quali andamenti meritano un approfondimento?','Andamenti e stime ammessi; i segnali non revisionati restano esclusi.'],
  sensibilita:['Quanto dipende il risultato dalle ipotesi?','Alternative registrate alla classificazione e alle assunzioni.'],
  priorita:['Che cosa approfondire prima?','Questioni organizzative, ruolo proposto e indicatore di follow-up.'],
};
const familyTitles:Partial<Record<CWorkbookSectionId,string>>={spesa:'Dettaglio della spesa',cambiamento:'Prodotti e classi che spiegano il cambiamento',pianificazione:'Budget, allocazione e copertura',numerosita:'Confronta le ipotesi di numerosità',previsione:'Scenari e affidabilità',evidenza:'Fonti e qualità dei dati'};

const InsightRequests = createContext<Map<string,Promise<CWorkbookSection>>|null>(null);
/** Page-local only: a new authenticated workspace never inherits another session's data. */
export function PillarCInsightsProvider({children}:{children:React.ReactNode}) {
  const [requests] = useState(()=>new Map<string,Promise<CWorkbookSection>>());
  return <InsightRequests.Provider value={requests}>{children}</InsightRequests.Provider>;
}

function useInsightData(index:CWorkbookIndex,section:CWorkbookSectionId,target:React.RefObject<HTMLDivElement|null>) {
  const requests=useContext(InsightRequests);
  const [data,setData]=useState<CWorkbookSection|null>(null),[failed,setFailed]=useState(false),[attempt,retry]=useState(0);
  useEffect(()=>{
    let started=false,cancelled=false;
    const load=async()=>{if(started)return;started=true;setFailed(false);try{
      const key=`${index.workbookSha256}|${section}`;
      let request=requests?.get(key);
      if(!request){
        request=(async()=>{
          const r=await fetch(`/api/pillar-c/workbook?section=${section}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15_000)});
          if(!r.ok)throw new Error('unavailable');
          return parseCWorkbookSection(await r.json(),section,index);
        })();
        requests?.set(key,request);
        void request.catch(()=>{if(requests&&requests.get(key)===request)requests.delete(key);});
      }
      const result=await request;if(!cancelled)setData(result);
    }catch{if(!cancelled)setFailed(true);}};
    const node=target.current;
    if(!node||typeof IntersectionObserver==='undefined'){void load();return()=>{cancelled=true;};}
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){void load();observer.disconnect();}},{rootMargin:'300px'});
    observer.observe(node);return()=>{cancelled=true;observer.disconnect();};
  },[index,section,target,attempt,requests]);
  return {data,failed,retry:()=>retry(n=>n+1)};
}
function preferredMetric(table:CWorkbookTable,output:string,visible:number[]) {
  const preferred=output.startsWith('ML-4')?/Quantità.*Shapley/i:output==='O-14-03'?/D std \(pp/i:/€|quota|copertura|pendenza|variaz/i;
  return table.numericColumns.find(c=>visible.includes(c)&&preferred.test(table.columns[c]))??table.numericColumns.find(c=>visible.includes(c))??-1;
}
function humanColumn(raw:string) {
  return cInsightText(raw).replace(/\bLB[12]\b/g,'limite inferiore').replace(/\bUB[12]\b/g,'limite superiore').replace(/\bW[12]\b/g,'ampiezza dell’intervallo').replace(/\bF \(attribuzione tramite portafoglio\)/g,'Spesa attribuita').replace(/\bD std\b/g,'Differenza standardizzata').replace(/\bI std\b/g,'Indice standardizzato').replace(/\bI grezzo\b/g,'Indice grezzo').replace(/\bSC-0\b/g,'Scenario invariato').replace(/\bSC-1\b/g,'Scenario di continuità').replace(/\bSC-L\b/g,'Scenario basso').replace(/\bSC-H\b/g,'Scenario alto');
}

function InsightView({table,formats,output,section}:{table:CWorkbookTable;formats:Record<string,string>;output:string;section:CWorkbookSectionId}) {
  const visible=useMemo(()=>cInsightVisibleColumns(table),[table]);
  const metrics=table.numericColumns.filter(c=>visible.includes(c));
  const [metric,setMetric]=useState(()=>preferredMetric(table,output,visible));
  const [compare,setCompare]=useState(-1),[query,setQuery]=useState(''),[facets,setFacets]=useState<Record<number,string>>({}),[page,setPage]=useState(0);
  const [requestedView,setView]=useState<'bar'|'line'>('bar');
  const rows=useMemo(()=>cWorkbookRows(table,query,facets,null,'asc'),[table,query,facets]);
  const cells=useMemo(()=>rows.map(r=>r.cells),[rows]);
  const compatible=cWorkbookComparableColumns(table,metric,formats,cells).filter(c=>metrics.includes(c));
  const comparison=compatible.includes(compare)?compare:-1;
  const label=cWorkbookLabelColumn(table),mixed=cWorkbookMetricUnits(table,metric,formats,cells).length>1;
  // A connecting line across unrelated products/Aziende suggests a time trend
  // that does not exist. Offer it only for a genuine single-context time axis.
  const canTrend=/^(?:anno|mese|periodo|data)(?:\s|$)/i.test(table.columns[label]??'') &&
    table.columns.every((h,c)=>c===label||! /^(?:azienda|canale|classe|serie)(?:\s|$)/i.test(h)||new Set(rows.map(r=>cWorkbookRaw(r.cells[c]))).size<=1);
  const view=canTrend?requestedView:'bar';
  const categories=table.columns.flatMap((h,c)=>{
    if(!visible.includes(c)||metrics.includes(c)||! /^(?:confronto|periodo|anno|azienda|canale|ambito|classe|stato|livello|unità|tipo|serie)(?:\s|$)/i.test(h))return [];
    const values=[...new Set(table.rows.map(r=>cWorkbookRaw(r[c])).filter(Boolean))];
    return values.length>1&&values.length<=40?[{c,h:humanColumn(h),values}]:[];
  });
  const plotRows=rows.filter(r=>! /^(?:tot|totale|total)$/i.test(cWorkbookRaw(r.cells[0]).trim()));
  const rawPlot=cWorkbookPlotRows(table,plotRows.length?plotRows:rows,formats,metric,label,metric,view,comparison);
  const bySourceRow=new Map(rows.map(r=>[r.sourceRow,r.cells]));
  const plotted=rawPlot.slice(0,view==='line'?120:20).map(d=>({...d,name:cInsightRowName(table,bySourceRow.get(d.sourceRow)!,d.name)}));
  const currentPage=Math.min(page,Math.max(0,Math.ceil(rows.length/20)-1));
  const descriptiveOnly=section==='evidenza'||metrics.length===0||/^(O-12-06|O-16-0[234]|O-18-03|PC-05)/.test(output);
  const scope=cInsightScope(table),axis=(v:number)=>cWorkbookAxisLabel(v,table,metric,formats,cells);
  const tooltip=({active,payload}:{active?:boolean;payload?:{payload?:typeof plotted[number]}[]})=>{
    const d=payload?.[0]?.payload;return active&&d?<div className="max-w-sm rounded-lg border border-border bg-card p-3 text-xs shadow-lg"><p className="font-semibold">{d.name}</p><p className="mt-2">{humanColumn(table.columns[metric])}: {d.exact}</p>{comparison>=0&&<p>{humanColumn(table.columns[comparison])}: {d.otherExact}</p>}</div>:null;
  };
  return <div className="mt-5 space-y-5">
    {scope&&<p className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">{`${scope}. I selettori delle altre sezioni non modificano questa vista.`}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-medium text-muted-foreground">Cerca prodotto, classe o area<div className="relative"><Search size={14} aria-hidden="true" className="absolute left-3 top-5"/><input className={`${select} pl-9`} value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="Cerca…"/></div></label>
      {categories.map(({c,h,values})=><label key={c} className="text-xs font-medium text-muted-foreground">{h}<select className={select} value={facets[c]??''} onChange={e=>{setFacets({...facets,[c]:e.target.value});setPage(0);}}><option value="">Tutti</option>{values.map(v=><option key={v} value={v}>{cInsightCellText(v)}</option>)}</select></label>)}
    </div>
    {!descriptiveOnly&&<>
      <div className="grid gap-4 rounded-xl bg-secondary/30 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs font-medium">Indicatore<select className={select} aria-label="Indicatore del grafico" value={metric} onChange={e=>setMetric(Number(e.target.value))}>{metrics.map(c=><option key={c} value={c}>{humanColumn(table.columns[c])}</option>)}</select></label>
        {compatible.length>0&&<label className="text-xs font-medium">Confronta con<select className={select} value={comparison} onChange={e=>setCompare(Number(e.target.value))}><option value={-1}>Nessun confronto aggiuntivo</option>{compatible.map(c=><option key={c} value={c}>{humanColumn(table.columns[c])}</option>)}</select></label>}
        <div className="flex items-end gap-2"><button className={`${action} ${view==='bar'?'border-primary text-primary':''}`} aria-pressed={view==='bar'} onClick={()=>setView('bar')}><BarChart3 size={15}/>Barre</button>{canTrend&&<button className={`${action} ${view==='line'?'border-primary text-primary':''}`} aria-pressed={view==='line'} onClick={()=>setView('line')}><LineIcon size={15}/>Andamento</button>}</div>
      </div>
      {mixed?<p className="text-sm text-muted-foreground">Seleziona una sola unità per confrontare i valori nel grafico. Gli importi e i conteggi restano distinti.</p>:plotted.length?<figure aria-label={C_INSIGHT_TITLES[output]}>
        <div className="mb-3 flex flex-wrap gap-4 text-xs"><span className="font-medium">{humanColumn(table.columns[metric])}</span>{comparison>=0&&<span className="text-muted-foreground">{`Confronto: ${humanColumn(table.columns[comparison])}`}</span>}</div>
        <div style={{height:view==='bar'?Math.max(280,plotted.length*(comparison>=0?34:27)+55):330}} className="min-w-0">
          <ResponsiveContainer width="100%" height="100%">{view==='bar'?<BarChart data={plotted} layout="vertical" margin={{left:0,right:20,top:6,bottom:10}}><CartesianGrid horizontal={false} strokeDasharray="3 4" stroke="hsl(var(--border))"/><XAxis type="number" tickFormatter={axis} tick={{fontSize:10}}/><YAxis type="category" dataKey="name" width={160} tick={{fontSize:10}} tickFormatter={v=>String(v).length>26?String(v).slice(0,25)+'…':String(v)}/><ReferenceLine x={0} stroke="hsl(var(--muted-foreground))"/><Tooltip content={tooltip}/><Bar dataKey="value" isAnimationActive={false} radius={[0,4,4,0]}>{plotted.map(d=><Cell key={d.sourceRow} fill={(d.value??0)<0?'var(--viz-3)':'var(--viz-1)'}/>)}</Bar>{comparison>=0&&<Bar dataKey="other" fill="var(--viz-2)" isAnimationActive={false}/>}</BarChart>:<LineChart data={plotted} margin={{left:8,right:20,top:10,bottom:10}}><CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--border))"/><XAxis dataKey="name" minTickGap={25} tick={{fontSize:10}}/><YAxis tickFormatter={axis} tick={{fontSize:10}}/><Tooltip content={tooltip}/><Line type="linear" dataKey="value" stroke="var(--viz-1)" dot={{r:2}} connectNulls={false} isAnimationActive={false}/>{comparison>=0&&<Line type="linear" dataKey="other" stroke="var(--viz-2)" strokeDasharray="5 3" connectNulls={false} isAnimationActive={false}/>}</LineChart>}</ResponsiveContainer>
        </div><figcaption className="mt-2 text-xs text-muted-foreground">{`${itNumber(plotted.length)} categorie mostrate. Tutti i valori, compresi i totali, sono nel dettaglio. Nessuna somma aggiunta; i dati assenti non diventano zero.`}</figcaption>
      </figure>:<p className="text-sm text-muted-foreground">Nessun valore disponibile per questa selezione.</p>}
    </>}
    <details open={descriptiveOnly} className="rounded-xl border border-border"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">{`${descriptiveOnly?'Risultati e contesto':'Valori e dettaglio'} · ${itNumber(rows.length)} voci`}</summary>
      <div className="max-h-[480px] overflow-auto px-4"><table className="w-full text-left text-xs"><caption className="sr-only">{C_INSIGHT_TITLES[output]}</caption><thead className="sticky top-0 bg-card"><tr>{visible.map(c=><th key={c} className="min-w-24 max-w-80 border-b border-border px-3 py-3" scope="col">{humanColumn(table.columns[c])}</th>)}</tr></thead><tbody>{rows.slice(currentPage*20,(currentPage+1)*20).map(r=><tr key={r.sourceRow}>{visible.map(c=><td key={c} className={`min-w-24 max-w-96 border-b border-border/50 px-3 py-3 ${Array.isArray(r.cells[c])?'whitespace-nowrap text-right tabular-nums':'break-words'}`}>{Array.isArray(r.cells[c])?cWorkbookLabel(r.cells[c],formats,table.columns[c]):cInsightCellText(cWorkbookRaw(r.cells[c]))||'—'}</td>)}</tr>)}</tbody></table></div>
      {rows.length>20&&<div className="flex items-center justify-between p-4 text-xs"><span>{`Pagina ${currentPage+1} di ${Math.ceil(rows.length/20)}`}</span><div className="flex gap-2"><button className={action} disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={14}/>Indietro</button><button className={action} disabled={(currentPage+1)*20>=rows.length} onClick={()=>setPage(currentPage+1)}>Avanti<ChevronRight size={14}/></button></div></div>}
    </details>
  </div>;
}

export function PillarCInsightsPanel({index,section,featured=false}:{index:CWorkbookIndex;section:CWorkbookSectionId;featured?:boolean}) {
  const root=useRef<HTMLDivElement>(null),definitions=index.outputs.filter(o=>o.section===section&&o.availability==='snapshot');
  const preferred=featured?'O-10-03':C_INSIGHT_DEFAULTS[section];
  const [selected,setSelected]=useState(definitions.find(o=>o.id===preferred)?.id??definitions[0]?.id),[block,setBlock]=useState(0);
  const {data,failed,retry}=useInsightData(index,section,root),definition=definitions.find(o=>o.id===selected)??definitions[0],output=data?.outputs.find(o=>o.id===definition?.id),table=output?.tables[block]??output?.tables[0];
  if(!definition)return null;
  const modelled=/^ML-[123]|ML-4.*SYN/.test(definition.id);
  return <article ref={root} className={`min-w-0 rounded-2xl border bg-card p-5 shadow-sm md:p-6 ${featured?'border-primary/25':'border-border'}`}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium text-primary">{featured?'Attribuzione della spesa':familyTitles[section]??C_WORKBOOK_SECTIONS.find(s=>s[0]===section)?.[1]}</p><h3 className="mt-1 text-lg font-semibold">{C_INSIGHT_TITLES[definition.id]??'Approfondimento'}</h3></div>{modelled&&<span className="rounded-full bg-secondary px-3 py-1 text-xs">Dati sintetici · scenario</span>}</div>
    {featured&&<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Questi importi riguardano prodotti compatibili con più portafogli terapeutici. Non possono essere assegnati integralmente a ciascuna area né identificano il reparto che li ha utilizzati.</p>}
    {!featured&&definitions.length>1&&<label className="mt-4 block max-w-3xl text-xs font-medium">Approfondimento<select className={select} value={definition.id} onChange={e=>{setSelected(e.target.value);setBlock(0);}}>{definitions.map(o=><option key={o.id} value={o.id}>{C_INSIGHT_TITLES[o.id]??'Approfondimento'}</option>)}</select></label>}
    {!data?<div role="status" className="mt-5 min-h-24 rounded-xl bg-secondary/30 p-4 text-sm text-muted-foreground">{failed?<><p>Il risultato non è disponibile in questo momento.</p><button className={`${action} mt-3`} onClick={retry}>Riprova</button></>:'Caricamento dell’analisi…'}</div>:output&&<>
      {output.tables.length>1&&<label className="mt-4 block max-w-3xl text-xs font-medium">Vista<select className={select} value={block} onChange={e=>setBlock(Number(e.target.value))}>{output.tables.map((t,i)=><option key={i} value={i}>{cInsightBlockName(t,i)}</option>)}</select></label>}
      {table&&<InsightView key={`${definition.id}-${block}`} table={table} formats={data.formats} output={definition.id} section={section}/>}
    </>}
    <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{modelled?'Ipotesi modellate, non osservazioni delle persone o dei reparti. ':''}{section==='attribuzione'||section==='composizione'?'Raggruppamenti terapeutici in bozza, con revisione di dominio in attesa. ':''}{section==='costi'?'Scomposizione parziale; la copertura è consultabile nell’approfondimento dedicato. ':''}Fonti, periodi e limiti di interpretazione sono raccolti nella sezione Evidenza.</p>
  </article>;
}
export function PillarCInsightsSection({index,section}:{index:CWorkbookIndex;section:CWorkbookSectionId}) {
  const definition=C_WORKBOOK_SECTIONS.find(s=>s[0]===section)!,number=String(C_WORKBOOK_SECTIONS.findIndex(s=>s[0]===section)+1).padStart(2,'0'),copy=questions[section]??[definition[1],definition[2]];
  return <section id={section} aria-labelledby={`${section}-title`} className="scroll-mt-6 xl:scroll-mt-56"><div className="mb-5 flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-xs text-primary">{number}</span><div><h2 id={`${section}-title`} className="text-xl font-semibold">{copy[0]}</h2><p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">{copy[1]}</p></div></div><PillarCInsightsPanel index={index} section={section}/></section>;
}
