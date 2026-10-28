"use client";

import type { ForecastSeries } from "@/lib/pillar-c-public/model";
import { itNumber } from "@/lib/format/it-number";

export const PUBLIC_C_COLORS = ["hsl(var(--primary))", "#bf8439", "#647ba8", "#977aaa", "#69976a", "#b96f73", "#7c8996"];
export const PUBLIC_C_MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
type Line = { name: string; values: (number | null)[]; color: string };
const pathOf = (points: { x: number; y: number }[]) => points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

/** Native vector charts keep the public observatory small and readable without a chart-library download. */
export function PublicCLineChart({ labels, lines, format, title }: { labels: string[]; lines: Line[]; format: (n: number) => string; title: string }) {
  const values = lines.flatMap(s => s.values).filter((v): v is number => v !== null);
  const low = Math.min(0, ...values), high = Math.max(1, ...values) * 1.1, span = high - low;
  const x = (i: number) => 85 + i * 625 / Math.max(1, labels.length - 1), y = (v: number) => 230 - (v - low) / span * 200;
  return <div tabIndex={0} role="group" aria-label="Grafico scorrevole · usa le frecce per scorrere" className="overflow-x-auto rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><p className="mb-3 text-xs text-muted-foreground sm:hidden">Scorri orizzontalmente per leggere tutto il grafico.</p><svg viewBox="0 0 755 275" className="w-full min-w-[32rem]" role="img" aria-label={`${title}. Valori disponibili anche nella tabella.`}>
    {[0, 1, 2, 3, 4].map(i => { const v = low + span * i / 4; return <g key={i}><line x1="85" x2="710" y1={y(v)} y2={y(v)} stroke="currentColor" opacity="0.1" /><text x="73" y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor">{format(v)}</text></g>; })}
    {labels.map((label, i) => <text key={i} x={x(i)} y="258" textAnchor="middle" fontSize="12" fill="currentColor">{label}</text>)}
    {lines.map((s, j) => { const paths: { x: number; y: number }[][] = [[]]; s.values.forEach((v, i) => { if (v === null) { if (paths.at(-1)!.length) paths.push([]); } else paths.at(-1)!.push({ x: x(i), y: y(v) }); }); return <g key={s.name}>
      {paths.map((p, i) => <path key={i} d={pathOf(p)} fill="none" stroke={s.color} strokeWidth="3" strokeDasharray={j ? "7 4" : undefined} />)}
      {s.values.map((v, i) => v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={s.color}><title>{`${s.name} · ${labels[i]}: ${format(v)}`}</title></circle>)}
    </g>; })}
  </svg></div>;
}

export type PublicCDotRow = { key: string; label: string; value: number; compare?: number | null; selected?: boolean };
export function PublicCDotChart({ rows, format, reference, title }: { rows: PublicCDotRow[]; format: (n: number) => string; reference?: number | null; title: string }) {
  const max = Math.max(1, reference ?? 0, ...rows.flatMap(r => [r.value, r.compare ?? 0])) * 1.08;
  return <div tabIndex={0} className="overflow-x-auto rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" role="group" aria-label={`${title}. I valori esatti sono disponibili nella vista tabella.`}>
    <p className="mb-3 text-xs text-muted-foreground sm:hidden">Scorri orizzontalmente per leggere tutto il grafico.</p><div className="min-w-[35rem] space-y-1">
      <div className="grid grid-cols-[12rem_1fr_8rem] gap-3 pb-2 text-[11px] text-muted-foreground"><span /><div className="flex justify-between"><span>{format(0)}</span><span>{format(max)}</span></div><span className="text-right">Valore</span></div>
      {rows.map(r => <div key={r.key} className={`grid min-h-9 grid-cols-[12rem_1fr_8rem] items-center gap-3 rounded-lg px-2 py-1.5 text-xs ${r.selected ? "bg-primary/10 font-semibold" : "even:bg-secondary/25"}`}>
        <span className="leading-4">{r.label}</span><div className="relative h-5" aria-hidden="true">
          <span className="absolute inset-x-0 top-1/2 border-t border-border" />
          {reference !== undefined && reference !== null && <span className="absolute inset-y-0 border-l border-dashed border-foreground/60" style={{ left: `${reference / max * 100}%` }} />}
          {r.compare !== undefined && r.compare !== null && <><span className="absolute top-1/2 h-0.5 bg-foreground/20" style={{ left: `${Math.min(r.value, r.compare) / max * 100}%`, width: `${Math.abs(r.value - r.compare) / max * 100}%` }} /><span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#bf8439] bg-card" style={{ left: `${r.compare / max * 100}%` }} /></>}
          <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" style={{ left: `${r.value / max * 100}%` }} />
        </div><span className="text-right tabular-nums">{format(r.value)}{r.compare !== undefined && r.compare !== null && <span className="block font-normal text-muted-foreground">{format(r.compare)}</span>}</span>
      </div>)}
    </div>
  </div>;
}

export function PublicCForecastChart({ series, band }: { series: ForecastSeries; band: "80" | "95" }) {
  const hi = band === "80" ? "high80" : "high95", lo = band === "80" ? "low80" : "low95";
  const max = Math.max(...series.months.map(m => Math.max(m[hi], m.observed ?? 0))) * 1.12;
  const x = (i: number) => 72 + i * 644 / 23, y = (n: number) => 230 - n / max * 200;
  const upper = series.months.map((m, i) => ({ x: x(i + 12), y: y(m[hi]) })), lower = [...series.months].reverse().map((m, i) => ({ x: x(23 - i), y: y(m[lo]) }));
  const observed: { x: number; y: number }[][] = [[]];
  series.months.forEach((m, i) => { if (m.observed === null) { if (observed.at(-1)!.length) observed.push([]); } else observed.at(-1)!.push({ x: x(i), y: y(m.observed) }); });
  return <div tabIndex={0} role="group" aria-label="Grafico scorrevole · usa le frecce per scorrere" className="overflow-x-auto rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><p className="mb-3 text-xs text-muted-foreground sm:hidden">Scorri orizzontalmente per leggere tutto il grafico.</p><svg viewBox="0 0 755 295" className="w-full min-w-[35rem]" role="img" aria-label={`${series.label}, Abruzzo: osservato 2025 provvisorio e previsione mensile 2026 con fascia all’${band}%. Valori esatti nella tabella.`}>
    <rect x={x(11.5)} y="20" width={x(23) - x(11.5)} height="210" fill="hsl(var(--primary))" opacity="0.04" />
    {[0, 1, 2, 3, 4].map(i => { const v = max * i / 4; return <g key={i}><line x1="72" x2="716" y1={y(v)} y2={y(v)} stroke="currentColor" opacity="0.1" /><text x="61" y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor">{itNumber(v / 1e6, { maximumFractionDigits: 1 })}</text></g>; })}
    <text x="12" y="14" fontSize="11" fill="currentColor">Milioni €</text>
    <path d={`${pathOf(upper)} ${pathOf(lower).replace(/^M/, "L")} Z`} fill="hsl(var(--primary))" opacity="0.17" />
    {observed.map((points, i) => <path key={i} d={pathOf(points)} fill="none" stroke="currentColor" strokeWidth="2.5" />)}
    <path d={pathOf(series.months.map((m, i) => ({ x: x(i + 12), y: y(m.point) })))} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray="6 4" />
    <line x1={x(11.5)} x2={x(11.5)} y1="20" y2="232" stroke="currentColor" strokeDasharray="3 5" opacity="0.3" />
    {[0, 3, 6, 9, 12, 15, 18, 21].map(i => <text key={i} x={x(i)} y="253" textAnchor="middle" fontSize="11" fill="currentColor">{PUBLIC_C_MONTHS[i % 12]}</text>)}
    <text x={x(5.5)} y="282" textAnchor="middle" fontSize="12" fill="currentColor">2025 · osservato provvisorio</text><text x={x(17.5)} y="282" textAnchor="middle" fontSize="12" fill="currentColor">2026 · previsione</text>
  </svg></div>;
}
