"use client";

import { useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/dashboard-review/analytics-ui";
import { LocalToggle } from "@/components/dashboard-review/pillar-b-local-toggle";
import { PillarCSectionNavigation } from "@/components/dashboard-review/pillar-c/section-navigation";
import { PillarCForecastPanel } from "@/components/dashboard-review/pillar-c/forecast-section";
import { PillarCInsightsPanel, PillarCInsightsSection, PillarCInsightsProvider } from "@/components/dashboard-review/pillar-c/insight-panels";
import { PillarCAttributionAnalysis } from "@/components/dashboard-review/pillar-c/attribution-analysis";
import { PillarCPortfolioDossier, PillarPurposeNavigation } from "@/components/dashboard-review/pillar-c/portfolio-dossier";
import { PillarCEvidenceWorkflow } from "@/components/dashboard-review/pillar-c/evidence-workflow";
import { PillarCPlanningWorkspace } from "@/components/dashboard-review/pillar-c/planning-workspace";
import { PillarCAudienceProvider, usePillarCAudience } from "@/components/dashboard-review/pillar-c/audience-context";
import { cBudgetFilters, cBudgetSearch, cDecisionAnswer, cInsightResetSearch } from "@/lib/dashboard-review/pillar-c/insights";
import type { CWorkbookIndex } from "@/lib/dashboard-review/pillar-c/workbook";
import type { CClientAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { itNumber } from "@/lib/format/it-number";
import { C_PERIOD_LABELS, C_PERIODS, C_REVIEW_SECTIONS, cMoneyLabel, cReviewFilters, cReviewSearch, selectCReview, type CReviewFilters, type CReviewPacket } from "@/lib/dashboard-review/pillar-c/review";
import { C_ORG_LABELS } from "@/lib/dashboard-review/pillar-c/reviewer-labels";
import { BridgeValues, BudgetRows, CountRows, CReviewEmpty as Empty, CReviewExactTable as ExactTable, CReviewHeading as Heading, CReviewPanel as Panel, C_REVIEW_UI, SpendChart, SpendKpis, SpendViewButtons, type CReviewSpendView as SpendView } from "@/components/dashboard-review/pillar-c/review-blocks";

const eur = cMoneyLabel;
const signed = (value: string | number) => `${Number(value) > 0 ? "+" : ""}${eur(value)}`;
const { selectClass, actionClass, monthNames } = C_REVIEW_UI;

function OutputLineage({ packet }: { packet: CReviewPacket }) {
  return <details className="mt-5 rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Fonti e significato delle analisi</summary><div className="mt-4 grid gap-5 md:grid-cols-2">{packet.lineage.map(row => <div key={row.section}><h4 className="text-sm font-semibold">{C_REVIEW_SECTIONS[row.section].label}</h4><p className="mt-2 text-xs leading-5 text-muted-foreground">{row.section === "budget" ? "Budget pubblicati o modellati, affiancati alla spesa allocata per area. Perimetri non coincidenti: nessun giudizio di sovra o sottospesa." : row.section === "counts" ? "Scenari CO con numerosità stimata. Non sono conteggi osservati di persone trattate." : row.section === "forecast" ? "Serie regionali storiche pubbliche AIFA e previsione con intervalli. Non è un budget aziendale." : "Importi e contributi contabili del rilascio autorizzato, con periodi omogenei e rettifiche conservate."}</p></div>)}</div></details>;
}

/** The reviewer workspace. The audience is mandatory and must be the reviewer's: the reviewer packet (all four
 * Aziende, workbook, lineage and receipts) is never rendered under another audience, and nothing renders without one. */
export function PillarCAnalyticalWorkspace({ audience, packet, workbook }: { audience: CClientAudience; packet: CReviewPacket; workbook?: CWorkbookIndex }) {
  if (audience?.kind !== "reviewer") return null;
  return <PillarCAudienceProvider audience={audience}><ReviewerGate packet={packet} workbook={workbook} /></PillarCAudienceProvider>;
}
function ReviewerGate({ packet, workbook }: { packet: CReviewPacket; workbook?: CWorkbookIndex }) {
  const audience = usePillarCAudience();
  return audience?.kind === "reviewer" ? <ReviewerWorkspace audience={audience} packet={packet} workbook={workbook} /> : null;
}
function ReviewerWorkspace({ audience, packet, workbook }: { audience: CClientAudience; packet: CReviewPacket; workbook?: CWorkbookIndex }) {
  const search = useSearchParams(), filters = cReviewFilters(search), data = selectCReview(packet, filters);
  const [copied, setCopied] = useState(false);
  const [spendView, setSpendView] = useState<SpendView>('area');
  const spendGradient = useId().replaceAll(':', '');
  const budgetFilters = cBudgetFilters(packet, new URLSearchParams(search));
  const budgetData = selectCReview(packet, budgetFilters);
  const updateBudget = (patch: Partial<CReviewFilters>) => {
    window.history.pushState(null, "", `${window.location.pathname}${cBudgetSearch(packet, window.location.search, patch)}${window.location.hash}`);
    setCopied(false);
  };
  const decision = cDecisionAnswer(packet, filters);
  // The planning workspace receives only which Azienda|period|channel has a published departmental act: never a budget row or amount.
  const publishedActs = useMemo(() => [...new Set(packet.budgets.filter(b => b.basis === "published" && b.level === "Dipartimento").map(b => `${b.org}|${b.period}|${b.channel}`))], [packet]);
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
  const countRows = data.counts.filter((r) => r.state === "CALCOLATO").sort((a, b) => Number(b.perPerson) - Number(a.perPerson) || a.portfolio.localeCompare(b.portfolio));
  const scope = `${C_ORG_LABELS[filters.org]} · ${filters.channel === "Tutti" ? "Tutti i canali" : filters.channel}`;
  return <PillarCInsightsProvider><div className={`space-y-8 pb-12 ${workbook ? "xl:[&_section[id]]:scroll-mt-56" : ""}`} data-pillar-c-review={packet.schema === "pillar-c-review-v2" ? "v2" : "v1"} data-release-state="review_only">
    <PageHeader eyebrow="Pillar C" title="Spesa, budget e aree cliniche" description="Esplora gli importi riconciliati e le ipotesi di pianificazione. Ogni sezione mantiene il proprio periodo, perimetro e significato." />
    <PillarCSectionNavigation extended={Boolean(workbook)} />
    <PillarPurposeNavigation />
    <PillarCPortfolioDossier workbook={workbook}/>
    <PillarCPlanningWorkspace publishedActs={publishedActs} evidenceAnchor={Boolean(workbook)}/>
    <section className="rounded-2xl border border-primary/20 bg-card p-5 md:p-6" aria-labelledby="c-decision-title"><p className="text-xs font-medium text-primary">La domanda di gestione</p><h2 id="c-decision-title" className="mt-1 text-xl font-semibold">Più persone trattate o prodotti più costosi?</h2><p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">La spesa osservata e i prodotti che la compongono sono misurabili. I dati disponibili non contano le persone trattate: non possiamo attribuire la variazione a un aumento dei pazienti. Quantità, mix e costo unitario sono scomponibili soltanto nei sottoinsiemi con unità confrontabili.</p><div className="mt-5 grid gap-4 md:grid-cols-3"><div className="rounded-xl bg-secondary/40 p-4"><p className="text-xs text-muted-foreground">Variazione contabile</p><p className="mt-2 text-xl font-semibold">{decision.change === null ? "Non disponibile" : signed(decision.change)}</p><p className="mt-2 text-xs text-muted-foreground">{`${decision.scope} · ${filters.comparison === "K1" ? "2024–2025" : "gen–mag 2025–2026"}`}</p></div><div className="rounded-xl bg-secondary/40 p-4"><p className="text-xs text-muted-foreground">Contributo dei prodotti presenti nei due periodi</p><p className="mt-2 text-xl font-semibold">{decision.continuing === null ? "Non disponibile" : signed(decision.continuing)}</p><p className="mt-2 text-xs text-muted-foreground">Contributo alla variazione, non un effetto causale o clinico.</p></div><div className="rounded-xl bg-secondary/40 p-4"><p className="text-xs text-muted-foreground">Persone trattate osservate</p><p className="mt-2 text-xl font-semibold">Non disponibili</p><p className="mt-2 text-xs text-muted-foreground">Gli scenari CO stimano il denominatore; non misurano più persone trattate.</p></div></div><div className="mt-5 flex flex-wrap gap-3 text-sm"><a className="font-medium text-primary underline underline-offset-4" href="#attribuzione">Spesa condivisa fra aree</a><a className="font-medium text-primary underline underline-offset-4" href="#costi">Quantità, mix e costo</a><a className="font-medium text-primary underline underline-offset-4" href="#numerosita">Scenari di numerosità</a></div></section>

    <section aria-label="Ambito di revisione" className="rounded-2xl border border-border bg-card p-5 md:p-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_auto]">
      <label className="text-xs font-medium text-muted-foreground">Ambito<select aria-label="Ambito aziendale" className={selectClass} value={filters.org} onChange={(e) => update({ org: e.target.value as CReviewFilters["org"] })}>{audience.orgs.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
      <label className="text-xs font-medium text-muted-foreground">Canale<select aria-label="Canale dell’analisi" className={selectClass} value={filters.channel} onChange={(e) => update({ channel: e.target.value as CReviewFilters["channel"] })}>{["Tutti", "CO", "DD", "DPC"].map((c) => <option key={c} value={c}>{c === "Tutti" ? "Tutti i canali" : c}</option>)}</select></label>
      <div className="flex flex-wrap items-end gap-2"><button className={actionClass} onClick={copy} type="button"><Copy size={14} aria-hidden="true" /><span key={copied ? "copied" : "copy"}>{copied ? "Link copiato" : "Copia vista"}</span></button><button className={actionClass} onClick={() => update({}, true)} type="button"><RotateCcw size={14} aria-hidden="true" />Azzera</button></div>
    </div><p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">{`${scope}. Periodi e misure sono accanto ai grafici; la numerosità resta una vista CO distinta e la previsione resta regionale, su dati pubblici.`}</p><p className="sr-only" role="status">{`${scope}. Selezione aggiornata.`}</p></section>

    <section id="spesa" aria-labelledby="spesa-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="spesa" number="01" title="Come cambia la spesa nel tempo?">Importi netti, rettifiche negative e mesi rappresentati nel registro fornito.</Heading>
      <div className="mb-5 flex flex-wrap gap-4"><label className="min-w-48 text-xs font-medium text-muted-foreground">Periodo della spesa<select aria-label="Periodo della spesa" className={selectClass} value={filters.period} onChange={(e) => update({ period: e.target.value as CReviewFilters["period"] })}>{C_PERIODS.map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label></div>
      {baseline ? <SpendKpis baseline={baseline} period={filters.period} scope={scope} monthly={monthly} /> : <Empty>Nessun dato nel pacchetto di revisione per questa selezione. Il valore non viene sostituito con zero.</Empty>}
      <Panel title={`Profilo della spesa · ${C_PERIOD_LABELS[filters.period]}`} description={`${scope}. ${axisUnit}.`} controls={<LocalToggle label="Vista" value={filters.trend} options={[{ value: "monthly", label: "Mensile" }, { value: "cumulative", label: "Cumulata" }]} onChange={(trend) => update({ trend })} ariaLabel="Vista della spesa" />}>
        <SpendViewButtons spendView={spendView} setSpendView={setSpendView} />
        <SpendChart monthly={monthly} spendView={spendView} spendGradient={spendGradient} divisor={divisor} trend={filters.trend} />
        <ExactTable caption="Spesa e righe per mese" headers={["Mese", filters.trend === "monthly" ? "Spesa netta" : "Spesa cumulata", "Righe rappresentate"]} rows={monthly.map((r) => [r.label, eur(r.exact), itNumber(r.rows)])} />
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Un mese assente interrompe la cumulata. Il 2026 è limitato a gennaio–maggio e non è confrontato con dodici mesi.</p>
      </Panel>
    </section>

    {workbook && <><PillarCInsightsPanel index={workbook} section="spesa" /><PillarCInsightsSection index={workbook} section="composizione" /><PillarCAttributionAnalysis /></>}
    <section id="cambiamento" aria-labelledby="cambiamento-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="cambiamento" number={workbook ? "04" : "02"} title="Quali componenti spiegano la variazione?">Un ponte contabile con periodi omogenei. I contributi non sono effetti clinici, di prezzo o di volume.</Heading>
      <Panel title={`${C_PERIOD_LABELS[data.leftPeriod as keyof typeof C_PERIOD_LABELS]} → ${C_PERIOD_LABELS[data.rightPeriod as keyof typeof C_PERIOD_LABELS]}`} description={scope} controls={<LocalToggle label="Confronto" value={filters.comparison} options={[{ value: "K1", label: "2024 → 2025" }, { value: "K2", label: "Gen–mag 2025 → 2026" }]} onChange={(comparison) => update({ comparison })} ariaLabel="Periodi del ponte" />}>
        {data.left && data.right && data.bridge.length ? <BridgeValues left={data.left} right={data.right} bridge={data.bridge} /> : <Empty>Il confronto non è disponibile nel pacchetto di revisione.</Empty>}
      </Panel>
    </section>

    {workbook && <><PillarCInsightsPanel index={workbook} section="cambiamento" /><PillarCInsightsSection index={workbook} section="costi" /><PillarCInsightsSection index={workbook} section="confronti" /><PillarCInsightsSection index={workbook} section="attivita" /></>}
    <section id="pianificazione" aria-labelledby="pianificazione-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="pianificazione" number={workbook ? "08" : "03"} title="Come si confrontano budget e spesa ripartita?">Due chiavi di allocazione affiancate. L’intervallo è una sensibilità alle ipotesi, non un intervallo di confidenza.</Heading>
      <Panel title={`Pianificazione per area · ${C_PERIOD_LABELS[budgetFilters.budgetPeriod]}`} description="Seleziona una singola Azienda e un canale. Dipartimenti e discipline non vengono sommati tra loro." controls={<LocalToggle label="Ordine" value={budgetFilters.budgetOrder} options={[{ value: "amount", label: "Importo" }, { value: "difference", label: "Differenza" }]} onChange={(budgetOrder) => updateBudget({ budgetOrder })} ariaLabel="Ordine delle aree" />}>
        <div className="mb-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium text-muted-foreground">Azienda del budget<select aria-label="Azienda del budget" className={selectClass} value={budgetFilters.org} onChange={e => updateBudget({ org: e.target.value as CReviewFilters["org"], area: "all" })}>{audience.budgetOrgs.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Canale del budget<select aria-label="Canale del budget" className={selectClass} value={budgetFilters.channel} onChange={e => updateBudget({ channel: e.target.value as CReviewFilters["channel"], area: "all" })}>{["CO", "DD", "DPC"].map(c => <option key={c} value={c}>{c}</option>)}</select></label></div><p className="mb-4 text-xs text-muted-foreground">{`Ambito del budget: ${C_ORG_LABELS[budgetFilters.org]} · ${budgetFilters.channel}. Questi controlli sono indipendenti dalle altre analisi.`}</p><div className="mb-5 flex flex-wrap gap-2"><button type="button" className={actionClass} onClick={() => updateBudget({ org: "TE", channel: "CO", budgetPeriod: "FY2024", budget: "published", level: "Dipartimento", area: "all" })}>Budget pubblicati · ASL 4 · CO 2024</button><button type="button" className={actionClass} onClick={() => updateBudget({ org: budgetFilters.org === "Regione" ? "AQ" : budgetFilters.org, channel: budgetFilters.channel === "Tutti" ? "CO" : budgetFilters.channel, budgetPeriod: "FY2025", budget: "synthetic", level: "Disciplina", area: "all" })}>{`Piano modellato 2025 · ${budgetFilters.org === "Regione" ? "ASL 1" : C_ORG_LABELS[budgetFilters.org]}`}</button></div>
        <div className="mb-6 grid gap-4 sm:grid-cols-3"><label className="text-xs font-medium text-muted-foreground">Periodo del budget<select aria-label="Periodo del budget" className={selectClass} value={budgetFilters.budgetPeriod} onChange={(e) => updateBudget({ budgetPeriod: e.target.value as CReviewFilters["budgetPeriod"], area: "all" })}>{(["FY2024", "FY2025", "JM2026"] as const).map((p) => <option key={p} value={p}>{C_PERIOD_LABELS[p]}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Fonte del budget<select aria-label="Fonte del budget" className={selectClass} value={budgetFilters.budget} onChange={(e) => updateBudget({ budget: e.target.value as CReviewFilters["budget"], area: "all" })}><option value="published">Budget pubblicato</option><option value="synthetic">Budget modellato</option></select></label><label className="text-xs font-medium text-muted-foreground">Livello organizzativo<select aria-label="Livello del budget" className={selectClass} value={budgetFilters.level} onChange={(e) => updateBudget({ level: e.target.value as CReviewFilters["level"], area: "all" })}><option value="Dipartimento">Dipartimento</option><option value="Disciplina">Disciplina</option></select></label></div>
        {budgetData.availableBudgets.length > 0 && <label className="mb-6 block max-w-sm text-xs font-medium text-muted-foreground">Area da esplorare<select aria-label="Area del budget" value={budgetFilters.area} className={selectClass} onChange={(e) => updateBudget({ area: e.target.value })}><option value="all">Tutte le aree dell’ambito</option>{budgetData.availableBudgets.map((r) => <option key={r.id} value={r.area}>{r.level} {r.area}</option>)}</select></label>}
        {budgets.length ? <BudgetRows budgets={budgets} /> : <Empty>Nessuna coppia disponibile per questo ambito nel pacchetto di revisione. Prova ASL 4, CO o DD, Anno 2024, budget pubblicato e livello Dipartimento; oppure una singola Azienda con budget modellato nel 2025 o gen–mag 2026.</Empty>}
        <p className="mt-5 text-xs leading-5 text-muted-foreground">Dati sintetici: ripartizione per area e, quando selezionato, budget modellato. La compatibilità del perimetro del budget pubblicato non è stabilita: le differenze non misurano sovra/sottospesa organizzativa.</p>
      </Panel>
    </section>

    {workbook && <PillarCInsightsPanel index={workbook} section="pianificazione" />}
    <section id="numerosita" aria-labelledby="numerosita-title" className="scroll-mt-6 xl:scroll-mt-36"><Heading id="numerosita" number={workbook ? "09" : "04"} title="Quanto dipende il rapporto dalla numerosità ipotizzata?">Scenario CO con tasso regionale di dimissione 2023 e residenti al 31 dicembre 2024. Non rappresenta pazienti distinti osservati.</Heading>
      <Panel title="Spesa per paziente nello scenario di numerosità stimata" description={`${C_ORG_LABELS[filters.org]} · solo CO. Confronto fra ipotesi di denominatore, non graduatoria di performance.`} controls={<LocalToggle label="Anno CO" value={filters.countPeriod} options={[{ value: "FY2024", label: "2024" }, { value: "FY2025", label: "2025" }]} onChange={(countPeriod) => update({ countPeriod })} ariaLabel="Anno dello scenario CO" />}>
        <label className="mb-5 block max-w-sm text-xs font-medium text-muted-foreground">Portafoglio dello scenario<select aria-label="Portafoglio dello scenario" className={selectClass} value={filters.portfolio} onChange={(e) => update({ portfolio: e.target.value })}><option value="all">Tutti i portafogli disponibili</option>{Array.from(new Set(packet.counts.map((r) => r.portfolio))).sort().map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        {countRows.length ? <CountRows countRows={countRows} /> : <Empty>Il portafoglio selezionato non ha un rapporto disponibile nel perimetro del pacchetto di revisione. Nessun denominatore viene inventato.</Empty>}
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
