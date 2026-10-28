import { Suspense } from "react";
import { PublicPillarHeader } from "@/components/public-pillar-header";
import { PillarCPublic } from "@/components/pillar-c-public";
import { getPublicPillarC } from "@/lib/pillar-c-public/server-data";
import { parsePublicCSelection } from "@/lib/pillar-c-public/model";

export const metadata = { title: "Pillar C · Aree cliniche e budget | VIS Pharma Compass", description: "Spesa farmaceutica regionale, confronti per residente, composizione e previsione 2026. Analisi da fonti pubbliche AIFA, ISTAT e Ministero della Salute." };
async function Observatory({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = getPublicPillarC(), input = await searchParams, params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) if (typeof v === "string") params.set(k, v);
  return <PillarCPublic data={data} initial={parsePublicCSelection(params, data)} />;
}
export default function PillarCPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <main className="min-h-screen bg-background"><PublicPillarHeader active="c" /><Suspense fallback={<p role="status" className="mx-auto max-w-7xl p-10">Caricamento delle analisi pubbliche…</p>}><Observatory searchParams={searchParams} /></Suspense></main>;
}
