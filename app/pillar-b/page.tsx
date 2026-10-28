import { Suspense } from "react";
import { PublicPillarHeader } from "@/components/public-pillar-header";
import { PillarBPublic } from "@/components/pillar-b-public";
import { getPublicEvSc } from "@/lib/pillar-b-public/server-data";
import { parseSelection } from "@/lib/pillar-b-public/ev-sc-view";

// The public Pillar B page. Everything on it comes from one independently
// published AIFA table (see lib/pillar-b-public/server-data.ts); nothing from
// the confidential Abruzzo workbook, not even a regional aggregate, is read
// here. The reserved analysis is linked, behind login.

export const metadata = {
  title: "Pillar B · Biosimilari ed esclusività | VIS Pharma Compass",
  description: "Quota biosimilare e forma di somministrazione di infliximab, rituximab e trastuzumab per territorio: tabelle pubbliche AIFA, acquisti diretti, gennaio–dicembre 2025.",
};

// The selection is read from the URL on the server so a shared link opens on
// the same view. Under Cache Components that read must sit inside a Suspense
// boundary: the shell above it is prerendered, the observatory streams in.
async function Observatory({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const asset = getPublicEvSc();
  const initial = parseSelection(await searchParams, asset.territories);
  return <PillarBPublic asset={asset} initial={initial} />;
}

export default function PillarBPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <main className="min-h-screen bg-background">
    <PublicPillarHeader active="b" />
    <Suspense fallback={<div className="mx-auto max-w-7xl p-10" role="status">Caricamento delle tabelle AIFA…</div>}>
      <Observatory searchParams={searchParams} />
    </Suspense>
  </main>;
}
