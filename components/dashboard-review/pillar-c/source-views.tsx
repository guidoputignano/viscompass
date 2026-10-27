"use client";

/** Pillar C source views (joint feedback 2, G2-01/G2-02/G2-04): the page shows one source at a time. «Spesa per canale»
 * is the expenditure ledger with its channel selector and the six sections; «Assistiti e servizio DPC» and «File F» are
 * the two flows that count people, each with its own period, organisations and coverage. Shared by the reviewer and the
 * organisation-scoped workspaces: every label arrives from the server-labelled extension view, so nothing here carries
 * an organisation key (tests/pillar-c-scoped-client-graph.test.mjs). */
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { C_SOURCE_LABELS, C_SOURCE_VIEWS, cItalianList, cSourceViewSearch, type CSourceView } from "@/lib/dashboard-review/pillar-c/source-views";
import type { CExtensionView } from "@/lib/dashboard-review/pillar-c/extension";
import { PillarCSectionEmpty } from "@/components/dashboard-review/pillar-c/section-frame";
import { PillarCDpcAttributionEvidence, PillarCFileFMonthly, PillarCFileFPortfolios, PillarCFileFRecipients, PillarCRecipientsSection, PillarCUnitCosts } from "@/components/dashboard-review/pillar-c/extension-sections";

/** The href of a view: this page with the page's validated scope (`scope`, the «Ambito» and channel the workspace
 * resolved for its audience, never a key the address brought in) and only the view changed, identical on the server and
 * in the browser. The click handler keeps every filter of the current address and pushes it without a reload. */
function useViewHref(scope: string) {
  const pathname = usePathname();
  return (v: CSourceView) => `${pathname ?? ""}${cSourceViewSearch(scope, v)}` || "?";
}
function openView(v: CSourceView) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState(null, "", `${window.location.pathname}${cSourceViewSearch(window.location.search, v)}`);
    document.getElementById("c-fonte")?.scrollIntoView({ block: "start" });
  };
}

const link = "inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary";

/** What each flow covers in this view, from the units the server sent: the ASLs with DPC data, and the File F holders. */
export function cSourceCoverage(view: CExtensionView | null): { dpc: string; fileF: string; fileFHeld: boolean } {
  if (!view) return { dpc: "non disponibili", fileF: "non disponibile", fileFHeld: false };
  const asl = view.units.filter((u) => u.key !== "aggregato");
  const aggregate = view.units.find((u) => u.key === "aggregato");
  const held = asl.filter((u) => u.data.fileF), missing = asl.filter((u) => !u.data.fileF);
  return {
    dpc: `${cItalianList(asl.map((u) => u.label))}${aggregate ? ` e ${aggregate.label.charAt(0).toLowerCase()}${aggregate.label.slice(1)}` : ""}`,
    fileF: held.length ? `ricevuto per ${cItalianList(held.map((u) => u.label))}${missing.length ? `; non ricevuto per ${cItalianList(missing.map((u) => u.label))}` : ""}` : `non ricevuto per ${cItalianList(missing.map((u) => u.label))}`,
    fileFHeld: held.length > 0,
  };
}

/** The source selector, above everything else: three links (they work without script too), the current one marked. */
export function PillarCSourceBar({ view, coverage, scope }: { view: CSourceView; coverage: ReturnType<typeof cSourceCoverage>; scope: string }) {
  const detail: Record<CSourceView, string> = {
    spesa: C_SOURCE_LABELS.spesa.source,
    dpc: `${C_SOURCE_LABELS.dpc.source} · ${coverage.dpc}`,
    filef: `${C_SOURCE_LABELS.filef.source} · ${coverage.fileF}`,
  };
  const href = useViewHref(scope);
  return <nav id="c-fonte" aria-label="Fonte dei dati" className="scroll-mt-6 rounded-2xl border border-border bg-card p-2 shadow-sm xl:scroll-mt-36" data-c-source-bar={view}>
    <p className="px-2 pb-2 pt-1 text-xs font-medium text-muted-foreground">Quale fonte vuoi esplorare? Ogni fonte ha il proprio periodo e le proprie organizzazioni.</p>
    <div className="grid gap-2 md:grid-cols-3">
      {C_SOURCE_VIEWS.map((v) => {
        const current = v === view;
        return <a key={v} href={href(v)} onClick={openView(v)} aria-current={current ? "page" : undefined}
          className={cn("flex min-h-11 flex-col justify-center rounded-xl border px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            current ? "border-primary/30 bg-primary text-primary-foreground shadow-sm" : "border-border hover:border-primary/30 hover:bg-primary/[0.05]")}>
          <span className="text-sm font-semibold">{C_SOURCE_LABELS[v].label}</span>
          <span className={cn("mt-0.5 text-xs leading-5", current ? "text-primary-foreground/85" : "text-muted-foreground")}>{detail[v]}</span>
        </a>;
      })}
    </div>
  </nav>;
}

/** A source view's own heading: what it answers, then source · organisations · period, and the data note on demand. */
function SourceHeader({ id, title, question, scope, note }: { id: string; title: string; question: string; scope: string; note: ReactNode }) {
  return <div className="space-y-3">
    <div>
      <h2 id={`${id}-title`} tabIndex={-1} className="text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-primary">{title}</h2>
      <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">{question}</p>
      <p key={scope} className="mt-1 max-w-4xl text-xs leading-5 text-muted-foreground" data-c-source-scope>{scope}</p>
    </div>
    <details className="max-w-4xl rounded-xl border border-border bg-card" data-c-source-note>
      <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Da dove viene questo dato?</summary>
      <div className="space-y-2 px-4 pb-4 text-sm leading-6 text-muted-foreground">{note}</div>
    </details>
  </div>;
}

/** «Spesa per canale», section 2: the ledger counts no people, so the section says where they are counted. */
export function PillarCSourcePointer({ coverage, scope }: { coverage: ReturnType<typeof cSourceCoverage>; scope: string }) {
  const href = useViewHref(scope);
  return <div className="rounded-2xl border border-border bg-card p-5 md:p-6" data-c-source-pointer>
    <p className="max-w-3xl text-sm leading-6">Il registro della spesa non conta le persone. Gli assistiti sono contati solo in due flussi separati, ciascuno con il proprio periodo e le proprie organizzazioni:</p>
    <ul className="mt-3 space-y-1 text-sm leading-6">
      <li><a href={href("dpc")} onClick={openView("dpc")} className={link}>Assistiti e servizio DPC</a>{` · flussi DPC riferiti a gennaio 2026 · ${coverage.dpc}`}</li>
      <li><a href={href("filef")} onClick={openView("filef")} className={link}>File F</a>{` · anno 2025 · ${coverage.fileF}`}</li>
    </ul>
  </div>;
}

/** In a ledger section, the line that says which view now holds the flows' own analyses that used to sit there. */
export function PillarCSourceLinks({ lead, scope }: { lead: string; scope: string }) {
  const href = useViewHref(scope);
  return <p className="text-sm leading-6 text-muted-foreground" data-c-source-links>
    <span>{lead}</span>{" "}
    <a href={href("dpc")} onClick={openView("dpc")} className={link}>Assistiti e servizio DPC</a>
    <span aria-hidden="true"> · </span>
    <a href={href("filef")} onClick={openView("filef")} className={link}>File F</a>
  </p>;
}

/** «Assistiti e servizio DPC»: the January 2026 DPC flows of the organisations in this view, and nothing else. */
export function PillarCDpcView({ extension, unavailable, residence, narrowing, regionWide }: {
  extension: CExtensionView | null; unavailable: boolean; residence?: ReactNode; narrowing?: ReactNode; regionWide?: ReactNode;
}) {
  const coverage = cSourceCoverage(extension);
  return <section id="dpc" aria-labelledby="dpc-title" className="scroll-mt-6 space-y-8 xl:scroll-mt-36" data-c-source-view="dpc">
    <SourceHeader id="dpc" title="Assistiti e servizio DPC · gennaio 2026" question="Chi riceve i farmaci in distribuzione per conto, quanto costano per assistito e quanto pesa il servizio delle farmacie?"
      scope={`${C_SOURCE_LABELS.dpc.source} · ${coverage.dpc}`}
      note={<>
        <p>Fonte: i flussi DPC (distribuzione per conto) che le ASL inviano al Ministero della Salute, riferiti a gennaio 2026. Un invio può contenere anche erogazioni registrate con una data precedente.</p>
        <p>{`Organizzazioni in questa vista: ${coverage.dpc}.`}</p>
        <p>Chi è contato: ogni assistito con almeno un’erogazione DPC nel flusso e un codice identificativo valido, una sola volta per ASL anche se ha più erogazioni. Dove c’è un totale, somma i conteggi delle singole ASL: un assistito presente nei dati di due ASL può essere contato due volte.</p>
        <p>Importi: il costo d’acquisto e il compenso di servizio registrati nel flusso per ogni confezione. Riguardano solo la DPC, non CO e DD.</p>
      </>} />
    {extension
      ? <>
        <PillarCRecipientsSection view={extension} residence={residence} />
        <PillarCUnitCosts view={extension} />
        {regionWide}
        <PillarCDpcAttributionEvidence view={extension} narrowing={narrowing} />
      </>
      : <>
        <PillarCSectionEmpty>{unavailable ? "I dati DPC non sono disponibili in questo momento. Nessun valore viene mostrato né sostituito." : "Le fonti disponibili per questa vista non includono i flussi DPC. Nessun valore viene mostrato né sostituito."}</PillarCSectionEmpty>
        {residence}
        {narrowing}
      </>}
  </section>;
}

/** «File F»: the File F 2025 of the organisations that sent it; the others read that it was not received. */
export function PillarCFileFView({ extension, unavailable, fields, regionWide }: {
  extension: CExtensionView | null; unavailable: boolean; fields?: ReactNode; regionWide?: ReactNode;
}) {
  const coverage = cSourceCoverage(extension);
  return <section id="filef" aria-labelledby="filef-title" className="scroll-mt-6 space-y-8 xl:scroll-mt-36" data-c-source-view="filef">
    <SourceHeader id="filef" title="File F · 2025" question="Quanti identificativi raggiunge il File F, con quale importo riportato e come cambia da un mese all’altro?"
      scope={`${C_SOURCE_LABELS.filef.source} · ${coverage.fileF}`}
      note={<>
        <p>Fonte: il File F 2025 inviato dall’Azienda, righe di dettaglio valide. L’importo è quello riportato nel flusso, non la spesa netta dell’Azienda.</p>
        <p>{`Copertura: ${coverage.fileF}. Per chi non lo ha inviato nessun valore viene stimato.`}</p>
        <p>Chi è contato: gli identificativi distinti presenti nel flusso. Non sono pazienti certificati, e gli identificativi di mesi diversi non si sommano.</p>
        <p>Il File F non è un canale della spesa (CO, DD o DPC): resta una fonte a sé.</p>
      </>} />
    {extension
      ? <>
        <PillarCFileFRecipients view={extension} />
        <PillarCFileFMonthly view={extension} />
        <PillarCFileFPortfolios view={extension} fileF={fields} />
        {regionWide}
      </>
      : <>
        <PillarCSectionEmpty>{unavailable ? "I dati del File F non sono disponibili in questo momento. Nessun valore viene mostrato né sostituito." : "Le fonti disponibili per questa vista non includono il File F. Nessun valore viene mostrato né sostituito."}</PillarCSectionEmpty>
        {fields}
      </>}
  </section>;
}
