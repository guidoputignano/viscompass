// Pillar B review page — composition only.
//
// Five groups, one filter bar. Server-rendered throughout. Charts encode the
// same verified values as the audit tables and never introduce a second
// calculation path. Italian number formatting goes through the shared helpers
// for the reason pinned in tests/it-number.test.mjs.
//
//   Panorama   where the money is: calendar, Aziende, channels
//   Adozione   value uptake on two denominators; volume uptake where a unit exists
//   Spesa      year-on-year movement and concentration
//   Evidenza   the funnel and the perimeter: what the measures rest on
//   Limiti     what is not shown, and why, from the frozen workbook's own refusals
//
// WHAT THIS PAGE MAY NOT SHOW, by instruction and because the data does not
// support it:
//   - a package or quantity total of any kind
//   - an uptake figure presented as full-population coverage
//   - a saving, an opportunity, or any recoverable-money figure
//   - 2026 as a year — it appears only as five labelled calendar cells

import { AlertTriangle, Info } from "lucide-react";
import { PageHeader } from "@/components/dashboard-review/analytics-ui";
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
  panorama: {
    totals: FacetTotals | null;
    valueUptake: ValueUptakeView;
    calendar: CalendarRow[] | null;
    azienda: AslBreakdownRow[] | null;
    channels: ChannelMixRow[] | null;
  };
  adoption: {
    valueUptakeSection: React.ReactNode;
    uptake: UptakeWithWithheld;
    volume: VolumeBreakdownRow[];
    /** Which filters the volume measure could not honour. */
    note: string | null;
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
  };
  notices: CoverageNotice[];
}

const GROUPS = [
  { id: "panorama", label: "Panorama" },
  { id: "adozione", label: "Adozione" },
  { id: "spesa", label: "Spesa" },
  { id: "evidenza", label: "Evidenza" },
  { id: "limiti", label: "Limiti" },
] as const;

const MONTHS_OBSERVED_NOTE =
  "«12 mesi osservati» significa che in ciascun mese esiste almeno un record. " +
  "Non certifica che tutti i conferimenti attesi per ASL e canale siano arrivati: " +
  "quella verifica richiede un elenco esterno dei soggetti attesi, che non è disponibile.";

function Group({
  id, title, lead, children,
}: { id: string; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-40 flex-col gap-4">
      <div>
        <h2 className="font-display text-lg text-foreground">{title}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value, detail, accent }: { label: string; value: string; detail?: string; accent?: boolean }) {
  return (
    <div className={"rounded-xl border p-4 " + (accent ? "border-primary/30 bg-primary/5" : "border-border bg-card")}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-lg text-foreground">{value}</p>
      {detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>}
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
  const vu = panorama.valueUptake;
  const held = vu.boundary.total + vu.unknown.total + vu.outside.total;
  const periodLabel = years.length === 2 ? "2024 e 2025 · 12 mesi osservati ciascuno" : `${years[0]} · 12 mesi osservati`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Pillar B · biosimilari ed esclusività"
        title="Biosimilari: evidenza, adozione e spesa"
        description={`Spesa e adozione osservate su ${props.scope.perimeterLabel}. Le date di esclusività legale non sono certificate.`}
        period={periodLabel}
        scope={`Release ${props.releaseId}`}
      />

      {props.scope.reviewerScopeUnavailable && (
        <Notice tone="warning">
          Accesso revisore riconosciuto, ma la lettura estesa non è disponibile in questo
          ambiente: i dati mostrati restano limitati al perimetro della tua organizzazione.
          Non interpretare questa pagina come l&apos;intero rilascio.
        </Notice>
      )}

      {props.filterBar}

      <nav aria-label="Sezioni" className="flex flex-wrap gap-1.5 text-xs">
        {GROUPS.map((g) => (
          <a key={g.id} href={`#${g.id}`}
             className="rounded-full border border-border bg-card px-3 py-1 font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground">
            {g.label}
          </a>
        ))}
      </nav>

      {props.degraded.length > 0 && (
        <Notice tone="warning">
          <p className="font-semibold text-foreground">Alcune viste usano una funzione non ancora pubblicata sul database.</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {props.degraded.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </Notice>
      )}

      {/* ============================================================ PANORAMA */}
      <Group id="panorama" title="Panorama"
             lead="Dove sta il denaro nel perimetro selezionato, e quanto di quello sostituibile è già su biosimilare.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Spesa rendicontata"
                value={panorama.totals?.spend_eur == null ? "n/d" : formatEur(panorama.totals.spend_eur)}
                detail={panorama.totals ? `${formatNumber(panorama.totals.rows_n, 0)} record · ${formatNumber(panorama.totals.substance_count, 0)} molecole` : "richiede la migrazione 20261003090000"} />
          <Stat label="Di cui con quantità confrontabile"
                value={panorama.totals?.spend_eur && panorama.totals.comparable_spend_eur !== null
                  ? formatPercent(panorama.totals.comparable_spend_eur / panorama.totals.spend_eur) : "n/d"}
                detail="la base su cui ogni misura di volume riposa" />
          <Stat label="Quota biosimilare · validità riconosciuta"
                value={vu.dateValid.share === null ? "n/d" : formatPercent(vu.dateValid.share)}
                detail={`su ${formatEur(vu.dateValid.denominator)} nel perimetro`} />
          <Stat accent label="Quota biosimilare · osservato qui"
                value={vu.locallyObserved.share === null ? "n/d" : formatPercent(vu.locallyObserved.share)}
                detail={held > 0 ? `${formatEur(held)} fuori da entrambe le misure` : undefined} />
        </div>

        {panorama.calendar && (
          <CalendarHeatmap rows={panorama.calendar}
            title="Spesa mese per mese"
            lead="Ogni mese osservato nel rilascio, sotto i filtri di Azienda, canale e molecola. Il 2026 è presente perché esiste, non perché sia confrontabile: cinque mesi senza alcun record con quantità confrontabile." />
        )}

        {panorama.azienda && panorama.azienda.length > 1 && (
          <AziendaBars rows={panorama.azienda} years={years} />
        )}

        {panorama.channels && <ChannelStack rows={panorama.channels} years={years} />}
      </Group>

      {/* ============================================================ ADOZIONE */}
      <Group id="adozione" title="Adozione dei biosimilari"
             lead="La domanda che questa sezione sostiene è: dove esiste un'alternativa e non viene usata? Prima in valore, poi — solo dove la quantità ha un'unità — in volume.">
        <Sub title="In valore · due denominatori, mai uno solo">
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Una quota di <strong>denaro</strong>, non di pazienti: un biosimilare costa
            meno per unità, quindi la quota di spesa <strong>sottostima</strong> la quota
            di trattamenti.
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
              {adoption.note && <> <strong className="text-foreground">{adoption.note}</strong></>}
            </p>
            <div className="mt-4">
              <UptakeCoverageChart
                withheldShare={adoption.uptake.withheldShare}
                usedSpend={adoption.uptake.scope?.spend_eur ?? 0}
                withheldSpend={adoption.uptake.withheldSpendEur}
              />
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Gruppi con uptake calcolabile</dt>
                <dd className="font-display mt-1 text-base text-foreground">{formatNumber(adoption.uptake.rows.length, 0)}</dd>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
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
                  Apri i {formatNumber(adoption.uptake.withheld.length, 0)} gruppi trattenuti e i motivi
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
      <Group id="spesa" title="Andamento e concentrazione della spesa"
             lead="Due anni con dodici mesi osservati ciascuno, confrontati sullo stesso perimetro. Il confronto usa sempre entrambi gli anni; i filtri di Azienda, canale e molecola si applicano.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Spesa 2024" value={formatEur(spend.totals.spend2024)} detail={`${formatNumber(spend.totals.rows2024, 0)} record`} />
          <Stat label="Spesa 2025" value={formatEur(spend.totals.spend2025)} detail={`${formatNumber(spend.totals.rows2025, 0)} record`} />
          <Stat label="Variazione" value={yoy === null ? "n/d" : formatPercent(yoy)}
                detail={`${formatEur(spend.totals.spend2025 - spend.totals.spend2024)} · 12 mesi vs 12 mesi`} />
        </div>
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

        <Sub title={`Concentrazione · ${spend.concentrationYear}`}>
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
        </Sub>
      </Group>

      {/* ============================================================ EVIDENZA */}
      <Group id="evidenza" title="Evidenza ed esclusioni"
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
      </Group>

      {/* ============================================================== LIMITI */}
      <Group id="limiti" title="Limiti: cosa questa pagina non mostra, e perché"
             lead="Le rinunce del workbook congelato (fogli 22 e 24), riportate tali e quali. Omettere queste righe renderebbe ogni altra cifra più forte di quanto l'evidenza la sostenga.">
        <div className="grid gap-3 md:grid-cols-2">
          <Notice tone="info"><strong className="text-foreground">Nessuna previsione (B10).</strong> Un backtest a origine mobile su 11 orizzonti non ha battuto il livello costante. Il livello viene portato avanti invariato; non è una previsione.</Notice>
          <Notice tone="info"><strong className="text-foreground">Nessuna attribuzione causale (B12).</strong> Nessun intervento datato è registrato nei dati; senza un disegno non c&apos;è effetto da stimare.</Notice>
          <Notice tone="info"><strong className="text-foreground">Nessuna cifra di risparmio (B14).</strong> Ogni «opportunità» è un limite superiore sotto quattro assunzioni non verificate. La dispersione di prezzo fra Aziende (B07) è dispersione osservata, non denaro recuperabile.</Notice>
          <Notice tone="info"><strong className="text-foreground">Nessuna classifica fra Aziende (B09).</strong> La graduatoria grezza misura cosa è stato comprato; standardizzata, le differenze non sono stabili. Il case-mix non è controllabile: ATC assente sul rilascio.</Notice>
          <Notice tone="info"><strong className="text-foreground">Nessun totale di confezioni.</strong> La base della quantità è confezioni, unità, mista e ignota nello stesso rilascio. Una somma fra basi non ha unità.</Notice>
          <Notice tone="info"><strong className="text-foreground">Il 2026 non è un anno.</strong> Cinque mesi osservati, zero record con quantità confrontabile. Compare nel calendario, segnalato; non entra in nessun confronto.</Notice>
          <Notice tone="info"><strong className="text-foreground">La spesa è lorda.</strong> IVA inclusa, al lordo di payback e note di credito di registro. Non è un prezzo netto, né un prezzo di riferimento AIFA.</Notice>
          <Notice tone="info"><strong className="text-foreground">«Anni senza concorrenza» non è esclusività legale.</strong> B15 pubblica un limite superiore fra autorizzazione EU del riferimento e del primo biosimilare; nessuna scadenza brevettuale o SPC è evidenziata.</Notice>
        </div>

        <div className="border-t border-border pt-4 text-xs text-muted-foreground">
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
