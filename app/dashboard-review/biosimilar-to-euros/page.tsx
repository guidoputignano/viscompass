import { Card, CardContent } from "@/components/ui/card";
import { getBiosimilarComparison } from "@/lib/dashboard-review/queries";
import { formatEur, formatEurPrecise, formatPercent } from "@/lib/dashboard-review/format";

export default async function BiosimilarToEurosPage() {
  const rows = await getBiosimilarComparison();

  const totalSavings = rows.reduce((sum, r) => sum + r.potential_savings_eur, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">M2</p>
        <h1 className="font-display mt-1 text-2xl md:text-3xl">Radar biosimilare → euro</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Traduce lo scarto di prezzo per mg fra originator e biosimilare in un&apos;opportunità
          espressa in euro, per principio attivo.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Opportunità stimata nel proprio ambito
          </p>
          <p className="font-display mt-1 text-3xl text-foreground">{formatEur(totalSavings)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground">
              Nessun dato disponibile nel proprio ambito.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Principio attivo</th>
                  <th className="px-4 py-3 text-right font-medium">Originator €/mg</th>
                  <th className="px-4 py-3 text-right font-medium">Biosimilare €/mg</th>
                  <th className="px-4 py-3 text-right font-medium">Quota su originator</th>
                  <th className="px-4 py-3 text-right font-medium">Opportunità stimata</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.active_substance} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{r.active_substance}</p>
                      <p className="font-mono text-xs text-muted-foreground">{r.atc4}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.originator_cost_per_mg !== null ? formatEurPrecise(r.originator_cost_per_mg) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.biosimilar_cost_per_mg !== null ? formatEurPrecise(r.biosimilar_cost_per_mg) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.round(r.originator_share * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs">{formatPercent(r.originator_share)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                      {r.potential_savings_eur > 0 ? formatEur(r.potential_savings_eur) : "—"}
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
