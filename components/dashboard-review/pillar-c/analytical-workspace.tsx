"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard-review/analytics-ui";
import { LocalToggle } from "@/components/dashboard-review/pillar-b-local-toggle";
import { PillarCSectionBar } from "@/components/dashboard-review/pillar-c/section-navigation";
import { PillarCSectionEmpty, PillarCSectionFrame } from "@/components/dashboard-review/pillar-c/section-frame";
import { PillarCScopeBar } from "@/components/dashboard-review/pillar-c/scope-bar";
import { PillarCDecisionOverview, type PillarCDecisionOverviewProps } from "@/components/dashboard-review/pillar-c/decision-overview";
import { PillarCEvidenceSources, type PillarCEvidenceCriterion, type PillarCEvidenceSource } from "@/components/dashboard-review/pillar-c/evidence-sources";
import { PillarCForecastPanel } from "@/components/dashboard-review/pillar-c/forecast-section";
import { PillarCAttributionAnalysis } from "@/components/dashboard-review/pillar-c/attribution-analysis";
import { PillarCPortfolioDossier } from "@/components/dashboard-review/pillar-c/portfolio-dossier";
import { PillarCEvidenceWorkflow } from "@/components/dashboard-review/pillar-c/evidence-workflow";
import { PillarCPlanningWorkspace } from "@/components/dashboard-review/pillar-c/planning-workspace";
import { PillarCAttributionEvidence, PillarCFileFMonthly, PillarCRecipientsSection, PillarCUnitCosts, cExtensionRecipientsCard } from "@/components/dashboard-review/pillar-c/extension-sections";
import { PillarCFileFBasket, PillarCResidentDrivers } from "@/components/dashboard-review/pillar-c/extension-reviewer";
import { cDecisionPeopleLine, type CExtensionView } from "@/lib/dashboard-review/pillar-c/extension";
import { PillarCAudienceProvider, usePillarCAudience } from "@/components/dashboard-review/pillar-c/audience-context";
import { cBudgetFilters, cBudgetSearch, cDecisionAnswer, cInsightResetSearch } from "@/lib/dashboard-review/pillar-c/insights";
import type { CWorkbookIndex } from "@/lib/dashboard-review/pillar-c/workbook";
import type { CClientAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { C_AUDIENCE_COPY, cAudienceLabel, cAudienceScope } from "@/lib/dashboard-review/pillar-c/audience-view";
import { cForecastDecision } from "@/lib/dashboard-review/pillar-c/forecast-decision";
import { PILLAR_C_SECTIONS, type PillarCSection } from "@/lib/dashboard-review/pillar-c/section-navigation";
import { itNumber } from "@/lib/format/it-number";
import { C_FORECAST_LABEL, C_PERIOD_LABELS, C_PERIODS, C_REVIEW_SECTIONS, cMoneyLabel, cReviewFilters, cReviewSearch, selectCReview, type COrg, type CPeriod, type CReviewFilters, type CReviewPacket } from "@/lib/dashboard-review/pillar-c/review";
import { C_ORG_LABELS } from "@/lib/dashboard-review/pillar-c/reviewer-labels";
import { BridgeValues, BudgetRows, CountRows, CReviewEmpty as Empty, CReviewExactTable as ExactTable, CReviewHeading as Heading, CReviewPanel as Panel, C_REVIEW_UI, SpendChart, SpendCoverage, SpendKpis, cSpendCell } from "@/components/dashboard-review/pillar-c/review-blocks";

const eur = cMoneyLabel;
const signed = (value: string | number) => `${Number(value) > 0 ? "+" : ""}${eur(value)}`;
const { monthNames } = C_REVIEW_UI;
const { selectClass } = C_REVIEW_UI;
const SCOPE_CHANNELS = [{ value: "Tutti", label: "Tutti i canali" }, { value: "CO", label: "CO" }, { value: "DD", label: "DD" }, { value: "DPC", label: "DPC" }] as const;
const [QUADRO, DESTINATARI, PORTAFOGLI, FATTORI, BUDGET, PRIORITA] = PILLAR_C_SECTIONS;
const frameOf = (s: PillarCSection) => ({ id: s.id, number: s.number, title: s.label, question: s.question });
const OVERVIEW_LINKS = [PORTAFOGLI, FATTORI, BUDGET].map((s) => ({ href: `#${s.id}`, label: s.label }));
const crossLink = "inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary";
const EVIDENCE_CRITERIA: readonly PillarCEvidenceCriterion[] = [
  { title: "Spesa e variazioni", text: "Importi riportati, rettifiche conservate e confronto fra periodi omogenei. Il ponte descrive contributi contabili." },
  { title: "Budget per area", text: "Budget pubblicati o modellati affiancati alla spesa ripartita con due chiavi. Le differenze sono neutrali rispetto alla performance." },
  { title: "Scenario CO", text: "Rapporto fra spesa e numerosità stimata, con sensibilità esplicita del denominatore e portafogli non sommabili." },
  { title: "Previsione regionale", text: "Dati pubblici AIFA a livello regionale, non aziendali. Intervalli all’80\u00a0% e al 95\u00a0%; totale annuo supplementare; la classe C non è ammessa." },
];
/** «Fonti e versione»: each row is a sentence already on the page (R5). The forecast row is kept only when the packet
 * holds the forecast (see evidenceSources in the workspace). */
const EVIDENCE_SOURCES: readonly PillarCEvidenceSource[] = [
  { term: "Spesa", detail: "Importi netti, rettifiche negative e mesi rappresentati nel registro fornito." },
  { term: "Raggruppamenti terapeutici", detail: "Raggruppamenti terapeutici in bozza, con revisione di dominio distinta dai controlli numerici." },
  { term: "Scenario CO", detail: "Scenario CO con tasso regionale di dimissione 2023 e residenti al 31 dicembre 2024. Dati sintetici: numerosità stimata dai dimessi. Non rappresenta pazienti distinti osservati." },
  { term: "Previsione regionale", detail: C_FORECAST_LABEL },
];
/** The published departmental acts the packet holds, named through the reviewer labels: Azienda, period and channels,
 * never a budget row or an amount (design 2.3 analytical#budget-reviewer-extras). */
function publishedActsLine(acts: readonly string[]): string {
  const groups = new Map<string, string[]>();
  for (const act of [...acts].sort()) {
    const [org, period, channel] = act.split("|");
    const head = `${C_ORG_LABELS[org as COrg]} · ${C_PERIOD_LABELS[period as CPeriod]}`;
    groups.set(head, [...(groups.get(head) ?? []), channel]);
  }
  return groups.size ? `Atti di budget dipartimentali pubblicati nel pacchetto: ${[...groups].map(([head, channels]) => `${head} · ${channels.join(", ")}`).join("; ")}.` : "Nessun atto di budget dipartimentale pubblicato nel pacchetto di revisione.";
}
/** The one address the page scope bar writes (design §4.1): c_org and c_channel through cReviewSearch, c_port_org and
 * c_port_channel set to the same values (deleted at their defaults), c_attr_org and c_attr_channel deleted; every
 * other key is kept. */
export function cReviewerScopeSearch(search: string, patch: { org?: string; channel?: string }, defaultOrg: string): string {
  const current = cReviewFilters(new URLSearchParams(search));
  const org = (patch.org ?? current.org) as CReviewFilters["org"], channel = (patch.channel ?? current.channel) as CReviewFilters["channel"];
  const params = new URLSearchParams(cReviewSearch(search, { org, channel }));
  if (org === defaultOrg) params.delete("c_port_org"); else params.set("c_port_org", org);
  if (channel === "Tutti") params.delete("c_port_channel"); else params.set("c_port_channel", channel);
  params.delete("c_attr_org"); params.delete("c_attr_channel");
  return params.size ? `?${params}` : "";
}

function OutputLineage({ packet }: { packet: CReviewPacket }) {
  return <details className="mt-5 rounded-xl border border-border p-4"><summary className="cursor-pointer py-3 text-sm font-medium">Fonti e significato delle analisi</summary><div className="mt-4 grid gap-5 md:grid-cols-2">{packet.lineage.map(row => <div key={row.section}><h4 className="text-sm font-semibold">{C_REVIEW_SECTIONS[row.section].label}</h4><p className="mt-2 text-xs leading-5 text-muted-foreground">{row.section === "budget" ? "Budget pubblicati o modellati, affiancati alla spesa allocata per area. Perimetri non coincidenti: nessun giudizio di sovra o sottospesa." : row.section === "counts" ? "Scenari CO con numerosità stimata. Non sono conteggi osservati di persone trattate." : row.section === "forecast" ? "Serie regionali storiche pubbliche AIFA e previsione con intervalli. Non è un budget aziendale." : "Importi e contributi contabili del rilascio autorizzato, con periodi omogenei e rettifiche conservate."}</p></div>)}</div></details>;
}

/** The reviewer workspace. The audience is mandatory and must be the reviewer's: the reviewer packet (all four
 * Aziende, workbook, lineage and receipts) is never rendered under another audience, and nothing renders without one. */
export function PillarCAnalyticalWorkspace({ audience, packet, workbook, extension, extensionUnavailable = false }: { audience: CClientAudience; packet: CReviewPacket; workbook?: CWorkbookIndex; extension?: CExtensionView | null; extensionUnavailable?: boolean }) {
  if (audience?.kind !== "reviewer") return null;
  return <PillarCAudienceProvider audience={audience}><ReviewerGate packet={packet} workbook={workbook} extension={extension ?? null} extensionUnavailable={!extension && extensionUnavailable} /></PillarCAudienceProvider>;
}
function ReviewerGate({ packet, workbook, extension, extensionUnavailable }: { packet: CReviewPacket; workbook?: CWorkbookIndex; extension: CExtensionView | null; extensionUnavailable: boolean }) {
  const audience = usePillarCAudience();
  return audience?.kind === "reviewer" ? <ReviewerWorkspace audience={audience} packet={packet} workbook={workbook} extension={extension} extensionUnavailable={extensionUnavailable} /> : null;
}
/** The six sections of the page (docs/PILLAR_C_SIX_SECTIONS_20261022.md §1), each a frame with its numeral, heading and
 * question; the review blocks, the dossier, the attribution and the workbook insights sit inside the frames by topic. */
function ReviewerWorkspace({ audience, packet, workbook, extension, extensionUnavailable }: { audience: CClientAudience; packet: CReviewPacket; workbook?: CWorkbookIndex; extension: CExtensionView | null; extensionUnavailable: boolean }) {
  const search = useSearchParams(), filters = cReviewFilters(search), data = selectCReview(packet, filters);
  const budgetFilters = cBudgetFilters(packet, new URLSearchParams(search));
  const budgetData = selectCReview(packet, budgetFilters);
  const updateBudget = (patch: Partial<CReviewFilters>) => {
    window.history.pushState(null, "", `${window.location.pathname}${cBudgetSearch(packet, window.location.search, patch)}${window.location.hash}`);
  };
  const decision = cDecisionAnswer(packet, filters);
  // The planning workspace receives only which Azienda|period|channel has a published departmental act: never a budget row or amount.
  const publishedActs = useMemo(() => [...new Set(packet.budgets.filter(b => b.basis === "published" && b.level === "Dipartimento").map(b => `${b.org}|${b.period}|${b.channel}`))], [packet]);
  const update = (patch: Partial<CReviewFilters>, reset = false) => {
    window.history.pushState(null, "", `${window.location.pathname}${reset ? cInsightResetSearch(window.location.search) : cReviewSearch(window.location.search, patch)}${window.location.hash}`);
  };
  const baseline = data.baseline;
  const monthly = data.months.map((r) => ({ ...r, label: monthNames[r.month - 1] }));
  const max = Math.max(1, ...monthly.map((r) => Math.abs(r.amount ?? 0)));
  const divisor = max >= 1_000_000 ? 1_000_000 : max >= 1000 ? 1000 : 1;
  const axisUnit = divisor === 1_000_000 ? "Milioni di euro" : divisor === 1000 ? "Migliaia di euro" : "Euro";
  const budgets = budgetData.budgets;
  const missingCounts = data.counts.filter((r) => r.state !== "CALCOLATO").length;
  const countRows = data.counts.filter((r) => r.state === "CALCOLATO").sort((a, b) => Number(b.perPerson) - Number(a.perPerson) || a.portfolio.localeCompare(b.portfolio));
  const scope = `${C_ORG_LABELS[filters.org]} · ${filters.channel === "Tutti" ? "Tutti i canali" : filters.channel}`;
  const portScope = cAudienceScope(audience, new URLSearchParams(search), "c_port");
  const portScopeLine = [cAudienceLabel(audience, portScope.org) ?? "", portScope.channel === "Tutti" ? "Tutti i canali" : portScope.channel, C_PERIOD_LABELS[portScope.period], "raggruppamenti ATC in bozza"];
  const updateScope = (patch: { org?: string; channel?: string }) => window.history.pushState(null, "", `${window.location.pathname}${cReviewerScopeSearch(window.location.search, patch, audience.defaultOrg)}${window.location.hash}`);
  const orgOptions = audience.orgs.map((o) => ({ value: o.key, label: o.label }));
  const decisionCards: PillarCDecisionOverviewProps["cards"] = [
    { title: "Variazione contabile", value: decision.change === null ? "Non disponibile" : signed(decision.change), detail: `${decision.scope} · ${filters.comparison === "K1" ? "2024–2025" : "gen–mag 2025–2026"}` },
    { title: "Contributo dei prodotti presenti nei due periodi", value: decision.continuing === null ? "Non disponibile" : signed(decision.continuing), detail: "Contributo alla variazione, non un effetto causale o clinico." },
    cExtensionRecipientsCard(extension, extensionUnavailable),
  ];
  const comparison = `Confronto: ${filters.comparison === "K1" ? "2024 → 2025" : "Gen–mag 2025 → 2026"}`;
  const forecastDecision = (() => { if (!packet.forecast) return null; try { return cForecastDecision(packet.forecast, "TOT"); } catch { return null; } })();
  const regional = forecastDecision === null ? null : { annual: eur(forecastDecision.annual.total), band: `${eur(forecastDecision.annual.low80)} – ${eur(forecastDecision.annual.high80)}`, href: "#previsione" };
  const actsLine = useMemo(() => publishedActsLine(publishedActs), [publishedActs]);
  const evidenceSources = packet.forecast ? EVIDENCE_SOURCES : EVIDENCE_SOURCES.filter((s) => s.term !== "Previsione regionale");
  return <div className="space-y-8 pb-12 xl:[&_[id]]:scroll-mt-36" data-pillar-c-review={packet.schema === "pillar-c-review-v2" ? "v2" : "v1"} data-release-state="review_only">
    <PageHeader eyebrow="Pillar C" title="Spesa, budget e aree cliniche" description="Esplora gli importi riconciliati e le ipotesi di pianificazione. Ogni sezione mantiene il proprio periodo, perimetro e significato." scope="Aggregato delle quattro Aziende e ASL 1–4 · revisione di progetto" />
    <PillarCSectionBar />

    <PillarCSectionFrame {...frameOf(QUADRO)}>
      <PillarCScopeBar orgOptions={orgOptions} org={filters.org} channelOptions={SCOPE_CHANNELS} channel={filters.channel} onChange={updateScope} onReset={() => update({}, true)} tamperedText={C_AUDIENCE_COPY.tampered} scope={scope} />
      <div><p className="text-xs font-medium text-primary">La domanda di gestione</p><h3 id="c-decision-title" className="mt-1 text-lg font-semibold">Più persone trattate o prodotti più costosi?</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">{`La spesa osservata e i prodotti che la compongono sono misurabili. ${cDecisionPeopleLine(extension, extensionUnavailable)} Quantità, mix e costo unitario sono scomponibili soltanto nei sottoinsiemi con unità confrontabili.`}</p></div>
      <PillarCDecisionOverview cards={decisionCards} comparison={comparison} regional={regional} links={OVERVIEW_LINKS} />
    </PillarCSectionFrame>

    <PillarCSectionFrame {...frameOf(DESTINATARI)}>
      {extension ? <PillarCRecipientsSection view={extension} /> : extensionUnavailable ? <PillarCSectionEmpty>I dati su destinatari e utilizzo non sono disponibili in questo momento. Nessun valore viene mostrato né sostituito.</PillarCSectionEmpty> : <PillarCSectionEmpty>Le fonti attualmente disponibili in questa vista non contano le persone trattate e non misurano l’utilizzo. Nessun valore viene mostrato né sostituito.</PillarCSectionEmpty>}
      <a href="#numerosita" className={crossLink}>Scenario di numerosità stimata →</a>
    </PillarCSectionFrame>

    <PillarCSectionFrame {...frameOf(PORTAFOGLI)} scope={portScopeLine}>
      <PillarCPortfolioDossier workbook={workbook} />
      {workbook && <PillarCAttributionAnalysis />}
      {extension && <PillarCAttributionEvidence view={extension} />}
      {extensionUnavailable && <PillarCSectionEmpty>Le prove di attribuzione della DPC di gennaio 2026 non sono disponibili in questo momento. Nessun valore viene sostituito.</PillarCSectionEmpty>}
    </PillarCSectionFrame>

    <PillarCSectionFrame {...frameOf(FATTORI)}>
      <section id="spesa" aria-labelledby="spesa-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading inner id="spesa" title="Come cambia la spesa nel tempo?">Importi netti, rettifiche negative e mesi rappresentati nel registro fornito.</Heading>
        <div className="mb-5 flex flex-wrap gap-4"><label className="min-w-48 text-xs font-medium text-muted-foreground">Periodo della spesa<select aria-label="Periodo della spesa" className={selectClass} value={filters.period} onChange={(e) => update({ period: e.target.value as CReviewFilters["period"] })}>{C_PERIODS.map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label></div>
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
      {extension && <PillarCResidentDrivers view={extension} />}
      {extension && <PillarCFileFMonthly view={extension} />}
      {extensionUnavailable && <PillarCSectionEmpty>I dati aggiuntivi della DPC di gennaio 2026 e del File F non sono disponibili in questo momento. Nessun valore viene sostituito.</PillarCSectionEmpty>}
      {extension && <PillarCFileFBasket view={extension} />}
      {extension && <PillarCUnitCosts view={extension} />}
      <a href="#portafogli-attribuzione" className={crossLink}>Per il portafoglio selezionato → Portafogli e attribuzione</a>
    </PillarCSectionFrame>

    <PillarCSectionFrame {...frameOf(BUDGET)}>
      <section id="pianificazione" aria-labelledby="pianificazione-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading inner id="pianificazione" title="Come si confrontano budget e spesa ripartita?">Due chiavi di allocazione affiancate. L’intervallo è una sensibilità alle ipotesi, non un intervallo di confidenza.</Heading>
        <Panel title={`Pianificazione per area · ${C_PERIOD_LABELS[budgetFilters.budgetPeriod]}`} description="Seleziona una singola Azienda e un canale. Dipartimenti e discipline non vengono sommati tra loro." controls={<LocalToggle label="Ordine" value={budgetFilters.budgetOrder} options={[{ value: "amount", label: "Importo" }, { value: "difference", label: "Differenza" }]} onChange={(budgetOrder) => updateBudget({ budgetOrder })} ariaLabel="Ordine delle aree" />}>
          <div className="mb-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium text-muted-foreground">Azienda del budget<select aria-label="Azienda del budget" className={selectClass} value={budgetFilters.org} onChange={e => updateBudget({ org: e.target.value as CReviewFilters["org"], area: "all" })}>{audience.budgetOrgs.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Canale del budget<select aria-label="Canale del budget" className={selectClass} value={budgetFilters.channel} onChange={e => updateBudget({ channel: e.target.value as CReviewFilters["channel"], area: "all" })}>{["CO", "DD", "DPC"].map(c => <option key={c} value={c}>{c}</option>)}</select></label></div><p className="mb-4 text-xs text-muted-foreground">{`Ambito del budget: ${C_ORG_LABELS[budgetFilters.org]} · ${budgetFilters.channel}. Questi controlli sono indipendenti dalle altre analisi.`}</p><p className="mb-5 text-xs text-muted-foreground">{actsLine}</p>
          <div className="mb-6 grid gap-4 sm:grid-cols-3"><label className="text-xs font-medium text-muted-foreground">Periodo del budget<select aria-label="Periodo del budget" className={selectClass} value={budgetFilters.budgetPeriod} onChange={(e) => updateBudget({ budgetPeriod: e.target.value as CReviewFilters["budgetPeriod"], area: "all" })}>{(["FY2024", "FY2025", "JM2026"] as const).map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Fonte del budget<select aria-label="Fonte del budget" className={selectClass} value={budgetFilters.budget} onChange={(e) => updateBudget({ budget: e.target.value as CReviewFilters["budget"], area: "all" })}><option value="published">Budget pubblicato</option><option value="synthetic">Budget modellato</option></select></label><label className="text-xs font-medium text-muted-foreground">Livello organizzativo<select aria-label="Livello organizzativo del budget" className={selectClass} value={budgetFilters.level} onChange={(e) => updateBudget({ level: e.target.value as CReviewFilters["level"], area: "all" })}><option value="Dipartimento">Dipartimento</option><option value="Disciplina">Disciplina</option></select></label></div>
          {budgetData.availableBudgets.length > 0 && <label className="mb-6 block max-w-sm text-xs font-medium text-muted-foreground">Area da esplorare<select aria-label="Area da esplorare del budget" value={budgetFilters.area} className={selectClass} onChange={(e) => updateBudget({ area: e.target.value })}><option value="all">Tutte le aree dell’ambito</option>{budgetData.availableBudgets.map((r) => <option key={r.id} value={r.area}>{r.level} {r.area}</option>)}</select></label>}
          {budgets.length ? <BudgetRows budgets={budgets} /> : <Empty>Nessuna coppia disponibile per questo ambito nel pacchetto di revisione. Nessun valore viene sostituito con zero.</Empty>}
          <p className="mt-5 text-xs leading-5 text-muted-foreground">Dati sintetici: ripartizione per area e, quando selezionato, budget modellato. La compatibilità del perimetro del budget pubblicato non è stabilita: le differenze non misurano sovra/sottospesa organizzativa.</p>
        </Panel>
      </section>
      <PillarCPlanningWorkspace publishedActs={publishedActs} evidenceAnchor={Boolean(workbook)}/>
      <section id="numerosita" aria-labelledby="numerosita-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading inner id="numerosita" title="Quanto dipende il rapporto dalla numerosità ipotizzata?">Scenario CO con tasso regionale di dimissione 2023 e residenti al 31 dicembre 2024. Non rappresenta pazienti distinti osservati.</Heading>
        <Panel title={C_AUDIENCE_COPY.countsTitle} description={`${C_ORG_LABELS[filters.org]} · solo CO. Confronto fra ipotesi di denominatore, non graduatoria di performance.`} controls={<LocalToggle label="Anno CO" value={filters.countPeriod} options={[{ value: "FY2024", label: "2024" }, { value: "FY2025", label: "2025" }]} onChange={(countPeriod) => update({ countPeriod })} ariaLabel="Anno dello scenario CO" />}>
          <label className="mb-5 block max-w-sm text-xs font-medium text-muted-foreground">Portafoglio dello scenario<select aria-label="Portafoglio dello scenario" className={selectClass} value={filters.portfolio} onChange={(e) => update({ portfolio: e.target.value })}><option value="all">Tutti i portafogli disponibili</option>{Array.from(new Set(packet.counts.map((r) => r.portfolio))).sort().map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          {countRows.length ? <CountRows countRows={countRows} /> : <Empty>Il portafoglio selezionato non ha un rapporto disponibile nel perimetro del pacchetto di revisione. Nessun denominatore viene inventato.</Empty>}
          {missingCounts > 0 && <p className="mt-4 text-xs text-muted-foreground">{missingCounts === 1 ? "1 portafoglio senza rapporto disponibile resta nel registro di copertura; non è trattato come zero." : `${missingCounts} portafogli senza rapporto disponibile restano nel registro di copertura; non sono trattati come zero.`}</p>}
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Dati sintetici: numerosità stimata dai dimessi. L’intervallo varia la numerosità del 25% in meno e in più, senza probabilità né limite garantito. I raggruppamenti ATC restano in bozza, con revisione di dominio in attesa. Le popolazioni dei portafogli possono sovrapporsi e non si sommano. Il canale globale non modifica questa vista CO.</p>
        </Panel>
      </section>
      <section id="previsione" aria-labelledby="previsione-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading inner id="previsione" title="Che cosa indica la previsione regionale per il 2026?">{"Serie pubblica AIFA del flusso tracciabilità a livello regionale, con intervalli all’80\u00a0% e al 95\u00a0%. Non segue l’ambito aziendale né il canale selezionati."}</Heading>
        <PillarCForecastPanel forecast={packet.forecast} series={filters.forecastSeries} onSeries={(forecastSeries) => update({ forecastSeries })} published />
      </section>
    </PillarCSectionFrame>

    <PillarCSectionFrame {...frameOf(PRIORITA)}>
      <div className="flex flex-wrap gap-x-4 gap-y-1">{workbook ? <a href="#attribuzione" className={crossLink}>Quali prodotti approfondire per primi? →</a> : null}<a href="#piano-revisione" className={crossLink}>Piano di revisione del portafoglio →</a></div>
      {workbook && <PillarCEvidenceWorkflow />}
      <PillarCEvidenceSources criteria={EVIDENCE_CRITERIA} sources={evidenceSources}><OutputLineage packet={packet} /><details className="mt-6 rounded-xl border border-border p-4"><summary className="cursor-pointer py-3 text-sm font-medium">Versione e tracciabilità</summary><dl className="mt-4 space-y-3 text-xs"><div><dt className="font-semibold">Workbook</dt><dd className="mt-1 break-all">{packet.workbookVersion} · {packet.workbookSha256}</dd></div><div><dt className="font-semibold">Ricevute numeriche</dt><dd className="mt-1 break-all">Spesa: {packet.evidence.financial}<br />Budget e numerosità: {packet.evidence.budgetCount}{packet.evidence.financialR5Review && <><br />{`Spesa, controllo incrociato: ${packet.evidence.financialR5Review}`}</>}{packet.evidence.budgetCountR5Review && <><br />{`Budget e numerosità, controllo incrociato: ${packet.evidence.budgetCountR5Review}`}</>}{packet.evidence.forecast && <><br />{`Previsione: ${packet.evidence.forecast}`}</>}{packet.evidence.forecastInputs && <><br />{`Previsione, input: ${packet.evidence.forecastInputs}`}</>}{packet.evidence.forecastWorkbookIntegration && <><br />{`Previsione, integrazione nel workbook: ${packet.evidence.forecastWorkbookIntegration}`}</>}</dd></div><div><dt className="font-semibold">Ambito dei controlli</dt><dd className="mt-1">Controlli numerici dei campi indicati. L’accettazione indipendente e di dominio resta distinta dal controllo dell’interfaccia.</dd></div></dl></details></PillarCEvidenceSources>
    </PillarCSectionFrame>
  </div>;
}
