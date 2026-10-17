"use client";

import { useId, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { C_INSIGHT_CHARTS, type CInsightChart, type CInsightInterval, type CInsightPoint } from '@/lib/dashboard-review/pillar-c/insight-charts';

type Props = {
  kind: CInsightChart; points: CInsightPoint[]; metric: number; comparison: number; xMetric: number;
  matrix: number[]; interval?: CInsightInterval; heading: (c: number) => string;
  axis: (v: number, c: number) => string; title: string;
};
const short = (s: string, n = 33) => s.length > n ? `${s.slice(0, n - 1)}…` : s;
function extent(values: (number | null | undefined)[]): [number, number] {
  const finite = values.filter((n): n is number => n != null && Number.isFinite(n));
  const lo = Math.min(0, ...finite), hi = Math.max(0, ...finite);
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
}
const number = (p: CInsightPoint, c: number) => p.values[c]?.value;

/** Shared exact-value interaction; visual scales never replace source labels. */
export function PillarCInsightChart({ kind, points, metric, comparison, xMetric, matrix, interval, heading, axis, title }: Props) {
  const id = useId().replaceAll(':', ''), [active, setActive] = useState<{ row: number; column: number } | null>(null);
  const chosen = points.find(p => p.sourceRow === active?.row);
  const columns = kind === 'matrix' ? matrix : [metric, ...(kind === 'paired' && comparison >= 0 ? [comparison] : []), ...(kind === 'scatter' ? [xMetric] : []), ...(kind === 'interval' && interval ? [interval.low, interval.high] : [])];
  const focus = (p: CInsightPoint, c = metric) => setActive({ row: p.sourceRow, column: c });
  const detail = <div aria-live="polite" className="mt-4 min-h-16 rounded-xl border border-border bg-secondary/25 px-4 py-3 text-xs leading-5">
    {chosen ? <><p className="font-semibold">{chosen.name}</p><div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">{[...new Set(columns)].map(c => <span key={c} className={active?.column === c ? 'font-medium text-primary' : 'text-muted-foreground'}>{heading(c)}: {chosen.values[c]?.exact ?? '—'}</span>)}</div></> : <p className="text-muted-foreground">Passa il puntatore su un punto o una cella, oppure usa il tasto Tab, per leggere i valori esatti. Il dettaglio completo resta disponibile sotto il grafico.</p>}
  </div>;

  if (kind === 'matrix') {
    const [lo, hi] = extent(points.flatMap(p => matrix.map(c => number(p, c))));
    const magnitude = Math.max(Math.abs(lo), Math.abs(hi), 1);
    return <div><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full border-separate border-spacing-1 p-2 text-xs"><caption className="sr-only">{title} · mappa di calore, scala comune</caption><thead><tr><th scope="col" className="min-w-52 p-2 text-left">Categoria</th>{matrix.map(c => <th key={c} scope="col" className="min-w-32 max-w-52 p-2 font-medium">{heading(c)}</th>)}</tr></thead><tbody>{points.map(p => <tr key={p.sourceRow}><th scope="row" className="max-w-64 px-2 py-1 text-left font-normal"><span className="line-clamp-2" title={p.name}>{p.name}</span></th>{matrix.map(c => {
      const v = number(p, c), intensity = v == null ? 0 : Math.abs(v) / magnitude;
      const color = v != null && v < 0 ? 'var(--viz-2)' : 'var(--viz-1)';
      return <td key={c} className="p-0"><button type="button" onMouseEnter={() => focus(p, c)} onFocus={() => focus(p, c)} onClick={() => focus(p, c)} className="relative min-h-11 w-full overflow-hidden rounded-md border border-border/40 px-3 py-2 text-right tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label={`${p.name} · ${heading(c)}: ${p.values[c]?.exact ?? '—'}`}><span aria-hidden="true" className="absolute inset-0" style={{ background: color, opacity: v == null ? 0 : 0.05 + intensity * 0.3 }} /><span className="relative">{p.values[c]?.exact ?? '—'}</span></button></td>;
    })}</tr>)}</tbody></table></div><div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span>Scala comune: {axis(lo, metric)} → {axis(hi, metric)}</span><span className="h-2 w-20 rounded bg-gradient-to-r from-primary/5 to-primary/60" aria-hidden="true"/><span>Intensità proporzionale al valore assoluto</span><span>— dato assente</span>{lo < 0 && <span>Arancio: importo negativo</span>}</div>{detail}</div>;
  }

  if (kind === 'line' || kind === 'area') {
    const data = points.map(p => ({ ...p, value: number(p, metric), other: comparison >= 0 ? number(p, comparison) : null }));
    const shared = <><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))"/><XAxis dataKey="name" minTickGap={35} tick={{ fontSize: 10 }} tickFormatter={v => short(String(v), 18)}/><YAxis tick={{ fontSize: 10 }} tickFormatter={v => axis(v, metric)}/><Tooltip content={({ active: shown, payload }) => {
      const p = payload?.[0]?.payload as CInsightPoint | undefined;
      return shown && p ? <div className="max-w-sm rounded-xl border border-border bg-card p-3 text-xs shadow-lg"><p className="font-medium">{p.name}</p><p className="mt-2">{heading(metric)}: {p.values[metric]?.exact}</p>{comparison >= 0 && <p>{heading(comparison)}: {p.values[comparison]?.exact}</p>}</div> : null;
    }}/></>;
    return <div><div className="h-80 min-w-0"><ResponsiveContainer width="100%" height="100%">{kind === 'area' ? <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 8 }}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--viz-1)" stopOpacity={0.3}/><stop offset="100%" stopColor="var(--viz-1)" stopOpacity={0.02}/></linearGradient></defs>{shared}<Area type="linear" dataKey="value" fill={`url(#${id})`} stroke="var(--viz-1)" strokeWidth={2.5} connectNulls={false} isAnimationActive={false}/>{comparison >= 0 && <Area type="linear" dataKey="other" fill="transparent" stroke="var(--viz-2)" strokeWidth={2} strokeDasharray="5 4" connectNulls={false} isAnimationActive={false}/>}</AreaChart> : <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 8 }}>{shared}<Line type="linear" dataKey="value" stroke="var(--viz-1)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false}/>{comparison >= 0 && <Line type="linear" dataKey="other" stroke="var(--viz-2)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} connectNulls={false} isAnimationActive={false}/>}</LineChart>}</ResponsiveContainer></div><p className="mt-3 text-xs text-muted-foreground">{C_INSIGHT_CHARTS[kind].description}</p></div>;
  }

  const scatter = kind === 'scatter';
  const domain = extent(points.flatMap(p => [number(p, scatter ? xMetric : metric), ...(kind === 'paired' ? [number(p, comparison)] : []), ...(kind === 'interval' && interval ? [number(p, interval.low), number(p, interval.high)] : [])]));
  const yDomain = extent(points.map(p => number(p, metric)));
  const left = scatter ? 80 : 290, right = 925, top = 30, bottom = scatter ? 350 : points.length * 42 + 25, height = bottom + 60;
  const x = (n: number) => left + (n - domain[0]) / (domain[1] - domain[0]) * (right - left);
  const y = (n: number) => bottom - (n - yDomain[0]) / (yDomain[1] - yDomain[0]) * (bottom - top);
  return <div className="rounded-xl border border-border bg-gradient-to-b from-secondary/20 to-transparent p-2 sm:p-4"><div className="overflow-x-auto"><svg viewBox={`0 0 960 ${height}`} className="w-full min-w-[640px]" role="group" aria-label={`${title} · ${C_INSIGHT_CHARTS[kind].label}`}>
    {Array.from({ length: 5 }, (_, i) => {
      const value = domain[0] + (domain[1] - domain[0]) * i / 4;
      return <g key={i}><line x1={x(value)} x2={x(value)} y1={top - 10} y2={bottom} stroke="hsl(var(--border))" strokeDasharray="3 5"/><text x={x(value)} y={bottom + 23} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">{axis(value, scatter ? xMetric : metric)}</text></g>;
    })}
    <line x1={x(0)} x2={x(0)} y1={top - 10} y2={bottom} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5}/>
    {scatter && <>{Array.from({ length: 5 }, (_, i) => {
      const value = yDomain[0] + (yDomain[1] - yDomain[0]) * i / 4;
      return <g key={i}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="hsl(var(--border))" strokeDasharray="3 5"/><text x={left - 10} y={y(value) + 4} textAnchor="end" fontSize={11} fill="hsl(var(--muted-foreground))">{axis(value, metric)}</text></g>;
    })}<text x={left} y={13} fontSize={12} fill="currentColor">{heading(metric)}</text><text x={(left + right) / 2} y={height - 9} textAnchor="middle" fontSize={12} fill="currentColor">{heading(xMetric)}</text></>}
    {points.map((p, i) => {
      const value = number(p, metric), other = number(p, comparison), abscissa = number(p, xMetric), yy = scatter && value != null ? y(value) : top + i * 42;
      if (scatter && (value == null || abscissa == null)) return null;
      const low = interval ? number(p, interval.low) : null, high = interval ? number(p, interval.high) : null;
      const bounded = kind === 'interval' && low != null && high != null && value != null && low <= value && value <= high;
      const negative = value != null && value < 0, color = negative ? 'var(--viz-2)' : 'var(--viz-1)';
      return <g key={p.sourceRow} tabIndex={0} role="img" aria-label={`${p.name}: ${columns.map(c => `${heading(c)} ${p.values[c]?.exact ?? '—'}`).join('; ')}`} onFocus={() => focus(p)} onMouseEnter={() => focus(p)} onClick={() => focus(p)} className="cursor-pointer outline-none focus-visible:stroke-primary">
        <title>{`${p.name}: ${columns.map(c => `${heading(c)} ${p.values[c]?.exact ?? '—'}`).join('; ')}`}</title>
        {!scatter && <><rect x={0} y={yy - 18} width={950} height={36} rx={6} fill={chosen?.sourceRow === p.sourceRow ? 'hsl(var(--secondary))' : 'transparent'}/><text x={0} y={yy + 4} fontSize={12} fill="currentColor">{short(p.name)}</text></>}
        {kind === 'paired' && value != null && other != null && <line x1={x(value)} x2={x(other)} y1={yy} y2={yy} stroke="var(--viz-2)" strokeOpacity={0.45} strokeWidth={4}/>}
        {bounded && <><line x1={x(low!)} x2={x(high!)} y1={yy} y2={yy} stroke="var(--viz-1)" strokeOpacity={0.4} strokeWidth={5}/>{[low!, high!].map((n, j) => <line key={j} x1={x(n)} x2={x(n)} y1={yy - 7} y2={yy + 7} stroke="var(--viz-1)" strokeWidth={2}/>)}</>}
        {(kind === 'dot' || kind === 'bar') && value != null && <line x1={x(0)} x2={x(value)} y1={yy} y2={yy} stroke={color} strokeOpacity={kind === 'bar' ? 0.75 : 0.3} strokeWidth={kind === 'bar' ? 16 : 3}/>}
        {value != null && kind !== 'bar' && <circle cx={x(scatter ? abscissa! : value)} cy={yy} r={scatter ? 6 : 5} fill={color} stroke="hsl(var(--card))" strokeWidth={2}/>}
        {kind === 'paired' && other != null && <rect x={x(other) - 4} y={yy - 4} width={8} height={8} transform={`rotate(45 ${x(other)} ${yy})`} fill="var(--viz-2)" stroke="hsl(var(--card))" strokeWidth={1.5}/>}
        {!scatter && value == null && <text x={left + 5} y={yy + 4} fontSize={11} fill="hsl(var(--muted-foreground))">—</text>}
      </g>;
    })}
  </svg></div>{detail}</div>;
}
