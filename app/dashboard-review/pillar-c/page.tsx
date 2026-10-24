import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getViewerIdentity } from "@/lib/auth/viewer";
import { getAdminEmail } from "@/lib/auth/admin";
import { canSeePillarCPreview } from "@/lib/dashboard-review/pillar-c/preview";
import { loadCReviewPacket } from "@/lib/dashboard-review/pillar-c/review-loader";
// The reviewer workspace through its dynamic wrapper: the route's entry chunk, which scoped audiences download, never
// carries the reviewer-only modules (review finding UI-4).
import { PillarCAnalyticalWorkspace } from "@/components/dashboard-review/pillar-c/reviewer-workspace";
import { loadCRegionalForecast } from "@/lib/dashboard-review/pillar-c/regional-forecast-loader";
import { PillarCRegionalForecastWorkspace } from "@/components/dashboard-review/pillar-c/regional-forecast-workspace";
import { loadCWorkbookIndex } from "@/lib/dashboard-review/pillar-c/workbook-loader";
import { createClient } from "@/lib/supabase/server";
import { resolvePillarCMemberAudience } from "@/lib/dashboard-review/pillar-c/audience";
import { C_REVIEWER_CLIENT_AUDIENCE, cForecastOnlyNote, isPillarCScopedAudience, toClientAudience, type CClientAudience, type PillarCScopedAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { guardCClientAudience } from "@/lib/dashboard-review/pillar-c/payload-guard";
import { loadCScopedReview } from "@/lib/dashboard-review/pillar-c/scoped-loader";
import { PillarCScopedWorkspace } from "@/components/dashboard-review/pillar-c/scoped-workspace";
import { loadCExtensionReviewer, loadCExtensionScoped } from "@/lib/dashboard-review/pillar-c/extension-loader";
import { loadCRegionalPvm, loadCRegionalReview } from "@/lib/dashboard-review/pillar-c/regional-loader";

export const instant = false;
export const metadata: Metadata = {
  title: "Pillar C · Aree cliniche e budget | VIS",
  robots: { index: false, follow: false },
};

/** The client audience of a scoped member, rebuilt and checked like every other scoped page property. */
function scopedClientAudience(audience: PillarCScopedAudience): CClientAudience | null {
  try { return guardCClientAudience<CClientAudience>(toClientAudience(audience), audience); } catch { return null; }
}

function ForecastUnavailable() {
  return <section className="rounded-2xl border border-border bg-card p-8"><h1 className="text-2xl font-semibold">Previsione regionale 2026</h1><p role="status" className="mt-3 text-sm text-muted-foreground">La previsione non è disponibile in questo momento. Nessun valore viene sostituito.</p></section>;
}

/** Organisation-scoped delivery (Pillar C recommendation 5): the audience's own units only, read under the user's
 * own session so that Storage RLS decides every object; for the Regione also the region-wide objects of the regional
 * folder (regional analytical parity). Never the reviewer loaders, the workbook route or the service role. The public
 * forecast comes through the same projection every approved member receives. */
async function scopedPillarC(audience: PillarCScopedAudience) {
  const db = await createClient(), client = scopedClientAudience(audience);
  // The extension (January 2026 DPC, File F 2025) is read under the same session; labels come from the audience. The
  // Regione (regional analytical parity) also reads its price/quantity/mix object and its review object (modelled
  // budgets, provenance: owner decision of 24 Oct 2026) from the regional folder; an Azienda never.
  const regione = audience.kind === "regione";
  const [review, forecast, extension, pvm, regional] = await Promise.all([loadCScopedReview(audience, db), loadCRegionalForecast(true),
    client ? loadCExtensionScoped(audience, db, (unit) => client.orgs.find((o) => o.key === unit)?.label ?? null) : Promise.resolve({ state: "unavailable" as const }),
    regione ? loadCRegionalPvm(audience, db) : Promise.resolve({ state: "forbidden" as const }),
    regione ? loadCRegionalReview(audience, db) : Promise.resolve({ state: "forbidden" as const })]);
  if (review.state === "ready" && client) {
    // The modelled rows join the unit files' published acts; nothing else in the packet changes.
    const packet = regional.state === "ready" ? { ...review.packet, budgets: [...review.packet.budgets, ...regional.review.budgets] } : review.packet;
    return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Caricamento delle analisi in revisione…</p>}><PillarCScopedWorkspace audience={client} packet={packet} forecast={forecast.state === "ready" ? forecast.data.forecast : null} extension={extension.state === "ready" ? extension.view : null} extensionUnavailable={extension.state !== "ready"} pvmSection={pvm.state === "ready" ? pvm.section : null} provenance={regional.state === "ready" ? regional.review.provenance : null} regionalReviewUnavailable={regione && regional.state !== "ready"} /></Suspense>;
  }
  // An entitled unit that cannot be read is unavailable, never «not entitled», and no value is substituted.
  return <div data-pillar-c-scope={`scoped-${audience.kind}-unavailable`}><p role="status" className="mb-6 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Le analisi di Pillar C per la tua organizzazione non sono disponibili in questo momento. Nessun valore viene sostituito.</p>{forecast.state === "ready"
    ? <Suspense fallback={<p role="status">Caricamento della previsione regionale…</p>}><PillarCRegionalForecastWorkspace forecast={forecast.data.forecast} /></Suspense>
    : <ForecastUnavailable />}</div>;
}

export default async function PillarCPage() {
  // An approved membership is required even for an allow-listed reviewer.
  // No role or real-data flag can be enabled through query parameters.
  const [org, viewer, admin] = await Promise.all([getCurrentOrg(), getViewerIdentity(), getAdminEmail()]);
  const projectReviewer = canSeePillarCPreview(Boolean(org), viewer?.isReviewer ?? false, Boolean(admin));
  if (org && !projectReviewer) {
    // The member's audience is derived from its session: an enabled Azienda or Regione member receives its own
    // units only; everyone else keeps the public forecast. Never call the private reviewer loader or forward its
    // packet to an ordinary Azienda/Region member.
    const audience = await resolvePillarCMemberAudience(org);
    if (isPillarCScopedAudience(audience)) return scopedPillarC(audience);
    const forecast = await loadCRegionalForecast(true);
    // One honest line per reason: an outage is never «not active», and no line promises an activation no decision covers.
    const note = cForecastOnlyNote(audience.kind === "forecast_only" ? audience.reason : "unmapped");
    return <div data-pillar-c-scope="forecast_only"><p role="note" className="mb-6 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{note}</p>{forecast.state === "ready"
      ? <Suspense fallback={<p role="status">Caricamento della previsione regionale…</p>}><PillarCRegionalForecastWorkspace forecast={forecast.data.forecast} /></Suspense>
      : <ForecastUnavailable />}</div>;
  }
  if (!projectReviewer) {
    return <section className="rounded-2xl border border-border bg-card p-8"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Pillar C</p><h1 className="mt-3 text-2xl font-semibold">Aree cliniche e budget · in preparazione</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Le analisi saranno disponibili dopo la validazione del workbook. L’anteprima dell’interfaccia è riservata ai revisori autorizzati.</p></section>;
  }
  const [review, workbook, extension] = await Promise.all([
    loadCReviewPacket(Boolean(org), Boolean(viewer?.isReviewer || admin)),
    loadCWorkbookIndex(Boolean(org), Boolean(viewer?.isReviewer || admin)),
    loadCExtensionReviewer(Boolean(org), Boolean(viewer?.isReviewer || admin)),
  ]);
  if (review.state === "ready") {
    // The audience is mandatory for every Pillar C client component: the reviewer's is passed explicitly.
    return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Caricamento delle analisi in revisione…</p>}><PillarCAnalyticalWorkspace audience={C_REVIEWER_CLIENT_AUDIENCE} packet={review.packet} workbook={workbook.state === "ready" ? workbook.index : undefined} extension={extension.state === "ready" ? extension.view : null} extensionUnavailable={extension.state !== "ready"} /></Suspense>;
  }
  return <section className="rounded-2xl border border-border bg-card p-6 md:p-8"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Pillar C · Revisione di progetto</p><h1 className="mt-3 text-2xl font-semibold">Il collegamento alle analisi è in preparazione</h1><p role="status" className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{review.state === "invalid" ? "Il pacchetto di revisione non supera i controlli di integrità. I risultati non vengono caricati né sostituiti con esempi." : "I componenti analitici sono pronti per il pacchetto privato di risultati controllati. L’accettazione del workbook e il rilascio per le Aziende restano separati."}</p><div className="mt-6 grid gap-5 md:grid-cols-3">{[["Spesa e variazioni", "Andamento mensile o cumulato e ponte contabile su periodi omogenei."], ["Budget e numerosità", "Due chiavi di allocazione e sensibilità del denominatore CO, con ipotesi esplicite."], ["Controllo del rilascio", "Nessuna previsione o analisi priva dei propri controlli viene attivata dalla presenza di un grafico."]].map(([title, text]) => <div key={title}><h2 className="text-sm font-semibold">{title}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</div></section>;
}
