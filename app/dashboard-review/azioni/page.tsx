import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard-review/analytics-ui";
import { FindingWorkspace } from "@/components/dashboard-review/actions/finding-workspace";

export const metadata: Metadata = {
  title: "Azioni sui risultati | VIS",
  robots: { index: false, follow: false },
};

// The workspace reads its cases from /api/findings after the page arrives, so
// the shell is not held back by the release reads the findings need.
export default function AzioniPage() {
  return (
    <div className="flex w-full flex-col gap-7">
      <PageHeader
        eyebrow="Azioni sui risultati"
        title="Chi esamina ogni risultato, e con quale esito."
        description="Un caso parte da un risultato su una sola Azienda: la spesa di riferimento dopo il primo biosimilare locale, o un costo unitario sopra il prezzo del gruppo per gli stessi prodotti. Chi lo riceve registra la decisione e l’esito. Nessun caso è un risparmio, un obiettivo o un’indicazione prescrittiva."
      />
      <FindingWorkspace />
    </div>
  );
}
