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
  channelTrend, concentration, coverageNotices, funnelRows, moleculeTrend, sumSpend,
} from "@/lib/dashboard-review/pillar-b/review-data";
import {
  getEvidenceFunnel, getFacets, getMoleculeSpend, getSpend, getUptake,
  getValueUptake, getValueUptakeScoped, isMissingFunction, pillarBReleaseId,
  type MoleculeSpendRow, type SpendRow, type UptakeWithWithheld, type ValueUptakeRow,
} from "@/lib/dashboard-review/pillar-b/rpc";
import { buildValueUptake, mergeValueUptakeRows } from "@/lib/dashboard-review/pillar-b/value-uptake";
import {
  channelsArg, describePillarBFilters, parsePillarBFilters, pillarBHref,
  yearsArg, type PillarBFilters,
} from "@/lib/dashboard-review/pillar-b/filters";
import { aslBreakdown, calendarRows, channelMix, perimeterRows, type Facets } from "@/lib/dashboard-review/pillar-b/facets";
import {
  distinctUptakeGroups, distinctWithheldGroups, dumbbellRows, timelineModel, volumeBreakdown,
} from "@/lib/dashboard-review/pillar-b/adoption";
import { resolvePillarBScope } from "@/lib/dashboard-review/pillar-b/scope";

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

/** Narrow rows the caller already holds to the selected Azienda and channels. */
function narrow<T extends { asl_code: string; channel: string }>(
  rows: ReadonlyArray<T>, filters: PillarBFilters, aslCode: string | null,
): T[] {
  return rows.filter((r) =>
    (aslCode === null || r.asl_code === aslCode)
    && (filters.channels.length === 0 || (filters.channels as readonly string[]).includes(r.channel)));
}

/**
 * Molecule rows as spend rows.
 *
 * pillar_b_spend groups by (Azienda, channel) and carries no substance, so
 * under a molecule filter the spend totals and the channel trend must come
 * from the molecule rows instead — which group by (substance, Azienda,
 * channel) over the same release rows and carry the same measures. Both sum to
 * the same ledger (asserted in outputs/pillar-b/logs/b39). Using the molecule
 * rows is what makes "i filtri … si applicano" true for the whole section.
 */
function spendLike(rows: ReadonlyArray<MoleculeSpendRow>): SpendRow[] {
  return rows.map((r) => ({
    asl_code: r.asl_code, channel: r.channel, rows_observed: r.rows_n, spend_eur: r.spend_eur,
    rows_basis_packages: r.rows_basis_packages, rows_basis_units: r.rows_basis_units,
    rows_basis_mixed: r.rows_basis_mixed, rows_basis_unknown: r.rows_basis_unknown,
    comparable_rows: r.comparable_rows, comparable_spend_eur: r.comparable_spend_eur,
    negative_rows: r.negative_rows,
  }));
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
  const used = scope?.spend_eur ?? null;
  const denominator = used === null ? null : used + withheldSpendEur;
  return {
    rows, withheld, scope, withheldSpendEur, withheldRows,
    withheldShare: denominator === null || denominator === 0 ? null : withheldSpendEur / denominator,
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
  const filters = parsePillarBFilters(await searchParams, scope.narrowable.map((o) => o.orgCode));
  const narrowed = filters.asl === null ? null : scope.narrowable.find((o) => o.orgCode === filters.asl) ?? null;
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
  let data: {
    spend2024: SpendRow[]; spend2025: SpendRow[];
    funnel: Awaited<ReturnType<typeof getEvidenceFunnel>>;
    molecules2024: MoleculeSpendRow[]; molecules2025: MoleculeSpendRow[];
    uptake: UptakeWithWithheld;
    valueUptakeRows: ValueUptakeRow[];
    allSubstances: ValueUptakeRow[];
    facets: Facets | null;
    calendarFacets: Facets | null;
  };
  try {
    const funnelYear = filters.years.includes(2025) ? 2025 : 2024;
    const [spend2024, spend2025, funnel] = await Promise.all([
      identified("SPEND24", getSpend(db, 2024)),
      identified("SPEND25", getSpend(db, 2025)),
      identified("FUNNEL", getEvidenceFunnel(db, funnelYear)),
    ]);
    const [molecules2024, molecules2025] = await Promise.all([
      identified("MOLECULE24", getMoleculeSpend(db, 2024)),
      identified("MOLECULE25", getMoleculeSpend(db, 2025)),
    ]);
    const uptakeParts = await Promise.all(
      filters.years.map((y) => identified(`UPTAKE${y}`, getUptake(db, y))));
    const uptake = mergeUptake(uptakeParts);

    // The scoped function honours every filter in one call. Until migration
    // 20261003090000 is applied it does not exist; the live function then
    // stands in — one year per call, merged, single channel only — and the
    // page says which filters it could not apply.
    let valueUptakeRows: ValueUptakeRow[];
    let allSubstances: ValueUptakeRow[];
    try {
      // The chooser and the quick picks follow the Azienda selection, so a
      // reader narrowed to one Azienda is offered that Azienda's molecules
      // and that Azienda's "most to decide", not the Region's.
      [valueUptakeRows, allSubstances] = await Promise.all([
        getValueUptakeScoped(db, { years, channels, substance: filters.substance, aslCode }),
        getValueUptakeScoped(db, { years: [2024, 2025], channels: null, substance: null, aslCode }),
      ]);
    } catch (error) {
      if (!isMissingFunction(error)) throw phaseError("VALUEUPTAKE", error);
      fallback = true;
      const single = filters.channels.length === 1 ? filters.channels[0] : null;
      const [perYear, substanceYears] = await Promise.all([
        Promise.all(filters.years.map((y, i) => identified(
          `VALUEUPTAKE${i}`, getValueUptake(db, y, single, filters.substance)))),
        Promise.all([2024, 2025].map((y, i) => identified(
          `VALUESUBST${i}`, getValueUptake(db, y, null, null)))),
      ]);
      valueUptakeRows = mergeValueUptakeRows(...perYear);
      allSubstances = mergeValueUptakeRows(...substanceYears);
      const notApplied = [
        aslCode !== null ? "il filtro per Azienda" : null,
        filters.channels.length > 1 ? "la combinazione di più canali" : null,
      ].filter((s): s is string => s !== null);
      if (notApplied.length > 0) {
        degraded.push(`Adozione in valore: ${notApplied.join(" e ")} non ${notApplied.length > 1 ? "sono stati applicati" : "è stato applicato"} (funzione pillar_b_value_uptake_scoped assente).`);
      }
    }

    let facets: Facets | null = null;
    let calendarFacets: Facets | null = null;
    try {
      [facets, calendarFacets] = await Promise.all([
        getFacets(db, { years, channels, substance: filters.substance, aslCode,
                        facets: ["asl", "channels", "perimeter"] }),
        getFacets(db, { years: [2024, 2025, 2026], channels, substance: filters.substance, aslCode,
                        facets: ["months"] }),
      ]);
    } catch (error) {
      if (!isMissingFunction(error)) throw phaseError("FACETS", error);
      degraded.push("Panorama (calendario mensile, spesa per Azienda e per canale) ed Evidenza (perimetro): non disponibili finché pillar_b_facets non è pubblicata.");
    }

    data = { spend2024, spend2025, funnel, molecules2024, molecules2025, uptake,
             valueUptakeRows, allSubstances, facets, calendarFacets };
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
      hint: `${hintScope} · 2024 e 2025 · tutti i canali: riferimento ${formatEur(r.dateValid.reference)} nei mesi validi, quota biosimilare ${r.dateValid.share === null ? "n/d" : formatPercent(r.dateValid.share)}`,
    }));

  // Spend and molecule rows carry asl_code x channel, so the Azienda and
  // channel selections narrow them on the server before shaping. The substance
  // filter narrows the molecule rows only; a channel trend for one molecule is
  // still a channel trend.
  const m24 = narrow(data.molecules2024, filters, aslCode).filter((r) => filters.substance === null || r.active_substance === filters.substance);
  const m25 = narrow(data.molecules2025, filters, aslCode).filter((r) => filters.substance === null || r.active_substance === filters.substance);
  // Under a molecule filter the spend rows (no substance) cannot be narrowed;
  // the molecule rows carry the same measures and are used instead, so the
  // totals, the channel trend and the coverage notices all honour it.
  const s24 = filters.substance === null ? narrow(data.spend2024, filters, aslCode) : spendLike(m24);
  const s25 = filters.substance === null ? narrow(data.spend2025, filters, aslCode) : spendLike(m25);
  const concentrationYear = filters.years.includes(2025) ? 2025 : 2024;

  // The volume measure's RPCs have no channel predicate and are grouped by
  // (Azienda, substance, route): Azienda and substance narrow the ROWS on the
  // server, channel cannot. The measure's COVERAGE (used spend, withheld share)
  // comes from pillar_b_uptake_scope, which has no Azienda or substance
  // predicate either — so under those filters it is withheld rather than shown
  // beside rows it does not describe. The withheld euros and records ARE
  // recomputed from the narrowed withheld rows.
  const uptakeNarrowed = aslCode !== null || filters.substance !== null;
  const uptakeRows = data.uptake.rows.filter((r) =>
    (aslCode === null || r.asl_code === aslCode)
    && (filters.substance === null || r.active_substance === filters.substance));
  const uptakeWithheld = data.uptake.withheld.filter((r) =>
    (aslCode === null || r.asl_code === aslCode)
    && (filters.substance === null || r.active_substance === filters.substance));
  const uptakeForView: UptakeWithWithheld = uptakeNarrowed
    ? {
        rows: uptakeRows,
        withheld: uptakeWithheld,
        scope: null,
        withheldShare: null,
        withheldSpendEur: uptakeWithheld.reduce((s, w) => s + (w.spend_eur ?? 0), 0),
        withheldRows: uptakeWithheld.reduce((s, w) => s + w.rows_n, 0),
      }
    : data.uptake;
  const adoptionNotes: string[] = [];
  if (filters.channels.length > 0) {
    adoptionNotes.push("Il filtro per canale non si applica alla misura in volume, che non distingue il canale.");
  }
  if (uptakeNarrowed) {
    adoptionNotes.push(
      "Con un filtro per Azienda o molecola la copertura della misura (spesa utilizzata e quota trattenuta) " +
      "non è disponibile: il database la calcola sull'intero perimetro visibile. I gruppi, la spesa " +
      "trattenuta e i record qui sotto sono invece quelli del perimetro selezionato.");
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
        aziende={scope.narrowable.map((o) => ({ orgCode: o.orgCode, label: o.label }))}
        substances={substanceOptions}
        quickPicks={quickPicks}
        scopeLine={scopeLine}
        recordCount={view.perimeterRows}
        recordCountScope={vuScopeLine === scopeLine ? null : vuScopeLine}
        partialYear={PARTIAL_YEAR}
      />
    }
    degraded={degraded}
    years={filters.years}
    panorama={{
      totals: data.facets?.totals ?? null,
      valueUptake: view,
      valueUptakeScope: vuScopeLine === scopeLine ? null : vuScopeLine,
      calendar: data.calendarFacets?.months ? calendarRows(data.calendarFacets.months) : null,
      azienda: data.facets?.asl ? aslBreakdown(data.facets.asl, aslLabel) : null,
      channels: data.facets?.channelsByYear ? channelMix(data.facets.channelsByYear) : null,
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
        />
      ),
      uptake: uptakeForView,
      groupCount: distinctUptakeGroups(uptakeRows),
      withheldGroupCount: distinctWithheldGroups(uptakeWithheld),
      volume: volumeBreakdown(uptakeRows),
      notes: adoptionNotes,
    }}
    spend={{
      moleculeTrend: moleculeTrend(m24, m25),
      channelTrend: channelTrend(s24, s25),
      concentration: concentration(concentrationYear === 2025 ? m25 : m24),
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
      perimeter: data.facets?.perimeter ? perimeterRows(data.facets.perimeter) : null,
    }}
    notices={coverageNotices(yearsSpend, uptakeForView)}
  />;
}
