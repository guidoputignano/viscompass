import Link from "next/link";
import { ArrowRight, Boxes, Layers3, PackageSearch, ReceiptEuro, RotateCcw } from "lucide-react";
import {
  DecisionFrame,
  EmptyState,
  KpiCard,
  MethodologyPanel,
  PageHeader,
} from "@/components/dashboard-review/analytics-ui";
import { getExplorerData } from "@/lib/dashboard-review/queries";
import type { ExplorerFilters } from "@/lib/dashboard-review/types";
import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";

function scalar(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length <= 160 ? value : undefined;
}

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters: ExplorerFilters = {
    asl: scalar(params.asl),
    atc1: scalar(params.atc1),
    atc2: scalar(params.atc2),
    atc3: scalar(params.atc3),
    atc4: scalar(params.atc4),
    atc5: scalar(params.atc5),
    molecule: scalar(params.molecule),
  };
  const data = await getExplorerData(filters);
  const largest = data.nodes[0];
  const fastest = [...data.nodes]
    .filter((node) => node.spend_yoy !== null)
    .sort((a, b) => Math.abs(b.spend_yoy!) - Math.abs(a.spend_yoy!))[0];
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Esploratore gerarchico"
        title="Dalla Regione alla singola confezione AIC."
        description="Segui la stessa struttura in ogni analisi: territorio, classificazione ATC, molecola e prodotto. Ogni livello mantiene spesa, consumo, variazione e qualità della normalizzazione."
        period={data.latest_year ? `Periodo ${data.latest_year}` : "Periodo non disponibile"}
        scope={`${data.level_label} · ${data.nodes.length} voci`}
      />

      <DecisionFrame
        changed={fastest ? `${fastest.label} ha la variazione più ampia nel livello corrente: ${formatPercent(fastest.spend_yoy!)}.` : "Nessun periodo precedente confrontabile per questo livello."}
        variance={largest ? `${largest.label} concentra il ${formatPercent(largest.spend_share)} della spesa nel perimetro selezionato.` : "Nessuna voce disponibile nel percorso selezionato."}
        materiality={largest ? `${formatEur(largest.spend_eur)} osservati nella voce principale.` : "Materialità non calcolabile."}
        nextEvidence={largest?.href ? `Aprire ${largest.label} per il livello successivo.` : "Livello AIC: verificare mapping e costo."}
      />

      <nav aria-label="Percorso di esplorazione" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs">
        {data.breadcrumbs.map((item, index) => (
          <span key={`${item.href}-${index}`} className="flex items-center gap-2">
            {index > 0 && <ArrowRight size={12} className="text-muted-foreground" />}
            <Link href={item.href} className={index === data.breadcrumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground hover:text-primary"}>{item.label}</Link>
          </span>
        ))}
        {activeFilterCount > 0 && <Link href="/dashboard-review/ricerca" className="ml-auto inline-flex items-center gap-1 font-semibold text-primary"><RotateCcw size={12} /> Ricomincia</Link>}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard accent label="Spesa nel nodo" value={formatEur(data.total_spend_eur)} detail="Somma del percorso selezionato" icon={ReceiptEuro} />
        <KpiCard label="Consumo" value={formatNumber(data.total_packs, 0)} detail="Confezioni osservate" icon={PackageSearch} />
        <KpiCard label="Livello corrente" value={data.level_label} detail={`${activeFilterCount} filtri gerarchici attivi`} icon={Layers3} />
        <KpiCard label="Voci confrontate" value={formatNumber(data.nodes.length, 0)} detail="Ordinate per spesa decrescente" icon={Boxes} />
      </div>

      {data.nodes.length === 0 ? (
        <EmptyState title="Nessun record nel percorso" detail="Torna al livello precedente oppure rimuovi i filtri. Nessun valore è stato stimato per colmare l’assenza." />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5 md:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Livello corrente · {data.level_label}</p>
            <h2 className="font-display mt-1 text-xl">Composizione del nodo selezionato</h2>
            <p className="mt-1 text-xs text-muted-foreground">Seleziona una riga per continuare il drill-down. Al livello AIC il percorso termina.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-3 font-semibold">{data.level_label}</th><th className="px-5 py-3 text-right font-semibold">Spesa</th><th className="px-5 py-3 text-right font-semibold">Quota</th><th className="px-5 py-3 text-right font-semibold">Confezioni</th><th className="px-5 py-3 text-right font-semibold">Var. a/a</th><th className="px-5 py-3 text-right font-semibold">Penetrazione bio</th><th className="px-5 py-3 text-right font-semibold">Copertura norm.</th><th className="px-5 py-3" />
              </tr></thead>
              <tbody>
                {data.nodes.map((node) => (
                  <tr key={node.key} className="border-b border-border last:border-0 hover:bg-secondary/25">
                    <td className="px-5 py-4"><p className="font-semibold">{node.label}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{node.code} · {formatNumber(node.record_count, 0)} record</p></td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{formatEur(node.spend_eur)}</td>
                    <td className="px-5 py-4 text-right"><div className="ml-auto flex w-28 items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${node.spend_share * 100}%` }} /></div><span className="w-10 text-right font-mono text-[10px]">{formatPercent(node.spend_share)}</span></div></td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{formatNumber(node.packs, 0)}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{node.spend_yoy === null ? "—" : formatPercent(node.spend_yoy)}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{node.biosimilar_penetration === null ? "—" : formatPercent(node.biosimilar_penetration)}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{node.normalization_coverage === null ? "—" : formatPercent(node.normalization_coverage)}</td>
                    <td className="px-5 py-4">{node.href ? <Link href={node.href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Apri <ArrowRight size={12} /></Link> : <span className="text-[10px] text-muted-foreground">Livello finale</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <MethodologyPanel>
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="font-semibold text-foreground">Gerarchia</p><p className="mt-1">Regione → ASL → ATC1 → ATC2 → ATC3 → ATC4 → ATC5 → principio attivo → AIC. I livelli territoriali già fissati dal profilo non vengono ripetuti.</p></div>
          <div><p className="font-semibold text-foreground">Confrontabilità</p><p className="mt-1">La variazione usa lo stesso nodo nell’ultima annualità precedente disponibile. I record non classificati restano visibili come “Non classificato”.</p></div>
          <div><p className="font-semibold text-foreground">Interpretazione</p><p className="mt-1">La spesa assoluta localizza la materialità. Prima di agire vanno controllati denominatori, mix, canale, copertura della normalizzazione e completezza del mapping.</p></div>
        </div>
      </MethodologyPanel>
    </div>
  );
}
