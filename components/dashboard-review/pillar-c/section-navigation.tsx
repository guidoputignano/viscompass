"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, ChartNoAxesCombined, Landmark, LayoutDashboard, ListChecks, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { PILLAR_C_SECTIONS, pillarCSectionAtViewport, type PillarCSectionId } from "@/lib/dashboard-review/pillar-c/section-navigation";

const icons = { quadro: LayoutDashboard, destinatari: UsersRound, "portafogli-attribuzione": BriefcaseBusiness, fattori: ChartNoAxesCombined, "budget-scenari": Landmark, "priorita-evidenza": ListChecks };
const SECTION_IDS: readonly PillarCSectionId[] = PILLAR_C_SECTIONS.map((s) => s.id);
// Read by assistive technology after the label of an entry the page does not render: never a link to a missing anchor.
// «sezione» carries the agreement, so the statement reads right after a singular or a plural label.
const UNAVAILABLE_ENTRY = ", sezione non disponibile in questa pagina";

/** The compact six-entry bar of the page (docs/PILLAR_C_SIX_SECTIONS_20261022.md §4.1): one row of pill links
 * (numeral, icon, label), `aria-current` from the same rAF scroll-spy, no description text and no select. Below md a
 * horizontally scrollable row with scroll-snap; from md a grid with wrapping labels, three columns up to lg and six
 * from xl (six columns under the 256 px sidebar leave no room for a label before xl); sticky at xl. The reading line
 * never sits above the sections' own scroll margin, so the section a link scrolls to is the one marked current.
 * `available`: the sections the page renders (default: all six). Every other entry stays in its place as plain text,
 * outside the tab order, with a screen-reader statement, and is never marked current. */
export function PillarCSectionBar({ className, available = SECTION_IDS }: { className?: string; available?: readonly PillarCSectionId[] }) {
  const [active, setActive] = useState<PillarCSectionId>("quadro");
  const current = available.includes(active) ? active : available[0];

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const positions = PILLAR_C_SECTIONS.flatMap(({ id }) => {
        const element = document.getElementById(id);
        return element ? [{ id, top: element.getBoundingClientRect().top }] : [];
      });
      const atBottom = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
      const first = positions.length ? document.getElementById(positions[0].id) : null;
      const margin = first ? parseFloat(getComputedStyle(first).scrollMarginTop) || 0 : 0;
      const line = Math.max(Math.min(180, window.innerHeight * 0.25), margin + 1);
      const next = pillarCSectionAtViewport(positions, line, atBottom, PILLAR_C_SECTIONS);
      setActive(next);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    window.addEventListener("popstate", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      window.removeEventListener("popstate", schedule);
    };
  }, []);

  return <nav aria-label="Sezioni dell’analisi Pillar C" className={cn("flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-sm md:grid md:grid-cols-3 md:snap-none md:overflow-visible xl:sticky xl:top-3 xl:z-20 xl:grid-cols-6", className)}>
    {PILLAR_C_SECTIONS.map(({ id, number, label }) => {
      const Icon = icons[id], selected = current === id;
      if (!available.includes(id)) return <span key={id} className="flex min-h-11 min-w-0 shrink-0 snap-start items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-xs font-semibold tracking-tight text-muted-foreground md:shrink xl:text-[13px]">
        <span aria-hidden="true" className="w-3 shrink-0 text-[10px] font-semibold tabular-nums opacity-70">{number}</span>
        <Icon size={16} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
        <span className="truncate md:overflow-visible md:whitespace-normal md:leading-4">{label}</span>
        <span className="sr-only">{UNAVAILABLE_ENTRY}</span>
      </span>;
      return <a key={id} href={`#${id}`} aria-current={selected ? "location" : undefined}
        onClick={(e) => { e.preventDefault(); setActive(id); const hash = `#${id}`; if (window.location.hash !== hash) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`); document.getElementById(id)?.scrollIntoView({ block: "start" }); document.getElementById(`${id}-title`)?.focus({ preventScroll: true }); }}
        className={cn(
          "group flex min-h-11 min-w-0 shrink-0 snap-start items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-safe:transition-[color,background-color,border-color,box-shadow] motion-safe:duration-200 md:shrink xl:text-[13px]",
          selected ? "border-primary/30 bg-primary text-primary-foreground shadow-sm" : "border-transparent text-foreground hover:border-primary/15 hover:bg-primary/[0.05]",
        )}>
        <span aria-hidden="true" className="w-3 shrink-0 text-[10px] font-semibold tabular-nums opacity-70">{number}</span>
        <Icon size={16} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
        <span className="truncate md:overflow-visible md:whitespace-normal md:leading-4">{label}</span>
      </a>;
    })}
  </nav>;
}
