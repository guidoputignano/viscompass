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
  const [spend2024, spend2025, molecules2024, molecules2025, funnel, uptake] =
    await Promise.all([
      getSpend(2024),
      getSpend(2025),
      getMoleculeSpend(2024),
      getMoleculeSpend(2025),
      getEvidenceFunnel(2025),
      getUptake(2025),
    ]);

  return (
    <PillarBReview
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
    />
  );
}
