import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getViewerIdentity } from "@/lib/auth/viewer";
import { getAdminEmail } from "@/lib/auth/admin";
import { canSeePillarCPreview } from "@/lib/dashboard-review/pillar-c/preview";
import { PillarCWorkspace } from "@/components/dashboard-review/pillar-c/workspace";

export const instant = false;
export const metadata: Metadata = {
  title: "Pillar C · Aree cliniche e budget · Anteprima | VIS",
  robots: { index: false, follow: false },
};

export default async function PillarCPage() {
  // An approved membership is required even for an allow-listed reviewer.
  // No role or real-data flag can be enabled through query parameters.
  const [org, viewer, admin] = await Promise.all([getCurrentOrg(), getViewerIdentity(), getAdminEmail()]);
  if (!canSeePillarCPreview(Boolean(org), viewer?.isReviewer ?? false, Boolean(admin))) {
    return <section className="rounded-2xl border border-border bg-card p-8"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Pillar C</p><h1 className="mt-3 text-2xl font-semibold">Aree cliniche e budget · in preparazione</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Le analisi saranno disponibili dopo la validazione del workbook. L’anteprima dell’interfaccia è riservata ai revisori autorizzati.</p></section>;
  }
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Caricamento dell’anteprima Pillar C…</p>}><PillarCWorkspace /></Suspense>;
}
