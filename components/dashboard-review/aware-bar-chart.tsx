"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AwareYearRow } from "@/lib/dashboard-review/types";
import { formatEur } from "@/lib/dashboard-review/format";

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
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Nessun dato di consumo antibiotico nel proprio ambito.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={70}
          tickFormatter={(v: number) => formatEur(v)}
        />
        <Tooltip formatter={(value: number) => formatEur(value)} />
        <Legend />
        <Bar dataKey="access" name="Access" stackId="cost" fill={ACCESS_COLOR} />
        <Bar dataKey="watch" name="Watch" stackId="cost" fill={WATCH_COLOR} />
        <Bar dataKey="reserve" name="Reserve" stackId="cost" fill={RESERVE_COLOR} />
        <Bar
          dataKey="unclassified"
          name="Non classificato"
          stackId="cost"
          fill={UNCLASSIFIED_COLOR}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
