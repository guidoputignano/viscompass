import Link from "next/link";
import { VisLogoLink } from "@/components/vis-logo";
import { PillarAPublic } from "@/components/pillar-a-public";

export const metadata = { title: "Pillar A · Fonti pubbliche | VIS Pharma Compass", description: "Spesa, confezioni e attività ospedaliera: serie pubbliche AIFA, ISTAT e Ministero della Salute." };

export default function PillarAPage() {
  return <main className="min-h-screen bg-background">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5"><VisLogoLink size="sm" /><nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" aria-label="Navigazione pubblica"><Link href="/" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-primary">Home</Link><Link href="/pillar-b" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-primary">Pillar B · Biosimilari ed esclusività</Link><Link href="/dashboard-review/antibiotici" className="inline-flex min-h-11 items-center font-semibold text-primary">Area riservata →</Link></nav></div></header>
    <PillarAPublic />
  </main>;
}
