"use client";

import { useState } from 'react';
import { ChartNoAxesCombined, CircleDot } from 'lucide-react';
import { cInsightWaterfall } from '@/lib/dashboard-review/pillar-c/chart-kinds';
import { C_COMPONENT_LABELS, cMoneyLabel, type CBridge } from '@/lib/dashboard-review/pillar-c/review';
import { PillarCInsightChart } from '@/components/dashboard-review/pillar-c/insight-chart';

const compact = (v: string | number) => new Intl.NumberFormat('it-IT', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v));
const button = 'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
function wrap(s: string) {
  return s.split(' ').reduce<string[][]>((lines, word) => {
    const last = lines[lines.length - 1];
    if (last.join(' ').length + word.length > 18) lines.push([word]); else last.push(word);
    return lines;
  }, [[]]);
}

/** Reads only each component's id and value, so the reviewer's and an organisation-scoped audience's rows both fit. */
export function PillarCChangeBridge({ opening, closing, components }: { opening: string; closing: string; components: Pick<CBridge, "component" | "value">[] }) {
  const [view, setView] = useState<'waterfall' | 'contributions'>('waterfall');
  const [selected, setSelected] = useState<string | null>(null);
  const steps = cInsightWaterfall(opening, closing, components);
  const label = (id: string) => id === 'opening' ? 'Spesa iniziale' : id === 'closing' ? 'Spesa finale' : C_COMPONENT_LABELS[id as CBridge['component']];
  const chosen = steps.find(s => s.id === selected);
  if (!steps.length) return <p className="text-sm text-muted-foreground">Il ponte non è disponibile per questa selezione.</p>;
  const lo = Math.min(0, ...steps.flatMap(s => [Number(s.start), Number(s.end)]));
  const hi = Math.max(1, ...steps.flatMap(s => [Number(s.start), Number(s.end)]));
  const y = (n: number) => 300 - (n - lo) / (hi - lo) * 250;
  return <div>
    <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Vista della variazione">
      <button type="button" aria-pressed={view === 'waterfall'} className={`${button} ${view === 'waterfall' ? 'border-primary bg-primary/5 text-primary' : 'border-border'}`} onClick={() => setView('waterfall')}><ChartNoAxesCombined size={15} aria-hidden="true"/>Ponte a cascata</button>
      <button type="button" aria-pressed={view === 'contributions'} className={`${button} ${view === 'contributions' ? 'border-primary bg-primary/5 text-primary' : 'border-border'}`} onClick={() => setView('contributions')}><CircleDot size={15} aria-hidden="true"/>Contributi con segno</button>
    </div>
    {view === 'contributions' ? <PillarCInsightChart kind="dot" title="Contributi alla variazione della spesa"
      points={components.map((c, i) => ({ sourceRow: i, name: label(c.component), values: { 0: { value: Number(c.value), exact: cMoneyLabel(c.value) } } }))}
      metric={0} comparison={-1} xMetric={-1} matrix={[0]} heading={() => 'Contributo'} axis={n => cMoneyLabel(n)}/>
      : <>
        <div className="overflow-x-auto rounded-xl border border-border bg-gradient-to-b from-secondary/30 to-transparent p-3">
          <svg viewBox="0 0 960 410" className="min-w-[720px] w-full" role="group" aria-label="Ponte a cascata fra spesa iniziale e finale">
            {Array.from({ length: 5 }, (_, i) => {
              const v = lo + (hi - lo) * i / 4;
              return <g key={i}><line x1={95} x2={940} y1={y(v)} y2={y(v)} stroke="hsl(var(--border))" strokeDasharray="3 5"/><text x={85} y={y(v) + 4} textAnchor="end" fontSize={11} fill="hsl(var(--muted-foreground))">{`${compact(v)} €`}</text></g>;
            })}
            {steps.map((s, i) => {
              const xx = 110 + i * 139, negative = Number(s.value) < 0;
              const color = s.total ? 'var(--viz-1)' : negative ? 'var(--viz-2)' : 'var(--viz-3)';
              return <g key={s.id} tabIndex={0} role="img" aria-label={`${label(s.id)}: ${cMoneyLabel(s.value)}`}
                className="cursor-pointer outline-none focus-visible:stroke-primary" onFocus={() => setSelected(s.id)} onMouseEnter={() => setSelected(s.id)} onClick={() => setSelected(s.id)}>
                <title>{`${label(s.id)}: ${cMoneyLabel(s.value)}`}</title>
                <rect x={xx} y={Math.min(y(Number(s.start)), y(Number(s.end)))} width={96}
                  height={Math.max(2, Math.abs(y(Number(s.start)) - y(Number(s.end))))} fill={color} rx={4} opacity={selected === s.id ? 1 : 0.8}/>
                {i < steps.length - 1 && <line x1={xx + 96} x2={xx + 139} y1={y(Number(s.end))} y2={y(Number(s.end))} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3"/>}
                <text x={xx + 48} y={Math.min(y(Number(s.start)), y(Number(s.end))) - 9} textAnchor="middle" fontSize={11} fill="currentColor">{`${!s.total && Number(s.value) > 0 ? '+' : ''}${compact(s.value)} €`}</text>
                <text x={xx + 48} y={325} textAnchor="middle" fontSize={11} fill="currentColor">{wrap(label(s.id)).map((words, j) => <tspan key={j} x={xx + 48} dy={j === 0 ? 0 : 15}>{words.join(' ')}</tspan>)}</text>
              </g>;
            })}
          </svg>
        </div>
        <div className="mt-3 min-h-12 rounded-lg bg-secondary/30 px-4 py-3 text-xs" aria-live="polite">{chosen ? `${label(chosen.id)}: ${cMoneyLabel(chosen.value)}${chosen.total ? '' : ` · da ${cMoneyLabel(chosen.start)} a ${cMoneyLabel(chosen.end)}`}` : 'Seleziona una componente per leggere il contributo esatto e i livelli prima e dopo.'}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">{([["var(--viz-1)", "Totale"], ["var(--viz-3)", "Contributo positivo"], ["var(--viz-2)", "Contributo negativo"]] as const).map(([color, name]) => <span key={name} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: color }} />{name}</span>)}</div>
        <p className="mt-2 text-xs text-muted-foreground">La cascata riconcilia gli importi iniziali e finali. I contributi sono contabili, non effetti causali.</p>
      </>}
  </div>;
}
