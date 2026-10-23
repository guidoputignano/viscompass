import { redirect } from "next/navigation";
import { AccessPortal } from "@/components/access/access-portal";
import { getAccessOverview } from "@/lib/access/queries";
import { getAdminEmail } from "@/lib/auth/admin";
import { LOGIN_DEFAULT_NEXT, loginNext } from "@/lib/auth/safe-next";

export const instant = false;

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [overview, adminEmail, { next }] = await Promise.all([getAccessOverview(), getAdminEmail(), searchParams]);
  // R20-05: a validated `next` survives the approval wait and comes back once access is granted.
  const destination = loginNext(next);
  if (!overview) redirect(destination === LOGIN_DEFAULT_NEXT ? "/auth/login" : `/auth/login?next=${encodeURIComponent(`/access?next=${encodeURIComponent(destination)}`)}`);

  const approved = overview.memberships.some((membership) => membership.status === "approved");
  if (approved) redirect(destination);

  return <AccessPortal overview={overview} isAdmin={Boolean(adminEmail)} />;
}
