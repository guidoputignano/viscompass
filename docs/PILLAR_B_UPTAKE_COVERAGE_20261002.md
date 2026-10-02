# Pillar B volume-uptake coverage: a live defect, its fix, and the filtered measure

**2 October 2026.** Found while designing the Azienda/molecule-narrowed
coverage the owner asked for.

## The defect that was live

`pillar_b_uptake_scope(year)` returns every analytical perimeter row of the
year — the rows the volume measure **consumed plus the rows it withheld**. Its
own comment says so ("the in-scope total both of the above partition"), and the
production ledger confirms it to the cent for 2025:

| | rows | spend |
|---|---|---|
| used (`pillar_b_uptake_rows`) | 1,416 | €7,469,067.17 |
| withheld (`pillar_b_uptake_withheld`) | 5,523 | €28,747,938.98 |
| scope (`pillar_b_uptake_scope`) | **6,939** | **€36,217,006.15** |

`getUptake` nevertheless computed the withheld share as **withheld ÷ (scope +
withheld)** and handed the whole scope to the coverage chart as "used". The
live card read **"Utilizzata 54,8 % · €76.415.744 / Trattenuta 45,2 %"** for
2024 + 2025. The truth: used **€13,267,183 = 17.4 %**, withheld **82.6 %**. The
coverage of the volume measure was overstated three-fold, and the "Uptake
parziale" notice in the method section repeated the wrong share.

This shipped with the Gate 3 read layer before the review page existed. Neither
b36/b38 (value uptake) nor the two adversarial reviews looked at it; the b42
harness now does.

## The fix

One pure helper, `uptakeCoverage(scopeSpend, withheldSpend)` in
`review-data.ts`, is the only place the share is formed: used = scope −
withheld, share = withheld ÷ scope. `getUptake`, the page's year merge and the
new coverage path all use it; the chart receives `usedSpendEur`. Pinned by a
unit test on the 2025 figures.

## The filtered measure (migration `20261003130000`, DORMANT until applied)

`pillar_b_uptake_coverage(p_year, p_asl_code, p_substance)` returns scope,
used and withheld rows and spend from **one left join** over
`pillar_b_uptake_rows`, so the identity cannot be broken by composing three
calls, and it narrows exactly: the eligibility rule is decided per (Azienda,
substance, route) group, so filtering the admitted rows afterwards equals
applying the rule inside the filter. SECURITY INVOKER; grants to
`authenticated` and `service_role`; revoked from `public`/`anon`.

The page calls it only when narrowed (one call per selected year). While it is
not deployed the coverage stays withheld under those filters, with a notice
naming the function.

### Harness `outputs/pillar-b/logs/b42` — 36/36 on the frozen 261,153 rows

- equals the three existing functions (scope, used, withheld; spend and rows) in 2024 and 2025
- identity scope = used + withheld in every Azienda and every substance
- Regione + `p_asl_code` == that Azienda under RLS; the four Aziende sum to the whole
- the withheld rows the page lists for an Azienda sum to its coverage's withheld figure
- an Azienda asking for another Azienda gets an empty scope; anon refused
- the production 2025 figures reproduced to the cent

## Live after `bbd78d2` (REVISORE, `www.eurekene.com`)

| state | coverage card |
|---|---|
| default (2024 + 2025) | **Utilizzata 17,4 % · €13.267.183 / Trattenuta 82,6 % · €63.148.561**, Copertura della misura 17,4 % — was 54,8 % / 45,2 % |
| `?molecola=adalimumab` | coverage withheld with the notice naming `pillar_b_uptake_coverage`; 4 groups, withheld €873.772 from the narrowed rows |
| `?ambito=201` | coverage withheld with the same notice; 7 groups, withheld €17.555.642 |

## Applied — 2 October 2026, with the owner's authorisation

Through the SQL editor of project `yxumhjfsoqfckaeydgxt` as `postgres`, one
transaction: **Success. No rows returned.** Pre-check: function absent,
release gate one row (`PILLAR-B-R2-20261001`), unchanged afterwards. No fact
rows touched, no application change needed.

| check | result |
|---|---|
| exists, `prosecdef = false`; `authenticated` / `service_role` EXECUTE; `anon` | yes; true / true; **false** (`42501` under `set local role anon`) |
| identity 2024 | €40,198,737.95 = €5,798,115.89 + €34,400,622.05 · 7,580 = 1,352 + 6,228 · residual 0 |
| identity 2025 | €36,217,006.15 = €7,469,067.17 + €28,747,938.98 · 6,939 = 1,416 + 5,523 · residual 0 |
| equals the three existing functions (2025) | scope / used / withheld identical |
| Azienda 201 under its own RLS (2025) | scope €9,505,212.03 · used €2,098,449.98 · withheld €7,406,762.06 · 1,641 rows; asking for `130202` → 0 rows |
| Regione naming `130201` (2025) | identical row |
| `EXPLAIN ANALYZE`, one Azienda | **81 ms** |

### Live after the apply (REVISORE), no deploy

| state | coverage card |
|---|---|
| `?ambito=201` | **Utilizzata 15,9 % · €3.320.987 / Trattenuta 84,1 % · €17.555.642 · 2.722 record** — the two-year sum of the harness figures; the notice is gone |
| `?molecola=adalimumab` | **Utilizzata 68,9 % · €1.936.040 / Trattenuta 31,1 % · €873.772 · 314 record**; €1.936.040 + €873.772 = €2.809.812, the molecule's perimeter total from the other RPC |
