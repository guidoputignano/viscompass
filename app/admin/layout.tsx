import { DashboardReviewNav } from "@/components/dashboard-review/nav";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getAdminEmail } from "@/lib/auth/admin";
import { getViewerIdentity } from "@/lib/auth/viewer";

// Reads the live session on every request, like the dashboard layout.
export const instant = false;

/** R20-05: an approved administrator works inside the same navigation shell as the dashboard. Anyone else (an
 * ordinary account, or an administrator without an approved membership) gets the page's own restricted or standalone
 * view: the shell, and its links, are never shown to an account the admin gate refuses. */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [org, adminEmail, viewer] = await Promise.all([getCurrentOrg(), getAdminEmail(), getViewerIdentity()]);
  if (!org || !adminEmail) return <>{children}</>;
  return (
    <DashboardReviewNav org={org} isAdmin viewer={viewer}>
      {children}
    </DashboardReviewNav>
  );
}
