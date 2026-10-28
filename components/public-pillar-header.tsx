import Link from "next/link";
import { ArrowRight, BarChart3, LineChart, PanelsTopLeft } from "lucide-react";
import { VisLogoLink } from "@/components/vis-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";

const pillars = [
  { key: "a", href: "/pillar-a", label: "Pillar A", detail: "Fonti pubbliche", icon: BarChart3 },
  { key: "b", href: "/pillar-b", label: "Pillar B", detail: "Biosimilari ed esclusività", icon: LineChart },
  { key: "c", href: "/pillar-c", label: "Pillar C", detail: "Aree cliniche e budget", icon: PanelsTopLeft },
] as const;
export function PublicPillarHeader({ active }: { active: "a" | "b" | "c" }) {
  const reserved = active === "a" ? "/dashboard-review/antibiotici" : active === "b" ? "/dashboard-review/revisione-pillar-b" : "/dashboard-review/pillar-c";
  return <header className="border-b border-border bg-card">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 md:px-8">
      <VisLogoLink size="sm" />
      <nav aria-label="Navigazione pubblica" className="order-3 flex w-full items-center gap-2 sm:order-none sm:w-auto">
        {pillars.map(p => <Link key={p.key} href={p.href} title={`${p.label} · ${p.detail}`} aria-current={active === p.key ? "page" : undefined} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors sm:flex-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active === p.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}><p.icon size={16} aria-hidden="true" />{p.label}<span className="sr-only"> · {p.detail}</span></Link>)}
      </nav>
      <div className="flex items-center gap-1"><ThemeSwitcher /><Link href={reserved} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Area riservata<ArrowRight size={15} aria-hidden="true" /></Link></div>
    </div>
  </header>;
}
