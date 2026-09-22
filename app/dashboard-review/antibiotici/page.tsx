import {
  Activity,
  BadgeEuro,
  BedSingle,
  CircleDollarSign,
  Gauge,
  UsersRound,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AwareBarChart } from "@/components/dashboard-review/aware-bar-chart";
import {
  AntibioticIndexChart,
  AntibioticUnitQuadrant,
} from "@/components/dashboard-review/antibiotic-analysis-charts";
import {
  DecisionFrame,
  Delta,
  KpiCard,
  MethodologyPanel,
  PageHeader,
  TemplateNotice,
} from "@/components/dashboard-review/analytics-ui";
import { getAntibioticStewardship } from "@/lib/dashboard-review/queries";
import {
  formatEur,
  formatEurPrecise,
  formatNumber,
  formatPercent,
} from "@/lib/dashboard-review/format";

export default async function AntibioticiPage() {
  const data = await getAntibioticStewardship();
  const latest = data.annual.at(-1);
  const latestAware = data.awareByYear.at(-1);
  const latestSpend = latest?.costEur ?? 0;
  const latestDdd = latest?.dddCount ?? 0;
  const reserveShare = latestAware && latestSpend > 0 ? latestAware.reserve / latestSpend : null;
  const watchDddShare = latestAware && latestDdd > 0 ? latestAware.watchDdd / latestDdd : null;
  const highCostUnits = data.units.filter((unit) => {
    if (unit.costPerDdd === null || data.orgIndicators?.costPerDdd === null || data.orgIndicators?.costPerDdd === undefined) return false;
    return unit.costPerDdd > data.orgIndicators.costPerDdd;
  }).length;
  const hasPopulation = data.orgIndicators?.dddPer1000ResidentsDay !== null;
  const modeLabel = data.mode === "synthetic" ? "Demo sintetica" : "Dati autorizzati";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Antibiotici AWaRe"
        title="Consumo e costo, nella stessa decisione."
        description="Il confronto mostra quando la spesa scende ma l’esposizione cresce, con dettaglio per categoria e unità organizzativa."
        period={data.latestYear ? `2023–${data.latestYear}` : "Periodo non disponibile"}
        scope={modeLabel}
      />

      {data.mode === "synthetic" && (
        <TemplateNotice label="Dati sintetici" source={data.sourceLabel} />
      )}

      <DecisionFrame
        changed={latest ? `Spesa ${latest.costYoy === null ? "N/D" : formatPercent(latest.costYoy)} · DDD ${latest.dddYoy === null ? "N/D" : formatPercent(latest.dddYoy)}.` : "Confronto non disponibile."}
        variance={reserveShare === null || watchDddShare === null ? "Composizione non disponibile." : `Reserve ${formatPercent(reserveShare)} della spesa · Watch ${formatPercent(watchDddShare)} delle DDD.`}
        materiality={latest ? `${formatEur(latest.costEur)} · ${formatNumber(latest.dddCount, 0)} DDD.` : "Materialità non disponibile."}
        nextEvidence={data.units.length > 0 ? `${highCostUnits} unità sopra la media €/DDD.` : "Caricare il dettaglio delle unità."}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <KpiCard accent label="Spesa" value={latest ? formatEur(latest.costEur) : "N/D"} detail={latest ? <Delta value={latest.costYoy} /> : undefined} icon={CircleDollarSign} />
        <KpiCard label="DDD / 100 gg" value={data.orgIndicators?.dddPer100BedDays === null || data.orgIndicators?.dddPer100BedDays === undefined ? "N/D" : formatNumber(data.orgIndicators.dddPer100BedDays)} detail="Consumo ospedaliero" icon={BedSingle} />
        <KpiCard label="Spesa / DDD" value={data.orgIndicators?.costPerDdd === null || data.orgIndicators?.costPerDdd === undefined ? "N/D" : formatEurPrecise(data.orgIndicators.costPerDdd)} detail="Costo normalizzato" icon={BadgeEuro} />
        <KpiCard label="DDD / 1.000 die" value={data.orgIndicators?.dddPer1000ResidentsDay === null || data.orgIndicators?.dddPer1000ResidentsDay === undefined ? "N/D" : formatNumber(data.orgIndicators.dddPer1000ResidentsDay, 2)} detail={hasPopulation ? "Popolazione versionata" : "Denominatore richiesto"} icon={UsersRound} />
        <KpiCard label="Spesa pro capite" value={data.orgIndicators?.costPerCapita === null || data.orgIndicators?.costPerCapita === undefined ? "N/D" : formatEurPrecise(data.orgIndicators.costPerCapita)} detail="Anno più recente" icon={Gauge} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Traiettoria</p>
                <CardTitle className="font-display mt-1 text-xl">Spesa e DDD · indice 2023</CardTitle>
              </div>
              {latest && (
                <div className="flex gap-2 text-[10px] font-semibold">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Spesa {latest.costYoy === null ? "N/D" : formatPercent(latest.costYoy)}</span>
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">DDD {latest.dddYoy === null ? "N/D" : formatPercent(latest.dddYoy)}</span>
                </div>
              )}
            </div>
            <CardDescription>Due direzioni diventano immediatamente visibili.</CardDescription>
          </CardHeader>
          <CardContent><AntibioticIndexChart data={data.annual} /></CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Composizione</p>
            <CardTitle className="font-display text-xl">Access · Watch · Reserve</CardTitle>
            <CardDescription>Alterna spesa e DDD.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[440px]"><AwareBarChart data={data.awareByYear} /></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
        <Card>
          <CardHeader className="pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Unità organizzative</p>
            <CardTitle className="font-display text-xl">Volume × costo normalizzato</CardTitle>
            <CardDescription>La dimensione del punto rappresenta la spesa.</CardDescription>
          </CardHeader>
          <CardContent><AntibioticUnitQuadrant data={data.units} /></CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Priorità</p>
                <CardTitle className="font-display mt-1 text-xl">Unità da approfondire</CardTitle>
              </div>
              <Activity className="text-primary" size={20} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.units.slice(0, 6).map((unit) => (
                <div key={`${unit.orgCode}-${unit.unitCode}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{unit.unitName}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{unit.unitCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-semibold">{unit.costPerDdd === null ? "N/D" : formatEurPrecise(unit.costPerDdd)}</p>
                    <p className="text-[9px] text-muted-foreground">per DDD</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs">{formatEur(unit.costEur)}</p>
                    <p className="text-[9px] text-muted-foreground">spesa</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <MethodologyPanel>
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="font-semibold text-foreground">Definizioni</p><p className="mt-1">DDD/100 giornate, €/giornata, €/DDD, DDD/1.000 abitanti/die e €/abitante usano denominatori annuali coerenti.</p></div>
          <div><p className="font-semibold text-foreground">Qualità</p><p className="mt-1">Il 2025 è completo nel file: categorie, ASL, unità e denominatori sono presenti e A+W+R riconcilia con il totale.</p></div>
          <div><p className="font-semibold text-foreground">Perimetro</p><p className="mt-1">La demo è sintetica. I dati reali sono mostrati soltanto nel perimetro organizzativo autorizzato.</p></div>
        </div>
      </MethodologyPanel>
    </div>
  );
}
