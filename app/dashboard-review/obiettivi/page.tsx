import Link from "next/link";
import { ArrowRight, CircleAlert, ClipboardCheck, Goal, ListChecks } from "lucide-react";
import {
  DecisionFrame,
  EmptyState,
  KpiCard,
  MethodologyPanel,
  PageHeader,
  StatusPill,
} from "@/components/dashboard-review/analytics-ui";
import { getObjectiveRank, getReviewWorkspaceData } from "@/lib/dashboard-review/queries";
import { formatDate, formatNumber, formatPercent } from "@/lib/dashboard-review/format";

export default async function ReviewsPage() {
  const data = await getReviewWorkspaceData();
  const rankEntries = await Promise.all(
    data.objectives.map(async (objective) => [objective.id, await getObjectiveRank(objective.metric)] as const),
  );
  const ranks = new Map(rankEntries);
  const first = data.signals[0];
  const biosimilarCount = data.signals.filter((signal) => signal.kind === "biosimilar").length;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Revisioni e obiettivi"
        title="Una coda operativa, non un’altra pagina di grafici."
        description="I segnali economici, gli scarti di qualità e gli obiettivi regionali convergono qui. Ogni voce indica l’evidenza da aprire; nessuna voce prescrive una decisione clinica."
        period={data.latest_year ? `Dati ${data.latest_year}` : "Periodo non disponibile"}
        scope={`${data.signals.length} revisioni attive`}
      />

      <DecisionFrame
        changed={first ? `${first.title} è il primo segnale nella coda corrente.` : "Nessun nuovo segnale generato dai dati disponibili."}
        variance={`${biosimilarCount} segnali molecolari, ${data.discrepancy_uploads.length} scarti di caricamento e ${data.objectives.length} obiettivi nel perimetro.`}
        materiality={data.high_priority_count > 0 ? `${data.high_priority_count} elementi hanno priorità alta perché bloccano la qualità o mostrano materialità economica elevata.` : "Nessuna priorità alta attiva."}
        nextEvidence={first ? first.context : "Verificare la freschezza delle fonti e attendere il prossimo ciclo di caricamento."}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard accent label="Revisioni attive" value={formatNumber(data.signals.length, 0)} detail="Coda generata da dati e governance" icon={ClipboardCheck} />
        <KpiCard label="Priorità alta" value={formatNumber(data.high_priority_count, 0)} detail="Qualità o materialità da verificare" icon={CircleAlert} />
        <KpiCard label="Obiettivi regionali" value={formatNumber(data.objectives.length, 0)} detail="Solo obiettivi visibili nel perimetro" icon={Goal} />
        <KpiCard label="Scarti di caricamento" value={formatNumber(data.discrepancy_uploads.length, 0)} detail="File non ancora riconciliati" icon={ListChecks} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Coda evidenze</p>
          <h2 className="font-display mt-1 text-xl">Elementi da verificare</h2>
          <p className="mt-1 text-xs text-muted-foreground">Ordinati per materialità e blocchi di qualità; gli obiettivi restano distinti dai segnali osservati.</p>
        </div>
        {data.signals.length === 0 ? (
          <div className="p-5"><EmptyState title="Coda vuota" detail="Non sono presenti opportunità dimostrate, scarti o obiettivi nel perimetro corrente." /></div>
        ) : (
          <div className="divide-y divide-border">
            {data.signals.map((signal) => (
              <div key={signal.id} className="grid gap-4 p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                <StatusPill tone={signal.severity === "high" ? "danger" : signal.severity === "medium" ? "warning" : "neutral"}>{signal.severity === "high" ? "Alta" : signal.severity === "medium" ? "Media" : "Informativa"}</StatusPill>
                <div><p className="font-semibold">{signal.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.context}</p></div>
                <div className="flex items-center justify-between gap-4 md:justify-end"><span className="font-mono text-xs font-semibold">{signal.value_label}</span><Link href={signal.href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Apri evidenza <ArrowRight size={12} /></Link></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {data.objectives.map((objective) => {
          const rank = ranks.get(objective.id);
          return (
            <article key={objective.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Obiettivo regionale</p><h3 className="mt-1 font-semibold">{objective.metric}</h3></div><StatusPill>{objective.atc_scope ?? "Formula da definire"}</StatusPill></div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-y border-border py-4 text-xs">
                <div><p className="text-muted-foreground">Valore</p><p className="mt-1 font-mono font-semibold">{rank ? formatPercent(rank.my_value) : "—"}</p></div>
                <div><p className="text-muted-foreground">Target</p><p className="mt-1 font-mono font-semibold">{rank ? formatPercent(rank.target_value) : objective.target_value}</p></div>
                <div><p className="text-muted-foreground">Posizione</p><p className="mt-1 font-mono font-semibold">{rank ? `${rank.my_rank} / ${rank.total_orgs}` : "—"}</p></div>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">Periodo {formatDate(objective.period_start)} – {formatDate(objective.period_end)}. {rank ? "Il ranking restituisce solo la posizione della propria ASL." : "Il ranking non è disponibile: profilo regionale oppure formula non confermata per questa metrica."}</p>
            </article>
          );
        })}
      </section>

      <MethodologyPanel>
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="font-semibold text-foreground">Generazione della coda</p><p className="mt-1">Le priorità derivano da opportunità biosimilari con €/mg confrontabile, record irrisolti, caricamenti con scarti e obiettivi regionali presenti nel database.</p></div>
          <div><p className="font-semibold text-foreground">Ranking protetto</p><p className="mt-1">La funzione database calcola internamente la posizione dell’ASL e restituisce soltanto la propria riga, senza identità o valori delle altre aziende.</p></div>
          <div><p className="font-semibold text-foreground">Confine operativo</p><p className="mt-1">La coda indica quale evidenza amministrativa esaminare. Non contiene pazienti, dosaggi, diagnosi o raccomandazioni terapeutiche.</p></div>
        </div>
      </MethodologyPanel>
    </div>
  );
}
