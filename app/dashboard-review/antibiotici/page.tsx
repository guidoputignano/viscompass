import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AwareBarChart } from "@/components/dashboard-review/aware-bar-chart";
import { getAntibioticStewardship } from "@/lib/dashboard-review/queries";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { formatEurPrecise, formatNumber } from "@/lib/dashboard-review/format";
import type { AntibioticIndicatorSet } from "@/lib/dashboard-review/types";

const INDICATOR_LABELS: Record<keyof AntibioticIndicatorSet, string> = {
  dddPer100BedDays: "DDD / 100 giornate di degenza",
  costPerBedDay: "Spesa per giornata di degenza",
  costPerDdd: "Spesa per DDD",
};

function formatIndicator(key: keyof AntibioticIndicatorSet, value: number | null): string {
  if (value === null) return "—";
  return key === "dddPer100BedDays" ? formatNumber(value) : formatEurPrecise(value);
}

function IndicatorTile({
  indicatorKey,
  orgValue,
  regionalAverage,
}: {
  indicatorKey: keyof AntibioticIndicatorSet;
  orgValue: number | null;
  regionalAverage: (AntibioticIndicatorSet & { peerOrgCount: number }) | null;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {INDICATOR_LABELS[indicatorKey]}
        </p>
        <p className="font-display mt-1 text-2xl text-foreground">
          {formatIndicator(indicatorKey, orgValue)}
        </p>
        <p className="text-xs text-muted-foreground">
          {regionalAverage
            ? `Media regionale (${regionalAverage.peerOrgCount} aziende): ${formatIndicator(indicatorKey, regionalAverage[indicatorKey])}`
            : "Confronto regionale non disponibile: l'accesso è limitato ai dati della propria organizzazione, per progettazione."}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function AntibioticiPage() {
  const [data, org] = await Promise.all([getAntibioticStewardship(), getCurrentOrg()]);
  const hasNegativeGap = data.awareByYear.some((y) => y.hasNegativeGap);
  const viewLabel = org?.org_type === "regione" ? "il totale della regione" : "la propria Azienda";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">Antibiotici</p>
        <h1 className="font-display mt-1 text-2xl md:text-3xl">
          Antibiotico-resistenza: classificazione AWaRe
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Spesa per categoria AWaRe (Access / Watch / Reserve) e indicatori di stewardship per{" "}
          {viewLabel}, 2023–2025. Dati a livello di Azienda: nessuna disaggregazione per unità
          operativa è disponibile in questa schermata.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
        Gli indicatori basati sulla popolazione (DDD/1.000 abitanti, spesa pro capite) non sono
        mostrati in questa schermata: richiedono una terza fonte dati, i denominatori di
        popolazione, non ancora integrata. L&apos;assenza è intenzionale e riconosciuta, non
        un&apos;omissione.
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spesa per categoria AWaRe</CardTitle>
          <CardDescription>
            Access, Watch, Reserve e, dove presente uno scarto rispetto al totale dichiarato,
            &quot;Non classificato&quot;
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[480px]">
            <AwareBarChart data={data.awareByYear} />
          </div>
          {hasNegativeGap && (
            <p className="mt-3 text-xs text-destructive">
              In almeno un anno la somma di Access, Watch e Reserve supera il totale dichiarato
              (categoria T): dato da verificare alla fonte.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="font-display text-lg text-foreground">
          Indicatori {data.latestYear ? `— ${data.latestYear}` : ""}
        </h2>
        {data.orgIndicators ? (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <IndicatorTile
              indicatorKey="dddPer100BedDays"
              orgValue={data.orgIndicators.dddPer100BedDays}
              regionalAverage={data.regionalAverage}
            />
            <IndicatorTile
              indicatorKey="costPerBedDay"
              orgValue={data.orgIndicators.costPerBedDay}
              regionalAverage={data.regionalAverage}
            />
            <IndicatorTile
              indicatorKey="costPerDdd"
              orgValue={data.orgIndicators.costPerDdd}
              regionalAverage={data.regionalAverage}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Nessun dato di consumo antibiotico (categoria T) disponibile nel proprio ambito.
          </p>
        )}
      </div>
    </div>
  );
}
