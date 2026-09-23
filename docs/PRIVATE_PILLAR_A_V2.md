# Private Pillar A v2 integration

Status: implemented locally, not activated or deployed. Database migration,
private import, live adversarial RLS tests and authenticated browser verification
remain release gates. The user was asked to confirm activation for existing
approved organizational memberships; no new memberships are proposed.

The new `/dashboard-review/pillar-a` route is additive. The public page and
existing antibiotic route are unchanged. No private values enter Git or public
assets. Request-scoped Supabase queries use the user's session, never service
role. RLS controls access; a further query scope selects the primary membership
to avoid mixing multiple approved memberships. No shared data cache is used.

Source: the previously audited five-file package dated 23 September 2026.
The private staging script verifies source hashes and reconciles 48 aggregate
rows to the 1,316 product-level derivatives. Regional source totals are not
imported. A new versioned table preserves the older 48-row workbook import.

CF and CMR are distinct cost bases. DDD is QMR multiplied by source DDD_AIC.
Activity is the workbook's selected A3/T1, not A2 and not automatically SDO
bed-days. Regional rates use sums, with activity counted once per organization.
AWaRe is confined to source J01 antibiotics. The symmetric DDD / average-CF-per-DDD
bridge reconciles spending changes; average cost includes product mix and is
neither pure price nor savings. No private peer benchmark is exposed to ASLs.

Run `node scripts/stage_private_pillar_a.mjs` to create ignored private import
SQL and regression facts under `private-staging/closure/`. Run the independent
source audit again if source inputs change. The import refuses to overwrite a
release and asserts the existing organization mapping. Apply the migration
only once; it deliberately fails if the table already exists, requiring review.

Required live tests: own-ASL visibility; same-region regional visibility;
cross-region exclusion; pending/nonmember/anonymous denial; authenticated write
denial; imported values reconciled against staging; unauthenticated route
redirect; actual authenticated page rendering. Local arithmetic tests and a
successful build do not substitute for these checks.
