import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard-review/analytics-ui";
import { SpendOverview } from "@/components/dashboard-review/spend-overview";
import { SpendSankey } from "@/components/dashboard-review/spend-sankey";
import type { SpendDashboardData } from "@/lib/dashboard-review/types";

export function SpendDashboardView({ dashboard }: { dashboard: SpendDashboardData }) {
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Quadro esecutivo"
        title="Dai dati mensili alla prossima decisione verificabile."
        description="Spesa, consumo, variazioni, opportunità biosimilari e qualità in un’unica lettura. Ogni segnale apre il dettaglio territoriale, terapeutico e metodologico che lo sostiene."
        period={dashboard.latest_year ? `Periodo ${dashboard.latest_year}` : "Periodo non disponibile"}
        scope={dashboard.geography_count > 0 ? `${dashboard.geography_count} ambiti autorizzati` : "Perimetro RLS"}
      />

      <SpendOverview data={dashboard} />

      <details className="group">
        <summary className="cursor-pointer list-none text-xs font-semibold text-primary marker:hidden">
          <span className="group-open:hidden">Apri analisi avanzata del flusso →</span>
          <span className="hidden group-open:inline">Chiudi analisi avanzata del flusso</span>
        </summary>
        <Card className="mt-3">
          <CardHeader className="p-6 md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Composizione del flusso</p>
            <CardTitle className="font-display text-xl">Canale → ATC → originator/biosimilare</CardTitle>
            <CardDescription>Lo spessore è proporzionale alla spesa osservata nel periodo più recente.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-6 pb-6 md:px-8 md:pb-8">
            <div className="min-w-[640px]"><SpendSankey data={dashboard.flows} /></div>
          </CardContent>
        </Card>
      </details>
    </div>
  );
}
