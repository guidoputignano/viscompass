"use client";

/** Point 19: the chart library, loaded only after hydration.
 *
 * Every recharts drawing of the Pillar C page lives here, and the page modules import it through next/dynamic with
 * ssr:false (review-blocks.tsx, forecast-section.tsx, attribution-analysis.tsx, portfolio-dossier.tsx, insight-chart.tsx).
 * The server renders each chart's fixed-height, labelled wrapper as before, so nothing moves when the drawing arrives;
 * recharts' ResponsiveContainer drew nothing on the server anyway. The exact values stay in the tables beside each
 * chart. This module carries no organisation key or label: it draws what it is given. */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { itNumber } from "@/lib/format/it-number";
import { cMoneyLabel, type CForecastChartRow } from "@/lib/dashboard-review/pillar-c/review";
import { cWorkbookDecimal } from "@/lib/dashboard-review/pillar-c/workbook";
import { cAttrShare } from "@/lib/dashboard-review/pillar-c/attribution";
import { cAttrAxis, cAttrPercent } from "@/lib/dashboard-review/pillar-c/attribution-format";
import type { CInsightPoint } from "@/lib/dashboard-review/pillar-c/chart-kinds";

const eur = cMoneyLabel;
const fmt = (value: number) => itNumber(value, { maximumFractionDigits: 1 });
const money = (v: string, digits = 0) => `${cWorkbookDecimal(v, digits)} €`;
const chartTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, color: "hsl(var(--foreground))" };

// ---------------------------------------------------------------- review-blocks.tsx: spend by month
type SpendMonth = { month: number; amount: number | null; exact: string | null; rows: number; label: string };
export function SpendCanvas({ monthly, divisor, trend }: { monthly: SpendMonth[]; divisor: number; trend: "monthly" | "cumulative" }) {
  const label = trend === "monthly" ? "Spesa netta" : "Spesa cumulata";
  const value = (v: number, item: { payload?: SpendMonth }) => item.payload?.exact == null ? "Non disponibile" : eur(item.payload.exact ?? v);
  return <ResponsiveContainer width="100%" height="100%" minWidth={0}>
    {trend === "monthly" ? <BarChart data={monthly} margin={{ top: 12, right: 10, left: 8, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={chartTick} />
      <YAxis tickFormatter={(n) => fmt(Number(n) / divisor)} width={55} axisLine={false} tickLine={false} tick={chartTick} />
      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
      <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} formatter={(v: number, _name, item) => [value(v, item), label]} />
      <Bar dataKey="amount" isAnimationActive={false} radius={[4, 4, 0, 0]}>{monthly.map((r) => <Cell key={r.month} fill={(r.amount ?? 0) < 0 ? "var(--viz-4)" : "var(--viz-1)"} />)}</Bar>
    </BarChart> : <LineChart data={monthly} margin={{ top: 12, right: 10, left: 8, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={chartTick} />
      <YAxis tickFormatter={(n) => fmt(Number(n) / divisor)} width={55} axisLine={false} tickLine={false} tick={chartTick} />
      <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} formatter={(v: number, _name, item) => [value(v, item), label]} />
      <Line dataKey="amount" type="linear" connectNulls={false} stroke="var(--viz-1)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--viz-1)" }} isAnimationActive={false} />
    </LineChart>}
  </ResponsiveContainer>;
}

// ---------------------------------------------------------------- forecast-section.tsx: regional forecast
const range = (low: string | null, high: string | null) => `${eur(low)} – ${eur(high)}`;
const monthLong = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
function ForecastTooltip({ row }: { row?: CForecastChartRow }) {
  if (!row) return null;
  const lines = row.year === 2025
    ? [["Osservato (provvisorio)", eur(row.exact.observed)], ["Righe valorizzate", row.rows ? `${itNumber(row.rows.valued)} di ${itNumber(row.rows.source)}` : "Non disponibile"]]
    : [["Previsione regionale", eur(row.exact.point)], ["Intervallo 80 %", range(row.exact.low80, row.exact.high80)], ["Intervallo 95 %", range(row.exact.low95, row.exact.high95)]];
  return <div key={row.key} style={tooltipStyle} className="px-3 py-2 text-xs shadow-sm"><p className="font-semibold">{`${monthLong[row.month - 1]} ${String(row.year)}`}</p>{lines.map(([label, value]) => <p key={label} className="mt-1 tabular-nums">{`${label}: ${value}`}</p>)}</div>;
}
export function ForecastCanvas({ chart, ticks, tick, divisor, firstForecast }: { chart: CForecastChartRow[]; ticks: string[]; tick: (key: string) => string; divisor: number; firstForecast: string | undefined }) {
  return <ResponsiveContainer width="100%" height="100%" minWidth={0}>
    <ComposedChart data={chart} margin={{ top: 16, right: 10, left: 8, bottom: 0 }}>
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
  </ResponsiveContainer>;
}

// ---------------------------------------------------------------- attribution-analysis.tsx: composition and Pareto
export function AttributionDonutCanvas({ data, colors }: { data: { id: string; name: string; value: number; raw: string }[]; colors: Record<string, string> }) {
  return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="63%" outerRadius="88%" paddingAngle={2} isAnimationActive={false}>{data.map((r) => <Cell key={r.id} fill={colors[r.id]} />)}</Pie><Tooltip formatter={(_value, name, entry) => [money(entry.payload.raw, 2), String(name)]} /></PieChart></ResponsiveContainer>;
}
type ParetoRow = { rank: number; amount: number; cumulativeShare: number; abs: string; cumulative: string; label: string };
export function AttributionParetoCanvas({ plotted, total }: { plotted: ParetoRow[]; total: string }) {
  return <ResponsiveContainer width="100%" height="100%"><ComposedChart data={plotted} margin={{ left: 0, right: 0, top: 8, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="rank" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis yAxisId="amount" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={55} tickFormatter={(v) => cAttrAxis(Number(v), Math.max(0, ...plotted.map((r) => r.amount)))} /><YAxis yAxisId="share" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}%`} /><Tooltip labelFormatter={(label) => `Posizione ${label}`} formatter={(_value, name, entry) => name === "Quota cumulata" ? [cAttrPercent(cAttrShare(entry.payload.cumulative, total)), String(name)] : [money(entry.payload.abs, 2), entry.payload.label]} /><ReferenceLine yAxisId="share" y={80} stroke="#8672ba" strokeDasharray="4 4" /><Bar yAxisId="amount" dataKey="amount" name="Esposizione assoluta" fill="#19998f" radius={[4, 4, 0, 0]} isAnimationActive={false} /><Line yAxisId="share" dataKey="cumulativeShare" name="Quota cumulata" stroke="#d89b38" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} /></ComposedChart></ResponsiveContainer>;
}

// ---------------------------------------------------------------- portfolio-dossier.tsx: monthly line
type PortfolioMonth = { month: string; selected: number | null; comparison: number | null; raw: string | null; otherRaw: string | null };
export function PortfolioMonthlyCanvas({ chart, maximum, selectedName, comparisonName }: { chart: PortfolioMonth[]; maximum: number; selectedName: string; comparisonName: string }) {
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 12, left: 0, right: 12, bottom: 5 }}><CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--border)" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><YAxis width={68} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => cAttrAxis(Number(v), maximum)} /><Tooltip formatter={(_v, name, entry) => { const raw = name === selectedName ? entry.payload.raw : entry.payload.otherRaw; return [raw === null ? "Nessun record" : money(raw, 2), String(name)]; }} /><Line name={selectedName} dataKey="selected" stroke="#19998f" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} /><Line name={comparisonName} dataKey="comparison" stroke="#8e7ab5" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>;
}

// ---------------------------------------------------------------- insight-chart.tsx: line and area views
const short = (s: string, n = 33) => s.length > n ? `${s.slice(0, n - 1)}…` : s;
export function InsightLineCanvas({ kind, data, id, metric, comparison, heading, axis }: { kind: "line" | "area"; data: (CInsightPoint & { value: number | null | undefined; other: number | null | undefined })[]; id: string; metric: number; comparison: number; heading: (c: number) => string; axis: (v: number, c: number) => string }) {
  const shared = <><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="name" minTickGap={35} tick={{ fontSize: 10 }} tickFormatter={(v) => short(String(v), 18)} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => axis(v, metric)} /><Tooltip content={({ active: shown, payload }) => {
    const p = payload?.[0]?.payload as CInsightPoint | undefined;
    return shown && p ? <div className="max-w-sm rounded-xl border border-border bg-card p-3 text-xs shadow-lg"><p className="font-medium">{p.name}</p><p className="mt-2">{heading(metric)}: {p.values[metric]?.exact}</p>{comparison >= 0 && <p>{heading(comparison)}: {p.values[comparison]?.exact}</p>}</div> : null;
  }} /></>;
  return <ResponsiveContainer width="100%" height="100%">{kind === "area" ? <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 8 }}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--viz-1)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--viz-1)" stopOpacity={0.02} /></linearGradient></defs>{shared}<Area type="linear" dataKey="value" fill={`url(#${id})`} stroke="var(--viz-1)" strokeWidth={2.5} connectNulls={false} isAnimationActive={false} />{comparison >= 0 && <Area type="linear" dataKey="other" fill="transparent" stroke="var(--viz-2)" strokeWidth={2} strokeDasharray="5 4" connectNulls={false} isAnimationActive={false} />}</AreaChart> : <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 8 }}>{shared}<Line type="linear" dataKey="value" stroke="var(--viz-1)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />{comparison >= 0 && <Line type="linear" dataKey="other" stroke="var(--viz-2)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />}</LineChart>}</ResponsiveContainer>;
}
