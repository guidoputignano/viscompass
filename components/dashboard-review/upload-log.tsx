import { StatusPill } from "@/components/dashboard-review/analytics-ui";
import { formatDate, formatEurPrecise, formatNumber } from "@/lib/dashboard-review/format";
import { readReconciliationSummary } from "@/lib/uploads/summary-view";
import type { UploadRecord, UploadStatus } from "@/lib/dashboard-review/types";

// The operational log for one organization's uploads.
//
// A list rather than a table because the reconciliation detail needs the full
// width: quarantined euros, the canonical comparison and the basis the figures
// were read on do not fit in a four-column row, and folding them away entirely
// is what left the previous version showing a status pill and nothing else.
//
// The pill comes from reconciliation_summary when there is one, NOT from
// uploads.status. Three of the reconciler's five outcomes are stored as
// 'uploaded' because the CHECK constraint has no value for them, so the column
// would render a file that could not be reconciled as plain "Caricato".

const COLUMN_STATUS: Record<UploadStatus, { label: string; tone: "neutral" | "warning" | "positive" | "danger" }> = {
  uploaded: { label: "Caricato", tone: "neutral" },
  processing: { label: "In elaborazione", tone: "warning" },
  reconciled: { label: "Riconciliato", tone: "positive" },
  discrepancy_found: { label: "Scarto rilevato", tone: "danger" },
};

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={muted ? "mt-0.5 font-mono text-xs text-muted-foreground" : "mt-0.5 font-mono text-xs font-semibold"}>
        {value}
      </p>
    </div>
  );
}

export function UploadLog({ uploads }: { uploads: UploadRecord[] }) {
  return (
    <div className="divide-y divide-border">
      {uploads.map((upload) => {
        const view = readReconciliationSummary(upload.reconciliation_summary);
        // Only fall back to the column when nothing has been written yet.
        const badge = view.kind === "none" ? COLUMN_STATUS[upload.status] : view;
        const period =
          upload.period_covered_start && upload.period_covered_end
            ? `${formatDate(upload.period_covered_start)} – ${formatDate(upload.period_covered_end)}`
            : null;

        return (
          <article key={upload.id} className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{upload.file_name}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Caricato {formatDate(upload.uploaded_at)}
                  {period ? ` · periodo ${period}` : ""}
                </p>
              </div>
              <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
            </div>

            {view.kind !== "none" && (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{view.message}</p>
            )}

            {view.kind === "report" && (
              <details className="group mt-3">
                <summary className="cursor-pointer list-none text-[11px] font-semibold text-primary">
                  <span className="group-open:hidden">Mostra il dettaglio della riconciliazione</span>
                  <span className="hidden group-open:inline">Nascondi il dettaglio</span>
                </summary>

                <div className="mt-4 flex flex-col gap-5 rounded-xl border border-border bg-secondary/20 p-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Figure
                      label="Righe accettate"
                      value={view.rows ? `${formatNumber(view.rows.accepted, 0)} / ${formatNumber(view.rows.total, 0)}` : "—"}
                    />
                    <Figure
                      label="Totale accettato"
                      value={view.amounts ? formatEurPrecise(view.amounts.accepted) : "—"}
                    />
                    <Figure
                      label="In quarantena"
                      value={view.amounts ? formatEurPrecise(view.amounts.quarantined) : "—"}
                      muted
                    />
                    <Figure
                      label="In attesa della Regione"
                      value={view.amounts ? formatEurPrecise(view.amounts.awaitingRegion) : "—"}
                      muted
                    />
                  </div>

                  {/* The quarantined total is stated as excluded every time it is
                      shown. It is never added into the accepted figure above. */}
                  {view.amounts !== null && view.amounts.quarantined !== 0 && (
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      Gli importi in quarantena sono esclusi dal totale accettato e restano visibili
                      finché non vengono risolti a monte.
                    </p>
                  )}

                  {view.quarantine.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-xs">
                        <thead>
                          <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            <th className="py-2 pr-4 font-semibold">Motivo</th>
                            <th className="py-2 pr-4 text-right font-semibold">Righe</th>
                            <th className="py-2 pr-4 text-right font-semibold">Importo</th>
                            <th className="py-2 font-semibold">Decisione</th>
                          </tr>
                        </thead>
                        <tbody>
                          {view.quarantine.map((group) => (
                            <tr key={group.code} className="border-b border-border align-top last:border-0">
                              <td className="py-2 pr-4">
                                <p className="text-foreground">{group.reason}</p>
                                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{group.code}</p>
                              </td>
                              <td className="py-2 pr-4 text-right font-mono">{formatNumber(group.rows, 0)}</td>
                              <td className="py-2 pr-4 text-right font-mono">{formatEurPrecise(group.cost)}</td>
                              <td className="py-2 text-[11px] text-muted-foreground">
                                {group.awaitingRegion ? "Attende una risposta della Regione" : "Da risolvere nella fonte"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Confronto canonico</p>
                      <p className="mt-0.5 text-[11px] leading-5">
                        {view.canonical === null
                          ? "Non registrato."
                          : view.canonical.available
                            ? `Atteso ${formatEurPrecise(view.canonical.expected)} · differenza ${formatEurPrecise(view.canonical.difference)}${view.canonical.withinTolerance ? " (entro tolleranza)" : ""}.`
                            : view.canonical.reason}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Totale dichiarato dal file</p>
                      <p className="mt-0.5 text-[11px] leading-5">
                        {view.declared === null
                          ? "Il file non dichiara un totale."
                          : `Dichiarato ${formatEurPrecise(view.declared.total)} · sommato ${formatEurPrecise(view.declared.summed)} · differenza ${formatEurPrecise(view.declared.difference)}.`}
                      </p>
                    </div>
                  </div>

                  {view.notes.length > 0 && (
                    <ul className="flex list-disc flex-col gap-1 pl-4 text-[11px] leading-5 text-muted-foreground">
                      {view.notes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  )}

                  {/* Provenance. The basis is the group header the parser asserted
                      on before reading columns (a) and (c); without it the figures
                      above cannot be tied to a flow definition. */}
                  {view.basis && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Base delle colonne lette</p>
                      <p className="mt-0.5 font-mono text-[10px] leading-4 text-muted-foreground">{view.basis}</p>
                    </div>
                  )}

                  {view.at && (
                    <p className="text-[10px] text-muted-foreground">Riconciliazione eseguita il {formatDate(view.at)}.</p>
                  )}
                </div>
              </details>
            )}
          </article>
        );
      })}
    </div>
  );
}
