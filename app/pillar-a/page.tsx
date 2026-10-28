import { PublicPillarHeader } from "@/components/public-pillar-header";
import { PillarAPublic } from "@/components/pillar-a-public";

export const metadata = { title: "Pillar A · Fonti pubbliche | VIS Pharma Compass", description: "Spesa, confezioni e attività ospedaliera: serie pubbliche AIFA, ISTAT e Ministero della Salute." };

export default function PillarAPage() {
  return <main className="min-h-screen bg-background">
    <PublicPillarHeader active="a" />
    <PillarAPublic />
  </main>;
}
