// Pillar B review page.
//
// AUTHENTICATION is enforced by app/dashboard-review/layout.tsx, which resolves
// the caller's approved organisation and renders the access portal instead of
// any child when there is none.
//
// SCOPE is decided in exactly one place, lib/dashboard-review/pillar-b/scope.ts,
// which mirrors the private Pillar A decision: an Azienda reads itself under
// RLS, a Regione reads its Aziende under RLS, and an allow-listed platform
// reviewer reads every Azienda in the release through the service-role client.
// Every RPC on this page is SECURITY INVOKER and receives the client that
// decision picked. Nothing here filters by organisation itself; the one
// server-side narrowing (the Azienda selector) is applied to rows the caller
// is already allowed to see, and goes to the database as a predicate under
// RLS where the function supports it.
//
// FILTERS live in the URL and are applied server-side. The browser never
// receives rows it then narrows locally.

import { EmptyState, PageHeader } from "@/components/dashboard-review/analytics-ui";
import { formatEur, formatPercent } from "@/lib/dashboard-review/format";
import { PillarBReview } from "@/components/dashboard-review/pillar-b-review";
import { PillarBFilterBar } from "@/components/dashboard-review/pillar-b-filter-bar";
import { PillarBValueUptake } from "@/components/dashboard-review/pillar-b-value-uptake";
import {
  channelTrend, concentration, coverageNotices, funnelRows, moleculeTrend, narrowRows, spendLike, sumSpend, uptakeCoverage,
} from "@/lib/dashboard-review/pillar-b/review-data";
import {
  getEvidenceFunnel, getFacets, getMoleculeSpend, getSpend, getUptake, getUptakeCoverage,
  getValueUptake, getValueUptakeScoped, isMissingFunction, pillarBActiveRelease, pillarBReleaseId, readActiveRelease,
  type MoleculeSpendRow, type SpendRow, type UptakeCoverageRow, type UptakeRow, type UptakeScope,
  type UptakeWithWithheld, type ValueUptakeRow, type WithheldRow,
} from "@/lib/dashboard-review/pillar-b/rpc";
import { buildValueUptake, mergeValueUptakeRows } from "@/lib/dashboard-review/pillar-b/value-uptake";
import {
  aziendaKeys, channelsArg, describePillarBFilters, parsePillarBFilters, pillarBHref, yearsArg, type PillarBFilters,
} from "@/lib/dashboard-review/pillar-b/filters";
import { aslBreakdown, aziendaPanelRows, calendarRows, channelMix, emptySelectionHint, perimeterRows, regionalComparatorAllowed, type Facets } from "@/lib/dashboard-review/pillar-b/facets";
import {
  distinctUptakeGroups, distinctWithheldGroups, dumbbellRows, timelineModel, volumeBreakdown, volumePanelRows,
} from "@/lib/dashboard-review/pillar-b/adoption";
import {
  localOptionParams, parseViewOptions, perimeterOnly, routeOptions, slimConcentration, sortTrend,
  type ConcentrationYear, type PerimeterMode, type TrendOrder,
} from "@/lib/dashboard-review/pillar-b/view-options";
import { resolvePillarBScope } from "@/lib/dashboard-review/pillar-b/scope";
import { pillarBCacheKey, pillarBServerCache } from "@/lib/dashboard-review/pillar-b/server-cache";
import { bridgeB, bridgeBPerimeterCheck, bridgeBPublishable } from "@/lib/dashboard-review/pillar-b/bridge-b";
import { reviewQueue, reviewQueuePublishable } from "@/lib/dashboard-review/pillar-b/review-queue";

const BASE = "/dashboard-review/revisione-pillar-b";

/** The release's observed window, for the timeline axis: 2024-01 .. 2026-05. */
const RELEASE_WINDOW = { fromKey: 2024 * 12 + 1, toKey: 2026 * 12 + 5 };
const PARTIAL_YEAR = { year: 2026, months: 5 };

// The content depends entirely on who is asking, so there is no static shell.
export const instant = false;

/** A stable phase code for the reader; the full cause stays in the server log. */
function phaseError(code: string, cause: unknown): Error {
  const dbCode = cause instanceof Error && "dbCode" in cause
    ? String(cause.dbCode).replace(/[^A-Z0-9]/g, "").slice(0, 12)
    : "UNKNOWN";
  return new Error(`PBR-${code}-${dbCode}`, { cause });
}

async function identified<T>(code: string, work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (cause) {
    throw phaseError(code, cause);
  }
}

function mergeUptake(parts: ReadonlyArray<UptakeWithWithheld>): UptakeWithWithheld {
  const rows = parts.flatMap((p) => p.rows);
  const withheld = parts.flatMap((p) => p.withheld);
  const scopes = parts.map((p) => p.scope).filter((s): s is NonNullable<typeof s> => s !== null);
  const scope = scopes.length === 0 ? null : scopes.reduce((a, b) => ({
    rows_n: a.rows_n + b.rows_n,
    spend_eur: a.spend_eur === null && b.spend_eur === null ? null : (a.spend_eur ?? 0) + (b.spend_eur ?? 0),
    rows_basis_packages: a.rows_basis_packages + b.rows_basis_packages,
    rows_basis_units: a.rows_basis_units + b.rows_basis_units,
    rows_basis_mixed: a.rows_basis_mixed + b.rows_basis_mixed,
    rows_basis_unknown: a.rows_basis_unknown + b.rows_basis_unknown,
  }));
  const withheldSpendEur = withheld.reduce((s, w) => s + (w.spend_eur ?? 0), 0);
  const withheldRows = withheld.reduce((s, w) => s + w.rows_n, 0);
  // scope = used + withheld; the share is formed in ONE place (uptakeCoverage).
  const coverage = uptakeCoverage(scope?.spend_eur ?? null, withheldSpendEur);
  return {
    rows, withheld, scope, withheldSpendEur, withheldRows,
    usedSpendEur: coverage.usedSpendEur, withheldShare: coverage.withheldShare,
  };
}

/** Sum one year's coverage rows into the shape the view expects. */
function coverageToUptake(
  parts: ReadonlyArray<UptakeCoverageRow>, rows: UptakeRow[], withheld: WithheldRow[],
): UptakeWithWithheld {
  const scope: UptakeScope = parts.reduce((a, c) => ({
    rows_n: a.rows_n + c.rows_n,
    spend_eur: a.spend_eur === null && c.spend_eur === null ? null : (a.spend_eur ?? 0) + (c.spend_eur ?? 0),
    rows_basis_packages: a.rows_basis_packages + c.rows_basis_packages,
    rows_basis_units: a.rows_basis_units + c.rows_basis_units,
    rows_basis_mixed: a.rows_basis_mixed + c.rows_basis_mixed,
    rows_basis_unknown: a.rows_basis_unknown + c.rows_basis_unknown,
  }), { rows_n: 0, spend_eur: null as number | null, rows_basis_packages: 0, rows_basis_units: 0,
        rows_basis_mixed: 0, rows_basis_unknown: 0 });
  const withheldSpendEur = parts.reduce((s, c) => s + (c.withheld_spend_eur ?? 0), 0);
  const withheldRows = parts.reduce((s, c) => s + c.withheld_rows, 0);
  const coverage = uptakeCoverage(scope.spend_eur, withheldSpendEur);
  return {
    rows, withheld, scope, withheldSpendEur, withheldRows,
    usedSpendEur: coverage.usedSpendEur, withheldShare: coverage.withheldShare,
  };
}

export default async function RevisionePillarBPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await resolvePillarBScope();
  if (!scope) {
    return <EmptyState title="Nessun perimetro" detail="Nessuna organizzazione approvata è associata a questo account." />;
  }
  const db = scope.db;
  const params = await searchParams;
  // `ambito` carries an org code only for a reviewer (real names); for
  // everyone else an opaque slug of the pseudonym they see. The server maps it
  // back; no org code reaches a pseudonymised viewer's page.
  const aziendaKey = aziendaKeys(scope.narrowable, scope.showRealNames && scope.allOrganizations);
  const filters = parsePillarBFilters(params, [...aziendaKey.values()]);
  const narrowed = filters.asl === null ? null : scope.narrowable.find((o) => aziendaKey.get(o.orgCode) === filters.asl) ?? null;
  const aslCode = narrowed?.aslCode ?? null;
  const releaseId = await pillarBReleaseId(db);

  // FAIL CLOSED. No active release means nothing has been published for review —
  // which is not the same as "no activity", and must not render as empty tables
  // full of zeroes.
  if (releaseId === null) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Pillar B · biosimilari ed esclusività"
          title="Biosimilari: evidenza, adozione e spesa"
          description="Spesa e adozione osservate sul perimetro autorizzato. Le date di esclusività legale non sono ancora certificate."
        />
        <EmptyState
          title="Nessuna release attiva"
          detail={
            "I dati Pillar B non sono ancora pubblicati per la revisione. La pagina " +
            "non mostra cifre finché una release non viene attivata: un totale pari a " +
            "zero non è la stessa cosa di un dato non disponibile."
          }
        />
      </div>
    );
  }

  // ONLY THE FETCHES ARE GUARDED. JSX is constructed after the try/catch, not
  // inside it: React does not render at construction time, so a render error
  // would escape a catch placed around the markup and the catch would read as
  // protection it does not give.
  const years = yearsArg(filters);
  const channels = channelsArg(filters);
  const degraded: string[] = [];
  // True once the value-uptake figures came from the live one-year function
  // rather than the scoped one. Every label that would otherwise attribute
  // those figures to the selected Azienda or channel set is keyed on this.
  let fallback = false;
  // The volume measure's rows are narrowed server-side by Azienda and substance;
  // its COVERAGE needs the dedicated RPC (migration 20261003130000) to follow.
  const uptakeNarrowed = aslCode !== null || filters.substance !== null;
  let data: {
    spend2024: SpendRow[]; spend2025: SpendRow[];
    funnel: Awaited<ReturnType<typeof getEvidenceFunnel>>;
    molecules2024: MoleculeSpendRow[]; molecules2025: MoleculeSpendRow[];
    uptake: UptakeWithWithheld;
    /** Per selected year, narrowed; null when not narrowed or not yet deployed. */
    coverage: UptakeCoverageRow[] | null;
    valueUptakeRows: ValueUptakeRow[];
    allSubstances: ValueUptakeRow[];
    facets: Facets | null;
    calendarFacets: Facets | null;
    regionalFacets: Facets | null;
  };
  // FILTER-INDEPENDENT READS ARE SHARED across requests of the same scope and
  // release (server-cache.ts): they were ~5.4 s of the ~6.6 s of statements a
  // render ran, recomputed on every click. A scope the cache cannot identify
  // reads fresh every time. A loaded value is kept only if the active release
  // is still the one in its key: the RPCs resolve the release themselves, so
  // rows read during a switch could otherwise sit under the old id.
  // The key carries the release's activation stamp, not only its id: a
  // release taken down and put back under the same id is a new release here.
  const releaseStamp = (await pillarBActiveRelease(db))?.stamp ?? null;
  const shared = <T,>(load: () => Promise<T>, ...parts: Array<string | number | null>): Promise<T> =>
    scope.cacheScope === null || releaseStamp === null
      ? load()
      : pillarBServerCache.get(pillarBCacheKey(scope.cacheScope, releaseStamp, ...parts), load, {
          keep: async () => (await readActiveRelease(db))?.stamp === releaseStamp,
        });

  try {
    const funnelYear = filters.years.includes(2025) ? 2025 : 2024;

    // TWO WAVES, NOT A CHAIN. Measured live as a reviewer, the previous five
    // serial awaits took 15.0 s for a page whose longest single statement is
    // ~5 s. Nothing below consumes another call's result, so the independent
    // calls are issued together. The two Region-scale molecule aggregates stay
    // in a wave of their own: they are the statements nearest the
    // `authenticated` role's 8 s statement_timeout, and sharing CPU with eight
    // other statements is how a 5 s statement becomes a 9 s one. Everything
    // light (spend, funnel, uptake, scoped uptake, facets — each well under
    // 2 s) runs concurrently in the second wave.
    const [molecules2024, molecules2025] = await Promise.all([
      identified("MOLECULE24", shared(() => getMoleculeSpend(db, 2024), "molecules", 2024)),
      identified("MOLECULE25", shared(() => getMoleculeSpend(db, 2025), "molecules", 2025)),
    ]);

    // The scoped function honours every filter in one call. Until migration
    // 20261003090000 is applied it does not exist; the live function then
    // stands in — one year per call, merged, single channel only — and the
    // page says which filters it could not apply.
    // Each closure returns its outcome; the outer scope records it after the
    // await. (Reassigning an outer binding from inside the closure is what the
    // React compiler's immutability rule rejects.)
    const valueUptakeWork = (async (): Promise<{
      rows: ValueUptakeRow[]; substances: ValueUptakeRow[]; fallback: boolean; notice: string | null;
    }> => {
      try {
        // The chooser and the quick picks follow the Azienda selection, so a
        // reader narrowed to one Azienda is offered that Azienda's molecules
        // and that Azienda's "most to decide", not the Region's.
        const [rows, substances] = await Promise.all([
          getValueUptakeScoped(db, { years, channels, substance: filters.substance, aslCode }),
          // The substance list follows the Azienda only: shared per Azienda.
          shared(() => getValueUptakeScoped(db, { years: [2024, 2025], channels: null, substance: null, aslCode }), "substances", aslCode),
        ]);
        return { rows, substances, fallback: false, notice: null };
      } catch (error) {
        if (!isMissingFunction(error)) throw phaseError("VALUEUPTAKE", error);
        const single = filters.channels.length === 1 ? filters.channels[0] : null;
        const [perYear, substanceYears] = await Promise.all([
          Promise.all(filters.years.map((y, i) => identified(
            `VALUEUPTAKE${i}`, getValueUptake(db, y, single, filters.substance)))),
          Promise.all([2024, 2025].map((y, i) => identified(
            `VALUESUBST${i}`, getValueUptake(db, y, null, null)))),
        ]);
        const notApplied = [
          aslCode !== null ? "il filtro per Azienda" : null,
          filters.channels.length > 1 ? "la combinazione di più canali" : null,
        ].filter((s): s is string => s !== null);
        return {
          rows: mergeValueUptakeRows(...perYear),
          substances: mergeValueUptakeRows(...substanceYears),
          fallback: true,
          notice: notApplied.length > 0
            ? `Adozione in valore: ${notApplied.join(" e ")} non ${notApplied.length > 1 ? "sono stati applicati" : "è stato applicato"}: la funzione del database che li applica non è ancora pubblicata.`
            : null,
        };
      }
    })();

    // THE REGIONAL CHANNEL COMPARATOR (PB-V5-01): only for a viewer whose
    // authorised scope holds several Aziende and who selected one. The same
    // facets function without the Azienda predicate, under the SAME client:
    // for a Regione that is RLS over its Aziende, for a reviewer the widened
    // release. An Azienda account never makes this call.
    const comparatorAllowed = regionalComparatorAllowed({ scopeAziende: scope.narrowable.length, aziendaSelected: aslCode !== null });
    // OPTIONAL, so its own failure (a timeout, say) removes only the regional
    // bar and says so; it never turns the whole page into an error.
    const regionalWork: Promise<Facets | null> = comparatorAllowed
      ? getFacets(db, { years, channels, substance: filters.substance, aslCode: null, facets: ["channels"] })
          .catch((error) => { console.error("Pillar B regional comparator failed", error); return null; })
      : Promise.resolve(null);
    const facetsWork = (async (): Promise<{ facets: Facets | null; calendar: Facets | null; regional: Facets | null; notice: string | null }> => {
      try {
        const [facets, calendar, regional] = await Promise.all([
          getFacets(db, { years, channels, substance: filters.substance, aslCode,
                          facets: ["asl", "channels", "perimeter"] }),
          getFacets(db, { years: [2024, 2025, 2026], channels, substance: filters.substance, aslCode,
                          facets: ["months"] }),
          regionalWork,
        ]);
        return { facets, calendar, regional, notice: null };
      } catch (error) {
        if (!isMissingFunction(error)) throw phaseError("FACETS", error);
        return {
          facets: null, calendar: null, regional: null,
          notice: "Panorama (calendario mensile, spesa per Azienda e per canale) ed Evidenza (perimetro): non disponibili finché la funzione del database che li calcola non è pubblicata.",
        };
      }
    })();

    // Narrowed coverage of the volume measure: one call per selected year.
    // Absent until its migration is applied; the page then withholds the
    // coverage under these filters and says so, rather than showing the
    // whole perimeter's figure beside narrowed rows.
    const coverageWork = (async (): Promise<UptakeCoverageRow[] | null> => {
      if (!uptakeNarrowed) return null;
      try {
        return await Promise.all(filters.years.map((y) =>
          getUptakeCoverage(db, y, aslCode, filters.substance)));
      } catch (error) {
        if (!isMissingFunction(error)) throw phaseError("COVERAGE", error);
        return null;
      }
    })();

    const [spend2024, spend2025, funnel, uptakeParts, valueOutcome, facetsOutcome, coverage] =
      await Promise.all([
        identified("SPEND24", shared(() => getSpend(db, 2024), "spend", 2024)),
        identified("SPEND25", shared(() => getSpend(db, 2025), "spend", 2025)),
        identified("FUNNEL", shared(() => getEvidenceFunnel(db, funnelYear), "funnel", funnelYear)),
        Promise.all(filters.years.map((y) => identified(`UPTAKE${y}`, shared(() => getUptake(db, y), "uptake", y)))),
        valueUptakeWork,
        facetsWork,
        coverageWork,
      ]);
    const uptake = mergeUptake(uptakeParts);
    fallback = valueOutcome.fallback;
    if (valueOutcome.notice) degraded.push(valueOutcome.notice);
    if (facetsOutcome.notice) degraded.push(facetsOutcome.notice);

    data = { spend2024, spend2025, funnel, molecules2024, molecules2025, uptake, coverage,
             valueUptakeRows: valueOutcome.rows, allSubstances: valueOutcome.substances,
             facets: facetsOutcome.facets, calendarFacets: facetsOutcome.calendar, regionalFacets: facetsOutcome.regional };
  } catch (error) {
    // The server log retains the full cause. The scoped browser gets only a
    // stable phase code, never a SQL message or a misleading zero-valued chart.
    console.error("Pillar B review failed", error);
    const code = error instanceof Error && /^PBR-[A-Z0-9-]+$/.test(error.message)
      ? error.message
      : "PBR-SHAPE";
    return <EmptyState
      title="Analisi non disponibile"
      detail={`La release è attiva, ma una verifica è fallita (${code}). Nessuna cifra viene mostrata finché il problema non è risolto.`}
    />;
  }

  // ------------------------------------------------------------ view models
  const view = buildValueUptake(data.valueUptakeRows);

  // THE PARTIAL YEAR AS OBSERVED UNDER THE ACTIVE FILTERS, not a constant.
  // A molecule or channel may have 2026 records in fewer than five months, or
  // in none, and the calendar row says what it found; the filter bar's pill
  // must say the same thing. Without the facets the release-wide fact stands.
  const calendar = data.calendarFacets?.months ? calendarRows(data.calendarFacets.months) : null;
  const partialRow = calendar?.find((r) => r.year === PARTIAL_YEAR.year) ?? null;
  const partialYear = calendar === null
    ? { ...PARTIAL_YEAR, inCalendar: false }
    : partialRow === null || partialRow.monthsObserved === 0 ? null : { year: PARTIAL_YEAR.year, months: partialRow.monthsObserved, inCalendar: true };

  // "12 mesi osservati" is a fact about the RELEASE, not about every filter
  // state: a molecule or channel can leave months with no record. The labels
  // therefore count the months the calendar actually found under the active
  // filters, and fall back to the release-wide statement only without facets.
  const observed = (y: number): number | null =>
    calendar === null ? null : (calendar.find((r) => r.year === y)?.monthsObserved ?? 0);
  const monthsPhrase = (ys: ReadonlyArray<number>): string => {
    const counts = ys.map(observed);
    if (counts.some((c) => c === null)) return ys.length === 2 ? "12 mesi osservati ciascuno" : "12 mesi osservati";
    return counts.length === 2 ? `${counts[0]} e ${counts[1]} mesi osservati` : `${counts[0]} mesi osservati`;
  };
  const periodLabel = `${filters.years.length === 2 ? "2024 e 2025" : String(filters.years[0])} · ${monthsPhrase(filters.years)}`;
  const comparisonLabel = `2024 e 2025 · ${monthsPhrase([2024, 2025])}`;

  // WHAT THE VALUE-UPTAKE FIGURES ACTUALLY COVER. In the fallback the live
  // function cannot narrow by Azienda and takes at most one channel, so the
  // figures are wider than the page's scope line. Every label fed by `view`
  // names THIS scope, never the page's, so a reader narrowed to an Azienda is
  // not shown the Region's share under the Azienda's name.
  const vuAziendaApplied = !fallback || aslCode === null;
  const vuFilters: PillarBFilters = fallback
    ? { ...filters, asl: null, channels: filters.channels.length === 1 ? filters.channels : [] }
    : filters;
  const vuScopeLine = describePillarBFilters(vuFilters, vuAziendaApplied ? (narrowed?.label ?? null) : null);
  const vuUnappliedFilters = [
    aslCode !== null && !vuAziendaApplied ? "il filtro per Azienda" : null,
    fallback && filters.channels.length > 1 ? "la combinazione di più canali" : null,
  ].filter((item): item is string => item !== null);

  const substanceOptions = data.allSubstances.map((r) => r.active_substance).sort((a, b) => a.localeCompare(b, "it"));
  // "Where there is most to decide": the largest reference spend in date-valid
  // months, i.e. the money an authorised alternative could have moved. The
  // chooser rows follow the Azienda only on the scoped path; the hint says
  // which perimeter its figures belong to.
  const hintScope = vuAziendaApplied ? (narrowed?.label ?? "intero perimetro visibile") : "intero perimetro visibile";
  const quickPicks = buildValueUptake(data.allSubstances).rows
    .filter((r) => r.dateValid.reference > 0)
    .sort((a, b) => b.dateValid.reference - a.dateValid.reference)
    .slice(0, 6)
    .map((r) => ({
      substance: r.substance,
      hint: `${hintScope} · 2024 e 2025 · tutti i canali: riferimento ${formatEur(r.dateValid.reference)} nei mesi validi${r.dateValid.share === null ? "" : `, quota biosimilare ${formatPercent(r.dateValid.share)}`}`,
    }));

  // Spend and molecule rows carry asl_code x channel, so the Azienda and
  // channel selections narrow them on the server before shaping. The substance
  // filter narrows the molecule rows only; a channel trend for one molecule is
  // still a channel trend.
  const m24 = narrowRows(data.molecules2024, filters.channels, aslCode).filter((r) => filters.substance === null || r.active_substance === filters.substance);
  const m25 = narrowRows(data.molecules2025, filters.channels, aslCode).filter((r) => filters.substance === null || r.active_substance === filters.substance);
  // Under a molecule filter the spend rows (no substance) cannot be narrowed;
  // the molecule rows carry the same measures and are used instead, so the
  // totals, the channel trend and the coverage notices all honour it.
  const s24 = filters.substance === null ? narrowRows(data.spend2024, filters.channels, aslCode) : spendLike(m24);
  const s25 = filters.substance === null ? narrowRows(data.spend2025, filters.channels, aslCode) : spendLike(m25);
  const concentrationYear: ConcentrationYear = filters.years.includes(2025) ? 2025 : 2024;

  // LOCAL VIEW VARIANTS. Every variant a panel can switch to is shaped HERE by
  // the same pure functions the harness reconciles, and sent to the panel
  // already sliced; the browser only chooses among them. The perimeter mode is
  // substance-level (the molecule rows carry no product status) and every
  // label that shows it says so.
  const perimeterSet = new Set(data.allSubstances.map((r) => r.active_substance));
  const trendAll = moleculeTrend(m24, m25);
  const trendPerimeter = perimeterOnly(trendAll, perimeterSet);
  const TREND_SEND = 50;
  // Each row carries the URL that narrows the page to its substance, as a
  // string: the panel is a client component and cannot receive a function.
  // A row that is not one substance (the unresolved entry) gets no link.
  const substanceSet = new Set([...m24, ...m25].map((r) => r.active_substance));
  const withHref = (rows: ReturnType<typeof sortTrend>) => rows.map((r) => ({
    ...r,
    href: substanceSet.has(r.key) && !/non risolt/i.test(r.key) ? pillarBHref(BASE, filters, { substance: r.key }) : null,
  }));
  const trendVariants = Object.fromEntries((["tutto", "biosimilare"] as const).map((mode) => [
    mode,
    Object.fromEntries((["delta", "pct", "spesa"] as const).map((order) => [
      order, withHref(sortTrend(mode === "tutto" ? trendAll : trendPerimeter, order).slice(0, TREND_SEND)),
    ])),
  ])) as Record<PerimeterMode, Record<TrendOrder, ReturnType<typeof sortTrend>>>;
  const trendTotals: Record<PerimeterMode, number> = { tutto: trendAll.length, biosimilare: trendPerimeter.length };
  const inPerimeter = (rows: ReadonlyArray<MoleculeSpendRow>) => rows.filter((r) => perimeterSet.has(r.active_substance));
  const concentrationVariants = {
    tutto: { 2024: slimConcentration(concentration(m24)), 2025: slimConcentration(concentration(m25)) },
    biosimilare: { 2024: slimConcentration(concentration(inPerimeter(m24))), 2025: slimConcentration(concentration(inPerimeter(m25))) },
  } as const;
  // THE EMPTY SET, EXPLAINED. When the selection holds no perimeter row, say
  // where the nearest rows are rather than print a zero: one extra facets call
  // without the channel narrowing, read for the channels and years that do
  // hold the substance (or the Azienda) — the same ledger, under RLS.
  let emptyHint: string | null = null;
  if (view.perimeterRows === 0 && (filters.channels.length > 0 || filters.substance !== null || aslCode !== null)) {
    try {
      const wider = await getFacets(db, { years: [2024, 2025], channels: null, substance: filters.substance, aslCode, facets: ["channels"] });
      const subject = `${filters.substance ?? "il perimetro"}${narrowed ? ` in ${narrowed.label}` : ""}`;
      emptyHint = emptySelectionHint(subject, wider.channelsByYear ?? []);
    } catch {
      emptyHint = null;
    }
  }

  // The volume measure's RPCs have no channel predicate and are grouped by
  // (Azienda, substance, route): Azienda and substance narrow the ROWS on the
  // server, channel cannot. The measure's COVERAGE (used spend, withheld share)
  // comes from pillar_b_uptake_scope, which has no Azienda or substance
  // predicate either — so under those filters it is withheld rather than shown
  // beside rows it does not describe. The withheld euros and records ARE
  // recomputed from the narrowed withheld rows.
  const uptakeRows = data.uptake.rows.filter((r) =>
    (aslCode === null || r.asl_code === aslCode)
    && (filters.substance === null || r.active_substance === filters.substance));
  const uptakeWithheld = data.uptake.withheld.filter((r) =>
    (aslCode === null || r.asl_code === aslCode)
    && (filters.substance === null || r.active_substance === filters.substance));
  // Narrowed: the coverage comes from the dedicated RPC when deployed, with the
  // withheld euros and records of the SAME call so scope = used + withheld
  // holds. Without it, the coverage is withheld (scope null) and the withheld
  // sums come from the narrowed withheld rows. Not narrowed: the year merge.
  const uptakeForView: UptakeWithWithheld = !uptakeNarrowed
    ? data.uptake
    : data.coverage !== null
      ? coverageToUptake(data.coverage, uptakeRows, uptakeWithheld)
      : {
          rows: uptakeRows,
          withheld: uptakeWithheld,
          scope: null,
          usedSpendEur: null,
          withheldShare: null,
          withheldSpendEur: uptakeWithheld.reduce((s, w) => s + (w.spend_eur ?? 0), 0),
          withheldRows: uptakeWithheld.reduce((s, w) => s + w.rows_n, 0),
        };
  const volume = volumeBreakdown(uptakeRows);
  const routes = routeOptions(volume);
  const viewOptions = parseViewOptions(params, routes, concentrationYear);
  const requestSearch = new URLSearchParams(Object.entries(params).flatMap(([k, v]) =>
    v === undefined ? [] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]]));
  const adoptionNotes: string[] = [];
  if (filters.channels.length > 0) {
    adoptionNotes.push("Il filtro per canale non si applica alla misura in volume, che non distingue il canale.");
  }
  if (uptakeNarrowed && data.coverage === null) {
    adoptionNotes.push(
      "Con un filtro per Azienda o molecola la copertura della misura (spesa utilizzata e quota trattenuta) " +
      "non è disponibile finché la funzione del database che la restringe non è pubblicata: oggi è " +
      "calcolata sull'intero perimetro visibile. I gruppi, la spesa trattenuta e i record qui sotto sono " +
      "invece quelli del perimetro selezionato.");
  }

  const aslLabel = (code: string) => scope.aslLabels[code] ?? code;
  const scopeLine = describePillarBFilters(filters, narrowed?.label ?? null);
  const yearsSpend = filters.years.map((y) => (y === 2024 ? s24 : s25)).flat();

  // REMOUNT ON EVERY FILTER CHANGE. A browser that machine-translates the page
  // wraps text nodes in its own elements; React's in-place text updates then
  // miss them while attribute updates still land, and a reader sees new chip
  // highlights above a stale scope line and stale figures. Keying the subtree
  // on the filter state replaces the nodes instead of patching them, so a
  // translated page is re-rendered whole and re-translated.
  const filterKey = pillarBHref(BASE, filters, {});

  const bridgeOutcome = !fallback && data.facets?.totals?.spend_eur != null && view.perimeterRows > 0
    ? (() => {
        const model = bridgeB(view, data.facets!.totals!.spend_eur!);
        return {
          model,
          check: data.facets?.perimeter ? bridgeBPerimeterCheck(model, data.facets.perimeter) : null,
          scopeLabel: scopeLine,
          monthsLabel: monthsPhrase(filters.years),
        };
      })()
    : null;
  const bridgeReady = bridgeOutcome !== null && bridgeBPublishable(bridgeOutcome.model, bridgeOutcome.check);
  const queueOutcome = bridgeReady ? reviewQueue(view) : null;
  // Net credit-note adjustments are audit data, not positive review cases.
  // Preserve the bridge arithmetic and withhold the decision lists as a whole.
  const queueReady = queueOutcome !== null && reviewQueuePublishable(queueOutcome);

  return <PillarBReview
    key={filterKey}
    releaseId={releaseId}
    scope={{
      perimeterLabel: scope.perimeterLabel,
      reviewerScopeUnavailable: scope.reviewerScopeUnavailable,
      allOrganizations: scope.allOrganizations,
      aslLabels: scope.aslLabels,
    }}
    filterBar={
      <PillarBFilterBar
        base={BASE}
        filters={filters}
        aziende={scope.narrowable.map((o) => ({ key: aziendaKey.get(o.orgCode)!, label: o.label }))}
        hasLocalOptions={[...localOptionParams(requestSearch.toString()).keys()].length > 0}
        substances={substanceOptions}
        quickPicks={quickPicks}
        scopeLine={scopeLine}
        recordCount={view.perimeterRows}
        recordCountScope={vuScopeLine === scopeLine ? null : vuScopeLine}
        emptyHint={emptyHint}
        partialYear={partialYear}
      />
    }
    degraded={degraded}
    years={filters.years}
    periodLabel={periodLabel}
    comparisonLabel={comparisonLabel}
    scopeLine={scopeLine}
    panorama={{
      totals: data.facets?.totals ?? null,
      valueUptake: view,
      valueUptakeScope: vuScopeLine === scopeLine ? null : vuScopeLine,
      calendar,
      // Only what the client panel draws: no asl_code beside a pseudonym, no
      // status amounts that a client could divide.
      azienda: data.facets?.asl ? aziendaPanelRows(aslBreakdown(data.facets.asl, aslLabel)) : null,
      aziendaAbsent: data.facets?.asl && aslCode === null && scope.narrowable.length > 1
        ? scope.narrowable.filter((o) => !data.facets!.asl!.some((r) => r.asl_code === o.aslCode)).map((o) => o.label)
        : [],
      channels: data.facets?.channelsByYear ? channelMix(data.facets.channelsByYear) : null,
      channelsComparator: data.regionalFacets?.channelsByYear
        ? { label: `Regione · ${scope.narrowable.length} Aziende`, aziende: scope.narrowable.length, rows: channelMix(data.regionalFacets.channelsByYear) }
        : null,
      channelsSelectedLabel: narrowed?.label ?? null,
      // An Azienda account sees its own mix only: the regional aggregate is
      // made of peers' rows and its disclosure is an open owner decision.
      // Keyed on the account, not on the number of Aziende: a Regione with
      // one Azienda is not "un account aziendale".
      channelsComparatorNote: !scope.regional && !scope.allOrganizations
        ? "Il confronto con la Regione non è disponibile per un account aziendale."
        : regionalComparatorAllowed({ scopeAziende: scope.narrowable.length, aziendaSelected: aslCode !== null }) && data.regionalFacets === null
          ? "Il confronto con la Regione non è disponibile in questo momento: la lettura regionale non è riuscita."
          : null,
    }}
    adoption={{
      valueUptakeSection: (
        <PillarBValueUptake
          view={view}
          dumbbell={dumbbellRows(view)}
          timeline={timelineModel(view, RELEASE_WINDOW)}
          timelineFollowsAzienda={vuAziendaApplied}
          scopeNote={vuScopeLine === scopeLine ? null
            : `Ambito effettivo di questa sezione: ${vuScopeLine}. La funzione attualmente disponibile non applica ${vuUnappliedFilters.join(" né ")}.`}
          substanceHref={(s) => pillarBHref(BASE, filters, { substance: s })}
          resetHref={BASE}
          periodScope={vuScopeLine}
        />
      ),
      // BRIDGE B. The total and the view must come from the SAME filters and
      // years, or B0 would be a difference between two populations. Under the
      // fallback (scoped function missing) the view is wider than the totals,
      // so the bridge is withheld and says why.
      bridge: bridgeOutcome,
      bridgeWithheld: fallback && view.perimeterRows > 0
        ? "Il ponte non è calcolato finché la funzione del database che legge l'adozione sull'ambito selezionato non è pubblicata: senza di essa il totale e le quote non sono letti con certezza sullo stesso ambito."
        : null,
      // THE REVIEW QUEUE follows the bridge: same view, same scope, and only
      // when the bridge itself is shown, so its sums are the bridge's gates.
      reviewQueue: queueReady && queueOutcome
        ? (() => {
            const hrefs = Object.fromEntries([...queueOutcome.afterLocalSwitch, ...queueOutcome.notObservedHere]
              .map((r) => [r.substance, pillarBHref(BASE, filters, { substance: r.substance })]));
            return { ...queueOutcome, hrefs };
          })()
        : null,
      bridgeReady,
      reviewQueueWithheld: bridgeReady && !queueReady
        ? "Le liste di revisione non sono mostrate: almeno una molecola ha una spesa netta di riferimento negativa per rettifiche. Gli importi restano nel ponte di riconciliazione, ma non rappresentano una domanda di revisione positiva."
        : bridgeOutcome !== null && !bridgeReady
          ? "Le domande di revisione non sono mostrate: in questa selezione la riconciliazione del perimetro qui sotto non torna al centesimo, quindi le loro somme non sarebbero verificate."
          : null,
      uptake: uptakeForView,
      groupCount: distinctUptakeGroups(uptakeRows),
      withheldGroupCount: distinctWithheldGroups(uptakeWithheld),
      volume: volumePanelRows(volume),
      routes,
      notes: adoptionNotes,
    }}
    viewOptions={viewOptions}
    spend={{
      channelTrend: channelTrend(s24, s25),
      trendVariants,
      trendTotals,
      concentrationVariants,
      concentrationYear,
      totals: {
        spend2024: sumSpend(s24),
        spend2025: sumSpend(s25),
        rows2024: s24.reduce((s, r) => s + r.rows_observed, 0),
        rows2025: s25.reduce((s, r) => s + r.rows_observed, 0),
      },
    }}
    evidence={{
      funnel: funnelRows(data.funnel),
      funnelYear: filters.years.includes(2025) ? 2025 : 2024,
      funnelIgnoresFilters: aslCode !== null || filters.channels.length > 0 || filters.substance !== null,
      perimeterWithheld: data.facets?.perimeter !== null && data.facets?.perimeter !== undefined && filters.substance !== null,
      // NOT UNDER A MOLECULE FILTER. The composition (PB-V5-04) is
      // biosimilar / (biosimilar + reference) by product status with no
      // validity rule. Across molecules it is shown, labelled as a spend
      // composition and never as adoption; for ONE molecule it would sit
      // beside that molecule's quota 1 and quota 2 and contradict both, a third
      // adoption figure in all but name. Withheld there. Whether the
      // composition stays at all is Guido's decision (tracker, PB-V5-04).
      perimeter: data.facets?.perimeter && filters.substance === null
        ? perimeterRows(data.facets.perimeter) : null,
    }}
    notices={coverageNotices(yearsSpend, uptakeForView)}
  />;
}
