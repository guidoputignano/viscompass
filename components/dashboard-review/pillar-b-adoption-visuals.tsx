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
const muted = "hsl(var(--muted-foreground))";
const grid = "hsl(var(--border))";
const teal = "hsl(var(--primary))";
const slate = "hsl(204 15% 55%)";
const coral = "#e87955";

const compact = (v: number): string =>
  Math.abs(v) >= 1_000_000 ? `${formatNumber(v / 1_000_000, 1)} M€`
  : Math.abs(v) >= 1_000 ? `${formatNumber(v / 1_000, 0)} k€`
  : formatEur(v);

export function Frame({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return <figure className="overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5">
    <figcaption className="mb-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {lead && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{lead}</p>}
    </figcaption>
    {children}
  </figure>;
}

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
 * THE PHONE LAYOUT (below the sm breakpoint). The desktop chart keeps a
 * 760-unit drawing with a 190-unit name column; inside a phone's card it was
 * two-thirds hidden behind a sideways scroll, high shares included.
 *
 * Every row has the same three lines: the name; the full-width 0–100% track;
 * then the reference amount (left) and the gap or the reason (right). A thin
 * rule separates rows, so no label can be read as its neighbour's. The
 * viewBox is close to a phone card's width (about 275 px at 375) and the width
 * is capped, so 12-unit text renders at about 11-13 px, never at 7.
 */
function DumbbellPhone({ rows, periodScope }: { rows: DumbbellRow[]; periodScope: string }) {
  const W = 280, l = 6, r = W - 6;
  const mx = (s: number) => l + Math.max(0, Math.min(1, s)) * (r - l);
  const rowH = 62, top = 2;
  // A longer name is shortened; its title keeps it whole.
  const nameMax = 38;
  const height = top + Math.max(rows.length, 1) * rowH + 18;
  return <svg role="img" aria-label={`Quota biosimilare per molecola su due denominatori, ${periodScope}`} viewBox={`0 0 ${W} ${height}`} className="w-full max-w-[24rem] sm:hidden" xmlns="http://www.w3.org/2000/svg">
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
  return <Frame
    title="Quota biosimilare per molecola, sui due denominatori"
    lead={dumbbellLead(shown)}
  >
    {shown.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna molecola nel perimetro con questi filtri.</p> : <>
    {/* THE KEY, drawn with the same marks as the chart (PB-V5-02). */}
    <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke={slate} strokeWidth="2.5" /></svg>quota 1 · mesi a validità riconosciuta</span>
      <span className="inline-flex items-center gap-1.5"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4.5" fill={teal} /></svg>quota 2 · mesi dal primo uso qui</span>
      <span className="inline-flex items-center gap-1.5"><svg aria-hidden="true" width="22" height="16" viewBox="0 0 22 16"><line x1="2" y1="8" x2="20" y2="8" stroke={teal} strokeWidth="3" strokeOpacity="0.45" strokeLinecap="round" /></svg>differenza fra le due quote, in punti percentuali</span>
      <span><span className="hidden sm:inline">a destra: spesa di riferimento nei mesi validi</span><span className="sm:hidden">«rif.» sotto ogni riga: spesa di riferimento nei mesi validi</span></span>
    </div>
    <DumbbellPhone rows={shown} periodScope={periodScope} />
    <div className="hidden overflow-x-auto sm:block"><svg role="img" aria-label={`Quota biosimilare per molecola su due denominatori, ${periodScope}`} viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[47.5rem]" xmlns="http://www.w3.org/2000/svg">
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
  return <Frame
    title="Quando il primo biosimilare è comparso qui"
    lead={timelineLead(model, followsAzienda)}
  >
    {rows.length === 0 && neverObserved.length === 0 && model.notYetValid.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna molecola nel perimetro con questi filtri.</p> : <>
    {/* THE KEY, VISIBLE: what a dot, its size and the faint line mean. The
        reviewers asked why some rows "have a bar". Only when dots are drawn. */}
    {rows.length === 0 && <p className="mb-2 text-xs text-muted-foreground">Nessuna molecola con un primo uso di biosimilare osservato qui nel rilascio: non c&apos;è una linea del tempo da disegnare.</p>}
    {rows.length > 0 && <ul className="mb-2 grid gap-x-6 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-3">
      <li><i className="mr-1.5 inline-block h-3 w-3 rounded-full align-middle" style={{ background: teal }} />Punto: mese del primo biosimilare dispensato qui (etichetta accanto).</li>
      <li><i className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: teal }} /><i className="mr-1.5 inline-block h-3.5 w-3.5 rounded-full align-middle" style={{ background: teal }} />Area del punto: spesa di riferimento nei mesi validi{largest ? ` (la più grande: ${largest.substance}, ${formatEur(largest.referenceEur)})` : ""}.</li>
      <li><i className="mr-1.5 inline-block h-0.5 w-6 align-middle" style={{ background: teal, opacity: 0.35 }} />Linea sottile: l&apos;osservazione prosegue fino a {monthKeyLabel(toKey)}; non indica una dispensazione continua.</li>
    </ul>}
    {rows.length > 0 && <div className="overflow-x-auto"><svg role="img" aria-label="Mese della prima dispensazione locale di un biosimilare, per molecola" viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[47.5rem]" xmlns="http://www.w3.org/2000/svg">
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
      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
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
    return <Frame
      title={metric === "comparabile" ? "Quota con quantità confrontabile per Azienda" : "Record per Azienda"}
      lead={metric === "comparabile"
        ? `Unità: percentuale della spesa. Numeratore: spesa dell'Azienda con una quantità confrontabile; denominatore: spesa rendicontata dell'Azienda, ${years.length === 2 ? "2024 e 2025 insieme" : String(years[0])}, nei canali e nella molecola selezionati. È la copertura su cui ogni misura in volume riposa, non una misura di adozione né di qualità.`
        : `Unità: righe rendicontate (record) per Azienda, ${years.length === 2 ? "2024 e 2025 insieme" : String(years[0])}, nei canali e nella molecola selezionati. Un record è una riga del flusso, non un paziente né una confezione; la barra è la lunghezza relativa alla massima.`}
    >
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna Azienda nel perimetro.</p> :
      <div role="img" aria-label={metric === "comparabile" ? "Quota confrontabile per Azienda" : "Record per Azienda"} className="space-y-2">
        {rows.map((r) => {
          const v = aziendaMetricValue(r, metric);
          return <div key={r.label} className="grid gap-1 sm:grid-cols-[9rem_1fr_7rem] sm:items-center sm:gap-3">
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
  return <Frame
    title="Spesa rendicontata per Azienda e anno"
    lead={`Unità: euro, IVA inclusa. Una barra per anno selezionato (${years.join(" e ")}): somma delle righe rendicontate dell'Azienda in quell'anno, nei canali e nella molecola selezionati; a destra il totale degli anni e la quota con quantità confrontabile. Non è una misura biosimilare: descrive cosa è stato comprato, non quanto bene (il case-mix non è controllabile su questo rilascio). Per l'adozione biosimilare di un'Azienda: selezionarla nei filtri e leggere le due quote in Adozione.`}
  >
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna Azienda nel perimetro.</p> : <>
    <div className="mb-2 flex gap-4 text-[11px] text-muted-foreground">
      {years.map((y, i) => <span key={y}><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colors[i % colors.length] }} />{y}</span>)}
    </div>
    <div role="img" aria-label="Spesa per Azienda e anno" className="space-y-3">
      {rows.map((r) => <div key={r.label} className="grid gap-1.5 sm:grid-cols-[9rem_1fr_11rem] sm:items-center sm:gap-3">
        <div className="text-xs font-medium text-foreground">{r.label}</div>
        <div className="space-y-1">
          {years.map((y, i) => r.byYear[y] === undefined
            // An absent (Azienda, year) group is "no record", never a zero: the
            // track stays, the bar does not, and the label says why.
            ? <div key={y} className="flex items-center gap-2">
                <div className="h-3.5 flex-1 rounded border border-dashed border-border" />
                <span className="w-20 text-right text-[10px] text-muted-foreground">{y}: nessun record</span>
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

function MixBar({ label, mix, sub }: { label: string; mix: ReturnType<typeof channelYearMix>[number]; sub?: boolean }) {
  // Without a comparator the row label IS the year: name it once.
  const who = label === String(mix.year) ? label : `${label}, ${mix.year}`;
  return <div className="grid gap-1.5 sm:grid-cols-[13rem_1fr] sm:items-center sm:gap-3">
    <div className={"text-xs " + (sub ? "text-muted-foreground" : "font-medium text-foreground")}>{label}</div>
    {!mix.drawable
      ? <div className="text-[11px] text-muted-foreground">non calcolabile: spesa dell&apos;anno assente, nulla o negativa</div>
      : <div role="img" aria-label={`Composizione per canale, ${who}: ${mix.parts.map((p) => `${p.channel} ${p.share === null ? "nessun record" : formatPercent(p.share)}`).join(", ")}`} className={"flex overflow-hidden rounded-lg bg-muted/40 " + (sub ? "h-5" : "h-7")}>
          {mix.parts.map((p) => {
            const w = p.share === null ? 0 : Math.max(0, p.share) * 100;
            return <div key={p.channel} title={`${who} · ${p.channel}: ${p.eur === null ? "nessun record" : `${formatEur(p.eur)} · ${formatPercent(p.share ?? 0)}`}`} className="flex items-center justify-center overflow-hidden whitespace-nowrap text-[10px] font-semibold text-white" style={{ width: `${w}%`, background: CHANNEL_COLORS[p.channel] ?? muted }}>
              {w > 16 ? `${p.channel} ${formatPercent(w / 100)}` : w > 8 ? formatPercent(w / 100) : ""}
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
  return <Frame
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
      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className={"w-full text-sm " + (region ? "min-w-[34rem]" : "min-w-[20rem]")} translate="no">
          <caption className="sr-only">{region ? "Spesa e quota per canale, Azienda selezionata e Regione, per anno" : "Spesa e quota per canale, per anno"}</caption>
          <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Anno · canale</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">{selectedLabel ?? (region ? "Azienda" : "Spesa")}</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">{region ? "Quota Azienda" : "Quota"}</th>
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
  return <Frame
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
            // wraps "Medicinale di riferimento" into a clipped stack.
            return <div key={p.status} title={p.observed ? `${p.label}: ${formatEur(p.eur)} · ${p.share === null ? "n/d" : formatPercent(p.share)} del perimetro` : `${p.label}: nessun record`} className="flex items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-semibold text-white" style={{ width: `${w}%`, background: p.status === "biosimilar" ? teal : coral }}>
              {w > 8 ? formatPercent(w / 100) : ""}
            </div>;
          })}
        </div>
      : <p className="text-xs text-muted-foreground">Barra non disegnata: la spesa del perimetro è nulla o una componente è negativa per rettifiche; gli importi esatti sono qui sotto.</p>}
    {/* ON A PHONE the four columns do not fit a card a few hundred pixels
        wide: the same values as a stacked list, the table from sm up. */}
    <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-xs sm:hidden" translate="no">
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
    <div className="mt-3 hidden overflow-x-auto rounded-lg border border-border sm:block">
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
        {c.context.map((r) => <li key={r.status} className="grid gap-x-4 px-3 py-2 sm:grid-cols-[1fr_9rem_6rem_6rem]">
          <span className="text-foreground">{r.label}</span>
          <span className="font-mono sm:text-right">{formatEur(r.eur)}</span>
          <span className="font-mono text-muted-foreground sm:text-right">{reportedOf(r.shareOfReported)}</span>
          <span className="font-mono text-muted-foreground sm:text-right">{r.status === "unclassified" ? "nessun AIC" : `${formatNumber(r.aic_count, 0)} AIC`}</span>
        </li>)}
      </ul>
    </div>}
  </Frame>;
}
