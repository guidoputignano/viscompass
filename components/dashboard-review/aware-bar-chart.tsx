"use client";

import { useState } from "react";
import { TrendLineChart } from "@/components/dashboard-review/trend-line-chart";
import type { AwareYearRow } from "@/lib/dashboard-review/types";


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
      <TrendLineChart
        points={chartData.map((row) => ({
          label: String(row.year),
          access: row.access,
          watch: row.watch,
          reserve: row.reserve,
          unclassified: row.unclassified,
        }))}
        series={[
          { key: "access", name: "Access", color: ACCESS_COLOR },
          { key: "watch", name: "Watch", color: WATCH_COLOR },
          { key: "reserve", name: "Reserve", color: RESERVE_COLOR },
          { key: "unclassified", name: "Non classificato", color: UNCLASSIFIED_COLOR },
        ]}
        format={metric === "cost" ? "eur" : "number"}
        height={300}
        ariaLabel={`Andamento per categoria AWaRe, ${metric === "cost" ? "spesa" : "DDD"}`}
      />
    </div>
  );
}
