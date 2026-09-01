import Link from "next/link";
import { ArrowRight, BadgeEuro, Beaker, CircleGauge, ShieldCheck } from "lucide-react";
import {
  DecisionFrame,
  KpiCard,
  MethodologyPanel,
  PageHeader,
  StatusPill,
  TemplateNotice,
} from "@/components/dashboard-review/analytics-ui";
import { getBiosimilarComparison } from "@/lib/dashboard-review/queries";
import { formatEur, formatEurPrecise, formatNumber, formatPercent } from "@/lib/dashboard-review/format";

const BASIS = { mg: "mg", packs: "confezioni", spend: "spesa" } as const;

export default async function BiosimilarToEurosPage() {
  const rows = await getBiosimilarComparison();
  const isTemplate = rows.length === 0;
  const totalSavings = rows.reduce((sum, row) => sum + row.potential_savings_eur, 0);
  const originatorSpend = rows.reduce((sum, row) => sum + row.originator_spend_eur, 0);
  const readyRows = rows.filter((row) => row.evidence_status === "ready");
  const top = rows[0];
  const weightedOriginatorShare = rows.reduce((sum, row) => sum + row.originator_spend_eur + row.biosimilar_spend_eur, 0) > 0
    ? originatorSpend / rows.reduce((sum, row) => sum + row.originator_spend_eur + row.biosimilar_spend_eur, 0)
    : null;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Intelligence biosimilari"
        title="Penetrazione, costo, opportunità."
        description="Confronti economici normalizzati, molecola per molecola."
        period={rows[0] ? `Periodo ${rows[0].latest_year}` : "Periodo non disponibile"}
        scope={`${rows.length} molecole osservate`}
      />

      {isTemplate ? (
        <TemplateNotice source="Abruzzo · eritropoietina · 2025" />
      ) : (
        <DecisionFrame
          changed={top ? `${top.active_substance} guida il segnale` : "Nessun confronto"}
          variance={top?.biosimilar_penetration !== null && top ? `${formatPercent(top.biosimilar_penetration!)} · ${BASIS[top.penetration_basis]}` : "Penetrazione da calcolare"}
          materiality={totalSavings > 0 ? `${formatEur(totalSavings)} osservabili` : "€/mg da completare"}
          nextEvidence={top ? `Verifica ${top.active_substance}` : "Completa il mapping AIC"}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isTemplate ? (
          <>
            <KpiCard accent label="Penetrazione" value={formatPercent(67_894 / (67_894 + 6_355))} detail="BINOCRIT vs EPREX" icon={BadgeEuro} />
            <KpiCard label="Spesa biosim." value={formatEur(2_759_668.27)} icon={Beaker} />
            <KpiCard label="Spesa originator" value={formatEur(548_476.54)} icon={CircleGauge} />
            <KpiCard label="ASL" value="4" icon={ShieldCheck} />
          </>
        ) : (
          <>
            <KpiCard accent label="Opportunità" value={formatEur(totalSavings)} icon={BadgeEuro} />
            <KpiCard label="Spesa originator" value={formatEur(originatorSpend)} detail={weightedOriginatorShare === null ? undefined : formatPercent(weightedOriginatorShare)} icon={Beaker} />
            <KpiCard label="Molecole" value={formatNumber(rows.length, 0)} detail={`${readyRows.length} pronte`} icon={CircleGauge} />
            <KpiCard label="Copertura" value={formatPercent(readyRows.length / rows.length)} icon={ShieldCheck} />
          </>
        )}
      </div>

      {isTemplate ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Esempio</p><h2 className="mt-1 text-xl font-semibold">Biosimilare vs originator</h2></div>
            <Link href="/dashboard-review/dati" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Carica dati <ArrowRight size={13} /></Link>
          </div>
          <div className="mt-7 space-y-5">
            <div><div className="mb-2 flex justify-between text-xs"><span>BINOCRIT</span><span className="font-semibold">67.894 confezioni</span></div><div className="h-3 rounded-full bg-secondary"><div className="h-full w-[91.4%] rounded-full bg-primary" /></div></div>
            <div><div className="mb-2 flex justify-between text-xs"><span>EPREX</span><span className="font-semibold">6.355 confezioni</span></div><div className="h-3 rounded-full bg-secondary"><div className="h-full w-[8.6%] rounded-full bg-slate-300" /></div></div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5 md:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Radar molecolare</p>
            <h2 className="font-display mt-1 text-xl">Priorità per opportunità normalizzata</h2>
            <p className="mt-1 text-xs text-muted-foreground">Le righe irrisolte restano visibili, ma non producono una stima economica.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Molecola</th><th className="px-5 py-3 font-semibold">Evidenza</th><th className="px-5 py-3 text-right font-semibold">Penetrazione</th><th className="px-5 py-3 text-right font-semibold">Originator €/mg</th><th className="px-5 py-3 text-right font-semibold">Biosimilare €/mg</th><th className="px-5 py-3 text-right font-semibold">Spesa originator</th><th className="px-5 py-3 text-right font-semibold">Opportunità</th><th className="px-5 py-3 font-semibold" />
              </tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.active_substance} className="border-b border-border last:border-0 hover:bg-secondary/25">
                    <td className="px-5 py-4"><p className="font-semibold">{row.active_substance}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.atc4 ?? "ATC non disponibile"}</p></td>
                    <td className="px-5 py-4"><StatusPill tone={row.evidence_status === "ready" ? "positive" : row.evidence_status === "partial" ? "warning" : "danger"}>{row.evidence_status === "ready" ? "Pronta" : row.evidence_status === "partial" ? "Parziale" : "Irrisolta"}</StatusPill><p className="mt-1 text-[10px] text-muted-foreground">Copertura {row.normalization_coverage === null ? "—" : formatPercent(row.normalization_coverage)}</p></td>
                    <td className="px-5 py-4 text-right"><p className="font-mono text-xs">{row.biosimilar_penetration === null ? "—" : formatPercent(row.biosimilar_penetration)}</p><p className="mt-0.5 text-[10px] text-muted-foreground">base {BASIS[row.penetration_basis]}</p></td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{row.originator_cost_per_mg === null ? "—" : formatEurPrecise(row.originator_cost_per_mg, 4)}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{row.biosimilar_cost_per_mg === null ? "—" : formatEurPrecise(row.biosimilar_cost_per_mg, 4)}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{formatEur(row.originator_spend_eur)}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs font-semibold text-primary">{row.potential_savings_eur > 0 ? formatEur(row.potential_savings_eur) : "—"}</td>
                    <td className="px-5 py-4"><Link href={`/dashboard-review/ricerca?molecule=${encodeURIComponent(row.active_substance)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Dettaglio <ArrowRight size={12} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <MethodologyPanel>
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="font-semibold text-foreground">Penetrazione</p><p className="mt-1">Usa, in ordine, mg normalizzati, confezioni o spesa. La base è mostrata per ogni molecola per evitare confronti tra denominatori diversi.</p></div>
          <div><p className="font-semibold text-foreground">Costo comparabile</p><p className="mt-1">€/mg = spesa aggregata ÷ contenuto totale dispensato. Il contenuto deriva da unità per confezione × forza × confezioni, oppure dal costo/mg già validato.</p></div>
          <div><p className="font-semibold text-foreground">Opportunità</p><p className="mt-1">Spesa originator × (1 − costo/mg biosimilare ÷ costo/mg originator), solo quando entrambi i costi sono disponibili e il biosimilare risulta meno costoso.</p></div>
        </div>
      </MethodologyPanel>
    </div>
  );
}
