// Server-rendered SVG for the Pillar B adoption and panorama views.
//
// Same contract as pillar-b-review-visuals.tsx: every mark encodes a figure
// that also appears in a table on the page, nothing is computed here that the
// pure modules did not already compute, and null is drawn as "not observed",
// never as zero. The charts are plain SVG with no state of their own, so they
// render identically for the harness, the reader and a screen reader; the
// panel-local controls live in pillar-b-panels.tsx.

import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { DumbbellRow, TimelineModel, TimelineRow } from "@/lib/dashboard-review/pillar-b/adoption";
import { dumbbellGapPoints, dumbbellLead, dumbbellMarkLabel, dumbbellPlottable, monthKeyLabel, timelineLead } from "@/lib/dashboard-review/pillar-b/adoption";
import { channelYearMix, perimeterComposition, type AziendaPanelRow, type ChannelMixRow, type FacetPerimeter } from "@/lib/dashboard-review/pillar-b/facets";
import { aziendaMetricValue, type AziendaMetric } from "@/lib/dashboard-review/pillar-b/view-options";

const ink = "hsl(var(--foreground))";
const card = "hsl(var(--card))";
const muted = "hsl(var(--muted-foreground))";
const grid = "hsl(var(--border))";
const teal = "hsl(var(--primary))";
const slate = "hsl(204 15% 55%)";
const coral = "#e87955";

const compact = (v: number): string =>
  Math.abs(v) >= 1_000_000 ? `${formatNumber(v / 1_000_000, 1)} M€`
  : Math.abs(v) >= 1_000 ? `${formatNumber(v / 1_000, 0)} k€`
  : formatEur(v);

/**
 * `container`: the figure becomes a size container (container-type:
 * inline-size), so its caption and content can switch layout on the card's
 * OWN width with [@container(min-width:…)] variants. The viewport is the wrong
 * measure here: at 768-1180 px the sidebar leaves a phone-sized card.
 */
export function Frame({ title, lead, children, container = false }: { title: string; lead?: React.ReactNode; children: React.ReactNode; container?: boolean }) {
  return <figure className={"overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5" + (container ? " [container-type:inline-size]" : "")}>
    <figcaption className="mb-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {lead && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{lead}</p>}
    </figcaption>
    {children}
  </figure>;
}

/**
 * One "column label · value" pair of a table row stacked for a narrow card:
 * the label may wrap, the value is right-aligned and never split from its
 * unit. Used inside a two-column <dl> (minmax(0,1fr) auto).
 */
function Pair({ label, value, dim = false }: { label: string; value: string; dim?: boolean }) {
  return <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={"whitespace-nowrap text-right font-mono " + (dim ? "text-muted-foreground" : "text-foreground")}>{value}</dd>
  </>;
}
const PAIRS = "mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5";

// ------------------------------------------------------------------ dumbbell

/**
 * Both denominators per substance on one axis. The gap between the two dots
 * is the difference the two questions make; a missing teal dot means no
 * biosimilar of that substance was ever dispensed in the visible scope.
 */
/** What the gap column says for one row: the gap in p.p., or why there is none. */
function gapCell(r: DumbbellRow, pa: boolean, pb: boolean, gap: number | null): { text: string; title: string | null; tone: string; cls?: string } {
  if (gap !== null) return { text: `${gap > 0 ? "+" : ""}${formatNumber(gap, 1)} p.p.`, title: `${r.substance}: quota 2 meno quota 1 = ${formatNumber(gap, 1)} punti percentuali`, tone: muted };
  if ((r.dateValid !== null && !pa) || (r.locallyObserved !== null && !pb)) {
    return { text: "non calcolabile: rettifiche", title: `${r.substance}: una quota è fuori da 0–100% o ha denominatore non positivo per rettifiche nette; non è disegnata`, tone: muted };
  }
  if (r.dateValid === null && r.locallyObserved === null) return { text: "nessun mese valido", title: null, tone: muted };
  if (r.firstLocalLabel !== null) return { text: "nessuna spesa dal primo uso", title: null, tone: muted };
  // Coral as TEXT: #b54d2b on the light card (5.2:1), #f19a7a on the dark one
  // (6.0:1); the series coral itself is 2.9:1 on white.
  return { text: "mai dispensato qui", title: null, tone: coral, cls: "fill-[#b54d2b] dark:fill-[#f19a7a]" };
}

/**
 * THE PHONE LAYOUT (a chart narrower than 47.5rem, measured on the chart's own
 * wrapper, not on the viewport). The desktop chart keeps a 760-unit drawing
 * with a 190-unit name column; inside a phone's card it was two-thirds hidden
 * behind a sideways scroll, high shares included, and a tablet's card (340-640
 * px, beside the sidebar) still hid a fifth to two-thirds of it.
 *
 * Every row has the same three lines: the name; the full-width 0–100% track;
 * then the reference amount (left) and the gap or the reason (right). A thin
 * rule separates rows, so no label can be read as its neighbour's. The
 * viewBox is close to a phone card's width (about 275 px at 375) and the width
 * is capped at 20rem, so 12-13-unit text renders at about 12-15 px, never at
 * 7, and does not balloon in a 600 px tablet card below the switch.
 */
function DumbbellPhone({ rows, periodScope }: { rows: DumbbellRow[]; periodScope: string }) {
  // 8-unit margins: a ring at 0% or 100% (radius 6.5, stroke 2.5) stays
  // inside the viewBox, its stroke included.
  const W = 280, l = 8, r = W - 8;
  const mx = (s: number) => l + Math.max(0, Math.min(1, s)) * (r - l);
  const rowH = 62, top = 2;
  // A longer name is shortened; its title keeps it whole.
  const nameMax = 38;
  const height = top + Math.max(rows.length, 1) * rowH + 18;
  return <svg role="img" aria-label={`Quota biosimilare per molecola su due denominatori, ${periodScope}`} viewBox={`0 0 ${W} ${height}`} className="w-full max-w-[20rem] [@container(min-width:47.5rem)]:hidden" xmlns="http://www.w3.org/2000/svg">
    {[0, .5, 1].map((t) => <text key={t} x={mx(t)} y={height - 4} textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"} fontSize="12" fill={muted}>{formatPercent(t)}</text>)}
    {rows.map((row, i) => {
      const y0 = top + i * rowH;
      const y = y0 + 30;
      const pa = dumbbellPlottable(row, "quota1"), pb = dumbbellPlottable(row, "quota2");
      const gap = dumbbellGapPoints(row);
      const cell = gapCell(row, pa, pb, gap);
      const label1 = dumbbellMarkLabel(row, "quota1", periodScope);
      const label2 = dumbbellMarkLabel(row, "quota2", periodScope);
      const name = row.substance.length > nameMax ? `${row.substance.slice(0, nameMax - 1)}…` : row.substance;
      return <g key={row.substance}>
        <text x={l} y={y0 + 14} fontSize="13" fill={ink}>{name !== row.substance ? <title>{row.substance}</title> : null}{name}</text>
        <line x1={mx(0)} y1={y} x2={mx(1)} y2={y} stroke={grid} strokeWidth="1" />
        {[0.25, 0.5, 0.75].map((t) => <line key={t} x1={mx(t)} y1={y - 3} x2={mx(t)} y2={y + 3} stroke={grid} strokeWidth="1" />)}
        {pa && pb && <line x1={mx(row.dateValid!)} y1={y} x2={mx(row.locallyObserved!)} y2={y} stroke={teal} strokeWidth="3" strokeOpacity="0.45" strokeLinecap="round" />}
        {pa && <circle cx={mx(row.dateValid!)} cy={y} r="6.5" fill="none" stroke={slate} strokeWidth="2.5" tabIndex={0} aria-label={label1}><title>{label1}</title></circle>}
        {pb && <circle cx={mx(row.locallyObserved!)} cy={y} r="4.5" fill={teal} tabIndex={0} aria-label={label2}><title>{label2}</title></circle>}
        <text x={l} y={y0 + 51} fontSize="12" fill={muted}><title>{`${row.substance}: riferimento nei mesi validi ${formatEur(row.referenceEur)}`}</title>{`rif. ${compact(row.referenceEur)}`}</text>
        <text x={r} y={y0 + 51} textAnchor="end" fontSize="12" fill={cell.tone} className={cell.cls}>{cell.title ? <title>{cell.title}</title> : null}{cell.text}</text>
        {i < rows.length - 1 && <line x1={0} y1={y0 + rowH - 2} x2={W} y2={y0 + rowH - 2} stroke={grid} strokeWidth="1" strokeOpacity="0.6" />}
      </g>;
    })}
  </svg>;
}

export function DumbbellUptakeChart({ rows, limit, periodScope }: {
  rows: DumbbellRow[];
  limit?: number;
  /** "intero perimetro visibile · 2024 e 2025 · tutti i canali": in every exact-value label. */
  periodScope: string;
}) {
  // EVERY MOLECULE BY DEFAULT: the Region reads the whole list, and a cut at
  // sixteen hid the tail the table carried. A caller may still pass a limit;
  // the footnote then says how many are not drawn.
  const shown = limit === undefined ? rows : rows.slice(0, limit);
  const width = 760, left = 190, right = 610, top = 30, rowGap = 26;
  const height = top + Math.max(shown.length, 1) * rowGap + 30;
  const x = (s: number) => left + Math.max(0, Math.min(1, s)) * (right - left);
  // THE SWITCH IS THE CHART'S OWN WIDTH (a container query on the Frame), not
  // the viewport's: a tablet beside the sidebar has a phone-sized card. From
  // 47.5rem the 760-unit drawing renders 1:1, its text at design size.
  return <Frame
    container
    title="Quota biosimilare per molecola, sui due denominatori"
    lead={dumbbellLead(shown)}
  >
    {shown.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna molecola nel perimetro con questi filtri.</p> : <>
    {/* THE KEY, drawn with the same marks as the chart (PB-V5-02). */}
    <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke={slate} strokeWidth="2.5" /></svg>quota 1 · mesi a validità riconosciuta</span>
      <span className="inline-flex items-center gap-1.5"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4.5" fill={teal} /></svg>quota 2 · mesi dal primo uso qui</span>
      <span className="inline-flex items-center gap-1.5"><svg aria-hidden="true" width="22" height="16" viewBox="0 0 22 16"><line x1="2" y1="8" x2="20" y2="8" stroke={teal} strokeWidth="3" strokeOpacity="0.45" strokeLinecap="round" /></svg>differenza fra le due quote, in punti percentuali</span>
      <span><span className="hidden [@container(min-width:47.5rem)]:inline">a destra: spesa di riferimento nei mesi validi</span><span className="[@container(min-width:47.5rem)]:hidden">«rif.» sotto ogni riga: spesa di riferimento nei mesi validi</span></span>
    </div>
    <DumbbellPhone rows={shown} periodScope={periodScope} />
    <div className="hidden overflow-x-auto [@container(min-width:47.5rem)]:block"><svg role="img" aria-label={`Quota biosimilare per molecola su due denominatori, ${periodScope}`} viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[47.5rem]" xmlns="http://www.w3.org/2000/svg">
      {[0, .25, .5, .75, 1].map((t) => <g key={t}>
        <line x1={x(t)} y1={top - 10} x2={x(t)} y2={height - 24} stroke={grid} strokeDasharray="3 4" />
        <text x={x(t)} y={height - 8} textAnchor="middle" fontSize="11" fill={muted}>{formatPercent(t)}</text>
      </g>)}
      {shown.map((r, i) => {
        const y = top + i * rowGap + 8;
        const a = r.dateValid, b = r.locallyObserved;
        // Only a share inside 0–100% on a positive denominator is a position.
        const pa = dumbbellPlottable(r, "quota1"), pb = dumbbellPlottable(r, "quota2");
        const gap = dumbbellGapPoints(r);
        const gx = right + 14;
        const label1 = dumbbellMarkLabel(r, "quota1", periodScope);
        const label2 = dumbbellMarkLabel(r, "quota2", periodScope);
        return <g key={r.substance}>
          <text x={left - 10} y={y + 4} textAnchor="end" fontSize="12" fill={ink}>{r.substance}</text>
          {/* The 0–100% track: a mark is a position on it, not the end of a bar. */}
          <line x1={x(0)} y1={y} x2={x(1)} y2={y} stroke={grid} strokeWidth="1" />
          {pa && pb && <line x1={x(a!)} y1={y} x2={x(b!)} y2={y} stroke={teal} strokeWidth="3" strokeOpacity="0.45" strokeLinecap="round" />}
          {/* Quota 1 is a ring, quota 2 a filled dot: equal values stay visible
              as a dot inside a ring. ONE text child per <title> (hydration #418). */}
          {pa && <circle cx={x(a!)} cy={y} r="6.5" fill="none" stroke={slate} strokeWidth="2.5" tabIndex={0} aria-label={label1}><title>{label1}</title></circle>}
          {pb && <circle cx={x(b!)} cy={y} r="4.5" fill={teal} tabIndex={0} aria-label={label2}><title>{label2}</title></circle>}
          {(() => { const cell = gapCell(r, pa, pb, gap); return <text x={gx} y={y + 4} fontSize="10" fill={cell.tone} className={cell.cls}>{cell.title ? <title>{cell.title}</title> : null}{cell.text}</text>; })()}
          <text x={width - 4} y={y + 4} textAnchor="end" fontSize="11" fill={muted}><title>{`${r.substance}: riferimento nei mesi validi ${formatEur(r.referenceEur)}`}</title>{compact(r.referenceEur)}</text>
        </g>;
      })}
    </svg></div>
    {rows.length > shown.length && <p className="mt-1 text-[11px] text-muted-foreground">Mostrate {formatNumber(shown.length, 0)} di {formatNumber(rows.length, 0)} molecole; le altre sono nella tabella sotto e in tutti i totali.</p>}
    </>}
  </Frame>;
}

// ------------------------------------------------------------------ timeline

/**
 * THE NARROW TIMELINE (a chart narrower than 47.5rem). The 760-unit drawing
 * keeps a 180-unit name column; in a phone card it was 64% hidden behind a
 * sideways scroll, and still 21% on a 1024 px tablet.
 *
 * Re-flowed, not shrunk: each molecule has two lines, its name, then the
 * release window as a track (a tick at each January and at the end of
 * observation) with the dot at the first local use and the month beside it.
 * The years are written once, above. The month label is always "aaaa-mm",
 * seven characters (about 46 units at 12): it goes left of the dot only when
 * the dot sits too close to the right end for it to fit on the right. A 300-
 * unit viewBox, capped at 22rem, renders 12-13-unit text at about 11-15 px.
 */
function TimelinePhone({ model, years, radius, exact }: {
  model: TimelineModel;
  years: number[];
  radius: (eur: number) => number;
  exact: (row: TimelineRow) => string;
}) {
  const { fromKey, toKey, rows } = model;
  const W = 300, l = 12, r = W - 12;
  const span = Math.max(1, toKey - fromKey);
  const mx = (k: number) => l + (k - fromKey) / span * (r - l);
  const rowH = 46, top = 24, monthW = 48, yearW = 28;
  const nameMax = 38;
  const height = top + Math.max(rows.length, 1) * rowH + 18;
  // A Set: when observation ends in a January, toKey is also a year tick.
  const ticks = [...new Set([...years.map((yr) => yr * 12 + 1), toKey])];
  return <svg role="img" aria-label="Mese della prima dispensazione locale di un biosimilare, per molecola" viewBox={`0 0 ${W} ${height}`} className="w-full max-w-[22rem] [@container(min-width:47.5rem)]:hidden" xmlns="http://www.w3.org/2000/svg">
    {years.map((yr) => {
      const x0 = mx(yr * 12 + 1);
      const end = x0 + 3 + yearW > W;
      return <text key={yr} x={end ? x0 - 3 : x0 + 3} y={14} textAnchor={end ? "end" : "start"} fontSize="12" fill={muted}>{yr}</text>;
    })}
    {rows.map((row, i) => {
      const y0 = top + i * rowH;
      const y = y0 + 30;
      const k = row.firstKey!;
      const rad = radius(row.referenceEur);
      const left = mx(k) + rad + 4 + monthW > W;
      const name = row.substance.length > nameMax ? `${row.substance.slice(0, nameMax - 1)}…` : row.substance;
      return <g key={row.substance}>
        <text x={l} y={y0 + 13} fontSize="13" fill={ink}>{name !== row.substance ? <title>{row.substance}</title> : null}{name}</text>
        <line x1={mx(fromKey)} y1={y} x2={mx(toKey)} y2={y} stroke={grid} strokeWidth="1" />
        {ticks.map((t) => <line key={t} x1={mx(t)} y1={y - 4} x2={mx(t)} y2={y + 4} stroke={grid} strokeWidth="1" />)}
        <line x1={mx(k)} y1={y} x2={mx(toKey)} y2={y} stroke={teal} strokeWidth="2" strokeOpacity="0.18" />
        {/* ONE text child per <title> (React 19 hydration #418). */}
        <circle cx={mx(k)} cy={y} r={rad} fill={teal} fillOpacity="0.85" stroke="white" strokeWidth="1" tabIndex={0} aria-label={exact(row)}><title>{exact(row)}</title></circle>
        {/* A halo in the card's colour keeps the track from striking through the month. */}
        <text x={left ? mx(k) - rad - 4 : mx(k) + rad + 4} y={y + 4} textAnchor={left ? "end" : "start"} fontSize="12" fill={muted} stroke={card} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">{row.firstLabel}</text>
        {i < rows.length - 1 && <line x1={0} y1={y0 + rowH - 2} x2={W} y2={y0 + rowH - 2} stroke={grid} strokeWidth="1" strokeOpacity="0.6" />}
      </g>;
    })}
    <text x={mx(toKey)} y={height - 4} textAnchor="end" fontSize="12" fill={muted}>{`${monthKeyLabel(toKey)} · fine osservazione`}</text>
  </svg>;
}

export function FirstUseTimeline({ model, followsAzienda = true }: {
  model: TimelineModel;
  /** False when the opening clock could not be narrowed to the selected Azienda. */
  followsAzienda?: boolean;
}) {
  const { fromKey, toKey, rows, neverObserved } = model;
  const width = 760, left = 180, right = 740, top = 34, lane = 20;
  const height = top + Math.max(rows.length, 1) * lane + 26;
  const span = Math.max(1, toKey - fromKey);
  const x = (k: number) => left + (k - fromKey) / span * (right - left);
  const maxRef = Math.max(1, ...rows.map((r) => r.referenceEur));
  const r = (eur: number) => 3 + Math.sqrt(Math.max(0, eur) / maxRef) * 7;
  const years: number[] = [];
  for (let k = fromKey; k <= toKey; k++) if ((k - 1) % 12 === 0) years.push(Math.floor((k - 1) / 12));
  const largest = rows.reduce<TimelineRow | null>((m, r) => (m === null || r.referenceEur > m.referenceEur ? r : m), null);
  const exact = (row: TimelineRow) => `${row.substance} · primo biosimilare dispensato qui ${row.firstLabel} · riferimento nei mesi validi ${formatEur(row.referenceEur)} · spesa valida ${formatEur(row.validEur)} · osservazione fino a ${monthKeyLabel(toKey)}`;
  // Two layouts on the chart's own width (container queries on the Frame): the
  // drawing from 47.5rem, where its 760 units render 1:1; the exact-value
  // table from 40.125rem, its min-width plus its 1 px borders; below, the
  // narrow drawing and a list.
  return <Frame
    container
    title="Quando il primo biosimilare è comparso qui"
    lead={timelineLead(model, followsAzienda)}
  >
    {rows.length === 0 && neverObserved.length === 0 && model.notYetValid.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna molecola nel perimetro con questi filtri.</p> : <>
    {/* THE KEY, VISIBLE: what a dot, its size and the faint line mean. The
        reviewers asked why some rows "have a bar". Only when dots are drawn. */}
    {rows.length === 0 && <p className="mb-2 text-xs text-muted-foreground">Nessuna molecola con un primo uso di biosimilare osservato qui nel rilascio: non c&apos;è una linea del tempo da disegnare.</p>}
    {rows.length > 0 && <ul className="mb-2 grid gap-x-6 gap-y-1 text-[11px] text-muted-foreground [@container(min-width:47.5rem)]:grid-cols-3">
      <li><i className="mr-1.5 inline-block h-3 w-3 rounded-full align-middle" style={{ background: teal }} />Punto: mese del primo biosimilare dispensato qui (etichetta accanto).</li>
      <li><i className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: teal }} /><i className="mr-1.5 inline-block h-3.5 w-3.5 rounded-full align-middle" style={{ background: teal }} />Area del punto: spesa di riferimento nei mesi validi{largest ? ` (la più grande: ${largest.substance}, ${formatEur(largest.referenceEur)})` : ""}.</li>
      <li><i className="mr-1.5 inline-block h-0.5 w-6 align-middle" style={{ background: teal, opacity: 0.35 }} />Linea sottile: l&apos;osservazione prosegue fino a {monthKeyLabel(toKey)}; non indica una dispensazione continua.</li>
    </ul>}
    {rows.length > 0 && <TimelinePhone model={model} years={years} radius={r} exact={exact} />}
    {rows.length > 0 && <div className="hidden overflow-x-auto [@container(min-width:47.5rem)]:block"><svg role="img" aria-label="Mese della prima dispensazione locale di un biosimilare, per molecola" viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[47.5rem]" xmlns="http://www.w3.org/2000/svg">
      {years.map((yr) => { const k = yr * 12 + 1; return <g key={yr}>
        <line x1={x(k)} y1={top - 14} x2={x(k)} y2={height - 20} stroke={grid} />
        <text x={x(k) + 4} y={top - 18} fontSize="11" fill={muted}>{yr}</text>
      </g>; })}
      <line x1={x(toKey)} y1={top - 14} x2={x(toKey)} y2={height - 20} stroke={grid} strokeDasharray="2 3" />
      <text x={x(toKey)} y={height - 6} textAnchor="end" fontSize="10" fill={muted}>{monthKeyLabel(toKey)} · fine osservazione</text>
      {rows.map((row, i) => {
        const y = top + i * lane + 6;
        const k = row.firstKey!;
        return <g key={row.substance}>
          <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill={ink}>{row.substance}</text>
          <line x1={x(k)} y1={y} x2={x(toKey)} y2={y} stroke={teal} strokeWidth="2" strokeOpacity="0.18" />
          {/* ONE text child per <title> (React 19 hydration #418). */}
          <circle cx={x(k)} cy={y} r={r(row.referenceEur)} fill={teal} fillOpacity="0.85" stroke="white" strokeWidth="1" tabIndex={0} aria-label={exact(row)}><title>{exact(row)}</title></circle>
          <text x={x(k) + r(row.referenceEur) + 4} y={y + 4} fontSize="10" fill={muted}>{row.firstLabel}</text>
        </g>;
      })}
    </svg></div>}
    {rows.length > 0 && <details className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-primary">Valori esatti per molecola ({formatNumber(rows.length, 0)})</summary>
      {/* Below the table's min-width (40rem, plus 2 px of border) the six
          columns become one item per molecola, same values, same order. */}
      <ul aria-label={`Primo biosimilare dispensato qui, spesa di riferimento e spesa valida per molecola; osservazione fino a ${monthKeyLabel(toKey)}`} className="mt-2 divide-y divide-border rounded-lg border border-border text-xs [@container(min-width:40.125rem)]:hidden" translate="no">
        {rows.map((row) => <li key={row.substance} className="px-3 py-2">
          <p className="font-medium text-foreground">{row.substance}</p>
          <dl className={PAIRS}>
            <Pair label="Primo biosimilare qui" value={row.firstLabel ?? "—"} />
            <Pair label="Riferimento nei mesi validi" value={formatEur(row.referenceEur)} />
            <Pair label="Spesa valida (bio + rif)" value={formatEur(row.validEur)} />
            <Pair label="Quota 1" value={row.share === null ? "—" : formatPercent(row.share)} />
            <Pair label="Fine osservazione" value={monthKeyLabel(toKey)} dim />
          </dl>
        </li>)}
      </ul>
      <div className="mt-2 hidden overflow-x-auto rounded-lg border border-border [@container(min-width:40.125rem)]:block">
        <table className="w-full min-w-[40rem] text-sm" translate="no">
          <caption className="sr-only">Primo biosimilare dispensato qui, spesa di riferimento e spesa valida per molecola; osservazione fino a {monthKeyLabel(toKey)}</caption>
          <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-semibold">Molecola</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Primo biosimilare qui</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Riferimento nei mesi validi</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Spesa valida (bio + rif)</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Quota 1</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Fine osservazione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => <tr key={row.substance}>
              <td className="px-4 py-2 text-xs text-foreground">{row.substance}</td>
              <td className="px-4 py-2 text-right font-mono text-xs">{row.firstLabel}</td>
              <td className="px-4 py-2 text-right font-mono text-xs">{formatEur(row.referenceEur)}</td>
              <td className="px-4 py-2 text-right font-mono text-xs">{formatEur(row.validEur)}</td>
              <td className="px-4 py-2 text-right font-mono text-xs">{row.share === null ? "—" : formatPercent(row.share)}</td>
              <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">{monthKeyLabel(toKey)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </details>}
    {neverObserved.length > 0 && <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
      <p className="font-semibold text-foreground">Mai dispensato qui, pur avendo un biosimilare autorizzato nel periodo selezionato:</p>
      <p className="mt-1 text-muted-foreground">
        {neverObserved.map((n) => `${n.substance} (${formatEur(n.referenceEur)} di riferimento)`).join(" · ")}
      </p>
    </div>}
    {model.notYetValid.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">
      Senza spesa nei mesi a validità riconosciuta del periodo selezionato; questo dato
      da solo non dimostra se un&apos;alternativa fosse disponibile:{" "}
      {model.notYetValid.map((n) => n.substance).join(", ")}.
    </p>}
    </>}
  </Frame>;
}

// -------------------------------------------------------------- by Azienda

export function AziendaBars({ rows, years, metric = "spesa" }: {
  rows: AziendaPanelRow[]; years: ReadonlyArray<number>;
  /** "spesa" draws one bar per year; the others draw one bar per Azienda. */
  metric?: AziendaMetric;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => years.map((y) => r.byYear[y] ?? 0)));
  const colors = [slate, teal];
  if (metric !== "spesa") {
    const scale = metric === "comparabile" ? 1 : Math.max(1, ...rows.map((r) => r.rows_n));
    const fmt = (v: number) => (metric === "comparabile" ? formatPercent(v) : formatNumber(v, 0));
    // Label, bar and value side by side from 30rem of card (the bar then
    // keeps at least 200 px); stacked below. The card's width, not the
    // viewport's: at 768 px the sidebar leaves a 340-380 px card.
    return <Frame
      container
      title={metric === "comparabile" ? "Quota con quantità confrontabile per Azienda" : "Record per Azienda"}
      lead={metric === "comparabile"
        ? `Unità: percentuale della spesa. Numeratore: spesa dell'Azienda con una quantità confrontabile; denominatore: spesa rendicontata dell'Azienda, ${years.length === 2 ? "2024 e 2025 insieme" : String(years[0])}, nei canali e nella molecola selezionati. È la copertura su cui ogni misura in volume riposa, non una misura di adozione né di qualità.`
        : `Unità: righe rendicontate (record) per Azienda, ${years.length === 2 ? "2024 e 2025 insieme" : String(years[0])}, nei canali e nella molecola selezionati. Un record è una riga del flusso, non un paziente né una confezione; la barra è la lunghezza relativa alla massima.`}
    >
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna Azienda nel perimetro.</p> :
      <div role="img" aria-label={metric === "comparabile" ? "Quota confrontabile per Azienda" : "Record per Azienda"} className="space-y-2">
        {rows.map((r) => {
          const v = aziendaMetricValue(r, metric);
          return <div key={r.label} className="grid gap-1 [@container(min-width:30rem)]:grid-cols-[9rem_1fr_7rem] [@container(min-width:30rem)]:items-center [@container(min-width:30rem)]:gap-3">
            <div className="text-xs font-medium text-foreground">{r.label}</div>
            <div className="h-4 overflow-hidden rounded bg-muted/60">
              <div className="h-full rounded" style={{ width: `${v === null ? 0 : Math.max(0, Math.min(1, v / scale)) * 100}%`, background: teal }} />
            </div>
          <span className="text-right font-mono text-[11px] text-foreground">{v === null ? "—" : fmt(v)}</span>
          </div>;
        })}
      </div>}
    </Frame>;
  }
  // NO ADOPTION SHARE HERE. A biosimilar/(biosimilar+reference) ratio by
  // perimeter status alone — without the monthly validity rule — would be a
  // third denominator, matching neither published measure. Adoption per
  // Azienda is read by selecting the Azienda in the filter bar, where both
  // denominators appear together.
  //
  // Name, bars and totals side by side from 40rem of card (each bar track
  // then keeps about 200 px beside its value); stacked below, where the
  // totals sit under the bars and the lead says so.
  return <Frame
    container
    title="Spesa rendicontata per Azienda e anno"
    lead={<>{`Unità: euro, IVA inclusa. Una barra per anno selezionato (${years.join(" e ")}): somma delle righe rendicontate dell'Azienda in quell'anno, nei canali e nella molecola selezionati; `}<span className="hidden [@container(min-width:40rem)]:inline">a destra</span><span className="[@container(min-width:40rem)]:hidden">sotto le barre</span>{" il totale degli anni e la quota con quantità confrontabile. Non è una misura biosimilare: descrive cosa è stato comprato, non quanto bene (il case-mix non è controllabile su questo rilascio). Per l'adozione biosimilare di un'Azienda: selezionarla nei filtri e leggere le due quote in Adozione."}</>}
  >
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna Azienda nel perimetro.</p> : <>
    <div className="mb-2 flex gap-4 text-[11px] text-muted-foreground">
      {years.map((y, i) => <span key={y}><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colors[i % colors.length] }} />{y}</span>)}
    </div>
    <div role="img" aria-label="Spesa per Azienda e anno" className="space-y-3">
      {rows.map((r) => <div key={r.label} className="grid gap-1.5 [@container(min-width:40rem)]:grid-cols-[9rem_1fr_11rem] [@container(min-width:40rem)]:items-center [@container(min-width:40rem)]:gap-3">
        <div className="text-xs font-medium text-foreground">{r.label}</div>
        <div className="space-y-1">
          {years.map((y, i) => r.byYear[y] === undefined
            // An absent (Azienda, year) group is "no record", never a zero: the
            // track stays, the bar does not, and the label says why. Stacked,
            // the label keeps one line (its empty track gives way); beside
            // the name it keeps the 5rem column the values use.
            ? <div key={y} className="flex items-center gap-2">
                <div className="h-3.5 flex-1 rounded border border-dashed border-border" />
                <span className="whitespace-nowrap text-right text-[10px] text-muted-foreground [@container(min-width:40rem)]:w-20 [@container(min-width:40rem)]:whitespace-normal">{y}: nessun record</span>
              </div>
            : <div key={y} className="flex items-center gap-2">
                <div className="h-3.5 flex-1 overflow-hidden rounded bg-muted/60">
                  <div className="h-full rounded" style={{ width: `${Math.max(0, r.byYear[y]) / max * 100}%`, background: colors[i % colors.length] }} />
                </div>
                <span className="w-20 text-right font-mono text-[11px] text-foreground">{compact(r.byYear[y])}</span>
              </div>)}
        </div>
        <div className="text-[11px] text-muted-foreground">
          totale <span className="font-mono text-foreground">{formatEur(r.spend_eur)}</span>
          {r.comparable_share !== null && <><br />con quantità confrontabile: <span className="font-mono">{formatPercent(r.comparable_share)}</span></>}
        </div>
      </div>)}
    </div>
    </>}
  </Frame>;
}

// -------------------------------------------------------------- by channel

const CHANNEL_COLORS: Record<string, string> = { CO: teal, DD: slate, DPC: coral };
const CHANNEL_NAMES: Record<string, string> = {
  CO: "Consumi ospedalieri", DD: "Distribuzione diretta", DPC: "Distribuzione per conto",
};

/**
 * What a channel segment prints inside itself, by its width w (0-100): the
 * channel and its share, the share alone, or nothing. Two pairs of
 * thresholds, one per layout. From 40rem of card the bar sits beside a 13rem
 * name and is at least 420 px wide: 16 / 8, as before. Below, the bar spans
 * the card, as narrow as 275 px: 24 / 14 ("DPC 16,5%" is about 52 px at 10 px,
 * "16,5%" about 31 px), so no label is cut by its segment. The exact value of
 * every segment stays in its title and in the bar's aria-label.
 */
function segmentText(channel: string, w: number, full: number, shareOnly: number): string {
  return w > full ? `${channel} ${formatPercent(w / 100)}` : w > shareOnly ? formatPercent(w / 100) : "";
}

function MixBar({ label, mix, sub }: { label: string; mix: ReturnType<typeof channelYearMix>[number]; sub?: boolean }) {
  // Without a comparator the row label IS the year: name it once.
  const who = label === String(mix.year) ? label : `${label}, ${mix.year}`;
  // Name beside the bar from 40rem of card (ChannelStack's Frame is the
  // container); above it below that, so the bar keeps the card's width.
  return <div className="grid gap-1.5 [@container(min-width:40rem)]:grid-cols-[13rem_1fr] [@container(min-width:40rem)]:items-center [@container(min-width:40rem)]:gap-3">
    <div className={"text-xs " + (sub ? "text-muted-foreground" : "font-medium text-foreground")}>{label}</div>
    {!mix.drawable
      ? <div className="text-[11px] text-muted-foreground">non calcolabile: spesa dell&apos;anno assente, nulla o negativa</div>
      : <div role="img" aria-label={`Composizione per canale, ${who}: ${mix.parts.map((p) => `${p.channel} ${p.share === null ? "nessun record" : formatPercent(p.share)}`).join(", ")}`} className={"flex overflow-hidden rounded-lg bg-muted/40 " + (sub ? "h-5" : "h-7")}>
          {mix.parts.map((p) => {
            const w = p.share === null ? 0 : Math.max(0, p.share) * 100;
            return <div key={p.channel} title={`${who} · ${p.channel}: ${p.eur === null ? "nessun record" : `${formatEur(p.eur)} · ${formatPercent(p.share ?? 0)}`}`} className="flex items-center justify-center overflow-hidden whitespace-nowrap text-[10px] font-semibold text-[#0b1f28]" style={{ width: `${w}%`, background: CHANNEL_COLORS[p.channel] ?? muted }}>
              <span className="[@container(min-width:26.25rem)]:hidden">{segmentText(p.channel, w, 24, 14)}</span>
              <span className="hidden [@container(min-width:26.25rem)]:inline">{segmentText(p.channel, w, 16, 8)}</span>
            </div>;
          })}
        </div>}
  </div>;
}

export function ChannelStack({ rows, years, selectedLabel = null, comparator = null, comparatorNote = null }: {
  rows: ChannelMixRow[];
  years: ReadonlyArray<number>;
  /** The selected Azienda's name as this viewer may see it; null when none is selected. */
  selectedLabel?: string | null;
  /** The Region under the same years, channels and molecule (reviewer / Regione only). */
  comparator?: { label: string; aziende: number; rows: ChannelMixRow[] } | null;
  /** Why no comparator is drawn, when that needs saying (an Azienda account). */
  comparatorNote?: string | null;
}) {
  const total = rows.reduce((s, r) => s + r.spend_eur, 0);
  // ONE BAR PER YEAR, no pooled "Totale". With an Azienda selected and an
  // authorised regional scope, the Region's bar for the same year follows the
  // Azienda's, each on its own 100% (PB-V5-01).
  const channels = ["CO", "DD", "DPC"].filter((c) => rows.some((r) => r.channel === c) || comparator?.rows.some((r) => r.channel === c));
  const own = channelYearMix(rows, years, channels);
  const region = comparator ? channelYearMix(comparator.rows, years, channels) : null;
  // The exact-value table's headings, shared with its stacked form.
  const ownHead = selectedLabel ?? (region ? "Azienda" : "Spesa");
  const ownShareHead = region ? "Quota Azienda" : "Quota";
  const caption = region ? "Spesa e quota per canale, Azienda selezionata e Regione, per anno" : "Spesa e quota per canale, per anno";
  return <Frame
    container
    title={comparator ? "Composizione per canale · Azienda e Regione" : "Composizione per canale"}
    lead={`Quota di ciascun canale sulla spesa rendicontata, per anno: ogni barra somma a 100% sul proprio totale, con i filtri di canale e molecola attivi.${comparator ? ` Sotto la barra ${selectedLabel ? `di ${selectedLabel}` : "dell'Azienda selezionata"}, quella della Regione (${formatNumber(comparator.aziende, 0)} Aziende, ${selectedLabel ?? "quella selezionata"} compresa), con gli stessi anni, canali e molecola.` : ""}${comparatorNote ? ` ${comparatorNote}` : ""}`}
  >
    {rows.length === 0 || total === 0 ? <p className="text-sm text-muted-foreground">Nessun canale osservato.</p> : <>
    <div className="mb-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
      {channels.map((c) => <span key={c}><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHANNEL_COLORS[c] ?? muted }} />{c} · {CHANNEL_NAMES[c] ?? ""}</span>)}
    </div>
    <div className="space-y-3">
      {own.map((mix, k) => <div key={mix.year} className="space-y-1">
        {region && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{mix.year}</p>}
        <MixBar label={region ? (selectedLabel ?? "Azienda selezionata") : String(mix.year)} mix={mix} />
        {region && <MixBar label={comparator!.label} mix={region[k]} sub />}
      </div>)}
    </div>
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-semibold text-primary">Valori esatti per anno e canale</summary>
      {/* Below the table's min-width (34rem with the Region's columns, 20rem
          without; plus 2 px of border, 0.125rem) one item per year and
          channel, same values, same order. */}
      <ul aria-label={caption} className={"mt-2 divide-y divide-border rounded-lg border border-border text-xs " + (region ? "[@container(min-width:34.125rem)]:hidden" : "[@container(min-width:20.125rem)]:hidden")} translate="no">
        {own.flatMap((mix, k) => mix.parts.map((p, c) => {
          const q = region ? region[k].parts[c] : null;
          return <li key={`${mix.year}-${p.channel}`} className="px-3 py-2">
            <p className="font-medium text-foreground">{mix.year} · {p.channel}</p>
            <dl className={PAIRS}>
              <Pair label={ownHead} value={p.eur === null ? "nessun record" : formatEur(p.eur)} />
              <Pair label={ownShareHead} value={p.share === null ? "—" : formatPercent(p.share)} />
              {q && <Pair label="Regione" value={q.eur === null ? "nessun record" : formatEur(q.eur)} />}
              {q && <Pair label="Quota Regione" value={q.share === null ? "—" : formatPercent(q.share)} />}
            </dl>
          </li>;
        }))}
      </ul>
      <div className={"mt-2 hidden overflow-x-auto rounded-lg border border-border " + (region ? "[@container(min-width:34.125rem)]:block" : "[@container(min-width:20.125rem)]:block")}>
        <table className={"w-full text-sm " + (region ? "min-w-[34rem]" : "min-w-[20rem]")} translate="no">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Anno · canale</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">{ownHead}</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">{ownShareHead}</th>
              {region && <th scope="col" className="px-3 py-2 text-right font-semibold">Regione</th>}
              {region && <th scope="col" className="px-3 py-2 text-right font-semibold">Quota Regione</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {own.flatMap((mix, k) => mix.parts.map((p, c) => {
              const q = region ? region[k].parts[c] : null;
              return <tr key={`${mix.year}-${p.channel}`}>
                <th scope="row" className="px-3 py-2 text-left text-xs font-normal">{mix.year} · {p.channel}</th>
                <td className="px-3 py-2 text-right font-mono text-xs">{p.eur === null ? "nessun record" : formatEur(p.eur)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{p.share === null ? "—" : formatPercent(p.share)}</td>
                {q && <td className="px-3 py-2 text-right font-mono text-xs">{q.eur === null ? "nessun record" : formatEur(q.eur)}</td>}
                {q && <td className="px-3 py-2 text-right font-mono text-xs">{q.share === null ? "—" : formatPercent(q.share)}</td>}
              </tr>;
            }))}
          </tbody>
        </table>
      </div>
    </details>
    </>}
  </Frame>;
}

// ------------------------------------------------------------- perimeter

export function PerimeterComposition({ rows }: { rows: FacetPerimeter[] }) {
  const c = perimeterComposition(rows);
  const reportedOf = (v: number | null) => (v === null ? "—" : formatPercent(v));
  // Every switch below is on the card's own width (the Frame is the
  // container), never the viewport's: at 768-900 px the sidebar leaves a card
  // narrower than the table.
  return <Frame
    container
    title="Composizione della spesa nel perimetro biosimilare"
    lead={`100% = spesa per biosimilari e medicinali di riferimento nella selezione (${formatEur(c.base)}), sotto i filtri di anno, Azienda e canale. È una composizione per stato del prodotto, non una quota di adozione: le due quote di adozione, con la loro regola sui mesi, sono nella sezione Adozione. La spesa fuori dal perimetro è riportata a parte, come contesto, e non entra nel 100%.`}
  >
    {c.parts.every((p) => !p.observed) ? <p className="text-sm text-muted-foreground">Nessun biosimilare né medicinale di riferimento nella selezione.</p> : <>
    {c.drawable
      ? <div role="img" aria-label={`Perimetro biosimilare ${formatEur(c.base)}: ${c.parts.map((p) => p.observed ? `${p.label} ${formatEur(p.eur)}, ${p.share === null ? "n/d" : formatPercent(p.share)}` : `${p.label} nessun record`).join("; ")}`} className="flex h-8 overflow-hidden rounded-lg bg-muted/40">
          {c.parts.map((p) => {
            const w = (p.share ?? 0) * 100;
            // The names live in the table's swatches and in the title: inside the
            // segment only the percentage, on one line, so a narrow screen never
            // wraps "Medicinale di riferimento" into a clipped stack. The bar
            // spans the card: from 34.125rem (546 px, the table's switch) a
            // segment over 8% holds "12,5%" (about 31 px at 11 px); below,
            // down to a 275 px card, only one over 14% does.
            return <div key={p.status} title={p.observed ? `${p.label}: ${formatEur(p.eur)} · ${p.share === null ? "n/d" : formatPercent(p.share)} del perimetro` : `${p.label}: nessun record`} className="flex items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-semibold text-[#0b1f28]" style={{ width: `${w}%`, background: p.status === "biosimilar" ? teal : coral }}>
              <span className="[@container(min-width:34.125rem)]:hidden">{w > 14 ? formatPercent(w / 100) : ""}</span>
              <span className="hidden [@container(min-width:34.125rem)]:inline">{w > 8 ? formatPercent(w / 100) : ""}</span>
            </div>;
          })}
        </div>
      : <p className="text-xs text-muted-foreground">Barra non disegnata: la spesa del perimetro è nulla o una componente è negativa per rettifiche; gli importi esatti sono qui sotto.</p>}
    {/* ON A NARROW CARD the four columns do not fit: the same values as a
        stacked list below 34.125rem of card (the table's min-width plus its
        2 px of border), the table from there up. */}
    <ul aria-label="Composizione del perimetro biosimilare e spesa fuori dal perimetro" className="mt-3 divide-y divide-border rounded-lg border border-border text-xs [@container(min-width:34.125rem)]:hidden" translate="no">
      {c.parts.map((p) => <li key={p.status} className="px-3 py-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-foreground"><i className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.status === "biosimilar" ? teal : coral }} />{p.label}</span>
          <span className="whitespace-nowrap font-mono">{p.observed ? formatEur(p.eur) : "nessun record"}</span>
        </div>
        <div className="mt-0.5 text-right font-mono text-muted-foreground">
          <span className="whitespace-nowrap">{p.share === null ? "—" : formatPercent(p.share)} del perimetro</span>{" · "}<span className="whitespace-nowrap">{p.observed ? `${formatNumber(p.aic_count, 0)} AIC` : "—"}</span>
        </div>
      </li>)}
      <li className="flex items-baseline justify-between gap-3 bg-muted/30 px-3 py-2 font-semibold">
        <span>Perimetro biosimilare</span><span className="whitespace-nowrap text-right font-mono">{formatEur(c.base)} · {c.base > 0 ? formatPercent(1) : "—"}</span>
      </li>
    </ul>
    <div className="mt-3 hidden overflow-x-auto rounded-lg border border-border [@container(min-width:34.125rem)]:block">
      <table className="w-full min-w-[34rem] text-sm" translate="no">
        <caption className="sr-only">Composizione del perimetro biosimilare e spesa fuori dal perimetro</caption>
        <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Stato del prodotto</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Spesa</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">% del perimetro</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">AIC</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {c.parts.map((p) => <tr key={p.status}>
            <th scope="row" className="px-3 py-2 text-left text-xs font-medium"><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: p.status === "biosimilar" ? teal : coral }} />{p.label}</th>
            <td className="px-3 py-2 text-right font-mono text-xs">{p.observed ? formatEur(p.eur) : "nessun record"}</td>
            <td className="px-3 py-2 text-right font-mono text-xs">{p.share === null ? "—" : formatPercent(p.share)}</td>
            <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{p.observed ? formatNumber(p.aic_count, 0) : "—"}</td>
          </tr>)}
        </tbody>
        <tfoot className="bg-muted/30">
          <tr>
            <td className="px-3 py-2 text-xs font-semibold">Perimetro biosimilare</td>
            <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{formatEur(c.base)}</td>
            <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{c.base > 0 ? formatPercent(1) : "—"}</td>
            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
    </>}
    {c.context.length > 0 && <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Contesto, fuori dal 100% · quota della spesa rendicontata ({formatEur(c.reported)})</p>
      <ul className="mt-1.5 divide-y divide-border rounded-lg border border-border text-xs">
        {/* Four columns from 38rem of card, where the name keeps 200 px
            beside 9rem + 6rem + 6rem; one value per line below. */}
        {c.context.map((r) => <li key={r.status} className="grid gap-x-4 px-3 py-2 [@container(min-width:38rem)]:grid-cols-[1fr_9rem_6rem_6rem]">
          <span className="text-foreground">{r.label}</span>
          <span className="font-mono [@container(min-width:38rem)]:text-right">{formatEur(r.eur)}</span>
          <span className="font-mono text-muted-foreground [@container(min-width:38rem)]:text-right">{reportedOf(r.shareOfReported)}</span>
          <span className="font-mono text-muted-foreground [@container(min-width:38rem)]:text-right">{r.status === "unclassified" ? "nessun AIC" : `${formatNumber(r.aic_count, 0)} AIC`}</span>
        </li>)}
      </ul>
    </div>}
  </Frame>;
}
