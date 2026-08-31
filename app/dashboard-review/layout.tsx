import { DashboardReviewNav } from "@/components/dashboard-review/nav";
import { VisLogo } from "@/components/vis-logo";
import { AccessPortal } from "@/components/access/access-portal";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getAccessOverview } from "@/lib/access/queries";
import { getAdminEmail } from "@/lib/auth/admin";

// Reads the live session on every request — there's no meaningful static
// shell to prerender for a page whose entire content depends on who is
// asking.
export const instant = false;

export default async function DashboardReviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [org, adminEmail] = await Promise.all([getCurrentOrg(), getAdminEmail()]);

  if (!org) {
    const overview = await getAccessOverview();
    if (!overview) {
      return (
        <div className="flex min-h-svh items-center justify-center">
          <VisLogo size="sm" />
        </div>
      );
    }
    return <AccessPortal overview={overview} isAdmin={Boolean(adminEmail)} />;
  }

  return <DashboardReviewNav org={org} isAdmin={Boolean(adminEmail)}>{children}</DashboardReviewNav>;
}
