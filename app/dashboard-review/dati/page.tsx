import { CircleAlert, Database, FileClock, ShieldCheck } from "lucide-react";
import {
  DecisionFrame,
  EmptyState,
  KpiCard,
  MethodologyPanel,
  PageHeader,
  StatusPill,
} from "@/components/dashboard-review/analytics-ui";
import { UploadShell } from "@/components/dashboard-review/upload-shell";
import { getLineageData, getUploads } from "@/lib/dashboard-review/queries";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { formatDate, formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { UploadStatus } from "@/lib/dashboard-review/types";

const STATUS: Record<UploadStatus, { label: string; tone: "neutral" | "warning" | "positive" | "danger" }> = {
  uploaded: { label: "Caricato", tone: "neutral" },
  processing: { label: "In elaborazione", tone: "warning" },
  reconciled: { label: "Riconciliato", tone: "positive" },
  discrepancy_found: { label: "Scarto rilevato", tone: "danger" },
};

export default async function DataLineagePage() {
  const [lineage, uploads, org] = await Promise.all([getLineageData(), getUploads(), getCurrentOrg()]);
  const weakest = [...lineage.sources]
    .filter((source) => source.normalized_coverage !== null)
    .sort((a, b) => a.normalized_coverage! - b.normalized_coverage!)[0];
  const discrepancies = uploads.filter((upload) => upload.status === "discrepancy_found");

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Fonti, qualità e caricamenti"
        title="Ogni numero deve poter tornare alla sua fonte."
        description="Versioni sorgente, periodo coperto, geografie, record, normalizzazione e scarti vengono mostrati insieme. L’analisi resta separata dal processo di caricamento e riconciliazione."
        period={lineage.latest_loaded_at ? `Aggiornato ${formatDate(lineage.latest_loaded_at)}` : "Aggiornamento non disponibile"}
        scope={`${lineage.sources.length} versioni fonte`}
      />

      <DecisionFrame
        changed={lineage.latest_loaded_at ? `L’ultimo record è stato caricato il ${formatDate(lineage.latest_loaded_at)}.` : "Nessun caricamento canonico disponibile."}
        variance={weakest ? `${weakest.source_version_id} ha la copertura di normalizzazione più bassa: ${formatPercent(weakest.normalized_coverage!)}.` : "Copertura per fonte non calcolabile."}
        materiality={`${formatNumber(lineage.unresolved_records, 0)} record restano esclusi dai confronti economici normalizzati.`}
        nextEvidence={discrepancies.length > 0 ? `Riconciliare ${discrepancies.length} file con scarto prima del prossimo ciclo di pubblicazione.` : "Verificare le fonti con record irrisolti e documentare ogni mapping manuale."}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard accent label="Record canonici" value={formatNumber(lineage.total_records, 0)} detail={`${lineage.sources.length} versioni sorgente`} icon={Database} />
        <KpiCard label="Copertura normalizzata" value={lineage.normalization_coverage === null ? "—" : formatPercent(lineage.normalization_coverage)} detail="€/mg o €/DDD disponibile" icon={ShieldCheck} />
        <KpiCard label="Record irrisolti" value={formatNumber(lineage.unresolved_records, 0)} detail="Visibili, non presentati come confronto risolto" icon={CircleAlert} />
        <KpiCard label="Caricamenti con scarto" value={formatNumber(discrepancies.length, 0)} detail={`${uploads.length} caricamenti registrati`} icon={FileClock} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Registro di lineage</p>
          <h2 className="font-display mt-1 text-xl">Versioni che alimentano il perimetro</h2>
          <p className="mt-1 text-xs text-muted-foreground">Il codice versione è conservato su ogni record canonico e resta il punto di riconciliazione con la fonte.</p>
        </div>
        {lineage.sources.length === 0 ? (
          <div className="p-5"><EmptyState title="Registro vuoto" detail="Nessun record canonico è visibile all’organizzazione autenticata." /></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground"><th className="px-5 py-3 font-semibold">Versione</th><th className="px-5 py-3 font-semibold">Periodo</th><th className="px-5 py-3 text-right font-semibold">Record</th><th className="px-5 py-3 text-right font-semibold">Spesa</th><th className="px-5 py-3 text-right font-semibold">Geografie</th><th className="px-5 py-3 text-right font-semibold">Copertura norm.</th><th className="px-5 py-3 text-right font-semibold">Irrisolti</th><th className="px-5 py-3 text-right font-semibold">Caricato</th></tr></thead>
            <tbody>{lineage.sources.map((source) => <tr key={source.source_version_id} className="border-b border-border last:border-0"><td className="px-5 py-4 font-mono text-xs font-semibold">{source.source_version_id}</td><td className="px-5 py-4 text-xs text-muted-foreground">{source.first_year ?? "—"}{source.first_year !== source.latest_year ? ` – ${source.latest_year ?? "—"}` : ""}</td><td className="px-5 py-4 text-right font-mono text-xs">{formatNumber(source.record_count, 0)}</td><td className="px-5 py-4 text-right font-mono text-xs">{formatEur(source.spend_eur)}</td><td className="px-5 py-4 text-right font-mono text-xs">{formatNumber(source.geography_count, 0)}</td><td className="px-5 py-4 text-right font-mono text-xs">{source.normalized_coverage === null ? "—" : formatPercent(source.normalized_coverage)}</td><td className="px-5 py-4 text-right font-mono text-xs">{formatNumber(source.unresolved_count, 0)}</td><td className="px-5 py-4 text-right text-xs text-muted-foreground">{source.latest_loaded_at ? formatDate(source.latest_loaded_at) : "—"}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(18rem,0.65fr)_minmax(0,1.35fr)]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Ingestione controllata</p>
          <h2 className="font-display mt-1 text-xl">Nuovo caricamento</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Il file viene salvato nella cartella privata dell’organizzazione e registrato prima della riconciliazione.</p>
          <div className="mt-5">{org ? <UploadShell orgCode={org.org_code} /> : <EmptyState title="Organizzazione mancante" detail="Serve un’adesione approvata per caricare file." />}</div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5 md:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Registro operativo</p><h2 className="font-display mt-1 text-xl">Caricamenti dell’organizzazione</h2></div>
          {uploads.length === 0 ? <div className="p-5"><EmptyState title="Nessun file caricato" detail="Il registro si popolerà dopo il primo caricamento." /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground"><th className="px-5 py-3 font-semibold">File</th><th className="px-5 py-3 font-semibold">Periodo</th><th className="px-5 py-3 font-semibold">Caricato</th><th className="px-5 py-3 font-semibold">Stato</th></tr></thead><tbody>{uploads.map((upload) => <tr key={upload.id} className="border-b border-border last:border-0"><td className="px-5 py-4 font-semibold">{upload.file_name}</td><td className="px-5 py-4 text-xs text-muted-foreground">{upload.period_covered_start && upload.period_covered_end ? `${formatDate(upload.period_covered_start)} – ${formatDate(upload.period_covered_end)}` : "—"}</td><td className="px-5 py-4 text-xs text-muted-foreground">{formatDate(upload.uploaded_at)}</td><td className="px-5 py-4"><StatusPill tone={STATUS[upload.status].tone}>{STATUS[upload.status].label}</StatusPill></td></tr>)}</tbody></table></div>}
        </div>
      </section>

      <MethodologyPanel>
        <div className="grid gap-5 md:grid-cols-3"><div><p className="font-semibold text-foreground">Canonicalizzazione</p><p className="mt-1">Ogni riga conserva identificativo del record e versione fonte. Le dimensioni territoriali, ATC, molecola e AIC vengono mantenute come campi separati.</p></div><div><p className="font-semibold text-foreground">Qualità</p><p className="mt-1">Authoritative, Validated, Candidate e Unresolved distinguono il livello di affidabilità del mapping. Solo i valori normalizzati alimentano i confronti €/mg o €/DDD.</p></div><div><p className="font-semibold text-foreground">Riconciliazione</p><p className="mt-1">Uploaded → Processing → Reconciled oppure Discrepancy found. Uno scarto resta visibile nella coda di revisione finché non viene risolto a monte.</p></div></div>
      </MethodologyPanel>
    </div>
  );
}
