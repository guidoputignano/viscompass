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

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleConfig } from "@/lib/supabase/service-role";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getReviewerEmail } from "@/lib/auth/reviewer";
import { orgDisplayMap } from "@/lib/analytics/org-pseudonym";
import { decidePrivateScope, type ScopeDecision } from "@/lib/analytics/private-scope-rules";
import { aslCodeFor, orgCodeFromAsl } from "./filters";
import { getSpend, type PillarBDb } from "./rpc";

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
};

type OrgRow = { org_code: string; org_name: string | null; org_type: string; region_code: string };

/**
 * Every Azienda that actually has rows in the active release, by real name.
 *
 * Derived from the release itself (the spend RPC groups by asl_code) and joined
 * to `organizations` for names. An asl_code present in the release but missing
 * from the directory still appears, under its bare code, so a reviewer never
 * silently loses an Azienda.
 */
async function organizationsInRelease(admin: PillarBDb): Promise<ScopedOrg[] | null> {
  let aslCodes: string[];
  try {
    const [s24, s25] = await Promise.all([getSpend(admin, 2024), getSpend(admin, 2025)]);
    aslCodes = [...new Set([...s24, ...s25].map((r) => r.asl_code))].sort();
  } catch {
    return null;
  }
  if (aslCodes.length === 0) return null;

  const { data, error } = await admin
    .from("organizations")
    .select("org_code, org_name, org_type, region_code")
    .eq("org_type", "asl");
  if (error) return null;
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
  if (isReviewer && hasServiceRoleConfig()) {
    try {
      admin = createServiceRoleClient();
    } catch {
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
  const labels = orgDisplayMap(
    scopedOrgs.map((o) => ({ org_code: o.orgCode, org_name: o.label })),
    decision.viewerCode,
    { unrestricted: decision.showRealNames && decision.allOrganizations },
  );
  const labelled = scopedOrgs.map((o) => ({ ...o, label: labels[o.orgCode] ?? o.orgCode }));
  const aslLabels = Object.fromEntries(labelled.map((o) => [o.aslCode, o.label]));

  const perimeterLabel = decision.allOrganizations
    ? `tutte le Aziende del rilascio (${labelled.length})`
    : decision.regional
      ? `il perimetro autorizzato (${labelled.length} Aziende)`
      : "la tua Azienda";

  return {
    ...decision,
    db: decision.allOrganizations && admin ? admin : session,
    scopedOrgs: labelled,
    aslLabels,
    narrowable: labelled.length > 1 ? labelled : [],
    perimeterLabel,
  };
}
