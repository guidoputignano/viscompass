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
  TemplateNotice,
} from "@/components/dashboard-review/analytics-ui";
import type { ReviewSeverity, SpendDashboardData } from "@/lib/dashboard-review/types";
import { formatDate, formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";

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

// Verified figures from the project's National_Profile workbook sheet.
// They are presentation-only and are never merged into organization data.
const TEMPLATE_NATIONAL_TREND = [
  { key: "template-2023", label: "2023", spend_eur: 26_299_621_615.61 },
  { key: "template-2024", label: "2024", spend_eur: 28_100_038_686.97 },
  { key: "template-2025", label: "2025", spend_eur: 29_749_144_556.31 },
];

const TEMPLATE_ATC = [
  {
    code: "L",
    label: "Antineoplastici e immunomodulatori",
    spend_eur: 8_808_129_065.17,
    share: 8_808_129_065.17 / 29_749_144_556.31,
  },
];

function TrendPanel({ data }: { data: SpendDashboardData }) {
  const isTemplate = data.trend.length === 0;
  const trend = isTemplate ? TEMPLATE_NATIONAL_TREND : data.trend;
  const max = Math.max(...trend.map((point) => point.spend_eur), 0);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Traiettoria</p>
          <h2 className="font-display mt-1 text-xl">Spesa nel tempo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {isTemplate ? "Template nazionale · 2023–2025" : data.trend_granularity === "month" ? `Mesi · ${data.latest_year}` : "Annualità"}
          </p>
        </div>
        <Delta value={isTemplate ? 0.0587 : data.spend_yoy} />
      </div>
      <div className="mt-7 flex h-48 items-end gap-3 border-b border-border sm:gap-5">
          {trend.map((point) => {
            const height = max > 0 ? Math.max((point.spend_eur / max) * 100, 3) : 3;
            return (
              <div key={point.key} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
                <span className="mb-2 hidden text-center font-mono text-[9px] text-muted-foreground group-hover:block">
                  {formatEur(point.spend_eur)}
                </span>
                <div
                  className={`w-full rounded-t bg-[hsl(174_55%_42%)] transition-all group-hover:bg-primary ${isTemplate ? "opacity-55" : ""}`}
                  style={{ height: `${height}%` }}
                  title={`${isTemplate ? "Template nazionale · " : ""}${point.label}: ${formatEur(point.spend_eur)}`}
                />
                <span className="mt-2 truncate text-center text-[10px] text-muted-foreground">{point.label}</span>
              </div>
            );
          })}
      </div>
    </section>
  );
}

function AtcPanel({ data }: { data: SpendDashboardData }) {
  const isTemplate = data.atc_breakdown.length === 0;
  const items = isTemplate ? TEMPLATE_ATC : data.atc_breakdown;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Composizione</p>
      <h2 className="font-display mt-1 text-xl">Dove si concentra la spesa</h2>
      <p className="mt-1 text-xs text-muted-foreground">{isTemplate ? "Template nazionale · 2025" : "Categorie principali"}</p>
      <div className="mt-5 divide-y divide-border">
        {items.map((item) => (
          <Link
            key={item.code}
            href={isTemplate ? "/dashboard-review/dati" : `/dashboard-review/ricerca?atc1=${encodeURIComponent(item.code)}`}
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
                <th className="px-5 py-3 text-right font-semibold">Opportunità</th>
              </tr>
            </thead>
            <tbody>
              {data.top_molecules.map((row) => (
                <tr key={row.active_substance} className="border-b border-border last:border-0 hover:bg-secondary/25">
                  <td className="px-5 py-3.5">
                    <Link href={`/dashboard-review/ricerca?molecule=${encodeURIComponent(row.active_substance)}`} className="font-semibold hover:text-primary">
                      {row.active_substance}
                    </Link>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.atc_code ?? "ATC non disponibile"}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs">{formatEur(row.spend_eur)}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs">{row.spend_yoy === null ? "—" : formatPercent(row.spend_yoy)}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs">{row.biosimilar_penetration === null ? "—" : formatPercent(row.biosimilar_penetration)}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-primary">{row.opportunity_eur > 0 ? formatEur(row.opportunity_eur) : "—"}</td>
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

export function SpendOverview({ data }: { data: SpendDashboardData }) {
  const hasData = data.record_count > 0;
  const topAtc = data.atc_breakdown[0];
  const firstReview = data.review_items[0];
  const unresolvedShare = data.record_count > 0 ? data.unresolved_record_count / data.record_count : null;
  const yoyText = data.spend_yoy === null
    ? "Confronto da attivare"
    : `La spesa è ${data.spend_yoy >= 0 ? "aumentata" : "diminuita"} del ${formatPercent(Math.abs(data.spend_yoy))} rispetto al ${data.previous_year}.`;

  return (
    <div className="flex flex-col gap-6">
      {!hasData && <TemplateNotice source="Anteprima con dati pubblici verificati" />}
      <DecisionFrame
        changed={yoyText}
        variance={topAtc ? `${topAtc.label}: ${formatPercent(topAtc.share)}` : "ATC da caricare"}
        materiality={data.biosimilar_opportunity_eur > 0 ? `${formatEur(data.biosimilar_opportunity_eur)} osservabili` : "€/mg da normalizzare"}
        nextEvidence={firstReview ? firstReview.title : "Carica il primo periodo"}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard accent label="Spesa" value={hasData ? formatEur(data.total_spend_eur) : "—"} detail={hasData ? <Delta value={data.spend_yoy} /> : "Da caricare"} icon={ReceiptEuro} />
        <KpiCard label="Confezioni" value={hasData ? formatNumber(data.total_packs, 0) : "—"} detail={hasData ? <Delta value={data.packs_yoy} suffix=" confezioni" /> : "Da caricare"} icon={PackageOpen} />
        <KpiCard label="Var. a/a" value={data.spend_yoy === null ? "—" : formatPercent(data.spend_yoy)} detail={data.previous_year ? `vs ${data.previous_year}` : undefined} icon={Activity} />
        <KpiCard label="Opportunità" value={hasData ? formatEur(data.biosimilar_opportunity_eur) : "—"} detail={data.biosimilar_penetration === null ? undefined : `${formatPercent(data.biosimilar_penetration)} · ${BASIS_LABEL[data.biosimilar_penetration_basis!]}`} icon={BadgeEuro} />
        <KpiCard label="Irrisolti" value={hasData ? formatNumber(data.unresolved_record_count, 0) : "—"} detail={unresolvedShare === null ? undefined : formatPercent(unresolvedShare)} icon={CircleAlert} />
        <KpiCard label="Revisioni" value={hasData ? formatNumber(data.active_review_count, 0) : "—"} icon={ClipboardCheck} />
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
          <div><p className="font-semibold text-foreground">Opportunità</p><p className="mt-1">Il differenziale biosimilare usa il costo effettivo per mg aggregato. In assenza di volume normalizzato il valore economico resta non dimostrato, anche se sono disponibili spesa o confezioni.</p></div>
          <div><p className="font-semibold text-foreground">Linea dati</p><p className="mt-1">{formatNumber(data.record_count, 0)} record, {formatNumber(data.source_version_count, 0)} versioni fonte. Ultimo caricamento {data.latest_loaded_at ? formatDate(data.latest_loaded_at) : "non disponibile"}. Copertura €/mg o €/DDD {data.normalization_coverage === null ? "non calcolabile" : formatPercent(data.normalization_coverage)}.</p></div>
        </div>
      </MethodologyPanel>
    </div>
  );
}
