import "server-only";
import { createHash } from "node:crypto";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getViewerIdentity } from "@/lib/auth/viewer";
import { getAdminEmail, isAdminEmail } from "@/lib/auth/admin";
import { isReviewerEmail } from "@/lib/auth/reviewer-list";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolvePillarBScope } from "@/lib/dashboard-review/pillar-b/scope";
import { getFacets, getValueUptakeScoped, readActiveRelease } from "@/lib/dashboard-review/pillar-b/rpc";
import { buildValueUptake } from "@/lib/dashboard-review/pillar-b/value-uptake";
import { reviewQueue, reviewQueuePublishable } from "@/lib/dashboard-review/pillar-b/review-queue";
import { bridgeB, bridgeBPerimeterCheck, bridgeBPublishable } from "@/lib/dashboard-review/pillar-b/bridge-b";
import { getBenchmarkData } from "@/lib/dashboard-review/queries";
import { benchmarkCandidate, biosimilarCandidates, type FindingCandidate, type FindingSource, type FindingViewer } from "./model";

export const FINDING_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
export const FINDING_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** The years every biosimilar finding is read on: the two complete years of the release, all channels. */
const FINDING_YEARS = [2024, 2025] as const;

type LiveUser = { id: string; email?: string; email_confirmed_at?: string | null; banned_until?: string | null; user_metadata?: Record<string, unknown> };
const usable = (u: LiveUser) => Boolean(u.email && u.email_confirmed_at && !(u.banned_until && new Date(u.banned_until).valueOf() > Date.now()));
const internal = (email: string | undefined) => isReviewerEmail(email) || isAdminEmail(email);

/** Who is asking, from the live session on every call; no privilege is cached.
 * A reviewer or admin works the whole queue; anyone else with an approved membership is a member of those Aziende. */
export async function findingViewer(): Promise<(FindingViewer & { email: string }) | null> {
  const [org, viewer, admin] = await Promise.all([getCurrentOrg(), getViewerIdentity(), getAdminEmail()]);
  if (!org) return null;
  const user = await (await createClient()).auth.getUser();
  const live = user.data.user as LiveUser | null;
  if (user.error || !live || !usable(live)) return null;
  if ((viewer?.isReviewer || admin) && internal(live.email)) return { kind: "reviewer", id: live.id, email: live.email! };
  const memberships = await createServiceRoleClient().from("user_organizations").select("org_code").eq("user_id", live.id).eq("status", "approved");
  if (memberships.error) throw Error("storage");
  const orgs = [...new Set((memberships.data ?? []).map((m) => m.org_code as string))].sort();
  return orgs.length ? { kind: "member", id: live.id, email: live.email!, orgs } : null;
}

/** The findings a reviewer can open a case from, rebuilt from the active release on every call.
 * Biosimilar findings are offered for an Azienda only where the Pillar B page would show its review queue:
 * the bridge reconciles with the perimeter facet and no row is a net credit. `withheld` names the others. */
export async function findingCandidates(): Promise<{ release: string; year: number | null; candidates: FindingCandidate[]; withheld: string[] }> {
  const scope = await resolvePillarBScope();
  if (!scope) throw Error("scope");
  const release = await readActiveRelease(scope.db);
  if (!release) throw Error("release");
  const orgs = scope.narrowable.length ? scope.narrowable : scope.scopedOrgs;
  const withheld: string[] = [];
  const biosimilar = await Promise.all(orgs.map(async (o) => {
    const args = { years: FINDING_YEARS, channels: null, substance: null, aslCode: o.aslCode };
    const [rows, facets] = await Promise.all([
      getValueUptakeScoped(scope.db, args),
      getFacets(scope.db, { ...args, facets: ["asl", "channels", "perimeter"] }),
    ]);
    const view = buildValueUptake(rows), total = facets.totals?.spend_eur;
    if (total == null || view.perimeterRows === 0) { withheld.push(o.label); return []; }
    const model = bridgeB(view, total), queue = reviewQueue(view);
    if (!bridgeBPublishable(model, facets.perimeter ? bridgeBPerimeterCheck(model, facets.perimeter) : null) || !reviewQueuePublishable(queue)) {
      withheld.push(o.label);
      return [];
    }
    return biosimilarCandidates({ orgCode: o.orgCode, aslCode: o.aslCode, label: o.label }, queue.afterLocalSwitch);
  }));
  const bench = await getBenchmarkData();
  const byAsl = new Map(orgs.map((o) => [o.aslCode, o]));
  const benchmark = bench.benchmark_available
    ? bench.rows.flatMap((r) => {
        const o = byAsl.get(r.org_code);
        const c = o ? benchmarkCandidate({ orgCode: o.orgCode, aslCode: o.aslCode, label: o.label }, r) : null;
        return c ? [c] : [];
      })
    : [];
  return { release: release.stamp, year: bench.latest_year, candidates: [...biosimilar.flat(), ...benchmark], withheld: withheld.sort() };
}

export function findingKey(kind: string, release: string, aslCode: string, subject: string): string {
  return createHash("sha256").update(`${kind}|${release}|${aslCode}|${subject}`).digest("hex");
}

/** The frozen record of one candidate, or null when it is not a finding of the active release right now. */
export function findingSource(
  loaded: Awaited<ReturnType<typeof findingCandidates>>,
  ref: { kind: string; asl_code: string; subject: string },
): FindingSource | null {
  const c = loaded.candidates.find((x) => x.kind === ref.kind && x.asl_code === ref.asl_code && x.subject === ref.subject);
  if (!c) return null;
  const base = { source_key: findingKey(c.kind, loaded.release, c.asl_code, c.subject), release: loaded.release, org_code: c.org_code, org_label: c.org_label, asl_code: c.asl_code, subject_label: c.subject_label };
  if (c.kind === "biosimilar") {
    return { kind: "biosimilar", ...base, subject: c.subject, cohort: "after_local_switch", reference_eur: c.value, first_local: c.detail,
      years: `${FINDING_YEARS[0]}-${FINDING_YEARS[FINDING_YEARS.length - 1]}`, channels: "all" };
  }
  if (loaded.year === null) return null;
  return { kind: "benchmark", ...base, subject: "unit_cost_index", year: String(loaded.year), unit_cost_index: c.value, unit_cost_coverage: c.detail };
}

export interface FindingOwner {
  id: string;
  label: string;
  /** The membership the case is held under: the finding's Azienda, or the reviewer's own organisation. */
  org: string;
  /** A reviewer or admin holding the case for internal triage; the Azienda does not see it. */
  internal: boolean;
}

/** Who may own a case about this Azienda: its approved members, and the current reviewers and admins. */
export async function findingOwners(orgCode: string): Promise<FindingOwner[]> {
  const service = createServiceRoleClient();
  const memberships = await service.from("user_organizations").select("user_id,org_code").eq("status", "approved");
  if (memberships.error) throw Error("owners");
  const byUser = new Map<string, string[]>();
  for (const m of memberships.data ?? []) byUser.set(m.user_id as string, [...(byUser.get(m.user_id as string) ?? []), m.org_code as string].sort());
  const owners: FindingOwner[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw Error("owners");
    for (const u of data.users as LiveUser[]) {
      const orgs = byUser.get(u.id);
      if (!orgs || !usable(u)) continue;
      const name = typeof u.user_metadata?.full_name === "string" && u.user_metadata.full_name.trim() ? u.user_metadata.full_name.trim() : u.email!;
      if (orgs.includes(orgCode)) owners.push({ id: u.id, label: name, org: orgCode, internal: false });
      else if (internal(u.email)) owners.push({ id: u.id, label: name, org: orgs[0], internal: true });
    }
    if (data.users.length < 1000) return owners.sort((a, b) => Number(a.internal) - Number(b.internal) || a.label.localeCompare(b.label));
  }
  throw Error("owners_limit");
}

/** The address an assignment or a reminder goes to; null for a user who can no longer sign in. */
export async function findingOwnerEmail(id: string): Promise<string | null> {
  const { data, error } = await createServiceRoleClient().auth.admin.getUserById(id);
  if (error || !data.user) return null;
  const u = data.user as LiveUser;
  return usable(u) ? u.email! : null;
}
