import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SpendOverview } from "@/components/dashboard-review/spend-overview";
import { SpendSankey } from "@/components/dashboard-review/spend-sankey";
import type { SpendDashboardData } from "@/lib/dashboard-review/types";

export function SpendDashboardView({ dashboard }: { dashboard: SpendDashboardData }) {
  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-5 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.17em] text-primary">
            M1 · Osservatorio della spesa
          </p>
          <h1 className="font-display mt-2 max-w-3xl text-3xl leading-tight md:text-4xl">
            Dalla spesa osservata al punto d&apos;intervento.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Leggi il trend, individua la concentrazione per categoria e apri la traccia dei dati
            dietro ogni segnale — senza uscire dal perimetro autorizzato.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="rounded-full border border-border bg-card px-3 py-1.5">
            {dashboard.latest_year
              ? `Periodo ${dashboard.latest_year}`
              : "Periodo non disponibile"}
          </span>
          <span className="rounded-full border border-border bg-card px-3 py-1.5">
            {dashboard.geography_count > 0
              ? `${dashboard.geography_count} ambiti nel perimetro`
              : "Ambito autenticato"}
          </span>
        </div>
      </header>

      <SpendOverview data={dashboard} />

      <Card>
        <CardHeader className="p-6 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Composizione del flusso
          </p>
          <CardTitle className="font-display text-xl">Dove passa la spesa</CardTitle>
          <CardDescription>
            Canale → categoria ATC → originator/biosimilare. Lo spessore è proporzionale alla
            spesa osservata nel periodo più recente.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-6 pb-6 md:px-8 md:pb-8">
          <div className="min-w-[640px]">
            <SpendSankey data={dashboard.flows} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
