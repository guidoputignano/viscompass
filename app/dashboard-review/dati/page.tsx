import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadShell } from "@/components/dashboard-review/upload-shell";
import { getUploads } from "@/lib/dashboard-review/queries";
import { formatDate } from "@/lib/dashboard-review/format";
import type { UploadStatus } from "@/lib/dashboard-review/types";

const STATUS_LABEL: Record<UploadStatus, string> = {
  uploaded: "Caricato",
  processing: "In elaborazione",
  reconciled: "Riconciliato",
  discrepancy_found: "Scarto rilevato",
};

const STATUS_STYLE: Record<UploadStatus, { bg: string; text: string }> = {
  uploaded: { bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))" },
  processing: { bg: "hsl(38 92% 50% / 0.14)", text: "hsl(32 70% 32%)" },
  reconciled: { bg: "hsl(174 82% 39% / 0.12)", text: "hsl(174 70% 28%)" },
  discrepancy_found: { bg: "hsl(12 58% 42% / 0.12)", text: "hsl(12 58% 32%)" },
};

export default async function DatiPage() {
  const uploads = await getUploads();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">Dati</p>
        <h1 className="font-display mt-1 text-2xl md:text-3xl">Caricamento dati</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Interfaccia di caricamento per la propria Azienda. Visibile solo ai membri approvati
          dell&apos;organizzazione proprietaria del file — nessuna vista a livello regionale qui.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuovo caricamento</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadShell />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">File caricati</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {uploads.length === 0 ? (
            <p className="p-8 pt-0 text-sm text-muted-foreground">
              Nessun file caricato per questa organizzazione.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">File</th>
                  <th className="px-4 py-3 font-medium">Periodo</th>
                  <th className="px-4 py-3 font-medium">Caricato il</th>
                  <th className="px-4 py-3 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{u.file_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.period_covered_start && u.period_covered_end
                        ? `${formatDate(u.period_covered_start)} – ${formatDate(u.period_covered_end)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(u.uploaded_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                        style={{
                          backgroundColor: STATUS_STYLE[u.status].bg,
                          color: STATUS_STYLE[u.status].text,
                        }}
                      >
                        {STATUS_LABEL[u.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
