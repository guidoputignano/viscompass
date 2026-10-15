"use client";

// Regional public-data forecast (AIFA tracciabilità). Not an Azienda forecast,
// budget, ceiling or clinical estimate; its acceptance is pending. Every value
// comes from the validated forecast section of the review packet: nothing is
// estimated, extended or summed here, except the chart's Number coordinates.

import { useId } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LocalToggle } from "@/components/dashboard-review/pillar-b-local-toggle";
import { itNumber } from "@/lib/format/it-number";
import { C_FORECAST_LABEL, C_FORECAST_SELECTABLE, cMoneyLabel, selectCForecast, type CForecast, type CForecastAdmission, type CForecastChartRow, type CForecastSelectable, type CForecastSeries } from "@/lib/dashboard-review/pillar-c/review";

const eur = cMoneyLabel;
const range = (low: string | null, high: string | null) => `${eur(low)} – ${eur(high)}`;
/** Display only: a no-break space between a number and «%» in packet copy, so the sign never wraps onto its own line. Fixed copy writes the escape itself. */
const typeset = (text: string) => text.replace(/(\d) %/g, "$1\u00a0%");
const monthShort = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const monthLong = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const SERIES_SHORT: Record<CForecastSeries, string> = { TOT: "Totale", A: "Classe A", H: "Classe H", C: "Classe C" };
const chartTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, color: "hsl(var(--foreground))" };
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
// Admission metrics are registered decimals; Number is used for reading them, never for a decision.
const decimal = (value: string) => itNumber(Number(value), { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const whole = (value: string) => itNumber(Number(value), { maximumFractionDigits: 0 });
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

function ForecastTooltip({ row }: { row?: CForecastChartRow }) {
  if (!row) return null;
  const lines = row.year === 2025
    ? [["Osservato (provvisorio)", eur(row.exact.observed)], ["Righe valorizzate", row.rows ? `${itNumber(row.rows.valued)} di ${itNumber(row.rows.source)}` : "Non disponibile"]]
    : [["Previsione regionale", eur(row.exact.point)], ["Intervallo 80\u00a0%", range(row.exact.low80, row.exact.high80)], ["Intervallo 95\u00a0%", range(row.exact.low95, row.exact.high95)]];
  return <div key={row.key} style={tooltipStyle} className="px-3 py-2 text-xs shadow-sm"><p className="font-semibold">{`${monthLong[row.month - 1]} ${String(row.year)}`}</p>{lines.map(([label, value]) => <p key={label} className="mt-1 tabular-nums">{`${label}: ${value}`}</p>)}</div>;
}

/** «condizione non soddisfatta: …» or, for several, «condizioni non soddisfatte: … · …». */
function unmet(conditions: string[]): string {
  return `${conditions.length > 1 ? "condizioni non soddisfatte" : "condizione non soddisfatta"}: ${conditions.join(" · ")}`;
}

function admissionNote(a: CForecastAdmission, labels: CForecast["labels"]): string {
  // The registered rejection reason is shown verbatim, under its own lead.
  if (a.decision === "RIFIUTATA") return typeset(`Motivo del rifiuto (registrato): ${a.rejection?.reason ?? "non disponibile"}`);
  const others = a.variants.flatMap((v) => v.candidates.filter((c) => !c.admitted).map((c) => `${labels.models[c.candidate]}, ${labels.variants[v.variant]}: non ammesso (${unmet(c.failedConditions.map((k) => labels.conditions[k]))}).`));
  return typeset(others.length ? `Motivazione: modello registrato ammesso in ogni variante. ${others.join(" ")}` : "Motivazione: modello registrato ammesso in ogni variante; anche il candidato alternativo supera le condizioni.");
}

export function PillarCForecastPanel({ forecast, series, onSeries }: { forecast: CForecast | undefined; series: CForecastSelectable; onSeries: (series: CForecastSelectable) => void }) {
  const caption = useId();
  if (!forecast) return <p role="status" className="rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">Il pacchetto di revisione caricato non contiene la previsione regionale. Nessun valore viene stimato o sostituito.</p>;
  const labels = forecast.labels, view = selectCForecast(forecast, series), annual = view.annual;
  const admitted = view.admission?.decision === "AMMESSA" && annual !== null && view.rows.length === 12;
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
      <span className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">In revisione · accettazione in attesa</span>
    </div>

    <article className={panelClass}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
        <div><h3 className="text-base font-semibold">Previsione regionale mensile 2026 e osservato 2025</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{"Punto mensile con intervalli all’80\u00a0% e al 95\u00a0%. Previsione formulata con dati fino a dicembre 2025; non include dati osservati del 2026. Il 2025 osservato è il contesto della previsione. Ogni serie è un modello separato."}</p></div>
        <LocalToggle label="Serie" value={series} options={C_FORECAST_SELECTABLE.map((s) => ({ value: s, label: SERIES_SHORT[s], title: labels.seriesLabels[s] }))} onChange={onSeries} ariaLabel="Serie della previsione regionale" />
      </div>
      <p className="mb-5 max-w-3xl text-xs leading-5 text-muted-foreground">Classe C non ammessa: nessuna previsione (vedi «Ammissione delle serie»). La differenza fra il totale e le classi A e H non è una previsione della classe C.</p>
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
            <div className={`h-72 min-w-0 ${BAND_FILL}`} aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart data={view.chart} margin={{ top: 16, right: 10, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="key" ticks={ticks} tickFormatter={tick} interval="preserveStartEnd" minTickGap={6} axisLine={false} tickLine={false} tick={chartTick} />
                  <YAxis tickFormatter={(n) => itNumber(Number(n) / divisor, { maximumFractionDigits: 1 })} domain={[0, "auto"]} width={55} axisLine={false} tickLine={false} tick={chartTick} />
                  <Tooltip cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }} content={({ active, payload }) => <ForecastTooltip row={active ? payload?.[0]?.payload as CForecastChartRow | undefined : undefined} />} />
                  {firstForecast && <ReferenceLine x={firstForecast} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" label={{ value: "Previsione", position: "insideTopLeft", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />}
                  <Area className="fc-band-95" dataKey="band95" type="linear" stroke="none" fill="var(--viz-1)" fillOpacity={0.14} connectNulls={false} dot={false} activeDot={false} legendType="none" isAnimationActive={false} />
                  <Area className="fc-band-80" dataKey="band80" type="linear" stroke="none" fill="var(--viz-1)" fillOpacity={0.24} connectNulls={false} dot={false} activeDot={false} legendType="none" isAnimationActive={false} />
                  <Line dataKey="observed" type="linear" stroke="hsl(var(--foreground))" strokeWidth={2} connectNulls={false} dot={{ r: 2.5, strokeWidth: 0, fill: "hsl(var(--foreground))" }} activeDot={{ r: 4 }} isAnimationActive={false} />
                  {/* A 1px card-coloured halo under the dashed point line keeps it apart from the band of the same hue. */}
                  <Line dataKey="point" type="linear" stroke="hsl(var(--card))" strokeWidth={4} strokeDasharray="6 4" connectNulls={false} dot={false} activeDot={false} legendType="none" tooltipType="none" isAnimationActive={false} />
                  <Line dataKey="point" type="linear" stroke="var(--viz-1)" strokeWidth={2} strokeDasharray="6 4" connectNulls={false} dot={{ r: 2.5, strokeWidth: 0, fill: "var(--viz-1)" }} activeDot={{ r: 4 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </figure>
          {/* The annual figures are supplementary, so they follow the monthly chart and carry their qualifier on every card. */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={cardClass}><p className="text-xs text-muted-foreground">{`Previsione regionale · totale annuo 2026 · ${annualScope}`}</p><p className="mt-2 text-sm font-semibold tabular-nums">{eur(annual.total)}</p><p className="mt-1 text-[11px] text-muted-foreground">Supplementare, non sottoposto a backtest</p></div>
            <div className={cardClass}><p className="text-xs text-muted-foreground">{"Intervallo annuo 80\u00a0% · supplementare, non sottoposto a backtest"}</p><p className="mt-2 text-sm font-semibold tabular-nums">{range(annual.low80, annual.high80)}</p></div>
            <div className={cardClass}><p className="text-xs text-muted-foreground">{"Intervallo annuo 95\u00a0% · supplementare, non sottoposto a backtest"}</p><p className="mt-2 text-sm font-semibold tabular-nums">{range(annual.low95, annual.high95)}</p></div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{view.roundingDifference !== null && view.roundingDifference !== "0"
            ? `Il totale annuo è la somma dei dodici punti mensili non arrotondati, arrotondata una sola volta al centesimo; la somma dei valori mensili in tabella è ${eur(annual.monthlyPointsSum)}. La differenza è solo di arrotondamento.`
            : "Il totale annuo è la somma dei dodici punti mensili, arrotondata al centesimo; coincide con la somma dei valori mensili in tabella."}</p>
        </> : <p role="status" className="rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">{`${view.label}: nessuna previsione mostrata.${view.admission?.rejection ? ` ${typeset(`Motivo del rifiuto (registrato): ${view.admission.rejection.reason}`)}` : ""}`}</p>}
      </SeriesView>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">{`Osservato 2025 = somma delle sole righe con spesa valorizzata, senza stima delle righe vuote; la previsione 2026 riguarda la stessa base. ${typeset(labels.observedNote)}`}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{typeset(labels.reading)}</p>
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
              <tr><th scope="row" className="px-2 py-3 font-medium">Totale annuo · supplementare, non sottoposto a backtest</th><td className="whitespace-nowrap px-2 py-3 font-semibold tabular-nums">{eur(annual.total)}</td><td className="whitespace-nowrap px-2 py-3 tabular-nums">{range(annual.low80, annual.high80)}</td><td className="whitespace-nowrap px-2 py-3 tabular-nums">{range(annual.low95, annual.high95)}</td><td colSpan={2} className="px-2 py-3 text-muted-foreground">Su punti mensili non arrotondati</td></tr>
            </tfoot>
          </table> : <p className="py-3 text-xs text-muted-foreground">Nessun valore di previsione per una serie non ammessa.</p>}
        </SeriesView>
      </details>
    </article>

    <article className={panelClass}>
      <div className="mb-5"><h3 className="text-base font-semibold">Ammissione delle serie</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{`Quattro serie valutate con le condizioni registrate (emendamenti ${labels.amendments.join(", ")}). Una serie non ammessa non riceve alcuna previsione.`}</p></div>
      {/* The reason sits on its own full-width row, so it stays readable on a phone without sideways scrolling. */}
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Esito dell’ammissione per serie, con la motivazione sotto ciascuna serie</caption>
        <thead><tr>{["Serie", "Esito", "Modello"].map((h) => <th scope="col" key={h} className="border-b border-border px-2 py-3 font-semibold">{h}</th>)}</tr></thead>
        {forecast.admission.map((a) => <tbody key={a.series} className="border-b border-border/50">
          <tr data-series={a.series} data-decision={a.decision}>
            <th scope="row" className="px-2 pb-1 pt-3 align-top font-medium">{labels.seriesLabels[a.series]}</th>
            <td className="px-2 pb-1 pt-3 align-top font-semibold">{a.decision === "AMMESSA" ? "Ammessa" : "Non ammessa"}</td>
            <td className="px-2 pb-1 pt-3 align-top">{a.model ? labels.models[a.model] : "Nessuna previsione"}</td>
          </tr>
          <tr data-reason-for={a.series}><td colSpan={3} className="px-2 pb-3 pt-1 leading-5 text-muted-foreground">{admissionNote(a, labels)}</td></tr>
        </tbody>)}
      </table></div>
      {/* The registered reason codes are not rendered: this table names each candidate's unmet conditions through the packet's labels. */}
      <details className="mt-5 rounded-xl border border-border"><summary className={summaryClass}>Metriche di ammissione per variante e candidato</summary>
        <div className="overflow-x-auto px-4 pb-4"><table className="w-full text-left text-xs"><caption className="pb-3 pt-1 text-left text-muted-foreground">{typeset(`Valori registrati, arrotondati per la lettura. Condizioni: ${Object.values(labels.conditions).join(" · ")}.`)}</caption>
          <thead><tr>{["Serie", "Variante", "Candidato", "Esito", "MASE / soglia", "Copertura 80\u00a0%", "Copertura 95\u00a0%", "Winkler 80\u00a0% / baseline"].map((h) => <th scope="col" key={h} className="whitespace-nowrap border-b border-border px-2 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{forecast.admission.flatMap((a) => a.variants.flatMap((v) => v.candidates.map((c) => <tr key={`${a.series}-${v.variant}-${c.candidate}`}>
            <th scope="row" className="whitespace-nowrap border-b border-border/50 px-2 py-3 font-medium">{SERIES_SHORT[a.series]}</th>
            <td className="whitespace-nowrap border-b border-border/50 px-2 py-3">{labels.variants[v.variant]}</td>
            <td className="whitespace-nowrap border-b border-border/50 px-2 py-3">{labels.models[c.candidate]}</td>
            <td className="border-b border-border/50 px-2 py-3">{c.admitted ? "Ammesso" : typeset(`Non ammesso (${unmet(c.failedConditions.map((k) => labels.conditions[k]))})`)}</td>
            <td className="whitespace-nowrap border-b border-border/50 px-2 py-3 tabular-nums">{`${decimal(c.mase)} / ${decimal(c.maseThreshold)}`}</td>
            <td className="whitespace-nowrap border-b border-border/50 px-2 py-3 tabular-nums">{decimal(c.coverage80)}</td>
            <td className="whitespace-nowrap border-b border-border/50 px-2 py-3 tabular-nums">{decimal(c.coverage95)}</td>
            <td className="whitespace-nowrap border-b border-border/50 px-2 py-3 tabular-nums">{`${whole(c.winkler80)} / ${whole(v.winkler80Baseline)}`}</td>
          </tr>)))}</tbody>
        </table></div>
      </details>
    </article>

    <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Base, metodo e limiti della previsione</summary>
      <dl className="mt-4 space-y-3 text-xs leading-5">
        {[["Ambito", `Regione ${forecast.region} · dati pubblici, nessun dato aziendale`], ["Base della spesa", labels.base], ["Metodo", labels.method], ["Limiti", labels.caveats], ["Serie osservata", `${labels.observed}. ${labels.observedNote}`], ["Totale annuo", labels.annualType], ["Nota", labels.note], ["Stato", `${labels.tier} · in revisione, accettazione in attesa`]].map(([term, detail]) => <div key={term}><dt className="font-semibold">{term}</dt><dd className="mt-1 text-muted-foreground">{typeset(detail)}</dd></div>)}
      </dl>
    </details>
    {/* The packet's attribution names the source, the licence and the modification; the links complete CC BY 4.0 §3(a)(1). */}
    <p className="text-[11px] leading-5 text-muted-foreground"><span>{labels.attribution}</span> <a href={LICENCE_URL} target="_blank" rel="license noopener noreferrer" className={linkClass}>Licenza</a> · <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>Dati e documentazione AIFA</a></p>
  </div>;
}
