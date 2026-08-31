import {
  CalendarRange,
  CircleAlert,
  Database,
  Package,
  ReceiptEuro,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { SpendDashboardData } from "@/lib/dashboard-review/types";
import {
  formatDate,
  formatEur,
  formatEurPrecise,
  formatNumber,
  formatPercent,
} from "@/lib/dashboard-review/format";

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  primary = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ReceiptEuro;
  primary?: boolean;
}) {
  return (
    <article
      className={
        "relative overflow-hidden rounded-xl border p-5 shadow-sm " +
        (primary
          ? "border-[hsl(174_45%_28%)] bg-[hsl(174_46%_24%)] text-white"
          : "border-border bg-card text-card-foreground")
      }
    >
      <div
        className={
          "mb-5 flex size-9 items-center justify-center rounded-lg " +
          (primary ? "bg-white/10 text-[hsl(78_75%_60%)]" : "bg-secondary text-primary")
        }
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
      </div>
      <p
        className={
          "text-[11px] font-semibold uppercase tracking-[0.12em] " +
          (primary ? "text-white/65" : "text-muted-foreground")
        }
      >
        {label}
      </p>
      <p className="font-display mt-1 text-3xl leading-none">{value}</p>
      <p className={"mt-3 text-xs " + (primary ? "text-white/70" : "text-muted-foreground")}>
        {detail}
      </p>
      {primary && (
        <span className="absolute -bottom-16 -right-12 size-40 rounded-full border border-white/10" />
      )}
    </article>
  );
}

function SpendTrend({ data }: { data: SpendDashboardData }) {
  const max = Math.max(...data.trend.map((point) => point.spend_eur), 0);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Traiettoria osservata
          </p>
          <h2 className="font-display mt-1 text-xl text-foreground">Andamento della spesa</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.trend_granularity === "month"
              ? `Valori mensili ${data.latest_year ?? ""}`
              : "Confronto tra annualità disponibili"}
          </p>
        </div>
        <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:mt-0">
          <Database aria-hidden="true" size={12} /> Dati nel perimetro RLS
        </span>
      </div>

      {data.trend.length === 0 ? (
        <div className="mt-6 flex h-52 items-center justify-center rounded-lg bg-secondary/40 text-sm text-muted-foreground">
          Nessuna serie temporale disponibile.
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between gap-4 text-[11px] text-muted-foreground">
            <span>
              Picco osservato <strong className="font-mono text-foreground">{formatEur(max)}</strong>
            </span>
            <span className="hidden sm:inline">Passa sulle barre per il valore puntuale</span>
          </div>
          <div className="mt-3 flex h-52 items-end gap-2 border-b border-border sm:gap-3">
            {data.trend.map((point) => {
              const height = max > 0 ? Math.max((point.spend_eur / max) * 100, 3) : 3;
              return (
                <div key={point.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                  <div
                    className="w-full rounded-t-md bg-[hsl(var(--chart-1))] transition-opacity hover:opacity-80"
                    style={{ height: `${height}%` }}
                    role="img"
                    aria-label={`${point.label}: ${formatEur(point.spend_eur)}`}
                    title={`${point.label}: ${formatEur(point.spend_eur)}`}
                  />
                  <span className="mt-2 text-center text-[10px] text-muted-foreground">
                    <span className="sm:hidden">
                      {data.trend_granularity === "month" ? point.label.slice(0, 1) : point.label}
                    </span>
                    <span className="hidden sm:inline">{point.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function AtcComposition({ data }: { data: SpendDashboardData }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
        Mix terapeutico
      </p>
      <h2 className="font-display mt-1 text-xl text-foreground">Categorie ATC principali</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Quota della spesa osservata nel periodo più recente
      </p>

      {data.atc_breakdown.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nessuna categoria ATC disponibile.</p>
      ) : (
        <div className="mt-5 divide-y divide-border">
          {data.atc_breakdown.map((item) => (
            <div key={item.code} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-secondary font-mono text-xs font-bold text-foreground">
                {item.code}
              </span>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-xs font-medium text-foreground">{item.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatPercent(item.share)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${item.share * 100}%` }} />
                </div>
              </div>
              <strong className="font-mono text-xs text-foreground">{formatEur(item.spend_eur)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EvidencePanel({ data }: { data: SpendDashboardData }) {
  const coverageLabel =
    data.normalization_coverage === null ? "Non calcolabile" : formatPercent(data.normalization_coverage);

  return (
    <section className="rounded-xl border border-[hsl(174_28%_82%)] bg-[hsl(165_30%_96%)] p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
            <ShieldCheck aria-hidden="true" size={19} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Stato dell&apos;evidenza
            </p>
            <h2 className="mt-1 text-sm font-semibold text-foreground">
              Perimetro autenticato, indicatori riconciliabili alla fonte
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Ogni valore deriva esclusivamente dai record visibili all&apos;organizzazione. Nessun dato
              paziente e nessuna raccomandazione clinica sono utilizzati.
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Record</dt>
            <dd className="mt-1 font-mono font-semibold text-foreground">
              {formatNumber(data.record_count, 0)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Versioni fonte</dt>
            <dd className="mt-1 font-mono font-semibold text-foreground">
              {formatNumber(data.source_version_count, 0)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Copertura €/mg o €/DDD</dt>
            <dd className="mt-1 font-mono font-semibold text-foreground">{coverageLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ultimo caricamento</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {data.latest_loaded_at ? formatDate(data.latest_loaded_at) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      {data.unresolved_record_count > 0 && (
        <div className="mt-5 flex items-start gap-2 border-t border-[hsl(174_28%_85%)] pt-4 text-xs text-muted-foreground">
          <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-[hsl(38_72%_42%)]" size={15} />
          <p>
            <strong className="text-foreground">
              {formatNumber(data.unresolved_record_count, 0)} record da verificare.
            </strong>{" "}
            Restano nella coda di normalizzazione e non vengono presentati come confronto economico
            risolto.
          </p>
        </div>
      )}
    </section>
  );
}

export function SpendOverview({ data }: { data: SpendDashboardData }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          primary
          label="Spesa osservata"
          value={formatEur(data.total_spend_eur)}
          detail={data.latest_year ? `Ultima annualità completa: ${data.latest_year}` : "Nessun periodo disponibile"}
          icon={ReceiptEuro}
        />
        <MetricCard
          label="Confezioni"
          value={formatNumber(data.total_packs, 0)}
          detail={`${formatNumber(data.record_count, 0)} record nel perimetro`}
          icon={Package}
        />
        <MetricCard
          label="Costo medio per confezione"
          value={data.cost_per_pack_eur === null ? "—" : formatEurPrecise(data.cost_per_pack_eur)}
          detail="Rapporto descrittivo, non confronto terapeutico"
          icon={Scale}
        />
        <MetricCard
          label="Copertura normalizzazione"
          value={
            data.normalization_coverage === null ? "—" : formatPercent(data.normalization_coverage)
          }
          detail={`${formatNumber(data.normalized_record_count, 0)} di ${formatNumber(data.normalization_eligible_count, 0)} record eleggibili`}
          icon={CalendarRange}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.85fr)]">
        <SpendTrend data={data} />
        <AtcComposition data={data} />
      </div>

      <EvidencePanel data={data} />
    </>
  );
}
