"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard-review/analytics-ui";
import { LocalToggle } from "@/components/dashboard-review/pillar-b-local-toggle";
import { PillarCAudienceProvider, usePillarCAudience } from "@/components/dashboard-review/pillar-c/audience-context";
import { PillarCSectionBar } from "@/components/dashboard-review/pillar-c/section-navigation";
import { PillarCSectionEmpty, PillarCSectionFrame } from "@/components/dashboard-review/pillar-c/section-frame";
import { PillarCScopeBar } from "@/components/dashboard-review/pillar-c/scope-bar";
import { PillarCDecisionOverview, type PillarCDecisionOverviewProps } from "@/components/dashboard-review/pillar-c/decision-overview";
import { PillarCEvidenceSources, type PillarCEvidenceCriterion, type PillarCEvidenceSource } from "@/components/dashboard-review/pillar-c/evidence-sources";
import { PillarCForecastPanel } from "@/components/dashboard-review/pillar-c/forecast-section";
import { PillarCAttributionAnalysis } from "@/components/dashboard-review/pillar-c/attribution-analysis";
import { PillarCPortfolioDossier } from "@/components/dashboard-review/pillar-c/portfolio-dossier";
import { PillarCPlanningWorkspace } from "@/components/dashboard-review/pillar-c/planning-workspace";
// The shared blocks come from review-blocks.tsx, never from the reviewer workspace: nothing this component reaches
// carries a province key (review finding UI-4; tests/pillar-c-scoped-client-graph.test.mjs).
import { BridgeValues, BudgetRows, CountRows, CReviewEmpty as Empty, CReviewHeading as Heading, CReviewExactTable as ExactTable, CReviewPanel as Panel, C_REVIEW_UI, SpendChart, SpendCoverage, SpendKpis, cSpendCell } from "@/components/dashboard-review/pillar-c/review-blocks";
import type { CClientAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { C_AUDIENCE_COPY, cAudienceLabel, cAudienceScope, cClientAudience, cScopedBudgetFilters, cScopedBudgetSearch, cScopedDecision, cScopedHasActs, cScopedPublishedActs, cScopedReviewFilters, cScopedReviewSearch } from "@/lib/dashboard-review/pillar-c/audience-view";
import { cForecastDecision } from "@/lib/dashboard-review/pillar-c/forecast-decision";
import { cInsightResetSearch } from "@/lib/dashboard-review/pillar-c/reset-search";
import { PILLAR_C_SECTIONS, type PillarCSection } from "@/lib/dashboard-review/pillar-c/section-navigation";
import { C_FORECAST_LABEL, C_PERIOD_LABELS, C_PERIODS, cMoneyLabel, selectCReview, type CForecast } from "@/lib/dashboard-review/pillar-c/review";
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

const { monthNames } = C_REVIEW_UI;
const { selectClass } = C_REVIEW_UI;
const eur = cMoneyLabel;
const signed = (value: string | number) => `${Number(value) > 0 ? "+" : ""}${eur(value)}`;
const staticField = "mt-2 flex min-h-11 items-center rounded-lg border border-dashed border-border px-3 text-sm text-foreground";
const SCOPE_CHANNELS = [{ value: "Tutti", label: "Tutti i canali" }, { value: "CO", label: "CO" }, { value: "DD", label: "DD" }, { value: "DPC", label: "DPC" }] as const;
const [QUADRO, DESTINATARI, PORTAFOGLI, FATTORI, BUDGET, PRIORITA] = PILLAR_C_SECTIONS;
const frameOf = (s: PillarCSection) => ({ id: s.id, number: s.number, title: s.label, question: s.question });
const OVERVIEW_LINKS = [PORTAFOGLI, FATTORI, BUDGET].map((s) => ({ href: `#${s.id}`, label: s.label }));
const crossLink = "inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary";
// «Come leggere le analisi»: the four reading cards of this page, published acts only (owner decision O4).
const EVIDENCE_CRITERIA: readonly PillarCEvidenceCriterion[] = [
  { title: "Spesa e variazioni", text: "Importi riportati, rettifiche conservate e confronto fra periodi omogenei. Il ponte descrive contributi contabili." },
  { title: "Budget per area", text: "Atti di budget pubblicati affiancati alla spesa ripartita con due chiavi. Le differenze sono neutrali rispetto alla performance." },
  { title: "Scenario CO", text: "Rapporto fra spesa e numerosità stimata, con sensibilità esplicita del denominatore e portafogli non sommabili." },
  { title: "Previsione regionale", text: "Dati pubblici AIFA a livello regionale, non aziendali. Intervalli all’80\u00a0% e al 95\u00a0%; totale annuo supplementare; la classe C non è ammessa." },
];
/** «Fonti e versione»: each row repeats what this page already states (R5). The CO row repeats the lead of the count
 * scenario verbatim and adds nothing about the estimate, which this page states only in the note beside the count rows
 * and never under the count empty state (UI-2). The forecast row is kept only when the public forecast is available
 * (see evidenceSources in the workspace). */
const EVIDENCE_SOURCES: readonly PillarCEvidenceSource[] = [
  { term: "Spesa", detail: "Importi netti, rettifiche negative e mesi rappresentati nel registro fornito." },
  { term: "Raggruppamenti terapeutici", detail: "Raggruppamenti terapeutici in bozza, con revisione di dominio distinta dai controlli numerici." },
  { term: "Scenario CO", detail: "Scenario CO con tasso regionale di dimissione 2023 e residenti al 31 dicembre 2024. Non rappresenta pazienti distinti osservati." },
  { term: "Previsione regionale", detail: C_FORECAST_LABEL },
];

/** The packet must hold exactly the audience's units, in the audience's order: anything else is not this audience's. */
function coherent(audience: CClientAudience, packet: CScopedClientReview | null | undefined) {
  return !!packet && packet.schema === "pillar-c-review-client-v1" && packet.monthlyMode === "explicit" && Array.isArray(packet.orgs)
    && packet.orgs.length === audience.orgs.length && packet.orgs.every((unit, i) => unit === audience.orgs[i].key);
}

/** The one address the page scope bar writes for an organisation-scoped reader (design §4.1): c_org and c_channel
 * through cScopedReviewSearch, c_port_org and c_port_channel set to the same values (deleted at the audience's default
 * organisation and at «Tutti»), c_attr_org and c_attr_channel deleted; every other key is kept. Only the audience's own
 * organisation keys and the four channel values are ever written: any other patch value keeps the current one. */
export function cScopedPageScopeSearch(audience: CClientAudience, search: string, patch: { org?: string; channel?: string }): string {
  const current = cScopedReviewFilters(audience, new URLSearchParams(search)).filters;
  const org = audience.orgs.some((o) => o.key === patch.org) ? patch.org as CScopedReviewFilters["org"] : current.org;
  const channel = SCOPE_CHANNELS.some((c) => c.value === patch.channel) ? patch.channel as CScopedReviewFilters["channel"] : current.channel;
  const params = new URLSearchParams(cScopedReviewSearch(audience, search, { org, channel }));
  if (org === audience.defaultOrg) params.delete("c_port_org"); else params.set("c_port_org", org);
  if (channel === "Tutti") params.delete("c_port_channel"); else params.set("c_port_channel", channel);
  params.delete("c_attr_org"); params.delete("c_attr_channel");
  return params.size ? `?${params}` : "";
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
  const budget = cScopedBudgetFilters(audience, packet, new URLSearchParams(search)), budgetFilters = budget.filters;
  const budgetData = selectCReview(packet, budgetFilters), budgets = budgetData.budgets;
  const budgetLabel = label(budgetFilters.org), hasActs = cScopedHasActs(packet, budgetFilters.org);
  // The planning workspace receives only which Azienda|period|channel has a published departmental act: never a budget row or amount.
  const publishedActs = useMemo(() => cScopedPublishedActs(packet), [packet]);
  const update = (patch: Partial<CScopedReviewFilters>, reset = false) => {
    window.history.pushState(null, "", `${window.location.pathname}${reset ? cInsightResetSearch(window.location.search) : cScopedReviewSearch(audience, window.location.search, patch)}${window.location.hash}`);
  };
  const updateBudget = (patch: Partial<CScopedReviewFilters>) => {
    window.history.pushState(null, "", `${window.location.pathname}${cScopedBudgetSearch(audience, packet, window.location.search, patch)}${window.location.hash}`);
  };
  const updateScope = (patch: { org?: string; channel?: string }) => window.history.pushState(null, "", `${window.location.pathname}${cScopedPageScopeSearch(audience, window.location.search, patch)}${window.location.hash}`);
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
  const portScope = cAudienceScope(audience, new URLSearchParams(search), "c_port");
  const portScopeLine = [label(portScope.org), portScope.channel === "Tutti" ? "Tutti i canali" : portScope.channel, C_PERIOD_LABELS[portScope.period], "raggruppamenti ATC in bozza"];
  const orgOptions = audience.orgs.map((o) => ({ value: o.key, label: o.label }));
  const decisionCards: PillarCDecisionOverviewProps["cards"] = [
    { title: "Variazione contabile", value: decision.change === null ? "Non disponibile" : signed(decision.change), detail: `${decision.scope} · ${filters.comparison === "K1" ? "2024–2025" : "gen–mag 2025–2026"}` },
    { title: "Contributo dei prodotti presenti nei due periodi", value: decision.continuing === null ? "Non disponibile" : signed(decision.continuing), detail: "Contributo alla variazione, non un effetto causale o clinico." },
    { title: "Persone trattate osservate", value: "Non disponibili", detail: "Gli scenari CO stimano il denominatore; non misurano più persone trattate." },
  ];
  const comparison = `Confronto: ${filters.comparison === "K1" ? "2024 → 2025" : "Gen–mag 2025 → 2026"}`;
  const forecastDecision = (() => { if (!forecast) return null; try { return cForecastDecision(forecast, "TOT"); } catch { return null; } })();
  const regional = forecastDecision === null ? null : { annual: eur(forecastDecision.annual.total), band: `${eur(forecastDecision.annual.low80)} – ${eur(forecastDecision.annual.high80)}`, href: "#previsione" };
  const evidenceSources = forecast ? EVIDENCE_SOURCES : EVIDENCE_SOURCES.filter((s) => s.term !== "Previsione regionale");
  return <div className="space-y-8 pb-12 xl:[&_[id]]:scroll-mt-36" data-pillar-c-review={`scoped-${audience.kind}`} data-release-state="review_only">
    <PageHeader eyebrow="Pillar C" title="Spesa, budget e aree cliniche" description="Esplora gli importi riconciliati e le ipotesi di pianificazione. Ogni sezione mantiene il proprio periodo, perimetro e significato." scope={audience.scopeLine ?? undefined} />
    <PillarCSectionBar />

    <PillarCSectionFrame {...frameOf(QUADRO)}>
      <PillarCScopeBar orgOptions={orgOptions} org={filters.org} channelOptions={SCOPE_CHANNELS} channel={filters.channel} onChange={updateScope} onReset={() => update({}, true)} tampered={tampered} tamperedText={C_AUDIENCE_COPY.tampered} scope={scope} />
      <div><p className="text-xs font-medium text-primary">La domanda di gestione</p><h3 id="c-decision-title" className="mt-1 text-lg font-semibold">Più persone trattate o prodotti più costosi?</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">La spesa osservata e i prodotti che la compongono sono misurabili. I dati disponibili non contano le persone trattate: non possiamo attribuire la variazione a un aumento dei pazienti.</p></div>
      <PillarCDecisionOverview cards={decisionCards} comparison={comparison} regional={regional} links={OVERVIEW_LINKS} />
    </PillarCSectionFrame>

    <PillarCSectionFrame {...frameOf(DESTINATARI)}>
      <PillarCSectionEmpty>Le fonti attualmente disponibili in questa vista non contano le persone trattate e non misurano l’utilizzo. Nessun valore viene mostrato né sostituito.</PillarCSectionEmpty>
      <a href="#numerosita" className={crossLink}>Scenario di numerosità stimata →</a>
    </PillarCSectionFrame>

    <PillarCSectionFrame {...frameOf(PORTAFOGLI)} scope={portScopeLine}>
      <PillarCPortfolioDossier />
      <PillarCAttributionAnalysis />
    </PillarCSectionFrame>

    <PillarCSectionFrame {...frameOf(FATTORI)}>
      <section id="spesa" aria-labelledby="spesa-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading inner id="spesa" title="Come cambia la spesa nel tempo?">Importi netti, rettifiche negative e mesi rappresentati nel registro fornito.</Heading>
        <div className="mb-5 flex flex-wrap gap-4"><label className="min-w-48 text-xs font-medium text-muted-foreground">Periodo della spesa<select aria-label="Periodo della spesa" className={selectClass} value={filters.period} onChange={(e) => update({ period: e.target.value as CScopedReviewFilters["period"] })}>{C_PERIODS.map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label></div>
        {baseline ? <SpendKpis baseline={baseline} period={filters.period} scope={scope} /> : <Empty>Nessun dato nel pacchetto di revisione per questa selezione. Il valore non viene sostituito con zero.</Empty>}
        <Panel title={`Profilo della spesa · ${C_PERIOD_LABELS[filters.period]}`} description={`${scope}. ${axisUnit}.`} controls={<LocalToggle label="Vista" value={filters.trend} options={[{ value: "monthly", label: "Mensile" }, { value: "cumulative", label: "Cumulata" }]} onChange={(trend) => update({ trend })} ariaLabel="Vista della spesa" />}>
          <SpendChart monthly={monthly} divisor={divisor} trend={filters.trend} />
          <SpendCoverage monthly={monthly} />
          <ExactTable caption="Spesa e righe per mese" headers={["Mese", filters.trend === "monthly" ? "Spesa netta" : "Spesa cumulata", "Righe rappresentate"]} rows={monthly.map((r) => [r.label, cSpendCell(r), itNumber(r.rows)])} />
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Un mese assente interrompe la cumulata. Il 2026 è limitato a gennaio–maggio e non è confrontato con dodici mesi.</p>
        </Panel>
      </section>
      <section id="cambiamento" aria-labelledby="cambiamento-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading inner id="cambiamento" title="Quali componenti spiegano la variazione?">Un ponte contabile con periodi omogenei. I contributi non sono effetti clinici, di prezzo o di volume.</Heading>
        <Panel title={`${C_PERIOD_LABELS[data.leftPeriod as keyof typeof C_PERIOD_LABELS]} → ${C_PERIOD_LABELS[data.rightPeriod as keyof typeof C_PERIOD_LABELS]}`} description={scope} controls={<LocalToggle label="Confronto" value={filters.comparison} options={[{ value: "K1", label: "2024 → 2025" }, { value: "K2", label: "Gen–mag 2025 → 2026" }]} onChange={(comparison) => update({ comparison })} ariaLabel="Periodi del ponte" />}>
          {data.left && data.right && data.bridge.length ? <BridgeValues left={data.left} right={data.right} bridge={data.bridge} /> : <Empty>Il confronto non è disponibile nel pacchetto di revisione.</Empty>}
        </Panel>
      </section>
      <a href="#portafogli-attribuzione" className={crossLink}>Per il portafoglio selezionato → Portafogli e attribuzione</a>
    </PillarCSectionFrame>

    <PillarCSectionFrame {...frameOf(BUDGET)}>
      <section id="pianificazione" aria-labelledby="pianificazione-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading inner id="pianificazione" title="Come si confrontano budget e spesa ripartita?">Due chiavi di allocazione affiancate per gli atti di budget pubblicati. L’intervallo è una sensibilità alle ipotesi, non un intervallo di confidenza.</Heading>
        <Panel title={`Pianificazione per area · ${C_PERIOD_LABELS[budgetFilters.budgetPeriod]}`} description={C_AUDIENCE_COPY.budgetSingle} controls={<LocalToggle label="Ordine" value={budgetFilters.budgetOrder} options={[{ value: "amount", label: "Importo" }, { value: "difference", label: "Differenza" }]} onChange={(budgetOrder) => updateBudget({ budgetOrder })} ariaLabel="Ordine delle aree" />}>
          <div className="mb-5 grid gap-4 sm:grid-cols-2">{audience.budgetOrgs.length > 1
            ? <label className="text-xs font-medium text-muted-foreground">Azienda del budget<select aria-label="Azienda del budget" className={selectClass} value={budgetFilters.org} onChange={(e) => updateBudget({ org: e.target.value as CScopedReviewFilters["org"], area: "all" })}>{audience.budgetOrgs.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
            : <div className="text-xs font-medium text-muted-foreground"><span>Azienda del budget</span><p className={staticField}>{`Azienda: ${budgetLabel}`}</p></div>}
            <label className="text-xs font-medium text-muted-foreground">Canale del budget<select aria-label="Canale del budget" className={selectClass} value={budgetFilters.channel} onChange={(e) => updateBudget({ channel: e.target.value as CScopedReviewFilters["channel"], area: "all" })}>{["CO", "DD", "DPC"].map((c) => <option key={c} value={c}>{c}</option>)}</select></label></div>
          <p className="mb-4 text-xs text-muted-foreground">{`Ambito del budget: ${budgetLabel} · ${budgetFilters.channel}. Questi controlli sono indipendenti dalle altre analisi.`}</p>
          {budget.tampered ? <p role="note" className="mb-4 text-xs font-medium">{C_AUDIENCE_COPY.tampered}</p> : null}
          <div className="mb-6 grid gap-4 sm:grid-cols-3"><label className="text-xs font-medium text-muted-foreground">Periodo del budget<select aria-label="Periodo del budget" className={selectClass} value={budgetFilters.budgetPeriod} onChange={(e) => updateBudget({ budgetPeriod: e.target.value as CScopedReviewFilters["budgetPeriod"], area: "all" })}>{(["FY2024", "FY2025", "JM2026"] as const).map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label><div className="text-xs font-medium text-muted-foreground"><span>Fonte del budget</span><p className={staticField}>{C_AUDIENCE_COPY.budgetSource}</p></div><label className="text-xs font-medium text-muted-foreground">Livello organizzativo<select aria-label="Livello organizzativo del budget" className={selectClass} value={budgetFilters.level} onChange={(e) => updateBudget({ level: e.target.value as CScopedReviewFilters["level"], area: "all" })}><option value="Dipartimento">Dipartimento</option><option value="Disciplina">Disciplina</option></select></label></div>
          {budgetData.availableBudgets.length > 0 && <label className="mb-6 block max-w-sm text-xs font-medium text-muted-foreground">Area da esplorare<select aria-label="Area da esplorare del budget" value={budgetFilters.area} className={selectClass} onChange={(e) => updateBudget({ area: e.target.value })}><option value="all">Tutte le aree dell’ambito</option>{budgetData.availableBudgets.map((r) => <option key={r.id} value={r.area}>{`${r.level} ${r.area}`}</option>)}</select></label>}
          {budgets.length ? <BudgetRows budgets={budgets} /> : <Empty>{hasActs ? C_AUDIENCE_COPY.budgetEmpty : C_AUDIENCE_COPY.budgetNone}</Empty>}
          {/* The O4 note describes rows: an empty state gets none (review finding UI-2). */}
          {budgets.length > 0 && <p className="mt-5 text-xs font-medium leading-5" data-c-scoped-note="budget">{C_AUDIENCE_COPY.budgetNote}</p>}
        </Panel>
      </section>
      <PillarCPlanningWorkspace publishedActs={publishedActs} />
      <section id="numerosita" aria-labelledby="numerosita-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading inner id="numerosita" title="Quanto dipende il rapporto dalla numerosità ipotizzata?">Scenario CO con tasso regionale di dimissione 2023 e residenti al 31 dicembre 2024. Non rappresenta pazienti distinti osservati.</Heading>
        <Panel title={C_AUDIENCE_COPY.countsTitle} description={`${orgLabel} · solo CO. Confronto fra ipotesi di denominatore, non graduatoria di performance.`} controls={<LocalToggle label="Anno CO" value={filters.countPeriod} options={[{ value: "FY2024", label: "2024" }, { value: "FY2025", label: "2025" }]} onChange={(countPeriod) => update({ countPeriod })} ariaLabel="Anno dello scenario CO" />}>
          <label className="mb-5 block max-w-sm text-xs font-medium text-muted-foreground">Portafoglio dello scenario<select aria-label="Portafoglio dello scenario" className={selectClass} value={filters.portfolio} onChange={(e) => update({ portfolio: e.target.value })}><option value="all">Tutti i portafogli disponibili</option>{Array.from(new Set(packet.counts.map((r) => r.portfolio))).sort().map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          {countRows.length ? <CountRows countRows={countRows} labels={C_AUDIENCE_COPY.countsLabels} /> : <Empty>Il portafoglio selezionato non ha un rapporto disponibile nel perimetro del pacchetto di revisione. Nessun denominatore viene inventato.</Empty>}
          {missingCounts > 0 && <p className="mt-4 text-xs text-muted-foreground">{missingCounts === 1 ? "1 portafoglio senza rapporto disponibile resta nel registro di copertura; non è trattato come zero." : `${missingCounts} portafogli senza rapporto disponibile restano nel registro di copertura; non sono trattati come zero.`}</p>}
          {countRows.length > 0 && <p className="mt-4 text-xs font-medium leading-5" data-c-scoped-note="counts">{C_AUDIENCE_COPY.countsNote}</p>}
        </Panel>
      </section>
      <section id="previsione" aria-labelledby="previsione-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading inner id="previsione" title="Che cosa indica la previsione regionale per il 2026?">{"Serie pubblica AIFA del flusso tracciabilità a livello regionale, con intervalli all’80\u00a0% e al 95\u00a0%. Non segue l’ambito aziendale né il canale selezionati."}</Heading>
        {forecast ? <PillarCForecastPanel forecast={forecast} series={filters.forecastSeries} onSeries={(forecastSeries) => update({ forecastSeries })} published /> : <Empty>{C_AUDIENCE_COPY.forecastUnavailable}</Empty>}
      </section>
    </PillarCSectionFrame>

    <PillarCSectionFrame {...frameOf(PRIORITA)}>
      <div className="flex flex-wrap gap-x-4 gap-y-1"><a href="#attribuzione" className={crossLink}>Quali prodotti approfondire per primi? →</a><a href="#piano-revisione" className={crossLink}>Piano di revisione del portafoglio →</a></div>
      <PillarCEvidenceSources criteria={EVIDENCE_CRITERIA} sources={evidenceSources} />
    </PillarCSectionFrame>
  </div>;
}
