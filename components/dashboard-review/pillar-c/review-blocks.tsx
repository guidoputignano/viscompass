"use client";

/** Presentational blocks of the Pillar C review sections, shared by the reviewer workspace (analytical-workspace.tsx)
 * and the organisation-scoped workspace (scoped-workspace.tsx). They read values only, never an organisation key or
 * label, and import nothing reviewer-only: the scoped workspace reaches this module, and its bundle must carry no
 * province key (review finding UI-4; tests/pillar-c-scoped-client-graph.test.mjs). */
import { ArrowDownUp, Wallet, FileCheck2 } from "lucide-react";
import dynamic from "next/dynamic";
import { KpiCard } from "@/components/dashboard-review/analytics-ui";
import { PillarCChangeBridge } from "@/components/dashboard-review/pillar-c/change-bridge";
import { itNumber } from "@/lib/format/it-number";
import { C_COMPONENT_LABELS, C_PERIOD_LABELS, cMoneyDifference, cMoneyLabel, type CBaseline, type CBridge, type CBudget, type CCount, type CReviewFilters } from "@/lib/dashboard-review/pillar-c/review";

const eur = cMoneyLabel;
const signed = (value: string | number) => `${Number(value) > 0 ? "+" : ""}${eur(value)}`;
const fmt = (value: number) => itNumber(value, { maximumFractionDigits: 1 });
const SpendCanvas = dynamic(() => import("@/components/dashboard-review/pillar-c/chart-canvases").then((m) => m.SpendCanvas), { ssr: false });
const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const selectClass = "mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const actionClass = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

function Panel({ title, description, controls, children }: { title: string; description?: string; controls?: React.ReactNode; children: React.ReactNode }) {
  return <article className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-base font-semibold">{title}</h3>{description && <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{description}</p>}</div>{controls}</div>{children}</article>;
}
type HeadingProps = { id: string; title: string; children: React.ReactNode; inner: true };
/** The heading of a block inside a section frame: the frame carries the h2 and the numeral, so the block gets an h3 and
 * no number badge. `inner` is required, so a block heading can never be rendered as a numbered h2 again (1.2c). */
function Heading({ id, title, children }: HeadingProps) {
  return <div className="mb-5"><h3 id={`${id}-title`} className="text-lg font-semibold tracking-tight">{title}</h3><p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">{children}</p></div>;
}
function ExactTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: React.ReactNode[][] }) {
  return <details className="mt-5 rounded-xl border border-border"><summary className="cursor-pointer rounded-xl px-4 py-3.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Valori e dettaglio · {caption}</summary><div className="overflow-x-auto px-4 pb-4"><table className="w-full text-left text-xs"><caption className="sr-only">{caption}</caption><thead><tr>{headers.map((h) => <th scope="col" key={h} className="whitespace-nowrap border-b border-border px-2 py-3 font-semibold">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 ? <th key={j} scope="row" className="border-b border-border/50 px-2 py-3 font-medium">{cell}</th> : <td key={j} className="whitespace-nowrap border-b border-border/50 px-2 py-3 tabular-nums">{cell}</td>)}</tr>)}</tbody></table></div></details>;
}
function Empty({ children }: { children: React.ReactNode }) { return <p role="status" className="rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">{children}</p>; }

// ---------------------------------------------------------------- blocks shared with the organisation-scoped workspace
/** A review row of either reading mode. These blocks read values only, never an organisation key. */
type Row<T> = Omit<T, "org"> & { org: string };
type BudgetRow = Omit<CBudget, "org" | "basis"> & { org: string; basis: CBudget["basis"] };
type CountRow = Row<CCount>;
type SpendMonth = { month: number; amount: number | null; exact: string | null; rows: number; label: string };

/** The three spend figures of the period. How many months hold a row is a coverage fact, stated under the chart. */
export function SpendKpis({ baseline, period, scope }: { baseline: Row<CBaseline>; period: CReviewFilters["period"]; scope: string }) {
  return <><div className="mb-5 grid gap-3 sm:grid-cols-3"><KpiCard label={`Spesa netta · ${C_PERIOD_LABELS[period]}`} value={eur(baseline.net)} detail={scope} icon={Wallet} accent /><KpiCard label="Importi positivi" value={eur(baseline.positive)} detail="Prima delle rettifiche negative" icon={ArrowDownUp} /><KpiCard label="Rettifiche negative" value={eur(baseline.negative)} detail="Incluse, non rimosse dal totale" icon={FileCheck2} /></div></>;
}
/** The spend of the period, the chart chosen by the question: monthly net spend as columns (a negative month in --viz-4,
 * below the zero line), the cumulative spend as a line with a dot per month that breaks where a month has no row. The
 * exact values are in the table beneath, so the chart is hidden from assistive technology. */
export function SpendChart({ monthly, divisor, trend }: { monthly: SpendMonth[]; divisor: number; trend: CReviewFilters["trend"] }) {
  return <div className="h-72 min-w-0" aria-hidden="true" data-chart-slot="spend"><SpendCanvas monthly={monthly} divisor={divisor} trend={trend} /></div>;
}
/** How many months of the period hold at least one row: a coverage fact under the chart, not a figure of the period. */
export function SpendCoverage({ monthly }: { monthly: SpendMonth[] }) {
  const represented = monthly.filter((r) => r.rows > 0).length;
  return <p key={`${represented}/${monthly.length}`} className="mt-3 text-xs text-muted-foreground">{`${represented} di ${monthly.length} mesi rappresentati · non certifica la completezza degli invii`}</p>;
}
/** The exact cell of a month. A month with no row in the register says so: it is neither an observed zero nor a gap
 * in the data; a month whose cumulative value is interrupted reads «Non disponibile». */
export function cSpendCell(r: SpendMonth): string {
  return r.exact !== null ? eur(r.exact) : r.rows === 0 ? "Nessuna riga nel registro" : "Non disponibile";
}
export function BridgeValues({ left, right, bridge }: { left: Row<CBaseline>; right: Row<CBaseline>; bridge: Row<CBridge>[] }) {
  return <><div className="mb-6 grid gap-3 sm:grid-cols-3">{[["Spesa iniziale", eur(left.net)], ["Variazione", signed(cMoneyDifference(right.net, left.net))], ["Spesa finale", eur(right.net)]].map(([label, value]) => <div key={label} className="rounded-xl bg-secondary/50 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{value}</p></div>)}</div><PillarCChangeBridge opening={left.net} closing={right.net} components={bridge}/><ExactTable caption="Componenti del ponte" headers={["Componente", "Contributo", "Voci prodotto"]} rows={bridge.map((r) => [C_COMPONENT_LABELS[r.component], signed(r.value), itNumber(r.cells)])} /></>;
}
/** Budget, both allocation keys and the neutral difference on one common scale; the first twelve areas are drawn. */
export function BudgetRows({ budgets }: { budgets: BudgetRow[] }) {
  const budgetValues = budgets.flatMap((r) => [Number(r.budget), Number(r.actual ?? 0), Number(r.alternative ?? 0)]);
  const budgetMin = Math.min(0, ...budgetValues), budgetMax = Math.max(1, ...budgetValues);
  const budgetPosition = (n: number) => (n - budgetMin) / (budgetMax - budgetMin) * 100;
  return <>
          <div className="mb-5 flex flex-wrap gap-4 text-xs text-muted-foreground"><span>● Chiave principale</span><span>◇ Chiave alternativa</span><span>│ Budget</span></div>
          <div className="mb-3 flex justify-between gap-3 text-[10px] tabular-nums text-muted-foreground" aria-hidden="true"><span>{eur(budgetMin)}</span><span>Scala comune · euro</span><span>{eur(budgetMax)}</span></div>
          <div className="space-y-5">{budgets.slice(0, 12).map((r) => <div key={r.id}>
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span>{r.level} {r.area}</span><span className="font-semibold tabular-nums">{eur(r.actual)}</span></div>
            {r.actual === null ? <p className="text-xs text-muted-foreground">Nessuna riga attribuita: nessun confronto con un consuntivo pari a zero.</p> : <div className="relative h-5 rounded bg-secondary" aria-hidden="true">
              {budgetMin < 0 && <span className="absolute top-0 h-5 border-l border-border" style={{ left: `${budgetPosition(0)}%` }} />}
              <span className="absolute top-2 h-1 bg-primary/35" style={{ left: `${budgetPosition(Math.min(Number(r.actual), Number(r.alternative)))}%`, width: `${Math.abs(Number(r.actual) - Number(r.alternative)) / (budgetMax - budgetMin) * 100}%` }} />
              <span className="absolute top-1.5 size-2 rounded-full bg-primary" style={{ left: `calc(${budgetPosition(Number(r.actual))}% - 4px)` }} />
              <span className="absolute top-1.5 size-2 rotate-45 border border-primary bg-card" style={{ left: `calc(${budgetPosition(Number(r.alternative))}% - 4px)` }} />
              <span className="absolute top-0 h-5 border-l-2 border-foreground" style={{ left: `calc(${budgetPosition(Number(r.budget))}% - 2px)` }} />
            </div>}
          </div>)}</div>
          {budgets.length > 12 && <p className="mt-4 text-xs text-muted-foreground">{`Prime 12 aree nel grafico; tutte le ${budgets.length} aree sono nella tabella.`}</p>}
          <ExactTable caption="Budget, due chiavi e differenze neutrali" headers={["Area", "Fonte", "Budget", "Chiave principale", "Alternativa", "Differenza principale"]} rows={budgets.map((r) => [`${r.level} ${r.area}`, r.basis === "published" ? "Pubblicato" : "Modellato", eur(r.budget), eur(r.actual), eur(r.alternative), r.actual === null ? "Non confrontabile" : signed(cMoneyDifference(r.actual, r.budget))])} />
        </>;
}
/** The wording of the CO count block: the scale's caption, the unit after each row's ratio, and the exact table's
 * headers. The default is the ratio wording for every reader (1.2b), a ratio to the estimated count and never a
 * per-person unit (review finding F-UI3-RES); it equals the countsLabels of the organisation-scoped copy, which the
 * organisation-scoped workspace still passes; the strings are literal because this file imports nothing from the
 * scoped vocabulary. */
export type CCountLabels = { scale: string; unit: string; headers: readonly [string, string, string, string, string, string] };
const C_REVIEW_COUNT_LABELS: CCountLabels = {
  scale: "€ per unità di numerosità stimata · scenario",
  unit: " per unità di numerosità stimata",
  headers: ["Portafoglio", "Numerosità base stimata", "Spesa CO attribuita tramite portafoglio", "€ per unità · numerosità ridotta del 25%", "€ per unità · numerosità di riferimento", "€ per unità · numerosità aumentata del 25%"],
};
/** The calculated CO scenarios on one common scale, with the ±25% denominator range. */
export function CountRows({ countRows, labels = C_REVIEW_COUNT_LABELS }: { countRows: CountRow[]; labels?: CCountLabels }) {
  const countValues = countRows.flatMap((r) => [Number(r.lowCountCost), Number(r.highCountCost), Number(r.perPerson)]);
  const countMin = Math.min(0, ...countValues), countMax = Math.max(1, ...countValues);
  const countPosition = (n: number) => (n - countMin) / (countMax - countMin) * 100;
  return <><div className="mb-3 flex justify-between gap-3 text-[10px] tabular-nums text-muted-foreground" aria-hidden="true"><span>{eur(countMin)}</span><span>{labels.scale}</span><span>{eur(countMax)}</span></div><div className="space-y-4">{countRows.map((r) => <div key={r.portfolio}>
          <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs"><span className="font-semibold">{r.portfolio}</span><span className="tabular-nums">{`${eur(r.perPerson)}${labels.unit}`}</span></div>
          <div className="relative h-5 rounded bg-secondary" aria-hidden="true">
            {countMin < 0 && <span className="absolute top-0 h-5 border-l border-border" style={{ left: `${countPosition(0)}%` }} />}
            <span className="absolute top-2 h-1 bg-primary/35" style={{ left: `${countPosition(Math.min(Number(r.highCountCost), Number(r.lowCountCost)))}%`, width: `${Math.abs(Number(r.lowCountCost) - Number(r.highCountCost)) / (countMax - countMin) * 100}%` }} />
            <span className="absolute top-1 size-3 rounded-full border-2 border-card bg-primary" style={{ left: `calc(${countPosition(Number(r.perPerson))}% - 6px)` }} />
          </div>
        </div>)}</div><ExactTable caption="Numerosità e sensibilità del denominatore" headers={[...labels.headers]} rows={countRows.map((r) => [r.portfolio, fmt(Number(r.persons)), eur(r.spend), eur(r.lowCountCost), eur(r.perPerson), eur(r.highCountCost)])} /></>;
}
export { Panel as CReviewPanel, Heading as CReviewHeading, ExactTable as CReviewExactTable, Empty as CReviewEmpty };
export const C_REVIEW_UI = { selectClass, actionClass, monthNames } as const;
