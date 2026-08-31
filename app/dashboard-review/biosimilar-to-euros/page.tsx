import Link from "next/link";
import { ArrowRight, BadgeEuro, Beaker, CircleGauge, ShieldCheck } from "lucide-react";
import {
  DecisionFrame,
  EmptyState,
  KpiCard,
  MethodologyPanel,
  PageHeader,
  StatusPill,
} from "@/components/dashboard-review/analytics-ui";
import { getBiosimilarComparison } from "@/lib/dashboard-review/queries";
import { formatEur, formatEurPrecise, formatNumber, formatPercent } from "@/lib/dashboard-review/format";

const BASIS = { mg: "mg", packs: "confezioni", spend: "spesa" } as const;

export default async function BiosimilarToEurosPage() {
  const rows = await getBiosimilarComparison();
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
        title="Dalla penetrazione alla materialità economica."
        description="Il radar mette la molecola al centro: esposizione originator, penetrazione biosimilare, costo normalizzato e opportunità osservabile. Nessuna equivalenza clinica viene inferita dal prezzo."
        period={rows[0] ? `Periodo ${rows[0].latest_year}` : "Periodo non disponibile"}
        scope={`${rows.length} molecole osservate`}
      />

      <DecisionFrame
        changed={top ? `${top.active_substance} presenta il segnale economico più rilevante nel periodo.` : "Nessun confronto originator/biosimilare disponibile."}
        variance={top?.biosimilar_penetration !== null && top ? `Per ${top.active_substance} la penetrazione osservata è ${formatPercent(top.biosimilar_penetration!)} su base ${BASIS[top.penetration_basis]}.` : "La penetrazione richiede almeno una misura di volume, confezioni o spesa."}
        materiality={totalSavings > 0 ? `${formatEur(totalSavings)} di differenziale teorico complessivo supportato dai confronti €/mg disponibili.` : "Nessuna opportunità economica normalizzata dimostrabile."}
        nextEvidence={top ? `Verificare per ${top.active_substance}: copertura della normalizzazione, canale, AIC inclusi e validità del mapping originator/biosimilare.` : "Completare il mapping AIC e la normalizzazione del contenuto per confezione."}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard accent label="Opportunità osservabile" value={formatEur(totalSavings)} detail="Differenziale teorico, non risparmio garantito" icon={BadgeEuro} />
        <KpiCard label="Spesa originator" value={formatEur(originatorSpend)} detail={weightedOriginatorShare === null ? "Quota non calcolabile" : `${formatPercent(weightedOriginatorShare)} della spesa nelle molecole mappate`} icon={Beaker} />
        <KpiCard label="Molecole confrontate" value={formatNumber(rows.length, 0)} detail={`${readyRows.length} con evidenza pronta`} icon={CircleGauge} />
        <KpiCard label="Copertura pronta" value={rows.length === 0 ? "—" : formatPercent(readyRows.length / rows.length)} detail="Costo originator e biosimilare normalizzato" icon={ShieldCheck} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nessun confronto disponibile" detail="Servono molecole classificate come originator o biosimilare nel perimetro autorizzato." />
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
