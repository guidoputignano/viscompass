"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Owner-approved secondary presentation (G2-11–G2-21, 29 October). The original analyses are mounted only when
 * requested, so a closed disclosure has neither hidden controls in the tab order nor chart work on first load. */
export function PillarCSecondaryAnalyses({ id, summary, children, initialOpen = false }: { id: string; summary: string; children: ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return <details className="group min-w-0 rounded-2xl border border-border bg-card" data-c-secondary={id}
    open={open}
    onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
      <span>{summary}</span><ChevronDown size={17} aria-hidden="true" className="shrink-0 motion-safe:transition-transform group-open:rotate-180" />
    </summary>
    {open && <div className="space-y-6 border-t border-border px-4 py-5 md:px-5">{children}</div>}
  </details>;
}
