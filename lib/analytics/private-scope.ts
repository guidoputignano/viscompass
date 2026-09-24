import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleConfig } from "@/lib/supabase/service-role";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getReviewerEmail } from "@/lib/auth/reviewer";
import { PRIVATE_RELEASE } from "@/lib/analytics/private-pillar-a";
import { decidePrivateScope, type ScopeDecision, type ScopeOrg } from "@/lib/analytics/private-scope-rules";

// Resolves WHO is asking and WHAT they may see in the private Pillar A section.
//
// This is the single place that decision is made. Every private query must take
// its client and its org list from here rather than building its own, because a
// duplicated gate is a gate that drifts. The decision itself is pure and lives
// in private-scope-rules.ts, where it is tested; this file is only the I/O that
// gathers its inputs and attaches a client.
//
// THE SERVICE-ROLE READ. For a reviewer the rows are read with the service-role
// client, which bypasses RLS. lib/supabase/service-role.ts permits that only
// from a server path that has already checked the caller is authorized, which
// getReviewerEmail() does against the live session. Three properties hold and
// must keep holding:
//   1. getReviewerEmail() re-derives the email from the session on every
//      request. Never from client input, a prop, or a cookie the browser sets.
//   2. The service-role client is created ONLY inside the reviewer branch, and
//      is attached to the returned scope ONLY when the decision says the scope
//      really widened.
//   3. The returned scope is server-only. Never pass `db` into a Client
//      Component: it carries the key.

type SessionClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createServiceRoleClient>;

export type PrivateScope = ScopeDecision & {
  /** SERVER ONLY. Never hand this to a Client Component. */
  db: SessionClient | AdminClient;
};

/** Every organization that actually has rows in the current private release. */
async function organizationsInRelease(admin: AdminClient): Promise<ScopeOrg[] | null> {
  // The aggregate grain is orgs x years x 4 AWaRe categories — tens of rows for
  // the present cohort. The limit is a guard, not a page: if it were ever hit,
  // the distinct list could be short and a reviewer would silently lose an
  // Azienda, so a full result is required rather than assumed.
  const LIMIT = 5000;
  const { data, error } = await admin
    .from("pillar_a_private_fact")
    .select("org_code")
    .eq("release_id", PRIVATE_RELEASE)
    .limit(LIMIT);
  if (error || !data?.length || data.length >= LIMIT) return null;

  const codes = [...new Set(data.map((r) => r.org_code as string))].sort();
  const { data: rows, error: orgError } = await admin
    .from("organizations")
    .select("org_code, org_name")
    .in("org_code", codes);
  if (orgError) return null;

  // Left join on the codes, not on the organizations table: an org_code present
  // in the release but missing from `organizations` must still appear, under
  // its bare code. Dropping it would quietly shrink the cohort.
  const names = new Map((rows ?? []).map((r) => [r.org_code as string, r.org_name as string | null]));
  return codes.map((org_code) => ({ org_code, org_name: names.get(org_code) ?? null }));
}

export async function resolvePrivateScope(): Promise<PrivateScope | null> {
  const [org, reviewerEmail] = await Promise.all([getCurrentOrg(), getReviewerEmail()]);
  const isReviewer = Boolean(reviewerEmail);

  let admin: AdminClient | null = null;
  let releaseOrgs: ScopeOrg[] | null = null;
  if (isReviewer && hasServiceRoleConfig()) {
    try {
      admin = createServiceRoleClient();
    } catch {
      admin = null;
    }
    if (admin) releaseOrgs = await organizationsInRelease(admin);
  }

  const db = await createClient();

  // Only needed when the reviewer widening did not happen and the viewer holds
  // a regione membership; the session client reads this under RLS.
  let regionMembers: ScopeOrg[] | null = null;
  if (!releaseOrgs?.length && org && org.org_type !== "asl") {
    const { data, error } = await db
      .from("organizations")
      .select("org_code,org_name")
      .eq("region_code", org.region_code)
      .eq("org_type", "asl");
    if (error) throw Error("Impossibile verificare il perimetro organizzativo.");
    regionMembers = data ?? [];
  }

  const decision = decidePrivateScope({ isReviewer, releaseOrgs, org, regionMembers });
  if (!decision) return null;

  // The admin client is attached only when the decision actually widened the
  // scope. Anything else reads under RLS with the caller's own session.
  return { ...decision, db: decision.allOrganizations && admin ? admin : db };
}
