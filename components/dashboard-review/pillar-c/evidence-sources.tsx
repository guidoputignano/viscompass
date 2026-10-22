/** Section 6 «Priorità ed evidenza» of the six-section Pillar C page (docs/PILLAR_C_SIX_SECTIONS_20261022.md §1, D7): the
 * reading criteria and the compact «Fonti e versione» list. Presentation only and reader-free: every criterion and source
 * arrives as a prop; reviewer-only traceability is never written here, the caller may pass it as children. The outline
 * nests: the h3 of the block, the h4 «Come leggere le analisi» with one h5 per criterion, then the h4 «Fonti e versione». */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PillarCEvidenceCriterion = { title: string; text: string };
export type PillarCEvidenceSource = { term: string; detail: string };
export type PillarCEvidenceSourcesProps = {
  /** Inner anchor kept so old #evidenza links resolve; the heading id is `${id}-title`. */
  id?: string;
  criteria: readonly PillarCEvidenceCriterion[];
  /** Empty: the list is absent and nothing stands in for it. */
  sources: readonly PillarCEvidenceSource[];
  children?: ReactNode;
  className?: string;
};

export function PillarCEvidenceSources({ id = "evidenza", criteria, sources, children, className }: PillarCEvidenceSourcesProps) {
  return <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-6 xl:scroll-mt-36", className)}>
    <div className="mb-5"><h3 id={`${id}-title`} className="text-lg font-semibold tracking-tight">Fonti e criteri di lettura</h3><p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">Origine delle misure, perimetro dei controlli e ipotesi di ciascuna analisi.</p></div>
    <article className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <h4 className="mb-5 text-base font-semibold">Come leggere le analisi</h4>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{criteria.map((c) => <div key={c.title}><h5 className="text-sm font-semibold">{c.title}</h5><p className="mt-2 text-xs leading-5 text-muted-foreground">{c.text}</p></div>)}</div>
      {sources.length > 0 ? <div className="mt-6 border-t border-border pt-5"><h4 className="text-sm font-semibold">Fonti e versione</h4><dl className="mt-3 grid gap-3 text-xs md:grid-cols-2">{sources.map((s) => <div key={s.term}><dt className="font-semibold">{s.term}</dt><dd className="mt-1 leading-5 text-muted-foreground">{s.detail}</dd></div>)}</dl></div> : null}
      {children}
    </article>
  </section>;
}
