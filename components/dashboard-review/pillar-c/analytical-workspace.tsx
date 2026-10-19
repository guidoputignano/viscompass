"use client";

import { useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownUp, Copy, RotateCcw, Wallet, FileCheck2, CalendarRange, ChartArea, ChartNoAxesCombined, BarChart3 } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, Cell, CartesianGrid, LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, KpiCard } from "@/components/dashboard-review/analytics-ui";
import { LocalToggle } from "@/components/dashboard-review/pillar-b-local-toggle";
import { PillarCSectionNavigation } from "@/components/dashboard-review/pillar-c/section-navigation";
import { PillarCForecastPanel } from "@/components/dashboard-review/pillar-c/forecast-section";
import { PillarCInsightsPanel, PillarCInsightsSection, PillarCInsightsProvider } from "@/components/dashboard-review/pillar-c/insight-panels";
import { PillarCChangeBridge } from "@/components/dashboard-review/pillar-c/change-bridge";
import { PillarCAttributionAnalysis } from "@/components/dashboard-review/pillar-c/attribution-analysis";
import { PillarCPortfolioDossier, PillarPurposeNavigation } from "@/components/dashboard-review/pillar-c/portfolio-dossier";
import { PillarCEvidenceWorkflow } from "@/components/dashboard-review/pillar-c/evidence-workflow";
import { cBudgetFilters, cBudgetSearch, cDecisionAnswer, cInsightResetSearch } from "@/lib/dashboard-review/pillar-c/insights";
import type { CWorkbookIndex } from "@/lib/dashboard-review/pillar-c/workbook";
import { itNumber } from "@/lib/format/it-number";
import { C_COMPONENT_LABELS, C_ORGS, C_ORG_LABELS, C_PERIOD_LABELS, C_PERIODS, C_REVIEW_SECTIONS, cMoneyDifference, cMoneyLabel, cReviewFilters, cReviewSearch, selectCReview, type CReviewFilters, type CReviewPacket } from "@/lib/dashboard-review/pillar-c/review";

const eur = cMoneyLabel;
const signed = (value: string | number) => `${Number(value) > 0 ? "+" : ""}${eur(value)}`;
const fmt = (value: number) => itNumber(value, { maximumFractionDigits: 1 });
const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const selectClass = "mt-2 h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const actionClass = "inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const chartTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, color: "hsl(var(--foreground))" };

function Panel({ title, description, controls, children }: { title: string; description?: string; controls?: React.ReactNode; children: React.ReactNode }) {
  return <article className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-base font-semibold">{title}</h3>{description && <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{description}</p>}</div>{controls}</div>{children}</article>;
}
function Heading({ id, number, title, children }: { id: string; number: string; title: string; children: React.ReactNode }) {
  return <div className="mb-5 flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-xs font-semibold text-primary">{number}</span><div><h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight">{title}</h2><p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">{children}</p></div></div>;
}
function ExactTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: React.ReactNode[][] }) {
  return <details className="mt-5 rounded-xl border border-border"><summary className="cursor-pointer rounded-xl px-4 py-3 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Valori e dettaglio · {caption}</summary><div className="overflow-x-auto px-4 pb-4"><table className="w-full text-left text-xs"><caption className="sr-only">{caption}</caption><thead><tr>{headers.map((h) => <th scope="col" key={h} className="whitespace-nowrap border-b border-border px-2 py-3 font-semibold">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 ? <th key={j} scope="row" className="border-b border-border/50 px-2 py-3 font-medium">{cell}</th> : <td key={j} className="whitespace-nowrap border-b border-border/50 px-2 py-3 tabular-nums">{cell}</td>)}</tr>)}</tbody></table></div></details>;
}
function Empty({ children }: { children: React.ReactNode }) { return <p role="status" className="rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">{children}</p>; }
function OutputLineage({ packet }: { packet: CReviewPacket }) {
  return <details className="mt-5 rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Fonti e significato delle analisi</summary><div className="mt-4 grid gap-5 md:grid-cols-2">{packet.lineage.map(row => <div key={row.section}><h4 className="text-sm font-semibold">{C_REVIEW_SECTIONS[row.section].label}</h4><p className="mt-2 text-xs leading-5 text-muted-foreground">{row.section === "budget" ? "Budget pubblicati o modellati, affiancati alla spesa allocata per area. Perimetri non coincidenti: nessun giudizio di sovra o sottospesa." : row.section === "counts" ? "Scenari CO con numerosità stimata. Non sono conteggi osservati di persone trattate." : row.section === "forecast" ? "Serie regionali storiche pubbliche AIFA e previsione con intervalli. Non è un budget aziendale." : "Importi e contributi contabili del rilascio autorizzato, con periodi omogenei e rettifiche conservate."}</p></div>)}</div></details>;
}

export function PillarCAnalyticalWorkspace({ packet, workbook }: { packet: CReviewPacket; workbook?: CWorkbookIndex }) {
  const search = useSearchParams(), filters = cReviewFilters(search), data = selectCReview(packet, filters);
  const [copied, setCopied] = useState(false);
  const [spendView, setSpendView] = useState<'area' | 'line' | 'bar'>('area');
  const spendGradient = useId().replaceAll(':', '');
  const budgetFilters = cBudgetFilters(packet, new URLSearchParams(search));
  const budgetData = selectCReview(packet, budgetFilters);
  const updateBudget = (patch: Partial<CReviewFilters>) => {
    window.history.pushState(null, "", `${window.location.pathname}${cBudgetSearch(packet, window.location.search, patch)}${window.location.hash}`);
    setCopied(false);
  };
  const decision = cDecisionAnswer(packet, filters);
  const update = (patch: Partial<CReviewFilters>, reset = false) => {
    window.history.pushState(null, "", `${window.location.pathname}${reset ? cInsightResetSearch(window.location.search) : cReviewSearch(window.location.search, patch)}${window.location.hash}`);
    setCopied(false);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { setCopied(false); } };
  const baseline = data.baseline;
  const monthly = data.months.map((r) => ({ ...r, label: monthNames[r.month - 1] }));
  const max = Math.max(1, ...monthly.map((r) => Math.abs(r.amount ?? 0)));
  const divisor = max >= 1_000_000 ? 1_000_000 : max >= 1000 ? 1000 : 1;
  const axisUnit = divisor === 1_000_000 ? "Milioni di euro" : divisor === 1000 ? "Migliaia di euro" : "Euro";
  const budgets = budgetData.budgets;
  const budgetValues = budgets.flatMap((r) => [Number(r.budget), Number(r.actual ?? 0), Number(r.alternative ?? 0)]);
  const budgetMin = Math.min(0, ...budgetValues), budgetMax = Math.max(1, ...budgetValues);
  const budgetPosition = (n: number) => (n - budgetMin) / (budgetMax - budgetMin) * 100;
  const countRows = data.counts.filter((r) => r.state === "CALCOLATO").sort((a, b) => Number(b.perPerson) - Number(a.perPerson) || a.portfolio.localeCompare(b.portfolio));
  const countValues = countRows.flatMap((r) => [Number(r.lowCountCost), Number(r.highCountCost), Number(r.perPerson)]);
  const countMin = Math.min(0, ...countValues), countMax = Math.max(1, ...countValues);
  const countPosition = (n: number) => (n - countMin) / (countMax - countMin) * 100;
  const scope = `${C_ORG_LABELS[filters.org]} · ${filters.channel === "Tutti" ? "Tutti i canali" : filters.channel}`;
  return <PillarCInsightsProvider><div className={`space-y-8 pb-12 ${workbook ? "xl:[&_section[id]]:scroll-mt-56" : ""}`} data-pillar-c-review={packet.schema === "pillar-c-review-v2" ? "v2" : "v1"} data-release-state="review_only">
    <PageHeader eyebrow="Pillar C" title="Spesa, budget e aree cliniche" description="Esplora gli importi riconciliati e le ipotesi di pianificazione. Ogni sezione mantiene il proprio periodo, perimetro e significato." />
    <PillarCSectionNavigation extended={Boolean(workbook)} />
    <PillarPurposeNavigation />
    <PillarCPortfolioDossier workbook={workbook}/>
    <section className="rounded-2xl border border-primary/20 bg-card p-5 md:p-6" aria-labelledby="c-decision-title"><p className="text-xs font-medium text-primary">La domanda di gestione</p><h2 id="c-decision-title" className="mt-1 text-xl font-semibold">Più persone trattate o prodotti più costosi?</h2><p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">La spesa osservata e i prodotti che la compongono sono misurabili. I dati disponibili non contano le persone trattate: non possiamo attribuire la variazione a un aumento dei pazienti. Quantità, mix e costo unitario sono scomponibili soltanto nei sottoinsiemi con unità confrontabili.</p><div className="mt-5 grid gap-4 md:grid-cols-3"><div className="rounded-xl bg-secondary/40 p-4"><p className="text-xs text-muted-foreground">Variazione contabile</p><p className="mt-2 text-xl font-semibold">{decision.change === null ? "Non disponibile" : signed(decision.change)}</p><p className="mt-2 text-xs text-muted-foreground">{`${decision.scope} · ${filters.comparison === "K1" ? "2024–2025" : "gen–mag 2025–2026"}`}</p></div><div className="rounded-xl bg-secondary/40 p-4"><p className="text-xs text-muted-foreground">Contributo dei prodotti presenti nei due periodi</p><p className="mt-2 text-xl font-semibold">{decision.continuing === null ? "Non disponibile" : signed(decision.continuing)}</p><p className="mt-2 text-xs text-muted-foreground">Contributo alla variazione, non un effetto causale o clinico.</p></div><div className="rounded-xl bg-secondary/40 p-4"><p className="text-xs text-muted-foreground">Persone trattate osservate</p><p className="mt-2 text-xl font-semibold">Non disponibili</p><p className="mt-2 text-xs text-muted-foreground">Gli scenari CO stimano il denominatore; non misurano più persone trattate.</p></div></div><div className="mt-5 flex flex-wrap gap-3 text-sm"><a className="font-medium text-primary underline underline-offset-4" href="#attribuzione">Spesa condivisa fra aree</a><a className="font-medium text-primary underline underline-offset-4" href="#costi">Quantità, mix e costo</a><a className="font-medium text-primary underline underline-offset-4" href="#numerosita">Scenari di numerosità</a></div></section>

    <section aria-label="Ambito di revisione" className="rounded-2xl border border-border bg-card p-5 md:p-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_auto]">
      <label className="text-xs font-medium text-muted-foreground">Ambito<select aria-label="Ambito aziendale" className={selectClass} value={filters.org} onChange={(e) => update({ org: e.target.value as CReviewFilters["org"] })}>{C_ORGS.map((org) => <option key={org} value={org}>{C_ORG_LABELS[org]}</option>)}</select></label>
      <label className="text-xs font-medium text-muted-foreground">Canale<select aria-label="Canale dell’analisi" className={selectClass} value={filters.channel} onChange={(e) => update({ channel: e.target.value as CReviewFilters["channel"] })}>{["Tutti", "CO", "DD", "DPC"].map((c) => <option key={c} value={c}>{c === "Tutti" ? "Tutti i canali" : c}</option>)}</select></label>
      <div className="flex flex-wrap items-end gap-2"><button className={actionClass} onClick={copy} type="button"><Copy size={14} aria-hidden="true" /><span key={copied ? "copied" : "copy"}>{copied ? "Link copiato" : "Copia vista"}</span></button><button className={actionClass} onClick={() => update({}, true)} type="button"><RotateCcw size={14} aria-hidden="true" />Azzera</button></div>
    </div><p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">{`${scope}. Periodi e misure sono accanto ai grafici; la numerosità resta una vista CO distinta e la previsione resta regionale, su dati pubblici.`}</p><p className="sr-only" role="status">{`${scope}. Selezione aggiornata.`}</p></section>

    <section id="spesa" aria-labelledby="spesa-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="spesa" number="01" title="Come cambia la spesa nel tempo?">Importi netti, rettifiche negative e mesi rappresentati nel registro fornito.</Heading>
      <div className="mb-5 flex flex-wrap gap-4"><label className="min-w-48 text-xs font-medium text-muted-foreground">Periodo della spesa<select aria-label="Periodo della spesa" className={selectClass} value={filters.period} onChange={(e) => update({ period: e.target.value as CReviewFilters["period"] })}>{C_PERIODS.map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label></div>
      {baseline ? <><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label={`Spesa netta · ${C_PERIOD_LABELS[filters.period]}`} value={eur(baseline.net)} detail={scope} icon={Wallet} accent /><KpiCard label="Importi positivi" value={eur(baseline.positive)} detail="Prima delle rettifiche negative" icon={ArrowDownUp} /><KpiCard label="Rettifiche negative" value={eur(baseline.negative)} detail="Incluse, non rimosse dal totale" icon={FileCheck2} /><KpiCard label="Mesi rappresentati" value={`${monthly.filter((r) => r.rows > 0).length} / ${monthly.length}`} detail="Non certifica la completezza degli invii" icon={CalendarRange} /></div></> : <Empty>Nessun dato nel pacchetto di revisione per questa selezione. Il valore non viene sostituito con zero.</Empty>}
      <Panel title={`Profilo della spesa · ${C_PERIOD_LABELS[filters.period]}`} description={`${scope}. ${axisUnit}.`} controls={<LocalToggle label="Vista" value={filters.trend} options={[{ value: "monthly", label: "Mensile" }, { value: "cumulative", label: "Cumulata" }]} onChange={(trend) => update({ trend })} ariaLabel="Vista della spesa" />}>
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Grafico della spesa">{([{id:'area',label:'Area',icon:ChartArea},{id:'line',label:'Linea',icon:ChartNoAxesCombined},{id:'bar',label:'Colonne',icon:BarChart3}] as const).map(({id,label,icon:Icon})=><button key={id} type="button" className={`${actionClass} ${spendView===id?'border-primary bg-primary/5 text-primary':''}`} aria-pressed={spendView===id} onClick={()=>setSpendView(id)}><Icon size={15} aria-hidden="true"/>{label}</button>)}</div>
        <div className="h-72 min-w-0" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {spendView === "area" ? <AreaChart data={monthly} margin={{ top: 12, right: 10, left: 8, bottom: 0 }}>
              <defs><linearGradient id={spendGradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--viz-1)" stopOpacity={0.35}/><stop offset="100%" stopColor="var(--viz-1)" stopOpacity={0.02}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={chartTick} />
              <YAxis tickFormatter={(n) => fmt(Number(n) / divisor)} width={55} axisLine={false} tickLine={false} tick={chartTick} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} formatter={(v: number, _name, item) => [eur(item.payload.exact ?? v), filters.trend === 'monthly' ? 'Spesa netta' : 'Spesa cumulata']} />
              <Area dataKey="amount" type="linear" connectNulls={false} stroke="var(--viz-1)" strokeWidth={2.5} fill={`url(#${spendGradient})`} isAnimationActive={false}/>
            </AreaChart> : spendView === "bar" ? <BarChart data={monthly} margin={{ top: 12, right: 10, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={chartTick} />
              <YAxis tickFormatter={(n) => fmt(Number(n) / divisor)} width={55} axisLine={false} tickLine={false} tick={chartTick} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} formatter={(v: number, _name, item) => [eur(item.payload.exact ?? v), filters.trend === 'monthly' ? 'Spesa netta' : 'Spesa cumulata']} />
              <Bar dataKey="amount" isAnimationActive={false} radius={[4, 4, 0, 0]}>{monthly.map((r) => <Cell key={r.month} fill={(r.amount ?? 0) < 0 ? "var(--viz-4)" : "var(--viz-1)"} />)}</Bar>
            </BarChart> : <LineChart data={monthly} margin={{ top: 12, right: 10, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={chartTick} />
              <YAxis tickFormatter={(n) => fmt(Number(n) / divisor)} width={55} axisLine={false} tickLine={false} tick={chartTick} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} formatter={(v: number, _name, item) => [eur(item.payload.exact ?? v), filters.trend === 'monthly' ? 'Spesa netta' : 'Spesa cumulata']} />
              <Line dataKey="amount" type="linear" connectNulls={false} stroke="var(--viz-1)" strokeWidth={3} isAnimationActive={false} />
            </LineChart>}
          </ResponsiveContainer>
        </div>
        <ExactTable caption="Spesa e righe per mese" headers={["Mese", filters.trend === "monthly" ? "Spesa netta" : "Spesa cumulata", "Righe rappresentate"]} rows={monthly.map((r) => [r.label, eur(r.exact), itNumber(r.rows)])} />
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Un mese assente interrompe la cumulata. Il 2026 è limitato a gennaio–maggio e non è confrontato con dodici mesi.</p>
      </Panel>
    </section>

    {workbook && <><PillarCInsightsPanel index={workbook} section="spesa" /><PillarCInsightsSection index={workbook} section="composizione" /><PillarCAttributionAnalysis /></>}
    <section id="cambiamento" aria-labelledby="cambiamento-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="cambiamento" number={workbook ? "04" : "02"} title="Quali componenti spiegano la variazione?">Un ponte contabile con periodi omogenei. I contributi non sono effetti clinici, di prezzo o di volume.</Heading>
      <Panel title={`${C_PERIOD_LABELS[data.leftPeriod as keyof typeof C_PERIOD_LABELS]} → ${C_PERIOD_LABELS[data.rightPeriod as keyof typeof C_PERIOD_LABELS]}`} description={scope} controls={<LocalToggle label="Confronto" value={filters.comparison} options={[{ value: "K1", label: "2024 → 2025" }, { value: "K2", label: "Gen–mag 2025 → 2026" }]} onChange={(comparison) => update({ comparison })} ariaLabel="Periodi del ponte" />}>
        {data.left && data.right && data.bridge.length ? <><div className="mb-6 grid gap-3 sm:grid-cols-3">{[["Spesa iniziale", eur(data.left.net)], ["Variazione", signed(cMoneyDifference(data.right.net, data.left.net))], ["Spesa finale", eur(data.right.net)]].map(([label, value]) => <div key={label} className="rounded-xl bg-secondary/50 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{value}</p></div>)}</div><PillarCChangeBridge opening={data.left.net} closing={data.right.net} components={data.bridge}/><ExactTable caption="Componenti del ponte" headers={["Componente", "Contributo", "Celle prodotto"]} rows={data.bridge.map((r) => [C_COMPONENT_LABELS[r.component], signed(r.value), itNumber(r.cells)])} /></> : <Empty>Il confronto non è disponibile nel pacchetto di revisione.</Empty>}
      </Panel>
    </section>

    {workbook && <><PillarCInsightsPanel index={workbook} section="cambiamento" /><PillarCInsightsSection index={workbook} section="costi" /><PillarCInsightsSection index={workbook} section="confronti" /><PillarCInsightsSection index={workbook} section="attivita" /></>}
    <section id="pianificazione" aria-labelledby="pianificazione-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="pianificazione" number={workbook ? "08" : "03"} title="Come si confrontano budget e spesa ripartita?">Due chiavi di allocazione affiancate. L’intervallo è una sensibilità alle ipotesi, non un intervallo di confidenza.</Heading>
      <Panel title={`Pianificazione per area · ${C_PERIOD_LABELS[budgetFilters.budgetPeriod]}`} description="Seleziona una singola Azienda e un canale. Dipartimenti e discipline non vengono sommati tra loro." controls={<LocalToggle label="Ordine" value={budgetFilters.budgetOrder} options={[{ value: "amount", label: "Importo" }, { value: "difference", label: "Differenza" }]} onChange={(budgetOrder) => updateBudget({ budgetOrder })} ariaLabel="Ordine delle aree" />}>
        <div className="mb-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium text-muted-foreground">Azienda del budget<select aria-label="Azienda del budget" className={selectClass} value={budgetFilters.org} onChange={e => updateBudget({ org: e.target.value as CReviewFilters["org"], area: "all" })}>{C_ORGS.filter(o => o !== "Regione").map(o => <option key={o} value={o}>{C_ORG_LABELS[o]}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Canale del budget<select aria-label="Canale del budget" className={selectClass} value={budgetFilters.channel} onChange={e => updateBudget({ channel: e.target.value as CReviewFilters["channel"], area: "all" })}>{["CO", "DD", "DPC"].map(c => <option key={c} value={c}>{c}</option>)}</select></label></div><p className="mb-4 text-xs text-muted-foreground">{`Ambito del budget: ${C_ORG_LABELS[budgetFilters.org]} · ${budgetFilters.channel}. Questi controlli sono indipendenti dalle altre analisi.`}</p><div className="mb-5 flex flex-wrap gap-2"><button type="button" className={actionClass} onClick={() => updateBudget({ org: "TE", channel: "CO", budgetPeriod: "FY2024", budget: "published", level: "Dipartimento", area: "all" })}>Budget pubblicati · ASL 4 · CO 2024</button><button type="button" className={actionClass} onClick={() => updateBudget({ org: budgetFilters.org === "Regione" ? "AQ" : budgetFilters.org, channel: budgetFilters.channel === "Tutti" ? "CO" : budgetFilters.channel, budgetPeriod: "FY2025", budget: "synthetic", level: "Disciplina", area: "all" })}>{`Piano modellato 2025 · ${budgetFilters.org === "Regione" ? "ASL 1" : C_ORG_LABELS[budgetFilters.org]}`}</button></div>
        <div className="mb-6 grid gap-4 sm:grid-cols-3"><label className="text-xs font-medium text-muted-foreground">Periodo del budget<select aria-label="Periodo del budget" className={selectClass} value={budgetFilters.budgetPeriod} onChange={(e) => updateBudget({ budgetPeriod: e.target.value as CReviewFilters["budgetPeriod"], area: "all" })}>{(["FY2024", "FY2025", "JM2026"] as const).map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Fonte del budget<select aria-label="Fonte del budget" className={selectClass} value={budgetFilters.budget} onChange={(e) => updateBudget({ budget: e.target.value as CReviewFilters["budget"], area: "all" })}><option value="published">Budget pubblicato</option><option value="synthetic">Budget modellato</option></select></label><label className="text-xs font-medium text-muted-foreground">Livello organizzativo<select aria-label="Livello del budget" className={selectClass} value={budgetFilters.level} onChange={(e) => updateBudget({ level: e.target.value as CReviewFilters["level"], area: "all" })}><option value="Dipartimento">Dipartimento</option><option value="Disciplina">Disciplina</option></select></label></div>
        {budgetData.availableBudgets.length > 0 && <label className="mb-6 block max-w-sm text-xs font-medium text-muted-foreground">Area da esplorare<select aria-label="Area del budget" value={budgetFilters.area} className={selectClass} onChange={(e) => updateBudget({ area: e.target.value })}><option value="all">Tutte le aree dell’ambito</option>{budgetData.availableBudgets.map((r) => <option key={r.id} value={r.area}>{r.level} {r.area}</option>)}</select></label>}
        {budgets.length ? <>
          <div className="mb-5 flex flex-wrap gap-4 text-xs text-muted-foreground"><span>● Chiave principale</span><span>◇ Chiave alternativa</span><span>│ Budget</span></div>
          <div className="mb-3 flex justify-between gap-3 text-[10px] tabular-nums text-muted-foreground" aria-hidden="true"><span>{eur(budgetMin)}</span><span>Scala comune · euro</span><span>{eur(budgetMax)}</span></div>
          <div className="space-y-5">{budgets.slice(0, 12).map((r) => <div key={r.id}>
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span>{r.level} {r.area}</span><span className="font-semibold tabular-nums">{eur(r.actual)}</span></div>
            {r.actual === null ? <p className="text-xs text-muted-foreground">Nessuna riga attribuita: nessun confronto con un consuntivo pari a zero.</p> : <div className="relative h-5 rounded bg-secondary" aria-hidden="true">
              {budgetMin < 0 && <span className="absolute top-0 h-5 border-l border-border" style={{ left: `${budgetPosition(0)}%` }} />}
              <span className="absolute top-2 h-1 bg-primary/35" style={{ left: `${budgetPosition(Math.min(Number(r.actual), Number(r.alternative)))}%`, width: `${Math.abs(Number(r.actual) - Number(r.alternative)) / (budgetMax - budgetMin) * 100}%` }} />
              <span className="absolute top-1.5 size-2 rounded-full bg-primary" style={{ left: `calc(${budgetPosition(Number(r.actual))}% - 4px)` }} />
              <span className="absolute top-1.5 size-2 rotate-45 border border-primary bg-card" style={{ left: `calc(${budgetPosition(Number(r.alternative))}% - 4px)` }} />
              <span className="absolute top-0 h-5 border-l-2 border-foreground" style={{ left: `calc(${budgetPosition(Number(r.budget))}% - 2px)` }} />
            </div>}
          </div>)}</div>
          {budgets.length > 12 && <p className="mt-4 text-xs text-muted-foreground">{`Prime 12 aree nel grafico; tutte le ${budgets.length} aree sono nella tabella.`}</p>}
          <ExactTable caption="Budget, due chiavi e differenze neutrali" headers={["Area", "Fonte", "Budget", "Chiave principale", "Alternativa", "Differenza principale"]} rows={budgets.map((r) => [`${r.level} ${r.area}`, r.basis === "published" ? "Pubblicato" : "Modellato", eur(r.budget), eur(r.actual), eur(r.alternative), r.actual === null ? "Non confrontabile" : signed(cMoneyDifference(r.actual, r.budget))])} />
        </> : <Empty>Nessuna coppia disponibile per questo ambito nel pacchetto di revisione. Prova ASL 4, CO o DD, Anno 2024, budget pubblicato e livello Dipartimento; oppure una singola Azienda con budget modellato nel 2025 o gen–mag 2026.</Empty>}
        <p className="mt-5 text-xs leading-5 text-muted-foreground">Dati sintetici: ripartizione per area e, quando selezionato, budget modellato. La compatibilità del perimetro del budget pubblicato non è stabilita: le differenze non misurano sovra/sottospesa organizzativa.</p>
      </Panel>
    </section>

    {workbook && <PillarCInsightsPanel index={workbook} section="pianificazione" />}
    <section id="numerosita" aria-labelledby="numerosita-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="numerosita" number={workbook ? "09" : "04"} title="Quanto dipende il rapporto dalla numerosità ipotizzata?">Scenario CO con tasso regionale di dimissione 2023 e residenti al 31 dicembre 2024. Non rappresenta pazienti distinti osservati.</Heading>
      <Panel title="Spesa per paziente nello scenario di numerosità stimata" description={`${C_ORG_LABELS[filters.org]} · solo CO. Confronto fra ipotesi di denominatore, non graduatoria di performance.`} controls={<LocalToggle label="Anno CO" value={filters.countPeriod} options={[{ value: "FY2024", label: "2024" }, { value: "FY2025", label: "2025" }]} onChange={(countPeriod) => update({ countPeriod })} ariaLabel="Anno dello scenario CO" />}>
        <label className="mb-5 block max-w-sm text-xs font-medium text-muted-foreground">Portafoglio dello scenario<select aria-label="Portafoglio dello scenario" className={selectClass} value={filters.portfolio} onChange={(e) => update({ portfolio: e.target.value })}><option value="all">Tutti i portafogli disponibili</option>{Array.from(new Set(packet.counts.map((r) => r.portfolio))).sort().map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        {countRows.length ? <><div className="mb-3 flex justify-between gap-3 text-[10px] tabular-nums text-muted-foreground" aria-hidden="true"><span>{eur(countMin)}</span><span>Euro / persona nello scenario</span><span>{eur(countMax)}</span></div><div className="space-y-4">{countRows.map((r) => <div key={r.portfolio}>
          <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs"><span className="font-semibold">{r.portfolio}</span><span className="tabular-nums">{`${eur(r.perPerson)} / persona nello scenario`}</span></div>
          <div className="relative h-5 rounded bg-secondary" aria-hidden="true">
            {countMin < 0 && <span className="absolute top-0 h-5 border-l border-border" style={{ left: `${countPosition(0)}%` }} />}
            <span className="absolute top-2 h-1 bg-primary/35" style={{ left: `${countPosition(Math.min(Number(r.highCountCost), Number(r.lowCountCost)))}%`, width: `${Math.abs(Number(r.lowCountCost) - Number(r.highCountCost)) / (countMax - countMin) * 100}%` }} />
            <span className="absolute top-1 size-3 rounded-full border-2 border-card bg-primary" style={{ left: `calc(${countPosition(Number(r.perPerson))}% - 6px)` }} />
          </div>
        </div>)}</div><ExactTable caption="Numerosità e sensibilità del denominatore" headers={["Portafoglio", "Numerosità base stimata", "Spesa CO attribuita tramite portafoglio", "Numerosità ridotta del 25%", "Numerosità di riferimento", "Numerosità aumentata del 25%"]} rows={countRows.map((r) => [r.portfolio, fmt(Number(r.persons)), eur(r.spend), eur(r.lowCountCost), eur(r.perPerson), eur(r.highCountCost)])} /></> : <Empty>Il portafoglio selezionato non ha un rapporto disponibile nel perimetro del pacchetto di revisione. Nessun denominatore viene inventato.</Empty>}
        {data.counts.some((r) => r.state !== "CALCOLATO") && <p className="mt-4 text-xs text-muted-foreground">{`${data.counts.filter((r) => r.state !== "CALCOLATO").length} portafogli senza rapporto disponibile restano nel registro di copertura; non sono trattati come zero.`}</p>}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Dati sintetici: numerosità stimata dai dimessi. L’intervallo varia la numerosità del 25% in meno e in più, senza probabilità né limite garantito. I raggruppamenti ATC restano in bozza, con revisione di dominio in attesa. Le popolazioni dei portafogli possono sovrapporsi e non si sommano. Il canale globale non modifica questa vista CO.</p>
      </Panel>
    </section>

    {workbook && <><PillarCInsightsPanel index={workbook} section="numerosita" /><PillarCInsightsSection index={workbook} section="tendenze" /></>}
    <section id="previsione" aria-labelledby="previsione-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="previsione" number={workbook ? "11" : "05"} title="Che cosa indica la previsione regionale per il 2026?">{"Serie pubblica AIFA del flusso tracciabilità a livello regionale, con intervalli all’80\u00a0% e al 95\u00a0%. Non segue l’ambito aziendale né il canale selezionati."}</Heading>
      <PillarCForecastPanel forecast={packet.forecast} series={filters.forecastSeries} onSeries={(forecastSeries) => update({ forecastSeries })} published />
      {workbook && <PillarCInsightsPanel index={workbook} section="previsione" />}
    </section>

    {workbook && <><PillarCInsightsSection index={workbook} section="sensibilita" /><PillarCInsightsSection index={workbook} section="priorita" /><PillarCEvidenceWorkflow /></>}

    <section id="evidenza" aria-labelledby="evidenza-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="evidenza" number={workbook ? "14" : "06"} title="Fonti e criteri di lettura">Origine delle misure, perimetro dei controlli e ipotesi di ciascuna analisi.</Heading><Panel title="Come leggere le analisi"><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{[["Spesa e variazioni", "Importi riportati, rettifiche conservate e confronto fra periodi omogenei. Il ponte descrive contributi contabili."], ["Budget per area", "Budget pubblicati o modellati affiancati alla spesa ripartita con due chiavi. Le differenze sono neutrali rispetto alla performance."], ["Scenario CO", "Rapporto fra spesa e numerosità stimata, con sensibilità esplicita del denominatore e portafogli non sommabili."], ["Previsione regionale", "Dati pubblici AIFA a livello regionale, non aziendali. Intervalli all’80\u00a0% e al 95\u00a0%; totale annuo supplementare; la classe C non è ammessa."]].map(([title, text]) => <div key={title}><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</div><OutputLineage packet={packet} /><details className="mt-6 rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Versione e tracciabilità</summary><dl className="mt-4 space-y-3 text-xs"><div><dt className="font-semibold">Workbook</dt><dd className="mt-1 break-all">{packet.workbookVersion} · {packet.workbookSha256}</dd></div><div><dt className="font-semibold">Ricevute numeriche</dt><dd className="mt-1 break-all">Spesa: {packet.evidence.financial}<br />Budget e numerosità: {packet.evidence.budgetCount}{packet.evidence.financialR5Review && <><br />{`Spesa, controllo incrociato: ${packet.evidence.financialR5Review}`}</>}{packet.evidence.budgetCountR5Review && <><br />{`Budget e numerosità, controllo incrociato: ${packet.evidence.budgetCountR5Review}`}</>}{packet.evidence.forecast && <><br />{`Previsione: ${packet.evidence.forecast}`}</>}{packet.evidence.forecastInputs && <><br />{`Previsione, input: ${packet.evidence.forecastInputs}`}</>}{packet.evidence.forecastWorkbookIntegration && <><br />{`Previsione, integrazione nel workbook: ${packet.evidence.forecastWorkbookIntegration}`}</>}</dd></div><div><dt className="font-semibold">Ambito dei controlli</dt><dd className="mt-1">Controlli numerici dei campi indicati. L’accettazione indipendente e di dominio resta distinta dal controllo dell’interfaccia.</dd></div></dl></details></Panel></section>
    {workbook && <PillarCInsightsPanel index={workbook} section="evidenza" />}
  </div></PillarCInsightsProvider>;
}
