// Pillar B review page.
//
// AUTHENTICATION is enforced by app/dashboard-review/layout.tsx, which resolves
// the caller's approved organisation and renders the access portal instead of
// any child when there is none. ASL isolation on top of that is enforced by
// row-level security on `canonical_fact`: every RPC this page calls is
// SECURITY INVOKER, so each caller sees only the ASLs their membership allows.
// Nothing here filters by organisation itself, and nothing here may start to —
// a filter in application code would be a second, divergent source of truth.

import { EmptyState, PageHeader } from "@/components/dashboard-review/analytics-ui";
import { PillarBReview } from "@/components/dashboard-review/pillar-b-review";
import {
  channelTrend, concentration, coverageNotices, funnelRows, moleculeTrend, sumSpend,
} from "@/lib/dashboard-review/pillar-b/review-data";
import {
  getEvidenceFunnel, getMoleculeSpend, getSpend, getUptake, getValueUptake,
  pillarBReleaseId,
} from "@/lib/dashboard-review/pillar-b/rpc";
import { PillarBValueUptake } from "@/components/dashboard-review/pillar-b-value-uptake";
import { buildValueUptake, parseFilters } from "@/lib/dashboard-review/pillar-b/value-uptake";

// The content depends entirely on who is asking, so there is no static shell.
export const instant = false;

async function identified<T>(code: string, work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (cause) {
    const dbCode = cause instanceof Error && "dbCode" in cause
      ? String(cause.dbCode).replace(/[^A-Z0-9]/g, "").slice(0, 12)
      : "UNKNOWN";
    throw new Error(`PBR-${code}-${dbCode}`, { cause });
  }
}

export default async function RevisionePillarBPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Filter state lives in the URL and is applied SERVER-SIDE: the query goes to
  // the database with the scope already narrowed, so a browser never receives
  // rows it then filters locally. Combined with RLS that is what keeps an
  // Azienda from holding another Azienda's ledger.
  const filters = parseFilters(await searchParams);
  const releaseId = await pillarBReleaseId();

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

  // 2026 is absent from this list by construction: five months observed and zero
  // comparable-eligible rows. It is described on the page, never totalled.
  //
  // ONLY THE FETCHES ARE GUARDED. JSX is constructed after the try/catch, not
  // inside it: React does not render at construction time, so a render error
  // would escape a catch placed around the markup and the catch would read as
  // protection it does not give. Failures while READING are what this guard is
  // for, and those all happen above.
  let data: {
    spend2024: Awaited<ReturnType<typeof getSpend>>;
    spend2025: Awaited<ReturnType<typeof getSpend>>;
    funnel: Awaited<ReturnType<typeof getEvidenceFunnel>>;
    molecules2024: Awaited<ReturnType<typeof getMoleculeSpend>>;
    molecules2025: Awaited<ReturnType<typeof getMoleculeSpend>>;
    uptake: Awaited<ReturnType<typeof getUptake>>;
    valueUptakeRows: Awaited<ReturnType<typeof getValueUptake>>;
    allSubstances: Awaited<ReturnType<typeof getValueUptake>>;
  };
  try {
    // Six top-level calls at once, plus three inside uptake and molecule
    // pagination, exceeded the database statement timeout under real RLS.
    // Bound concurrency by phase; retain independent, fail-closed RPCs.
    const [spend2024, spend2025, funnel] = await Promise.all([
      identified("SPEND24", getSpend(2024)),
      identified("SPEND25", getSpend(2025)),
      identified("FUNNEL", getEvidenceFunnel(2025)),
    ]);
    const [molecules2024, molecules2025] = await Promise.all([
      identified("MOLECULE24", getMoleculeSpend(2024)),
      identified("MOLECULE25", getMoleculeSpend(2025)),
    ]);
    const uptake = await identified("UPTAKE", getUptake(2025));
    // One row per substance, so this is bounded and needs no paging. Fetched
    // unfiltered once for the molecule chooser, and again under the active
    // filters for the figures themselves.
    const [valueUptakeRows, allSubstances] = await Promise.all([
      identified("VALUEUPTAKE", getValueUptake(
        filters.year, filters.channel, filters.substance)),
      identified("VALUESUBST", getValueUptake(null, null, null)),
    ]);
    data = { spend2024, spend2025, funnel, molecules2024, molecules2025,
             uptake, valueUptakeRows, allSubstances };
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

  return <PillarBReview
    releaseId={releaseId}
    funnel={funnelRows(data.funnel)}
    moleculeTrend={moleculeTrend(data.molecules2024, data.molecules2025)}
    channelTrend={channelTrend(data.spend2024, data.spend2025)}
    concentration={concentration(data.molecules2025)}
    uptake={data.uptake}
    notices={coverageNotices(data.spend2025, data.uptake)}
    totals={{
      spend2024: sumSpend(data.spend2024),
      spend2025: sumSpend(data.spend2025),
      rows2024: data.spend2024.reduce((s, r) => s + r.rows_observed, 0),
      rows2025: data.spend2025.reduce((s, r) => s + r.rows_observed, 0),
    }}
    valueUptake={
      <PillarBValueUptake
        view={buildValueUptake(data.valueUptakeRows)}
        filters={filters}
        substanceOptions={data.allSubstances
          .map((r) => r.active_substance)
          .sort((a, b) => a.localeCompare(b, "it"))}
      />
    }
  />;
}
