import { Building2, ChartSpline, PackageSearch, Scale } from "lucide-react";
import {
  DecisionFrame,
  EmptyState,
  KpiCard,
  MethodologyPanel,
  PageHeader,
  StatusPill,
} from "@/components/dashboard-review/analytics-ui";
import { getBenchmarkData } from "@/lib/dashboard-review/queries";
import { formatEur, formatEurPrecise, formatNumber, formatPercent } from "@/lib/dashboard-review/format";

export default async function BenchmarkPage() {
  const data = await getBenchmarkData();
  const largest = data.rows[0];
  const fastestChange = [...data.rows]
    .filter((row) => row.spend_yoy !== null)
    .sort((a, b) => Math.abs(b.spend_yoy!) - Math.abs(a.spend_yoy!))[0];
  const excess = data.median_spend_eur === null
    ? 0
    : data.rows.reduce((sum, row) => sum + Math.max(row.spend_eur - data.median_spend_eur!, 0), 0);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Benchmark territoriale"
        title="Confronta i territori senza perdere il contesto."
        description="Una lettura regionale delle differenze tra ASL: spesa, dinamica, costo per confezione, penetrazione biosimilare e copertura della normalizzazione. Il confronto segnala varianza; non attribuisce performance clinica."
        period={data.latest_year ? `Periodo ${data.latest_year}` : "Periodo non disponibile"}
        scope={data.benchmark_available ? `${data.rows.length} ASL confrontabili` : "Benchmark limitato"}
      />

      <DecisionFrame
        changed={fastestChange ? `${fastestChange.org_name} mostra la variazione assoluta più ampia: ${formatPercent(fastestChange.spend_yoy!)}.` : "Nessuna annualità precedente confrontabile."}
        variance={largest && data.median_spend_eur ? `${largest.org_name} registra una spesa pari a ${formatNumber(largest.spend_eur / data.median_spend_eur, 1)}× la mediana regionale.` : "Servono almeno due ASL visibili per localizzare la varianza."}
        materiality={excess > 0 ? `${formatEur(excess)} di spesa complessiva sopra la mediana, prima di qualunque aggiustamento per popolazione o casistica.` : "Materialità territoriale non calcolabile nel perimetro corrente."}
        nextEvidence="Aprire l’ATC che genera lo scarto."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard accent label="Territori osservati" value={formatNumber(data.rows.length, 0)} detail={`${data.peer_count} unità nel confronto autorizzato`} icon={Building2} />
        <KpiCard label="Spesa mediana" value={data.median_spend_eur === null ? "—" : formatEur(data.median_spend_eur)} detail="Valore centrale, non target" icon={ChartSpline} />
        <KpiCard label="Costo/confezione mediano" value={data.median_cost_per_pack_eur === null ? "—" : formatEurPrecise(data.median_cost_per_pack_eur)} detail="Indicatore descrittivo di mix" icon={PackageSearch} />
        <KpiCard label="Penetrazione bio mediana" value={data.median_biosimilar_penetration === null ? "—" : formatPercent(data.median_biosimilar_penetration)} detail="Base migliore disponibile per ciascuna ASL" icon={Scale} />
      </div>

      {!data.benchmark_available && data.rows.length === 0 ? (
        <EmptyState title="Benchmark non disponibile" detail={data.limitation ?? "Nessun dato territoriale confrontabile."} />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5 md:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Distribuzione regionale</p>
            <h2 className="font-display mt-1 text-xl">Indice di spesa rispetto alla mediana</h2>
            <p className="mt-1 text-xs text-muted-foreground">100 = mediana del perimetro visibile. La dimensione non è corretta per popolazione o complessità assistenziale.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-3 font-semibold">ASL</th><th className="px-5 py-3 font-semibold">Indice</th><th className="px-5 py-3 text-right font-semibold">Spesa</th><th className="px-5 py-3 text-right font-semibold">Var. a/a</th><th className="px-5 py-3 text-right font-semibold">Costo/conf.</th><th className="px-5 py-3 text-right font-semibold">Biosim.</th><th className="px-5 py-3 text-right font-semibold">Copertura norm.</th>
              </tr></thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.org_code} className={row.is_current_org ? "border-b border-primary/20 bg-primary/5 last:border-0" : "border-b border-border last:border-0"}>
                    <td className="px-5 py-4"><div className="flex items-center gap-2"><span className="font-semibold">{row.org_name}</span>{row.is_current_org && <StatusPill tone="positive">Il tuo ambito</StatusPill>}</div><span className="font-mono text-[10px] text-muted-foreground">{row.org_code}</span></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="h-2 w-28 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(row.spend_index ?? 0, 200) / 2}%` }} /></div><span className="font-mono text-xs font-semibold">{row.spend_index === null ? "—" : formatNumber(row.spend_index, 0)}</span></div></td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{formatEur(row.spend_eur)}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{row.spend_yoy === null ? "—" : formatPercent(row.spend_yoy)}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{row.cost_per_pack_eur === null ? "—" : formatEurPrecise(row.cost_per_pack_eur)}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{row.biosimilar_penetration === null ? "—" : formatPercent(row.biosimilar_penetration)}</td>
                    <td className="px-5 py-4 text-right font-mono text-xs">{row.normalization_coverage === null ? "—" : formatPercent(row.normalization_coverage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.limitation && <p className="border-t border-border bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">{data.limitation}</p>}
        </section>
      )}

      <MethodologyPanel>
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="font-semibold text-foreground">Coorte</p><p className="mt-1">Sono incluse solo le ASL con record visibili attraverso le policy RLS e presenti nell’ultima annualità comune disponibile.</p></div>
          <div><p className="font-semibold text-foreground">Indice</p><p className="mt-1">Spesa ASL ÷ mediana della spesa ASL × 100. È un segnale di dispersione; senza popolazione, attività e casistica non è un giudizio di efficienza.</p></div>
          <div><p className="font-semibold text-foreground">Privacy organizzativa</p><p className="mt-1">Un utente regionale vede le ASL della regione. Un utente ASL non riceve identità o valori delle altre aziende; l’assenza del benchmark è resa esplicita.</p></div>
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <p className="font-semibold text-foreground">Base di confronto: erogato</p>
          <p className="mt-1">Il confronto tra Aziende è calcolato sui valori erogati. Gli acquisti possono essere attribuiti centralmente a una sola Azienda del perimetro, mentre l’erogazione è registrata dove avviene: i totali di acquisto non sono quindi confrontabili tra Aziende e non vengono pubblicati in questa vista.</p>
        </div>
      </MethodologyPanel>
    </div>
  );
}
