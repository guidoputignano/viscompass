// Server-rendered, accessible charts for the verified Pillar B view model.
// No new data is computed here: every mark is a direct visual encoding of a
// figure also present in the review tables. Negative values retain their sign.

import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { Concentration, FunnelRow, TrendRow } from "@/lib/dashboard-review/pillar-b/review-data";

const ink = "hsl(var(--foreground))";
const muted = "hsl(var(--muted-foreground))";
const grid = "hsl(var(--border))";
const teal = "hsl(var(--primary))";
const coral = "#e87955";

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return <figure className="overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5">
    <figcaption className="mb-3 text-sm font-semibold text-foreground">{title}</figcaption>
    {children}
  </figure>;
}

export function EvidenceFunnelChart({ rows }: { rows: FunnelRow[] }) {
  const max = Math.max(0, rows[0]?.rows_n ?? 0);
  return <Frame title="Quanti record restano a ogni passaggio">
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nessun record osservato.</p> :
    <div role="img" aria-label="Imbuto dei record osservati, classificabili, nel perimetro e con quantità confrontabile" className="space-y-3">
      {rows.map((row) => {
        const width = max > 0 ? Math.max(0, Math.min(100, 100 * row.rows_n / max)) : 0;
        return <div key={row.step} className="grid gap-1.5 sm:grid-cols-[13rem_1fr_9rem] sm:items-center sm:gap-3">
          <div className="text-xs font-medium text-foreground">{row.step}. {row.stage}</div>
          <div className="h-7 overflow-hidden rounded bg-muted/70">
            <div className="h-full rounded bg-primary/80" style={{ width: `${width}%` }} />
          </div>
          <div className="text-right font-mono text-xs text-foreground">{formatNumber(row.rows_n, 0)} <span className="text-muted-foreground">· {row.shareOfObserved === null ? "n/d" : formatPercent(row.shareOfObserved)}</span></div>
        </div>;
      })}
    </div>}
    <p className="mt-3 text-[11px] text-muted-foreground">La larghezza è la quota dei record osservati; la spesa corrispondente e i motivi di esclusione sono nel dettaglio.</p>
  </Frame>;
}

export function UptakeCoverageChart({ withheldShare, usedSpend, withheldSpend }: {
  withheldShare: number | null;
  usedSpend: number;
  withheldSpend: number;
}) {
  const share = withheldShare === null ? null : Math.max(0, Math.min(1, withheldShare));
  return <Frame title="Copertura della misura di uptake">
    {share === null ? <p className="text-sm text-muted-foreground">Quota non calcolabile nel perimetro della misura.</p> : <>
      <div role="img" aria-label={`Spesa utilizzata ${formatPercent(1 - withheldShare!)}, spesa trattenuta ${formatPercent(withheldShare!)}, sul perimetro della misura`} className="flex h-9 overflow-hidden rounded-lg">
        <div className="bg-primary" style={{ width: `${(1 - share) * 100}%` }} />
        <div className="bg-amber-500" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-primary" /><span className="font-semibold">Utilizzata {formatPercent(1 - withheldShare!)}</span><span className="ml-2 text-muted-foreground">{formatEur(usedSpend)}</span></div>
        <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" /><span className="font-semibold">Trattenuta {formatPercent(withheldShare!)}</span><span className="ml-2 text-muted-foreground">{formatEur(withheldSpend)}</span></div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Base: spesa utilizzata + trattenuta nel perimetro della misura, non tutta la spesa della release.</p>
    </>}
  </Frame>;
}

export function ChannelSlopeChart({ rows }: { rows: TrendRow[] }) {
  const width = 760, left = 190, right = 655, top = 42, rowGap = 58;
  const height = top + Math.max(rows.length, 1) * rowGap + 42;
  const values = rows.flatMap((r) => [r.spend2024, r.spend2025]);
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const x = (v: number) => left + (v - lo) / span * (right - left);
  const ticks = [0, .25, .5, .75, 1];
  return <Frame title="Come cambia la spesa per canale">
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nessun canale osservato.</p> : <>
    <div className="mb-2 flex gap-4 text-xs text-muted-foreground"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-500" />2024</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />2025</span></div>
    <svg role="img" aria-label="Confronto della spesa 2024 e 2025 per canale, in euro" viewBox={`0 0 ${width} ${height}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
      {ticks.map((t) => { const xx = left + t * (right - left); return <g key={t}><line x1={xx} y1={top - 8} x2={xx} y2={height - 30} stroke={grid} strokeDasharray="3 4"/><text x={xx} y={height - 9} textAnchor="middle" fontSize="11" fill={muted}>{formatEur(lo + t * span)}</text></g>; })}
      {rows.map((r, i) => { const y = top + i * rowGap + 17; return <g key={r.key}>
        <text x={left - 12} y={y + 4} textAnchor="end" fontSize="13" fill={ink}>{r.label}</text>
        <line x1={x(r.spend2024)} y1={y} x2={x(r.spend2025)} y2={y} stroke={r.changeEur >= 0 ? teal : coral} strokeWidth="5" strokeLinecap="round" />
        <circle cx={x(r.spend2024)} cy={y} r="6" fill={muted} />
        <circle cx={x(r.spend2025)} cy={y} r="7" fill={teal} stroke="white" strokeWidth="2" />
        <text x={width - 4} y={y + 4} textAnchor="end" fontSize="12" fill={r.changeEur >= 0 ? teal : coral}>{r.change === null ? "n/d" : formatPercent(r.change)}</text>
      </g>; })}
    </svg>
    <p className="mt-1 text-[11px] text-muted-foreground">Punti: spesa dei due anni. Segmento: variazione. Il colore indica la direzione, non una valutazione di performance.</p>
    </>}
  </Frame>;
}

export function MoleculeChangeChart({ rows }: { rows: TrendRow[] }) {
  const selected = [...rows].sort((a, b) => Math.abs(b.changeEur) - Math.abs(a.changeEur)).slice(0, 10);
  const max = Math.max(1, ...selected.map((r) => Math.abs(r.changeEur)));
  return <Frame title="Le dieci variazioni in euro più ampie">
    {selected.length === 0 ? <p className="text-sm text-muted-foreground">Nessun principio attivo osservato.</p> : <>
    <div role="img" aria-label="Variazioni della spesa 2025 rispetto al 2024 per i dieci principi attivi con variazione assoluta maggiore" className="space-y-2">
      {selected.map((r) => <div key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_6rem] items-center gap-2 text-xs sm:grid-cols-[minmax(0,12rem)_1fr_7rem]">
        <span title={r.label} className="truncate text-foreground">{r.label}</span>
        <div className="grid h-5 grid-cols-2">
          <div className="flex items-center justify-end border-r border-border">
            {r.changeEur < 0 && <div className="h-3 rounded-sm bg-orange-500" style={{ width: `${Math.abs(r.changeEur) / max * 100}%` }} />}
          </div>
          <div className="flex items-center">
            {r.changeEur >= 0 && <div className="h-3 rounded-sm bg-primary" style={{ width: `${Math.abs(r.changeEur) / max * 100}%` }} />}
          </div>
        </div>
        <span className="text-right font-mono text-[11px] text-foreground">{formatEur(r.changeEur)}</span>
      </div>)}
    </div>
    <p className="mt-3 text-[11px] text-muted-foreground">Zero al centro; a destra aumenti, a sinistra diminuzioni. Selezione per variazione assoluta, non per spesa 2025.</p>
    </>}
  </Frame>;
}

export function ConcentrationCurve({ data }: { data: Concentration }) {
  const ranks = [...new Set([1, 5, 10, 25, 50, 100, 250, data.moleculeCount])]
    .filter((r) => r > 0 && r <= data.moleculeCount).sort((a, b) => a - b);
  const points = ranks.map((r) => ({ rank: r, share: data.rows[r - 1]?.cumulativeShare ?? 0 }));
  const width = 760, height = 264, left = 58, right = 728, top = 22, bottom = 215;
  const maxShare = Math.max(1, ...points.map((p) => p.share));
  const x = (rank: number) => left + Math.log1p(rank) / Math.log1p(Math.max(data.moleculeCount, 1)) * (right - left);
  const y = (share: number) => bottom - share / maxShare * (bottom - top);
  const line = points.map((p) => `${x(p.rank)},${y(p.share)}`).join(" ");
  return <Frame title="Quanto rapidamente si concentra la spesa">
    {points.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna molecola osservata.</p> : <>
    <svg role="img" aria-label="Quota cumulata della spesa netta 2025 per numero di molecole in ordine decrescente di spesa" viewBox={`0 0 ${width} ${height}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
      {[0, .25, .5, .75, 1].map((v) => <g key={v}><line x1={left} y1={y(v * maxShare)} x2={right} y2={y(v * maxShare)} stroke={grid} strokeDasharray="3 4" /><text x={left - 8} y={y(v * maxShare) + 4} textAnchor="end" fontSize="11" fill={muted}>{formatPercent(v * maxShare)}</text></g>)}
      <polyline points={line} fill="none" stroke={teal} strokeWidth="3" strokeLinejoin="round" />
      {points.map((p) => <g key={p.rank}><circle cx={x(p.rank)} cy={y(p.share)} r="4" fill={teal} /><text x={x(p.rank)} y={bottom + 23} textAnchor="middle" fontSize="11" fill={muted}>{formatNumber(p.rank, 0)}</text></g>)}
      <text x={(left + right) / 2} y={height - 4} textAnchor="middle" fontSize="11" fill={muted}>Molecole ordinate per spesa · asse orizzontale logaritmico</text>
    </svg>
    <p className="mt-1 text-[11px] text-muted-foreground">Il denominatore è la spesa netta totale. Le rettifiche negative restano nel totale; per questo la curva può superare 100% prima di chiudere a 100%.</p>
    </>}
  </Frame>;
}
