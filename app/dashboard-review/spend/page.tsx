import { SpendDashboardView } from "@/components/dashboard-review/spend-dashboard-view";
import { getSpendDashboardData } from "@/lib/dashboard-review/queries";

export default async function SpendPage() {
  const dashboard = await getSpendDashboardData();
  return <SpendDashboardView dashboard={dashboard} />;
}
