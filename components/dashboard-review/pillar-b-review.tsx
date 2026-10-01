// Pillar B review page — evidence funnel, 2024–2025 trends, spend concentration.
//
// Server-rendered throughout. The magnitude bars are CSS widths over values the
// table already states in full, so nothing is conveyed by the bar alone and
// there is no client-side charting to hydrate or mis-format. Italian number
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

import { AlertTriangle, Info } from "lucide-react";
import { PageHeader, StatusPill } from "@/components/dashboard-review/analytics-ui";
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

function Notices({ notices }: { notices: CoverageNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {notices.map((n) => (
        <div
          key={n.label}
          className={
            "flex gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed " +
            (n.tone === "warning"
              ? "border-amber-500/30 bg-amber-500/10 text-foreground"
              : "border-border/70 bg-muted/40 text-muted-foreground")
          }
        >
          {n.tone === "warning"
            ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
            : <Info size={14} className="mt-0.5 shrink-0" />}
          <p>
            <span className="font-semibold text-foreground">{n.label}:</span> {n.detail}
          </p>
        </div>
      ))}
    </div>
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
        eyebrow="Pillar B · revisione"
        title="Evidenza, esclusioni e spesa"
        description="Spesa osservata sul perimetro autorizzato, con le esclusioni dichiarate riga per riga."
        period={PERIOD_LABEL}
        scope={`Release ${props.releaseId}`}
      />

      {/* Period and source, stated once and applying to every figure below. */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="neutral">Periodo: {PERIOD_LABEL}</StatusPill>
          <StatusPill tone="neutral">Release: {props.releaseId}</StatusPill>
          <StatusPill tone="neutral">Fonte: DIR_OSP_TRA_003AS (NSIS, DM 31/07/2007)</StatusPill>
          <StatusPill tone="warning">2026 escluso</StatusPill>
        </div>
        <p className="mt-3 max-w-4xl text-xs leading-relaxed text-muted-foreground">
          {MONTHS_OBSERVED_NOTE}
        </p>
        <p className="mt-2 max-w-4xl text-xs leading-relaxed text-muted-foreground">
          Il 2026 presente nella release copre cinque mesi (gennaio–maggio) e non
          contiene alcun record idoneo al confronto. Non è mostrato come anno e non
          entra in nessun confronto: cinque mesi contro dodici non sono confrontabili.
        </p>
      </div>

      <Notices notices={notices} />

      {/* ------------------------------------------------ 1. evidence funnel */}
      <Section
        title="1 · Evidenza ed esclusioni"
        lead={
          "Da tutti i record osservati a quelli effettivamente utilizzabili per il " +
          "confronto. Ogni riga dichiara quanti record restano, quanti se ne perdono " +
          "rispetto al passaggio precedente e perché. Le esclusioni sono mostrate, " +
          "non sottintese."
        }
      >
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
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
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
          )}
        </div>
      </Section>

      {/* -------------------------------------------------------- 2. trends */}
      <Section
        title="2 · Andamento della spesa 2024–2025"
        lead={
          "Due anni con dodici mesi osservati ciascuno, confrontabili fra loro. " +
          "La variazione percentuale è calcolata sul valore assoluto del 2024, così " +
          "che una base negativa non inverta il segno rispetto alla variazione in euro " +
          "mostrata accanto. Dove il 2024 è zero la percentuale non esiste e si legge n/d."
        }
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
      </Section>

      {/* ------------------------------------------------- 3. concentration */}
      <Section
        title="3 · Concentrazione della spesa"
        lead={
          "Quanta parte della spesa 2025 è riconducibile a poche molecole. Il " +
          "denominatore è la spesa netta — lo stesso totale della sezione precedente — " +
          "non la somma delle sole voci positive, così che la tabella riconcili con il " +
          "totale di periodo."
        }
      >
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

        <div className="overflow-x-auto rounded-xl border border-border">
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
