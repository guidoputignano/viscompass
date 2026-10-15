"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard-review/analytics-ui";
import { PillarCForecastPanel } from "@/components/dashboard-review/pillar-c/forecast-section";
import { C_FORECAST_SELECTABLE, type CForecast, type CForecastSelectable } from "@/lib/dashboard-review/pillar-c/review";

/** Only a strictly projected public-source forecast enters this component.
 * No institutional rows, organizations, allocations or count scenarios. */
export function PillarCRegionalForecastWorkspace({ forecast }: { forecast: CForecast }) {
  const params = useSearchParams(), router = useRouter();
  const selected = params.get("c_forecast_series");
  const series: CForecastSelectable = C_FORECAST_SELECTABLE.includes(selected as CForecastSelectable) ? selected as CForecastSelectable : "TOT";
  function update(next: CForecastSelectable) {
    const query = new URLSearchParams();
    if (next !== "TOT") query.set("c_forecast_series", next);
    router.replace(`/dashboard-review/pillar-c${query.size ? `?${query}` : ""}`, { scroll: false });
  }
  return <div className="space-y-7 pb-12" data-pillar-c-forecast="signed_in">
    <PageHeader eyebrow="Pillar C" title="Previsione regionale 2026" description="Abruzzo · andamento mensile e intervalli di previsione." />
    <section id="previsione" aria-label="Previsione regionale 2026">
      <PillarCForecastPanel forecast={forecast} series={series} onSeries={update} published />
    </section>
  </div>;
}
