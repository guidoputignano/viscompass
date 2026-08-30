import { Card, CardContent } from "@/components/ui/card";
import { getObjectives, resolveScope } from "@/lib/dashboard-review/queries";
import { formatDate } from "@/lib/dashboard-review/format";

export default async function ObiettiviPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  const scope = await resolveScope(org);
  const objectives = await getObjectives(scope);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">Obiettivi</p>
        <h1 className="font-display mt-1 text-2xl md:text-3xl">Obiettivi regionali</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Target fissati a livello regionale per il periodo indicato. Sola visualizzazione — la
          definizione degli obiettivi resta una funzione separata, non disponibile da questa
          schermata.
        </p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {objectives.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground">
              Nessun obiettivo definito per la regione dell&apos;ambito selezionato.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Metrica</th>
                  <th className="px-4 py-3 font-medium">Ambito ATC</th>
                  <th className="px-4 py-3 text-right font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Periodo</th>
                </tr>
              </thead>
              <tbody>
                {objectives.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{o.metric}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {o.atc_scope ?? "Tutti"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {o.target_value < 1 ? `${Math.round(o.target_value * 100)}%` : o.target_value}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(o.period_start)} – {formatDate(o.period_end)}
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
