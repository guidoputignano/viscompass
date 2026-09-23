// Activation gate for the private Pillar A workbook route.
//
// The route, its analytics and its charts are complete in source, but the
// `pillar_a_private_fact` table has never been created in Supabase and the
// owner's approval for private activation has not been recorded. Shipping the
// route in that state puts a navigation entry in front of every approved user
// that leads straight to an error boundary, because the query in
// app/dashboard-review/pillar-a/page.tsx throws when the relation is absent.
//
// This is a deliberate constant rather than an environment variable. Activation
// is a recorded approval, so flipping it belongs in a reviewable commit that
// cites that approval — not in a dashboard setting that can drift between
// environments or be enabled by accident.
//
// To activate, in one commit:
//   1. apply supabase/migrations/20260923_private_pillar_a.sql
//   2. run the guarded import and reconcile the row count
//   3. exercise logged-out / pending / own-ASL / other-ASL / regional / admin
//      sessions against a real Postgres instance, including adversarial reads
//   4. set this to true, citing the approval in the commit message
export const PRIVATE_PILLAR_A_ACTIVE = false;

// Postgres "relation does not exist". Distinguished so that an unapplied
// migration reports itself truthfully instead of looking like a read failure.
export const UNDEFINED_TABLE = "42P01";
