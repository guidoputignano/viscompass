"use client";

/** The DPC view's list of medicines with an average acquisition below 10 € per pack (joint feedback 2, G2-16): the
 * products behind «Confezioni con acquisto medio sotto 10 €», one ASL at a time, first by total service expenditure, with
 * search and a few sort orders. Every amount is the delivered one (integer cents); per-pack values are the row's own
 * amount over its packs. The totals row is the group's, so the list visibly adds up to the service measures. Products
 * dispensed to fewer than 5 assistiti stay in one «others» row. Imports nothing reviewer-only. */
import { useId, useState } from "react";
import { itNumber } from "@/lib/format/it-number";
import { CReviewEmpty as Empty, CReviewPanel as Panel } from "@/components/dashboard-review/pillar-c/review-blocks";
import { C_U10_COPY, type CU10Row, type CU10View } from "@/lib/dashboard-review/pillar-c/under10";

const eur = (cents: number) => itNumber(cents / 100, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: number) => itNumber(v, { maximumFractionDigits: 0 });
const SELECT = "mt-2 h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const NOTE = "text-xs leading-5 text-muted-foreground";
const th = "min-w-[5.5rem] border-b border-border px-2 py-3 text-right align-bottom font-semibold";
const thLeft = "border-b border-border px-2 py-3 text-left align-bottom font-semibold";
const td = "whitespace-nowrap border-b border-border/50 px-2 py-2.5 text-right tabular-nums";
const tdLeft = "border-b border-border/50 px-2 py-2.5 text-left";

export type CU10Sort = "service" | "packs" | "acquisition" | "ingredient";
const SORTS: readonly { value: CU10Sort; label: string }[] = [
  { value: "service", label: "Spesa di servizio, dalla più alta" },
  { value: "packs", label: "Confezioni, dalla più alta" },
  { value: "acquisition", label: "Acquisto medio per confezione, dal più basso" },
  { value: "ingredient", label: "Principio attivo, dalla A alla Z" },
];
const ORDER: Record<CU10Sort, (a: CU10Row, b: CU10Row) => number> = {
  service: (a, b) => b.serviceCents - a.serviceCents || a.aic.localeCompare(b.aic),
  packs: (a, b) => b.packs - a.packs || b.serviceCents - a.serviceCents || a.aic.localeCompare(b.aic),
  acquisition: (a, b) => a.acquisitionCents / a.packs - b.acquisitionCents / b.packs || b.serviceCents - a.serviceCents || a.aic.localeCompare(b.aic),
  ingredient: (a, b) => a.ingredient.localeCompare(b.ingredient, "it") || b.serviceCents - a.serviceCents || a.aic.localeCompare(b.aic),
};
/** Search ignores case and accents, over the medicine, its pack, its active ingredient and its AIC. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function cU10Matches(row: CU10Row, query: string): boolean {
  const q = fold(query.trim());
  return !q || [row.medicine, row.pack, row.ingredient, row.aic].some((v) => fold(v).includes(q));
}

export function PillarCUnder10List({ view, unavailable = false, initial }: { view: CU10View | null; unavailable?: boolean; initial?: { unit?: string; query?: string; sort?: CU10Sort } }) {
  const id = useId();
  const [unitKey, setUnitKey] = useState(initial?.unit ?? "");
  const [query, setQuery] = useState(initial?.query ?? "");
  const [sort, setSort] = useState<CU10Sort>(initial?.sort ?? "service");
  if (!view || !view.units.length) return unavailable ? <Panel title={C_U10_COPY.title}><Empty>{C_U10_COPY.unavailable}</Empty></Panel> : null;
  const unit = view.units.find((u) => u.key === unitKey) ?? view.units[0];
  const { entry } = unit, others = entry.others;
  const rows = entry.rows.filter((r) => cU10Matches(r, query)).sort(ORDER[sort]);
  const searching = query.trim() !== "";
  const controls = <div className="flex flex-wrap gap-4">
    {view.units.length > 1 && <label className="min-w-40 text-xs font-medium text-muted-foreground">ASL<select aria-label="ASL dell’elenco" className={SELECT} value={unit.key} onChange={(e) => setUnitKey(e.target.value)}>{view.units.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}</select></label>}
    <label className="min-w-56 text-xs font-medium text-muted-foreground">Cerca<input type="search" aria-label="Cerca per farmaco, principio attivo o AIC" placeholder="Farmaco, principio attivo o AIC" className={SELECT} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    <label className="min-w-56 text-xs font-medium text-muted-foreground">Ordina per<select aria-label="Ordina l’elenco" className={SELECT} value={sort} onChange={(e) => setSort(e.target.value as CU10Sort)}>{SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
  </div>;
  const t = entry.total;
  return <Panel title={C_U10_COPY.title} description={C_U10_COPY.lead} controls={controls}>
    <div key={`${unit.key}|${sort}|${query}`} data-c-under10={unit.key}>
      <p className="text-sm leading-6" data-c-under10-summary>{`${unit.label}: ${num(t.products)} farmaci (codici AIC) sotto la soglia, ${num(t.packs)} confezioni, spesa di servizio ${eur(t.serviceCents)} e acquisto ${eur(t.acquisitionCents)}.`}</p>
      <p className={`mt-1 ${NOTE}`} role="status">{searching ? `Righe trovate: ${num(rows.length)} di ${num(entry.rows.length)} farmaci elencati. La riga dei farmaci riuniti non entra nella ricerca.` : `Farmaci elencati: ${num(entry.rows.length)}${others ? `; altri ${num(others.products)} riuniti in una riga` : ""}.`}</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[58rem] text-xs" aria-describedby={`${id}-note`}>
        <caption className="sr-only">{`Farmaci con acquisto medio sotto 10 € · ${unit.label} · gennaio 2026`}</caption>
        <thead><tr><th scope="col" className={thLeft}>Principio attivo</th><th scope="col" className={thLeft}>Farmaco e confezione</th><th scope="col" className={thLeft}>AIC</th><th scope="col" className={th}>Confezioni</th><th scope="col" className={th}>Acquisto medio per confezione</th><th scope="col" className={th}>Servizio medio per confezione</th><th scope="col" className={th}>Spesa di servizio</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.aic} data-c-under10-aic={r.aic}>
            <th scope="row" className={`${tdLeft} min-w-[9rem] font-medium`}>{r.ingredient}</th>
            <td className={`${tdLeft} min-w-[18rem]`}><span className="block font-medium">{r.medicine}</span><span className="block text-[11px] leading-4 text-muted-foreground">{r.pack}</span></td>
            <td className={`${tdLeft} tabular-nums`}>{r.aic}</td>
            <td className={td}>{num(r.packs)}</td>
            <td className={td}>{r.acquisitionCents === 0 ? <span data-c-under10-zero><span className="block">{eur(0)}</span><span className="block text-amber-700 dark:text-amber-400">{C_U10_COPY.zero}</span></span> : eur(r.acquisitionCents / r.packs)}</td>
            <td className={td}>{eur(r.serviceCents / r.packs)}</td>
            <td className={td}>{eur(r.serviceCents)}</td>
          </tr>)}
          {!searching && others && <tr data-c-under10-others>
            <th scope="row" colSpan={3} className={`${tdLeft} font-medium`}>{`Altri ${num(others.products)} farmaci, ciascuno erogato a meno di 5 assistiti${others.zeroAcquisition ? ` (di cui ${num(others.zeroAcquisition)} con ${C_U10_COPY.zero})` : ""}`}</th>
            <td className={td}>{num(others.packs)}</td><td className={td}>{eur(others.acquisitionCents / others.packs)}</td><td className={td}>{eur(others.serviceCents / others.packs)}</td><td className={td}>{eur(others.serviceCents)}</td>
          </tr>}
        </tbody>
        {!searching && <tfoot><tr data-c-under10-total>
          <th scope="row" colSpan={3} className="px-2 py-3 text-left font-semibold">{`Totale del gruppo sotto 10 €: ${num(t.products)} farmaci`}</th>
          <td className={`${td} font-semibold`}>{num(t.packs)}</td><td className={`${td} font-semibold`}>{eur(t.acquisitionCents / t.packs)}</td><td className={`${td} font-semibold`}>{eur(t.serviceCents / t.packs)}</td><td className={`${td} font-semibold`}>{eur(t.serviceCents)}</td>
        </tr></tfoot>}
      </table></div>
      {searching && !rows.length && <p className={`mt-3 ${NOTE}`}>Nessun farmaco elencato corrisponde alla ricerca.</p>}
    </div>
    <details id={`${id}-note`} className="mt-5 rounded-xl border border-border"><summary className="cursor-pointer rounded-xl px-4 py-3.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Da dove viene questo dato?</summary>
      <div className="space-y-2 px-4 pb-4 text-xs leading-5 text-muted-foreground">
        <p>Fonte: i flussi DPC riferiti a gennaio 2026, tutte le righe di farmaco dell’ASL. Ogni riga dell’elenco è un codice AIC in una ASL: lo stesso farmaco può comparire in più ASL e più confezioni dello stesso farmaco hanno righe diverse.</p>
        <p>{C_U10_COPY.threshold}</p>
        <p>{C_U10_COPY.others}</p>
        <p>{C_U10_COPY.zeroNote}</p>
        <p>{C_U10_COPY.identity}</p>
        <p>{C_U10_COPY.noAggregate}</p>
      </div>
    </details>
  </Panel>;
}
