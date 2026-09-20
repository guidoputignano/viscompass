import Link from "next/link";
import { VisLogo } from "@/components/vis-logo";
import { PillarAPublic } from "@/components/pillar-a-public";

export const metadata = { title: "Pillar A · Evidenze pubbliche | VIS Pharma Compass", description: "Spesa, confezioni e attività ospedaliera: serie pubbliche AIFA, ISTAT e Ministero della Salute." };

export default function PillarAPage() {
  return <main className="min-h-screen bg-background">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5"><Link href="/"><VisLogo size="sm" /></Link><div className="flex gap-5 text-sm"><Link href="/" className="text-muted-foreground hover:text-primary">Home</Link><Link href="/dashboard-review/antibiotici" className="font-semibold text-primary">Area riservata →</Link></div></div></header>
    <PillarAPublic />
  </main>;
}
