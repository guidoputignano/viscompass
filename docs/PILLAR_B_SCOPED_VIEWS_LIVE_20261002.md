# Pillar B scoped views: production receipt, 2 October 2026

Migration `20261003090000_pillar_b_scoped_views.sql` applied to the production
Supabase project `yxumhjfsoqfckaeydgxt` through the SQL editor as `postgres`,
in one transaction: **Success. No rows returned.** No fact rows were imported,
the release gate was not touched (one row, `PILLAR-B-R2-20261001`, before and
after), and no application change was needed — the page deployed as `fc6c062`
already called the two functions and fell back to the live one while they were
absent. The fallback notices disappeared the moment the migration landed.

## Pre-check (before the apply)

| check | result |
|---|---|
| `pillar_b_value_uptake_scoped(int[],text[],text,text)` | absent |
| `pillar_b_facets(int[],text[],text,text,text[])` | absent |
| `pillar_b_value_uptake(int,text,text)` | present, unchanged by this migration |
| release gate rows / id | 1 / `PILLAR-B-R2-20261001` |
| `service_role` SELECT on `canonical_fact`, EXECUTE on the live function | already true (Supabase default privileges) — the reviewer path had been working on them; the migration now states these grants explicitly |

## What was applied

- `pillar_b_value_uptake_scoped(p_years int[], p_channels text[], p_substance, p_asl_code)` — the B05 measure with an explicit year set (a null raises `P0001`), a channel subset and an optional Azienda; `opened` clock narrowed by the same Azienda.
- `pillar_b_facets(p_years, p_channels, p_substance, p_asl_code, p_facets)` — spend by month / Azienda / channel / perimeter status / substance from one scan, one jsonb row.
- Grants to `authenticated` and `service_role`; EXECUTE revoked from `public` and `anon`; `ANALYZE public.canonical_fact`.

## Database-side checks (SQL editor, `postgres`, no statement timeout)

| check | result |
|---|---|
| both functions exist, `prosecdef = false` (SECURITY INVOKER) | yes |
| `authenticated` EXECUTE / `service_role` EXECUTE | true / true |
| `set local role anon` → `pillar_b_facets` | `42501 permission denied` |
| `pillar_b_value_uptake_scoped(null, …)` | `P0001 p_years must name the years to aggregate` |
| 29 months, date-valid biosimilar / reference / T2 reference | **€29,228,420.73 / €44,796,546.96 / €20,322,838.90** (B05) |
| two-year date-valid share, 28 substances, 14,519 perimeter rows | **37.70 %**, boundary €920,130.50, outside €14,177,593.85 |
| facets 29 months: total / Aziende / months | **€1,078,943,265.79 / 4 / 29** |
| facets month cells 2024-01, 2024-10, 2025-07 | €35,844,989.60 / €42,249,995.64 / €38,794,280.37 (sheet 03) |
| `EXPLAIN ANALYZE` facets, two years, asl + channels + perimeter | **1,257 ms** |
| `EXPLAIN ANALYZE` scoped uptake, two years, Azienda 130201 | **37 ms** |

A note on one verification query: summing `inside_biosimilar_eur + …` without
`coalesce` returned 50.09 % for the two-year share, because a substance with no
biosimilar spend carries a NULL that swallows the whole row. The function is
right (b39 reconciles 37.70 % with null→0); the saved verification SQL now
coalesces every term.

## Live checks through the signed-in browser (REVISORE, `www.eurekene.com`)

| state | result |
|---|---|
| default | migration notice gone; Spesa rendicontata **€887,736,230 · 217,148 records · 1,773 substances** (= 2024 + 2025 exactly); comparable **78.8 %**; calendar 2024 435.0 M / 2025 452.7 M / 2026 *5 mesi · parziale*; Azienda bars for the four Aziende by real name; channel shares 2024 CO 31.6 / DD 50.0 / DPC 18.4 and 2025 30.5 / 51.8 / 17.7 (sheet 05); perimeter rows outside €804,406,712 (5,254 AIC) · reference €53,299,500 (78) · biosimilar €23,116,244 (154) · unresolved €2,813,530 (111) · same-substance non-biosimilar €2,191,335 (4) · unclassified €1,908,909 (0 AIC — the non-AIC keys), summing to the total; adoption 37.7 % / 56.9 % |
| `?ambito=201` | the Azienda filter now reaches adoption: **€5,043,628 / €12,217,014 = 29.2 %**, T2 **€2,450,486 = 67.3 %**, held-out €3,615,986, 26 molecules, 3,435 records — identical to the figures the account showed while wrongly scoped to Azienda 201, now reached by choice; Spesa rendicontata €201,006,795 · 47,470 records · 81.5 % comparable; Azienda bars hidden for a single Azienda; quick-pick hints and the timeline lead name the Azienda |
| `?ambito=202&canale=CO,DD` | the combination the fallback could not honour: **€4,048,017 / €7,775,696 = 34.2 %**, T2 **€2,312,783 = 63.6 %**, held-out €6,787,173, 25 molecules, 2,010 records; Spesa rendicontata €189,486,375 · 41,811 records · 77.6 % comparable; channel composition CO 40.7 / DD 59.3 (no DPC); calendar 2024 93.0 M / 2025 96.5 M / 2026 partial; no notice of any unapplied filter; 8.8 s |

Every live figure equals `outputs/pillar-b/logs/b41_live_facets_expectations.mjs`
computed on the frozen rows through the same pure modules.

## Latency (browser, `responseEnd`)

Reviewer default **15.0 s**, narrowed to one Azienda **8.4 s**. The page's
awaits are serial: spend + funnel → molecules → uptake per year → scoped uptake
×2 → facets ×2. The two Region-scale `pillar_b_molecule_spend_json` calls
(~5 s each) dominate; the facets calls add ~2.5 s at the end. Issuing the
independent groups together would cut the chain without any statement nearing
the `authenticated` role's 8 s timeout. This is a page-logic change, left for
the next iteration so as not to collide with the layout work in progress.

## Not changed

No re-import. No release-gate change. No UI change. The eight workbook sheets
of statistical results (B06–B16) remain un-imported pending the owner's
decision on a provenance-labelled import.
