"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { AntibioticAnnualRow, AntibioticUnitRow } from "@/lib/dashboard-review/types";
import { formatEur, formatNumber } from "@/lib/dashboard-review/format";

export function AntibioticIndexChart({ data }: { data: AntibioticAnnualRow[] }) {
  if (data.length === 0) return null;
  const baseCost = data[0].costEur || 1;
  const baseDdd = data[0].dddCount || 1;
  const rows = data.map((row) => ({
    year: row.year,
    spendIndex: (row.costEur / baseCost) * 100,
    dddIndex: (row.dddCount / baseDdd) * 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis domain={["dataMin - 4", "dataMax + 4"]} tickLine={false} axisLine={false} fontSize={11} width={44} tickFormatter={(value: number) => `${Math.round(value)}`} />
        <Tooltip formatter={(value: number, name: string) => [`${Number(value).toFixed(1)}`, name === "dddIndex" ? "DDD" : "Spesa"]} labelFormatter={(label) => `Anno ${label} · 2023 = 100`} />
        <Legend formatter={(value) => value === "dddIndex" ? "DDD" : "Spesa"} wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={100} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 4" />
        <Line type="monotone" dataKey="dddIndex" stroke="hsl(174 66% 36%)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="spendIndex" stroke="hsl(238 70% 62%)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AntibioticUnitQuadrant({ data }: { data: AntibioticUnitRow[] }) {
  const rows = data
    .filter((row) => row.dddPer100BedDays !== null && row.costPerDdd !== null)
    .map((row) => ({
      ...row,
      x: row.dddPer100BedDays!,
      y: row.costPerDdd!,
      z: Math.max(row.costEur, 1),
      label: row.unitName,
    }));
  if (rows.length === 0) return null;
  const meanX = rows.reduce((sum, row) => sum + row.x, 0) / rows.length;
  const meanY = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;

  return (
    <ResponsiveContainer width="100%" height={330}>
      <ScatterChart margin={{ top: 12, right: 18, bottom: 12, left: 4 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" name="DDD / 100 giornate" tickLine={false} axisLine={false} fontSize={10} unit="" />
        <YAxis type="number" dataKey="y" name="Spesa / DDD" tickLine={false} axisLine={false} fontSize={10} width={50} unit=" €" />
        <ZAxis type="number" dataKey="z" range={[90, 520]} name="Spesa" />
        <ReferenceLine x={meanX} stroke="hsl(174 45% 48%)" strokeDasharray="4 4" />
        <ReferenceLine y={meanY} stroke="hsl(238 45% 65%)" strokeDasharray="4 4" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          formatter={(value: number, name: string) => {
            if (name === "Spesa") return [formatEur(Number(value)), name];
            return [formatNumber(Number(value), 1), name];
          }}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? "Unità"}
        />
        <Scatter name="Unità" data={rows} fill="hsl(174 66% 36%)" fillOpacity={0.76} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
