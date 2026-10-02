// The monthly view is a bar chart rather than a matrix of placeholder cells.
// A missing source month produces no mark. It is not a zero-height bar.

import { Frame } from "@/components/dashboard-review/pillar-b-adoption-visuals";
import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type { CalendarRow } from "@/lib/dashboard-review/pillar-b/facets";
import { monthSlots, monthlyChartSeries, type CalendarMetric, type MonthView } from "@/lib/dashboard-review/pillar-b/view-options";

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const COLORS: Record<number, string> = { 2024: "#647c90", 2025: "#169d94", 2026: "#d99335" };

function shortValue(value: number, metric: CalendarMetric) {
  if (metric === "comparabile") return formatPercent(value);
  if (Math.abs(value) >= 1_000_000) return `${formatNumber(value / 1_000_000, 1)} M€`;
  if (Math.abs(value) >= 1_000) return `${formatNumber(value / 1_000, 0)} k€`;
  return formatEur(value);
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
  const low = metric === "comparabile" ? 0 : Math.min(0, ...values);
  const high = metric === "comparabile" ? 1 : Math.max(1, ...values);
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
    ? "Gennaio–maggio 2026, l'unico tratto osservato. Anno parziale: non confrontato con gli anni completi."
    : view === "confronto"
      ? "Gli stessi mesi del 2024 e del 2025, su un asse comune. Un mese senza barra non ha record."
      : `I dodici mesi del ${view}; un mese senza barra non ha record.`) + scope;
  const plural = (n: number, one: string, many: string) => `${formatNumber(n, 0)} ${n === 1 ? one : many}`;

  return <Frame title={title} lead={lead}>
    {points.length === 0 ? <p className="text-sm text-muted-foreground">Nessun mese osservato per questa misura e selezione.</p> : <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex gap-4 text-muted-foreground">
          {shownYears.map((year) => <span key={year} className="inline-flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[year] }} />{year}{year === 2026 ? " · parziale" : ""}
          </span>)}
        </div>
        <span className="font-medium text-foreground">{plural(shownCount, "barra", "barre")} su {plural(slots, "mese", "mesi-anno")}</span>
      </div>
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
                fill={COLORS[year]} tabIndex={0} aria-label={`${MONTHS[month - 1]} ${year}: ${metric === "comparabile" ? formatPercent(point.value) : formatEur(point.value)}`}>
                {/* ONE text child: React 19 renders a multi-part <title> differently on the
                    server and in the browser (hydration error #418). */}
                <title>{`${MONTHS[month - 1]} ${year}: ${metric === "comparabile" ? formatPercent(point.value) : formatEur(point.value)}`}</title>
              </rect>;
            })}
          </g>;
        })}
      </svg>
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
