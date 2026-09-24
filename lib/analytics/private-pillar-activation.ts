// Activation gate for the private Pillar A workbook route.
//
// This is a deliberate constant rather than an environment variable. Activation
// is a recorded approval, so flipping it belongs in a reviewable commit that
// cites the evidence — not in a dashboard setting that can drift between
// environments or be enabled by accident.
//
// ACTIVATED 24 September 2026, release `closure-20260923`. The four conditions
// this file previously listed were met and evidenced against the live database.
//
//   1. Schema applied. ven_mapping, pillar_a_private_fact and
//      pillar_a_private_product_fact all exist with RLS both ENABLED and
//      FORCED. Enabled-but-not-forced would let the table owner read straight
//      past the policy, so both were asserted, not just the first.
//
//   2. Import reconciled: 48 aggregate rows (org x year x AWaRe) and 1,316
//      product rows (org x year x AIC). Verified IN THE DATABASE, not in the
//      JSON that produced it. A+W+R equals T on cf, cmr and ddd in all 12
//      org-year groups; the product grain sums to the aggregate T row in all 12
//      groups and all 36 org-year-AWaRe cells — the stricter test, because
//      totals can agree while the A/W/R split is wrong; all 238 AIC keep their
//      leading zero; ddd = qmr x ddd_aic on every row. 27 of 27 checks PASS.
//
//      Those comparisons use IS DISTINCT FROM over a FULL OUTER JOIN. An inner
//      join with <> drops a missing row from the comparison entirely, leaving
//      the disagreement count at zero and reporting PASS having compared
//      nothing. That exact false pass was observed during this work and fixed.
//
//   3. Isolation proven by impersonation, NOT by the service-role key: the
//      service role bypasses RLS, so it can confirm rows exist but can never
//      demonstrate that ASL 201 cannot read ASL 202. 15 of 15 checks PASS,
//      inside a transaction that was rolled back, so no fixture survived.
//
//      Both arms of the policy were exercised and that coverage was asserted
//      rather than assumed — the dangerous outcome here is not a FAIL, it is a
//      vacuous PASS where a branch was never tested and the report still looks
//      clean. ASL 201 sees exactly '201'. Regione 130 sees exactly
//      '201,202,203,204'. Anonymous refused (42501). No membership and pending
//      membership both read zero rows: approval is the gate, not membership.
//      All three INSERT probes refused BY GRANT (42501), not by a CHECK
//      constraint — a constraint refusal would have meant the write was
//      permitted and merely malformed, hiding a missing grant.
//
//   4. This constant set to true.
//
// ven_mapping is intentionally EMPTY. MDS-3 ch.40.3 publishes the V/E/N
// criteria, but the assignments are a per-formulary clinician judgement. Until
// a panel supplies them and a second person approves them, resolveVen returns
// 'no_approved_mapping' and the ABC-VEN matrix declines to draw. That is the
// truthful state, not a gap to be filled in later with a guess.
export const PRIVATE_PILLAR_A_ACTIVE = true;

// Postgres "relation does not exist". Distinguished so that an unapplied
// migration reports itself truthfully instead of looking like a read failure.
export const UNDEFINED_TABLE = "42P01";
