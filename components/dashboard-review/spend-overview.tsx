import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeEuro,
  CircleAlert,
  ClipboardCheck,
  PackageOpen,
  ReceiptEuro,
} from "lucide-react";
import {
  DecisionFrame,
  Delta,
  EmptyState,
  KpiCard,
  MethodologyPanel,
  StatusPill,
} from "@/components/dashboard-review/analytics-ui";
import { TrendLineChart } from "@/components/dashboard-review/trend-line-chart";
import type { ReviewSeverity, SpendDashboardData } from "@/lib/dashboard-review/types";
import { formatDate, formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import { latestComparison } from "@/lib/dashboard-review/trend";
import { MONTHS_OBSERVED_CAVEAT } from "@/lib/dashboard-review/release-scope";

const REVIEW_STYLE: Record<ReviewSeverity, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  info: "neutral",
};

const BASIS_LABEL = {
  mg: "volume normalizzato in mg",
  packs: "confezioni",
  spend: "spesa",
} as const;

function TrendPanel({ data }: { data: SpendDashboardData }) {
  const trend = data.trend;
  const comparison = latestComparison(trend);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Traiettoria</p>
          <h2 className="font-display mt-1 text-xl">Spesa nel tempo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.trend_granularity === "month" ? `Mesi · ${data.latest_year}` : "Annualità"}
          </p>
        </div>
        {comparison && (
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-foreground">
            {comparison.change >= 0 ? "+" : ""}{formatPercent(comparison.change)} · {comparison.current} vs {comparison.previous}
          </span>
        )}
      </div>
      <div className="mt-6">
        <TrendLineChart
          points={trend.map((point) => ({ label: point.label, spesa: point.spend_eur }))}
          series={[{ key: "spesa", name: "Spesa", color: "hsl(174 66% 40%)" }]}
          format="eur"
          ariaLabel="spesa nel tempo"
          table
          tableLabel={data.trend_granularity === "month" ? "Mese" : "Anno"}
        />
      </div>
    </section>
  );
}

function AtcPanel({ data }: { data: SpendDashboardData }) {
  const items = data.atc_breakdown;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Composizione</p>
      <h2 className="font-display mt-1 text-xl">Dove si concentra la spesa</h2>
      <p className="mt-1 text-xs text-muted-foreground">Categorie principali</p>
      <div className="mt-5 divide-y divide-border">
        {items.map((item) => (
          <Link
            key={item.code}
            href={`/dashboard-review/ricerca?atc1=${encodeURIComponent(item.code)}`}
            className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 py-3 transition-colors hover:bg-secondary/35"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-secondary font-mono text-xs font-bold">{item.code}</span>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-xs font-medium">{item.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{formatPercent(item.share)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${item.share * 100}%` }} />
              </div>
            </div>
            <span className="font-mono text-xs font-semibold">{formatEur(item.spend_eur)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MoleculePanel({ data }: { data: SpendDashboardData }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-end sm:justify-between md:p-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Intelligence per molecola</p>
          <h2 className="font-display mt-1 text-xl">Molecole a maggiore materialità</h2>
        </div>
        <Link href="/dashboard-review/ricerca" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          Esplora la gerarchia <ArrowRight size={13} />
        </Link>
      </div>
      {data.top_molecules.length === 0 ? (
        <div className="p-5"><EmptyState title="Nessuna molecola classificata" detail="I record disponibili non contengono ancora il principio attivo." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Molecola</th>
                <th className="px-5 py-3 text-right font-semibold">Spesa</th>
                <th className="px-5 py-3 text-right font-semibold">Var. a/a</th>
                <th className="px-5 py-3 text-right font-semibold">Penetrazione bio</th>
                <th className="px-5 py-3 text-right font-semibold">Margine (max)</th>
              </tr>
            </thead>
            <tbody>
              {data.top_molecules.map((row) => (
                <tr key={row.active_substance} className="border-b border-border last:border-0 hover:bg-secondary/25">
                  <td className="px-5 py-3.5">
                    <Link href={`/dashboard-review/ricerca?molecule=${encodeURIComponent(row.active_substance)}`} className="font-semibold hover:text-primary">
                      {row.active_substance}
                    </Link>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.atc_code ?? "ATC non disponibile"} · {row.therapeutic_area}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs">{formatEur(row.spend_eur)}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs">{row.spend_yoy === null ? "—" : formatPercent(row.spend_yoy)}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs">{row.biosimilar_penetration === null ? "—" : formatPercent(row.biosimilar_penetration)}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-primary">{row.headroom_eur > 0 ? `≤ ${formatEur(row.headroom_eur)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ReviewQueue({ data }: { data: SpendDashboardData }) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Coda di revisione</p>
          <h2 className="font-display mt-1 text-xl">Evidenze da aprire</h2>
        </div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><ClipboardCheck size={18} /></span>
      </div>
      <div className="mt-5 divide-y divide-border">
        {data.review_items.length === 0 ? (
          <p className="py-5 text-xs text-muted-foreground">Nessun segnale attivo.</p>
        ) : data.review_items.slice(0, 4).map((item) => (
          <Link key={item.id} href={item.href} className="group flex items-start justify-between gap-4 py-3.5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{item.title}</p>
                <StatusPill tone={REVIEW_STYLE[item.severity]}>{item.value_label}</StatusPill>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.context}</p>
            </div>
            <ArrowRight className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" size={15} />
          </Link>
        ))}
      </div>
      <Link href="/dashboard-review/obiettivi" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
        Apri tutte le revisioni <ArrowRight size={13} />
      </Link>
    </section>
  );
}

/**
 * Names the reporting span, what it does not certify, and what it leaves out.
 *
 * Three claims the dashboard was making silently, each raised in review:
 *
 *   - the headline year is the latest with TWELVE MONTHS OBSERVED. That is a
 *     span, not a certification that every ASL/channel submission arrived, so
 *     the caveat is shown rather than the word "completo".
 *   - years with fewer months are EXCLUDED from every figure above. On this
 *     release that is 44,005 rows of 2026 — a quarter of the data, previously
 *     dropped without a word on screen.
 *   - a package total is published only at full coverage; short of that the
 *     card reads n/d, and this line says how far short.
 */
function PeriodNotice({ data }: { data: SpendDashboardData }) {
  const partial = data.partial_years ?? [];
  const incompletePacks =
    data.total_packs === null && data.packs_coverage !== null && data.packs_coverage > 0;
  if (data.latest_year === null && partial.length === 0 && !incompletePacks) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-semibold text-foreground">
          {data.latest_year === null
            ? "Nessun anno con 12 mesi osservati"
            : `Periodo ${data.latest_year} · 12 mesi osservati`}
        </span>
        {data.latest_year !== null && (
          <span>{MONTHS_OBSERVED_CAVEAT}</span>
        )}
      </div>
      {partial.length > 0 && (
        <p className="mt-1.5">
          <span className="font-semibold text-foreground">Esclusi dal confronto:</span>{" "}
          {partial
            .map((y) => `${y.year} (${y.months} ${y.months === 1 ? "mese" : "mesi"} su 12)`)
            .join(", ")}
          . Un anno parziale non è confrontabile con un anno di dodici mesi e non
          entra in nessuna cifra qui sopra.
        </p>
      )}
      {incompletePacks && (
        <p className="mt-1.5">
          <span className="font-semibold text-foreground">Confezioni:</span> dichiarate
          su {formatPercent(data.packs_coverage!)} dei record. Un totale su una parte
          della popolazione non è il totale, quindi non viene pubblicato.
        </p>
      )}
    </div>
  );
}

export function SpendOverview({ data }: { data: SpendDashboardData }) {
  const topAtc = data.atc_breakdown[0];
  const firstReview = data.review_items[0];
  const unresolvedShare = data.unresolved_record_count / data.record_count;
  const latest = latestComparison(data.trend);
  const yoyText = latest === null
    ? "Confronto da attivare"
    : `${latest.change >= 0 ? "+" : ""}${formatPercent(latest.change)} · ${latest.current} vs ${latest.previous}`;

  return (
    <div className="flex flex-col gap-6">
      <DecisionFrame
        changed={yoyText}
        variance={topAtc ? `${topAtc.label}: ${formatPercent(topAtc.share)}` : "ATC da caricare"}
        materiality={data.biosimilar_headroom_eur !== null && data.biosimilar_headroom_eur > 0 ? `Margine ≤ ${formatEur(data.biosimilar_headroom_eur)}` : "€/mg da normalizzare"}
        nextEvidence={firstReview ? firstReview.title : "Carica il primo periodo"}
      />

      <PeriodNotice data={data} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard accent label="Spesa" value={formatEur(data.total_spend_eur)} detail={<Delta value={data.spend_yoy} suffix={data.previous_year ? ` vs ${data.previous_year}` : undefined} />} icon={ReceiptEuro} />
        <KpiCard label="Confezioni" value={data.total_packs === null ? "n/d" : formatNumber(data.total_packs, 0)} detail={data.total_packs === null ? "Base non confermata dalla Regione" : <Delta value={data.packs_yoy} suffix=" confezioni" />} icon={PackageOpen} />
        <KpiCard label="Var. a/a" value={data.spend_yoy === null ? "—" : formatPercent(data.spend_yoy)} detail={data.previous_year ? `vs ${data.previous_year}` : undefined} icon={Activity} />
        <KpiCard label="Margine (limite superiore)" value={data.biosimilar_headroom_eur === null ? "Non calcolabile" : formatEur(data.biosimilar_headroom_eur)} detail={data.biosimilar_headroom_eur === null ? (data.biosimilar_headroom_measurable.molecules === 0 ? "Nessuna molecola del perimetro biosimilare" : "Nessun differenziale €/mg misurabile") : data.biosimilar_penetration === null ? undefined : `${formatPercent(data.biosimilar_penetration)} · ${BASIS_LABEL[data.biosimilar_penetration_basis!]}${data.biosimilar_penetration_basis === "spend" ? " (sottostima il volume)" : ""}`} icon={BadgeEuro} />
        <KpiCard label="Irrisolti" value={formatNumber(data.unresolved_record_count, 0)} detail={formatPercent(unresolvedShare)} icon={CircleAlert} />
        <KpiCard label="Revisioni" value={formatNumber(data.active_review_count, 0)} icon={ClipboardCheck} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
        <TrendPanel data={data} />
        <AtcPanel data={data} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
        <MoleculePanel data={data} />
        <ReviewQueue data={data} />
      </div>

      <MethodologyPanel>
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="font-semibold text-foreground">Definizioni</p><p className="mt-1">Spesa e confezioni sono somme dei record dell’ultima annualità visibile. La variazione usa l’ultima annualità precedente disponibile, senza interpolazioni.</p></div>
          <div><p className="font-semibold text-foreground">Base della penetrazione</p><p className="mt-1">La quota biosimilare usa i mg quando il contenuto è noto su tutte le righe confrontate, altrimenti confezioni, altrimenti spesa. <strong>Su base spesa la quota sottostima sistematicamente il volume</strong>: il biosimilare costa meno per unità, quindi pesa meno in euro di quanto pesi in quantità. Va letta come limite inferiore dell’adozione.</p></div>
          <div><p className="font-semibold text-foreground">Margine, non risparmio</p><p className="mt-1">È il <strong>limite superiore</strong> della sostituzione, non denaro recuperabile: si applica solo ai mesi in cui un biosimilare è stato effettivamente dispensato qui e solo dove i mg sono noti su entrambi i lati. Presuppone sostituibilità clinica integrale, tenuta del prezzo a volumi maggiori e assenza di vincoli contrattuali — condizioni non verificabili da questi dati. Dettaglio e funnel completo in <em>Intelligence biosimilari</em>.</p></div>
          <div><p className="font-semibold text-foreground">Linea dati</p><p className="mt-1">{`${formatNumber(data.record_count, 0)} record, ${formatNumber(data.source_version_count, 0)} versioni fonte. Ultimo caricamento ${data.latest_loaded_at ? formatDate(data.latest_loaded_at) : "non disponibile"}. Copertura €/mg o €/DDD ${data.normalization_coverage === null ? "non calcolabile" : formatPercent(data.normalization_coverage)}.`}</p></div>
        </div>
      </MethodologyPanel>
    </div>
  );
}
