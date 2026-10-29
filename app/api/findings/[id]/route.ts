import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findingOwners, findingViewer, FINDING_HEADERS, FINDING_UUID } from "@/lib/dashboard-review/actions/server";
import { allowedActions, memberCanSee, type FindingCase } from "@/lib/dashboard-review/actions/model";

/** One case with its history, for a viewer who may see it. A reviewer also gets who may own it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: FINDING_HEADERS });
  const viewer = await findingViewer().catch(() => null);
  if (!viewer) return json({ error: "forbidden" }, 403);
  const { id } = await params;
  if (!FINDING_UUID.test(id)) return json({ error: "invalid" }, 400);
  try {
    const service = createServiceRoleClient();
    const found = await service.from("finding_cases").select("*").eq("id", id).maybeSingle();
    if (found.error) throw Error("storage");
    const c = found.data as FindingCase | null;
    if (!c || (viewer.kind === "member" && !memberCanSee(c, viewer.orgs))) return json({ error: "not_found" }, 404);
    const [events, owners] = await Promise.all([
      service.from("finding_events").select("revision,action,actor_id,created_at,payload:detail->payload").eq("case_id", id).order("revision", { ascending: false }).limit(200),
      viewer.kind === "reviewer" ? findingOwners(c.org_code) : Promise.resolve(null),
    ]);
    if (events.error) throw Error("storage");
    const rows = (events.data ?? []) as { actor_id: string; payload: Record<string, unknown> | null }[];
    // Names for the people in this case's history only, never a directory.
    const ids = [...new Set([c.owner_id, ...rows.map((e) => e.actor_id), ...rows.map((e) => e.payload?.owner_id)].filter((v): v is string => typeof v === "string"))];
    const people: Record<string, string> = {};
    await Promise.all(ids.map(async (uid) => {
      const { data } = await service.auth.admin.getUserById(uid);
      const u = data?.user;
      const name = typeof u?.user_metadata?.full_name === "string" && u.user_metadata.full_name.trim() ? u.user_metadata.full_name.trim() : u?.email;
      people[uid] = name ?? "Utente non più attivo";
    }));
    return json({ case: { ...c, allowed: allowedActions(c, viewer) }, events: rows.reverse(), people, owners });
  } catch { return json({ error: "unavailable" }, 503); }
}
