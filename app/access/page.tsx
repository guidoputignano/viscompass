import { redirect } from "next/navigation";
import { AccessPortal } from "@/components/access/access-portal";
import { getAccessOverview } from "@/lib/access/queries";
import { getAdminEmail } from "@/lib/auth/admin";

export const instant = false;

export default async function AccessPage() {
  const [overview, adminEmail] = await Promise.all([getAccessOverview(), getAdminEmail()]);
  if (!overview) redirect("/auth/login");

  const approved = overview.memberships.some((membership) => membership.status === "approved");
  if (approved) redirect("/dashboard-review/spend");

  return <AccessPortal overview={overview} isAdmin={Boolean(adminEmail)} />;
}
