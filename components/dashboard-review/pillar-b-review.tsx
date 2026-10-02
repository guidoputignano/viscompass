// Pillar B review page — evidence funnel, 2024–2025 trends, spend concentration.
//
// Server-rendered throughout. Charts encode the same verified values as the
// audit tables and never introduce a second calculation path. Italian number
// formatting goes through the shared helpers for the reason pinned in
// tests/it-number.test.mjs: `toLocaleString("it-IT")` written inline sets
// minimumGroupingDigits = 2 and produces a server/client mismatch on 4-digit
// values.
//
// WHAT THIS PAGE MAY NOT SHOW, by instruction and because the data does not
// support it:
//   - a package or quantity total of any kind
//   - an uptake figure presented as full-population coverage
//   - a saving, an opportunity, or any recoverable-money figure
//   - 2026 as a year

import { PageHeader } from "@/components/dashboard-review/analytics-ui";
import {
  ChannelSlopeChart, ConcentrationCurve, EvidenceFunnelChart,
  MoleculeChangeChart, UptakeCoverageChart,
} from "@/components/dashboard-review/pillar-b-review-visuals";
import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { CoverageNotice, Concentration, FunnelRow, TrendRow } from "@/lib/dashboard-review/pillar-b/review-data";
import type { UptakeWithWithheld } from "@/lib/dashboard-review/pillar-b/rpc";

export interface PillarBReviewProps {
  releaseId: string;
  funnel: FunnelRow[];
  moleculeTrend: TrendRow[];
  channelTrend: TrendRow[];
  concentration: Concentration;
  uptake: UptakeWithWithheld;
  notices: CoverageNotice[];
  totals: { spend2024: number; spend2025: number; rows2024: number; rows2025: number };
}

const PERIOD_LABEL = "2024 e 2025 · 12 mesi osservati ciascuno";
const MONTHS_OBSERVED_NOTE =
  "«12 mesi osservati» significa che in ciascun mese esiste almeno un record. " +
  "Non certifica che tutti i conferimenti attesi per ASL e canale siano arrivati: " +
  "quella verifica richiede un elenco esterno dei soggetti attesi, che non è disponibile.";

function Section({
  title, lead, children,
}: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg text-foreground">{title}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function Bar({ share }: { share: number }) {
  // Clamped for LAYOUT only. The numeric column beside it always carries the
  // true value, including one above 100%, which negative adjustments produce.
  const width = Math.max(0, Math.min(1, share)) * 100;
  return (
    <span aria-hidden="true" className="block h-1.5 w-full rounded-full bg-muted">
      <span className="block h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
    </span>
  );
}

export function PillarBReview(props: PillarBReviewProps) {
  const { funnel, concentration: conc, uptake, notices, totals } = props;
  const yoy = totals.spend2024 === 0
    ? null
    : (totals.spend2025 - totals.spend2024) / Math.abs(totals.spend2024);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Pillar B · biosimilari ed esclusività"
        title="Biosimilari: evidenza, adozione e spesa"
        description="Spesa e adozione osservate sul perimetro autorizzato. Le date di esclusività legale non sono ancora certificate."
        period={PERIOD_LABEL}
        scope={`Release ${props.releaseId}`}
      />

      <div className="border-b border-border pb-4 text-xs text-muted-foreground">
        <span>DIR_OSP_TRA_003AS · {props.releaseId} · 2026 escluso</span>
        <details className="mt-2 max-w-4xl">
          <summary className="cursor-pointer font-medium text-foreground">Metodo, copertura e rettifiche</summary>
          <div className="mt-2 space-y-2 leading-relaxed">
            <p>{MONTHS_OBSERVED_NOTE}</p>
            <p>Il 2026 copre solo gennaio–maggio e non entra nei confronti 2024–2025.</p>
            {notices.map((n) => <p key={n.label}><strong className="text-foreground">{n.label}:</strong> {n.detail}</p>)}
          </div>
        </details>
      </div>

      {/* ------------------------------------------------ 1. evidence funnel */}
      <Section
        title="1 · Evidenza ed esclusioni"
        lead="Dal totale osservato ai record utilizzabili per il confronto."
      >
        <EvidenceFunnelChart rows={funnel} />
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-primary">Apri il dettaglio dei passaggi, della spesa e dei motivi</summary>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[46rem] text-sm">
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
              {funnel.map((stage) => (
                <tr key={stage.step}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {stage.step}. {stage.stage}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatNumber(stage.rows_n, 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {stage.shareOfObserved === null ? "n/d" : formatPercent(stage.shareOfObserved)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                    {stage.droppedRows === 0 ? "—" : `−${formatNumber(stage.droppedRows, 0)}`}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {stage.spend_eur === null ? "n/d" : formatEur(stage.spend_eur)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{stage.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </details>

        {/* Uptake is shown ONLY beside what it excludes. */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Uptake biosimilare e quota trattenuta
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            L&apos;uptake è calcolato per (ASL, principio attivo, via di
            somministrazione) su una quantità normalizzata, e soltanto dove la base
            della quantità è risolta. La quota trattenuta qui sotto è il complemento
            esatto a livello di record, non di gruppo.
          </p>
          <div className="mt-4">
            <UptakeCoverageChart
              withheldShare={uptake.withheldShare}
              usedSpend={uptake.scope?.spend_eur ?? 0}
              withheldSpend={uptake.withheldSpendEur}
            />
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Gruppi con uptake calcolabile
              </dt>
              <dd className="font-display mt-1 text-base text-foreground">
                {formatNumber(uptake.rows.length, 0)}
              </dd>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Spesa trattenuta
              </dt>
              <dd className="font-display mt-1 text-base text-foreground">
                {formatEur(uptake.withheldSpendEur)}
              </dd>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {uptake.withheldShare === null
                  ? "quota non calcolabile"
                  : `${formatPercent(uptake.withheldShare)} del perimetro della misura`}
                {" · "}
                {formatNumber(uptake.withheldRows, 0)} record
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Copertura della misura
              </dt>
              <dd className="font-display mt-1 text-base text-foreground">
                {uptake.withheldShare === null ? "n/d" : formatPercent(1 - uptake.withheldShare)}
              </dd>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                quota utilizzata del perimetro della misura; non riferibile
                all&apos;intera popolazione
              </p>
            </div>
          </dl>

          {uptake.withheld.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-semibold text-primary">Apri i {formatNumber(uptake.withheld.length, 0)} gruppi trattenuti e i motivi</summary>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">ASL</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Principio attivo</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Motivo</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Record</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Spesa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {uptake.withheld.map((w, i) => (
                    <tr key={`${w.asl_code}-${w.active_substance}-${w.withheld_reason}-${i}`}>
                      <td className="px-4 py-2.5 font-mono text-xs">{w.asl_code}</td>
                      <td className="px-4 py-2.5 text-xs">{w.active_substance}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{w.withheld_reason}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{formatNumber(w.rows_n, 0)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {w.spend_eur === null ? "n/d" : formatEur(w.spend_eur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </details>
          )}
        </div>
      </Section>

      {/* -------------------------------------------------------- 2. trends */}
      <Section
        title="2 · Andamento della spesa 2024–2025"
        lead="Due anni con dodici mesi osservati ciascuno, confrontati sullo stesso perimetro autorizzato."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Spesa 2024</p>
            <p className="font-display mt-1 text-lg text-foreground">{formatEur(totals.spend2024)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatNumber(totals.rows2024, 0)} record
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Spesa 2025</p>
            <p className="font-display mt-1 text-lg text-foreground">{formatEur(totals.spend2025)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatNumber(totals.rows2025, 0)} record
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Variazione</p>
            <p className="font-display mt-1 text-lg text-foreground">
              {yoy === null ? "n/d" : formatPercent(yoy)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatEur(totals.spend2025 - totals.spend2024)} · 12 mesi vs 12 mesi
            </p>
          </div>
        </div>

        <ChannelSlopeChart rows={props.channelTrend} />
        <MoleculeChangeChart rows={props.moleculeTrend} />
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-primary">Apri le serie numeriche per canale e principio attivo</summary>
          <div className="mt-3 space-y-4">
        <TrendTable
          caption="Per canale di erogazione"
          rows={props.channelTrend}
          firstColumn="Canale"
        />
        <TrendTable
          caption="Per principio attivo · prime 25 voci per spesa 2025"
          rows={props.moleculeTrend.slice(0, 25)}
          firstColumn="Principio attivo"
          footnote={
            props.moleculeTrend.length > 25
              ? `Mostrate 25 di ${formatNumber(props.moleculeTrend.length, 0)} voci. ` +
                `Le voci non mostrate restano incluse in tutti i totali di questa pagina.`
              : undefined
          }
        />
          </div>
        </details>
      </Section>

      {/* ------------------------------------------------- 3. concentration */}
      <Section
        title="3 · Concentrazione della spesa"
        lead="Quota cumulata della spesa netta 2025, ordinata per principio attivo."
      >
        <ConcentrationCurve data={conc} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Quota delle prime 5
            </p>
            <p className="font-display mt-1 text-lg text-foreground">
              {conc.topFiveShare === null ? "n/d" : formatPercent(conc.topFiveShare)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Molecole osservate
            </p>
            <p className="font-display mt-1 text-lg text-foreground">
              {formatNumber(conc.moleculeCount, 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Molecole a saldo negativo
            </p>
            <p className="font-display mt-1 text-lg text-foreground">
              {formatNumber(conc.negativeMolecules, 0)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              resi e note di credito superiori agli acquisti
            </p>
          </div>
        </div>

        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-primary">Apri la classifica numerica delle prime 25 molecole</summary>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">#</th>
                <th className="px-4 py-2.5 text-left font-semibold">Principio attivo</th>
                <th className="px-4 py-2.5 text-right font-semibold">Spesa 2025</th>
                <th className="px-4 py-2.5 text-right font-semibold">Quota</th>
                <th className="px-4 py-2.5 text-right font-semibold">Quota cumulata</th>
                <th className="px-4 py-2.5 text-left font-semibold">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {conc.rows.slice(0, 25).map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.rank}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground">{row.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">{formatEur(row.spend_eur)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">{formatPercent(row.share)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {formatPercent(row.cumulativeShare)}
                  </td>
                  <td className="w-32 px-4 py-2.5"><Bar share={row.cumulativeShare} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30">
              <tr>
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5 text-xs font-semibold text-foreground">
                  Totale {formatNumber(conc.moleculeCount, 0)} molecole
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">
                  {formatEur(conc.totalEur)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">100,00%</td>
                <td className="px-4 py-2.5" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        </details>
      </Section>
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
        <table className="w-full min-w-[44rem] text-sm">
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
                <td className="px-4 py-2.5 text-right font-mono text-xs">
                  {row.change === null ? "n/d" : formatPercent(row.change)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                  {formatNumber(row.rows2025, 0)}
                </td>
                <td className="px-4 py-2.5">
                  <Bar share={max === 0 ? 0 : Math.abs(row.spend2025) / max} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && <p className="text-[11px] text-muted-foreground">{footnote}</p>}
    </div>
  );
}
