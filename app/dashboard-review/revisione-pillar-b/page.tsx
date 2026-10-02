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
  getEvidenceFunnel, getMoleculeSpend, getSpend, getUptake, pillarBReleaseId,
} from "@/lib/dashboard-review/pillar-b/rpc";

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

export default async function RevisionePillarBPage() {
  const releaseId = await pillarBReleaseId();

  // FAIL CLOSED. No active release means nothing has been published for review —
  // which is not the same as "no activity", and must not render as empty tables
  // full of zeroes.
  if (releaseId === null) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Pillar B · revisione"
          title="Evidenza, esclusioni e spesa"
          description="Spesa osservata sul perimetro autorizzato, con le esclusioni dichiarate riga per riga."
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

    return <PillarBReview
      releaseId={releaseId}
      funnel={funnelRows(funnel)}
      moleculeTrend={moleculeTrend(molecules2024, molecules2025)}
      channelTrend={channelTrend(spend2024, spend2025)}
      concentration={concentration(molecules2025)}
      uptake={uptake}
      notices={coverageNotices(spend2025, uptake)}
      totals={{
        spend2024: sumSpend(spend2024),
        spend2025: sumSpend(spend2025),
        rows2024: spend2024.reduce((s, r) => s + r.rows_observed, 0),
        rows2025: spend2025.reduce((s, r) => s + r.rows_observed, 0),
      }}
    />;
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
}
