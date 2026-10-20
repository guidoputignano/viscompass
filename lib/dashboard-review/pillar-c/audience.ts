import "server-only";
import { cache } from "react";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getViewerIdentity } from "@/lib/auth/viewer";
import { getAdminEmail } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/lib/dashboard-review/types";
import { pillarCAudienceGate, pillarCScopedAudience, type PillarCAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { pcsLog } from "@/lib/dashboard-review/pillar-c/scoped-transport";

/** Only a Vercel production deployment serves scoped data. Preview, development and local runs never do,
 * whatever their environment: there is no switch to turn this on elsewhere. Read on every request. */
export function pillarCScopedProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** The units function, called with the request's OWN session client. It derives the caller from auth.uid()
 * and cannot be called with the service role (EXECUTE is granted to authenticated only). */
export async function readPillarCScopedUnits(db: Pick<Awaited<ReturnType<typeof createClient>>, "rpc">): Promise<unknown> {
  try {
    const { data, error } = await db.rpc("pillar_c_scoped_units");
    if (error) { pcsLog("PCS-UNITS"); return null; }
    return data;
  } catch { pcsLog("PCS-UNITS"); return null; }
}

async function decide(org: Organization | null, reviewer: boolean, admin: boolean): Promise<PillarCAudience | null> {
  const gate = pillarCAudienceGate({ org, reviewer, admin, production: pillarCScopedProduction() });
  if ("decided" in gate) return gate.decided;
  const audience = pillarCScopedAudience(gate.candidate, await readPillarCScopedUnits(await createClient()));
  if (audience.kind === "forecast_only" && audience.reason === "units_mismatch") pcsLog("PCS-UNITS");
  return audience;
}

/**
 * The audience of an approved member the caller has ALREADY established is not a reviewer or administrator
 * (the reviewer gate stays where it was, verbatim, in the page and the routes). Returns azienda or regione for
 * an enabled member whose units are exactly its entitlement, and forecast_only for anyone else.
 */
export async function resolvePillarCMemberAudience(org: Organization): Promise<PillarCAudience> {
  return (await decide(org, false, false)) ?? { kind: "forecast_only", reason: "unmapped" };
}

/**
 * The caller's Pillar C audience, derived from the live session on every request.
 * React cache() is request-local: it only avoids repeating the same lookups across one render.
 * Nothing is kept between requests, so a revoke or a deleted rollout row is seen on the next one.
 *   - null: no approved membership (signed out, pending, rejected, revoked);
 *   - reviewer: approved member on REVIEWER_EMAILS/ADMIN_EMAILS (unchanged, the units function is not called);
 *   - azienda / regione: an enabled member whose units are exactly its entitlement;
 *   - forecast_only: any other approved member.
 */
export const resolvePillarCAudience = cache(async (): Promise<PillarCAudience | null> => {
  const [org, viewer, admin] = await Promise.all([getCurrentOrg(), getViewerIdentity(), getAdminEmail()]);
  return decide(org, Boolean(viewer?.isReviewer), Boolean(admin));
});
