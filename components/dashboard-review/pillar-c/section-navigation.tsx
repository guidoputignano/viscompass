"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, ChartNoAxesCombined, ClipboardList, FileCheck2, GitBranch, Landmark, TrendingUp, UsersRound, WalletCards, ChartPie, Network, Scale, Layers, Activity, SlidersHorizontal, ListChecks, GitCompareArrows, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { PILLAR_C_SECTIONS, PILLAR_C_ALL_SECTIONS, PILLAR_C_SIX_SECTIONS, pillarCSectionAtViewport, type PillarCNavSection, type PillarCSectionId, type PillarCSixSectionId } from "@/lib/dashboard-review/pillar-c/section-navigation";

const icons = { portafogli: BriefcaseBusiness, scenari: GitBranch, spesa: WalletCards, cambiamento: ChartNoAxesCombined, pianificazione: Landmark, numerosita: UsersRound, previsione: TrendingUp, evidenza: FileCheck2, composizione: ChartPie, attribuzione: Network, costi: Layers, confronti: Scale, attivita: Activity, tendenze: GitCompareArrows, sensibilita: SlidersHorizontal, priorita: ListChecks, "evidence-workflow": ClipboardList, quadro: LayoutDashboard, destinatari: UsersRound, "portafogli-attribuzione": BriefcaseBusiness, fattori: ChartNoAxesCombined, "budget-scenari": Landmark, "priorita-evidenza": ListChecks };

/** `list` replaces the default list (the organisation-scoped page passes PILLAR_C_SCOPED_SECTIONS); the reviewer's
 * page passes none and keeps its lists. */
export function PillarCSectionNavigation({ extended = false, list }: { extended?: boolean; list?: readonly PillarCNavSection[] }) {
  const [active, setActive] = useState<PillarCSectionId>(extended ? "portafogli" : "spesa");
  const sections = list ?? (extended ? PILLAR_C_ALL_SECTIONS : PILLAR_C_SECTIONS);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const positions = sections.flatMap(({ id }) => {
        const element = document.getElementById(id);
        return element ? [{ id, top: element.getBoundingClientRect().top }] : [];
      });
      const atBottom = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
      setActive(pillarCSectionAtViewport(positions, Math.min(180, window.innerHeight * 0.25), atBottom, sections));
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
  }, [sections]);

  return <div className={extended ? "space-y-3 xl:sticky xl:top-3 xl:z-20" : undefined}>
    {extended && <label className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground">Vai alla sezione<select aria-label="Vai alla sezione Pillar C" className="h-9 min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground" value={active} onChange={e => { const id = e.target.value as PillarCSectionId; setActive(id); document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'auto' }); window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`); }}>{sections.map(s => <option key={s.id} value={s.id}>{s.number?`${s.number} · ${s.label}`:s.label}</option>)}</select></label>}
    <nav aria-label="Sezioni dell’analisi Pillar C" className={extended ? "flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-sm" : "grid grid-cols-2 gap-2 rounded-[22px] border border-border bg-card bg-gradient-to-br from-card via-card to-primary/[0.04] p-2 shadow-sm sm:grid-cols-3 xl:sticky xl:top-3 xl:z-20 xl:grid-cols-6"}>
    {sections.map(({ id, number, label, description }) => {
      const Icon = icons[id], selected = active === id;
      return <a key={id} href={`#${id}`} onClick={() => setActive(id)} aria-current={selected ? "location" : undefined}
        className={cn(
          "group relative isolate flex min-h-[88px] min-w-0 items-center gap-2 overflow-hidden rounded-2xl border px-2.5 py-3 outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none sm:gap-3 sm:px-3.5",
          extended && "w-52 shrink-0",
          selected ? "border-primary/30 bg-primary text-primary-foreground shadow-md shadow-primary/20" : "border-transparent text-foreground hover:border-primary/15 hover:bg-primary/[0.05] hover:shadow-sm motion-safe:hover:-translate-y-0.5",
        )}>
        {selected && <><span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white/10 via-transparent to-black/10" /><span aria-hidden="true" className="pointer-events-none absolute -right-6 -top-10 -z-10 size-28 rounded-full bg-white/15 blur-2xl" /></>}
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200 motion-reduce:transition-none sm:size-10", selected ? "border-white/20 bg-white/15 text-primary-foreground shadow-sm" : "border-primary/10 bg-primary/[0.06] text-primary group-hover:border-primary/20 group-hover:bg-primary/10")}>
          <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span className="min-w-0 sm:pr-3"><span className="block text-xs font-semibold tracking-tight sm:text-[13px]">{label}</span><span className={cn("mt-1 block text-[10px] leading-4", selected ? "text-primary-foreground/85" : "text-muted-foreground")}>{description}</span></span>
        <span aria-hidden="true" className={cn("absolute right-3 top-2.5 text-[9px] font-semibold tabular-nums tracking-wider", selected ? "text-primary-foreground/65" : "text-muted-foreground/65")}>{number}</span>
        <ArrowUpRight size={12} aria-hidden="true" className={cn("absolute bottom-3 right-3 transition-[opacity,transform] duration-200 motion-reduce:transition-none", selected ? "text-primary-foreground/85" : "text-primary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5")} />
      </a>;
    })}
    </nav>
  </div>;
}

const SIX_IDS: readonly string[] = PILLAR_C_SIX_SECTIONS.map((s) => s.id);

/** The compact six-entry bar of the redesign (docs/PILLAR_C_SIX_SECTIONS_20261022.md §4.1): one row of pill links
 * (numeral, icon, label), `aria-current` from the same rAF scroll-spy, no description text and no select. Below md a
 * horizontally scrollable row with scroll-snap; from md a grid with wrapping labels, three columns up to lg and six
 * from xl (six columns under the 256 px sidebar leave no room for a label before xl); sticky at xl. The reading line
 * never sits above the sections' own scroll margin, so the section a link scrolls to is the one marked current.
 * Nothing mounts it before 1.2b. */
export function PillarCSectionBar({ className }: { className?: string }) {
  const [active, setActive] = useState<PillarCSixSectionId>("quadro");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const positions = PILLAR_C_SIX_SECTIONS.flatMap(({ id }) => {
        const element = document.getElementById(id);
        return element ? [{ id, top: element.getBoundingClientRect().top }] : [];
      });
      const atBottom = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
      const first = positions.length ? document.getElementById(positions[0].id) : null;
      const margin = first ? parseFloat(getComputedStyle(first).scrollMarginTop) || 0 : 0;
      const line = Math.max(Math.min(180, window.innerHeight * 0.25), margin + 1);
      const next = pillarCSectionAtViewport(positions, line, atBottom, PILLAR_C_SIX_SECTIONS);
      setActive(SIX_IDS.includes(next) ? (next as PillarCSixSectionId) : "quadro");
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
    {PILLAR_C_SIX_SECTIONS.map(({ id, number, label }) => {
      const Icon = icons[id], selected = active === id;
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
