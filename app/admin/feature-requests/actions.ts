"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAdminEmail } from "@/lib/auth/admin";

export interface RespondToFeatureRequestInput {
  requestId: number;
  outcome: "answered" | "declined";
  response: string;
}

// feature_requests has no client-facing UPDATE policy at all (see
// supabase_schema.sql section 5) — by design, only the service-role key
// can set status/response/responded_by/responded_at. This action is the
// one trusted place that's allowed to do so, and it re-checks admin
// status itself: a Server Action is its own callable endpoint, so the
// page that renders the form isn't the only thing standing between an
// arbitrary caller and this write.
export async function respondToFeatureRequest(
  input: RespondToFeatureRequestInput,
): Promise<{ ok: true }> {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) {
    throw new Error("Non autorizzato.");
  }
  if (!input.response.trim()) {
    throw new Error("La risposta non può essere vuota.");
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const respondedBy = authData?.claims?.sub;
  if (authError || !respondedBy) {
    throw new Error("Sessione non valida.");
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("feature_requests")
    .update({
      status: input.outcome,
      response: input.response.trim(),
      responded_by: respondedBy,
      responded_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .eq("status", "pending"); // don't re-answer an already-answered request

  if (error) throw new Error(`feature_requests update failed: ${error.message}`);

  revalidatePath("/admin/feature-requests");
  return { ok: true };
}
