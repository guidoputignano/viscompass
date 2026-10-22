/** The frames of the six sections of Pillar C (docs/PILLAR_C_SIX_SECTIONS_20261022.md §4.1): the numbered heading
 * with the question as lead and an optional scope line, and the one-paragraph empty state. Presentation only: no
 * hooks, no handlers, no organisation key or label and nothing from the Pillar C libs; every string arrives as a
 * prop. The classes are those of Heading and Empty in review-blocks.tsx, which is not imported (it is "use client"
 * and pulls the charts), and of the scenari heading in planning-workspace.tsx (tabIndex -1, focus-visible outline),
 * so the section bar can move focus to the heading after scrolling. */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A filter-driven line, source · organisation · channel · period: one text child, keyed on its content so that a
 * change remounts the element and Chrome page translation cannot keep a stale translation. Empty parts are dropped;
 * with nothing left to say the component renders nothing (never a blank paragraph with its margin). */
export function PillarCScopeLine({ parts, className }: { parts: readonly string[]; className?: string }) {
  const text = parts.filter((p) => p.length > 0).join(" · ");
  if (text.length === 0) return null;
  return <p key={text} className={cn("mt-1 max-w-4xl text-xs leading-5 text-muted-foreground", className)}>{text}</p>;
}

export type PillarCSectionFrameProps = {
  /** The section's anchor; the heading's id is `${id}-title` and the section is labelled by it. */
  id: string;
  /** The numeral 1–6, hidden from assistive technology: the title alone names the section. */
  number: string;
  title: string;
  /** The management question the section answers, rendered as the lead under the title. */
  question: string;
  /** Source · organisation · channel · period, handed to PillarCScopeLine, which renders it when any part is non-empty. */
  scope?: readonly string[];
  children: ReactNode;
  className?: string;
};

export function PillarCSectionFrame({ id, number, title, question, scope, children, className }: PillarCSectionFrameProps) {
  return <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-6 xl:scroll-mt-36", className)}>
    <div className="mb-5 flex items-start gap-3">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-xs font-semibold text-primary">{number}</span>
      <div className="min-w-0">
        <h2 id={`${id}-title`} tabIndex={-1} className="text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-primary">{title}</h2>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">{question}</p>
        {scope && scope.length > 0 ? <PillarCScopeLine parts={scope} /> : null}
      </div>
    </div>
    <div className="space-y-5">{children}</div>
  </section>;
}

/** The honest empty state of a section: exactly the sentence it is given, as a status paragraph, nothing substituted. */
export function PillarCSectionEmpty({ children }: { children: string }) {
  return <p role="status" className="rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">{children}</p>;
}
