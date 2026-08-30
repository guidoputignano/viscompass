import { Suspense } from "react";
import { DashboardReviewNav } from "@/components/dashboard-review/nav";
import { listScopeOptions } from "@/lib/dashboard-review/queries";

export default function DashboardReviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgs = listScopeOptions();

  return (
    <Suspense>
      <DashboardReviewNav orgs={orgs}>{children}</DashboardReviewNav>
    </Suspense>
  );
}
