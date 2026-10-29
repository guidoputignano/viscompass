import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findingOwnerEmail } from "@/lib/dashboard-review/actions/server";
import { findingTitle, type FindingCase } from "@/lib/dashboard-review/actions/model";
import { sendFindingOverdueEmail } from "@/lib/email/vis-email";

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`), given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Daily (vercel.json): one email to the owner of each case past its due date, once per case, due date and owner.
 * Called by Vercel Cron with the project's CRON_SECRET; without that secret it does nothing. It serves no data. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return reply({ error: "not_configured" }, 503);
  if (!authorized(request.headers.get("authorization"), secret)) return reply({ error: "forbidden" }, 401);
  try {
    const service = createServiceRoleClient();
    const today = new Date().toISOString().slice(0, 10);
    const overdue = await service.from("finding_cases").select("id,source,owner_id,due_date")
      .in("state", ["assigned", "in_review", "decision_recorded"]).lt("due_date", today).order("due_date").limit(200);
    if (overdue.error) throw Error("storage");
    let claimed = 0, sent = 0;
    for (const c of (overdue.data ?? []) as Pick<FindingCase, "id" | "source" | "owner_id" | "due_date">[]) {
      // Claimed before sending, so two runs never send the same reminder; a failed send is logged, not retried.
      const claim = await service.rpc("finding_reminder_claim", { p_case: c.id, p_due: c.due_date, p_owner: c.owner_id });
      if (claim.error || claim.data !== true) continue;
      claimed++;
      const email = await findingOwnerEmail(c.owner_id!);
      if (email && (await sendFindingOverdueEmail(email, findingTitle(c.source), c.due_date!, c.id).catch(() => ({ sent: false }))).sent) sent++;
    }
    console.info(JSON.stringify({ event: "finding_reminders", overdue: overdue.data?.length ?? 0, claimed, sent }));
    return reply({ overdue: overdue.data?.length ?? 0, claimed, sent });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
