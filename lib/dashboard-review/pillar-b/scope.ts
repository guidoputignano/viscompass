// WHO is asking and WHAT they may see in Pillar B.
//
// This mirrors lib/analytics/private-scope.ts — the Pillar A decision — on
// purpose, and reuses its pure decision function, so the two sections cannot
// answer the question differently. The one Pillar B difference is where the
// list of organisations in the release comes from: the Pillar B RPCs, which
// are release-scoped by construction.
//
// THE REVIEWER PATH. A platform reviewer (REVIEWER_EMAILS, lib/auth/
// reviewer-list.ts) sees EVERY Azienda in the release by real name. The Pillar B
// RPCs are SECURITY INVOKER over RLS, so under the reviewer's own session they
// return only the reviewer's approved organisation — which is how a REVISORE
// account came to see Azienda 201's 23,545 rows where the Region holds 106,639.
// For a reviewer the RPCs are therefore executed with the service-role client,
// exactly as the private Pillar A workbook is read. Three properties hold:
//   1. getReviewerEmail() re-derives the email from the live session on every
//      request. Never from client input, a prop, or a cookie the browser sets.
//   2. The service-role client is created ONLY inside the reviewer branch, and
//      attached to the returned scope ONLY when the widening actually succeeded.
//   3. The returned scope is server-only. `db` carries the key. Never pass it
//      into a Client Component.
//
// EVERYONE ELSE reads under RLS with their own session. An Azienda sees itself;
// a Regione sees the Aziende of its region; the database decides, not this file.
//
// NAMES. Other Aziende are pseudonymised (ASL 1–4) for everyone except a
// reviewer, by lib/analytics/org-pseudonym.ts. The labels are resolved HERE,
// server-side, and only the resulting strings reach a component.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleConfig } from "@/lib/supabase/service-role";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getReviewerEmail } from "@/lib/auth/reviewer";
import { labelScopedOrgs } from "./scope-labels";
import { decidePrivateScope, type ScopeDecision } from "@/lib/analytics/private-scope-rules";
import { aslCodeFor, orgCodeFromAsl } from "./filters";
import { getFacets, pillarBActiveRelease, readActiveRelease, type PillarBDb } from "./rpc";
import { releaseAslCodes } from "./release-asl-codes";
import { pillarBCacheKey, pillarBCacheScope, pillarBServerCache } from "./server-cache";

export interface ScopedOrg {
  /** Membership / pseudonym key, e.g. "201". */
  orgCode: string;
  /** canonical_fact key, e.g. "130201". */
  aslCode: string;
  regionCode: string;
  /** What this viewer may call it: real name, pseudonym, or bare code. */
  label: string;
}

export type PillarBScope = ScopeDecision & {
  /** SERVER ONLY. Never hand this to a Client Component. */
  db: PillarBDb;
  /** Every Azienda in the viewer's scope, labelled for this viewer. */
  scopedOrgs: ScopedOrg[];
  /** asl_code -> label, for tables that carry the raw code. */
  aslLabels: Record<string, string>;
  /** The Aziende this viewer may narrow to. Empty for an Azienda account. */
  narrowable: ScopedOrg[];
  /** One sentence naming the perimeter, for the page header. */
  perimeterLabel: string;
  /**
   * SERVER ONLY. Which rows `db` can read, as a cache identity (server-cache.ts):
   * the service-role reviewer scope, or this user's own RLS scope. null = the
   * page must not cache anything for this request.
   */
  cacheScope: string | null;
};

type OrgRow = { org_code: string; org_name: string | null; org_type: string; region_code: string };

/**
 * Every Azienda that actually has rows in the active release, by real name.
 *
 * Derived from all observed years of this release, including its partial 2026,
 * and joined
 * to `organizations` for names. An asl_code present in the release but missing
 * from the directory still appears, under its bare code, so a reviewer never
 * silently loses an Azienda.
 */
async function organizationsInRelease(admin: PillarBDb): Promise<ScopedOrg[] | null> {
  // The directory is the same for every reviewer and every filter of one
  // release: it is read once per release and server process (0.7 s measured
  // per request before), and a failure is never kept.
  let stamp: string | null = null;
  try {
    stamp = (await pillarBActiveRelease(admin))?.stamp ?? null;
  } catch {
    stamp = null;
  }
  const load = () => loadReleaseDirectory(admin);
  try {
    return stamp === null
      ? await load()
      : await pillarBServerCache.get(pillarBCacheKey("reviewer:service-role", stamp, "directory"), load, {
          keep: async () => (await readActiveRelease(admin))?.stamp === stamp,
        });
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : cause);
    return null;
  }
}

/** Throws a PBR-WIDEN-* coded error on any failure, so that nothing failed is cached. */
async function loadReleaseDirectory(admin: PillarBDb): Promise<ScopedOrg[]> {
  let aslCodes: string[];
  try {
    // This query is only for the reviewer directory. It does not make 2026 a
    // comparable analysis year; it prevents a 2026-only Azienda from silently
    // disappearing from the list of organizations in the active release.
    const listing = await getFacets(admin, {
      years: [2024, 2025, 2026], channels: null, substance: null,
      aslCode: null, facets: ["asl"],
    });
    if (listing.asl === null) throw new Error("Azienda facet missing from release listing");
    aslCodes = releaseAslCodes(listing.asl);
  } catch (cause) {
    throw new Error(`PBR-WIDEN-FACETS reviewer release listing failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (aslCodes.length === 0) {
    throw new Error("PBR-WIDEN-EMPTY reviewer release listing returned no Azienda");
  }

  const { data, error } = await admin
    .from("organizations")
    .select("org_code, org_name, org_type, region_code")
    .eq("org_type", "asl");
  if (error) {
    throw new Error(`PBR-WIDEN-ORGS reviewer organization directory read failed: ${error.message}`);
  }
  const orgs = (data ?? []) as OrgRow[];

  return aslCodes.map((aslCode) => {
    const match = orgs.find((o) => aslCodeFor(o.org_code, o.region_code) === aslCode || o.org_code === aslCode);
    const regionCode = match?.region_code ?? aslCode.slice(0, 3);
    return {
      orgCode: match?.org_code ?? orgCodeFromAsl(aslCode, regionCode),
      aslCode,
      regionCode,
      label: match?.org_name?.trim() || aslCode,
    };
  });
}

export async function resolvePillarBScope(): Promise<PillarBScope | null> {
  const [org, reviewerEmail] = await Promise.all([getCurrentOrg(), getReviewerEmail()]);
  const isReviewer = Boolean(reviewerEmail);

  let admin: PillarBDb | null = null;
  let releaseOrgs: ScopedOrg[] | null = null;
  if (isReviewer && !hasServiceRoleConfig()) {
    console.error("PBR-WIDEN-CONFIG reviewer recognised but the service-role configuration is missing");
  }
  if (isReviewer && hasServiceRoleConfig()) {
    try {
      admin = createServiceRoleClient();
    } catch (cause) {
      console.error("PBR-WIDEN-CLIENT service-role client could not be created", cause instanceof Error ? cause.message : cause);
      admin = null;
    }
    if (admin) releaseOrgs = await organizationsInRelease(admin);
  }

  const session = await createClient();

  // A Regione membership reads every ASL of its region under RLS; the list is
  // needed only when the reviewer widening did not happen.
  let regionMembers: OrgRow[] | null = null;
  if (!releaseOrgs?.length && org && org.org_type !== "asl") {
    const { data, error } = await session
      .from("organizations")
      .select("org_code, org_name, org_type, region_code")
      .eq("region_code", org.region_code)
      .eq("org_type", "asl");
    if (error) throw new Error("Impossibile verificare il perimetro organizzativo.");
    regionMembers = (data ?? []) as OrgRow[];
  }

  const decision = decidePrivateScope({
    isReviewer,
    releaseOrgs: releaseOrgs?.map((o) => ({ org_code: o.orgCode, org_name: o.label })) ?? null,
    org,
    regionMembers: regionMembers?.map((o) => ({ org_code: o.org_code, org_name: o.org_name })) ?? null,
  });
  if (!decision) return null;

  // The directory of Aziende in scope, each with both code forms.
  // The directory may hold an organisation without a region code. Its
  // asl_code is then its bare org_code, which the RLS policy also accepts.
  const withCodes = (orgCode: string, regionCode: string | null, name: string | null): ScopedOrg => ({
    orgCode,
    aslCode: regionCode ? aslCodeFor(orgCode, regionCode) : orgCode,
    regionCode: regionCode ?? "",
    label: name?.trim() || orgCode,
  });
  const scopedOrgs: ScopedOrg[] = decision.allOrganizations && releaseOrgs
    ? releaseOrgs
    : org?.org_type === "asl"
      ? [withCodes(org.org_code, org.region_code, org.org_name)]
      : (regionMembers ?? []).map((o) => withCodes(o.org_code, o.region_code, o.org_name));

  // Labels resolved once, under the pseudonym rule. A reviewer with a
  // successful widening sees real names; everyone else sees their own Azienda
  // by name and the rest as ASL 1–4.
  const labelled = labelScopedOrgs(decision, scopedOrgs);
  const aslLabels = Object.fromEntries(labelled.map((o) => [o.aslCode, o.label]));

  const perimeterLabel = decision.allOrganizations
    ? `tutte le Aziende del rilascio (${labelled.length})`
    : decision.regional
      ? `il perimetro autorizzato (${labelled.length} Aziende)`
      : "la tua Azienda";

  const serviceRole = Boolean(decision.allOrganizations && admin);
  // The session subject identifies an RLS reader for the cache; it is read
  // only when the reads run under that session.
  let subject: string | null = null;
  if (!serviceRole) {
    try {
      const { data } = await session.auth.getClaims();
      subject = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    } catch {
      subject = null;
    }
  }

  return {
    ...decision,
    db: decision.allOrganizations && admin ? admin : session,
    scopedOrgs: labelled,
    aslLabels,
    narrowable: labelled.length > 1 ? labelled : [],
    perimeterLabel,
    cacheScope: pillarBCacheScope({ serviceRole, subject, org }),
  };
}
