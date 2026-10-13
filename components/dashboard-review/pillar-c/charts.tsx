"use client";

import { useId } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { itNumberFormat } from "@/lib/format/it-number";
import type { PreviewModel } from "@/lib/dashboard-review/pillar-c/preview";

export const euro = (value: number) => itNumberFormat({ style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
export const percent = (value: number) => itNumberFormat({ style: "percent", maximumFractionDigits: 1 }).format(value);
export const compactEuro = (value: number) => {
  const divisor = Math.abs(value) >= 1_000_000 ? 1_000_000 : Math.abs(value) >= 1_000 ? 1_000 : 1;
  return divisor === 1 ? euro(value) : `${itNumberFormat({ maximumFractionDigits: 1 }).format(value / divisor)} ${divisor === 1_000_000 ? "M€" : "k€"}`;
};
export const signedEuro = (value: number) => `${value > 0 ? "+" : ""}${euro(value)}`;

export function FigureNote({ children }: { children?: React.ReactNode }) {
  return <p className="mt-4 border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground"><span className="font-medium">Dati illustrativi.</span>{children && <span> {children}</span>}</p>;
}

export function ValuesTable({ headers, rows, caption }: { headers: string[]; rows: (string | number)[][]; caption: string }) {
  return <details className="mt-4 rounded-xl border border-border bg-background/50">
    <summary className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Mostra i valori</summary>
    <div className="overflow-x-auto px-4 pb-3"><table className="w-full text-left text-xs">
      <caption className="pb-3 text-left text-muted-foreground">{caption} · dati illustrativi</caption>
      <thead><tr>{headers.map((h) => <th scope="col" key={h} className="border-b border-border px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 ? <th scope="row" key={j} className="border-b border-border/60 px-2 py-2 font-medium">{cell}</th> : <td key={j} className="whitespace-nowrap border-b border-border/60 px-2 py-2 tabular-nums">{cell}</td>)}</tr>)}</tbody>
    </table></div>
  </details>;
}

export function PortfolioBars({ model, metric, onSelect }: { model: PreviewModel; metric: "amount" | "share"; onSelect: (id: PreviewModel["portfolios"][number]["id"]) => void }) {
  const max = Math.max(...model.portfolios.map((p) => p.amount), 1);
  return <div className="space-y-4">
    {model.portfolios.map((p) => <button key={p.id} type="button" onClick={() => onSelect(p.id)} className="group block w-full rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" aria-label={`Esplora il portafoglio ${p.label}: ${metric === "amount" ? euro(p.amount) : percent(p.amount / model.amount)}, dati illustrativi`}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-medium group-hover:text-primary">{p.label}</span><span className="shrink-0 font-semibold tabular-nums">{metric === "amount" ? euro(p.amount) : percent(p.amount / model.amount)}</span></div>
      <div className="h-3 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${100 * p.amount / (metric === "share" ? model.amount : max)}%`, backgroundColor: p.color }} /></div>
    </button>)}
    <p className="text-[11px] text-muted-foreground">Seleziona una barra per esplorare il portafoglio.</p>
  </div>;
}

export function MonthlyChart({ rows, cumulative }: { rows: PreviewModel["months"]; cumulative: boolean }) {
  const title = useId();
  const max = Math.max(...rows.flatMap((r) => [r.previous, r.current]));
  const divisor = max >= 1_000_000 ? 1_000_000 : max >= 1_000 ? 1_000 : 1;
  const unit = divisor === 1_000_000 ? "Milioni di euro" : divisor === 1_000 ? "Migliaia di euro" : "Euro";
  return <figure aria-labelledby={title}>
    <figcaption id={title} className="sr-only">Spesa illustrativa 2024 e 2025, {cumulative ? "cumulata" : "mensile"}, in euro. Valori disponibili nella tabella seguente.</figcaption>
    <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-[var(--viz-1)]" />2025</span><span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-muted-foreground" />2024</span><span className="ml-auto">{unit}</span></div>
    <div className="h-[270px] min-w-0 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={18} />
          <YAxis tickFormatter={(n: number) => itNumberFormat({ maximumFractionDigits: 1 }).format(n / divisor)} width={40} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
          <Tooltip formatter={(value: number, name: string) => [euro(value), name]} contentStyle={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))", borderColor: "hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
          <Line dataKey="previous" name="2024 · esempio" type="linear" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
          <Line dataKey="current" name="2025 · esempio" type="linear" stroke="var(--viz-1)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <ValuesTable headers={["Mese", "2024 (€)", "2025 (€)"]} rows={rows.map((r) => [r.month, euro(r.previous), euro(r.current)])} caption={cumulative ? "Spesa cumulata" : "Spesa mensile"} />
  </figure>;
}

export function AttributionChart({ model }: { model: PreviewModel }) {
  return <div>
    <div className="flex h-6 overflow-hidden rounded-lg" aria-hidden="true">{model.attribution.map((a) => <div key={a.id} style={{ width: `${a.value / model.amount * 100}%`, background: a.color }} />)}</div>
    <div className="mt-5 space-y-4">{model.attribution.map((a) => <div key={a.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 text-sm">
      <span className="mt-1 size-2.5 rounded-full" style={{ background: a.color }} /><div><p className="font-medium">{a.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{euro(a.value)}</p></div><span className="font-semibold tabular-nums">{percent(a.value / model.amount)}</span>
    </div>)}</div>
  </div>;
}

export function ChangeBars({ model }: { model: PreviewModel }) {
  const rows = [...model.portfolios].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const max = Math.max(...rows.map((r) => Math.abs(r.change)), 1);
  return <div className="space-y-5">{rows.map((r) => <div key={r.id}>
    <div className="mb-2 flex items-center justify-between gap-2 text-sm"><span>{r.label}</span><span className="font-semibold tabular-nums">{signedEuro(r.change)}</span></div>
    <div className="relative flex h-4 rounded bg-secondary/60" aria-hidden="true"><span className="absolute bottom-[-4px] left-1/2 top-[-4px] w-px bg-border" /><div className="absolute h-4 rounded-sm" style={{ left: r.change < 0 ? `${50 - Math.abs(r.change) / max * 50}%` : "50%", width: `${Math.abs(r.change) / max * 50}%`, background: r.change < 0 ? "var(--viz-3)" : "var(--viz-2)" }} /></div>
  </div>)}<div className="flex justify-between pt-1 text-[11px] text-muted-foreground"><span>Diminuzione</span><span>Aumento</span></div></div>;
}

export function BudgetChart({ model, view }: { model: PreviewModel; view: "amount" | "deviation" }) {
  const max = Math.max(...model.portfolios.flatMap((p) => [p.current, p.budget]), 1);
  const maxDelta = Math.max(...model.portfolios.map((p) => Math.abs(p.deviation)), 1);
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span>Scenario 2025</span>{view === "amount" && <><span className="flex items-center gap-2"><span className="h-2 w-4 rounded bg-primary" />Consuntivo</span><span className="flex items-center gap-2"><span className="h-3 w-0.5 bg-foreground" />Budget</span></>}</div>
    {model.portfolios.map((p) => <div key={p.id}>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span>{p.label}</span><span className="font-semibold tabular-nums">{view === "amount" ? compactEuro(p.current) : signedEuro(p.deviation)}</span></div>
      <div className="relative h-3 rounded-full bg-secondary" aria-hidden="true">
        {view === "amount" ? <><div className="h-full rounded-full bg-primary" style={{ width: `${p.current / max * 100}%` }} /><div className="absolute -top-1 h-5 w-0.5 bg-foreground" style={{ left: `calc(${p.budget / max * 100}% - 2px)` }} /></> : <><span className="absolute -top-1 left-1/2 h-5 w-px bg-foreground/50" /><div className="absolute h-full rounded-sm" style={{ left: p.deviation < 0 ? `${50 - Math.abs(p.deviation) / maxDelta * 50}%` : "50%", width: `${Math.abs(p.deviation) / maxDelta * 50}%`, background: p.deviation > 0 ? "var(--viz-2)" : "var(--viz-3)" }} /></>}
      </div>
    </div>)}
    <ValuesTable headers={["Portafoglio", "Consuntivo 2025", "Budget 2025", "Scostamento"]} rows={model.portfolios.map((p) => [p.label, euro(p.current), euro(p.budget), signedEuro(p.deviation)])} caption="Confronto di budget dimostrativo" />
  </div>;
}
