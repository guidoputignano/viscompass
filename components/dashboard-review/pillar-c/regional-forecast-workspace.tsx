"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard-review/analytics-ui";
import { PillarCSectionBar } from "@/components/dashboard-review/pillar-c/section-navigation";
import { PillarCSectionEmpty, PillarCSectionFrame } from "@/components/dashboard-review/pillar-c/section-frame";
import { PillarCForecastPanel } from "@/components/dashboard-review/pillar-c/forecast-section";
import { PILLAR_C_SECTIONS } from "@/lib/dashboard-review/pillar-c/section-navigation";
import { C_FORECAST_SELECTABLE, type CForecast, type CForecastSelectable } from "@/lib/dashboard-review/pillar-c/review";

// Section 5 «Budget e scenari» is the only section this page renders; the bar names the other five as text.
const BUDGET = PILLAR_C_SECTIONS[4];

/** Only a strictly projected public-source forecast enters this component.
 * No institutional rows, organizations, allocations or count scenarios. The page keeps the six-section order: the
 * section bar, one sentence naming the five sections that are not shown, and section 5 with the forecast. The sentence
 * speaks about this page only, never about the organisation: the same workspace is also mounted when the organisation's
 * analyses are unavailable, and the role=note line of the page stays the only statement about the organisation. */
export function PillarCRegionalForecastWorkspace({ forecast }: { forecast: CForecast }) {
  const params = useSearchParams(), router = useRouter();
  const selected = params.get("c_forecast_series");
  const series: CForecastSelectable = C_FORECAST_SELECTABLE.includes(selected as CForecastSelectable) ? selected as CForecastSelectable : "TOT";
  function update(next: CForecastSelectable) {
    const query = new URLSearchParams();
    if (next !== "TOT") query.set("c_forecast_series", next);
    router.replace(`/dashboard-review/pillar-c${query.size ? `?${query}` : ""}`, { scroll: false });
  }
  return <div className="space-y-8 pb-12 xl:[&_[id]]:scroll-mt-36" data-pillar-c-forecast="signed_in">
    <PageHeader eyebrow="Pillar C" title="Previsione regionale 2026" description="Abruzzo · andamento mensile e intervalli di previsione." />
    <PillarCSectionBar available={[BUDGET.id]} />
    <PillarCSectionEmpty>Quadro decisionale, Destinatari e utilizzo, Portafogli e attribuzione, Fattori di spesa e Priorità ed evidenza non sono disponibili in questa pagina; in Budget e scenari è disponibile solo la previsione regionale. Nessun valore viene sostituito.</PillarCSectionEmpty>
    <PillarCSectionFrame id={BUDGET.id} number={BUDGET.number} title={BUDGET.label} question={BUDGET.question}>
      <section id="previsione" aria-label="Previsione regionale 2026">
        <PillarCForecastPanel forecast={forecast} series={series} onSeries={update} published />
      </section>
    </PillarCSectionFrame>
  </div>;
}
