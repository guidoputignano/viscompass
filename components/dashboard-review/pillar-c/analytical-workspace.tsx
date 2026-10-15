"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ArrowDownUp, Copy, RotateCcw, Wallet, FileCheck2, CalendarRange } from "lucide-react";
import { BarChart, Bar, Cell, CartesianGrid, LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, KpiCard } from "@/components/dashboard-review/analytics-ui";
import { LocalToggle } from "@/components/dashboard-review/pillar-b-local-toggle";
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
  return <details className="mt-5 rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Origine e controlli di ciascuna analisi</summary><div className="mt-4 space-y-5">{packet.lineage.map((row) => <div key={row.section} className="border-b border-border/60 pb-4 last:border-0 last:pb-0"><h4 className="text-sm font-semibold">{C_REVIEW_SECTIONS[row.section].label}</h4><p className="mt-1 text-xs text-muted-foreground">{row.outputIds.join(" · ")} · controlli numerici di perimetro superati · accettazione in attesa</p><p className="mt-2 break-all text-xs">{row.workbookRanges.join(" · ")}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{row.section === "budget" ? "Solo le righe confrontate del 2024 pubblicato, 2025 e gen–mag 2026 modellati. Il piano annuale 2026 non è incluso." : row.section === "counts" ? "Righe annuali CO e sensibilità del denominatore. Non sono conteggi osservati di persone trattate." : "Importi, conteggi e periodi dei campi presenti in questa vista; nessuna approvazione ereditata dagli altri output."}</p><details className="mt-3 text-xs"><summary className="cursor-pointer font-medium text-primary">Impronte di fonti e metodi</summary><p className="mt-2 break-all leading-5">Ricevuta: {row.receiptSha256}</p><ul className="mt-2 space-y-1 break-all">{row.sourceHashes.map((hash) => <li key={hash}>Fonte: {hash}</li>)}{row.methodHashes.map((hash) => <li key={hash}>Metodo: {hash}</li>)}</ul></details></div>)}</div></details>;
}
const sections = [["spesa", "01", "Spesa"], ["cambiamento", "02", "Variazioni"], ["pianificazione", "03", "Budget"], ["numerosita", "04", "Numerosità"], ["evidenza", "05", "Evidenza"]];

export function PillarCAnalyticalWorkspace({ packet }: { packet: CReviewPacket }) {
  const search = useSearchParams(), filters = cReviewFilters(search), data = selectCReview(packet, filters);
  const [copied, setCopied] = useState(false);
  const update = (patch: Partial<CReviewFilters>, reset = false) => {
    window.history.pushState(null, "", `${window.location.pathname}${cReviewSearch(window.location.search, patch, reset)}${window.location.hash}`);
    setCopied(false);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { setCopied(false); } };
  const baseline = data.baseline;
  const monthly = data.months.map((r) => ({ ...r, label: monthNames[r.month - 1] }));
  const max = Math.max(1, ...monthly.map((r) => Math.abs(r.amount ?? 0)));
  const divisor = max >= 1_000_000 ? 1_000_000 : max >= 1000 ? 1000 : 1;
  const axisUnit = divisor === 1_000_000 ? "Milioni di euro" : divisor === 1000 ? "Migliaia di euro" : "Euro";
  const bridgeMax = Math.max(1, ...data.bridge.map((r) => Math.abs(Number(r.value))));
  const budgets = data.budgets;
  const budgetValues = budgets.flatMap((r) => [Number(r.budget), Number(r.actual ?? 0), Number(r.alternative ?? 0)]);
  const budgetMin = Math.min(0, ...budgetValues), budgetMax = Math.max(1, ...budgetValues);
  const budgetPosition = (n: number) => (n - budgetMin) / (budgetMax - budgetMin) * 100;
  const countRows = data.counts.filter((r) => r.state === "CALCOLATO").sort((a, b) => Number(b.perPerson) - Number(a.perPerson) || a.portfolio.localeCompare(b.portfolio));
  const countValues = countRows.flatMap((r) => [Number(r.lowCountCost), Number(r.highCountCost), Number(r.perPerson)]);
  const countMin = Math.min(0, ...countValues), countMax = Math.max(1, ...countValues);
  const countPosition = (n: number) => (n - countMin) / (countMax - countMin) * 100;
  const scope = `${C_ORG_LABELS[filters.org]} · ${filters.channel === "Tutti" ? "Tutti i canali" : filters.channel}`;
  return <div className="space-y-8 pb-12" data-pillar-c-review="v1" data-release-state="review_only">
    <PageHeader eyebrow="Pillar C · Revisione riservata" title="Spesa, budget e aree cliniche" description="Esplora gli importi riconciliati e le ipotesi di pianificazione. Ogni sezione mantiene il proprio periodo, perimetro e significato." scope={packet.workbookVersion} />
    <div role="note" className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-4"><p className="text-sm font-semibold">Calcoli controllati nel perimetro indicato · accettazione finale in corso</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Questa vista è riservata alla revisione di progetto. Non attiva il rilascio per le Aziende. Budget ripartiti e numerosità stimata conservano le proprie ipotesi; le previsioni non sono incluse.</p></div>
    <nav aria-label="Sezioni dell’analisi Pillar C" className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2 sm:grid-cols-3 xl:grid-cols-5">{sections.map(([id, n, label]) => <a key={id} href={`#${id}`} className="flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><span className="text-[10px] font-semibold text-primary">{n}</span>{label}</a>)}</nav>
    <section aria-label="Ambito di revisione" className="rounded-2xl border border-border bg-card p-5 md:p-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_auto]">
      <label className="text-xs font-medium text-muted-foreground">Ambito<select aria-label="Ambito aziendale" className={selectClass} value={filters.org} onChange={(e) => update({ org: e.target.value as CReviewFilters["org"] })}>{C_ORGS.map((org) => <option key={org} value={org}>{C_ORG_LABELS[org]}</option>)}</select></label>
      <label className="text-xs font-medium text-muted-foreground">Canale<select aria-label="Canale dell’analisi" className={selectClass} value={filters.channel} onChange={(e) => update({ channel: e.target.value as CReviewFilters["channel"] })}>{["Tutti", "CO", "DD", "DPC"].map((c) => <option key={c} value={c}>{c === "Tutti" ? "Tutti i canali" : c}</option>)}</select></label>
      <div className="flex flex-wrap items-end gap-2"><button className={actionClass} onClick={copy} type="button"><Copy size={14} aria-hidden="true" />{copied ? "Link copiato" : "Copia vista"}</button><button className={actionClass} onClick={() => update({}, true)} type="button"><RotateCcw size={14} aria-hidden="true" />Azzera</button></div>
    </div><p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">{scope}. Periodi e misure sono accanto ai grafici; la numerosità resta una vista CO distinta.</p><p className="sr-only" role="status">{scope}. Selezione aggiornata.</p></section>

    <section id="spesa" aria-labelledby="spesa-title" className="scroll-mt-6"><Heading id="spesa" number="01" title="Come cambia la spesa nel tempo?">Importi netti, rettifiche negative e mesi rappresentati nel registro fornito.</Heading>
      <div className="mb-5 flex flex-wrap gap-4"><label className="min-w-48 text-xs font-medium text-muted-foreground">Periodo della spesa<select aria-label="Periodo della spesa" className={selectClass} value={filters.period} onChange={(e) => update({ period: e.target.value as CReviewFilters["period"] })}>{C_PERIODS.map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label></div>
      {baseline ? <><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label={`Spesa netta · ${C_PERIOD_LABELS[filters.period]}`} value={eur(baseline.net)} detail={scope} icon={Wallet} accent /><KpiCard label="Importi positivi" value={eur(baseline.positive)} detail="Prima delle rettifiche negative" icon={ArrowDownUp} /><KpiCard label="Rettifiche negative" value={eur(baseline.negative)} detail="Incluse, non rimosse dal totale" icon={FileCheck2} /><KpiCard label="Mesi rappresentati" value={`${monthly.filter((r) => r.rows > 0).length} / ${monthly.length}`} detail="Non certifica la completezza degli invii" icon={CalendarRange} /></div></> : <Empty>Nessun dato verificato per questa selezione. Il valore non viene sostituito con zero.</Empty>}
      <Panel title={`Profilo della spesa · ${C_PERIOD_LABELS[filters.period]}`} description={`${scope}. ${axisUnit}.`} controls={<LocalToggle label="Vista" value={filters.trend} options={[{ value: "monthly", label: "Mensile" }, { value: "cumulative", label: "Cumulata" }]} onChange={(trend) => update({ trend })} ariaLabel="Vista della spesa" />}>
        <div className="h-72 min-w-0" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {filters.trend === "monthly" ? <BarChart data={monthly} margin={{ top: 12, right: 10, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={chartTick} />
              <YAxis tickFormatter={(n) => fmt(Number(n) / divisor)} width={55} axisLine={false} tickLine={false} tick={chartTick} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} formatter={(v: number, _name, item) => [eur(item.payload.exact ?? v), "Spesa netta"]} />
              <Bar dataKey="amount" isAnimationActive={false} radius={[4, 4, 0, 0]}>{monthly.map((r) => <Cell key={r.month} fill={(r.amount ?? 0) < 0 ? "var(--viz-4)" : "var(--viz-1)"} />)}</Bar>
            </BarChart> : <LineChart data={monthly} margin={{ top: 12, right: 10, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={chartTick} />
              <YAxis tickFormatter={(n) => fmt(Number(n) / divisor)} width={55} axisLine={false} tickLine={false} tick={chartTick} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} formatter={(v: number, _name, item) => [eur(item.payload.exact ?? v), "Spesa cumulata"]} />
              <Line dataKey="amount" type="linear" connectNulls={false} stroke="var(--viz-1)" strokeWidth={3} isAnimationActive={false} />
            </LineChart>}
          </ResponsiveContainer>
        </div>
        <ExactTable caption="Spesa e righe per mese" headers={["Mese", filters.trend === "monthly" ? "Spesa netta" : "Spesa cumulata", "Righe rappresentate"]} rows={monthly.map((r) => [r.label, eur(r.exact), itNumber(r.rows)])} />
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Un mese assente interrompe la cumulata. Il 2026 è limitato a gennaio–maggio e non è confrontato con dodici mesi.</p>
      </Panel>
    </section>

    <section id="cambiamento" aria-labelledby="cambiamento-title" className="scroll-mt-6"><Heading id="cambiamento" number="02" title="Quali componenti spiegano la variazione?">Un ponte contabile con periodi omogenei. I contributi non sono effetti clinici, di prezzo o di volume.</Heading>
      <Panel title={`${C_PERIOD_LABELS[data.leftPeriod as keyof typeof C_PERIOD_LABELS]} → ${C_PERIOD_LABELS[data.rightPeriod as keyof typeof C_PERIOD_LABELS]}`} description={scope} controls={<LocalToggle label="Confronto" value={filters.comparison} options={[{ value: "K1", label: "2024 → 2025" }, { value: "K2", label: "Gen–mag 2025 → 2026" }]} onChange={(comparison) => update({ comparison })} ariaLabel="Periodi del ponte" />}>
        {data.left && data.right && data.bridge.length ? <><div className="mb-6 grid gap-3 sm:grid-cols-3">{[["Spesa iniziale", eur(data.left.net)], ["Variazione", signed(cMoneyDifference(data.right.net, data.left.net))], ["Spesa finale", eur(data.right.net)]].map(([label, value]) => <div key={label} className="rounded-xl bg-secondary/50 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{value}</p></div>)}</div><div className="space-y-5">{data.bridge.map((r) => <div key={r.component}><div className="mb-2 flex justify-between gap-3 text-sm"><span>{C_COMPONENT_LABELS[r.component]}</span><span className="shrink-0 font-semibold tabular-nums">{signed(r.value)}</span></div><div className="relative h-4 rounded bg-secondary" aria-hidden="true"><span className="absolute -top-1 bottom-[-4px] left-1/2 w-px bg-border" /><span className="absolute h-full rounded-sm" style={{ left: Number(r.value) < 0 ? `${50 - Math.abs(Number(r.value)) / bridgeMax * 50}%` : "50%", width: `${Math.abs(Number(r.value)) / bridgeMax * 50}%`, background: Number(r.value) < 0 ? "var(--viz-3)" : "var(--viz-2)" }} /></div></div>)}</div><ExactTable caption="Componenti del ponte" headers={["Componente", "Contributo", "Celle prodotto"]} rows={data.bridge.map((r) => [C_COMPONENT_LABELS[r.component], signed(r.value), itNumber(r.cells)])} /></> : <Empty>Il confronto non è disponibile nel pacchetto verificato.</Empty>}
      </Panel>
    </section>

    <section id="pianificazione" aria-labelledby="pianificazione-title" className="scroll-mt-6"><Heading id="pianificazione" number="03" title="Come si confrontano budget e spesa ripartita?">Due chiavi di allocazione affiancate. L’intervallo è una sensibilità alle ipotesi, non un intervallo di confidenza.</Heading>
      <Panel title={`Pianificazione per area · ${C_PERIOD_LABELS[filters.budgetPeriod]}`} description="Seleziona una singola Azienda e un canale. Dipartimenti e discipline non vengono sommati tra loro." controls={<LocalToggle label="Ordine" value={filters.budgetOrder} options={[{ value: "amount", label: "Importo" }, { value: "difference", label: "Differenza" }]} onChange={(budgetOrder) => update({ budgetOrder })} ariaLabel="Ordine delle aree" />}>
        <div className="mb-5 flex flex-wrap gap-2"><button type="button" className={actionClass} onClick={() => update({ org: "TE", channel: "CO", budgetPeriod: "FY2024", budget: "published", level: "Dipartimento", area: "all" })}>Budget pubblicati · ASL 4 · CO 2024</button><button type="button" className={actionClass} onClick={() => update({ org: filters.org === "Regione" ? "AQ" : filters.org, channel: filters.channel === "Tutti" ? "CO" : filters.channel, budgetPeriod: "FY2025", budget: "synthetic", level: "Disciplina", area: "all" })}>Piano modellato 2025 · {filters.org === "Regione" ? "ASL 1" : C_ORG_LABELS[filters.org]}</button></div>
        <div className="mb-6 grid gap-4 sm:grid-cols-3"><label className="text-xs font-medium text-muted-foreground">Periodo del budget<select aria-label="Periodo del budget" className={selectClass} value={filters.budgetPeriod} onChange={(e) => update({ budgetPeriod: e.target.value as CReviewFilters["budgetPeriod"], area: "all" })}>{(["FY2024", "FY2025", "JM2026"] as const).map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Fonte del budget<select aria-label="Fonte del budget" className={selectClass} value={filters.budget} onChange={(e) => update({ budget: e.target.value as CReviewFilters["budget"], area: "all" })}><option value="published">Budget pubblicato</option><option value="synthetic">Budget modellato</option></select></label><label className="text-xs font-medium text-muted-foreground">Livello organizzativo<select aria-label="Livello del budget" className={selectClass} value={filters.level} onChange={(e) => update({ level: e.target.value as CReviewFilters["level"], area: "all" })}><option value="Dipartimento">Dipartimento</option><option value="Disciplina">Disciplina</option></select></label></div>
        {data.availableBudgets.length > 0 && <label className="mb-6 block max-w-sm text-xs font-medium text-muted-foreground">Area da esplorare<select aria-label="Area del budget" value={filters.area} className={selectClass} onChange={(e) => update({ area: e.target.value })}><option value="all">Tutte le aree dell’ambito</option>{data.availableBudgets.map((r) => <option key={r.id} value={r.area}>{r.level} {r.area}</option>)}</select></label>}
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
          {budgets.length > 12 && <p className="mt-4 text-xs text-muted-foreground">Prime 12 aree nel grafico; tutte le {budgets.length} aree sono nella tabella.</p>}
          <ExactTable caption="Budget, due chiavi e differenze neutrali" headers={["Area", "Fonte", "Budget", "Chiave principale", "Alternativa", "Differenza principale"]} rows={budgets.map((r) => [`${r.level} ${r.area}`, r.basis === "published" ? "Pubblicato" : "Modellato · ML-2", eur(r.budget), eur(r.actual), eur(r.alternative), r.actual === null ? "Non confrontabile" : signed(cMoneyDifference(r.actual, r.budget))])} />
        </> : <Empty>Nessuna coppia verificata per questo ambito. Prova ASL 4, CO o DD, Anno 2024, budget pubblicato e livello Dipartimento; oppure una singola Azienda con budget modellato nel 2025 o gen–mag 2026.</Empty>}
        <p className="mt-5 text-xs leading-5 text-muted-foreground">Dati sintetici: ripartizione per area — ML-1; budget modellato — ML-2, quando selezionato. La compatibilità del perimetro del budget pubblicato non è stabilita: le differenze non misurano sovra/sottospesa organizzativa.</p>
      </Panel>
    </section>

    <section id="numerosita" aria-labelledby="numerosita-title" className="scroll-mt-6"><Heading id="numerosita" number="04" title="Quanto dipende il rapporto dalla numerosità ipotizzata?">Scenario CO con tasso regionale di dimissione 2023 e residenti al 31 dicembre 2024. Non rappresenta pazienti distinti osservati.</Heading>
      <Panel title="Spesa per paziente nello scenario di numerosità stimata" description={`${C_ORG_LABELS[filters.org]} · solo CO. Confronto fra ipotesi di denominatore, non graduatoria di performance.`} controls={<LocalToggle label="Anno CO" value={filters.countPeriod} options={[{ value: "FY2024", label: "2024" }, { value: "FY2025", label: "2025" }]} onChange={(countPeriod) => update({ countPeriod })} ariaLabel="Anno dello scenario CO" />}>
        <label className="mb-5 block max-w-sm text-xs font-medium text-muted-foreground">Portafoglio dello scenario<select aria-label="Portafoglio dello scenario" className={selectClass} value={filters.portfolio} onChange={(e) => update({ portfolio: e.target.value })}><option value="all">Tutti i portafogli disponibili</option>{Array.from(new Set(packet.counts.map((r) => r.portfolio))).sort().map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        {countRows.length ? <><div className="mb-3 flex justify-between gap-3 text-[10px] tabular-nums text-muted-foreground" aria-hidden="true"><span>{eur(countMin)}</span><span>Euro / persona nello scenario</span><span>{eur(countMax)}</span></div><div className="space-y-4">{countRows.map((r) => <div key={r.portfolio}>
          <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs"><span className="font-semibold">{r.portfolio}</span><span className="tabular-nums">{eur(r.perPerson)} / persona nello scenario</span></div>
          <div className="relative h-5 rounded bg-secondary" aria-hidden="true">
            {countMin < 0 && <span className="absolute top-0 h-5 border-l border-border" style={{ left: `${countPosition(0)}%` }} />}
            <span className="absolute top-2 h-1 bg-primary/35" style={{ left: `${countPosition(Math.min(Number(r.highCountCost), Number(r.lowCountCost)))}%`, width: `${Math.abs(Number(r.lowCountCost) - Number(r.highCountCost)) / (countMax - countMin) * 100}%` }} />
            <span className="absolute top-1 size-3 rounded-full border-2 border-card bg-primary" style={{ left: `calc(${countPosition(Number(r.perPerson))}% - 6px)` }} />
          </div>
        </div>)}</div><ExactTable caption="Numerosità e sensibilità del denominatore" headers={["Portafoglio", "Numerosità base stimata", "Spesa S2 CO", "0,75× numerosità", "1× numerosità", "1,25× numerosità"]} rows={countRows.map((r) => [r.portfolio, fmt(Number(r.persons)), eur(r.spend), eur(r.lowCountCost), eur(r.perPerson), eur(r.highCountCost)])} /></> : <Empty>Il portafoglio selezionato non ha un rapporto disponibile nel perimetro verificato. Nessun denominatore viene inventato.</Empty>}
        {data.counts.some((r) => r.state !== "CALCOLATO") && <p className="mt-4 text-xs text-muted-foreground">{data.counts.filter((r) => r.state !== "CALCOLATO").length} portafogli senza rapporto disponibile restano nel registro di copertura; non sono trattati come zero.</p>}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Dati sintetici: numerosità stimata dai dimessi — ML-3b. L’intervallo mostra le ipotesi 0,75× e 1,25× senza probabilità né limite garantito. I raggruppamenti ATC restano in bozza, con revisione di dominio in attesa. Le popolazioni dei portafogli possono sovrapporsi e non si sommano. Il canale globale non modifica questa vista CO.</p>
      </Panel>
    </section>

    <section id="evidenza" aria-labelledby="evidenza-title" className="scroll-mt-6"><Heading id="evidenza" number="05" title="Che cosa è pronto e che cosa resta in verifica?">Questa vista non eredita un’approvazione da un totale corretto.</Heading><Panel title="Perimetro della revisione"><div className="grid gap-5 md:grid-cols-3">{[["Controlli numerici disponibili", "Spesa mensile, periodi omogenei, ponte contabile, confronto di budget e scenario CO nei rispettivi perimetri verificati."], ["In completamento", "Composizione e concentrazione, classificazioni, benchmark, unità/mix, anomalie e altri output del workbook richiedono i propri controlli."], ["Previsioni escluse", "La verifica del fitting e dell’ammissione dei modelli è ancora aperta. Nessuna curva previsionale viene caricata da questo pacchetto."]].map(([title, text]) => <div key={title}><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</div><OutputLineage packet={packet} /><details className="mt-6 rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Versione e tracciabilità</summary><dl className="mt-4 space-y-3 text-xs"><div><dt className="font-semibold">Workbook</dt><dd className="mt-1 break-all">{packet.workbookVersion} · {packet.workbookSha256}</dd></div><div><dt className="font-semibold">Ricevute numeriche</dt><dd className="mt-1 break-all">Spesa: {packet.evidence.financial}<br />Budget e numerosità: {packet.evidence.budgetCount}</dd></div><div><dt className="font-semibold">Stato</dt><dd className="mt-1">Revisione di progetto · accettazione indipendente e di dominio non attestata da questa interfaccia.</dd></div></dl></details><Link href="?vista=interfaccia" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-primary">Apri l’anteprima separata dell’interfaccia<ArrowRight size={14} aria-hidden="true" /></Link></Panel></section>
  </div>;
}
