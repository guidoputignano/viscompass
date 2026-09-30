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
import { TrendLineChart } from "@/components/dashboard-review/trend-line-chart";
import type { ReviewSeverity, SpendDashboardData } from "@/lib/dashboard-review/types";
import { formatDate, formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import { latestComparison } from "@/lib/dashboard-review/trend";

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

// One internally consistent regional scenario for presentation only. These
// values are deliberately synthetic and remain outside the production facts.
const SYNTHETIC_REGIONAL_TREND = [
  { key: "demo-2023", label: "2023", spend_eur: 1_084_000_000 },
  { key: "demo-2024", label: "2024", spend_eur: 1_161_000_000 },
  { key: "demo-2025", label: "2025", spend_eur: 1_238_000_000 },
];

const DEMO_ATC = [
  {
    code: "L",
    label: "Antineoplastici e immunomodulatori",
    spend_eur: 309_500_000,
    share: 0.25,
  },
  { code: "B", label: "Sangue e organi emopoietici", spend_eur: 179_510_000, share: 0.145 },
  { code: "A", label: "Apparato gastrointestinale", spend_eur: 148_560_000, share: 0.12 },
  { code: "J", label: "Antimicrobici sistemici", spend_eur: 111_420_000, share: 0.09 },
  { code: "N", label: "Sistema nervoso", spend_eur: 86_660_000, share: 0.07 },
];

const DEMO_MOLECULES = [
  { active_substance: "Molecola Alfa", atc_code: "L04XX", therapeutic_area: "Immunologia · specialità da verificare", therapeutic_area_status: "review_required" as const, spend_eur: 34_800_000, spend_yoy: 0.084, biosimilar_penetration: 0.63, headroom_eur: 1_620_000 },
  { active_substance: "Molecola Beta", atc_code: "L01XX", therapeutic_area: "Oncologia / ematologia", therapeutic_area_status: "supported_by_atc" as const, spend_eur: 27_600_000, spend_yoy: -0.031, biosimilar_penetration: 0.78, headroom_eur: 840_000 },
  { active_substance: "Molecola Gamma", atc_code: "B03XX", therapeutic_area: "Ematologia", therapeutic_area_status: "supported_by_atc" as const, spend_eur: 21_400_000, spend_yoy: 0.112, biosimilar_penetration: null, headroom_eur: 0 },
];

const DEMO_REVIEWS: SpendDashboardData["review_items"] = [
  { id: "demo-bio", kind: "biosimilar", title: "Variabilità biosimilare", context: "Scostamento tra aziende", value_label: "6,8 p.p.", href: "/dashboard-review/biosimilar-to-euros", severity: "high" },
  { id: "demo-quality", kind: "quality", title: "Riconciliazione incompleta", context: "Righe da verificare", value_label: "1.876", href: "/dashboard-review/dati", severity: "medium" },
  { id: "demo-upload", kind: "upload", title: "Aggiornamento mensile", context: "Nuovo periodo da riconciliare", value_label: "Pronto", href: "/dashboard-review/dati", severity: "info" },
];

function TrendPanel({ data, demo }: { data: SpendDashboardData; demo: boolean }) {
  const trend = data.trend;
  const comparison = latestComparison(trend);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Traiettoria</p>
          <h2 className="font-display mt-1 text-xl">Spesa nel tempo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {demo ? "Regione sintetica · 2023–2025" : data.trend_granularity === "month" ? `Mesi · ${data.latest_year}` : "Annualità"}
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
          ariaLabel={`${demo ? "Scenario demo · " : ""}spesa nel tempo`}
          table
          tableLabel={data.trend_granularity === "month" ? "Mese" : "Anno"}
        />
      </div>
    </section>
  );
}

function AtcPanel({ data, demo }: { data: SpendDashboardData; demo: boolean }) {
  const items = data.atc_breakdown;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Composizione</p>
      <h2 className="font-display mt-1 text-xl">Dove si concentra la spesa</h2>
      <p className="mt-1 text-xs text-muted-foreground">{demo ? "Regione dimostrativa · dati sintetici 2025" : "Categorie principali"}</p>
      <div className="mt-5 divide-y divide-border">
        {items.map((item) => (
          <Link
            key={item.code}
            href={demo ? "/dashboard-review/dati" : `/dashboard-review/ricerca?atc1=${encodeURIComponent(item.code)}`}
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

export function SpendOverview({ data }: { data: SpendDashboardData }) {
  const demo = data.record_count === 0;
  const displayData: SpendDashboardData = demo
    ? {
        ...data,
        latest_year: 2025,
        total_spend_eur: 1_238_000_000,
        total_packs: 61_800_000,
        record_count: 24_680,
        source_version_count: 3,
        geography_count: 8,
        normalized_record_count: 22_804,
        normalization_eligible_count: 24_680,
        normalization_coverage: 0.924,
        unresolved_record_count: 1_876,
        trend: SYNTHETIC_REGIONAL_TREND,
        atc_breakdown: DEMO_ATC,
        previous_year: 2024,
        spend_yoy: 0.0663221361,
        packs_yoy: 0.018,
        biosimilar_penetration: 0.78,
        biosimilar_penetration_basis: "spend",
        biosimilar_headroom_eur: 8_600_000,
        active_review_count: 6,
        review_items: DEMO_REVIEWS,
        top_molecules: DEMO_MOLECULES,
      }
    : data;
  const topAtc = displayData.atc_breakdown[0];
  const firstReview = displayData.review_items[0];
  const unresolvedShare = displayData.unresolved_record_count / displayData.record_count;
  const latest = latestComparison(displayData.trend);
  const yoyText = latest === null
    ? "Confronto da attivare"
    : `${latest.change >= 0 ? "+" : ""}${formatPercent(latest.change)} · ${latest.current} vs ${latest.previous}`;

  return (
    <div className="flex flex-col gap-6">
      {demo && <TemplateNotice label="Demo regionale" source="Regione dimostrativa · valori interamente sintetici" />}
      <DecisionFrame
        changed={yoyText}
        variance={topAtc ? `${topAtc.label}: ${formatPercent(topAtc.share)}` : "ATC da caricare"}
        materiality={displayData.biosimilar_headroom_eur > 0 ? `Margine ≤ ${formatEur(displayData.biosimilar_headroom_eur)}` : "€/mg da normalizzare"}
        nextEvidence={firstReview ? firstReview.title : "Carica il primo periodo"}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard accent label="Spesa" value={formatEur(displayData.total_spend_eur)} detail={<Delta value={displayData.spend_yoy} suffix={displayData.previous_year ? ` vs ${displayData.previous_year}` : undefined} />} icon={ReceiptEuro} />
        <KpiCard label="Confezioni" value={formatNumber(displayData.total_packs, 0)} detail={<Delta value={displayData.packs_yoy} suffix=" confezioni" />} icon={PackageOpen} />
        <KpiCard label="Var. a/a" value={displayData.spend_yoy === null ? "—" : formatPercent(displayData.spend_yoy)} detail={displayData.previous_year ? `vs ${displayData.previous_year}` : undefined} icon={Activity} />
        <KpiCard label="Margine (limite superiore)" value={formatEur(displayData.biosimilar_headroom_eur)} detail={displayData.biosimilar_penetration === null ? undefined : `${formatPercent(displayData.biosimilar_penetration)} · ${BASIS_LABEL[displayData.biosimilar_penetration_basis!]}${displayData.biosimilar_penetration_basis === "spend" ? " (sottostima il volume)" : ""}`} icon={BadgeEuro} />
        <KpiCard label="Irrisolti" value={formatNumber(displayData.unresolved_record_count, 0)} detail={formatPercent(unresolvedShare)} icon={CircleAlert} />
        <KpiCard label="Revisioni" value={formatNumber(displayData.active_review_count, 0)} icon={ClipboardCheck} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
        <TrendPanel data={displayData} demo={demo} />
        <AtcPanel data={displayData} demo={demo} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
        <MoleculePanel data={displayData} />
        <ReviewQueue data={displayData} />
      </div>

      <MethodologyPanel>
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="font-semibold text-foreground">Definizioni</p><p className="mt-1">Spesa e confezioni sono somme dei record dell’ultima annualità visibile. La variazione usa l’ultima annualità precedente disponibile, senza interpolazioni.</p></div>
          <div><p className="font-semibold text-foreground">Base della penetrazione</p><p className="mt-1">La quota biosimilare usa i mg quando il contenuto è noto su tutte le righe confrontate, altrimenti confezioni, altrimenti spesa. <strong>Su base spesa la quota sottostima sistematicamente il volume</strong>: il biosimilare costa meno per unità, quindi pesa meno in euro di quanto pesi in quantità. Va letta come limite inferiore dell’adozione.</p></div>
          <div><p className="font-semibold text-foreground">Margine, non risparmio</p><p className="mt-1">È il <strong>limite superiore</strong> della sostituzione, non denaro recuperabile: si applica solo ai mesi in cui un biosimilare è stato effettivamente dispensato qui e solo dove i mg sono noti su entrambi i lati. Presuppone sostituibilità clinica integrale, tenuta del prezzo a volumi maggiori e assenza di vincoli contrattuali — condizioni non verificabili da questi dati. Dettaglio e funnel completo in <em>Intelligence biosimilari</em>.</p></div>
          <div><p className="font-semibold text-foreground">Linea dati</p><p className="mt-1">{demo ? "Scenario regionale interamente sintetico. Con i file autorizzati, ogni indicatore conserva versione fonte, periodo e riga di origine." : `${formatNumber(displayData.record_count, 0)} record, ${formatNumber(displayData.source_version_count, 0)} versioni fonte. Ultimo caricamento ${displayData.latest_loaded_at ? formatDate(displayData.latest_loaded_at) : "non disponibile"}. Copertura €/mg o €/DDD ${displayData.normalization_coverage === null ? "non calcolabile" : formatPercent(displayData.normalization_coverage)}.`}</p></div>
        </div>
      </MethodologyPanel>
    </div>
  );
}
