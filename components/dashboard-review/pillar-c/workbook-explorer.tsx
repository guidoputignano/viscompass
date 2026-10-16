"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownUp, BarChart3, ChevronLeft, ChevronRight, FileSpreadsheet, LineChart as LineIcon, Search, RotateCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { C_WORKBOOK_SECTIONS, cWorkbookLabel, cWorkbookRaw, cWorkbookRows, cWorkbookPlotRows, cWorkbookComparableColumns, cWorkbookMetricUnits, cWorkbookLabelColumn, cWorkbookAxisLabel as workbookAxisLabel, parseCWorkbookSection, type CWorkbookIndex, type CWorkbookSection, type CWorkbookSectionId, type CWorkbookTable } from "@/lib/dashboard-review/pillar-c/workbook";
import { itNumber } from "@/lib/format/it-number";

const control = "mt-1.5 h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const defaults: Partial<Record<CWorkbookSectionId, string>> = { spesa: "O-10-02", composizione: "O-11-02", attribuzione: "O-10-05", cambiamento: "O-12-04", costi: "ML-4-REAL", confronti: "O-14-03", attivita: "PUB-04", pianificazione: "PUB-09-v2", numerosita: "ML-3-SENS", tendenze: "O-17-01", previsione: "O-18-04", sensibilita: "PC-19/SG", priorita: "PC-20", evidenza: "O-03-03" };
const descriptions: Partial<Record<CWorkbookSectionId, string>> = {
  composizione: "Quote per ATC e portafoglio, variazioni di composizione e rettifiche. Le quote sono quelle calcolate nel workbook, non nuove normalizzazioni.",
  attribuzione: "Copertura della mappatura, spesa condivisa e limiti di allocazione. Un portafoglio ATC non è un reparto o un’indicazione clinica.",
  costi: "Strati confrontabili, esclusioni e scomposizioni parziali. Le vie con unità reali e imputate restano separate, con i rispettivi limiti di copertura.",
  confronti: "Composizione e indici grezzi o standardizzati nei perimetri supportati. Le decisioni sulla comparabilità delle fonti restano parte dell’analisi.",
  attivita: "Andamenti pubblici, residenti e attività ospedaliera. I dati di contesto conservano il proprio anno e non sostituiscono conteggi di persone trattate.",
  tendenze: "Profili mensili e pendenze registrate. I segnali non ancora revisionati non entrano nei grafici o nelle risposte del server.",
  sensibilita: "Alternative registrate alla mappatura e alle ipotesi. Una sensibilità non è una probabilità o un risultato clinico osservato.",
  priorita: "Priorità per risolvere lacune di evidenza e organizzare approfondimenti, con il ruolo proposto e la prova di chiusura prevista.",
};
function useWorkbookSection(section: CWorkbookSectionId, index: CWorkbookIndex, target: React.RefObject<HTMLDivElement | null>) {
  const [result, setResult] = useState<CWorkbookSection | null>(null), [failed, setFailed] = useState(false), [attempt, retry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let started = false;
    const load = async () => {
      if (started) return; started = true; setFailed(false);
      try {
        const response = await fetch(`/api/pillar-c/workbook?section=${encodeURIComponent(section)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("unavailable");
        const value = parseCWorkbookSection(await response.json(), section, index);
        if (!controller.signal.aborted) setResult(value);
      } catch { if (!controller.signal.aborted) setFailed(true); }
    };
    const node = target.current;
    if (!node || typeof IntersectionObserver === "undefined") { void load(); return () => controller.abort(); }
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { void load(); observer.disconnect(); } }, { rootMargin: "240px" });
    observer.observe(node);
    return () => { observer.disconnect(); controller.abort(); };
  }, [section, index, target, attempt]);
  return { result, failed, retry: () => retry(x => x + 1) };
}
function sourceColumn(column: number): string { let s = "", n = column; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
function metricDefault(table: CWorkbookTable, outputId: string): number {
  const preferred = outputId.startsWith('ML-4') ? /Quantità.*Shapley/i : outputId === 'O-14-03' ? /D std \(pp/i : null;
  const specific = preferred ? table.numericColumns.find(c => preferred.test(table.columns[c])) : undefined;
  if (specific !== undefined) return specific;
  return table.numericColumns.find(c => /€|quota|copertura|pendenza|variaz/i.test(table.columns[c]) && !/residuo|controllo|crit\./i.test(table.columns[c])) ?? table.numericColumns[0] ?? -1;
}

function WorkbookTableView({ table, formats, outputId, section }: { table: CWorkbookTable; formats: Record<string, string>; outputId: string; section: CWorkbookSectionId }) {
  const params = useSearchParams(), prefix = `cw_${section}_`;
  const initialMetric = Number(params.get(prefix + "metrica"));
  const metric = params.has(prefix + "metrica") && table.numericColumns.includes(initialMetric) ? initialMetric : metricDefault(table, outputId);
  const [xMetric, setXMetric] = useState(table.numericColumns.find(c => c !== metric) ?? metric);
  const [comparisonMetric, setComparisonMetric] = useState(-1);
  const [labelColumn, setLabelColumn] = useState(() => cWorkbookLabelColumn(table));
  const [view, setView] = useState<"bar" | "line" | "scatter">(section === "tendenze" || outputId === "PUB-04" ? "line" : "bar");
  const [query, setQuery] = useState(""), [facets, setFacets] = useState<Record<number, string>>({}), [sortColumn, setSortColumn] = useState<number | null>(null), [direction, setDirection] = useState<"asc" | "desc">("desc"), [page, setPage] = useState(0);
  const [includeTotals, setIncludeTotals] = useState(false);
  const rows = useMemo(() => cWorkbookRows(table, query, facets, sortColumn, direction), [table, query, facets, sortColumn, direction]);
  const selectedCells = useMemo(() => rows.map(r => r.cells), [rows]);
  const comparable = useMemo(() => cWorkbookComparableColumns(table, metric, formats, selectedCells), [table, metric, formats, selectedCells]);
  const comparison = comparable.includes(comparisonMetric) ? comparisonMetric : -1;
  const mixedUnits = cWorkbookMetricUnits(table, metric, formats, selectedCells).length > 1;
  const cWorkbookAxisLabel = (v: number, source: CWorkbookTable, column: number, format: Record<string, string>) => workbookAxisLabel(v, source, column, format, selectedCells);
  const facetColumns = useMemo(() => table.columns.flatMap((h, c) => {
    if (!/^(?:confronto|periodo|anno|azienda|canale|ambito|unità|classe|stato|partizione|livello|versione|tipo|serie)(?:\s|$)/i.test(h) || table.numericColumns.includes(c)) return [];
    const values = [...new Set(table.rows.map(r => cWorkbookRaw(r[c])).filter(Boolean))];
    return values.length > 1 && values.length <= 40 ? [{ c, label: h, values }] : [];
  }).slice(0, 5), [table]);
  const label = labelColumn < 0 ? 0 : labelColumn;
  const isTotal = (row: typeof rows[number]) => /^(?:tot|totale|total)$/i.test(cWorkbookRaw(row.cells[0]).trim());
  const totalRows = rows.filter(isTotal).length, canHideTotals = totalRows > 0 && totalRows < rows.length;
  const chartRows = canHideTotals && !includeTotals ? rows.filter(row => !isTotal(row)) : rows;
  const candidates = cWorkbookPlotRows(table, chartRows, formats, metric, label, xMetric, view, view === "scatter" ? -1 : comparison);
  const eligible = candidates.filter(d => d.value !== null || d.other !== null);
  const shown = (view === "line" ? candidates : eligible).slice(0, view === "line" ? 120 : view === "scatter" ? 500 : 25), pageSize = 25, lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1), currentPage = Math.min(page, lastPage);
  const resetPage = () => setPage(0);
  const persistMetric = (next: number) => { const p = new URLSearchParams(window.location.search); p.set(prefix + "metrica", String(next)); window.history.replaceState(null, "", `${window.location.pathname}?${p}${window.location.hash}`); };
  const tooltip = ({ active, payload }: { active?: boolean; payload?: { payload?: typeof shown[number] }[] }) => {
    const d = payload?.[0]?.payload; return active && d ? <div className="max-w-sm rounded-xl border border-border bg-card p-3 text-xs shadow-md"><p className="font-semibold">{d.name}</p><p className="mt-1">{table.columns[metric]}: {d.exact}</p>{comparison >= 0 && view !== "scatter" && <p>{table.columns[comparison]}: {d.otherExact}</p>}{view === "scatter" && <p>{table.columns[xMetric]}: {d.xExact}</p>}<p className="mt-1 text-muted-foreground">Riga workbook {d.sourceRow}</p></div> : null;
  };
  const synthetic = /(?:^ML-[123]|SYN)/.test(outputId);
  return <div className="mt-5 space-y-5">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-medium text-muted-foreground">Cerca nelle righe<div className="relative"><Search size={15} className="absolute left-3 top-5" aria-hidden="true" /><input className={`${control} pl-9`} value={query} onChange={e => { setQuery(e.target.value); resetPage(); }} placeholder="Prodotto, ATC, area…" /></div></label>
      {facetColumns.map(({ c, label: h, values }) => <label key={c} className="text-xs font-medium text-muted-foreground">{h}<select className={control} value={facets[c] ?? ""} onChange={e => { setFacets({ ...facets, [c]: e.target.value }); resetPage(); }}><option value="">Tutti i valori del blocco</option>{values.map(v => <option key={v} value={v}>{v}</option>)}</select></label>)}
      <label className="text-xs font-medium text-muted-foreground">Ordina le righe<select className={control} value={sortColumn ?? "source"} onChange={e => { setSortColumn(e.target.value === "source" ? null : Number(e.target.value)); resetPage(); }}><option value="source">Ordine del workbook</option>{table.columns.map((h, c) => <option key={c} value={c}>{h}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="mr-auto text-muted-foreground">{itNumber(rows.length)} righe selezionate · nessuna aggregazione aggiunta</span><button type="button" className={button} disabled={sortColumn === null} onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}><ArrowDownUp size={14} aria-hidden="true" />{direction === "asc" ? "Crescente" : "Decrescente"}</button><button type="button" className={button} onClick={() => { setQuery(""); setFacets({}); setSortColumn(null); resetPage(); }}><RotateCcw size={14} aria-hidden="true" />Azzera righe</button></div>
    {table.numericColumns.length > 0 && <>
      {canHideTotals && <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="size-4 accent-primary" checked={includeTotals} onChange={e => setIncludeTotals(e.target.checked)} />Includi nel grafico le righe di totale, sempre presenti nel dettaglio</label>}
      <div className="grid gap-4 rounded-xl bg-secondary/40 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-medium">Misura del grafico<select aria-label={`Misura ${outputId}`} className={control} value={metric} onChange={e => persistMetric(Number(e.target.value))}>{table.numericColumns.map(c => <option key={c} value={c}>{table.columns[c]} · col. {sourceColumn(table.startColumn + c)}</option>)}</select></label>
        <label className="text-xs font-medium">Etichetta delle righe<select aria-label={`Etichetta ${outputId}`} className={control} value={label} onChange={e => setLabelColumn(Number(e.target.value))}>{table.columns.map((h, c) => <option key={c} value={c}>{h}</option>)}</select></label>
        {view !== "scatter" && comparable.length > 0 && <label className="text-xs font-medium">Confronta una seconda misura<select aria-label={`Confronto ${outputId}`} className={control} value={comparison} onChange={e => setComparisonMetric(Number(e.target.value))}><option value={-1}>Una sola misura</option>{comparable.map(c => <option key={c} value={c}>{table.columns[c]}</option>)}</select></label>}
        {view === "scatter" && <label className="text-xs font-medium">Misura sull’asse orizzontale<select className={control} value={xMetric} onChange={e => setXMetric(Number(e.target.value))}>{table.numericColumns.map(c => <option key={c} value={c}>{table.columns[c]}</option>)}</select></label>}
        <div className="self-end"><p className="mb-1.5 text-xs font-medium">Visualizzazione</p><div className="flex gap-1" role="group" aria-label={`Visualizzazione ${outputId}`}>{([['bar', 'Barre', BarChart3], ['line', 'Linee', LineIcon], ['scatter', 'Relazione', Search]] as const).map(([value, title, Icon]) => <button key={value} type="button" className={`${button} ${view === value ? "border-primary bg-primary/10 text-primary" : ""}`} aria-pressed={view === value} onClick={() => setView(value)} title={title}><Icon size={15} aria-hidden="true" /><span className="sr-only sm:not-sr-only">{title}</span></button>)}</div></div>
      </div>
      {shown.length ? <figure aria-label={`${table.columns[metric]} · ${outputId}`}>
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs"><span className="font-medium">{table.columns[metric]}</span><span className="text-muted-foreground">Valori esatti nel dettaglio</span></div>
        {comparison >= 0 && view !== "scatter" && <div className="mb-3 flex flex-wrap gap-4 text-xs"><span><span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full bg-[var(--viz-1)]" />{table.columns[metric]}</span><span><span aria-hidden="true" className="mr-2 inline-block size-2 rotate-45 bg-[var(--viz-2)]" />{table.columns[comparison]}</span></div>}
        <div className="min-w-0" style={{ height: view === "bar" ? Math.max(280, shown.length * (comparison >= 0 ? 36 : 26) + 60) : 360 }} data-workbook-chart={outputId}>
          <ResponsiveContainer width="100%" height="100%">
            {view === "bar" ? <BarChart data={shown} layout="vertical" margin={{ top: 8, right: 20, bottom: 10, left: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" /><XAxis type="number" tickFormatter={v => cWorkbookAxisLabel(v, table, metric, formats)} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} tickFormatter={v => String(v).length > 24 ? String(v).slice(0, 23) + '…' : String(v)} /><ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" /><Tooltip content={tooltip} /><Bar dataKey="value" name={table.columns[metric]} isAnimationActive={false} maxBarSize={24} radius={[0, 4, 4, 0]}>{shown.map(d => <Cell key={d.sourceRow} fill={(d.value ?? 0) < 0 ? "var(--viz-3)" : "var(--viz-1)"} stroke={synthetic ? "hsl(var(--foreground))" : undefined} strokeDasharray={synthetic ? "4 3" : undefined} />)}</Bar>{comparison >= 0 && <Bar dataKey="other" name={table.columns[comparison]} fill="var(--viz-2)" isAnimationActive={false} maxBarSize={24} radius={[0, 4, 4, 0]} />}</BarChart>
              : view === "line" ? <LineChart data={shown} margin={{ top: 10, right: 20, left: 10, bottom: 15 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 10 }} minTickGap={25} /><YAxis tick={{ fontSize: 10 }} tickFormatter={v => cWorkbookAxisLabel(v, table, metric, formats)} /><Tooltip content={tooltip} /><ReferenceLine y={0} stroke="hsl(var(--border))" /><Line type="linear" dataKey="value" name={table.columns[metric]} stroke="var(--viz-1)" strokeWidth={2} strokeDasharray={synthetic ? "5 4" : undefined} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />{comparison >= 0 && <Line type="linear" dataKey="other" name={table.columns[comparison]} stroke="var(--viz-2)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />}</LineChart>
              : <ScatterChart margin={{ top: 10, right: 20, left: 15, bottom: 30 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis type="number" dataKey="x" name={table.columns[xMetric]} tick={{ fontSize: 10 }} tickFormatter={v => cWorkbookAxisLabel(v, table, xMetric, formats)} label={{ value: table.columns[xMetric], position: 'bottom', fontSize: 10 }} /><YAxis type="number" dataKey="value" name={table.columns[metric]} tick={{ fontSize: 10 }} tickFormatter={v => cWorkbookAxisLabel(v, table, metric, formats)} /><Tooltip content={tooltip} /><Scatter data={shown} fill="var(--viz-1)" isAnimationActive={false} /></ScatterChart>}
          </ResponsiveContainer>
        </div>
        <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">{shown.filter(d => d.value !== null || d.other !== null).length} righe numeriche mostrate su {eligible.length}; {chartRows.length - eligible.length} senza valore per questa visualizzazione restano nel dettaglio. {canHideTotals && !includeTotals ? `${totalRows} righe di totale sono solo nel dettaglio. ` : ''}{view === 'line' ? 'I punti seguono l’ordine selezionato; i valori assenti interrompono la linea, senza interpolazione o nuove stime.' : 'La selezione non viene sommata o trasformata in una quota.'}</figcaption>
      </figure> : <p role="status" className="rounded-xl bg-secondary/40 p-4 text-sm">{mixedUnits ? 'Questa misura contiene unità diverse. Seleziona una sola unità nel filtro per confrontarla nel grafico; tutte le righe restano nel dettaglio.' : 'Nessun valore numerico disponibile per questa misura e questi filtri. I valori mancanti non sono zeri.'}</p>}
    </>}
    <details className="rounded-xl border border-border" open={table.numericColumns.length === 0}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Valori esatti e righe del workbook · {itNumber(rows.length)} righe</summary>
      <div className="max-h-[520px] overflow-auto px-4"><table className="w-full text-left text-xs"><caption className="sr-only">{outputId} · {table.sheet}!{table.range}</caption><thead className="sticky top-0 z-10 bg-card"><tr><th scope="col" className="border-b border-border px-2 py-3">Riga</th>{table.columns.map((h, c) => <th key={c} scope="col" className="min-w-24 max-w-80 border-b border-border px-2 py-3 font-semibold">{h}</th>)}</tr></thead><tbody>{rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(({ cells, sourceRow }) => <tr key={sourceRow}><th scope="row" className="border-b border-border/50 px-2 py-3 text-muted-foreground">{sourceRow}</th>{cells.map((c, j) => <td key={j} className={`min-w-24 max-w-96 border-b border-border/50 px-2 py-3 align-top ${Array.isArray(c) ? "whitespace-nowrap text-right tabular-nums" : "break-words"}`}>{cWorkbookLabel(c, formats, table.columns[j])}</td>)}</tr>)}</tbody></table></div>
      <div className="flex items-center justify-between gap-3 p-4 text-xs"><span>Pagina {currentPage + 1} di {lastPage + 1}</span><div className="flex gap-2"><button type="button" className={button} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={14} aria-hidden="true" />Indietro</button><button type="button" className={button} disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Avanti<ChevronRight size={14} aria-hidden="true" /></button></div></div>
    </details>
    {table.notes.length > 0 && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Intestazioni e contesto del blocco</summary><div className="mt-2 space-y-2">{table.notes.map(([r, notes]) => <p key={r}>Riga {r}: {notes.filter(Boolean).join(' · ')}</p>)}</div></details>}
  </div>;
}

export function PillarCWorkbookExplorer({ index, section }: { index: CWorkbookIndex; section: CWorkbookSectionId }) {
  const root = useRef<HTMLDivElement>(null), params = useSearchParams(), key = `cw_${section}_output`;
  const definitions = index.outputs.filter(o => o.section === section);
  const fromUrl = params.get(key), initial = definitions.find(o => o.id === fromUrl)?.id ?? definitions.find(o => o.id === defaults[section])?.id ?? definitions[0]?.id;
  const selected = initial, [block, setBlock] = useState(0);
  const { result, failed, retry } = useWorkbookSection(section, index, root);
  const definition = definitions.find(o => o.id === selected) ?? definitions[0], output = result?.outputs.find(o => o.id === definition?.id), table = output?.tables[block] ?? output?.tables[0];
  if (!definition) return null;
  return <div ref={root} className="mt-6 min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6" data-workbook-family={section}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><FileSpreadsheet size={15} aria-hidden="true" />Esplora il workbook</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Selettori locali, distinti dai filtri delle viste precedenti. Ogni blocco conserva il proprio ambito congelato.</p></div><span className="rounded-full border border-border px-3 py-1 text-[10px] text-muted-foreground">{definitions.length} output nel registro</span></div>
    <label className="mt-5 block text-xs font-medium">Analisi da esplorare<select aria-label={`Analisi workbook ${section}`} className={control} value={definition.id} onChange={e => { setBlock(0); const p = new URLSearchParams(window.location.search); p.set(key, e.target.value); p.delete(`cw_${section}_metrica`); window.history.replaceState(null, '', `${window.location.pathname}?${p}${window.location.hash}`); }}>{definitions.map(o => <option key={o.id} value={o.id}>{o.title}{o.availability === 'withheld' ? ' · trattenuto' : ''}</option>)}</select></label>
    <div className="mt-4 space-y-2"><h3 className="text-base font-semibold">{definition.title}</h3><p className="text-xs leading-5 text-muted-foreground">{definition.tier} · Ambito del blocco: {definition.grain}. {definition.qualifier !== '—' ? definition.qualifier : ''}</p><p className="text-[11px] text-muted-foreground">{definition.id} · R5 · ammissione e accettazione del metodo restano distinte dalla rappresentazione.</p></div>
    {definition.availability === 'withheld' ? <p role="status" className="mt-5 rounded-xl border border-border bg-secondary/30 p-4 text-sm leading-6">{definition.reason}</p>
      : !result ? <div role="status" className="mt-5 min-h-32 rounded-xl bg-secondary/30 p-5 text-sm text-muted-foreground">{failed ? <><p>Questo approfondimento non è disponibile. Nessun valore viene sostituito.</p><button type="button" className={`${button} mt-3`} onClick={retry}>Riprova</button></> : 'Caricamento dei risultati del workbook…'}</div>
      : output && <>
        {output.tables.length > 1 && <label className="mt-4 block text-xs font-medium">Dettaglio da esplorare<select className={control} value={block} onChange={e => { setBlock(Number(e.target.value)); const p = new URLSearchParams(window.location.search); p.delete(`cw_${section}_metrica`); window.history.replaceState(null, '', `${window.location.pathname}?${p}${window.location.hash}`); }}>{output.tables.map((t, i) => <option key={i} value={i}>{t.notes[0]?.[1].find(Boolean) ?? `${t.sheet} · ${t.range}`}</option>)}</select></label>}
        {table && <WorkbookTableView key={`${definition.id}-${block}`} table={table} formats={result.formats} outputId={definition.id} section={section} />}
      </>}
    <details className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Provenienza e perimetro</summary><p className="mt-2 break-words">{definition.ranges.join(' · ')}</p><p className="mt-2">Le celle provengono dal workbook congelato. Il grafico non modifica la base di calcolo e non crea dati per ambiti assenti. I dati sintetici e i rifiuti di metodo restano qualificati.</p></details>
  </div>;
}

export function PillarCWorkbookSection({ index, section }: { index: CWorkbookIndex; section: CWorkbookSectionId }) {
  const definition = C_WORKBOOK_SECTIONS.find(([id]) => id === section)!;
  const number = String(C_WORKBOOK_SECTIONS.findIndex(([id]) => id === section) + 1).padStart(2, '0');
  return <section id={section} aria-labelledby={`${section}-title`} className="scroll-mt-6 xl:scroll-mt-36"><div className="mb-5 flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-xs font-semibold text-primary">{number}</span><div><h2 id={`${section}-title`} className="text-xl font-semibold tracking-tight">{definition[1]}</h2><p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">{descriptions[section] ?? definition[2]}</p></div></div><PillarCWorkbookExplorer index={index} section={section} /></section>;
}
