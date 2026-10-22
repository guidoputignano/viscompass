"use client";

// Decision-facing regional forecast. Validation and model diagnostics stay in
// the evidence packet, not in the dashboard. Forecast amounts are unchanged.

import { useId } from "react";
import dynamic from "next/dynamic";
import { LocalToggle } from "@/components/dashboard-review/pillar-b-local-toggle";
import { itNumber } from "@/lib/format/it-number";
import { C_FORECAST_LABEL, C_FORECAST_SELECTABLE, cMoneyLabel, selectCForecast, type CForecast, type CForecastChartRow, type CForecastSelectable, type CForecastSeries } from "@/lib/dashboard-review/pillar-c/review";
import { cForecastDecision } from "@/lib/dashboard-review/pillar-c/forecast-decision";

const eur = cMoneyLabel;
const ForecastCanvas = dynamic(() => import("@/components/dashboard-review/pillar-c/chart-canvases").then((m) => m.ForecastCanvas), { ssr: false });
const range = (low: string | null, high: string | null) => `${eur(low)} – ${eur(high)}`;
/** Display only: a no-break space between a number and «%» in packet copy, so the sign never wraps onto its own line. Fixed copy writes the escape itself. */
const typeset = (text: string) => text.replace(/(\d) %/g, "$1\u00a0%");
const monthShort = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const monthLong = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const SERIES_SHORT: Record<CForecastSeries, string> = { TOT: "Totale", A: "Classe A", H: "Classe H", C: "Classe C" };
const panelClass = "min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6";
const summaryClass = "cursor-pointer rounded-xl px-4 py-3 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const cardClass = "rounded-xl bg-secondary/50 p-4";
// Band opacities, one source for the chart and its legend, raised on the dark
// card. The 80-percent swatch shows that band as drawn, over the 95-percent band.
const BAND_VARS = "[--fc-band-95:0.14] [--fc-band-80:0.24] [--fc-swatch-80:0.34] dark:[--fc-band-95:0.24] dark:[--fc-band-80:0.28] dark:[--fc-swatch-80:0.45]";
const BAND_FILL = "[&_.fc-band-95_.recharts-area-area]:[fill-opacity:var(--fc-band-95)] [&_.fc-band-80_.recharts-area-area]:[fill-opacity:var(--fc-band-80)]";
// CC BY 4.0 §3(a)(1): attribution, a link to the licence and, where practicable, to the material.
const LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/deed.it";
const SOURCE_URL = "https://www.aifa.gov.it/it/spesa-e-consumo-relativi-al-flusso-della-farmaceutica-convenzionata-e-degli-acquisti-diretti";
const linkClass = "font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
// Quarterly axis ticks; January carries its year. Years are printed raw, never through a number formatter.
const axisLabel = (row: Pick<CForecastChartRow, "month" | "year">) => row.month === 1 ? String(row.year) : monthShort[row.month - 1];

/**
 * Translation-safe (machine translation replaces React's text nodes): what the
 * series selector changes renders inside this keyed element, the only child of
 * its wrapper, replaced whole on each change, as Fresh in pillar-b-panels.tsx.
 */
function SeriesView({ series, className, children }: { series: CForecastSelectable; className?: string; children: React.ReactNode }) {
  return <div><div key={series} className={className}>{children}</div></div>;
}


export function PillarCForecastPanel({ forecast, series, onSeries, published = false }: { forecast: CForecast | undefined; series: CForecastSelectable; onSeries: (series: CForecastSelectable) => void; published?: boolean }) {
  const caption = useId();
  if (!forecast) return <p role="status" className="rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">Il pacchetto di revisione caricato non contiene la previsione regionale. Nessun valore viene stimato o sostituito.</p>;
  const labels = forecast.labels, view = selectCForecast(forecast, series), annual = view.annual;
  const decision = cForecastDecision(forecast, series);
  const admitted = decision !== null && annual !== null;
  const values = view.chart.flatMap((r) => [r.observed, r.band95 ? r.band95[1] : null]).filter((n): n is number => n !== null);
  const max = Math.max(1, ...values.map(Math.abs));
  const divisor = max >= 1_000_000 ? 1_000_000 : max >= 1000 ? 1000 : 1;
  const axisUnit = divisor === 1_000_000 ? "Milioni di euro" : divisor === 1000 ? "Migliaia di euro" : "Euro";
  const firstForecast = view.chart.find((r) => r.year === 2026)?.key;
  const ticks = view.chart.filter((r) => (r.month - 1) % 3 === 0).map((r) => r.key);
  const tick = (key: string) => { const row = view.chart.find((r) => r.key === key); return row ? axisLabel(row) : key; };
  // «Totale annuo · Totale (tutte le classi)» would repeat itself: the total series is named by what it covers.
  const annualScope = series === "TOT" ? "tutte le classi" : view.label;

  return <div className="space-y-5">
    <div role="note" className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4">
      <div className="min-w-[min(100%,16rem)] flex-1"><p className="text-sm font-semibold">{C_FORECAST_LABEL}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Non è una previsione di un’Azienda, né un budget o un tetto di spesa.</p></div>
      <span className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{published ? "Previsione regionale · 2026" : "In revisione · accettazione in attesa"}</span>
    </div>

    <article className={panelClass}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
        <div><h3 className="text-base font-semibold">Previsione regionale mensile 2026 e osservato 2025</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{"Confronta l’andamento previsto con il 2025 provvisorio e leggi le fasce all’80\u00a0% e al 95\u00a0%. Previsione formulata con dati fino a dicembre 2025; non include dati osservati del 2026."}</p></div>
        <LocalToggle label="Serie" value={series} options={C_FORECAST_SELECTABLE.map((s) => ({ value: s, label: SERIES_SHORT[s], title: labels.seriesLabels[s] }))} onChange={onSeries} ariaLabel="Serie della previsione regionale" />
      </div>
      <p className="mb-5 max-w-3xl text-xs leading-5 text-muted-foreground">Sono disponibili il totale, la classe A e la classe H. Non è disponibile una previsione per la classe C; non si ricava sottraendo A e H dal totale.</p>
      <SeriesView series={series} className="space-y-5">
        {admitted ? <>
          <figure aria-labelledby={caption} className={`min-w-0 ${BAND_VARS}`}>
            <figcaption id={caption} className="sr-only">{`${view.label}: spesa regionale osservata nel 2025 (provvisoria, sole righe con spesa valorizzata) e previsione regionale mensile 2026 con intervalli all’80\u00a0% e al 95\u00a0%, in euro. I valori esatti sono nella tabella dei valori.`}</figcaption>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-hidden="true">
              <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-foreground" /><span>Osservato 2025 (provvisorio)</span></span>
              <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-[var(--viz-1)]" /><span>Previsione 2026</span></span>
              <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm bg-[var(--viz-1)] opacity-[var(--fc-swatch-80)]" /><span>{"Intervallo 80\u00a0%"}</span></span>
              <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm bg-[var(--viz-1)] opacity-[var(--fc-band-95)]" /><span>{"Intervallo 95\u00a0%"}</span></span>
              <span className="ml-auto">{axisUnit}</span>
            </div>
            <div className={`h-72 min-w-0 ${BAND_FILL}`} aria-hidden="true" data-chart-slot="forecast">
              <ForecastCanvas chart={view.chart} ticks={ticks} tick={tick} divisor={divisor} firstForecast={firstForecast} />
            </div>
          </figure>
          <div className="border-t border-border pt-5"><h4 className="text-sm font-semibold">In breve · riferimenti per la pianificazione</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">Stime regionali indicative: affiancale agli importi osservati e alle disponibilità approvate prima di prendere decisioni di budget. Il riepilogo annuo e le sue fasce non hanno una verifica storica dedicata.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={cardClass}><p className="text-xs text-muted-foreground">{`Stima annua indicativa 2026 · ${annualScope}`}</p><p className="mt-2 text-lg font-semibold tabular-nums" data-c-forecast-annual>{eur(annual.total)}</p><p className="mt-1 text-[11px] text-muted-foreground">Riferimento regionale, non budget approvato</p></div>
            <div className={cardClass}><p className="text-xs text-muted-foreground">{"Fascia annua indicativa · 80\u00a0%"}</p><p className="mt-2 text-sm font-semibold tabular-nums">{range(annual.low80, annual.high80)}</p><p className="mt-1 text-[11px] text-muted-foreground">Intervallo di previsione, non limite garantito</p></div>
            <div className={cardClass}><p className="text-xs text-muted-foreground">{"Fascia annua indicativa · 95\u00a0%"}</p><p className="mt-2 text-sm font-semibold tabular-nums">{range(annual.low95, annual.high95)}</p><p className="mt-1 text-[11px] text-muted-foreground">Fascia più ampia per considerare l’incertezza</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Mese con maggiore spesa prevista</p><p className="mt-2 text-sm font-semibold" data-c-forecast-peak>{`${monthLong[decision.largestMonth.month - 1]} 2026 · ${eur(decision.largestMonth.point)}`}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Un riferimento per programmare il monitoraggio della spesa.</p></div>
            <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Confronto con il 2025 provvisorio</p>{decision.delta !== null ? <><p className="mt-2 text-sm font-semibold tabular-nums" data-c-forecast-change>{`${decision.delta.startsWith("-") || decision.delta === "0.00" ? "" : "+"}${eur(decision.delta)}${decision.changePct === null ? "" : ` (${decision.changePct.startsWith("-") || decision.changePct === "0.00" ? "" : "+"}${decision.changePct.replace(".", ",")}\u00a0%)`}`}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{`Differenza fra la stima indicativa 2026 e gli importi osservati 2025 (${eur(decision.observed2025Annual)}), sulla stessa base regionale.`}</p></> : <p className="mt-2 text-xs leading-5 text-muted-foreground">Base 2025 incompleta: nessuna variazione annua pubblicata. Usa il profilo mensile per leggere gli importi disponibili.</p>}</div>
          </div>
        </> : <p role="status" className="rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">{`${view.label}: previsione non disponibile per questa selezione.`}</p>}
      </SeriesView>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Osservato 2025 provvisorio: sono sommati solo gli importi valorizzati, senza sostituire i dati mancanti con zero. Le previsioni delle classi A e H non si sommano per ricostruire il totale.</p>
      <details className="mt-5 rounded-xl border border-border"><summary className={summaryClass}>Valori esatti · previsione regionale mensile 2026 e osservato 2025</summary>
        <SeriesView series={series} className="overflow-x-auto px-4 pb-4">
          {admitted ? <table className="w-full text-left text-xs"><caption className="sr-only">{`Previsione regionale mensile 2026 e osservato 2025 · ${view.label}`}</caption>
            <thead><tr>{["Mese", "Previsione 2026", "Intervallo 80\u00a0%", "Intervallo 95\u00a0%", "Osservato 2025 (provvisorio)", "Righe valorizzate 2025"].map((h) => <th scope="col" key={h} className="whitespace-nowrap border-b border-border px-2 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{view.rows.map((r) => <tr key={r.month}>
              <th scope="row" className="border-b border-border/50 px-2 py-3 font-medium">{monthLong[r.month - 1]}</th>
              <td className="whitespace-nowrap border-b border-border/50 px-2 py-3 tabular-nums">{eur(r.forecast.point)}</td>
              <td className="whitespace-nowrap border-b border-border/50 px-2 py-3 tabular-nums">{range(r.forecast.low80, r.forecast.high80)}</td>
              <td className="whitespace-nowrap border-b border-border/50 px-2 py-3 tabular-nums">{range(r.forecast.low95, r.forecast.high95)}</td>
              <td className="whitespace-nowrap border-b border-border/50 px-2 py-3 tabular-nums">{eur(r.observed?.value ?? null)}</td>
              <td className="whitespace-nowrap border-b border-border/50 px-2 py-3 tabular-nums">{r.observed ? `${itNumber(r.observed.rowsValued)} di ${itNumber(r.observed.rowsSource)}${r.observed.blankShareFlagged ? " · quota vuota segnalata" : ""}` : "Non disponibile"}</td>
            </tr>)}</tbody>
            <tfoot>
              <tr><th scope="row" className="px-2 py-3 font-medium">Somma dei 12 valori mensili</th><td className="whitespace-nowrap px-2 py-3 tabular-nums">{eur(annual.monthlyPointsSum)}</td><td colSpan={4} className="px-2 py-3 text-muted-foreground">Valori al centesimo mostrati sopra</td></tr>
              <tr><th scope="row" className="px-2 py-3 font-medium">Stima annua indicativa</th><td className="whitespace-nowrap px-2 py-3 font-semibold tabular-nums">{eur(annual.total)}</td><td className="whitespace-nowrap px-2 py-3 tabular-nums">{range(annual.low80, annual.high80)}</td><td className="whitespace-nowrap px-2 py-3 tabular-nums">{range(annual.low95, annual.high95)}</td><td colSpan={2} className="px-2 py-3 text-muted-foreground">Arrotondato una sola volta; può differire dalla somma dei mesi</td></tr>
            </tfoot>
          </table> : <p className="py-3 text-xs text-muted-foreground">Nessun valore di previsione disponibile.</p>}
        </SeriesView>
      </details>
    </article>

    <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer py-3 text-sm font-medium">Dati e ambito della previsione</summary>
      <dl className="mt-4 space-y-3 text-xs leading-5">
        {[["Territorio", `Regione ${forecast.region}. Le selezioni di Azienda e canale non modificano questa previsione.`], ["Spesa rappresentata", "Acquisti diretti alle strutture pubbliche, inclusi i canali DD e DPC; importi al lordo dell’IVA e del payback."], ["Periodo", "Previsione gennaio–dicembre 2026, formulata con dati disponibili fino a dicembre 2025."], ["Dati osservati", labels.observedNote], ["Lettura degli intervalli", "Le fasce rappresentano l’incertezza della previsione. Quelle annue sono indicative e non sono limiti garantiti né disponibilità approvate."]].map(([term, detail]) => <div key={term}><dt className="font-semibold">{term}</dt><dd className="mt-1 text-muted-foreground">{typeset(detail)}</dd></div>)}
        <div><dt className="font-semibold">Fonte e licenza</dt><dd className="mt-1 text-muted-foreground"><span>{labels.attribution}</span> <a href={LICENCE_URL} target="_blank" rel="license noopener noreferrer" className={linkClass}>Licenza</a> · <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>Dati e documentazione AIFA</a></dd></div>
      </dl>
    </details>
  </div>;
}
