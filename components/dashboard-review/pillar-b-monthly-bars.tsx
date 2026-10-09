// The monthly view is a bar chart rather than a matrix of placeholder cells.
// A missing source month produces no mark. It is not a zero-height bar.

import { Frame } from "@/components/dashboard-review/pillar-b-adoption-visuals";
import { NARROW_W, clearLabels, textWidth } from "@/components/dashboard-review/pillar-b-review-visuals";
import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { CalendarRow } from "@/lib/dashboard-review/pillar-b/facets";
import { monthSlots, monthlyChartSeries, partialPeriodLabel, type CalendarMetric, type MonthView } from "@/lib/dashboard-review/pillar-b/view-options";

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const COLORS: Record<number, string> = { 2024: "#647c90", 2025: "#169d94", 2026: "#d99335" };
const ink = "hsl(var(--foreground))";
const muted = "hsl(var(--muted-foreground))";
const border = "hsl(var(--border))";

function shortValue(value: number, metric: CalendarMetric) {
  if (metric === "comparabile") return formatPercent(value);
  if (Math.abs(value) >= 1_000_000) return `${formatNumber(value / 1_000_000, 1)} M€`;
  if (Math.abs(value) >= 1_000) return `${formatNumber(value / 1_000, 0)} k€`;
  return formatEur(value);
}

/** The exact value of one bar, for its <title> and its accessible name in both layouts. */
function exactLabel(month: number, year: number, value: number, metric: CalendarMetric) {
  return `${MONTHS[month - 1]} ${year}: ${metric === "comparabile" ? formatPercent(value) : formatEur(value)}`;
}

type MonthPoint = { year: number; month: number; value: number };

/**
 * THE NARROW LAYOUT: a month list with horizontal bars, below a 52rem card.
 *
 * The 840-unit column chart scaled into a phone card printed its month names
 * at under 4 px. Here every month is a line of its own (two in the 2024/2025
 * view, one per year, the year written beside the bar, not left to colour):
 * month, bar on the common scale, and the value in the compact form of the
 * wide chart's axis, so no month needs a tooltip to be read. A month without
 * a value has no bar and shows "—": a gap, never a zero. The scale (low,
 * span) is the wide chart's; its three labels are kept where they do not
 * collide.
 */
function MonthlyBarsNarrow({ points, months, shownYears, metric, low, span, label }: {
  points: ReadonlyArray<MonthPoint>;
  months: number[];
  shownYears: number[];
  metric: CalendarMetric;
  low: number;
  span: number;
  label: string;
}) {
  const W = NARROW_W, both = shownYears.length > 1;
  const widest = Math.max(textWidth("—", 12), ...points.map((p) => textWidth(shortValue(p.value, metric), 12)));
  const L = both ? 66 : 36;
  const R = Math.max(L + 120, W - 2 - widest - 8);
  const sub = both ? 17 : 22, bar = both ? 11 : 13, gap = both ? 6 : 0;
  const block = sub * shownYears.length + gap;
  const top = 2;
  const bx = (value: number) => L + ((value - low) / span) * (R - L);
  const zero = bx(0);
  const rowsEnd = top + months.length * block - gap;
  const axisY = rowsEnd + 16;
  const height = axisY + 4;
  const ticks = [0, .5, 1].map((fraction) => {
    const value = low + fraction * span, text = shortValue(value, metric), w = textWidth(text, 12), x = bx(value);
    return { fraction, value, text, x, extent: fraction === 0 ? [x, x + w] as const : fraction === 1 ? [x - w, x] as const : [x - w / 2, x + w / 2] as const };
  });
  const labelled = clearLabels(ticks.map((t) => t.extent));
  return <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${height}`} className="w-full max-w-[20rem]" xmlns="http://www.w3.org/2000/svg">
    {ticks.map((t) => <line key={t.fraction} x1={t.x} y1={top} x2={t.x} y2={rowsEnd} stroke={border} strokeDasharray={t.value === 0 ? undefined : "4 5"} />)}
    {low < 0 && <line x1={zero} y1={top} x2={zero} y2={rowsEnd} stroke={border} />}
    {months.map((month, i) => {
      const y0 = top + i * block;
      return <g key={month}>
        <text x={2} y={y0 + (sub * shownYears.length) / 2 + 4} fontSize="12" fill={muted}>{MONTHS[month - 1]}</text>
        {shownYears.map((year, j) => {
          const yc = y0 + j * sub + sub / 2;
          const point = points.find((p) => p.year === year && p.month === month);
          return <g key={year}>
            {both && <text x={32} y={yc + 4} fontSize="12" fill={muted}>{year}</text>}
            {point && <rect x={Math.min(zero, bx(point.value))} y={yc - bar / 2} width={Math.max(1, Math.abs(bx(point.value) - zero))} height={bar} rx="2"
              fill={COLORS[year]} tabIndex={0} aria-label={exactLabel(month, year, point.value, metric)}>
              {/* ONE text child (hydration error #418). */}
              <title>{exactLabel(month, year, point.value, metric)}</title>
            </rect>}
            <text x={W - 2} y={yc + 4} textAnchor="end" fontSize="12" fill={point ? ink : muted}>{point ? shortValue(point.value, metric) : "—"}</text>
          </g>;
        })}
        {both && i < months.length - 1 && <line x1={0} y1={y0 + block - gap / 2} x2={W} y2={y0 + block - gap / 2} stroke={border} strokeOpacity="0.6" />}
      </g>;
    })}
    {ticks.map((t, i) => labelled[i] && <text key={t.fraction} x={t.x} y={axisY} textAnchor={t.fraction === 0 ? "start" : t.fraction === 1 ? "end" : "middle"} fontSize="12" fill={muted}>{t.text}</text>)}
  </svg>;
}

export function MonthlyBars({ rows, metric, view, title }: {
  rows: CalendarRow[];
  metric: CalendarMetric;
  view: MonthView;
  title: string;
}) {
  const points = monthlyChartSeries(rows, view, metric);
  // Every month of the period keeps its slot, so a month with no bar reads as
  // a gap on the axis, not as a month that does not exist.
  const months = monthSlots(rows, view);
  const shownYears = view === "confronto" ? [2024, 2025] : [Number(view)];
  const width = 840, height = 326, left = 68, right = 812, top = 26, bottom = 268;
  const values = points.map((p) => p.value);
  // From the data for every metric: a comparable share can leave 0..1 when
  // credit notes net a month's spend negative; in range this is exactly 0..1.
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const span = high - low || 1;
  const y = (value: number) => bottom - ((value - low) / span) * (bottom - top);
  const zero = y(0);
  const group = (right - left) / Math.max(months.length, 1);
  const barWidth = Math.min(view === "confronto" ? 22 : 38, group / (shownYears.length + 1));
  const shownCount = points.length;
  const slots = months.length * shownYears.length;
  const missing = slots - shownCount;
  const partial = view === "2026";
  const scope = " Mostra i mesi del rilascio sotto i filtri di Azienda, canale e molecola; non segue il selettore del periodo in alto, che vale per le altre viste.";
  const lead = (partial
    ? `${partialPeriodLabel(rows)}: l'unico tratto osservato dell'anno. Anno incompleto: non confrontato con gli anni completi.`
    : view === "confronto"
      ? "Gli stessi mesi del 2024 e del 2025, su un asse comune. Un mese senza barra non ha record."
      : `I dodici mesi del ${view}; un mese senza barra non ha record.`) + scope;
  const plural = (n: number, one: string, many: string) => `${formatNumber(n, 0)} ${n === 1 ? one : many}`;

  return <Frame title={title} lead={lead}>
    {points.length === 0 ? <p className="text-sm text-muted-foreground">Nessun mese osservato per questa misura e selezione.</p> : <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex gap-4 text-muted-foreground">
          {shownYears.map((year) => <span key={year} className="inline-flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[year] }} />{year === 2026 ? partialPeriodLabel(rows) : year}
          </span>)}
        </div>
        <span className="font-medium text-foreground">{plural(shownCount, "barra", "barre")} su {plural(slots, "mese", "mesi-anno")}</span>
      </div>
      {/* The 840-unit column chart from a 52rem card up: at 1280 px the card
          is about 837 px wide, where its text is at 99.6% of its design size.
          Below, the month list. The switch follows the CARD, not the screen. */}
      <div className="[container-type:inline-size]">
      <div className="[@container(min-width:52rem)]:hidden">
        <MonthlyBarsNarrow points={points} months={months} shownYears={shownYears} metric={metric} low={low} span={span} label={`${title}: ${lead}`} />
      </div>
      <div className="hidden [@container(min-width:52rem)]:block">
      <svg role="img" aria-label={`${title}: ${lead}`} viewBox={`0 0 ${width} ${height}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
        {[0, .5, 1].map((fraction) => {
          const value = low + fraction * span;
          const yy = y(value);
          return <g key={fraction}>
            <line x1={left} y1={yy} x2={right} y2={yy} stroke="hsl(var(--border))" strokeDasharray={value === 0 ? undefined : "4 5"} />
            <text x={left - 9} y={yy + 4} textAnchor="end" fontSize="11" fill="hsl(var(--muted-foreground))">{shortValue(value, metric)}</text>
          </g>;
        })}
        {months.map((month, i) => {
          const center = left + group * (i + .5);
          return <g key={month}>
            <text x={center} y={bottom + 23} textAnchor="middle" fontSize="12" fill="hsl(var(--muted-foreground))">{MONTHS[month - 1]}</text>
            {shownYears.map((year, j) => {
              const point = points.find((p) => p.year === year && p.month === month);
              if (!point) return null;
              const topY = Math.min(zero, y(point.value));
              const barHeight = Math.max(1, Math.abs(y(point.value) - zero));
              const x = center - (shownYears.length * barWidth) / 2 + j * barWidth;
              return <rect key={year} x={x} y={topY} width={barWidth - 2} height={barHeight} rx="3"
                fill={COLORS[year]} tabIndex={0} aria-label={exactLabel(month, year, point.value, metric)}>
                {/* ONE text child: React 19 renders a multi-part <title> differently on the
                    server and in the browser (hydration error #418). */}
                <title>{exactLabel(month, year, point.value, metric)}</title>
              </rect>;
            })}
          </g>;
        })}
      </svg>
      </div>
      </div>
      <details className="mt-3 rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-xs font-semibold text-primary">Valori esatti, mese per mese</summary>
        <div className="mt-2 max-h-72 overflow-y-auto">
          <table className="w-full text-xs" translate="no">
            <caption className="sr-only">{title}: valori esatti per anno e mese nella selezione</caption>
            <thead className="sticky top-0 bg-card text-left text-muted-foreground">
              <tr><th scope="col" className="py-1.5 pr-3">Anno · mese</th><th scope="col" className="py-1.5 text-right">{metric === "comparabile" ? "Quota di spesa con quantità confrontabile" : "Spesa"}</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {months.flatMap((month) => shownYears.map((year) => {
                const point = points.find((p) => p.year === year && p.month === month);
                const source = rows.find((r) => r.year === year)?.cells.find((c) => c.month === month);
                const value = point
                  ? metric === "comparabile" ? formatPercent(point.value) : formatEur(point.value)
                  : source?.spend_eur === null || source === undefined ? "nessun record" : "non calcolabile";
                return <tr key={`${year}-${month}`}>
                  <th scope="row" className="py-1.5 pr-3 font-normal">{year} · {MONTHS[month - 1]}</th>
                  <td className="py-1.5 text-right font-mono">{value}</td>
                </tr>;
              }))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {metric === "comparabile"
          ? "Quota di spesa con quantità confrontabile nel mese, non adozione biosimilare."
          : metric === "perimetro"
            ? "Spesa dei prodotti classificati come biosimilari o medicinali di riferimento; non è una quota di adozione."
            : "Spesa rendicontata del mese."}
        {missing > 0 ? (metric === "comparabile"
          ? ` ${plural(missing, "mese senza barra", "mesi senza barra")}: nessun record, o spesa netta nulla e quindi quota non calcolabile.`
          : ` ${plural(missing, "mese senza barra", "mesi senza barra")}: nessun record in quel mese, che non è uno zero.`) : ""}
      </p>
    </>}
  </Frame>;
}
