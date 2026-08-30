"use server";

// Server Actions callable directly from Client Components. Kept in their
// own file (rather than alongside the plain functions in queries.ts)
// because a file mixing Server Actions with regular server-only exports
// gets pulled into the client bundle whole when a Client Component
// imports it — Next.js only treats a file as an action-only boundary when
// every export is a Server Action, which is what the top-level
// "use server" here declares.

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import type { CanonicalFact, FeatureRequestSubmission } from "./types";

export async function searchMolecules(query: string): Promise<CanonicalFact[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = await createClient();
  const like = `%${q}%`;
  const columns = ["active_substance", "brand_name", "aic", "atc4", "atc5"] as const;

  // One query per column rather than a single .or(...) filter string built
  // from user input — building that string by concatenation would let a
  // search term containing a comma or parenthesis break out of the
  // intended clause and inject unrelated filter conditions.
  const results = await Promise.all(
    columns.map((col) => supabase.from("canonical_fact").select("*").ilike(col, like).limit(200)),
  );

  const byId = new Map<number, CanonicalFact>();
  for (const { data, error } of results) {
    if (error) throw new Error(`canonical_fact search failed: ${error.message}`);
    for (const row of (data ?? []) as CanonicalFact[]) {
      byId.set(row.id, row);
    }
  }
  return Array.from(byId.values());
}

// submitted_by and org_code both come from the live session, never from
// client input. submitted_by must match the feature_requests INSERT
// policy's `submitted_by = auth.uid()` check.
// status/response/responded_by/responded_at are never set here: they
// either default ('pending') or must stay null on insert per the same
// policy.
export async function submitFeatureRequest(
  payload: FeatureRequestSubmission,
): Promise<{ ok: true }> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    throw new Error("Devi essere autenticato per inviare una richiesta.");
  }

  const org = await getCurrentOrg();

  const { error } = await supabase.from("feature_requests").insert({
    submitted_by: authData.claims.sub,
    org_code: org?.org_code ?? null,
    description: payload.description,
    decision_impact: payload.decision_impact,
    frequency: payload.frequency,
  });
  if (error) throw new Error(`feature_requests insert failed: ${error.message}`);
  return { ok: true };
}
