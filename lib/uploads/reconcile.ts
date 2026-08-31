// Reconciles an upload against canonical_fact: compares the totals the
// uploaded file declares against the corresponding canonical_fact rows
// for the same org/period, and records the outcome.
//
// BLOCKED: canonical_fact has no real rows yet, so there is nothing to
// compare against. Implementing a comparison now would mean writing a
// check that can only ever report "no discrepancy" against an empty
// table — indistinguishable from a real pass, which is worse than not
// implementing it. Left as an explicit TODO; wire in the actual
// comparison once canonical_fact is populated.
//
// When implemented, this will need the service-role client to write the
// result back — uploads has no client-facing UPDATE policy at all (see
// supabase_schema.sql section 5), so status/reconciliation_summary/
// reconciled_at can only ever be set server-side, the same way
// feature_requests responses are.
export async function reconcileUpload(uploadId: number): Promise<void> {
  // TODO(canonical_fact population): fetch the upload row by uploadId,
  // sum canonical_fact.total_cost_eur (and any other declared totals) for
  // its org_code + period_covered_start/end, compare against the
  // upload's own declared totals, and update the uploads row via
  // createServiceRoleClient() with status 'reconciled' or
  // 'discrepancy_found', a reconciliation_summary, and reconciled_at.
  void uploadId;
}
