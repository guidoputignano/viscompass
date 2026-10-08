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
import { ChannelStack, PerimeterComposition } from "@/components/dashboard-review/pillar-b-adoption-visuals";
import {
  AziendaPanel, CalendarPanel, ConcentrationPanel, TrendPanel, TrendTable, VolumePanel,
  type ConcentrationVariants, type TrendVariants,
} from "@/components/dashboard-review/pillar-b-panels";
import type { ConcentrationYear, PerimeterMode, ViewOptions } from "@/lib/dashboard-review/pillar-b/view-options";
import { WORKBOOK_STATUS_LABELS, workbookByStatus, workbookTally } from "@/lib/dashboard-review/pillar-b/workbook-map";
import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { CoverageNotice, FunnelRow, TrendRow } from "@/lib/dashboard-review/pillar-b/review-data";
import type { UptakeWithWithheld, WithheldRow } from "@/lib/dashboard-review/pillar-b/rpc";
import type { AziendaPanelRow, CalendarRow, ChannelMixRow, FacetTotals, PerimeterRow } from "@/lib/dashboard-review/pillar-b/facets";
import type { VolumePanelRow } from "@/lib/dashboard-review/pillar-b/adoption";
import type { BridgeB, BridgeBPerimeterCheck } from "@/lib/dashboard-review/pillar-b/bridge-b";
import { partialYearCopy } from "@/lib/dashboard-review/pillar-b/view-options";
import { notObservedFootnote, notObservedFootnoteAdds, notObservedIntro } from "@/lib/dashboard-review/pillar-b/review-queue";
import { BridgeBChart } from "@/components/dashboard-review/pillar-b-bridge-b";
import type { ReviewQueue, ReviewQueueRow } from "@/lib/dashboard-review/pillar-b/review-queue";
import { KeepLink } from "@/components/dashboard-review/pillar-b-local-toggle";
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
  /** The page's scope line: Azienda, years, channels, molecule. */
  scopeLine: string;
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
    /** The Region's channel mix under the same filters, for a selected Azienda (reviewer / Regione only). */
    channelsComparator: { label: string; aziende: number; rows: ChannelMixRow[] } | null;
    /** The selected Azienda's label as this viewer may see it. */
    channelsSelectedLabel: string | null;
    /** One sentence when the comparator is unavailable to this viewer. */
    channelsComparatorNote: string | null;
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
    /** One organisational review cohort and one EU-status evidence cohort. */
    reviewQueue: (ReviewQueue & { hrefs: Record<string, string> }) | null;
    reviewQueueWithheld: string | null;
    /** The bridge reconciles to the cent: when false its panel opens and says so. */
    bridgeReady: boolean;
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
    <section id={id} className="flex scroll-mt-8 flex-col gap-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      {/* STACKED ON A PHONE: as a wrapping row, the flex-1 text block shrank
          beside the link to a column a few words wide instead of wrapping. */}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-8">
        <div className="min-w-0 sm:flex-1">
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
        Venticinque fogli: non tutti sono analisi, e non tutte le analisi possono essere calcolate sui dati del rilascio.
        Lo stato è quello del contenuto intero del foglio; dove il titolo è vivo e il dettaglio no, la nota lo dice.
        Niente è promosso in silenzio: un risultato statistico congelato non diventa una cifra viva finché non è importato con la sua provenienza.
      </p>
      <div className="mt-3 space-y-4">
        {workbookByStatus().map(({ status, sheets }) => sheets.length === 0 ? null : (
          <div key={status}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{WORKBOOK_STATUS_LABELS[status]} · {formatNumber(sheets.length, 0)}</p>
            {/* Three columns only where each text column keeps about 10rem:
                the list's own width decides, since on a tablet the sidebar and
                the panel's padding leave far less than the viewport suggests. */}
            <ul className="mt-1.5 divide-y divide-border rounded-lg border border-border [container-type:inline-size]">
              {sheets.map((s) => (
                <li key={s.id} className="grid gap-x-4 gap-y-0.5 px-3 py-2 text-xs [@container(min-width:30rem)]:grid-cols-[7rem_1fr_1fr]">
                  <span className="font-mono text-muted-foreground [overflow-wrap:anywhere]">{s.id} · {s.sheet}</span>
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

// THE CELLS OF EACH TABLE BELOW, formatted once: a table and the stacked list
// that replaces it in a narrow container render the same strings, so the two
// layouts cannot drift apart. Missing values stay "—", never 0.

/** A review-question row: first local use, the question's euros, its share. */
function queueCells(r: ReviewQueueRow, shareOf: "dateValidShare" | "locallyObservedShare") {
  const share = r[shareOf];
  return {
    firstLocal: r.firstLocalLabel ?? "—",
    eur: formatEur(r.eur),
    share: share === null ? "—" : formatPercent(share),
  };
}

/** A withheld volume group. The Azienda is named only by the label this viewer may see. */
function withheldCells(w: WithheldRow, aslLabels: Record<string, string>) {
  return {
    azienda: aslLabels[w.asl_code] ?? "Azienda non mappata",
    reason: WITHHELD_REASON_IT[w.withheld_reason] ?? w.withheld_reason,
    rows: formatNumber(w.rows_n, 0),
    spend: w.spend_eur === null ? "—" : formatEur(w.spend_eur),
  };
}

/** A stage of the record funnel. */
function funnelCells(stage: FunnelRow) {
  return {
    rows: formatNumber(stage.rows_n, 0),
    share: stage.shareOfObserved === null ? "—" : formatPercent(stage.shareOfObserved),
    dropped: stage.droppedRows === 0 ? "—" : `−${formatNumber(stage.droppedRows, 0)}`,
    spend: stage.spend_eur === null ? "—" : formatEur(stage.spend_eur),
  };
}

function ReviewQuestion({ title, headline, question, check, who, next, rows, total, hrefs, firstColumn, amountColumn, shareColumn, shareOf, method }: {
  title: string;
  /** One line: the euros and the count the question rests on. */
  headline: string;
  question: string; check: string; who: string; next: string;
  rows: ReviewQueueRow[]; total: number; hrefs: Record<string, string>;
  firstColumn: string | null; amountColumn: string; shareColumn: string; shareOf: "dateValidShare" | "locallyObservedShare";
  /** How the list is built: one click away, not in front of the question. */
  method: string;
}) {
  const link = (r: ReviewQueueRow) => hrefs[r.substance]
    ? <KeepLink href={hrefs[r.substance]} className="hover:text-primary hover:underline">{r.substance} <span aria-hidden="true">→</span></KeepLink>
    : r.substance;
  const count = `${formatNumber(rows.length, 0)} ${rows.length === 1 ? "molecola" : "molecole"}`;
  return (
    // THE CARD IS THE CONTAINER: from lg the two questions sit side by side,
    // so a viewport breakpoint cannot tell how wide one card is (about 276 px
    // at 1024 and 396 px at 1280, where the table's 26rem was clipped).
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 [container-type:inline-size]">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 font-display text-lg font-semibold text-foreground">{headline}</p>
      {/* Labels beside the text only where the text keeps a readable column
          beside the 7.5rem labels; stacked in a narrower card. */}
      <dl className="mt-2 grid gap-x-3 gap-y-1 text-xs [@container(min-width:20rem)]:grid-cols-[7.5rem_1fr]">
        <dt className="text-muted-foreground">Domanda</dt><dd className="text-foreground">{question}</dd>
        <dt className="text-muted-foreground">Da verificare</dt><dd className="text-foreground">{check}</dd>
        <dt className="text-muted-foreground">Chi</dt><dd className="text-foreground">{who}</dd>
        <dt className="text-muted-foreground">Passo successivo</dt><dd className="text-foreground">{next}</dd>
      </dl>
      {rows.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">Nessuna molecola in questa selezione.</p> : <>
        {/* Below the table's 26rem plus its two 1px borders (26.125rem): the
            same rows, in the same order, as a stacked list. */}
        <ul aria-label={`${title}: molecole, ${amountColumn.toLowerCase()} e quota; il nome apre l'evidenza della molecola`} translate="no"
          className="mt-3 divide-y divide-border rounded-lg border border-border text-xs [@container(min-width:26.125rem)]:hidden">
          {rows.map((r) => {
            const c = queueCells(r, shareOf);
            return (
              <li key={r.substance} className="px-3 py-2">
                <p className="font-medium text-foreground">{link(r)}</p>
                <dl className="mt-1 grid max-w-sm grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
                  {firstColumn && <>
                    <dt className="text-muted-foreground">{firstColumn}</dt>
                    <dd className="whitespace-nowrap text-right font-mono text-muted-foreground">{c.firstLocal}</dd>
                  </>}
                  <dt className="text-muted-foreground">{amountColumn}</dt>
                  <dd className="whitespace-nowrap text-right font-mono">{c.eur}</dd>
                  <dt className="text-muted-foreground">{shareColumn}</dt>
                  <dd className="whitespace-nowrap text-right font-mono">{c.share}</dd>
                </dl>
              </li>
            );
          })}
          <li className="bg-muted/30 px-3 py-2">
            <p className="font-semibold text-foreground">{count}</p>
            <dl className="mt-1 grid max-w-sm grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
              <dt className="text-muted-foreground">{amountColumn}</dt>
              <dd className="whitespace-nowrap text-right font-mono font-semibold">{formatEur(total)}</dd>
            </dl>
          </li>
        </ul>
        <div className="mt-3 hidden overflow-x-auto rounded-lg border border-border [@container(min-width:26.125rem)]:block">
          <table className="w-full min-w-[26rem] text-sm" translate="no">
            <caption className="sr-only">{title}: molecole, {amountColumn.toLowerCase()} e quota; il nome apre l&apos;evidenza della molecola</caption>
            <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Molecola · evidenza</th>
                {firstColumn && <th scope="col" className="px-3 py-2 text-right font-semibold">{firstColumn}</th>}
                <th scope="col" className="px-3 py-2 text-right font-semibold">{amountColumn}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{shareColumn}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const c = queueCells(r, shareOf);
                return (
                  <tr key={r.substance}>
                    <td className="px-3 py-2 text-xs text-foreground">{link(r)}</td>
                    {firstColumn && <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{c.firstLocal}</td>}
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs">{c.eur}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{c.share}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/30">
              <tr>
                <td className="px-3 py-2 text-xs font-semibold text-foreground" colSpan={firstColumn ? 2 : 1}>{count}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs font-semibold">{formatEur(total)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </>}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] font-semibold text-primary">Come è costruita la lista<span className="sr-only">: {title}</span></summary>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{method}</p>
      </details>
    </div>
  );
}

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
  const has2024 = spend.totals.rows2024 > 0;
  const has2025 = spend.totals.rows2025 > 0;
  const hasDistribution = Boolean(panorama.calendar?.some((r) => r.monthsObserved > 0)
    || (panorama.azienda && panorama.azienda.length > 1) || panorama.channels?.length);
  // "gen–mag 2026 · dati osservati" under the active filters, or the wording
  // for a selection with no 2026 record; the release-wide five months only
  // when the calendar facet is unavailable.
  const partial = partialYearCopy(panorama.calendar);

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
          <p className="mt-2 text-muted-foreground">Spesa lorda, IVA inclusa · {partial.header}</p>
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
        {adoption.bridge && adoption.bridge.check?.consistent === true && adoption.bridge.model.residual === 0 && adoption.bridge.model.gates.every((g) => g.eur >= 0) && adoption.bridge.model.total > 0 && <Stat label={`Perimetro biosimilare · ${years.length === 2 ? "2024 e 2025" : headlineYear}`}
              value={formatEur(adoption.bridge.model.perimeter)}
              detail={`${formatPercent(adoption.bridge.model.perimeter / adoption.bridge.model.total)} della spesa riportata nella selezione: biosimilari e medicinali di riferimento, in ogni mese. È il denaro su cui le misure di adozione si fondano.`} />}
      </div>}
      {/* THE TWO ADOPTION SHARES, together or not at all, as the page's opening
          answer to "how far has the switch gone". Formula, month rules and a
          worked example are in the Adozione section this card links to. */}
      {panorama.valueUptake.dateValid.share !== null && panorama.valueUptake.locallyObserved.share !== null && (
        <a href="#adozione" className="block rounded-2xl border bg-card p-5 text-foreground hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <p className="text-xs text-muted-foreground">Adozione in valore · {years.length === 2 ? "2024 e 2025" : headlineYear} · due quote, mai una sola{panorama.valueUptakeScope ? ` · ambito: ${panorama.valueUptakeScope}` : ""}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-display text-3xl font-semibold tabular-nums leading-tight">{formatPercent(panorama.valueUptake.dateValid.share)}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">spesa biosimilare ÷ (biosimilare + riferimento) nei mesi in cui un biosimilare era già autorizzato</p>
            </div>
            <div>
              <p className="font-display text-3xl font-semibold tabular-nums leading-tight">{formatPercent(panorama.valueUptake.locallyObserved.share)}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">la stessa quota, contando solo i mesi dal primo biosimilare dispensato nell&apos;ambito visibile</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Quote di spesa, non di pazienti né di trattamenti. Formula, mesi contati ed esempio nella sezione Adozione ↓</p>
        </a>
      )}
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
          scopeLine={props.scopeLine}
          comparisonLabel={props.comparisonLabel}
        />
      </Group>

      {hasDistribution && <Group id="distribuzione" title="Profilo mensile e distribuzione"
             lead={`Dove e quando si registra la spesa nel perimetro selezionato. ${partial.distributionLead}`}>
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

        {panorama.channels && <ChannelStack rows={panorama.channels} years={years}
          selectedLabel={panorama.channelsSelectedLabel} comparator={panorama.channelsComparator} comparatorNote={panorama.channelsComparatorNote} />}
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

        {adoption.reviewQueue && (adoption.reviewQueue.afterLocalSwitch.length > 0 || adoption.reviewQueue.notObservedHere.length > 0) && (
          <Sub title="Domande di revisione, molecola per molecola">
            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Due domande per la revisione organizzativa, ciascuna con le molecole e la spesa che la motivano. Indicano dove
              guardare: <strong>non sono risparmi</strong> né indicazioni di sostituzione o di prescrizione.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <ReviewQuestion
                title="Riferimento ancora dispensato dopo il primo uso del biosimilare"
                headline={`${formatEur(adoption.reviewQueue.afterLocalSwitchTotal)} · ${formatNumber(adoption.reviewQueue.afterLocalSwitch.length, 0)} ${adoption.reviewQueue.afterLocalSwitch.length === 1 ? "molecola" : "molecole"}`}
                question="Perché, dopo che il biosimilare è entrato in uso qui, una parte della spesa resta sul medicinale di riferimento?"
                check="pazienti già in terapia, indicazioni o presentazioni non coperte dal biosimilare, esiti di gara, canale (CO, DD, DPC) e mese."
                who="farmacia ospedaliera, con i clinici prescrittori e il servizio acquisti."
                next="aprire la molecola, leggerla per canale e per mese, e portare i casi alla commissione terapeutica aziendale."
                rows={adoption.reviewQueue.afterLocalSwitch} total={adoption.reviewQueue.afterLocalSwitchTotal} hrefs={adoption.reviewQueue.hrefs}
                firstColumn="Primo uso qui" amountColumn="Riferimento dopo il primo uso" shareColumn="Quota 2" shareOf="locallyObservedShare"
                method="Spesa del medicinale di riferimento nei mesi successivi al primo biosimilare della stessa sostanza dispensato nelle Aziende selezionate, letto su tutta la storia del rilascio (ogni canale, ogni anno). Per la Regione il primo uso è quello della prima Azienda che ha cambiato. Non dimostra che le dispensazioni fossero clinicamente sostituibili. La quota 2 è la quota biosimilare sugli stessi mesi." />
              <ReviewQuestion
                title="Biosimilare autorizzato in EU, non ancora osservato qui"
                headline={`${formatEur(adoption.reviewQueue.notObservedHereTotal)} · ${formatNumber(adoption.reviewQueue.notObservedHere.length, 0)} ${adoption.reviewQueue.notObservedHere.length === 1 ? "molecola" : "molecole"}`}
                question="Esiste un biosimilare disponibile in Italia per queste sostanze, e perché non risulta dispensato in questo rilascio?"
                check="AIC e classificazione AIFA del biosimilare, presenza nelle gare regionali, disponibilità commerciale."
                who="farmacia ospedaliera e servizio acquisti."
                next="verificare lo stato italiano prima di considerarlo un'alternativa disponibile."
                rows={adoption.reviewQueue.notObservedHere} total={adoption.reviewQueue.notObservedHereTotal} hrefs={adoption.reviewQueue.hrefs}
                firstColumn={null} amountColumn="Riferimento nei mesi validi" shareColumn="Quota 1" shareOf="dateValidShare"
                method={`Spesa del medicinale di riferimento nei mesi validi per le sostanze di cui nessun biosimilare risulta dispensato nelle Aziende selezionate nei 29 mesi del rilascio. «Non osservato nel rilascio» non è «mai acquistato», e l'autorizzazione EU non dice lo stato in Italia. ${notObservedIntro(adoption.reviewQueue.beforeLocalSwitchTotal)}${notObservedFootnoteAdds(adoption.reviewQueue.beforeLocalSwitchTotal) ? ` ${notObservedFootnote(adoption.reviewQueue.beforeLocalSwitchTotal)}` : ""}`} />
            </div>
          </Sub>
        )}
        {adoption.reviewQueueWithheld && <Notice tone="info">{adoption.reviewQueueWithheld}</Notice>}

        {/* THE RECONCILIATION (PB-V5-03): every euro of the perimeter, gate by
            gate, kept but collapsed: the decision view above leads. */}
        {(adoption.bridge || adoption.bridgeWithheld) && (
          // A reconciliation that does not tie OPENS and says so in its
          // summary: a failure must not hide behind a closed panel.
          <details className="rounded-xl border border-border bg-card p-4" open={adoption.bridge !== null && !adoption.bridgeReady}>
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Riconciliazione della spesa del perimetro, soglia per soglia{adoption.bridge ? (adoption.bridgeReady ? ` · ${formatEur(adoption.bridge.model.perimeter)}` : " · non riconciliata in questa selezione") : ""}
            </summary>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Ogni euro del perimetro biosimilare esce da una sola soglia: già biosimilare, mesi prima della validità, mese di
              confine, data di validità non disponibile (quando c&apos;è), «EU-autorizzato, non ancora osservato qui» e riferimento
              dopo il primo uso locale{adoption.reviewQueue ? ", che è la base della prima domanda qui sopra" : ""}. È una ripartizione
              della spesa, non un risparmio. Le ultime due soglie dipendono dal primo uso nelle Aziende selezionate e quindi non si
              sommano tra Aziende; le altre sì.
            </p>
            <div className="mt-3">
              {adoption.bridge
                ? <BridgeBChart bridge={adoption.bridge.model} check={adoption.bridge.check} monthsLabel={adoption.bridge.monthsLabel} scopeLabel={adoption.bridge.scopeLabel} />
                : <Notice tone="info">{adoption.bridgeWithheld}</Notice>}
            </div>
          </details>
        )}

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
                {/* SWITCHED ON THIS PANEL'S OWN WIDTH: below the table's 34rem
                    plus its two 1px borders (34.125rem), the same groups in the
                    same order as a stacked list. */}
                <div className="mt-3 [container-type:inline-size]">
                  <ul translate="no" className="divide-y divide-border rounded-lg border border-border text-xs [@container(min-width:34.125rem)]:hidden">
                    {adoption.uptake.withheld.map((w, i) => {
                      const c = withheldCells(w, props.scope.aslLabels);
                      return (
                        /* The key carries no asl_code, as in the table below. */
                        <li key={`${i}-${w.active_substance}-${w.withheld_reason}`} className="px-3 py-2">
                          <p className="font-medium text-foreground">{c.azienda}</p>
                          <dl className="mt-1 grid max-w-sm grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                            <dt className="text-muted-foreground">Principio attivo</dt>
                            <dd className="break-words text-right text-foreground">{w.active_substance}</dd>
                            <dt className="col-span-2 text-muted-foreground">Motivo</dt>
                            <dd className="col-span-2 text-muted-foreground">{c.reason}</dd>
                            <dt className="text-muted-foreground">Record</dt>
                            <dd className="whitespace-nowrap text-right font-mono">{c.rows}</dd>
                            <dt className="text-muted-foreground">Spesa</dt>
                            <dd className="whitespace-nowrap text-right font-mono">{c.spend}</dd>
                          </dl>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="hidden overflow-x-auto rounded-lg border border-border [@container(min-width:34.125rem)]:block">
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
                        {adoption.uptake.withheld.map((w, i) => {
                          const c = withheldCells(w, props.scope.aslLabels);
                          return (
                            /* The key carries no asl_code: React keys reach the page payload,
                               and a code beside a pseudonym would undo the pseudonym. */
                            <tr key={`${i}-${w.active_substance}-${w.withheld_reason}`}>
                              <td className="px-4 py-2.5 text-xs">{c.azienda}</td>
                              <td className="px-4 py-2.5 text-xs">{w.active_substance}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.reason}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs">{c.rows}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs">{c.spend}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            )}
          </div>
        </Sub>}
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
          <EvidenceFunnelChart rows={evidence.funnel} year={evidence.funnelYear} />
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-primary">Apri il dettaglio dei passaggi, della spesa e dei motivi</summary>
            {/* SWITCHED ON THIS SECTION'S OWN WIDTH: below the table's 46rem
                plus its two 1px borders (46.125rem), the same stages in the
                same order as a stacked list. */}
            <div className="mt-3 [container-type:inline-size]">
              <ul translate="no" className="divide-y divide-border rounded-xl border border-border text-xs [@container(min-width:46.125rem)]:hidden">
                {evidence.funnel.map((stage) => {
                  const c = funnelCells(stage);
                  return (
                    <li key={stage.step} className="px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground">{stage.step}. {stage.stage}</p>
                      <dl className="mt-1 grid max-w-sm grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
                        <dt className="text-muted-foreground">Record</dt>
                        <dd className="whitespace-nowrap text-right font-mono">{c.rows}</dd>
                        <dt className="text-muted-foreground">% sugli osservati</dt>
                        <dd className="whitespace-nowrap text-right font-mono">{c.share}</dd>
                        <dt className="text-muted-foreground">Persi dal passaggio prec.</dt>
                        <dd className="whitespace-nowrap text-right font-mono text-muted-foreground">{c.dropped}</dd>
                        <dt className="text-muted-foreground">Spesa</dt>
                        <dd className="whitespace-nowrap text-right font-mono">{c.spend}</dd>
                        {stage.note && <>
                          <dt className="col-span-2 mt-0.5 text-muted-foreground">Nota</dt>
                          <dd className="col-span-2 text-muted-foreground">{stage.note}</dd>
                        </>}
                      </dl>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto rounded-xl border border-border [@container(min-width:46.125rem)]:block">
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
                    {evidence.funnel.map((stage) => {
                      const c = funnelCells(stage);
                      return (
                        <tr key={stage.step}>
                          <td className="px-4 py-3 font-medium text-foreground">{stage.step}. {stage.stage}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{c.rows}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{c.share}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{c.dropped}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{c.spend}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{stage.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </Sub>
        {evidence.perimeter && <PerimeterComposition rows={evidence.perimeter} />}
        {evidence.perimeterWithheld && (
          <Notice tone="info">
            <strong className="text-foreground">Composizione del perimetro non mostrata con un filtro per molecola.</strong>{" "}
            Per una sola molecola la composizione per stato coinciderebbe con una quota di adozione
            senza regola sui mesi, diversa dalle due quote della sezione Adozione. Torna togliendo
            il filtro per molecola.
          </Notice>
        )}
      </Group>

      {/* ============================================================== LIMITI */}
      <Group id="limiti" title="Come leggere gli indicatori"
             lead="Che cosa questi indicatori permettono di dire, e che cosa no. Sono parte dell'analisi, non avvisi di errore.">
        <dl className="grid gap-5 text-sm md:grid-cols-2">
          <div><dt className="font-semibold">Previsioni</dt><dd className="mt-2 text-muted-foreground">Un modello di previsione verificato su undici orizzonti non ha fatto meglio del semplice livello costante: per questo la pagina non mostra previsioni.</dd></div>
          <div><dt className="font-semibold">Effetti causali</dt><dd className="mt-2 text-muted-foreground">Nei dati non è registrato alcun intervento datato; senza un disegno di valutazione non c&apos;è un effetto da stimare.</dd></div>
          <div><dt className="font-semibold">Risparmi</dt><dd className="mt-2 text-muted-foreground">Nessuna cifra di risparmio è mostrata: ogni «opportunità» calcolabile dipende da ipotesi non verificate, e la variabilità del costo fra Aziende non è denaro recuperabile.</dd></div>
          <div><dt className="font-semibold">Confronti fra Aziende</dt><dd className="mt-2 text-muted-foreground">Una graduatoria grezza misura che cosa è stato comprato; standardizzata per molecola, le differenze non sono stabili. Il case-mix non è controllabile su questi dati.</dd></div>
          <div><dt className="font-semibold">Quantità</dt><dd className="mt-2 text-muted-foreground">La quantità è registrata in confezioni, unità, base mista o ignota nello stesso flusso. Una somma fra basi diverse non ha unità.</dd></div>
          <div><dt className="font-semibold">2026 incompleto</dt><dd className="mt-2 text-muted-foreground">{partial.limitsNote}</dd></div>
          <div><dt className="font-semibold">Spesa lorda</dt><dd className="mt-2 text-muted-foreground">IVA inclusa, al lordo di payback e note di credito di registro. Non è un prezzo netto, né un prezzo di riferimento AIFA.</dd></div>
          <div><dt className="font-semibold">Esclusività legale</dt><dd className="mt-2 text-muted-foreground">Gli «anni senza concorrenza» sono un limite superiore fra l&apos;autorizzazione EU del riferimento e quella del primo biosimilare; non sono scadenze brevettuali o certificati complementari.</dd></div>
        </dl>
      </Group>

      <Group id="fonte" title="Fonte, periodo e metodo"
             lead="Da dove vengono le cifre, quale periodo coprono e come sono calcolate.">
        <div className="text-xs text-muted-foreground">
          <span>Fonte: flusso regionale dei consumi ospedalieri e della distribuzione diretta e per conto (DIR_OSP_TRA_003AS) · 2024 e 2025 confrontati · 2026 osservato da gennaio a maggio, escluso dai confronti</span>
          <details className="mt-2 max-w-4xl">
            <summary className="cursor-pointer font-medium text-foreground">Metodo, copertura e rettifiche</summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>{MONTHS_OBSERVED_NOTE}</p>
              <p>Il 2026 copre solo gennaio–maggio e non entra nei confronti 2024–2025.</p>
              {notices.map((n) => <p key={n.label}><strong className="text-foreground">{n.label}:</strong> {n.detail}</p>)}
            </div>
          </details>
        </div>
        {/* INTERNAL (PB-V5-07): the analysis inventory and the release id stay
            with the platform reviewers; an Azienda or Regione page never shows
            them. */}
        {props.scope.allOrganizations && (
          <div className="rounded-xl border border-dashed border-border p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Interno · visibile solo ai revisori della piattaforma · rilascio {props.releaseId}</p>
            <div className="mt-2"><WorkbookMap /></div>
          </div>
        )}
      </Group>
    </div>
  );
}
