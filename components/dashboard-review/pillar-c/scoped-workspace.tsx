"use client";

import { useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/dashboard-review/analytics-ui";
import { LocalToggle } from "@/components/dashboard-review/pillar-b-local-toggle";
import { PillarCAudienceProvider, usePillarCAudience } from "@/components/dashboard-review/pillar-c/audience-context";
import { PillarCSectionNavigation } from "@/components/dashboard-review/pillar-c/section-navigation";
import { PillarCForecastPanel } from "@/components/dashboard-review/pillar-c/forecast-section";
import { PillarCAttributionAnalysis } from "@/components/dashboard-review/pillar-c/attribution-analysis";
import { PillarCPortfolioDossier, PillarPurposeNavigation } from "@/components/dashboard-review/pillar-c/portfolio-dossier";
import { PillarCPlanningWorkspace } from "@/components/dashboard-review/pillar-c/planning-workspace";
// The shared blocks come from review-blocks.tsx, never from the reviewer workspace: nothing this component reaches
// carries a province key (review finding UI-4; tests/pillar-c-scoped-client-graph.test.mjs).
import { BridgeValues, BudgetRows, CountRows, CReviewEmpty as Empty, CReviewHeading as Heading, CReviewExactTable as ExactTable, CReviewPanel as Panel, C_REVIEW_UI, SpendChart, SpendKpis, SpendViewButtons } from "@/components/dashboard-review/pillar-c/review-blocks";
import type { CClientAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { C_AUDIENCE_COPY, cAudienceLabel, cClientAudience, cScopedBudgetFilters, cScopedBudgetSearch, cScopedDecision, cScopedHasActs, cScopedPublishedActs, cScopedReviewFilters, cScopedReviewSearch } from "@/lib/dashboard-review/pillar-c/audience-view";
import { cInsightResetSearch } from "@/lib/dashboard-review/pillar-c/reset-search";
import { PILLAR_C_SCOPED_SECTIONS } from "@/lib/dashboard-review/pillar-c/section-navigation";
import { C_PERIOD_LABELS, C_PERIODS, cMoneyLabel, selectCReview, type CForecast } from "@/lib/dashboard-review/pillar-c/review";
import type { CScopedClientReview, CScopedReviewFilters } from "@/lib/dashboard-review/pillar-c/scoped-review";
import { itNumber } from "@/lib/format/it-number";

/** What the page hands to the scoped Pillar C interface (recommendation 5). Every value is already entitled and guarded
 * on the server: the audience's own units only, published budgets only, no lineage, evidence or workbook block, no
 * province key and no other Azienda's name. */
export type PillarCScopedWorkspaceProps = {
  audience: CClientAudience;
  packet: CScopedClientReview;
  /** The public regional forecast (AIFA, CC BY 4.0), the same projection every approved member receives. */
  forecast: CForecast | null;
};

const { selectClass, actionClass, monthNames } = C_REVIEW_UI;
const eur = cMoneyLabel;
const signed = (value: string | number) => `${Number(value) > 0 ? "+" : ""}${eur(value)}`;
const staticField = "mt-2 flex min-h-10 items-center rounded-lg border border-dashed border-border px-3 text-sm text-foreground";

/** The packet must hold exactly the audience's units, in the audience's order: anything else is not this audience's. */
function coherent(audience: CClientAudience, packet: CScopedClientReview | null | undefined) {
  return !!packet && packet.schema === "pillar-c-review-client-v1" && packet.monthlyMode === "explicit" && Array.isArray(packet.orgs)
    && packet.orgs.length === audience.orgs.length && packet.orgs.every((unit, i) => unit === audience.orgs[i].key);
}

/**
 * The interface of an enabled Azienda or Regione member. The audience is MANDATORY and must be an organisation-scoped
 * one whose units are exactly the packet's: otherwise nothing renders and nothing is fetched. It never falls back to
 * the reviewer's options, labels or sections.
 *   - Every «Ambito» offers the audience's own keys only (Azienda: its own name and «Aggregato delle quattro Aziende»;
 *     Regione: «Aggregato regionale» and ASL 1–4 under opaque keys). A link carrying another key shows the default
 *     with a visible note; the API refuses that key anyway.
 *   - Every series reads the rows of exactly the selected key (explicit mode): nothing is summed or subtracted across
 *     organisations here, and there is no «altre Aziende» series and no ranking of Aziende.
 *   - Budgets are published acts only, with the modelled-allocation note; the CO count scenario carries its estimate note.
 *     Each note is shown only with the rows it describes, never under an empty state.
 *   - No per-person or per-patient wording: the CO count panel's title, scale, row unit and table headers read as a
 *     ratio to the estimated count («€ per unità di numerosità stimata»).
 *   - The workbook, the shared review queue, the lineage and the price/quantity/mix decomposition are not part of it.
 */
export function PillarCScopedWorkspace({ audience, packet, forecast }: PillarCScopedWorkspaceProps) {
  const checked = cClientAudience(audience);
  if (!checked || checked.kind === "reviewer" || !coherent(checked, packet)) return null;
  return <PillarCAudienceProvider audience={checked}><ScopedGate packet={packet} forecast={forecast} /></PillarCAudienceProvider>;
}
function ScopedGate({ packet, forecast }: { packet: CScopedClientReview; forecast: CForecast | null }) {
  const audience = usePillarCAudience();
  return audience && audience.kind !== "reviewer" && coherent(audience, packet) ? <ScopedWorkspace audience={audience} packet={packet} forecast={forecast} /> : null;
}

function ScopedWorkspace({ audience, packet, forecast }: { audience: CClientAudience; packet: CScopedClientReview; forecast: CForecast | null }) {
  const search = useSearchParams();
  const { filters, tampered } = cScopedReviewFilters(audience, new URLSearchParams(search));
  const data = selectCReview(packet, filters);
  const label = (key: string) => cAudienceLabel(audience, key) ?? "";
  const [copied, setCopied] = useState(false);
  const [spendView, setSpendView] = useState<"area" | "line" | "bar">("area");
  const spendGradient = useId().replaceAll(":", "");
  const budget = cScopedBudgetFilters(audience, packet, new URLSearchParams(search)), budgetFilters = budget.filters;
  const budgetData = selectCReview(packet, budgetFilters), budgets = budgetData.budgets;
  const budgetLabel = label(budgetFilters.org), hasActs = cScopedHasActs(packet, budgetFilters.org);
  // The planning workspace receives only which Azienda|period|channel has a published departmental act: never a budget row or amount.
  const publishedActs = useMemo(() => cScopedPublishedActs(packet), [packet]);
  const update = (patch: Partial<CScopedReviewFilters>, reset = false) => {
    window.history.pushState(null, "", `${window.location.pathname}${reset ? cInsightResetSearch(window.location.search) : cScopedReviewSearch(audience, window.location.search, patch)}${window.location.hash}`);
    setCopied(false);
  };
  const updateBudget = (patch: Partial<CScopedReviewFilters>) => {
    window.history.pushState(null, "", `${window.location.pathname}${cScopedBudgetSearch(audience, packet, window.location.search, patch)}${window.location.hash}`);
    setCopied(false);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { setCopied(false); } };
  const orgLabel = label(filters.org), channelText = filters.channel === "Tutti" ? "Tutti i canali" : filters.channel;
  const scope = `${orgLabel} · ${channelText}`;
  const decision = cScopedDecision(packet, filters, `${orgLabel} · ${filters.channel === "Tutti" ? "tutti i canali" : filters.channel}`);
  const baseline = data.baseline;
  const monthly = data.months.map((r) => ({ ...r, label: monthNames[r.month - 1] }));
  const max = Math.max(1, ...monthly.map((r) => Math.abs(r.amount ?? 0)));
  const divisor = max >= 1_000_000 ? 1_000_000 : max >= 1000 ? 1000 : 1;
  const axisUnit = divisor === 1_000_000 ? "Milioni di euro" : divisor === 1000 ? "Migliaia di euro" : "Euro";
  const countRows = data.counts.filter((r) => r.state === "CALCOLATO").sort((a, b) => Number(b.perPerson) - Number(a.perPerson) || a.portfolio.localeCompare(b.portfolio));
  const missingCounts = data.counts.filter((r) => r.state !== "CALCOLATO").length;
  return <div className="space-y-8 pb-12 xl:[&_section[id]]:scroll-mt-56" data-pillar-c-review={`scoped-${audience.kind}`} data-release-state="review_only">
    <PageHeader eyebrow="Pillar C" title="Spesa, budget e aree cliniche" description="Esplora gli importi riconciliati e le ipotesi di pianificazione. Ogni sezione mantiene il proprio periodo, perimetro e significato." scope={audience.scopeLine ?? undefined} />
    <PillarCSectionNavigation extended list={PILLAR_C_SCOPED_SECTIONS} />
    <PillarPurposeNavigation />
    <PillarCPortfolioDossier />
    <PillarCPlanningWorkspace publishedActs={publishedActs} />
    <section className="rounded-2xl border border-primary/20 bg-card p-5 md:p-6" aria-labelledby="c-decision-title"><p className="text-xs font-medium text-primary">La domanda di gestione</p><h2 id="c-decision-title" className="mt-1 text-xl font-semibold">Più persone trattate o prodotti più costosi?</h2><p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">La spesa osservata e i prodotti che la compongono sono misurabili. I dati disponibili non contano le persone trattate: non possiamo attribuire la variazione a un aumento dei pazienti.</p><div className="mt-5 grid gap-4 md:grid-cols-3"><div className="rounded-xl bg-secondary/40 p-4"><p className="text-xs text-muted-foreground">Variazione contabile</p><p className="mt-2 text-xl font-semibold">{decision.change === null ? "Non disponibile" : signed(decision.change)}</p><p className="mt-2 text-xs text-muted-foreground">{`${decision.scope} · ${filters.comparison === "K1" ? "2024–2025" : "gen–mag 2025–2026"}`}</p></div><div className="rounded-xl bg-secondary/40 p-4"><p className="text-xs text-muted-foreground">Contributo dei prodotti presenti nei due periodi</p><p className="mt-2 text-xl font-semibold">{decision.continuing === null ? "Non disponibile" : signed(decision.continuing)}</p><p className="mt-2 text-xs text-muted-foreground">Contributo alla variazione, non un effetto causale o clinico.</p></div><div className="rounded-xl bg-secondary/40 p-4"><p className="text-xs text-muted-foreground">Persone trattate osservate</p><p className="mt-2 text-xl font-semibold">Non disponibili</p><p className="mt-2 text-xs text-muted-foreground">Gli scenari CO stimano il denominatore; non misurano più persone trattate.</p></div></div><div className="mt-5 flex flex-wrap gap-3 text-sm"><a className="font-medium text-primary underline underline-offset-4" href="#attribuzione">Spesa condivisa fra aree</a><a className="font-medium text-primary underline underline-offset-4" href="#numerosita">Scenari di numerosità</a></div></section>

    <section aria-label="Ambito di revisione" className="rounded-2xl border border-border bg-card p-5 md:p-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_auto]">
      <label className="text-xs font-medium text-muted-foreground">Ambito<select aria-label="Ambito aziendale" className={selectClass} value={filters.org} onChange={(e) => update({ org: e.target.value as CScopedReviewFilters["org"] })}>{audience.orgs.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
      <label className="text-xs font-medium text-muted-foreground">Canale<select aria-label="Canale dell’analisi" className={selectClass} value={filters.channel} onChange={(e) => update({ channel: e.target.value as CScopedReviewFilters["channel"] })}>{["Tutti", "CO", "DD", "DPC"].map((c) => <option key={c} value={c}>{c === "Tutti" ? "Tutti i canali" : c}</option>)}</select></label>
      <div className="flex flex-wrap items-end gap-2"><button className={actionClass} onClick={copy} type="button"><Copy size={14} aria-hidden="true" /><span key={copied ? "copied" : "copy"}>{copied ? "Link copiato" : "Copia vista"}</span></button><button className={actionClass} onClick={() => update({}, true)} type="button"><RotateCcw size={14} aria-hidden="true" />Azzera</button></div>
    </div>{tampered ? <p role="note" className="mt-4 text-xs font-medium">{C_AUDIENCE_COPY.tampered}</p> : null}<p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">{`${scope}. Periodi e misure sono accanto ai grafici; la numerosità resta una vista CO distinta e la previsione resta regionale, su dati pubblici.`}</p><p className="sr-only" role="status">{`${scope}. Selezione aggiornata.`}</p></section>

    <section id="spesa" aria-labelledby="spesa-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="spesa" number="01" title="Come cambia la spesa nel tempo?">Importi netti, rettifiche negative e mesi rappresentati nel registro fornito.</Heading>
      <div className="mb-5 flex flex-wrap gap-4"><label className="min-w-48 text-xs font-medium text-muted-foreground">Periodo della spesa<select aria-label="Periodo della spesa" className={selectClass} value={filters.period} onChange={(e) => update({ period: e.target.value as CScopedReviewFilters["period"] })}>{C_PERIODS.map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label></div>
      {baseline ? <SpendKpis baseline={baseline} period={filters.period} scope={scope} monthly={monthly} /> : <Empty>Nessun dato nel pacchetto di revisione per questa selezione. Il valore non viene sostituito con zero.</Empty>}
      <Panel title={`Profilo della spesa · ${C_PERIOD_LABELS[filters.period]}`} description={`${scope}. ${axisUnit}.`} controls={<LocalToggle label="Vista" value={filters.trend} options={[{ value: "monthly", label: "Mensile" }, { value: "cumulative", label: "Cumulata" }]} onChange={(trend) => update({ trend })} ariaLabel="Vista della spesa" />}>
        <SpendViewButtons spendView={spendView} setSpendView={setSpendView} />
        <SpendChart monthly={monthly} spendView={spendView} spendGradient={spendGradient} divisor={divisor} trend={filters.trend} />
        <ExactTable caption="Spesa e righe per mese" headers={["Mese", filters.trend === "monthly" ? "Spesa netta" : "Spesa cumulata", "Righe rappresentate"]} rows={monthly.map((r) => [r.label, eur(r.exact), itNumber(r.rows)])} />
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Un mese assente interrompe la cumulata. Il 2026 è limitato a gennaio–maggio e non è confrontato con dodici mesi.</p>
      </Panel>
    </section>

    <PillarCAttributionAnalysis number="02" />
    <section id="cambiamento" aria-labelledby="cambiamento-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="cambiamento" number="03" title="Quali componenti spiegano la variazione?">Un ponte contabile con periodi omogenei. I contributi non sono effetti clinici, di prezzo o di volume.</Heading>
      <Panel title={`${C_PERIOD_LABELS[data.leftPeriod as keyof typeof C_PERIOD_LABELS]} → ${C_PERIOD_LABELS[data.rightPeriod as keyof typeof C_PERIOD_LABELS]}`} description={scope} controls={<LocalToggle label="Confronto" value={filters.comparison} options={[{ value: "K1", label: "2024 → 2025" }, { value: "K2", label: "Gen–mag 2025 → 2026" }]} onChange={(comparison) => update({ comparison })} ariaLabel="Periodi del ponte" />}>
        {data.left && data.right && data.bridge.length ? <BridgeValues left={data.left} right={data.right} bridge={data.bridge} /> : <Empty>Il confronto non è disponibile nel pacchetto di revisione.</Empty>}
      </Panel>
    </section>

    <section id="pianificazione" aria-labelledby="pianificazione-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="pianificazione" number="04" title="Come si confrontano budget e spesa ripartita?">Due chiavi di allocazione affiancate per gli atti di budget pubblicati. L’intervallo è una sensibilità alle ipotesi, non un intervallo di confidenza.</Heading>
      <Panel title={`Pianificazione per area · ${C_PERIOD_LABELS[budgetFilters.budgetPeriod]}`} description={C_AUDIENCE_COPY.budgetSingle} controls={<LocalToggle label="Ordine" value={budgetFilters.budgetOrder} options={[{ value: "amount", label: "Importo" }, { value: "difference", label: "Differenza" }]} onChange={(budgetOrder) => updateBudget({ budgetOrder })} ariaLabel="Ordine delle aree" />}>
        <div className="mb-5 grid gap-4 sm:grid-cols-2">{audience.budgetOrgs.length > 1
          ? <label className="text-xs font-medium text-muted-foreground">Azienda del budget<select aria-label="Azienda del budget" className={selectClass} value={budgetFilters.org} onChange={(e) => updateBudget({ org: e.target.value as CScopedReviewFilters["org"], area: "all" })}>{audience.budgetOrgs.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
          : <div className="text-xs font-medium text-muted-foreground"><span>Azienda del budget</span><p className={staticField}>{`Azienda: ${budgetLabel}`}</p></div>}
          <label className="text-xs font-medium text-muted-foreground">Canale del budget<select aria-label="Canale del budget" className={selectClass} value={budgetFilters.channel} onChange={(e) => updateBudget({ channel: e.target.value as CScopedReviewFilters["channel"], area: "all" })}>{["CO", "DD", "DPC"].map((c) => <option key={c} value={c}>{c}</option>)}</select></label></div>
        <p className="mb-4 text-xs text-muted-foreground">{`Ambito del budget: ${budgetLabel} · ${budgetFilters.channel}. Questi controlli sono indipendenti dalle altre analisi.`}</p>
        {budget.tampered ? <p role="note" className="mb-4 text-xs font-medium">{C_AUDIENCE_COPY.tampered}</p> : null}
        <div className="mb-6 grid gap-4 sm:grid-cols-3"><label className="text-xs font-medium text-muted-foreground">Periodo del budget<select aria-label="Periodo del budget" className={selectClass} value={budgetFilters.budgetPeriod} onChange={(e) => updateBudget({ budgetPeriod: e.target.value as CScopedReviewFilters["budgetPeriod"], area: "all" })}>{(["FY2024", "FY2025", "JM2026"] as const).map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label><div className="text-xs font-medium text-muted-foreground"><span>Fonte del budget</span><p className={staticField}>{C_AUDIENCE_COPY.budgetSource}</p></div><label className="text-xs font-medium text-muted-foreground">Livello organizzativo<select aria-label="Livello del budget" className={selectClass} value={budgetFilters.level} onChange={(e) => updateBudget({ level: e.target.value as CScopedReviewFilters["level"], area: "all" })}><option value="Dipartimento">Dipartimento</option><option value="Disciplina">Disciplina</option></select></label></div>
        {budgetData.availableBudgets.length > 0 && <label className="mb-6 block max-w-sm text-xs font-medium text-muted-foreground">Area da esplorare<select aria-label="Area del budget" value={budgetFilters.area} className={selectClass} onChange={(e) => updateBudget({ area: e.target.value })}><option value="all">Tutte le aree dell’ambito</option>{budgetData.availableBudgets.map((r) => <option key={r.id} value={r.area}>{`${r.level} ${r.area}`}</option>)}</select></label>}
        {budgets.length ? <BudgetRows budgets={budgets} /> : <Empty>{hasActs ? C_AUDIENCE_COPY.budgetEmpty : C_AUDIENCE_COPY.budgetNone}</Empty>}
        {/* The O4 note describes rows: an empty state gets none (review finding UI-2). */}
        {budgets.length > 0 && <p className="mt-5 text-xs font-medium leading-5" data-c-scoped-note="budget">{C_AUDIENCE_COPY.budgetNote}</p>}
      </Panel>
    </section>

    <section id="numerosita" aria-labelledby="numerosita-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="numerosita" number="05" title="Quanto dipende il rapporto dalla numerosità ipotizzata?">Scenario CO con tasso regionale di dimissione 2023 e residenti al 31 dicembre 2024. Non rappresenta pazienti distinti osservati.</Heading>
      <Panel title={C_AUDIENCE_COPY.countsTitle} description={`${orgLabel} · solo CO. Confronto fra ipotesi di denominatore, non graduatoria di performance.`} controls={<LocalToggle label="Anno CO" value={filters.countPeriod} options={[{ value: "FY2024", label: "2024" }, { value: "FY2025", label: "2025" }]} onChange={(countPeriod) => update({ countPeriod })} ariaLabel="Anno dello scenario CO" />}>
        <label className="mb-5 block max-w-sm text-xs font-medium text-muted-foreground">Portafoglio dello scenario<select aria-label="Portafoglio dello scenario" className={selectClass} value={filters.portfolio} onChange={(e) => update({ portfolio: e.target.value })}><option value="all">Tutti i portafogli disponibili</option>{Array.from(new Set(packet.counts.map((r) => r.portfolio))).sort().map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        {countRows.length ? <CountRows countRows={countRows} labels={C_AUDIENCE_COPY.countsLabels} /> : <Empty>Il portafoglio selezionato non ha un rapporto disponibile nel perimetro del pacchetto di revisione. Nessun denominatore viene inventato.</Empty>}
        {missingCounts > 0 && <p className="mt-4 text-xs text-muted-foreground">{`${missingCounts} portafogli senza rapporto disponibile restano nel registro di copertura; non sono trattati come zero.`}</p>}
        {countRows.length > 0 && <p className="mt-4 text-xs font-medium leading-5" data-c-scoped-note="counts">{C_AUDIENCE_COPY.countsNote}</p>}
      </Panel>
    </section>

    <section id="previsione" aria-labelledby="previsione-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="previsione" number="06" title="Che cosa indica la previsione regionale per il 2026?">{"Serie pubblica AIFA del flusso tracciabilità a livello regionale, con intervalli all’80 % e al 95 %. Non segue l’ambito aziendale né il canale selezionati."}</Heading>
      {forecast ? <PillarCForecastPanel forecast={forecast} series={filters.forecastSeries} onSeries={(forecastSeries) => update({ forecastSeries })} published /> : <Empty>{C_AUDIENCE_COPY.forecastUnavailable}</Empty>}
    </section>

    <section id="evidenza" aria-labelledby="evidenza-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="evidenza" number="07" title="Fonti e criteri di lettura">Origine delle misure, perimetro dei controlli e ipotesi di ciascuna analisi.</Heading><Panel title="Come leggere le analisi"><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{[["Spesa e variazioni", "Importi riportati, rettifiche conservate e confronto fra periodi omogenei. Il ponte descrive contributi contabili."], ["Budget per area", "Atti di budget pubblicati affiancati alla spesa ripartita con due chiavi. Le differenze sono neutrali rispetto alla performance."], ["Scenario CO", "Rapporto fra spesa e numerosità stimata, con sensibilità esplicita del denominatore e portafogli non sommabili."], ["Previsione regionale", "Dati pubblici AIFA a livello regionale, non aziendali. Intervalli all’80 % e al 95 %; totale annuo supplementare; la classe C non è ammessa."]].map(([title, text]) => <div key={title}><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</div></Panel></section>
  </div>;
}
