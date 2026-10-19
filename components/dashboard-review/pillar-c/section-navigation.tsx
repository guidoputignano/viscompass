"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, ChartNoAxesCombined, ClipboardList, FileCheck2, Landmark, TrendingUp, UsersRound, WalletCards, ChartPie, Network, Scale, Layers, Activity, SlidersHorizontal, ListChecks, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { PILLAR_C_SECTIONS, PILLAR_C_ALL_SECTIONS, pillarCSectionAtViewport, type PillarCSectionId } from "@/lib/dashboard-review/pillar-c/section-navigation";

const icons = { portafogli: BriefcaseBusiness, spesa: WalletCards, cambiamento: ChartNoAxesCombined, pianificazione: Landmark, numerosita: UsersRound, previsione: TrendingUp, evidenza: FileCheck2, composizione: ChartPie, attribuzione: Network, costi: Layers, confronti: Scale, attivita: Activity, tendenze: GitCompareArrows, sensibilita: SlidersHorizontal, priorita: ListChecks, "evidence-workflow": ClipboardList };

export function PillarCSectionNavigation({ extended = false }: { extended?: boolean }) {
  const [active, setActive] = useState<PillarCSectionId>(extended ? "portafogli" : "spesa");
  const sections = extended ? PILLAR_C_ALL_SECTIONS : PILLAR_C_SECTIONS;

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
