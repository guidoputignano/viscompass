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
import { PillarAWorkbookSection } from "@/components/dashboard-review/pillar-a-workbook";
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
  const hasPopulation = data.orgIndicators?.dddPer1000ResidentsDay != null;
  const hasBedDays = data.orgIndicators?.dddPer100BedDays != null;
  const costLabel = data.costBasis === 'CO1' ? 'Costo CO1' : 'Spesa';
  const modeLabel = data.mode === "synthetic" ? "Demo sintetica" : "Dati autorizzati";

  // Both ends derived from the data. This read `2023–${data.latestYear}`, which
  // took the trouble to derive the end year and then wrote the start as a
  // literal — so an organization onboarded after 2023, or one whose 2023
  // extract was never authorized, showed a header reading "2023" above an axis
  // that starts at 2024. data.annual is sorted ascending in queries.ts, and is
  // preferred over latestYear because latestYear is derived separately.
  const baseYear = data.annual.length > 0 ? data.annual[0].year : null;
  const periodLabel =
    data.annual.length > 0
      ? `${data.annual[0].year}–${data.annual[data.annual.length - 1].year}`
      : "Periodo non disponibile";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Antibiotici AWaRe"
        title="Consumo e costo, nella stessa decisione."
        description="Il confronto mostra quando la spesa scende ma l’esposizione cresce, con dettaglio per categoria e unità organizzativa."
        period={periodLabel}
        scope={modeLabel}
      />

      {data.mode === "synthetic" && (
        <TemplateNotice label="Dati sintetici" source={data.sourceLabel} />
      )}
      {data.mode === 'real' && <details className="rounded-xl border bg-card p-4 text-sm text-muted-foreground"><summary className="cursor-pointer">Base dei costi del riepilogo</summary><p className="mt-2">
        {data.costBasis === 'CO1' ? 'Riepilogo Dati_CO: costi normalizzati CO1 e DDD della fonte.' : 'Riepilogo dei costi e delle DDD della fonte autorizzata.'}
        {' '}Tutti i valori di spesa, le quote e le variazioni in questo riepilogo usano questa base. Il workbook verificato sotto distingue invece CF e CMR: basi diverse non sono intercambiabili.
      </p></details>}

      <DecisionFrame
        changed={latest ? `${costLabel} ${latest.costYoy === null ? "N/D" : formatPercent(latest.costYoy)} · DDD ${latest.dddYoy === null ? "N/D" : formatPercent(latest.dddYoy)}.` : "Confronto non disponibile."}
        variance={reserveShare === null || watchDddShare === null ? "Composizione non disponibile." : `Reserve ${formatPercent(reserveShare)} della spesa · Watch ${formatPercent(watchDddShare)} delle DDD.`}
        materiality={latest ? `${formatEur(latest.costEur)} · ${formatNumber(latest.dddCount, 0)} DDD.` : "Materialità non disponibile."}
        nextEvidence={data.units.length > 0 ? `${highCostUnits} unità sopra la media €/DDD.` : "Caricare il dettaglio delle unità."}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <KpiCard accent label={costLabel} value={latest ? formatEur(latest.costEur) : "N/D"} detail={latest ? <Delta value={latest.costYoy} /> : undefined} icon={CircleDollarSign} />
        <KpiCard label="DDD fornite" value={latest ? formatNumber(latest.dddCount, 0) : "N/D"} detail={latest ? <Delta value={latest.dddYoy} /> : undefined} icon={Activity} />
        <KpiCard label={`${costLabel} / DDD`} value={data.orgIndicators?.costPerDdd === null || data.orgIndicators?.costPerDdd === undefined ? "N/D" : formatEurPrecise(data.orgIndicators.costPerDdd)} detail="Base del riepilogo" icon={BadgeEuro} />
        {hasBedDays && <KpiCard label="DDD / 100 gg" value={formatNumber(data.orgIndicators!.dddPer100BedDays!)} detail="Giornate del riepilogo" icon={BedSingle} />}
        {hasPopulation && <><KpiCard label="DDD / 1.000 abitanti / die" value={formatNumber(data.orgIndicators!.dddPer1000ResidentsDay!, 2)} detail="Popolazione dello stesso anno" icon={UsersRound} />
        <KpiCard label="Spesa pro capite" value={formatEurPrecise(data.orgIndicators!.costPerCapita!)} detail="Popolazione dello stesso anno" icon={Gauge} /></>}
      </div>
      {(!hasBedDays || !hasPopulation) && <details className="rounded-xl border bg-card p-4 text-sm"><summary className="cursor-pointer">Indicatori non disponibili: perché N/D?</summary><ul className="mt-3 space-y-2 text-muted-foreground">
        {!hasBedDays && <li>DDD/100 giornate: mancano giornate coerenti e positive nel riepilogo. L’attività A3/T1 del workbook sotto è una misura distinta e non viene sostituita alle giornate.</li>}
        {!hasPopulation && <li>DDD/1.000 abitanti/die e spesa pro capite: manca la popolazione di riferimento dell’Azienda per lo stesso anno. La popolazione regionale pubblica non viene assegnata automaticamente a un’ASL.</li>}
      </ul></details>}

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Traiettoria</p>
                <CardTitle className="font-display mt-1 text-xl">Spesa e DDD · indice {baseYear ?? "—"}</CardTitle>
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
            <CardDescription>Confronta spesa, DDD e costo medio per DDD.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[440px]"><AwareBarChart data={data.awareByYear} /></div>
          </CardContent>
        </Card>
      </div>

      {data.units.length > 0 ? <div className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
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
      </div> : <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Dettaglio per reparto non presente nella fonte caricata. Le analisi per Azienda sono nel workbook sotto.</p>}

      <MethodologyPanel>
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="font-semibold text-foreground">Rapporti</p><p className="mt-1">Denominatori positivi e dello stesso anno. 365 o 366 giorni per le misure giornaliere.</p></div>
          <div><p className="font-semibold text-foreground">N/D</p><p className="mt-1">Dato mancante o denominatore nullo. Non significa zero.</p></div>
          <div><p className="font-semibold text-foreground">Accesso</p><p className="mt-1">Solo il perimetro autorizzato. Eventuali dati sintetici sono indicati come demo.</p></div>
        </div>
      </MethodologyPanel>
      {/* Pillar A is the same J01 analysis for the same organization, so it lives
          here rather than as a second module. Renders nothing until private
          activation is approved. */}
      <PillarAWorkbookSection summary={data.mode === 'real' ? data.annual : undefined} />
    </div>
  );
}
