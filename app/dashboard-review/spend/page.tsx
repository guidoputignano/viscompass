import type { Metadata } from "next";
import { SpendDashboardView } from "@/components/dashboard-review/spend-dashboard-view";
import { getSpendDashboardData } from "@/lib/dashboard-review/queries";

export const metadata: Metadata = {
  title: "Quadro esecutivo | VIS",
  robots: { index: false, follow: false },
};

export default async function SpendPage() {
  const dashboard = await getSpendDashboardData();
  return <SpendDashboardView dashboard={dashboard} />;
}
