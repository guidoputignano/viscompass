// Server-rendered SVG for the Pillar B adoption and panorama views.
//
// Same contract as pillar-b-review-visuals.tsx: every mark encodes a figure
// that also appears in a table on the page, nothing is computed here that the
// pure modules did not already compute, and null is drawn as "not observed",
// never as zero. The charts are plain SVG with no state of their own, so they
// render identically for the harness, the reader and a screen reader; the
// panel-local controls live in pillar-b-panels.tsx.

import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { DumbbellRow, TimelineModel } from "@/lib/dashboard-review/pillar-b/adoption";
import { monthKeyLabel } from "@/lib/dashboard-review/pillar-b/adoption";
import type { AziendaPanelRow, ChannelMixRow, PerimeterRow } from "@/lib/dashboard-review/pillar-b/facets";
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
  return <figure className="overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5">
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
export function DumbbellUptakeChart({ rows, limit = 16 }: { rows: DumbbellRow[]; limit?: number }) {
  const shown = rows.slice(0, limit);
  const width = 760, left = 190, right = 610, top = 30, rowGap = 26;
  const height = top + Math.max(shown.length, 1) * rowGap + 30;
  const x = (s: number) => left + Math.max(0, Math.min(1, s)) * (right - left);
  return <Frame
    title="Quota biosimilare per molecola, sui due denominatori"
    lead="Grigio: su mesi a validità riconosciuta. Verde: su mesi con biosimilare già osservato qui. Ordinate per spesa di riferimento ancora sull'originatore."
  >
    {shown.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna molecola nel perimetro con questi filtri.</p> : <>
    <div className="mb-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: slate }} />validità riconosciuta</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: teal }} />osservato qui</span>
      <span>a destra: spesa di riferimento nei mesi validi</span>
    </div>
    <svg role="img" aria-label="Quota biosimilare per molecola su due denominatori" viewBox={`0 0 ${width} ${height}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
      {[0, .25, .5, .75, 1].map((t) => <g key={t}>
        <line x1={x(t)} y1={top - 10} x2={x(t)} y2={height - 24} stroke={grid} strokeDasharray="3 4" />
        <text x={x(t)} y={height - 8} textAnchor="middle" fontSize="11" fill={muted}>{formatPercent(t)}</text>
      </g>)}
      {shown.map((r, i) => {
        const y = top + i * rowGap + 8;
        const a = r.dateValid, b = r.locallyObserved;
        return <g key={r.substance}>
          <text x={left - 10} y={y + 4} textAnchor="end" fontSize="12" fill={ink}>{r.substance}</text>
          {a !== null && b !== null && <line x1={x(a)} y1={y} x2={x(b)} y2={y} stroke={teal} strokeWidth="4" strokeOpacity="0.45" strokeLinecap="round" />}
          {a !== null && <circle cx={x(a)} cy={y} r="5.5" fill={slate} />}
          {/* THREE different absences, three different words. A missing teal
              dot means no biosimilar month fell inside BOTH the selected
              period and the local window — which happens when the first local
              use lies outside the selected years (aflibercept: 2026-03), not
              only when it never happened. And a row with no date-valid month
              at all (pertuzumab in 2024–2025) had no alternative to use. */}
          {b !== null
            ? <circle cx={x(b)} cy={y} r="6" fill={teal} stroke="white" strokeWidth="1.5" />
            : r.denominatorEur === 0
              ? <text x={right + 8} y={y + 4} fontSize="10" fill={muted}>nessun mese valido nel periodo</text>
              : r.firstLocalLabel !== null
                ? <text x={right + 8} y={y + 4} fontSize="10" fill={muted}>primo uso {r.firstLocalLabel}, fuori periodo</text>
                : <text x={right + 8} y={y + 4} fontSize="10" fill={coral}>mai dispensato qui</text>}
          <text x={width - 4} y={y + 4} textAnchor="end" fontSize="11" fill={muted}>{compact(r.referenceEur)}</text>
        </g>;
      })}
    </svg>
    {rows.length > shown.length && <p className="mt-1 text-[11px] text-muted-foreground">Mostrate {shown.length} di {rows.length} molecole; le altre sono nella tabella sotto e in tutti i totali.</p>}
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
  return <Frame
    title="Quando il primo biosimilare è comparso qui"
    lead={"Un punto per molecola, nel mese della prima dispensazione osservata nell'ambito visibile. L'area del punto cresce con la spesa di riferimento. La finestra «osservato qui» parte da lì" + (followsAzienda
      ? ": segue l'Azienda selezionata, non i filtri di anno e canale."
      : ", calcolata sull'intero perimetro visibile: il filtro per Azienda non è applicato in questa vista.")}
  >
    {rows.length === 0 && neverObserved.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna molecola nel perimetro con questi filtri.</p> : <>
    {rows.length > 0 && <svg role="img" aria-label="Mese della prima dispensazione locale di un biosimilare, per molecola" viewBox={`0 0 ${width} ${height}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
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
          <circle cx={x(k)} cy={y} r={r(row.referenceEur)} fill={teal} fillOpacity="0.85" stroke="white" strokeWidth="1" />
          <text x={x(k) + r(row.referenceEur) + 4} y={y + 4} fontSize="10" fill={muted}>{row.firstLabel}</text>
        </g>;
      })}
    </svg>}
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
        ? "Quanta parte della spesa di ciascuna Azienda, negli anni selezionati, raggiunge una quantità confrontabile: la base su cui ogni misura di volume riposa. Non è una misura di adozione."
        : "Righe rendicontate per Azienda negli anni selezionati. Record, non pazienti né confezioni."}
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
    title="Spesa per Azienda"
    lead="Spesa rendicontata per Azienda negli anni selezionati, e quanta ne raggiunge una quantità confrontabile. Un confronto fra Aziende descrive cosa è stato comprato, non quanto bene: il case-mix non è controllabile su questo rilascio. Per l'adozione di un'Azienda selezionarla nei filtri."
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

export function ChannelStack({ rows, years }: { rows: ChannelMixRow[]; years: ReadonlyArray<number> }) {
  const total = rows.reduce((s, r) => s + r.spend_eur, 0);
  return <Frame
    title="Composizione per canale"
    lead="Quota di ciascun canale sulla spesa rendicontata degli anni selezionati, e per singolo anno."
  >
    {rows.length === 0 || total === 0 ? <p className="text-sm text-muted-foreground">Nessun canale osservato.</p> : <>
    <div className="mb-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
      {rows.map((r) => <span key={r.channel}><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHANNEL_COLORS[r.channel] ?? muted }} />{r.channel} · {CHANNEL_NAMES[r.channel] ?? ""}</span>)}
    </div>
    <div className="space-y-2">
      {[...years.map((y) => ({
          label: String(y),
          get: (r: ChannelMixRow) => r.byYear[y] ?? 0,
          observed: (r: ChannelMixRow) => r.byYear[y] !== undefined,
        })),
        ...(years.length > 1 ? [{
          label: "Totale",
          get: (r: ChannelMixRow) => r.spend_eur,
          observed: () => true,
        }] : [])].map((bar) => {
        const t = rows.reduce((s, r) => s + bar.get(r), 0);
        return <div key={bar.label} className="grid gap-1.5 sm:grid-cols-[5rem_1fr] sm:items-center sm:gap-3">
          <div className="text-xs font-medium text-foreground">{bar.label}</div>
          <div role="img" aria-label={`Composizione per canale, ${bar.label}`} className="flex h-7 overflow-hidden rounded-lg bg-muted/40">
            {rows.map((r) => {
              const w = t === 0 ? 0 : Math.max(0, bar.get(r)) / t * 100;
              return <div key={r.channel} title={`${r.channel}: ${bar.observed(r) ? formatEur(bar.get(r)) : "non osservato"}`} className="flex items-center justify-center text-[10px] font-semibold text-white" style={{ width: `${w}%`, background: CHANNEL_COLORS[r.channel] ?? muted }}>
                {w > 9 ? `${r.channel} ${formatPercent(w / 100)}` : ""}
              </div>;
            })}
          </div>
        </div>;
      })}
    </div>
    </>}
  </Frame>;
}

// ------------------------------------------------------------- perimeter

export function PerimeterBars({ rows }: { rows: PerimeterRow[] }) {
  const observed = rows.filter((r) => r.spend_eur !== null);
  const max = Math.max(1, ...observed.map((r) => r.spend_eur ?? 0));
  return <Frame
    title="Dove sta il denaro rispetto al perimetro biosimilare"
    lead="Stato di ogni prodotto nella tassonomia riconciliata (B03), sotto i filtri attivi di anno, Azienda e canale — a differenza dell'imbuto qui sopra, che copre l'intero perimetro visibile. Solo biosimilari e medicinali di riferimento entrano nelle misure di adozione; tutto il resto è mostrato perché il perimetro sia visibile, non nascosto. Con un filtro per molecola questa vista non viene mostrata: la quota per stato di una sola molecola coinciderebbe con una misura di adozione senza regola di validità."
  >
    {observed.length === 0 ? <p className="text-sm text-muted-foreground">Nessun prodotto classificato nella selezione.</p> :
    <div role="img" aria-label="Spesa per stato di perimetro" className="space-y-2">
      {observed.map((r) => <div key={r.perimeter_status} className="grid gap-1 sm:grid-cols-[15rem_1fr_13rem] sm:items-center sm:gap-3">
        <div className="text-xs text-foreground">{r.label}</div>
        <div className="h-4 overflow-hidden rounded bg-muted/60">
          <div className="h-full rounded" style={{ width: `${Math.max(0, r.spend_eur ?? 0) / max * 100}%`, background: r.perimeter_status === "biosimilar" ? teal : r.perimeter_status === "reference_medicine" ? coral : slate }} />
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          <span className="text-foreground">{formatEur(r.spend_eur!)}</span>
          {r.share !== null && <> · {formatPercent(r.share)}</>}{" · "}
          {r.perimeter_status === "unclassified" ? "nessun AIC" : `${formatNumber(r.aic_count, 0)} AIC`}
        </div>
      </div>)}
    </div>}
  </Frame>;
}
