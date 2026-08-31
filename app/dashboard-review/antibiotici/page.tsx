import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AwareBarChart } from "@/components/dashboard-review/aware-bar-chart";
import { getAntibioticStewardship } from "@/lib/dashboard-review/queries";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { formatEur, formatEurPrecise, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { AntibioticIndicatorSet } from "@/lib/dashboard-review/types";
import { DecisionFrame, MethodologyPanel, PageHeader } from "@/components/dashboard-review/analytics-ui";

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
  const latest = data.awareByYear.at(-1);
  const previous = data.awareByYear.at(-2);
  const totalFor = (row: typeof latest) => row ? row.access + row.watch + row.reserve + row.unclassified : 0;
  const latestTotal = totalFor(latest);
  const previousTotal = totalFor(previous);
  const change = previousTotal > 0 ? (latestTotal - previousTotal) / previousTotal : null;
  const categories = latest ? [
    ["Access", latest.access], ["Watch", latest.watch], ["Reserve", latest.reserve], ["Non classificato", latest.unclassified],
  ] as const : [];
  const largestCategory = [...categories].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Antibiotici AWaRe"
        title="Stewardship misurabile, entro i denominatori disponibili."
        description={`Spesa per categoria Access, Watch e Reserve e indicatori di consumo per ${viewLabel}. La vista resta organizzativa e non contiene indicazioni terapeutiche.`}
        period={data.latestYear ? `Periodo ${data.latestYear}` : "Periodo non disponibile"}
        scope={org?.org_type === "regione" ? "Vista regionale" : "Vista aziendale"}
      />

      <DecisionFrame
        changed={change === null ? "Nessun periodo precedente confrontabile." : `La spesa AWaRe è ${change >= 0 ? "aumentata" : "diminuita"} del ${formatPercent(Math.abs(change))}.`}
        variance={largestCategory ? `${largestCategory[0]} è la categoria prevalente con ${formatEur(largestCategory[1])}.` : "Composizione AWaRe non disponibile."}
        materiality={latestTotal > 0 ? `${formatEur(latestTotal)} di spesa classificata o riconciliata nell’ultimo anno.` : "Materialità non calcolabile."}
        nextEvidence={hasNegativeGap ? "La somma delle categorie supera il totale dichiarato: verificare la fonte prima dell’interpretazione." : "Integrare i denominatori di popolazione prima di produrre indicatori pro capite."}
      />

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

      <MethodologyPanel>
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="font-semibold text-foreground">Classificazione</p><p className="mt-1">Access, Watch e Reserve seguono la tassonomia AWaRe presente nella fonte. “Non classificato” è soltanto lo scarto positivo rispetto al totale dichiarato.</p></div>
          <div><p className="font-semibold text-foreground">Indicatori</p><p className="mt-1">DDD/100 giornate = DDD ÷ giornate di degenza × 100. Spesa/giornata e spesa/DDD usano il totale annuale della categoria T.</p></div>
          <div><p className="font-semibold text-foreground">Limiti</p><p className="mt-1">DDD/1.000 abitanti e spesa pro capite non vengono calcolati finché i denominatori di popolazione non sono integrati e versionati.</p></div>
        </div>
      </MethodologyPanel>
    </div>
  );
}
