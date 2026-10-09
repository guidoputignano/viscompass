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

// ------------------------------------------------------------ narrow layouts
//
// THE CARD, NOT THE SCREEN. Each chart switches layout on the width of its own
// box (a CSS container query on a `[container-type:inline-size]` wrapper), not
// on the viewport: the same chart sits in a 267 px card on a phone, a 340 px
// one beside the tablet sidebar and a 600 px one at 1024. A 760-unit drawing
// scaled into those cards printed its 11-13 unit text at 4-9 px.
//
// The narrow drawings are NARROW_W units wide and capped at 24rem, so 12-13
// unit text renders at about 11-16 px wherever they show. They re-flow rather
// than shrink: names on their own line, values printed beside the marks, axis
// labels thinned so none overlaps. Same rows, same helpers, same numbers.
// Both variants are in the DOM; the inactive one is display:none, so it is
// out of the accessibility tree and the tab order.

/** Width, in drawing units, of the narrow SVG variants. */
export const NARROW_W = 280;

/** A generous estimate of a label's width in drawing units (0.6 em per character). */
export function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}

/**
 * Which axis labels a narrow chart prints. Given each label's horizontal
 * extent [start, end], in axis order, the LAST is always kept (the end of the
 * scale, e.g. the molecule count); then, from the left, every label that
 * clears the previous kept one and the last by `gap`. Only labels thin out:
 * every mark is still drawn.
 */
export function clearLabels(extents: ReadonlyArray<readonly [number, number]>, gap = 6): boolean[] {
  const keep = extents.map(() => false);
  if (extents.length === 0) return keep;
  const last = extents.length - 1;
  keep[last] = true;
  let edge = -Infinity;
  for (let i = 0; i < last; i++) {
    const [start, end] = extents[i];
    if (start >= edge + gap && end <= extents[last][0] - gap) { keep[i] = true; edge = end; }
  }
  return keep;
}

/** A name shortened to `max` characters for a narrow chart; its <title> keeps it whole. */
export function clipLabel(label: string, max: number): string {
  const room = Math.max(1, Math.floor(max));
  return label.length > room ? `${label.slice(0, Math.max(1, room - 1)).trimEnd()}…` : label;
}

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
    // Stacked (name, bar, count) until the card holds the 13rem name column,
    // a bar of about 12rem and the 9rem count: 36rem of CARD, not of screen.
    <div className="[container-type:inline-size]">
    <div role="img" aria-label="Imbuto dei record osservati, classificabili, nel perimetro e con quantità confrontabile" className="space-y-3">
      {rows.map((row) => {
        const width = max > 0 ? Math.max(0, Math.min(100, 100 * row.rows_n / max)) : 0;
        return <div key={row.step} className="grid gap-1.5 [@container(min-width:36rem)]:grid-cols-[13rem_1fr_9rem] [@container(min-width:36rem)]:items-center [@container(min-width:36rem)]:gap-3">
          <div className="text-xs font-medium text-foreground">{row.step}. {row.stage}</div>
          <div className="h-7 overflow-hidden rounded bg-muted/70">
            <div className="h-full rounded bg-primary/80" style={{ width: `${width}%` }} />
          </div>
          <div className="text-right font-mono text-xs text-foreground">{formatNumber(row.rows_n, 0)} {row.shareOfObserved !== null && <span className="whitespace-nowrap text-muted-foreground">· {formatPercent(row.shareOfObserved)}</span>}</div>
        </div>;
      })}
    </div>
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
  return <Frame title="Copertura della quota in volume">
    {share === null ? <p className="text-sm text-muted-foreground">Quota non calcolabile nel perimetro della misura.</p> : <>
      <div role="img" aria-label={`Spesa utilizzata ${formatPercent(1 - withheldShare!)}, spesa trattenuta ${formatPercent(withheldShare!)}, sul perimetro della misura`} className="flex h-9 overflow-hidden rounded-lg">
        <div className="bg-primary" style={{ width: `${(1 - share) * 100}%` }} />
        <div className="bg-amber-500" style={{ width: `${share * 100}%` }} />
      </div>
      {/* Two columns once the CARD holds both lines whole (28rem), not at the
          sm screen width: beside the tablet sidebar each half was ~150 px. */}
      <div className="mt-3 [container-type:inline-size]">
      <div className="grid gap-2 text-xs [@container(min-width:28rem)]:grid-cols-2">
        <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-primary" /><span className="font-semibold">Utilizzata {formatPercent(1 - withheldShare!)}</span><span className="ml-2 whitespace-nowrap text-muted-foreground">{formatEur(usedSpend)}</span></div>
        <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" /><span className="font-semibold">Trattenuta {formatPercent(withheldShare!)}</span><span className="ml-2 whitespace-nowrap text-muted-foreground">{formatEur(withheldSpend)}</span></div>
      </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Base: spesa utilizzata + trattenuta nel perimetro della misura, non tutta la spesa rendicontata.</p>
    </>}
  </Frame>;
}

/**
 * THE NARROW SLOPE CHART. Each channel is a band of its own: the name, with
 * the change in percent at its right; the shared euro scale as a thin track
 * with the same two dots and segment as the wide chart; then the two spends,
 * written out, because a phone has no room for the wide chart's five axis
 * labels. The axis keeps only the labels that do not collide (both ends at
 * least). Same ticks, same axis label helper, same rows as the wide drawing.
 */
function ChannelSlopeNarrow({ rows, ticks, lo, span, axisLabel }: {
  rows: TrendRow[];
  ticks: number[];
  lo: number;
  span: number;
  axisLabel: (v: number) => string;
}) {
  const W = NARROW_W, l = 10, r = W - 10, top = 2;
  const nx = (v: number) => l + (v - lo) / span * (r - l);
  const bands = rows.map((row) => {
    const pct = row.change === null ? null : formatPercent(row.change);
    const name = clipLabel(row.label, (r - l - (pct === null ? 0 : textWidth(pct, 12) + 10)) / (13 * 0.6));
    // A year with no record is "nessun record", never "0 €" (trend() fills it as 0).
    const v2024 = `2024 · ${row.rows2024 === 0 ? "nessun record" : axisLabel(row.spend2024)}`;
    const v2025 = `2025 · ${row.rows2025 === 0 ? "nessun record" : axisLabel(row.spend2025)}`;
    // The two spends share a line when they fit; otherwise 2025 goes below.
    const stacked = textWidth(v2024, 12) + textWidth(v2025, 12) + 10 > r - l;
    return { row, pct, name, v2024, v2025, stacked, height: stacked ? 82 : 64 };
  });
  const offsets = bands.reduce<number[]>((acc, b, i) => [...acc, acc[i] + b.height], [top]);
  const axisY = offsets[bands.length] + 12;
  const height = axisY + 4;
  const tickText = ticks.map(axisLabel);
  const last = ticks.length - 1;
  const anchor = (i: number) => (i === 0 ? "start" : i === last ? "end" : "middle");
  const labelled = clearLabels(ticks.map((t, i) => {
    const w = textWidth(tickText[i], 12), x = nx(t);
    return i === 0 ? [x, x + w] as const : i === last ? [x - w, x] as const : [x - w / 2, x + w / 2] as const;
  }));
  return <svg role="img" aria-label="Confronto della spesa 2024 e 2025 per canale, in euro" viewBox={`0 0 ${W} ${height}`} className="w-full max-w-[20rem]" xmlns="http://www.w3.org/2000/svg">
    {bands.map((b, i) => {
      const y0 = offsets[i], y = y0 + 32;
      return <g key={b.row.key}>
        <text x={l} y={y0 + 14} fontSize="13" fill={ink}>{b.name !== b.row.label ? <title>{b.row.label}</title> : null}{b.name}</text>
        {b.pct !== null && <text x={r} y={y0 + 14} textAnchor="end" fontSize="12" fill={ink}>{b.pct}</text>}
        <line x1={nx(lo)} y1={y} x2={nx(lo + span)} y2={y} stroke={grid} strokeWidth="1" />
        {ticks.map((t) => <line key={t} x1={nx(t)} y1={y - 4} x2={nx(t)} y2={y + 4} stroke={grid} strokeWidth="1" />)}
        {b.row.rows2024 > 0 && b.row.rows2025 > 0 && <line x1={nx(b.row.spend2024)} y1={y} x2={nx(b.row.spend2025)} y2={y} stroke={b.row.changeEur >= 0 ? teal : coral} strokeWidth="5" strokeLinecap="round" />}
        {b.row.rows2024 > 0 && <circle cx={nx(b.row.spend2024)} cy={y} r="6" fill={muted} />}
        {b.row.rows2025 > 0 && <circle cx={nx(b.row.spend2025)} cy={y} r="7" fill={teal} stroke="white" strokeWidth="2" />}
        <text x={l} y={y0 + 54} fontSize="12" fill={muted}>{b.v2024}</text>
        <text x={b.stacked ? l : r} y={y0 + (b.stacked ? 72 : 54)} textAnchor={b.stacked ? "start" : "end"} fontSize="12" fill={ink}>{b.v2025}</text>
        {i < bands.length - 1 && <line x1={0} y1={y0 + b.height - 2} x2={W} y2={y0 + b.height - 2} stroke={grid} strokeWidth="1" strokeOpacity="0.6" />}
      </g>;
    })}
    {ticks.map((t, i) => labelled[i] && <text key={t} x={nx(t)} y={axisY} textAnchor={anchor(i)} fontSize="12" fill={muted}>{tickText[i]}</text>)}
  </svg>;
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
    {/* The 760-unit drawing from a 760 px card up (47.5rem), where its text is
        at its design size; below, the narrow drawing. */}
    <div className="[container-type:inline-size]">
    <div className="[@container(min-width:47.5rem)]:hidden">
      <ChannelSlopeNarrow rows={rows} ticks={ticks} lo={lo} span={span} axisLabel={axisLabel} />
    </div>
    <div className="hidden [@container(min-width:47.5rem)]:block">
    <svg role="img" aria-label="Confronto della spesa 2024 e 2025 per canale, in euro" viewBox={`0 0 ${width} ${height}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
      {ticks.map((tick) => { const xx = x(tick); return <g key={tick}><line x1={xx} y1={top - 8} x2={xx} y2={height - 30} stroke={grid} strokeDasharray="3 4"/><text x={xx} y={height - 9} textAnchor="middle" fontSize="11" fill={muted}>{axisLabel(tick)}</text></g>; })}
      {rows.map((r, i) => { const y = top + i * rowGap + 17; return <g key={r.key}>
        <text x={left - 12} y={y + 4} textAnchor="end" fontSize="13" fill={ink}>{r.label}</text>
        {/* A year with no record draws no point: absence is not a zero. */}
        {r.rows2024 > 0 && r.rows2025 > 0 && <line x1={x(r.spend2024)} y1={y} x2={x(r.spend2025)} y2={y} stroke={r.changeEur >= 0 ? teal : coral} strokeWidth="5" strokeLinecap="round" />}
        {r.rows2024 > 0 && <circle cx={x(r.spend2024)} cy={y} r="6" fill={muted} />}
        {r.rows2025 > 0 && <circle cx={x(r.spend2025)} cy={y} r="7" fill={teal} stroke="white" strokeWidth="2" />}
        {r.change !== null && <text x={width - 4} y={y + 4} textAnchor="end" fontSize="12" fill={ink}>{formatPercent(r.change)}</text>}
      </g>; })}
    </svg>
    </div>
    </div>
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
    {/* TWO LINES PER MOLECULE until the card holds the 12rem name, a bar of
        about 12rem and the 9rem figure (36rem of CARD, not of screen): the
        name, in full, with the figure at its right, then the bar across the
        card. In a 267 px phone card the three columns left the bar a few
        pixels and the Frame clipped the figure. From 36rem, the three columns
        as before. */}
    <div className="[container-type:inline-size]">
    <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 gap-y-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground [@container(min-width:36rem)]:grid-cols-[minmax(0,12rem)_1fr_9rem]">
      <span>Molecola</span>
      <span className="col-span-2 row-start-2 [@container(min-width:36rem)]:col-span-1 [@container(min-width:36rem)]:row-start-auto">Barra: variazione € 2025 meno 2024 · zero al centro</span>
      <span className="text-right">{heading}</span>
    </div>
    <div role="img" aria-label={`${title ?? "Le dieci variazioni in euro più ampie"}: barre della variazione della spesa 2025 rispetto al 2024, cifra a destra ${heading}`} className="space-y-3 [@container(min-width:36rem)]:space-y-2">
      {selected.map((r) => {
        const { primary, secondary } = trendFigures(r, measure);
        return <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 text-xs [@container(min-width:36rem)]:grid-cols-[minmax(0,12rem)_1fr_9rem] [@container(min-width:36rem)]:gap-y-2">
          {r.href
            ? <KeepLink href={r.href} className="min-w-0 break-words text-foreground hover:text-primary hover:underline [@container(min-width:36rem)]:truncate">{r.label}</KeepLink>
            : <span title={r.label} className="min-w-0 break-words text-foreground [@container(min-width:36rem)]:truncate">{r.label}</span>}
          <div className="col-span-2 row-start-2 grid h-5 grid-cols-2 [@container(min-width:36rem)]:col-span-1 [@container(min-width:36rem)]:row-start-auto">
            <div className="flex items-center justify-end border-r border-border">
              {r.changeEur < 0 && <div className="h-3 rounded-sm bg-orange-500" style={{ width: `${Math.abs(r.changeEur) / max * 100}%` }} />}
            </div>
            <div className="flex items-center">
              {r.changeEur >= 0 && <div className="h-3 rounded-sm bg-primary" style={{ width: `${Math.abs(r.changeEur) / max * 100}%` }} />}
            </div>
          </div>
          <span className="whitespace-nowrap text-right font-mono text-[11px] leading-tight text-foreground [@container(min-width:36rem)]:whitespace-normal">
            {figureText(primary)}
            {secondary && <span className="block text-[10px] text-muted-foreground">{secondary.kind === "pct" ? "" : secondary.kind === "eur" && measure === "spesa" ? "variazione " : ""}{figureText(secondary)}</span>}
          </span>
        </div>;
      })}
    </div>
    </div>
    <p className="mt-3 text-[11px] text-muted-foreground">
      Zero al centro; a destra aumenti, a sinistra diminuzioni. {orderNote ?? "Selezione per variazione assoluta, non per spesa 2025."}
      {anyNa && " «n/c»: variazione percentuale non calcolabile, perché la spesa 2024 della molecola è assente o nulla nella selezione."}
      {" "}Il nome di una molecola apre la stessa pagina ristretta a quella molecola, dove la spesa per canale e per anno è letta sulle stesse righe.
    </p>
    </>}
  </Frame>;
}

/**
 * THE NARROW CONCENTRATION CURVE. The same points on the same log scale and
 * the same five share gridlines, in a drawing about a phone card wide. The
 * rank labels that would collide (250 beside the molecule count, typically)
 * are dropped, the count itself never; the axis title takes two lines.
 */
function ConcentrationNarrow({ points, maxShare, moleculeCount, label }: {
  points: ReadonlyArray<{ rank: number; share: number }>;
  maxShare: number;
  moleculeCount: number;
  label: string;
}) {
  const W = NARROW_W, left = 52, right = W - 12, top = 10, bottom = 176;
  const height = bottom + 64;
  const nx = (rank: number) => left + Math.log1p(rank) / Math.log1p(Math.max(moleculeCount, 1)) * (right - left);
  const ny = (share: number) => bottom - share / maxShare * (bottom - top);
  const ranks = points.map((p) => {
    const text = formatNumber(p.rank, 0), w = textWidth(text, 12);
    // Centred under its point, but never past either edge of the drawing.
    const x = Math.min(Math.max(nx(p.rank), w / 2 + 1), W - 1 - w / 2);
    return { text, x, extent: [x - w / 2, x + w / 2] as const };
  });
  const labelled = clearLabels(ranks.map((r) => r.extent));
  return <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${height}`} className="w-full max-w-[20rem]" xmlns="http://www.w3.org/2000/svg">
    {[0, .25, .5, .75, 1].map((v) => <g key={v}><line x1={left} y1={ny(v * maxShare)} x2={right} y2={ny(v * maxShare)} stroke={grid} strokeDasharray="3 4" /><text x={left - 6} y={ny(v * maxShare) + 4} textAnchor="end" fontSize="12" fill={muted}>{formatPercent(v * maxShare)}</text></g>)}
    <polyline points={points.map((p) => `${nx(p.rank)},${ny(p.share)}`).join(" ")} fill="none" stroke={teal} strokeWidth="3" strokeLinejoin="round" />
    {points.map((p, i) => <g key={p.rank}><circle cx={nx(p.rank)} cy={ny(p.share)} r="4" fill={teal} />{labelled[i] && <text x={ranks[i].x} y={bottom + 20} textAnchor="middle" fontSize="12" fill={muted}>{ranks[i].text}</text>}</g>)}
    <text x={(left + right) / 2} y={height - 24} textAnchor="middle" fontSize="12" fill={muted}>Molecole ordinate per spesa</text>
    <text x={(left + right) / 2} y={height - 6} textAnchor="middle" fontSize="12" fill={muted}>asse orizzontale logaritmico</text>
  </svg>;
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
    {/* The 760-unit drawing from a 760 px card up (47.5rem); below, the narrow one. */}
    <div className="[container-type:inline-size]">
    <div className="[@container(min-width:47.5rem)]:hidden">
      <ConcentrationNarrow points={points} maxShare={maxShare} moleculeCount={data.moleculeCount}
        label={`Quota cumulata della spesa netta ${year} per numero di molecole in ordine decrescente di spesa, ${scopeNote}`} />
    </div>
    <div className="hidden [@container(min-width:47.5rem)]:block">
    <svg role="img" aria-label={`Quota cumulata della spesa netta ${year} per numero di molecole in ordine decrescente di spesa, ${scopeNote}`} viewBox={`0 0 ${width} ${height}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
      {[0, .25, .5, .75, 1].map((v) => <g key={v}><line x1={left} y1={y(v * maxShare)} x2={right} y2={y(v * maxShare)} stroke={grid} strokeDasharray="3 4" /><text x={left - 8} y={y(v * maxShare) + 4} textAnchor="end" fontSize="11" fill={muted}>{formatPercent(v * maxShare)}</text></g>)}
      <polyline points={line} fill="none" stroke={teal} strokeWidth="3" strokeLinejoin="round" />
      {points.map((p) => <g key={p.rank}><circle cx={x(p.rank)} cy={y(p.share)} r="4" fill={teal} /><text x={x(p.rank)} y={bottom + 23} textAnchor="middle" fontSize="11" fill={muted}>{formatNumber(p.rank, 0)}</text></g>)}
      <text x={(left + right) / 2} y={height - 4} textAnchor="middle" fontSize="11" fill={muted}>Molecole ordinate per spesa · asse orizzontale logaritmico</text>
    </svg>
    </div>
    </div>
    <p className="mt-1 text-[11px] text-muted-foreground">Il denominatore è la spesa netta totale {scopeNote}. Le rettifiche negative restano nel totale; per questo la curva può superare 100% prima di chiudere a 100%.</p>
    </>}
  </Frame>;
}
