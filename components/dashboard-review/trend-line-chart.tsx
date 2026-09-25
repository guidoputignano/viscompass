"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEur, formatNumber } from "@/lib/dashboard-review/format";
import {itNumberFormat} from "@/lib/format/it-number";

// A value measured over time is read as a trajectory, not as a set of
// quantities to compare side by side. Bars anchored at zero make three
// nearly equal yearly totals look identical; a line on a scale fitted to
// the data shows the movement that the numbers actually contain. The
// fitted scale is stated in words under every chart, because a y-axis
// that does not start at zero must never be discovered by accident.
// Categorical bars (spend by ATC, counts by institute type) keep their
// zero baseline — this component is only for the time axis.

export interface TrendSeries {
  key: string;
  name: string;
  color: string;
}

export type TrendPoint = { label: string } & Record<string, string | number | null>;

// Axis ticks and the scale caption use compact notation ("25,4 Mld €"):
// a full grouped figure is unreadable at tick size and squeezes the plot.
// The tooltip and the table below still carry the exact value.
// useGrouping is pinned for the same hydration reason as in format.ts.
const compactEur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
  useGrouping: true,
});
const compactNumber = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
  useGrouping: true,
});

function numericValues(points: TrendPoint[], series: TrendSeries[]): number[] {
  return points
    .flatMap((point) => series.map((entry) => point[entry.key]))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

/** Fitted to the data, never below zero, and never a zero-width band. */
function fittedDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.2, Math.abs(max) * 0.015, 1);
  return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
}

// The format is named rather than passed as a function: a server component
// cannot hand a function to a client component, and this chart is used from
// both sides.
export type TrendValueFormat = "eur" | "number";

export function TrendLineChart({
  points,
  series,
  format = "number",
  height = 260,
  ariaLabel,
  table = false,
  tableLabel = "Periodo",
}: {
  points: TrendPoint[];
  series: TrendSeries[];
  format?: TrendValueFormat;
  height?: number;
  ariaLabel: string;
  table?: boolean;
  tableLabel?: string;
}) {
  const formatValue = (value: number) =>
    format === "eur" ? formatEur(value) : formatNumber(value, 0);
  const formatTick = (value: number) =>
    format === "eur" ? compactEur.format(value) : compactNumber.format(value);
  const values = numericValues(points, series);
  if (points.length === 0 || values.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Nessun valore disponibile per questo periodo.
      </div>
    );
  }
  const [low, high] = fittedDomain(values);
  const single = series.length === 1;

  return (
    <div className="min-w-0 text-muted-foreground">
      <p className="mb-3 text-xs">
        Scala verticale adattata: {formatTick(low)}–{formatTick(high)}. Non parte
        necessariamente da zero.
      </p>
      <div style={{ height }} role="img" aria-label={`${ariaLabel}, scala verticale adattata`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 18, bottom: 4, left: 4 }}>
            <CartesianGrid
              vertical={false}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "currentColor", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[low, high]}
              tickFormatter={formatTick}
              tick={{ fill: "currentColor", fontSize: 11 }}
              width={62}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                borderRadius: 12,
                border: "1px solid hsl(var(--border))",
              }}
              formatter={(value: number, name: string) => [formatValue(Number(value)), name]}
            />
            {!single && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {series.map((entry) => (
              <Line
                key={entry.key}
                type="linear"
                dataKey={entry.key}
                name={entry.name}
                stroke={entry.color}
                strokeWidth={3}
                dot={{ r: 4, fill: entry.color }}
                activeDot={{ r: 6 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {table && single && (
        <table className="mt-4 w-full text-xs tabular-nums">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-2 text-left">{tableLabel}</th>
              <th className="text-right">Valore</th>
              <th className="text-right">Δ periodo precedente</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => {
              const current = point[series[0].key];
              const previous = index > 0 ? points[index - 1][series[0].key] : null;
              const change =
                typeof current === "number" &&
                typeof previous === "number" &&
                previous !== 0
                  ? current / previous - 1
                  : null;
              return (
                <tr key={point.label} className="border-t">
                  <td className="py-2">{point.label}</td>
                  <td className="text-right font-medium text-foreground">
                    {typeof current === "number" ? formatValue(current) : "N/D"}
                  </td>
                  <td className="text-right">
                    {change === null
                      ? "—"
                      : `${change >= 0 ? "+" : ""}${itNumberFormat({
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        }).format(change * 100)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
