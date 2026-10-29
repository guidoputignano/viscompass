import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { cEvidenceJson, cEvidenceSameOrigin } from "@/lib/dashboard-review/pillar-c/evidence-server";
import { cEvidenceRpcError } from "@/lib/dashboard-review/pillar-c/evidence-priority";
import { findingCandidates, findingKey, findingOwnerEmail, findingOwners, findingSource, findingViewer, FINDING_HEADERS, FINDING_UUID } from "@/lib/dashboard-review/actions/server";
import { allowedActions, findingTitle, memberCanSee, validDueDate, type FindingAction, type FindingCase } from "@/lib/dashboard-review/actions/model";
import { sendFindingAssignedEmail } from "@/lib/email/vis-email";

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: FINDING_HEADERS });
const failed = (error: Parameters<typeof cEvidenceRpcError>[0]) => { const e = cEvidenceRpcError(error); return reply({ error: e.code }, e.status); };
/** Postgres "relation does not exist": the migration is not applied yet, which the workspace says plainly. */
const missing = (error: { code?: string } | null) => error?.code === "42P01";
const ACTIONS: ReadonlyArray<FindingAction> = ["assign", "start", "record_decision", "close", "reopen"];

export async function GET() {
  const viewer = await findingViewer().catch(() => null);
  if (!viewer) return reply({ error: "forbidden" }, 403);
  try {
    const service = createServiceRoleClient();
    if (viewer.kind === "member") {
      const cases = await service.from("finding_cases").select("*").in("org_code", [...viewer.orgs]).order("updated_at", { ascending: false }).limit(500);
      if (missing(cases.error)) return reply({ schema: "finding-workspace-v1", active: false, viewer: { kind: "member" } });
      if (cases.error) throw Error("storage");
      const visible = (cases.data as FindingCase[]).filter((c) => memberCanSee(c, viewer.orgs));
      return reply({ schema: "finding-workspace-v1", active: true, viewer: { kind: "member", id: viewer.id }, cases: visible.map((c) => ({ ...c, allowed: allowedActions(c, viewer) })), candidates: null });
    }
    const [cases, loaded] = await Promise.all([
      service.from("finding_cases").select("*").order("updated_at", { ascending: false }).limit(500),
      // Without the findings (a release switching, a read failing) the existing cases stay workable.
      findingCandidates().catch((cause) => { console.error(JSON.stringify({ event: "finding_candidates_error", error: cause instanceof Error ? cause.message.slice(0, 80) : "error" })); return null; }),
    ]);
    if (missing(cases.error)) return reply({ schema: "finding-workspace-v1", active: false, viewer: { kind: "reviewer" } });
    if (cases.error) throw Error("storage");
    const rows = cases.data as (FindingCase & { source_key: string })[];
    const byKey = new Map(rows.map((c) => [c.source_key, c.id]));
    const candidates = loaded?.candidates.map((c) => ({ ...c, case_id: byKey.get(findingKey(c.kind, loaded.release, c.asl_code, c.subject)) ?? null })) ?? null;
    return reply({
      schema: "finding-workspace-v1", active: true, viewer: { kind: "reviewer", id: viewer.id },
      cases: rows.map((c) => ({ ...c, allowed: allowedActions(c, viewer) })),
      candidates, release: loaded?.release ?? null, year: loaded?.year ?? null, withheld: loaded?.withheld ?? [],
    });
  } catch { return reply({ error: "unavailable" }, 503); }
}

/** Opens (or returns) the case of one finding of the active release. Reviewer or admin only. */
export async function POST(request: NextRequest) {
  const viewer = await findingViewer().catch(() => null);
  if (!viewer || viewer.kind !== "reviewer" || !cEvidenceSameOrigin(request)) return reply({ error: "forbidden" }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return reply({ error: "invalid" }, 400);
  const body = await cEvidenceJson(request, 2048).catch(() => null);
  if (!body || Object.keys(body).sort().join("|") !== "asl_code|kind|subject" || !["biosimilar", "benchmark"].includes(body.kind)
    || typeof body.asl_code !== "string" || typeof body.subject !== "string" || body.subject.length > 160) return reply({ error: "invalid" }, 400);
  try {
    const source = findingSource(await findingCandidates(), body);
    if (!source) return reply({ error: "not_found" }, 404);
    const saved = await createServiceRoleClient().rpc("finding_case_create", { p_actor: viewer.id, p_source: source });
    return saved.error ? failed(saved.error) : reply({ case: saved.data });
  } catch { return reply({ error: "unavailable" }, 503); }
}

/** One step on a case. The server decides who may take it; the database checks the transition. */
export async function PATCH(request: NextRequest) {
  const viewer = await findingViewer().catch(() => null);
  if (!viewer || !cEvidenceSameOrigin(request)) return reply({ error: "forbidden" }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 6000) return reply({ error: "invalid" }, 400);
  const body = await cEvidenceJson(request, 6000).catch(() => null);
  if (!body || Object.keys(body).sort().join("|") !== "action|caseId|payload|revision" || typeof body.caseId !== "string" || !FINDING_UUID.test(body.caseId)
    || !Number.isSafeInteger(body.revision) || body.revision < 1 || !ACTIONS.includes(body.action)
    || !body.payload || Array.isArray(body.payload) || typeof body.payload !== "object") return reply({ error: "invalid" }, 400);
  try {
    const service = createServiceRoleClient();
    const found = await service.from("finding_cases").select("*").eq("id", body.caseId).maybeSingle();
    if (found.error) throw Error("storage");
    const current = found.data as FindingCase | null;
    // A member never learns that a case they may not see exists.
    if (!current || (viewer.kind === "member" && !memberCanSee(current, viewer.orgs))) return reply({ error: "not_found" }, 404);
    if (!allowedActions(current, viewer).includes(body.action)) return reply({ error: "forbidden" }, 403);
    let payload = body.payload as Record<string, unknown>;
    let owner: Awaited<ReturnType<typeof findingOwners>>[number] | undefined;
    if (body.action === "assign") {
      if (Object.keys(payload).sort().join("|") !== "due_date|owner_id") return reply({ error: "invalid" }, 400);
      if (!validDueDate(payload.due_date, new Date().toISOString().slice(0, 10))) return reply({ error: "due_date" }, 422);
      owner = (await findingOwners(current.org_code)).find((o) => o.id === payload.owner_id);
      if (!owner) return reply({ error: "owner" }, 422);
      payload = { owner_id: owner.id, owner_org: owner.org, due_date: payload.due_date };
    }
    const saved = await service.rpc("finding_case_mutate", { p_actor: viewer.id, p_case: body.caseId, p_expected: body.revision, p_action: body.action, p_payload: payload });
    if (saved.error) return failed(saved.error);
    const next = saved.data as FindingCase;
    // The assignment stands whether or not the email goes out; the reply says which.
    let notified: boolean | null = null;
    if (body.action === "assign" && owner && owner.id !== viewer.id) {
      const email = await findingOwnerEmail(owner.id);
      notified = email ? (await sendFindingAssignedEmail(email, findingTitle(next.source), next.due_date!, next.id).catch(() => ({ sent: false }))).sent : false;
    }
    return reply({ case: { ...next, allowed: allowedActions(next, viewer) }, notified });
  } catch { return reply({ error: "unavailable" }, 503); }
}
