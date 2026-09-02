"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import type { AwareYearRow } from "@/lib/dashboard-review/types";
import { formatEur, formatNumber } from "@/lib/dashboard-review/format";

// WHO's AWaRe classification has an internationally recognized
// traffic-light color code (Access=green, Watch=amber, Reserve=red) that
// clinicians reading this chart already know how to interpret — using the
// app's teal instead would work against readability for exactly the
// audience this module is for. One-off exception to the teal-first
// palette, same reasoning as the amber status-badge exception elsewhere.
const ACCESS_COLOR = "hsl(142 45% 40%)";
const WATCH_COLOR = "hsl(38 92% 50%)";
const RESERVE_COLOR = "hsl(12 58% 42%)";
const UNCLASSIFIED_COLOR = "hsl(204 15% 55%)";

export function AwareBarChart({ data }: { data: AwareYearRow[] }) {
  const [metric, setMetric] = useState<"cost" | "ddd">("cost");
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Nessun dato di consumo antibiotico nel proprio ambito.
      </div>
    );
  }

  const chartData = data.map((row) => ({
    year: row.year,
    access: metric === "cost" ? row.access : row.accessDdd,
    watch: metric === "cost" ? row.watch : row.watchDdd,
    reserve: metric === "cost" ? row.reserve : row.reserveDdd,
    unclassified: metric === "cost" ? row.unclassified : row.unclassifiedDdd,
  }));
  const formatter = metric === "cost" ? formatEur : (value: number) => formatNumber(value, 0);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="flex rounded-lg bg-secondary p-1" aria-label="Metrica del grafico AWaRe">
          {(["cost", "ddd"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMetric(option)}
              className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition ${metric === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              aria-pressed={metric === option}
            >
              {option === "cost" ? "Spesa" : "DDD"}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={68} tickFormatter={formatter} />
          <Tooltip formatter={(value: number) => formatter(Number(value))} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="access" name="Access" stackId="aware" fill={ACCESS_COLOR} />
          <Bar dataKey="watch" name="Watch" stackId="aware" fill={WATCH_COLOR} />
          <Bar dataKey="reserve" name="Reserve" stackId="aware" fill={RESERVE_COLOR} />
          <Bar dataKey="unclassified" name="Non classificato" stackId="aware" fill={UNCLASSIFIED_COLOR} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
