"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, BarChart3, ChartArea, ChartNoAxesCombined, ChevronLeft, ChevronRight, CircleDot, Grid3X3, MoveHorizontal, Search, Waypoints } from 'lucide-react';
import { C_WORKBOOK_SECTIONS, cWorkbookAxisLabel, cWorkbookLabel, cWorkbookMetricUnits, cWorkbookNumber, cWorkbookRaw, cWorkbookRows, parseCWorkbookSection, type CWorkbookIndex, type CWorkbookSection, type CWorkbookSectionId, type CWorkbookTable } from '@/lib/dashboard-review/pillar-c/workbook';
import { C_INSIGHT_DEFAULTS, C_INSIGHT_TITLES, cInsightBlockName, cInsightCellText, cInsightDecisionOutputs, cInsightScope, cInsightText, cInsightVisibleColumns } from '@/lib/dashboard-review/pillar-c/insights';
import { C_INSIGHT_CHARTS, cInsightChartOptions, cInsightComparable, cInsightDefaultChart, cInsightIntervals, cInsightMatrixColumns, cInsightPoints, cInsightPreferredComparison, cInsightPreferredMetric, type CInsightChart } from '@/lib/dashboard-review/pillar-c/insight-charts';
import { PillarCInsightChart } from './insight-chart';
import { itNumber } from '@/lib/format/it-number';

const select='mt-1.5 h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm';
const action='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs hover:bg-secondary disabled:opacity-40';
const chartIcons={dot:CircleDot,paired:ArrowLeftRight,matrix:Grid3X3,interval:MoveHorizontal,scatter:Waypoints,line:ChartNoAxesCombined,area:ChartArea,bar:BarChart3};
const questions:Partial<Record<CWorkbookSectionId,[string,string]>>={
  composizione:['Dove si concentra la spesa?','Classi ATC, portafogli terapeutici e variazioni delle quote.'],
  attribuzione:['Quanta spesa è condivisa fra più aree?','Evidenza di attribuzione, spesa condivisa e intervalli per area. I portafogli sono proxy ATC, non reparti osservati.'],
  costi:['Quanto pesano quantità, mix e costo dei prodotti?','Scomposizione descrittiva sui soli confronti ammessi. Le unità imputate rimangono una vista separata.'],
  confronti:['Le differenze rimangono dopo aver considerato il mix?','Confronti nei perimetri supportati e compatibilità delle fonti.'],
  attivita:['Qual è il contesto demografico e ospedaliero?','Fonti pubbliche con anno, territorio e unità propri. Non sono conteggi di persone trattate.'],
  tendenze:['Quali andamenti meritano un approfondimento?','Evoluzione mensile della spesa e variazioni tendenziali.'],
  sensibilita:['Quanto dipende il risultato dalle ipotesi?','Alternative registrate alla classificazione e alle assunzioni.'],
  priorita:['Che cosa approfondire prima?','Questioni organizzative, ruolo proposto e indicatore di follow-up.'],
};
const familyTitles:Partial<Record<CWorkbookSectionId,string>>={spesa:'Dettaglio della spesa',cambiamento:'Prodotti e classi che spiegano il cambiamento',pianificazione:'Budget, allocazione e copertura',numerosita:'Confronta le ipotesi di numerosità',previsione:'Scenari di spesa',evidenza:'Fonti e qualità dei dati'};

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
function humanColumn(raw:string) {
  return cInsightText(raw).replace(/\bLB[12]\b/g,'limite inferiore').replace(/\bUB[12]\b/g,'limite superiore').replace(/\bW[12]\b/g,'ampiezza dell’intervallo').replace(/\bF \(attribuzione tramite portafoglio\)/g,'Spesa attribuita').replace(/\bD std\b/g,'Differenza standardizzata').replace(/\bI std\b/g,'Indice standardizzato').replace(/\bI grezzo\b/g,'Indice grezzo').replace(/\bSC-0\b/g,'Scenario invariato').replace(/\bSC-1\b/g,'Scenario di continuità').replace(/\bSC-L\b/g,'Scenario basso').replace(/\bSC-H\b/g,'Scenario alto');
}

function InsightView({table,formats,output,section}:{table:CWorkbookTable;formats:Record<string,string>;output:string;section:CWorkbookSectionId}) {
  const visible=useMemo(()=>cInsightVisibleColumns(table,output),[table,output]);
  const metrics=table.numericColumns.filter(c=>visible.includes(c));
  const [metric,setMetric]=useState(()=>cInsightPreferredMetric(table,output,visible));
  const [compare,setCompare]=useState(-2),[query,setQuery]=useState(''),[facets,setFacets]=useState<Record<number,string>>({}),[page,setPage]=useState(0);
  const [requestedView,setView]=useState<CInsightChart|'auto'>('auto');
  const [xMetric,setXMetric]=useState(-1),[order,setOrder]=useState<'source'|'asc'|'desc'|'magnitude'>('source'),[chartPage,setChartPage]=useState(0),[pageSize,setPageSize]=useState(12),[intervalIndex,setIntervalIndex]=useState(0);
  const rows=useMemo(()=>cWorkbookRows(table,query,facets,null,'asc'),[table,query,facets]);
  const cells=useMemo(()=>rows.map(r=>r.cells),[rows]);
  const compatible=cInsightComparable(table,rows,formats,metric,visible);
  const automaticComparison=cInsightPreferredComparison(table,metric,compatible);
  const options=cInsightChartOptions({table,rows,formats,metric,visible,output});
  const recommended=cInsightDefaultChart(options,section);
  const view=requestedView!=='auto'&&options.includes(requestedView)?requestedView:recommended;
  const comparison=compatible.includes(compare)?compare:compare===-2?(automaticComparison>=0?automaticComparison:view==='paired'?compatible[0]??-1:-1):-1;
  const mixed=cWorkbookMetricUnits(table,metric,formats,cells).length>1;
  const intervals=cInsightIntervals(table,metric,compatible,output),interval=intervals[intervalIndex]??intervals[0];
  const matrix=cInsightMatrixColumns(table,metric,compatible,output);
  const xOptions=metrics.filter(c=>c!==metric&&cWorkbookMetricUnits(table,c,formats,cells).length===1&&rows.filter(r=>Array.isArray(r.cells[c])&&Array.isArray(r.cells[metric])).length>=2);
  const abscissa=xOptions.includes(xMetric)?xMetric:xOptions[0]??-1;
  const categories=table.columns.flatMap((h,c)=>{
    if(!visible.includes(c)||metrics.includes(c)||! /^(?:confronto|periodo|anno|azienda|canale|ambito|classe|stato|livello|unità|tipo|serie)(?:\s|$)/i.test(h))return [];
    const values=[...new Set(table.rows.map(r=>cWorkbookRaw(r[c])).filter(Boolean))];
    return values.length>1&&values.length<=40?[{c,h:humanColumn(h),values}]:[];
  });
  const plotRows=rows.filter(r=>! /^(?:tot|totale|total)$/i.test(cWorkbookRaw(r.cells[0]).trim()));
  const sourceRows=plotRows.length?plotRows:rows;
  const temporal=view==='line'||view==='area';
  const candidates=sourceRows.filter(r=>{
    if(temporal)return true;
    if(view==='matrix')return matrix.some(c=>cWorkbookNumber(r.cells[c])!==null);
    if(view==='scatter')return cWorkbookNumber(r.cells[metric])!==null&&cWorkbookNumber(r.cells[abscissa])!==null;
    return cWorkbookNumber(r.cells[metric])!==null||(view==='paired'&&comparison>=0&&cWorkbookNumber(r.cells[comparison])!==null);
  });
  const ordered=temporal||order==='source'?candidates:[...candidates].sort((a,b)=>{
    const av=cWorkbookNumber(a.cells[metric]),bv=cWorkbookNumber(b.cells[metric]);
    if(av==null)return bv==null?a.sourceRow-b.sourceRow:1;if(bv==null)return -1;
    return (order==='magnitude'?Math.abs(bv)-Math.abs(av):order==='desc'?bv-av:av-bv)||a.sourceRow-b.sourceRow;
  });
  const currentChartPage=Math.min(chartPage,Math.max(0,Math.ceil(ordered.length/pageSize)-1));
  const chartColumns=[...new Set([metric,...(view==='matrix'?matrix:[]),...((view==='paired'||temporal)&&comparison>=0?[comparison]:[]),...(view==='scatter'?[abscissa]:[]),...(view==='interval'&&interval?[interval.low,interval.high]:[])])];
  const plotted=cInsightPoints(table,ordered.slice(currentChartPage*pageSize,(currentChartPage+1)*pageSize),formats,chartColumns);
  const unbounded=view==='interval'&&interval?plotted.filter(p=>{const lo=p.values[interval.low]?.value,hi=p.values[interval.high]?.value,v=p.values[metric]?.value;return lo==null||hi==null||v==null||lo>v||v>hi;}).length:0;
  const currentPage=Math.min(page,Math.max(0,Math.ceil(rows.length/20)-1));
  const descriptiveOnly=section==='evidenza'||metrics.length===0||/^(O-12-06|O-16-0[234]|O-18-03|PC-05)/.test(output);
  const scope=cInsightScope(table),axis=(v:number,c:number)=>cWorkbookAxisLabel(v,table,c,formats,cells);
  return <div className="mt-5 space-y-5">
    {scope&&<p className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">{`${scope}. I selettori delle altre sezioni non modificano questa vista.`}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-medium text-muted-foreground">Cerca prodotto, classe o area<div className="relative"><Search size={14} aria-hidden="true" className="absolute left-3 top-5"/><input className={`${select} pl-9`} value={query} onChange={e=>{setQuery(e.target.value);setPage(0);setChartPage(0);}} placeholder="Cerca…"/></div></label>
      {categories.map(({c,h,values})=><label key={c} className="text-xs font-medium text-muted-foreground">{h}<select className={select} value={facets[c]??''} onChange={e=>{setFacets({...facets,[c]:e.target.value});setPage(0);setChartPage(0);}}><option value="">Tutti</option>{values.map(v=><option key={v} value={v}>{cInsightCellText(v)}</option>)}</select></label>)}
    </div>
    {!descriptiveOnly&&<>
      <div className="grid gap-4 rounded-xl bg-secondary/30 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs font-medium">Indicatore<select className={select} aria-label="Indicatore del grafico" value={metric} onChange={e=>{setMetric(Number(e.target.value));setCompare(-2);setView('auto');setIntervalIndex(0);setChartPage(0);}}>{metrics.map(c=><option key={c} value={c}>{humanColumn(table.columns[c])}</option>)}</select></label>
        {(view==='paired'||temporal)&&compatible.length>0&&<label className="text-xs font-medium">Confronta con<select className={select} value={comparison} onChange={e=>setCompare(Number(e.target.value))}>{view!=='paired'&&<option value={-1}>Nessun confronto aggiuntivo</option>}{compatible.map(c=><option key={c} value={c}>{humanColumn(table.columns[c])}</option>)}</select></label>}
        {view==='scatter'&&<label className="text-xs font-medium">Indicatore sull’asse orizzontale<select className={select} value={abscissa} onChange={e=>setXMetric(Number(e.target.value))}>{xOptions.map(c=><option key={c} value={c}>{humanColumn(table.columns[c])}</option>)}</select></label>}
        {view==='interval'&&intervals.length>1&&<label className="text-xs font-medium">Intervallo<select className={select} value={intervalIndex<intervals.length?intervalIndex:0} onChange={e=>setIntervalIndex(Number(e.target.value))}>{intervals.map((b,i)=><option key={b.label} value={i}>{b.label}</option>)}</select></label>}
        {!temporal&&<label className="text-xs font-medium">Ordina le voci<select className={select} value={order} onChange={e=>{setOrder(e.target.value as typeof order);setChartPage(0);}}><option value="source">Ordine della fonte</option><option value="desc">Valore decrescente</option><option value="asc">Valore crescente</option><option value="magnitude">Impatto assoluto</option></select></label>}
      </div>
      <div role="group" aria-label="Visualizzazione dell’analisi" className="flex flex-wrap gap-2">{options.map(kind=>{const Icon=chartIcons[kind];return <button type="button" key={kind} className={`${action} ${view===kind?'border-primary bg-primary/5 text-primary shadow-sm':''}`} aria-pressed={view===kind} onClick={()=>{setView(kind);setChartPage(0);if(kind==='paired'&&comparison<0)setCompare(automaticComparison>=0?automaticComparison:compatible[0]??-1);}}><Icon size={15} aria-hidden="true"/>{C_INSIGHT_CHARTS[kind].label}{kind===recommended&&<span className="sr-only"> · consigliata</span>}</button>;})}</div>
      {mixed?<p className="text-sm text-muted-foreground">Seleziona una sola unità per confrontare i valori nel grafico. Gli importi e i conteggi restano distinti.</p>:plotted.length?<figure aria-label={C_INSIGHT_TITLES[output]}>
        <div className="mb-4 space-y-2 text-xs"><p className="font-medium">{humanColumn(table.columns[metric])}</p><p className="text-muted-foreground">{C_INSIGHT_CHARTS[view].description}</p>{(view==='paired'||temporal)&&comparison>=0&&<p className="flex flex-wrap gap-x-4 gap-y-1"><span className="text-primary">● {humanColumn(table.columns[metric])}</span><span>◇ {humanColumn(table.columns[comparison])}</span></p>}{view==='interval'&&interval&&<p className="text-muted-foreground">{interval.label} · limiti riportati, non ricalcolati.</p>}</div>
        <PillarCInsightChart key={`${output}-${metric}-${view}`} kind={view} points={plotted} metric={metric} comparison={comparison} xMetric={abscissa} matrix={matrix} interval={interval} heading={c=>humanColumn(table.columns[c])} axis={axis} title={C_INSIGHT_TITLES[output]}/>
        {unbounded>0&&<p className="mt-3 text-xs text-muted-foreground">{`${itNumber(unbounded)} voci senza intervallo tracciabile: è mostrato solo il punto disponibile. I limiti assenti o non ordinati non vengono ricostruiti.`}</p>}
        {candidates.length<sourceRows.length&&<p className="mt-3 text-xs text-muted-foreground">{`${itNumber(sourceRows.length-candidates.length)} voci senza gli indicatori necessari per questa vista restano nel dettaglio, senza punti fittizi.`}</p>}
        <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{`${itNumber(currentChartPage*pageSize+1)}–${itNumber(currentChartPage*pageSize+plotted.length)} di ${itNumber(ordered.length)} voci. Valori assenti distinti da zero; totali nel dettaglio.`}</span><div className="flex items-center gap-2"><label>Voci per vista<select className="ml-2 h-9 rounded-lg border border-border bg-background px-2" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setChartPage(0);}}>{[12,24,48,96].map(n=><option key={n} value={n}>{n}</option>)}</select></label>{ordered.length>pageSize&&<><button type="button" aria-label="Voci precedenti nel grafico" className={action} disabled={currentChartPage===0} onClick={()=>setChartPage(currentChartPage-1)}><ChevronLeft size={15}/></button><button type="button" aria-label="Voci successive nel grafico" className={action} disabled={(currentChartPage+1)*pageSize>=ordered.length} onClick={()=>setChartPage(currentChartPage+1)}><ChevronRight size={15}/></button></>}</div></figcaption>
      </figure>:<p className="text-sm text-muted-foreground">Nessun valore disponibile per questa selezione.</p>}
    </>}
    <details open={descriptiveOnly} className="rounded-xl border border-border"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">{`${descriptiveOnly?'Risultati e contesto':'Valori e dettaglio'} · ${itNumber(rows.length)} voci`}</summary>
      <div className="max-h-[480px] overflow-auto px-4"><table className="w-full text-left text-xs"><caption className="sr-only">{C_INSIGHT_TITLES[output]}</caption><thead className="sticky top-0 bg-card"><tr>{visible.map(c=><th key={c} className="min-w-24 max-w-80 border-b border-border px-3 py-3" scope="col">{humanColumn(table.columns[c])}</th>)}</tr></thead><tbody>{rows.slice(currentPage*20,(currentPage+1)*20).map(r=><tr key={r.sourceRow}>{visible.map(c=><td key={c} className={`min-w-24 max-w-96 border-b border-border/50 px-3 py-3 ${Array.isArray(r.cells[c])?'whitespace-nowrap text-right tabular-nums':'break-words'}`}>{Array.isArray(r.cells[c])?cWorkbookLabel(r.cells[c],formats,table.columns[c]):cInsightCellText(cWorkbookRaw(r.cells[c]))||'—'}</td>)}</tr>)}</tbody></table></div>
      {rows.length>20&&<div className="flex items-center justify-between p-4 text-xs"><span>{`Pagina ${currentPage+1} di ${Math.ceil(rows.length/20)}`}</span><div className="flex gap-2"><button className={action} disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={14}/>Indietro</button><button className={action} disabled={(currentPage+1)*20>=rows.length} onClick={()=>setPage(currentPage+1)}>Avanti<ChevronRight size={14}/></button></div></div>}
    </details>
  </div>;
}

export function PillarCInsightsPanel({index,section,featured=false}:{index:CWorkbookIndex;section:CWorkbookSectionId;featured?:boolean}) {
  const root=useRef<HTMLDivElement>(null),definitions=cInsightDecisionOutputs(index.outputs,section);
  const preferred=featured?'O-10-03':C_INSIGHT_DEFAULTS[section];
  const [selected,setSelected]=useState(definitions.find(o=>o.id===preferred)?.id??definitions[0]?.id),[block,setBlock]=useState(0);
  const {data,failed,retry}=useInsightData(index,section,root),definition=definitions.find(o=>o.id===selected)??definitions[0],output=data?.outputs.find(o=>o.id===definition?.id),table=output?.tables[block]??output?.tables[0];
  if(!definition)return null;
  const modelled=/^ML-[123]|ML-4.*SYN/.test(definition.id);
  return <article ref={root} className={`min-w-0 rounded-2xl border bg-card p-5 shadow-sm md:p-6 ${featured?'border-primary/25':'border-border'}`}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium text-primary">{featured?'Attribuzione della spesa':familyTitles[section]??C_WORKBOOK_SECTIONS.find(s=>s[0]===section)?.[1]}</p><h3 className="mt-1 text-lg font-semibold">{C_INSIGHT_TITLES[definition.id]??'Approfondimento'}</h3></div>{modelled&&<span className="rounded-full bg-secondary px-3 py-1 text-xs">Dati sintetici · scenario</span>}</div>
    {featured&&<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Questi importi riguardano prodotti compatibili con più portafogli terapeutici. Non possono essere assegnati integralmente a ciascuna area né identificano il reparto che li ha utilizzati.</p>}
    {definition.id==='O-18-04'&&<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Scenari ipotetici di spesa per giugno–dicembre 2026: continuità rispetto al 2025 oppure prosecuzione delle variazioni osservate da gennaio a maggio. I valori bassi e alti descrivono queste ipotesi, non probabilità né previsioni aziendali.</p>}
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
