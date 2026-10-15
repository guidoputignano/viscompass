import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getViewerIdentity } from "@/lib/auth/viewer";
import { getAdminEmail } from "@/lib/auth/admin";
import { canSeePillarCPreview } from "@/lib/dashboard-review/pillar-c/preview";
import { loadCReviewPacket } from "@/lib/dashboard-review/pillar-c/review-loader";
import { PillarCAnalyticalWorkspace } from "@/components/dashboard-review/pillar-c/analytical-workspace";
import { loadCRegionalForecast } from "@/lib/dashboard-review/pillar-c/regional-forecast-loader";
import { PillarCRegionalForecastWorkspace } from "@/components/dashboard-review/pillar-c/regional-forecast-workspace";

export const instant = false;
export const metadata: Metadata = {
  title: "Pillar C · Aree cliniche e budget | VIS",
  robots: { index: false, follow: false },
};

export default async function PillarCPage() {
  // An approved membership is required even for an allow-listed reviewer.
  // No role or real-data flag can be enabled through query parameters.
  const [org, viewer, admin] = await Promise.all([getCurrentOrg(), getViewerIdentity(), getAdminEmail()]);
  const projectReviewer = canSeePillarCPreview(Boolean(org), viewer?.isReviewer ?? false, Boolean(admin));
  if (org && !projectReviewer) {
    // Public-source regional forecast only. Never call the private reviewer
    // loader or forward its packet to an ordinary Azienda/Region member.
    const forecast = await loadCRegionalForecast(true);
    return forecast.state === "ready"
      ? <Suspense fallback={<p role="status">Caricamento della previsione regionale…</p>}><PillarCRegionalForecastWorkspace forecast={forecast.data.forecast} /></Suspense>
      : <section className="rounded-2xl border border-border bg-card p-8"><h1 className="text-2xl font-semibold">Previsione regionale 2026</h1><p role="status" className="mt-3 text-sm text-muted-foreground">La previsione non è disponibile in questo momento. Nessun valore viene sostituito.</p></section>;
  }
  if (!projectReviewer) {
    return <section className="rounded-2xl border border-border bg-card p-8"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Pillar C</p><h1 className="mt-3 text-2xl font-semibold">Aree cliniche e budget · in preparazione</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Le analisi saranno disponibili dopo la validazione del workbook. L’anteprima dell’interfaccia è riservata ai revisori autorizzati.</p></section>;
  }
  const review = await loadCReviewPacket(Boolean(org), Boolean(viewer?.isReviewer || admin));
  if (review.state === "ready") {
    return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Caricamento delle analisi in revisione…</p>}><PillarCAnalyticalWorkspace packet={review.packet} /></Suspense>;
  }
  return <section className="rounded-2xl border border-border bg-card p-6 md:p-8"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Pillar C · Revisione di progetto</p><h1 className="mt-3 text-2xl font-semibold">Il collegamento alle analisi è in preparazione</h1><p role="status" className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{review.state === "invalid" ? "Il pacchetto di revisione non supera i controlli di integrità. I risultati non vengono caricati né sostituiti con esempi." : "I componenti analitici sono pronti per il pacchetto privato di risultati controllati. L’accettazione del workbook e il rilascio per le Aziende restano separati."}</p><div className="mt-6 grid gap-5 md:grid-cols-3">{[["Spesa e variazioni", "Andamento mensile o cumulato e ponte contabile su periodi omogenei."], ["Budget e numerosità", "Due chiavi di allocazione e sensibilità del denominatore CO, con ipotesi esplicite."], ["Controllo del rilascio", "Nessuna previsione o analisi priva dei propri controlli viene attivata dalla presenza di un grafico."]].map(([title, text]) => <div key={title}><h2 className="text-sm font-semibold">{title}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</div></section>;
}
