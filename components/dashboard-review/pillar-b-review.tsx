// Pillar B review page — composition only.
//
// The layout follows Pillar A: editorial introduction, a compact filter card,
// four comparable headline measures, then self-contained analytical panels.
// A server component; the panels with a local control (pillar-b-panels.tsx)
// are a client island and receive only the rows they draw. Charts encode the
// same verified values as the audit tables and never introduce a second
// calculation path. Italian number formatting goes through the shared helpers
// for the reason pinned in tests/it-number.test.mjs.
//
//   Headline   spend, change, molecules and rows on one selected scope
//   Adoption   value uptake on two denominators; volume where a unit exists
//   Spending   year-on-year movement and concentration in separate panels
//   Evidence   the funnel and the perimeter: what the measures rest on
//   Method     the frozen workbook's own refusals, then provenance
//
// WHAT THIS PAGE MAY NOT SHOW, by instruction and because the data does not
// support it:
//   - a package or quantity total of any kind
//   - an uptake figure presented as full-population coverage
//   - a saving, an opportunity, or any recoverable-money figure
//   - 2026 as a year — it appears only as five labelled calendar cells

import { AlertTriangle, Info } from "lucide-react";
import {
  ChannelSlopeChart, EvidenceFunnelChart, UptakeCoverageChart,
} from "@/components/dashboard-review/pillar-b-review-visuals";
import { ChannelStack, PerimeterBars } from "@/components/dashboard-review/pillar-b-adoption-visuals";
import {
  AziendaPanel, CalendarPanel, ConcentrationPanel, TrendPanel, TrendTable, VolumePanel,
  type ConcentrationVariants, type TrendVariants,
} from "@/components/dashboard-review/pillar-b-panels";
import type { ConcentrationYear, PerimeterMode, ViewOptions } from "@/lib/dashboard-review/pillar-b/view-options";
import { WORKBOOK_STATUS_LABELS, workbookByStatus, workbookTally } from "@/lib/dashboard-review/pillar-b/workbook-map";
import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { CoverageNotice, FunnelRow, TrendRow } from "@/lib/dashboard-review/pillar-b/review-data";
import type { UptakeWithWithheld } from "@/lib/dashboard-review/pillar-b/rpc";
import type { AziendaPanelRow, CalendarRow, ChannelMixRow, FacetTotals, PerimeterRow } from "@/lib/dashboard-review/pillar-b/facets";
import type { VolumePanelRow } from "@/lib/dashboard-review/pillar-b/adoption";
import type { BridgeB, BridgeBPerimeterCheck } from "@/lib/dashboard-review/pillar-b/bridge-b";
import { BridgeBChart } from "@/components/dashboard-review/pillar-b-bridge-b";
import type { ValueUptakeView } from "@/lib/dashboard-review/pillar-b/value-uptake";

export interface PillarBReviewProps {
  releaseId: string;
  scope: {
    perimeterLabel: string;
    reviewerScopeUnavailable: boolean;
    allOrganizations: boolean;
    /** asl_code -> label the viewer may see. */
    aslLabels: Record<string, string>;
  };
  filterBar: React.ReactNode;
  /** Sentences explaining anything the current deployment could not apply. */
  degraded: string[];
  years: ReadonlyArray<number>;
  /**
   * The selected years with the months ACTUALLY OBSERVED under the active
   * filters (from the calendar facet), e.g. "2024 e 2025 · 12 e 12 mesi
   * osservati". The page computes it; a constant "12 mesi" here was false
   * under a molecule or channel filter that leaves months without a record.
   */
  periodLabel: string;
  /** Same, for the fixed 2024 → 2025 comparison the Spesa section always makes. */
  comparisonLabel: string;
  panorama: {
    totals: FacetTotals | null;
    valueUptake: ValueUptakeView;
    /** Set when the value-uptake figures cover a scope WIDER than the page's. */
    valueUptakeScope: string | null;
    calendar: CalendarRow[] | null;
    azienda: AziendaPanelRow[] | null;
    /** Aziende in scope with no record under the filters, named so absence is not read as non-existence. */
    aziendaAbsent: string[];
    channels: ChannelMixRow[] | null;
  };
  adoption: {
    valueUptakeSection: React.ReactNode;
    uptake: UptakeWithWithheld;
    /** Distinct (Azienda, substance, route, unit) groups — not per-year rows. */
    groupCount: number;
    withheldGroupCount: number;
    volume: VolumePanelRow[];
    /** Routes present in `volume`, for the local route control. */
    routes: string[];
    /** Which filters the volume measure could not honour, one sentence each. */
    notes: string[];
    /** Bridge B (sheet 09) for the selection, with its perimeter cross-check; null when withheld. */
    bridge: { model: BridgeB; check: BridgeBPerimeterCheck | null; scopeLabel: string; monthsLabel: string } | null;
    /** Why the bridge is withheld, when it is; null when it is shown or when the set is empty. */
    bridgeWithheld: string | null;
  };
  /** The panel-local options as read from the URL on this request. */
  viewOptions: ViewOptions;
  spend: {
    channelTrend: TrendRow[];
    /** Every (perimeter, order) variant of the molecule trend, pre-sorted and sliced. */
    trendVariants: TrendVariants;
    trendTotals: Record<PerimeterMode, number>;
    concentrationVariants: ConcentrationVariants;
    concentrationYear: ConcentrationYear;
    totals: { spend2024: number; spend2025: number; rows2024: number; rows2025: number };
  };
  evidence: {
    funnel: FunnelRow[];
    funnelYear: number;
    /** True when a filter is active that the funnel cannot honour. */
    funnelIgnoresFilters: boolean;
    perimeter: PerimeterRow[] | null;
    /** True when the perimeter chart is deliberately withheld (molecule filter). */
    perimeterWithheld: boolean;
  };
  notices: CoverageNotice[];
}

const MONTHS_OBSERVED_NOTE =
  "«12 mesi osservati» significa che in ciascun mese esiste almeno un record. " +
  "Non certifica che tutti i conferimenti attesi per ASL e canale siano arrivati: " +
  "quella verifica richiede un elenco esterno dei soggetti attesi, che non è disponibile.";

function Group({
  id, title, lead, children,
}: { id: string; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-8 flex-col gap-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold leading-tight text-foreground">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{lead}</p>
        </div>
        <a href="#filtri" className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          Cambia selezione ↑
        </a>
      </div>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-t border-border/70 pt-5 first:border-t-0 first:pt-0">
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value, detail, accent }: { label: string; value: string; detail?: string; accent?: boolean }) {
  return (
    <div className={"min-w-0 rounded-2xl border p-5 " + (accent ? "border-[#173b49] bg-[#173b49] text-white" : "bg-card text-foreground")}>
      <p className={"text-xs " + (accent ? "text-teal-100" : "text-muted-foreground")}>{label}</p>
      <p className="font-display my-4 break-words text-3xl font-semibold tabular-nums leading-tight">{value}</p>
      {detail && <p className={"text-xs leading-relaxed " + (accent ? "text-teal-100" : "text-muted-foreground")}>{detail}</p>}
    </div>
  );
}

/**
 * The 25 workbook sheets and where each one stands. Shown closed; a reader
 * who asks "is all of the workbook here?" gets the answer sheet by sheet.
 */
function WorkbookMap() {
  const tally = workbookTally();
  return (
    <details className="rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Il workbook, foglio per foglio · {formatNumber(tally.implemented, 0)} {tally.implemented === 1 ? "implementato" : "implementati"} · {formatNumber(tally.implementable, 0)} {tally.implementable === 1 ? "implementabile" : "implementabili"} · {formatNumber(tally.blocked, 0)} {tally.blocked === 1 ? "bloccato" : "bloccati"} · {formatNumber(tally.evidence, 0)} di evidenza
      </summary>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Venticinque fogli: non tutti sono analisi, e non tutte le analisi possono vivere sul libro mastro.
        Lo stato è quello del contenuto intero del foglio; dove il titolo è vivo e il dettaglio no, la nota lo dice.
        Niente è promosso in silenzio: un risultato statistico congelato non diventa una cifra viva finché non è importato con la sua provenienza.
      </p>
      <div className="mt-3 space-y-4">
        {workbookByStatus().map(({ status, sheets }) => sheets.length === 0 ? null : (
          <div key={status}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{WORKBOOK_STATUS_LABELS[status]} · {formatNumber(sheets.length, 0)}</p>
            <ul className="mt-1.5 divide-y divide-border rounded-lg border border-border">
              {sheets.map((s) => (
                <li key={s.id} className="grid gap-x-4 gap-y-0.5 px-3 py-2 text-xs sm:grid-cols-[7rem_1fr_1fr]">
                  <span className="font-mono text-muted-foreground">{s.id} · {s.sheet}</span>
                  <span className="text-foreground">{s.holds}</span>
                  <span className="text-muted-foreground">{s.where}{s.note ? <> · <em>{s.note}</em></> : null}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

// The withheld reasons come from the database in English (pillar_b_uptake_withheld).
// Shown in Italian; an unknown reason is shown as it is rather than guessed.
const WITHHELD_REASON_IT: Record<string, string> = {
  "no comparable stratum": "nessuno strato confrontabile",
  "quantity basis unresolved: the two independent parses disagree": "base della quantità non risolta: le due letture indipendenti non concordano",
  "no normalized quantity for this presentation": "nessuna quantità normalizzata per questa presentazione",
  "substance/route group not usable: mixed units, or only one side present": "gruppo sostanza/via non utilizzabile: unità miste, o un solo lato presente",
};

function Notice({ tone, children }: { tone: "warning" | "info"; children: React.ReactNode }) {
  const Icon = tone === "warning" ? AlertTriangle : Info;
  return (
    <div className={
      "flex gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed " +
      (tone === "warning" ? "border-amber-500/30 bg-amber-500/10" : "border-border bg-muted/30")
    }>
      <Icon size={14} className={"mt-0.5 shrink-0 " + (tone === "warning" ? "text-amber-600" : "text-muted-foreground")} />
      <div>{children}</div>
    </div>
  );
}

export function PillarBReview(props: PillarBReviewProps) {
  const { panorama, adoption, spend, evidence, notices, years, viewOptions } = props;
  const yoy = spend.totals.spend2024 === 0
    ? null
    : (spend.totals.spend2025 - spend.totals.spend2024) / Math.abs(spend.totals.spend2024);
  const periodLabel = props.periodLabel;
  const headlineYear = years.length === 1 ? years[0] : 2025;
  const headlineRows = headlineYear === 2024 ? spend.totals.rows2024 : spend.totals.rows2025;
  const has2024 = spend.totals.rows2024 > 0;
  const has2025 = spend.totals.rows2025 > 0;
  const shownRows = years.length === 2 ? spend.totals.rows2024 + spend.totals.rows2025 : headlineRows;
  const hasDistribution = Boolean(panorama.calendar?.some((r) => r.monthsObserved > 0)
    || (panorama.azienda && panorama.azienda.length > 1) || panorama.channels?.length);

  return (
    <div className="flex flex-col gap-7 pb-10 sm:gap-8">
      <header className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-primary">Pillar B / Biosimilari ed esclusività</p>
          <h1 className="font-display max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">
            Dalla spesa all&apos;adozione.<br /><span className="text-primary">Una lettura verificabile.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Spesa, confronto tra anni e adozione dei biosimilari nel perimetro di {props.scope.perimeterLabel}.
            Ogni misura conserva il proprio denominatore e la propria copertura.
          </p>
        </div>
        <div className="self-end rounded-xl border bg-card p-4 text-sm">
          <p className="font-semibold">Flussi regionali · {periodLabel}</p>
          <p className="mt-2 text-muted-foreground">{props.releaseId}</p>
        </div>
      </header>

      {props.scope.reviewerScopeUnavailable && (
        <Notice tone="warning">
          Accesso revisore riconosciuto, ma la lettura estesa non è disponibile in questo
          ambiente: i dati mostrati restano limitati al perimetro della tua organizzazione.
          Non interpretare questa pagina come l&apos;intero rilascio.
        </Notice>
      )}

      {props.filterBar}

      {/* THE HEADLINE ROW. Both years are always shown, because the change
          between them is the page's one fixed comparison and a percentage
          without its base and its euro movement is not a figure. The year
          filter narrows the sections below; it is declared here as NOT
          applying. An empty narrowed set is "non osservato", never "0,00 €":
          sumSpend coerces an empty row set to 0, so the row count decides. */}
      {(has2024 || has2025) && <div id="panorama" className="grid scroll-mt-8 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {has2024 && <Stat accent={years.length === 2 || headlineYear === 2024}
              label="Spesa riportata · 2024"
              value={formatEur(spend.totals.spend2024)}
              detail={`${formatNumber(spend.totals.rows2024, 0)} record · Azienda, canale e molecola selezionati`} />}
        {has2025 && <Stat accent={years.length === 2 || headlineYear === 2025}
              label="Spesa riportata · 2025"
              value={formatEur(spend.totals.spend2025)}
              detail={`${formatNumber(spend.totals.rows2025, 0)} record · Azienda, canale e molecola selezionati`} />}
        {has2024 && has2025 && yoy !== null && <Stat label="Variazione · 2024 → 2025"
              value={formatPercent(yoy)}
              detail={`${formatEur(spend.totals.spend2025 - spend.totals.spend2024)} · confronto fisso fra i due anni, il filtro anno non si applica · ${props.comparisonLabel}`} />}
        {shownRows > 0 && <Stat label={`Record · ${years.length === 2 ? "2024 e 2025" : headlineYear}`}
              value={formatNumber(shownRows, 0)} detail="Righe rendicontate, non pazienti" />}
      </div>}
      {/* A year with no record under these filters is not drawn as a card, and
          it is not a zero either: it is said in one line, so the absence of
          the comparison card reads as "not calculable", not as "nothing to see". */}
      {has2024 && has2025 && yoy === null && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Variazione percentuale 2024 → 2025 non calcolabile: la spesa netta 2024 è pari a zero (acquisti e rettifiche si compensano).
          Movimento in euro: <span className="font-mono text-foreground">{formatEur(spend.totals.spend2025 - spend.totals.spend2024)}</span>.
        </p>
      )}
      {(has2024 !== has2025) && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Nel {has2024 ? 2025 : 2024} nessun record con i filtri selezionati: non è uno zero, e il confronto 2024 → 2025 non è calcolabile.
        </p>
      )}
      {!has2024 && !has2025 && (
        <Notice tone="info">
          Nessun record nel 2024 né nel 2025 con i filtri selezionati. L&apos;insieme è vuoto, non uno zero; la barra dei filtri indica dove esistono record.
        </Notice>
      )}

      {props.degraded.length > 0 && (
        <Notice tone="warning">
          <p className="font-semibold text-foreground">Alcune viste usano una funzione non ancora pubblicata sul database.</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {props.degraded.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </Notice>
      )}

      {hasDistribution && <Group id="distribuzione" title="Profilo mensile e distribuzione"
             lead="Dove e quando si registra la spesa nel perimetro selezionato. Il 2026 parziale è mostrato solo nel calendario, mai nel confronto annuale.">
        {panorama.totals && panorama.totals.spend_eur !== null && (
          <p className="text-sm text-muted-foreground">
            Negli anni selezionati: <span className="font-mono text-foreground">{formatEur(panorama.totals.spend_eur)}</span>
            {" · "}{formatNumber(panorama.totals.rows_n, 0)} record · {formatNumber(panorama.totals.substance_count, 0)} {panorama.totals.substance_count === 1 ? "principio attivo" : "principi attivi"}
            {panorama.totals.spend_eur !== 0 && <>
              {/* A null comparable sum is "no comparable row": a known 0 % of a known total. */}
              {" · "}con quantità confrontabile{" "}
              <span className="font-mono text-foreground">{formatPercent((panorama.totals.comparable_spend_eur ?? 0) / panorama.totals.spend_eur)}</span>
              {" "}— la base su cui ogni misura di volume riposa.
            </>}
          </p>
        )}
        {panorama.calendar && (
          <CalendarPanel rows={panorama.calendar} initial={viewOptions.calendar} initialView={viewOptions.monthView}
            title="Spesa mese per mese" />
        )}

        {panorama.azienda && panorama.azienda.length > 1 && (
          <AziendaPanel rows={panorama.azienda} years={years} initial={viewOptions.azienda} absent={panorama.aziendaAbsent} />
        )}

        {panorama.channels && <ChannelStack rows={panorama.channels} years={years} />}
      </Group>}

      {/* ============================================================ ADOZIONE */}
      <Group id="adozione" title="Classificazione e adozione dei biosimilari"
             lead="Due letture dell'adozione: quota di spesa sul perimetro classificato e, solo dove le unità sono confrontabili, quota in volume.">
        <Sub title="In valore · due denominatori, mai uno solo">
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Questa è una quota di <strong>spesa</strong>, non di pazienti o trattamenti.
            Prezzi e presentazioni possono far divergere le due quote in entrambe le
            direzioni; non si può dedurre l&apos;adozione clinica dalla sola spesa.
          </p>
          {adoption.valueUptakeSection}
        </Sub>

        {(adoption.bridge || adoption.bridgeWithheld) && <Sub title="Il ponte dell'opportunità (B) · dal totale alla spesa di riferimento sostituibile">
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Il foglio 09 del workbook fa uscire ogni euro del libro mastro da una sola soglia, fino alla spesa di
            riferimento nei mesi in cui un biosimilare era già stato dispensato localmente. È una popolazione di
            spesa, <strong>non un risparmio</strong>: nessuna assunzione di prezzo è applicata, e la dispersione di
            prezzo non è denaro recuperabile (B14 nei Limiti). Le ultime due soglie dipendono dalla prima dispensazione
            locale di un biosimilare <em>nelle Aziende selezionate</em>, letta su tutta la storia visibile (ogni canale,
            ogni anno): per la Regione la finestra si apre con la prima Azienda che ha cambiato, quindi queste due soglie
            non si sommano tra Aziende; tutte le altre sì.
          </p>
          {adoption.bridge
            ? <BridgeBChart bridge={adoption.bridge.model} check={adoption.bridge.check} monthsLabel={adoption.bridge.monthsLabel} scopeLabel={adoption.bridge.scopeLabel} />
            : <Notice tone="info">{adoption.bridgeWithheld}</Notice>}
        </Sub>}

        {(adoption.volume.length > 0 || adoption.uptake.withheldRows > 0) && <Sub title="In volume · dove la quantità ha un'unità">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
              L&apos;uptake in volume è calcolato per (Azienda, principio attivo, via di
              somministrazione) su una quantità normalizzata, e soltanto dove la base
              della quantità è risolta. La quota trattenuta qui sotto è il complemento
              esatto a livello di record, non di gruppo.
            </p>
            {adoption.notes.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs leading-relaxed">
                {adoption.notes.map((n) => <li key={n}><strong className="text-foreground">{n}</strong></li>)}
              </ul>
            )}
            {adoption.uptake.withheldShare !== null && <div className="mt-4">
              <UptakeCoverageChart
                withheldShare={adoption.uptake.withheldShare}
                usedSpend={adoption.uptake.usedSpendEur ?? 0}
                withheldSpend={adoption.uptake.withheldSpendEur}
              />
            </div>}
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              {adoption.groupCount > 0 && <div className="rounded-lg border border-border bg-muted/30 p-3">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Gruppi con uptake calcolabile</dt>
                <dd className="font-display mt-1 text-base text-foreground">{formatNumber(adoption.groupCount, 0)}</dd>
                <p className="mt-0.5 text-[11px] text-muted-foreground">(Azienda, principio attivo, via, unità) · {years.length === 2 ? "presenti in almeno uno dei due anni" : String(years[0])}</p>
              </div>}
              {adoption.uptake.withheldRows > 0 && <div className="rounded-lg border border-border bg-muted/30 p-3">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Spesa trattenuta</dt>
                <dd className="font-display mt-1 text-base text-foreground">{formatEur(adoption.uptake.withheldSpendEur)}</dd>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {adoption.uptake.withheldShare !== null && <>{formatPercent(adoption.uptake.withheldShare)} del perimetro della misura · </>}
                  {formatNumber(adoption.uptake.withheldRows, 0)} record
                </p>
              </div>}
              {adoption.uptake.withheldShare !== null && <div className="rounded-lg border border-border bg-muted/30 p-3">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Copertura della misura</dt>
                <dd className="font-display mt-1 text-base text-foreground">
                  {formatPercent(1 - adoption.uptake.withheldShare)}
                </dd>
                <p className="mt-0.5 text-[11px] text-muted-foreground">quota utilizzata del perimetro della misura; non riferibile all&apos;intera popolazione</p>
              </div>}
            </dl>

            <VolumePanel rows={adoption.volume} routes={adoption.routes} initial={viewOptions.route} />

            {adoption.uptake.withheld.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-primary">
                  Apri i {formatNumber(adoption.withheldGroupCount, 0)} gruppi trattenuti e i motivi
                </summary>
                <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[34rem] text-sm" translate="no">
                    <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold">Azienda</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Principio attivo</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Motivo</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Record</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Spesa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {adoption.uptake.withheld.map((w, i) => (
                        /* The key carries no asl_code: React keys reach the page payload,
                           and a code beside a pseudonym would undo the pseudonym. */
                        <tr key={`${i}-${w.active_substance}-${w.withheld_reason}`}>
                          <td className="px-4 py-2.5 text-xs">{props.scope.aslLabels[w.asl_code] ?? "Azienda non mappata"}</td>
                          <td className="px-4 py-2.5 text-xs">{w.active_substance}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{WITHHELD_REASON_IT[w.withheld_reason] ?? w.withheld_reason}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs">{formatNumber(w.rows_n, 0)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs">{w.spend_eur === null ? "—" : formatEur(w.spend_eur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        </Sub>}
      </Group>

      {/* =============================================================== SPESA */}
      <Group id="spesa" title="La traiettoria nel tempo"
             lead={`Il confronto 2024 → 2025 usa sempre entrambi gli anni (${props.comparisonLabel}); i filtri di Azienda, canale e molecola si applicano. Il perimetro, l'ordinamento e il numero di molecole mostrate si scelgono qui sotto.`}>
        <ChannelSlopeChart rows={spend.channelTrend} />
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-primary">Apri la serie numerica per canale</summary>
          <div className="mt-3">
            <TrendTable caption="Per canale di erogazione" rows={spend.channelTrend} firstColumn="Canale" />
          </div>
        </details>
        <TrendPanel
          variants={spend.trendVariants}
          totals={spend.trendTotals}
          initial={{ order: viewOptions.trendOrder, limit: viewOptions.trendLimit, perimeter: viewOptions.perimeter }}
        />
      </Group>

      <Group id="concentrazione" title="Concentrazione della spesa"
             lead="Quanto della spesa di un anno completo si concentra nei principi attivi più rilevanti, sotto i filtri di Azienda, canale e molecola. L'anno e il perimetro si scelgono qui sotto, indipendentemente dal periodo selezionato in alto e dal perimetro scelto per le variazioni.">
        <ConcentrationPanel
          variants={spend.concentrationVariants}
          defaultYear={spend.concentrationYear}
          initial={{ year: viewOptions.concentrationYear, perimeter: viewOptions.concentrationPerimeter }}
        />
      </Group>

      {/* ============================================================ EVIDENZA */}
      <Group id="evidenza" title="Copertura e classificazione dei dati"
             lead="Dal totale osservato ai record utilizzabili per il confronto, e il perimetro su cui ogni misura di adozione riposa.">
        <Sub title={`L'imbuto dei record · ${evidence.funnelYear} · intero perimetro visibile`}>
          {evidence.funnelIgnoresFilters && (
            <Notice tone="info">
              L&apos;imbuto non si restringe per Azienda, canale o molecola: mostra l&apos;intero
              perimetro visibile a chi guarda, per l&apos;anno indicato. I filtri attivi
              valgono per le altre sezioni.
            </Notice>
          )}
          <EvidenceFunnelChart rows={evidence.funnel} />
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-primary">Apri il dettaglio dei passaggi, della spesa e dei motivi</summary>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[46rem] text-sm" translate="no">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Passaggio</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Record</th>
                    <th className="px-4 py-2.5 text-right font-semibold">% sugli osservati</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Persi dal passaggio prec.</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Spesa</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {evidence.funnel.map((stage) => (
                    <tr key={stage.step}>
                      <td className="px-4 py-3 font-medium text-foreground">{stage.step}. {stage.stage}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{formatNumber(stage.rows_n, 0)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{stage.shareOfObserved === null ? "—" : formatPercent(stage.shareOfObserved)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{stage.droppedRows === 0 ? "—" : `−${formatNumber(stage.droppedRows, 0)}`}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{stage.spend_eur === null ? "—" : formatEur(stage.spend_eur)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{stage.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Sub>
        {evidence.perimeter && <PerimeterBars rows={evidence.perimeter} />}
        {evidence.perimeterWithheld && (
          <Notice tone="info">
            <strong className="text-foreground">Perimetro per stato non mostrato con un filtro per molecola.</strong>{" "}
            Per una sola molecola la quota di ogni stato (biosimilare, riferimento) coinciderebbe
            con una misura di adozione senza regola di validità mensile — un terzo denominatore
            che non corrisponde a nessuna delle due quote pubblicate. Le due quote sono nella
            sezione Adozione; il perimetro per stato torna togliendo il filtro per molecola.
          </Notice>
        )}
      </Group>

      {/* ============================================================== LIMITI */}
      <Group id="limiti" title="Come leggere gli indicatori"
             lead="Le condizioni di lettura del workbook congelato (fogli 22 e 24). Sono parte dell'analisi, non avvisi di errore.">
        <dl className="grid gap-5 text-sm md:grid-cols-2">
          <div><dt className="font-semibold">Previsione (B10)</dt><dd className="mt-2 text-muted-foreground">Il backtest a origine mobile su 11 orizzonti non ha battuto il livello costante. Il livello portato avanti non è una previsione.</dd></div>
          <div><dt className="font-semibold">Causalità (B12)</dt><dd className="mt-2 text-muted-foreground">Nessun intervento datato è registrato nei dati; senza un disegno non c&apos;è effetto da stimare.</dd></div>
          <div><dt className="font-semibold">Risparmio (B14)</dt><dd className="mt-2 text-muted-foreground">Ogni «opportunità» è un limite superiore sotto quattro assunzioni non verificate. La dispersione di prezzo (B07) non è denaro recuperabile.</dd></div>
          <div><dt className="font-semibold">Classifiche fra Aziende (B09)</dt><dd className="mt-2 text-muted-foreground">La graduatoria grezza misura cosa è stato comprato; standardizzata, le differenze non sono stabili. Il case-mix non è controllabile: ATC assente sul rilascio.</dd></div>
          <div><dt className="font-semibold">Confezioni</dt><dd className="mt-2 text-muted-foreground">La base della quantità è confezioni, unità, mista e ignota nello stesso rilascio. Una somma fra basi non ha unità.</dd></div>
          <div><dt className="font-semibold">2026 parziale</dt><dd className="mt-2 text-muted-foreground">Cinque mesi osservati, zero record con quantità confrontabile. Compare nel calendario, segnalato; non entra nei confronti annuali.</dd></div>
          <div><dt className="font-semibold">Spesa lorda</dt><dd className="mt-2 text-muted-foreground">IVA inclusa, al lordo di payback e note di credito di registro. Non è un prezzo netto, né un prezzo di riferimento AIFA.</dd></div>
          <div><dt className="font-semibold">Esclusività legale</dt><dd className="mt-2 text-muted-foreground">Gli «anni senza concorrenza» (B15) sono un limite superiore fra autorizzazione EU del riferimento e del primo biosimilare; non sono scadenze brevettuali o SPC.</dd></div>
        </dl>
      </Group>

      <Group id="fonte" title="Dalla visualizzazione alla fonte"
             lead="Periodo, flusso e copertura restano distinguibili anche quando una misura non è pubblicabile.">
        <WorkbookMap />
        <div className="text-xs text-muted-foreground">
          <span>DIR_OSP_TRA_003AS · {props.releaseId} · 2026 escluso dai confronti</span>
          <details className="mt-2 max-w-4xl">
            <summary className="cursor-pointer font-medium text-foreground">Metodo, copertura e rettifiche</summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>{MONTHS_OBSERVED_NOTE}</p>
              <p>Il 2026 copre solo gennaio–maggio e non entra nei confronti 2024–2025.</p>
              {notices.map((n) => <p key={n.label}><strong className="text-foreground">{n.label}:</strong> {n.detail}</p>)}
            </div>
          </details>
        </div>
      </Group>
    </div>
  );
}
