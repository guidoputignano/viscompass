import { Card, CardContent } from "@/components/ui/card";
import { getObjectiveRank, getObjectives } from "@/lib/dashboard-review/queries";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { formatDate } from "@/lib/dashboard-review/format";
import type { ObjectiveRank } from "@/lib/dashboard-review/types";

function formatValue(value: number, target: number): string {
  return target < 1 ? `${Math.round(value * 100)}%` : String(value);
}

export default async function ObiettiviPage() {
  const org = await getCurrentOrg();
  const objectives = await getObjectives();

  // The anonymized ranking only makes sense for an ASL caller (it's their
  // own position among peers). A regione-type caller isn't itself one of
  // the ranked entities, and my_objective_rank returns nothing for it.
  const showRanking = org?.org_type === "asl";
  const ranks: (ObjectiveRank | null)[] = showRanking
    ? await Promise.all(objectives.map((o) => getObjectiveRank(o.metric)))
    : objectives.map(() => null);

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
              Nessun obiettivo definito per la regione del proprio ambito.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Metrica</th>
                  <th className="px-4 py-3 font-medium">Ambito ATC</th>
                  <th className="px-4 py-3 text-right font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Periodo</th>
                  {showRanking && <th className="px-4 py-3 font-medium">La tua posizione</th>}
                </tr>
              </thead>
              <tbody>
                {objectives.map((o, i) => {
                  const rank = ranks[i];
                  return (
                    <tr key={o.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{o.metric}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {o.atc_scope ?? "Tutti"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatValue(o.target_value, o.target_value)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(o.period_start)} – {formatDate(o.period_end)}
                      </td>
                      {showRanking && (
                        <td className="px-4 py-3">
                          {rank ? (
                            <span className="font-medium text-foreground">
                              {rank.my_rank}° su {rank.total_orgs}{" "}
                              <span className="font-mono text-xs text-muted-foreground">
                                ({formatValue(rank.my_value, rank.target_value)})
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Classifica non disponibile per questa metrica
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
