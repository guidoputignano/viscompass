"use client";

import { useState } from "react";
import { TrendLineChart } from "@/components/dashboard-review/trend-line-chart";
import type { AwareYearRow } from "@/lib/dashboard-review/types";
import { costPerSuppliedDdd } from "@/lib/analytics/aware-metrics";


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
  const [metric, setMetric] = useState<"cost" | "ddd" | "costPerDdd">("costPerDdd");
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Nessun dato di consumo antibiotico nel proprio ambito.
      </div>
    );
  }

  const chartData = data.map((row) => ({
    year: row.year,
    access: metric === "costPerDdd" ? costPerSuppliedDdd(row.access, row.accessDdd) : metric === "cost" ? row.access : row.accessDdd,
    watch: metric === "costPerDdd" ? costPerSuppliedDdd(row.watch, row.watchDdd) : metric === "cost" ? row.watch : row.watchDdd,
    reserve: metric === "costPerDdd" ? costPerSuppliedDdd(row.reserve, row.reserveDdd) : metric === "cost" ? row.reserve : row.reserveDdd,
    // A residual from rounded totals is not a real fourth drug category.
    unclassified: metric === "costPerDdd" ? null : metric === "cost" ? row.unclassified : row.unclassifiedDdd,
  }));

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="flex rounded-lg bg-secondary p-1" aria-label="Metrica del grafico AWaRe">
          {(["cost", "ddd", "costPerDdd"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMetric(option)}
              className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition ${metric === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              aria-pressed={metric === option}
            >
              {option === "cost" ? "Spesa (€)" : option === "ddd" ? "DDD" : "Spesa / DDD (€)"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{metric === "costPerDdd" ? "Costo medio per DDD di ciascuna categoria. Include il mix dei prodotti; non è il prezzo della singola molecola. DDD assenti o nulle: N/D." : metric === "cost" ? "Spesa totale per categoria, in euro." : "DDD totali fornite dalla fonte, per categoria."}</p>
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
        ].filter(s => metric !== "costPerDdd" || s.key !== "unclassified")}
        format={metric === "costPerDdd" ? "eurPrecise" : metric === "cost" ? "eur" : "number"}
        height={300}
        ariaLabel={`Andamento per categoria AWaRe, ${metric === "costPerDdd" ? "euro per DDD" : metric === "cost" ? "spesa in euro" : "DDD"}`}
      />
    </div>
  );
}
