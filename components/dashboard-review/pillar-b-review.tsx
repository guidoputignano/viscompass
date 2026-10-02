// Pillar B review page — composition only.
//
// The layout follows Pillar A: editorial introduction, a compact filter card,
// four comparable headline measures, then self-contained analytical panels.
// Server-rendered throughout. Charts encode the
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
  ChannelSlopeChart, ConcentrationCurve, EvidenceFunnelChart,
  MoleculeChangeChart, UptakeCoverageChart,
} from "@/components/dashboard-review/pillar-b-review-visuals";
import {
  AziendaBars, CalendarHeatmap, ChannelStack, PerimeterBars,
} from "@/components/dashboard-review/pillar-b-adoption-visuals";
import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { CoverageNotice, Concentration, FunnelRow, TrendRow } from "@/lib/dashboard-review/pillar-b/review-data";
import type { UptakeWithWithheld } from "@/lib/dashboard-review/pillar-b/rpc";
import type { AslBreakdownRow, CalendarRow, ChannelMixRow, FacetTotals, PerimeterRow } from "@/lib/dashboard-review/pillar-b/facets";
import type { VolumeBreakdownRow } from "@/lib/dashboard-review/pillar-b/adoption";
import { monthKeyLabel } from "@/lib/dashboard-review/pillar-b/adoption";
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
    azienda: AslBreakdownRow[] | null;
    channels: ChannelMixRow[] | null;
  };
  adoption: {
    valueUptakeSection: React.ReactNode;
    uptake: UptakeWithWithheld;
    /** Distinct (Azienda, substance, route, unit) groups — not per-year rows. */
    groupCount: number;
    withheldGroupCount: number;
    volume: VolumeBreakdownRow[];
    /** Which filters the volume measure could not honour, one sentence each. */
    notes: string[];
  };
  spend: {
    moleculeTrend: TrendRow[];
    channelTrend: TrendRow[];
    concentration: Concentration;
    concentrationYear: number;
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

function Bar({ share }: { share: number }) {
  const width = Math.max(0, Math.min(1, share)) * 100;
  return (
    <span aria-hidden="true" className="block h-1.5 w-full rounded-full bg-muted">
      <span className="block h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
    </span>
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
  const { panorama, adoption, spend, evidence, notices, years } = props;
  const yoy = spend.totals.spend2024 === 0
    ? null
    : (spend.totals.spend2025 - spend.totals.spend2024) / Math.abs(spend.totals.spend2024);
  const periodLabel = props.periodLabel;
  const headlineYear = years.length === 1 ? years[0] : 2025;
  const headlineRows = headlineYear === 2024 ? spend.totals.rows2024 : spend.totals.rows2025;
  const hasDistribution = Boolean(panorama.calendar || (panorama.azienda && panorama.azienda.length > 1) || panorama.channels);

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
      <div id="panorama" className="grid scroll-mt-8 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat accent={years.length === 2 || headlineYear === 2024}
              label="Spesa riportata · 2024"
              value={spend.totals.rows2024 === 0 ? "n/o" : formatEur(spend.totals.spend2024)}
              detail={spend.totals.rows2024 === 0
                ? "Nessun record con questi filtri: non è uno zero"
                : `${formatNumber(spend.totals.rows2024, 0)} record · Azienda, canale e molecola selezionati`} />
        <Stat accent={years.length === 2 || headlineYear === 2025}
              label="Spesa riportata · 2025"
              value={spend.totals.rows2025 === 0 ? "n/o" : formatEur(spend.totals.spend2025)}
              detail={spend.totals.rows2025 === 0
                ? "Nessun record con questi filtri: non è uno zero"
                : `${formatNumber(spend.totals.rows2025, 0)} record · Azienda, canale e molecola selezionati`} />
        <Stat label="Variazione · 2024 → 2025"
              value={yoy === null || spend.totals.rows2024 === 0 || spend.totals.rows2025 === 0 ? "n/d" : formatPercent(yoy)}
              detail={yoy === null || spend.totals.rows2024 === 0 || spend.totals.rows2025 === 0
                ? "Confronto non calcolabile: un anno senza record"
                : `${formatEur(spend.totals.spend2025 - spend.totals.spend2024)} · confronto fisso fra i due anni, il filtro anno non si applica · ${props.comparisonLabel}`} />
        <Stat label={`Record · ${years.length === 2 ? "2024 e 2025" : headlineYear}`}
              value={formatNumber(years.length === 2 ? spend.totals.rows2024 + spend.totals.rows2025 : headlineRows, 0)}
              detail="Righe rendicontate, non pazienti" />
      </div>

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
            {" · "}{formatNumber(panorama.totals.rows_n, 0)} record · {formatNumber(panorama.totals.substance_count, 0)} principi attivi
            {" · "}con quantità confrontabile{" "}
            <span className="font-mono text-foreground">
              {panorama.totals.comparable_spend_eur === null || panorama.totals.spend_eur === 0
                ? "n/d" : formatPercent(panorama.totals.comparable_spend_eur / panorama.totals.spend_eur)}
            </span>
            {" "}— la base su cui ogni misura di volume riposa.
          </p>
        )}
        {panorama.calendar && (
          <CalendarHeatmap rows={panorama.calendar}
            title="Spesa mese per mese"
            lead="Ogni mese osservato nel rilascio, sotto i filtri di Azienda, canale e molecola. Il 2026 è presente perché esiste, non perché sia confrontabile: è un anno parziale e nessun suo record ha una quantità confrontabile." />
        )}

        {panorama.azienda && panorama.azienda.length > 1 && (
          <AziendaBars rows={panorama.azienda} years={years} />
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

        <Sub title="In volume · dove la quantità ha un'unità">
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
            <div className="mt-4">
              <UptakeCoverageChart
                withheldShare={adoption.uptake.withheldShare}
                usedSpend={adoption.uptake.usedSpendEur ?? 0}
                withheldSpend={adoption.uptake.withheldSpendEur}
              />
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Gruppi con uptake calcolabile</dt>
                <dd className="font-display mt-1 text-base text-foreground">{formatNumber(adoption.groupCount, 0)}</dd>
                <p className="mt-0.5 text-[11px] text-muted-foreground">(Azienda, principio attivo, via, unità) · {years.length === 2 ? "presenti in almeno uno dei due anni" : String(years[0])}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Spesa trattenuta</dt>
                <dd className="font-display mt-1 text-base text-foreground">{formatEur(adoption.uptake.withheldSpendEur)}</dd>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {adoption.uptake.withheldShare === null ? "quota non calcolabile" : `${formatPercent(adoption.uptake.withheldShare)} del perimetro della misura`}
                  {" · "}{formatNumber(adoption.uptake.withheldRows, 0)} record
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Copertura della misura</dt>
                <dd className="font-display mt-1 text-base text-foreground">
                  {adoption.uptake.withheldShare === null ? "n/d" : formatPercent(1 - adoption.uptake.withheldShare)}
                </dd>
                <p className="mt-0.5 text-[11px] text-muted-foreground">quota utilizzata del perimetro della misura; non riferibile all&apos;intera popolazione</p>
              </div>
            </dl>

            {adoption.volume.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[48rem] text-sm" translate="no">
                  <caption className="sr-only">Uptake in volume per molecola e via di somministrazione</caption>
                  <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Principio attivo</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Via</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Unità</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Aziende</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Quota (intero periodo)</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Quota (dal primo uso)</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Primo uso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {adoption.volume.map((v) => (
                      <tr key={`${v.substance}/${v.route}/${v.unit}`}>
                        <td className="px-4 py-2.5 text-xs text-foreground">{v.substance}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{v.route}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{v.unit}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">{v.aslCount}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="w-20"><Bar share={v.wholePeriod.share ?? 0} /></span>
                            <span className="font-mono text-xs">{v.wholePeriod.share === null ? "n/d" : formatPercent(v.wholePeriod.share)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="w-20"><Bar share={v.window.share ?? 0} /></span>
                            <span className="font-mono text-xs">{v.window.share === null ? "n/d" : formatPercent(v.window.share)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                          {v.firstKey === null ? "mai" : monthKeyLabel(v.firstKey)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

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
                        <tr key={`${w.asl_code}-${w.active_substance}-${w.withheld_reason}-${i}`}>
                          <td className="px-4 py-2.5 text-xs">{props.scope.aslLabels[w.asl_code] ?? w.asl_code}</td>
                          <td className="px-4 py-2.5 text-xs">{w.active_substance}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{w.withheld_reason}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs">{formatNumber(w.rows_n, 0)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs">{w.spend_eur === null ? "n/d" : formatEur(w.spend_eur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        </Sub>
      </Group>

      {/* =============================================================== SPESA */}
      <Group id="spesa" title="La traiettoria nel tempo"
             lead="Due anni con dodici mesi osservati ciascuno, confrontati sullo stesso perimetro. Il confronto usa sempre entrambi gli anni; i filtri di Azienda, canale e molecola si applicano.">
        <ChannelSlopeChart rows={spend.channelTrend} />
        <MoleculeChangeChart rows={spend.moleculeTrend} />
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-primary">Apri le serie numeriche per canale e principio attivo</summary>
          <div className="mt-3 space-y-4">
            <TrendTable caption="Per canale di erogazione" rows={spend.channelTrend} firstColumn="Canale" />
            <TrendTable caption="Per principio attivo · prime 25 voci per spesa 2025" rows={spend.moleculeTrend.slice(0, 25)} firstColumn="Principio attivo"
              footnote={spend.moleculeTrend.length > 25
                ? `Mostrate 25 di ${formatNumber(spend.moleculeTrend.length, 0)} voci. Le voci non mostrate restano incluse in tutti i totali di questa pagina.`
                : undefined} />
          </div>
        </details>

      </Group>

      <Group id="concentrazione" title={`Concentrazione della spesa · ${spend.concentrationYear}`}
             lead="Quanto della spesa del periodo si concentra nei principi attivi più rilevanti, sullo stesso perimetro dei grafici sopra.">
          {spend.concentration.moleculeCount <= 1 ? (
            <Notice tone="info">
              La concentrazione descrive come la spesa si distribuisce fra molecole: con una
              sola molecola selezionata non c&apos;è nulla da concentrare. Togliere il filtro
              per molecola per vederla.
            </Notice>
          ) : (
          <ConcentrationCurve data={spend.concentration} />
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Quota delle prime 5" value={spend.concentration.topFiveShare === null ? "n/d" : formatPercent(spend.concentration.topFiveShare)} />
            <Stat label="Molecole osservate" value={formatNumber(spend.concentration.moleculeCount, 0)} />
            <Stat label="Molecole a saldo negativo" value={formatNumber(spend.concentration.negativeMolecules, 0)} detail="resi e note di credito superiori agli acquisti" />
          </div>
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-primary">Apri la classifica numerica delle prime 25 molecole</summary>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[40rem] text-sm" translate="no">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">#</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Principio attivo</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Spesa {spend.concentrationYear}</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Quota</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Quota cumulata</th>
                    <th className="px-4 py-2.5 text-left font-semibold">&nbsp;</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {spend.concentration.rows.slice(0, 25).map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.rank}</td>
                      <td className="px-4 py-2.5 text-xs text-foreground">{row.label}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{formatEur(row.spend_eur)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{formatPercent(row.share)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{formatPercent(row.cumulativeShare)}</td>
                      <td className="w-32 px-4 py-2.5"><Bar share={row.cumulativeShare} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr>
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5 text-xs font-semibold text-foreground">Totale {formatNumber(spend.concentration.moleculeCount, 0)} molecole</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">{formatEur(spend.concentration.totalEur)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">100,00%</td>
                    <td className="px-4 py-2.5" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </details>
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
                      <td className="px-4 py-3 text-right font-mono text-xs">{stage.shareOfObserved === null ? "n/d" : formatPercent(stage.shareOfObserved)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{stage.droppedRows === 0 ? "—" : `−${formatNumber(stage.droppedRows, 0)}`}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{stage.spend_eur === null ? "n/d" : formatEur(stage.spend_eur)}</td>
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

function TrendTable({
  caption, rows, firstColumn, footnote,
}: { caption: string; rows: TrendRow[]; firstColumn: string; footnote?: string }) {
  const max = rows.reduce((m, r) => Math.max(m, Math.abs(r.spend2025)), 0);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-foreground">{caption}</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[44rem] text-sm" translate="no">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">{firstColumn}</th>
              <th className="px-4 py-2.5 text-right font-semibold">Spesa 2024</th>
              <th className="px-4 py-2.5 text-right font-semibold">Spesa 2025</th>
              <th className="px-4 py-2.5 text-right font-semibold">Variazione €</th>
              <th className="px-4 py-2.5 text-right font-semibold">Variazione %</th>
              <th className="px-4 py-2.5 text-right font-semibold">Record 2025</th>
              <th className="w-32 px-4 py-2.5 text-left font-semibold">&nbsp;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-4 py-2.5 text-xs text-foreground">{row.label}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">{formatEur(row.spend2024)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">{formatEur(row.spend2025)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">{formatEur(row.changeEur)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">{row.change === null ? "n/d" : formatPercent(row.change)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{formatNumber(row.rows2025, 0)}</td>
                <td className="px-4 py-2.5"><Bar share={max === 0 ? 0 : Math.abs(row.spend2025) / max} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && <p className="text-[11px] text-muted-foreground">{footnote}</p>}
    </div>
  );
}
