"use client";

// The Pillar B panels that carry a LOCAL control.
//
// Each panel receives, from the server, every variant it can show — already
// shaped by the pure modules the harness reconciles — and only CHOOSES among
// them in the browser. Nothing is recomputed here beyond what the chart draws;
// no row reaches the browser that the server did not deliberately send for
// this reader. The chosen variant is written to the URL without a navigation
// (see pillar-b-local-toggle.tsx), so a link reproduces the view.

import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import { monthKeyLabel, type VolumePanelRow } from "@/lib/dashboard-review/pillar-b/adoption";
import type { AziendaPanelRow, CalendarRow } from "@/lib/dashboard-review/pillar-b/facets";
import type { TrendRow } from "@/lib/dashboard-review/pillar-b/review-data";
import {
  AZIENDA_METRICS, AZIENDA_METRIC_LABELS, CALENDAR_METRICS, CALENDAR_METRIC_LABELS,
  CONCENTRATION_YEARS, PERIMETER_MODES, effectiveCalendarState, partialPeriodLabel, PERIMETER_MODE_LABELS, TREND_LIMITS, TREND_ORDERS,
  TREND_ORDER_LABELS, VIEW_OPTION_DEFAULTS, VIEW_OPTION_KEYS, volumeByRoute,
  type AziendaMetric, type CalendarMetric, type ConcentrationSlim, type ConcentrationYear, type MonthView,
  type PerimeterMode, type TrendLimit, type TrendOrder,
} from "@/lib/dashboard-review/pillar-b/view-options";
import { AziendaBars } from "@/components/dashboard-review/pillar-b-adoption-visuals";
import { MonthlyBars } from "@/components/dashboard-review/pillar-b-monthly-bars";
import { ConcentrationCurve, MoleculeChangeChart } from "@/components/dashboard-review/pillar-b-review-visuals";
import { LocalToggle, useUrlOption } from "@/components/dashboard-review/pillar-b-local-toggle";

/** "1 molecola" / "12 molecole": a count through the formatter, with its noun. */
function count(n: number, singular: string, plural: string): string {
  return `${formatNumber(n, 0)} ${n === 1 ? singular : plural}`;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs leading-relaxed text-foreground">{children}</div>
  );
}

function Bar({ share }: { share: number }) {
  const width = Math.max(0, Math.min(1, share)) * 100;
  return (
    <span aria-hidden="true" className="block h-1.5 w-full rounded-full bg-muted">
      <span className="block h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
    </span>
  );
}

// A TABLE IN A NARROW CARD. Each table below switches on the width of its OWN
// wrapper (a CSS container), not the viewport: at 768 px the sidebar leaves a
// card a phone's width, and the min-width tables hid most of their columns
// behind a sideways scroll. Under the width at which the table fits, each row
// becomes a list item: the first column as its heading, every other column as
// a "label value" pair with the table's own label. Same values, through the
// same formatter calls; the inactive layout is display:none, so it leaves the
// accessibility tree and the tab order.

/** One "label value" pair of a narrow row. A figure never wraps away from its unit; a word value (a route) may wrap. */
function Pair({ label, children, muted = false, text = false }: {
  label: string; children: React.ReactNode; muted?: boolean; text?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className={"text-right text-xs " + (text ? "min-w-0 break-words" : "whitespace-nowrap font-mono") + (muted ? " text-muted-foreground" : "")}>{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- calendar

/** The chart title follows the metric, so it is never "spesa" over a share. */
const MONTH_TITLES: Record<CalendarMetric, string> = {
  spesa: "Spesa mese per mese",
  comparabile: "Quota di spesa con quantità confrontabile, mese per mese",
  perimetro: "Spesa nel perimetro biosimilare, mese per mese",
};

export function CalendarPanel({ rows, initial, initialView, title }: {
  rows: CalendarRow[]; initial: CalendarMetric; initialView: MonthView; title: string;
}) {
  const [metricChoice, setMetric] = useUrlOption<CalendarMetric>(VIEW_OPTION_KEYS.calendar, initial, VIEW_OPTION_DEFAULTS.calendar);
  const [view, setView] = useUrlOption<MonthView>(VIEW_OPTION_KEYS.monthView, initialView, VIEW_OPTION_DEFAULTS.monthView);
  // The period drawn and the metric drawn follow one pure rule (tested): a
  // period with no record falls back to the first that has one, and 2026,
  // with no comparable-quantity basis, is never drawn as a comparable share.
  const { available, view: selected, metric } = effectiveCalendarState(rows, view, metricChoice);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {available.length > 1 && <LocalToggle label="Periodo" ariaLabel="Periodo del profilo mensile" value={selected} onChange={(next) => {
          if (next === "2026" && metric === "comparabile") setMetric("spesa");
          setView(next);
        }}
          options={available.map((v) => ({ value: v, label: v === "confronto" ? "2024 / 2025" : v === "2026" ? partialPeriodLabel(rows) : v }))} />}
        <LocalToggle label="Misura" ariaLabel="Misura del profilo mensile" value={metric} onChange={setMetric}
          options={CALENDAR_METRICS.filter((m) => selected !== "2026" || m !== "comparabile").map((m) => ({ value: m, label: CALENDAR_METRIC_LABELS[m] }))} />
      </div>
      <MonthlyBars rows={rows} title={metric === "spesa" ? title : MONTH_TITLES[metric]} metric={metric} view={selected} />
    </div>
  );
}

// ----------------------------------------------------------------- Azienda

export function AziendaPanel({ rows, years, initial, absent = [] }: {
  rows: AziendaPanelRow[]; years: ReadonlyArray<number>; initial: AziendaMetric;
  /** Aziende in the viewer's scope with no record under these filters. */
  absent?: ReadonlyArray<string>;
}) {
  const [metric, setMetric] = useUrlOption<AziendaMetric>(VIEW_OPTION_KEYS.azienda, initial, VIEW_OPTION_DEFAULTS.azienda);
  return (
    <div className="flex flex-col gap-3">
      <LocalToggle label="Misura" ariaLabel="Misura per Azienda" value={metric} onChange={setMetric}
        options={AZIENDA_METRICS.map((m) => ({
          value: m, label: AZIENDA_METRIC_LABELS[m],
          title: m === "spesa"
            ? "Euro rendicontati per Azienda, una barra per anno selezionato; nei canali e nella molecola selezionati. Non è una misura biosimilare."
            : m === "comparabile"
              ? "Percentuale: spesa con quantità confrontabile ÷ spesa rendicontata dell'Azienda, negli anni selezionati. Copertura della misura in volume, non adozione."
              : "Numero di righe rendicontate per Azienda negli anni selezionati. Record, non pazienti né confezioni.",
        }))} />
      <AziendaBars rows={rows} years={years} metric={metric} />
      {absent.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Nessun record con questi filtri per {absent.join(", ")}: {absent.length === 1 ? "non è uno zero, e non compare fra le barre" : "non sono zeri, e non compaiono fra le barre"}.
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ trends

export type TrendVariants = Record<PerimeterMode, Record<TrendOrder, TrendRow[]>>;

export function TrendPanel({ variants, totals, initial, scopeLine, comparisonLabel }: {
  /** Top rows per (perimeter, order), already sorted and sliced to the largest limit. */
  variants: TrendVariants;
  /** How many substances each perimeter mode holds under the active filters. */
  totals: Record<PerimeterMode, number>;
  initial: { order: TrendOrder; limit: TrendLimit; perimeter: PerimeterMode };
  /** The page's scope line: Azienda, years, channels, molecule. */
  scopeLine: string;
  /** "2024 e 2025 · 12 e 12 mesi osservati": the fixed year pair every change is read on. */
  comparisonLabel: string;
}) {
  const [order, setOrder] = useUrlOption<TrendOrder>(VIEW_OPTION_KEYS.trendOrder, initial.order, VIEW_OPTION_DEFAULTS.trendOrder);
  const [limit, setLimit] = useUrlOption<TrendLimit>(VIEW_OPTION_KEYS.trendLimit, initial.limit, VIEW_OPTION_DEFAULTS.trendLimit);
  const [perimeter, setPerimeter] = useUrlOption<PerimeterMode>(VIEW_OPTION_KEYS.perimeter, initial.perimeter, VIEW_OPTION_DEFAULTS.perimeter);
  const rows = variants[perimeter][order].slice(0, limit);
  const total = totals[perimeter];
  const orderWord = TREND_ORDER_LABELS[order];
  const perimeterNote = perimeter === "biosimilare" ? " · perimetro biosimilare" : "";
  const title = rows.length === 0
    ? `Nessuna molecola nell'insieme${perimeterNote}`
    : rows.length === 1
      ? `La molecola con la maggiore ${orderWord}${perimeterNote}`
      : `Le ${formatNumber(rows.length, 0)} molecole con la maggiore ${orderWord}${perimeterNote}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <LocalToggle label="Perimetro" ariaLabel="Perimetro delle molecole" value={perimeter} onChange={setPerimeter}
          options={PERIMETER_MODES.map((m) => ({
            value: m, label: PERIMETER_MODE_LABELS[m],
            title: m === "biosimilare"
              ? `Solo le molecole del perimetro biosimilare (l'elenco segue l'Azienda selezionata, su 2024–2025 e tutti i canali), con tutte le loro presentazioni: a livello di molecola, non di AIC. In questa selezione: ${count(totals.biosimilare, "molecola", "molecole")}.`
              : `Tutte le molecole della spesa rendicontata in questa selezione (${count(totals.tutto, "molecola", "molecole")}).`,
          }))} />
        <LocalToggle label="Ordina per" ariaLabel="Ordinamento delle variazioni" value={order} onChange={setOrder}
          options={TREND_ORDERS.map((o) => ({
            value: o, label: TREND_ORDER_LABELS[o],
            title: o === "spesa"
              ? "Spesa 2025 della molecola nella selezione (non il totale della spesa rendicontata): le barre restano la variazione 2025 meno 2024."
              : o === "pct" ? "Variazione 2025 meno 2024 divisa per il valore assoluto della spesa 2024 della molecola; non calcolabile se la spesa 2024 è assente o nulla."
              : "Variazione in euro: spesa 2025 meno spesa 2024 della molecola, nella selezione.",
          }))} />
        <LocalToggle label="Mostra" ariaLabel="Numero di molecole mostrate" value={limit} onChange={setLimit}
          options={TREND_LIMITS.map((n) => ({ value: n, label: String(n) }))} />
      </div>
      {/* WHAT EACH FIGURE IS, beside the plot, not in a collapsed table: the
          reviewers could not tell whether "spesa 2025" was the ledger total or
          the molecule's, nor which channels the change was read on. */}
      <Note>
        <p>
          <strong>Che cosa è calcolato.</strong> Per ogni molecola, nella selezione <em>{scopeLine}</em>: spesa 2024 e spesa 2025
          della molecola (somma delle righe rendicontate con quei filtri, IVA inclusa); <strong>variazione €</strong> = spesa 2025 − spesa 2024;
          <strong> variazione %</strong> = variazione € ÷ |spesa 2024|. Il confronto è sempre {comparisonLabel}; il filtro anno non si applica.
          {perimeter === "biosimilare"
            ? " Perimetro: solo le molecole del perimetro biosimilare, con tutte le loro presentazioni."
            : " Perimetro: tutta la spesa rendicontata, non solo i biosimilari."}
        </p>
        <p className="mt-1">
          <strong>Che cosa è disegnato.</strong> La barra è sempre la variazione in euro (zero al centro); la cifra a destra segue
          l&apos;ordinamento scelto ({orderWord}) e la seconda riga riporta l&apos;altra lettura. Un canale filtrato è la spesa di
          quel canale, non il totale della molecola: per vedere la molecola per canale e per anno, aprire la molecola.
        </p>
      </Note>
      <MoleculeChangeChart rows={rows}
        title={title}
        measure={order}
        orderNote={`Selezione per ${orderWord}${perimeter === "biosimilare" ? ", fra le molecole del perimetro biosimilare (tutte le presentazioni, a livello di molecola)" : ""}; ${count(total, "voce", "voci")} nell'insieme (principi attivi; le righe senza principio attivo risolto formano una voce a parte).`} />
      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-primary">Apri la serie numerica per principio attivo</summary>
        <div className="mt-3">
          <TrendTable
            caption={`Per principio attivo · ${rows.length === 1 ? "la prima" : `le prime ${formatNumber(rows.length, 0)}`} per ${orderWord}${perimeterNote}`}
            rows={rows} firstColumn="Principio attivo"
            footnote={total > rows.length
              ? `${rows.length === 1 ? "Mostrata 1 voce" : `Mostrate ${formatNumber(rows.length, 0)} voci`} di ${formatNumber(total, 0)}. Le voci non mostrate restano incluse in tutti i totali di questa pagina.`
              : undefined} />
        </div>
      </details>
    </div>
  );
}

/**
 * The six value columns of a trend table, in table order: ONE definition for
 * the header, the wide row and the narrow item, so the two layouts cannot
 * disagree on a label or a value. A year with no record is not a zero: it
 * says so. The change is then a movement from nothing, and its rate is
 * undefined.
 */
const TREND_VALUES: ReadonlyArray<{ label: string; muted?: boolean; value: (row: TrendRow) => React.ReactNode }> = [
  { label: "Spesa 2024", value: (row) => row.rows2024 === 0 ? <span className="text-muted-foreground">nessun record</span> : formatEur(row.spend2024) },
  { label: "Spesa 2025", value: (row) => row.rows2025 === 0 ? <span className="text-muted-foreground">nessun record</span> : formatEur(row.spend2025) },
  { label: "Variazione €", value: (row) => formatEur(row.changeEur) },
  { label: "Variazione %", value: (row) => row.change === null ? "—" : formatPercent(row.change) },
  { label: "Record 2024", value: (row) => formatNumber(row.rows2024, 0), muted: true },
  { label: "Record 2025", value: (row) => formatNumber(row.rows2025, 0), muted: true },
];

export function TrendTable({
  caption, rows, firstColumn, footnote,
}: { caption: string; rows: TrendRow[]; firstColumn: string; footnote?: string }) {
  const max = rows.reduce((m, r) => Math.max(m, Math.abs(r.spend2025)), 0);
  const barShare = (row: TrendRow) => (max === 0 ? 0 : Math.abs(row.spend2025) / max);
  return (
    <div className="flex flex-col gap-2 [container-type:inline-size]">
      <p className="text-xs font-semibold text-foreground">{caption}</p>
      {/* NARROW (under 53rem): one item per row, and no empty frame when there is none.
          The table's min-width is 44rem, but with eight-digit euro figures in four
          columns it needs ~46rem, plus its border. */}
      <ul aria-label={caption} className="divide-y divide-border rounded-xl border border-border text-xs empty:hidden [@container(min-width:53rem)]:hidden" translate="no">
        {rows.map((row) => (
          <li key={row.key} className="px-3 py-2.5">
            <p className="font-medium text-foreground">{row.label}</p>
            <dl className="mt-1.5 grid gap-x-6 gap-y-1 [@container(min-width:28rem)]:grid-cols-2">
              {TREND_VALUES.map((c) => <Pair key={c.label} label={c.label} muted={c.muted}>{c.value(row)}</Pair>)}
            </dl>
            <div className="mt-2 max-w-[16rem]"><Bar share={barShare(row)} /></div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-border [@container(min-width:53rem)]:block">
        <table className="w-full min-w-[44rem] text-sm" translate="no">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">{firstColumn}</th>
              {TREND_VALUES.map((c) => <th key={c.label} className="px-4 py-2.5 text-right font-semibold">{c.label}</th>)}
              <th className="w-32 px-4 py-2.5 text-left font-semibold">&nbsp;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-4 py-2.5 text-xs text-foreground">{row.label}</td>
                {TREND_VALUES.map((c) => <td key={c.label} className={"px-4 py-2.5 text-right font-mono text-xs" + (c.muted ? " text-muted-foreground" : "")}>{c.value(row)}</td>)}
                <td className="px-4 py-2.5"><Bar share={barShare(row)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && <p className="text-[11px] text-muted-foreground">{footnote}</p>}
    </div>
  );
}

// ----------------------------------------------------------- concentration

export type ConcentrationVariants = Record<PerimeterMode, Record<ConcentrationYear, ConcentrationSlim>>;

export function ConcentrationPanel({ variants, initial, defaultYear }: {
  variants: ConcentrationVariants;
  initial: { year: ConcentrationYear; perimeter: PerimeterMode };
  /**
   * The year the server shows when the URL names none (the latest selected
   * year). It is the hook's default so that choosing it removes the key and
   * choosing the other year writes it — whatever the URL said on arrival.
   */
  defaultYear: ConcentrationYear;
}) {
  const [year, setYear] = useUrlOption<ConcentrationYear>(VIEW_OPTION_KEYS.concentrationYear, initial.year, defaultYear);
  const [perimeter, setPerimeter] = useUrlOption<PerimeterMode>(VIEW_OPTION_KEYS.concentrationPerimeter, initial.perimeter, VIEW_OPTION_DEFAULTS.concentrationPerimeter);
  const conc = variants[perimeter][year];
  const perimeterSize = variants.biosimilare[year].moleculeCount;
  const scopeNote = perimeter === "biosimilare"
    ? `delle ${count(perimeterSize, "molecola", "molecole")} del perimetro biosimilare presenti in questa selezione nel ${year} (tutte le presentazioni: a livello di molecola, non di AIC)`
    : `di tutta la spesa rendicontata in questa selezione nel ${year}`;
  const scopeShort = perimeter === "biosimilare" ? "nel perimetro biosimilare" : "in tutta la spesa rendicontata";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <LocalToggle label="Anno" ariaLabel="Anno della concentrazione" value={year} onChange={setYear}
          options={CONCENTRATION_YEARS.map((y) => ({ value: y, label: String(y) }))} />
        <LocalToggle label="Perimetro" ariaLabel="Perimetro delle molecole" value={perimeter} onChange={setPerimeter}
          options={PERIMETER_MODES.map((m) => ({
            value: m, label: PERIMETER_MODE_LABELS[m],
            title: m === "biosimilare"
              ? `Solo le molecole del perimetro biosimilare presenti in questa selezione nel ${year} (${count(perimeterSize, "molecola", "molecole")}), con tutte le loro presentazioni: a livello di molecola, non di AIC.`
              : `Tutte le molecole della spesa rendicontata in questa selezione nel ${year} (${count(variants.tutto[year].moleculeCount, "molecola", "molecole")}).`,
          }))} />
      </div>
      {conc.moleculeCount > 1 && conc.totalEur === 0 ? (
        <Note>
          La spesa netta {scopeShort} nel {year} è pari a zero (acquisti e rettifiche si compensano): le quote di
          concentrazione non sono calcolabili, e non sono zero.
        </Note>
      ) : conc.moleculeCount <= 1 ? (
        <Note>
          La concentrazione descrive come la spesa si distribuisce fra più molecole: con{" "}
          {conc.moleculeCount === 0 ? "nessuna molecola" : "una sola molecola"} {scopeShort} nel {year} non c&apos;è nulla da
          concentrare. Cambiare anno o perimetro qui, o allargare i filtri in alto.
        </Note>
      ) : (<>
      <ConcentrationCurve data={conc} year={year} scopeNote={scopeNote} />
      {/* The figures and the ranking switch on THIS block's width: three
          figure cards side by side only where each keeps its text-3xl value
          on one line (32rem), the table only where its 40rem and its border fit (41rem). */}
      <div className="flex flex-col gap-3 [container-type:inline-size]">
      <div className="grid gap-3 [@container(min-width:32rem)]:grid-cols-3">
        {conc.topFiveShare !== null && <Stat label={`Quota delle prime 5 · ${year}`} value={formatPercent(conc.topFiveShare)} detail={scopeShort} />}
        <Stat label={`Voci osservate · ${year}`} value={formatNumber(conc.moleculeCount, 0)} detail={`${scopeShort}; principi attivi, più l'eventuale voce «Principio attivo non risolto»`} />
        <Stat label={`Molecole a saldo negativo · ${year}`} value={formatNumber(conc.negativeMolecules, 0)} detail={`${scopeShort}; resi e note di credito superiori agli acquisti`} />
      </div>
      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-primary">Apri la classifica numerica {conc.rows.length === 1 ? "della prima molecola" : `delle prime ${formatNumber(conc.rows.length, 0)} molecole`} · {year} · {scopeShort}</summary>
        {/* NARROW (under 41rem): one item per molecola, rank and name as its heading; the total last. */}
        <ul aria-label={`Classifica numerica ${conc.rows.length === 1 ? "della prima molecola" : `delle prime ${formatNumber(conc.rows.length, 0)} molecole`} · ${year} · ${scopeShort}`}
          className="mt-3 divide-y divide-border rounded-xl border border-border text-xs [@container(min-width:41rem)]:hidden" translate="no">
          {conc.rows.map((row) => (
            <li key={row.label} className="px-3 py-2.5">
              <p className="flex items-baseline gap-2 text-foreground">
                <span className="font-mono text-muted-foreground">{row.rank}</span>
                <span className="min-w-0 break-words font-medium">{row.label}</span>
              </p>
              <dl className="mt-1.5 grid gap-x-6 gap-y-1 [@container(min-width:28rem)]:grid-cols-2">
                <Pair label={`Spesa ${year}`}>{formatEur(row.spend_eur)}</Pair>
                <Pair label="Quota">{formatPercent(row.share)}</Pair>
                <Pair label="Quota cumulata">{formatPercent(row.cumulativeShare)}</Pair>
              </dl>
              <div className="mt-2 max-w-[16rem]"><Bar share={row.cumulativeShare} /></div>
            </li>
          ))}
          <li className="bg-muted/30 px-3 py-2.5">
            <p className="font-semibold text-foreground">Totale {count(conc.moleculeCount, "molecola", "molecole")} {scopeShort}</p>
            <dl className="mt-1.5 grid gap-x-6 gap-y-1 font-semibold [@container(min-width:28rem)]:grid-cols-2">
              <Pair label={`Spesa ${year}`}>{formatEur(conc.totalEur)}</Pair>
              <Pair label="Quota">{formatPercent(1)}</Pair>
            </dl>
          </li>
        </ul>
        <div className="mt-3 hidden overflow-x-auto rounded-xl border border-border [@container(min-width:41rem)]:block">
          <table className="w-full min-w-[40rem] text-sm" translate="no">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">#</th>
                <th className="px-4 py-2.5 text-left font-semibold">Principio attivo</th>
                <th className="px-4 py-2.5 text-right font-semibold">Spesa {year}</th>
                <th className="px-4 py-2.5 text-right font-semibold">Quota</th>
                <th className="px-4 py-2.5 text-right font-semibold">Quota cumulata</th>
                <th className="px-4 py-2.5 text-left font-semibold">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {conc.rows.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.rank}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground">{row.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">{formatEur(row.spend_eur)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">{formatPercent(row.share)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">{formatPercent(row.cumulativeShare)}</td>
                  <td className="w-32 px-4 py-2.5"><Bar share={row.cumulativeShare} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30">
              <tr>
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5 text-xs font-semibold text-foreground">Totale {count(conc.moleculeCount, "molecola", "molecole")} {scopeShort}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">{formatEur(conc.totalEur)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">{formatPercent(1)}</td>
                <td className="px-4 py-2.5" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
      </div>
      </>)}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-5 text-foreground">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display my-4 break-words text-3xl font-semibold tabular-nums leading-tight">{value}</p>
      {detail && <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ volume

export function VolumePanel({ rows, routes, initial }: {
  rows: VolumePanelRow[]; routes: ReadonlyArray<string>; initial: string | null;
}) {
  const [route, setRoute] = useUrlOption<string>(VIEW_OPTION_KEYS.route, initial ?? "", "");
  const chosen = route === "" ? null : route;
  const shown = volumeByRoute(rows, chosen);
  // Sorted on ONE named denominator: the share since first local use; rows
  // without one follow, by whole-period share. The number printed says which.
  const chartRows = shown.filter((r) => r.wholePeriodShare !== null || r.windowShare !== null)
    .sort((a, b) => (a.windowShare === null ? 1 : 0) - (b.windowShare === null ? 1 : 0)
      || (b.windowShare ?? b.wholePeriodShare ?? -1) - (a.windowShare ?? a.wholePeriodShare ?? -1))
    .slice(0, 14);
  if (rows.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col gap-3 [container-type:inline-size]">
      {routes.length > 1 && (
        <LocalToggle label="Via di somministrazione" ariaLabel="Via di somministrazione" value={route} onChange={setRoute}
          options={[{ value: "", label: "Tutte" }, ...routes.map((r) => ({ value: r, label: r.toLowerCase() }))]} />
      )}
      {chosen !== null && (
        <p className="text-[11px] text-muted-foreground">
          Le schede qui sopra (copertura, gruppi calcolabili, spesa trattenuta) riguardano tutte le vie: i gruppi
          trattenuti non portano una via di somministrazione. Questa tabella mostra{" "}
          {shown.length === 1 ? "il gruppo" : `i ${count(shown.length, "gruppo", "gruppi")}`} con via «{chosen.toLowerCase()}».
        </p>
      )}
      {chartRows.length > 0 && <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Quota biosimilare in volume per principio attivo</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Ogni riga mantiene la propria via e unità normalizzata; le quantità non sono sommate fra righe.</p>
          </div>
          <div className="flex gap-3 text-[11px] text-muted-foreground">
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-500" />intero periodo</span>
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-primary" />dal primo uso</span>
          </div>
        </div>
        {/* Name, bars and figure side by side only where the bars keep ~11rem
            beside the 11rem name and the 4rem figure: on the chart's own
            width (28rem), not the viewport's — at 768 px the sidebar leaves
            this card a phone's width and the bars a few pixels. */}
        <div className="space-y-3 [container-type:inline-size]" role="img" aria-label="Confronto delle quote biosimilari in volume, per principio attivo, via e unità">
          {chartRows.map((row) => <div key={`${row.substance}/${row.route}/${row.unit}`} className="grid gap-1 [@container(min-width:28rem)]:grid-cols-[11rem_1fr_4rem] [@container(min-width:28rem)]:items-center [@container(min-width:28rem)]:gap-3">
            <div className="min-w-0 text-xs text-foreground" title={`${row.substance} · ${row.route} · ${row.unit}`}>
              {/* On its own line under 28rem, a long name wraps instead of losing its end. */}
              <span className="block break-words font-medium [@container(min-width:28rem)]:truncate">{row.substance}</span>
              <span className="block break-words text-[10px] text-muted-foreground [@container(min-width:28rem)]:truncate">{row.route.toLowerCase()} · {row.unit}</span>
            </div>
            <div className="space-y-1">
              {([{ key: "whole", share: row.wholePeriodShare, color: "#647c90" },
                 { key: "window", share: row.windowShare, color: "hsl(var(--primary))" }] as const).map((bar) =>
                bar.share === null ? null : <div key={bar.key} className="h-2.5 overflow-hidden rounded bg-muted/50">
                  <div className="h-full rounded" style={{ width: `${Math.max(0, Math.min(1, bar.share)) * 100}%`, background: bar.color }} />
                </div>)}
            </div>
            <div className="text-right font-mono text-[11px] text-foreground">
              {row.windowShare === null ? formatPercent(row.wholePeriodShare!) : formatPercent(row.windowShare)}
              <span className="block text-[10px] font-sans text-muted-foreground">{row.windowShare === null ? "intero periodo" : "dal primo uso"}</span>
            </div>
          </div>)}
        </div>
        {shown.length > chartRows.length && <p className="mt-3 text-[11px] text-muted-foreground">Mostrati {count(chartRows.length, "gruppo", "gruppi")} di {formatNumber(shown.length, 0)}; la tabella include tutti quelli osservati.</p>}
      </div>}
      {/* NARROW (under 49rem: the table's 48rem min-width and its border): one
          item per (principio attivo, via, unità), in the table's order. */}
      <ul aria-label="Uptake in volume per molecola e via di somministrazione" className="divide-y divide-border rounded-lg border border-border text-xs empty:hidden [@container(min-width:49rem)]:hidden" translate="no">
        {shown.map((v) => (
          <li key={`${v.substance}/${v.route}/${v.unit}`} className="px-3 py-2.5">
            <p className="break-words font-medium text-foreground">{v.substance}</p>
            {/* Two columns from 36rem, filled DOWN: the group (via, unità, Aziende) on
                the left, its measures (the two shares, the first use) on the right. */}
            <dl className="mt-1.5 grid gap-x-6 gap-y-1 [@container(min-width:36rem)]:grid-flow-col [@container(min-width:36rem)]:grid-cols-2 [@container(min-width:36rem)]:grid-rows-3">
              <Pair label="Via" muted text>{v.route}</Pair>
              <Pair label="Unità" muted>{v.unit}</Pair>
              <Pair label="Aziende">{formatNumber(v.aslCount, 0)}</Pair>
              <Pair label="Quota (intero periodo)">
                <span className="inline-flex items-center gap-2">
                  <span className="w-12"><Bar share={v.wholePeriodShare ?? 0} /></span>
                  <span className="inline-block min-w-[2.75rem]">{v.wholePeriodShare === null ? "—" : formatPercent(v.wholePeriodShare)}</span>
                </span>
              </Pair>
              <Pair label="Quota (dal primo uso)">
                <span className="inline-flex items-center gap-2">
                  <span className="w-12"><Bar share={v.windowShare ?? 0} /></span>
                  <span className="inline-block min-w-[2.75rem]">{v.windowShare === null ? "—" : formatPercent(v.windowShare)}</span>
                </span>
              </Pair>
              <Pair label="Primo uso" muted>{v.firstKey === null ? "mai" : monthKeyLabel(v.firstKey)}</Pair>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-lg border border-border [@container(min-width:49rem)]:block">
        <table className="w-full min-w-[48rem] text-sm" translate="no">
          <caption className="sr-only">Uptake in volume per molecola e via di somministrazione</caption>
          <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Principio attivo</th>
              <th className="px-4 py-2.5 text-left font-semibold">Via</th>
              <th className="px-4 py-2.5 text-left font-semibold">Unità</th>
              <th className="px-4 py-2.5 text-right font-semibold">Aziende</th>
              <th className="px-4 py-2.5 text-left font-semibold">Quota (intero periodo)</th>
              <th className="px-4 py-2.5 text-left font-semibold">Quota (dal primo uso)</th>
              <th className="px-4 py-2.5 text-right font-semibold">Primo uso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((v) => (
              <tr key={`${v.substance}/${v.route}/${v.unit}`}>
                <td className="px-4 py-2.5 text-xs text-foreground">{v.substance}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{v.route}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{v.unit}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">{formatNumber(v.aslCount, 0)}</td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="w-20"><Bar share={v.wholePeriodShare ?? 0} /></span>
                    <span className="font-mono text-xs">{v.wholePeriodShare === null ? "—" : formatPercent(v.wholePeriodShare)}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="w-20"><Bar share={v.windowShare ?? 0} /></span>
                    <span className="font-mono text-xs">{v.windowShare === null ? "—" : formatPercent(v.windowShare)}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                  {v.firstKey === null ? "mai" : monthKeyLabel(v.firstKey)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
