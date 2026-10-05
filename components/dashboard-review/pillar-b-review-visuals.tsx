// Accessible charts for the verified Pillar B view model. Some render on the
// server, some inside the client panels (pillar-b-panels.tsx): pass them only
// what they draw, because a client render ships its props to the browser.
// No new data is computed here: every mark is a direct visual encoding of a
// figure also present in the review tables. Negative values retain their sign.

import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { Concentration, FunnelRow, TrendRow } from "@/lib/dashboard-review/pillar-b/review-data";
import { TREND_FIGURE_HEADINGS, trendFigures, type TrendFigure, type TrendOrder } from "@/lib/dashboard-review/pillar-b/view-options";
import { KeepLink } from "@/components/dashboard-review/pillar-b-local-toggle";

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

export function EvidenceFunnelChart({ rows, year }: { rows: FunnelRow[]; year?: number }) {
  const max = Math.max(0, rows[0]?.rows_n ?? 0);
  return <Frame title="Quanti record restano a ogni passaggio">
    {rows.length > 0 && <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
      Ogni percentuale è <strong className="text-foreground">record del passaggio ÷ record osservati{year ? ` nel ${year}` : ""}</strong> (passaggio 1 = {formatNumber(max, 0)} = 100%): quote di righe, non di euro né di pazienti. La spesa di ogni passaggio è nel dettaglio sotto.
    </p>}
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nessun record osservato.</p> :
    <div role="img" aria-label="Imbuto dei record osservati, classificabili, nel perimetro e con quantità confrontabile" className="space-y-3">
      {rows.map((row) => {
        const width = max > 0 ? Math.max(0, Math.min(100, 100 * row.rows_n / max)) : 0;
        return <div key={row.step} className="grid gap-1.5 sm:grid-cols-[13rem_1fr_9rem] sm:items-center sm:gap-3">
          <div className="text-xs font-medium text-foreground">{row.step}. {row.stage}</div>
          <div className="h-7 overflow-hidden rounded bg-muted/70">
            <div className="h-full rounded bg-primary/80" style={{ width: `${width}%` }} />
          </div>
          <div className="text-right font-mono text-xs text-foreground">{formatNumber(row.rows_n, 0)} {row.shareOfObserved !== null && <span className="text-muted-foreground">· {formatPercent(row.shareOfObserved)}</span>}</div>
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
  const observedLo = Math.min(0, ...values), observedHi = Math.max(0, ...values);
  const rawStep = Math.max(1, (observedHi - observedLo) / 4);
  const order = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 1.5, 2, 2.5, 5, 7.5, 10].find((v) => v * order >= rawStep)! * order;
  const lo = Math.floor(observedLo / step) * step;
  const hi = Math.max(step, Math.ceil(observedHi / step) * step);
  const span = hi - lo || 1;
  const x = (v: number) => left + (v - lo) / span * (right - left);
  const ticks = Array.from({ length: Math.round(span / step) + 1 }, (_, i) => lo + i * step);
  const axisLabel = (v: number) => Math.abs(v) >= 1_000_000
    ? `${formatNumber(v / 1_000_000, 1)} Mln €`
    : formatEur(v);
  return <Frame title="Come cambia la spesa per canale">
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nessun canale osservato.</p> : <>
    <div className="mb-2 flex gap-4 text-xs text-muted-foreground"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-500" />2024</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />2025</span></div>
    <svg role="img" aria-label="Confronto della spesa 2024 e 2025 per canale, in euro" viewBox={`0 0 ${width} ${height}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
      {ticks.map((tick) => { const xx = x(tick); return <g key={tick}><line x1={xx} y1={top - 8} x2={xx} y2={height - 30} stroke={grid} strokeDasharray="3 4"/><text x={xx} y={height - 9} textAnchor="middle" fontSize="11" fill={muted}>{axisLabel(tick)}</text></g>; })}
      {rows.map((r, i) => { const y = top + i * rowGap + 17; return <g key={r.key}>
        <text x={left - 12} y={y + 4} textAnchor="end" fontSize="13" fill={ink}>{r.label}</text>
        <line x1={x(r.spend2024)} y1={y} x2={x(r.spend2025)} y2={y} stroke={r.changeEur >= 0 ? teal : coral} strokeWidth="5" strokeLinecap="round" />
        <circle cx={x(r.spend2024)} cy={y} r="6" fill={muted} />
        <circle cx={x(r.spend2025)} cy={y} r="7" fill={teal} stroke="white" strokeWidth="2" />
        {r.change !== null && <text x={width - 4} y={y + 4} textAnchor="end" fontSize="12" fill={r.changeEur >= 0 ? teal : coral}>{formatPercent(r.change)}</text>}
      </g>; })}
    </svg>
    <p className="mt-1 text-[11px] text-muted-foreground">Punti: spesa dei due anni. Segmento: variazione. Il colore indica la direzione, non una valutazione di performance.</p>
    </>}
  </Frame>;
}

function figureText(f: TrendFigure): string {
  return f.kind === "eur" ? formatEur(f.value) : f.kind === "pct" ? formatPercent(f.value) : "n/c";
}

export function MoleculeChangeChart({ rows, title, orderNote, measure = "delta" }: {
  /** Already sorted and limited by the caller; drawn in the order given. */
  rows: TrendRow[];
  title?: string;
  /** How the rows were selected, for the footnote. */
  orderNote?: string;
  /** The sort measure: the figure printed beside each row follows it. */
  measure?: TrendOrder;
}) {
  const selected = rows;
  const max = Math.max(1, ...selected.map((r) => Math.abs(r.changeEur)));
  const heading = TREND_FIGURE_HEADINGS[measure];
  const anyNa = selected.some((r) => r.change === null);
  return <Frame title={title ?? "Le dieci variazioni in euro più ampie"}>
    {selected.length === 0 ? <p className="text-sm text-muted-foreground">Nessun principio attivo osservato.</p> : <>
    <div className="mb-1 grid grid-cols-[minmax(0,9rem)_1fr_7rem] items-end gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:grid-cols-[minmax(0,12rem)_1fr_9rem]">
      <span>Molecola</span>
      <span>Barra: variazione € 2025 meno 2024 · zero al centro</span>
      <span className="text-right">{heading}</span>
    </div>
    <div role="img" aria-label={`${title ?? "Le dieci variazioni in euro più ampie"}: barre della variazione della spesa 2025 rispetto al 2024, cifra a destra ${heading}`} className="space-y-2">
      {selected.map((r) => {
        const { primary, secondary } = trendFigures(r, measure);
        return <div key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_7rem] items-center gap-2 text-xs sm:grid-cols-[minmax(0,12rem)_1fr_9rem]">
          {r.href
            ? <KeepLink href={r.href} className="truncate text-foreground hover:text-primary hover:underline">{r.label}</KeepLink>
            : <span title={r.label} className="truncate text-foreground">{r.label}</span>}
          <div className="grid h-5 grid-cols-2">
            <div className="flex items-center justify-end border-r border-border">
              {r.changeEur < 0 && <div className="h-3 rounded-sm bg-orange-500" style={{ width: `${Math.abs(r.changeEur) / max * 100}%` }} />}
            </div>
            <div className="flex items-center">
              {r.changeEur >= 0 && <div className="h-3 rounded-sm bg-primary" style={{ width: `${Math.abs(r.changeEur) / max * 100}%` }} />}
            </div>
          </div>
          <span className="text-right font-mono text-[11px] leading-tight text-foreground">
            {figureText(primary)}
            {secondary && <span className="block text-[10px] text-muted-foreground">{secondary.kind === "pct" ? "" : secondary.kind === "eur" && measure === "spesa" ? "variazione " : ""}{figureText(secondary)}</span>}
          </span>
        </div>;
      })}
    </div>
    <p className="mt-3 text-[11px] text-muted-foreground">
      Zero al centro; a destra aumenti, a sinistra diminuzioni. {orderNote ?? "Selezione per variazione assoluta, non per spesa 2025."}
      {anyNa && " «n/c»: variazione percentuale non calcolabile, perché la spesa 2024 della molecola è assente o nulla nella selezione."}
      {" "}Il nome di una molecola apre la stessa pagina ristretta a quella molecola, dove la spesa per canale e per anno è letta sulle stesse righe.
    </p>
    </>}
  </Frame>;
}

export function ConcentrationCurve({ data, year, scopeNote }: {
  /** The full view model, or the slim one carrying the curve's sampled points. */
  data: Pick<Concentration, "rows" | "moleculeCount"> & { samples?: ReadonlyArray<{ rank: number; cumulativeShare: number }> };
  /** The complete year the ranking describes; the title and the accessible name carry it. */
  year: number;
  /** Whose spend the denominator is, e.g. "di tutto il libro mastro nell'ambito selezionato". */
  scopeNote: string;
}) {
  const ranks = [...new Set([1, 5, 10, 25, 50, 100, 250, data.moleculeCount])]
    .filter((r) => r > 0 && r <= data.moleculeCount).sort((a, b) => a - b);
  const points = data.samples
    ? data.samples.map((s) => ({ rank: s.rank, share: s.cumulativeShare }))
    : ranks.map((r) => ({ rank: r, share: data.rows[r - 1]?.cumulativeShare ?? 0 }));
  const width = 760, height = 264, left = 58, right = 728, top = 22, bottom = 215;
  const maxShare = Math.max(1, ...points.map((p) => p.share));
  const x = (rank: number) => left + Math.log1p(rank) / Math.log1p(Math.max(data.moleculeCount, 1)) * (right - left);
  const y = (share: number) => bottom - share / maxShare * (bottom - top);
  const line = points.map((p) => `${x(p.rank)},${y(p.share)}`).join(" ");
  return <Frame title={`Quanto rapidamente si concentra la spesa · ${year}`}>
    {points.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna molecola osservata.</p> : <>
    <svg role="img" aria-label={`Quota cumulata della spesa netta ${year} per numero di molecole in ordine decrescente di spesa, ${scopeNote}`} viewBox={`0 0 ${width} ${height}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
      {[0, .25, .5, .75, 1].map((v) => <g key={v}><line x1={left} y1={y(v * maxShare)} x2={right} y2={y(v * maxShare)} stroke={grid} strokeDasharray="3 4" /><text x={left - 8} y={y(v * maxShare) + 4} textAnchor="end" fontSize="11" fill={muted}>{formatPercent(v * maxShare)}</text></g>)}
      <polyline points={line} fill="none" stroke={teal} strokeWidth="3" strokeLinejoin="round" />
      {points.map((p) => <g key={p.rank}><circle cx={x(p.rank)} cy={y(p.share)} r="4" fill={teal} /><text x={x(p.rank)} y={bottom + 23} textAnchor="middle" fontSize="11" fill={muted}>{formatNumber(p.rank, 0)}</text></g>)}
      <text x={(left + right) / 2} y={height - 4} textAnchor="middle" fontSize="11" fill={muted}>Molecole ordinate per spesa · asse orizzontale logaritmico</text>
    </svg>
    <p className="mt-1 text-[11px] text-muted-foreground">Il denominatore è la spesa netta totale {scopeNote}. Le rettifiche negative restano nel totale; per questo la curva può superare 100% prima di chiudere a 100%.</p>
    </>}
  </Frame>;
}
