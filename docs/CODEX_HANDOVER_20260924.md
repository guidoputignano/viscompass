# Handover to Codex — 24 September 2026

Supersedes the state described in the Codex checkpoint at `58ffab3`. Read
`CLAUDE.md` / `AGENTS.md` first; the anonymization section below explains why.

---

## State

`origin/main` = `52249ae`, in sync with `release/pillar-a-public-20260920`.
Seven commits landed this pass, from `8fddb2a` to `52249ae`.

Verified: `node node_modules/typescript/bin/tsc --noEmit` clean · full runtime
suite clean · `node node_modules/next/dist/bin/next build --webpack` clean · the
private section checked in a browser against a real authenticated ASL session ·
**production at https://www.eurekene.com confirmed serving the new build.**

`main` auto-deploys to Vercel `viscompass-217a`. Pushing to `main` is a
production deployment — this pass did so at the technical lead's explicit
instruction ("make it go live"), which departs from the earlier handover's
"do not push work-in-progress to main". Treat that instruction as spent, not
standing.

**Rebase before touching anything.** Uncommitted work in the tree predates all
seven commits: `lib/uploads/reconcile.ts`,
`components/dashboard-review/upload-shell.tsx`,
`lib/analytics/private-pillar-product.ts`, `scripts/stage_private_pillar_a.mjs`,
`AGENTS.md`, `.gitignore`, `tests/reconcile.test.mjs`,
`tests/private-pillar-product.test.mjs`, plus untracked
`docs/PILLAR_A_FINAL_AUDIT_20260924.md`.

One note: `pillar-a-products.tsx` and `private-product-charts.tsx` were untracked
while `pillar-a-workbook.tsx` already imported them, so `HEAD` was unbuildable
from a clean checkout and only worked locally because the files sat on disk.
Committed in `bde83e2`. Newer versions win; just do not delete them.

---

## Read CLAUDE.md before editing any UI label

A hardcoded `{'201':'ASL 1', ...}` map was removed this pass in the belief it was
a placeholder. It was implementing the **anonymization rule** — "in every
external-facing artifact the four Abruzzo ASLs are labelled ASL 1-4, with no
Region named". That reached production before the rule was known, and was
reversed in `52249ae`.

Current behaviour, chosen by the technical lead:

- A viewer sees its **own** Azienda by real name. It already knows who it is, and
  `nav.tsx`, the access portal and the admin centre show it anyway.
- **Every other** organization is pseudonymous — ASL 1-4.
- Resolved **server-side** in `lib/analytics/org-pseudonym.ts`. Pseudonymising in
  the browser would ship the very names it withholds. Verified live: signed in as
  ASL 201, the strings `LANCIANO`, `PESCARA` and `TERAMO` appear nowhere in
  `document.documentElement.innerHTML`.
- An unmapped `org_code` falls back to the code, never an invented label. This
  implements the earlier checkpoint's "extend via a reviewed server-issued
  mapping for new cohorts": a new cohort needs a reviewed mapping, and an
  unmapped organization should be visibly unmapped rather than silently given
  someone else's pseudonym.

`tests/org-pseudonym.test.mjs` pins this, including the property that no real
Azienda name survives into rendered output.

---

## Done this pass — do not redo

**Private Pillar A is activated and live.** 48 aggregate + 1,316 product rows,
release `closure-20260923`.

- Data verification 27/27. A+W+R equals T on cf, cmr and ddd in all 12 org-year
  groups; the product grain sums to the aggregate T row in all 12 groups **and**
  all 36 org-year-AWaRe cells; all 238 AIC keep their leading zero;
  `ddd = qmr x ddd_aic` on every row.
- Isolation 15/15, by impersonation inside a rolled-back transaction — not with
  the service-role key, which bypasses RLS and could never show that ASL 201
  cannot read ASL 202. Both policy arms exercised with coverage **asserted**:
  ASL 201 sees exactly `201`, regione 130 sees exactly `201,202,203,204`.
  Anonymous refused 42501; no-membership and pending both read zero; all three
  INSERT probes refused **by grant** (42501), not by a CHECK constraint.
- Scripts in `private-staging/closure/activation/` (git-ignored).

**Approval status is an open item.** The earlier handover recorded that private
activation awaited Guido's approval. This pass activated it under repeated,
explicit direction from the technical lead, who ran the SQL themselves. Whether
Guido's approval was separately obtained is unknown here and should be confirmed
on the record.

**Guido feedback items 1-4.**

| # | Item | Outcome |
|---|---|---|
| 1 | Is population year-matched? | A question, not a defect. Verified `populations.get((year, region))` — 2023 spend over 1 Jan 2023 population. No code change. |
| 2 | Where did "201" come from? | The Region's own workbook, not a public source. Invisible until activation. Labels now resolve per the rule above. |
| 3 | Plot PNCAR per ASL | **Partially** addressed. Per-ASL comparison shipped; the PNCAR indicator itself is blocked — see below. |
| 4 | Year selector too far from the plot | Moved under the Sankey description, above the chart. Live. |

**Hardcoded year windows removed** across `queries.ts`,
`antibiotici/page.tsx`, `antibiotic-analysis-charts.tsx`,
`private-pillar-charts.tsx`, `pillar-a-flow-visuals.tsx`, `private-pillar-a.ts`.

The serious one was `queries.ts:1085`: `.gte("year",2023).lte("year",2025)` meant
an organization whose only year was 2026 got zero rows and fell through to
`getSyntheticAntibioticStewardship()` — demo figures shown under a
"Dati autorizzati" pill. Six sibling functions already derived their window from
the data; this was the sole outlier.

`private-pillar-a.ts` carried `[2023, 2024, 2025]` in three places including the
row validator, so a 2022 baseline row — the year the data request asks for —
would have thrown `Invalid private source record`.

**The test script ran 6 of 14 files.** `pillar-a-*` never matches
`private-pillar-*`, so `private-pillar-a`, `private-pillar-product`, `ven`,
`reconcile` and `abc-bands` had never run. Now `node --test`.

---

## Settled — do not re-litigate

**PNCAR is not reconcilable to our SDO series.** Disproved, not merely
unverified, across four research lenses with each claim checked against its
primary source.

- PNCAR indicator 2.3 asks for a **>5% reduction** 2025 vs 2022 — a *relative*
  target — and the plan **specifies no denominator at all**.
- The only operational definition is OSMED's: SDO ordinary-regime days in
  **public hospitals only**, plus day hospital / day surgery, **not** restricted
  to acute care.
- Our series is all-institute and acute-only: mismatched on **two axes at once**.
- Not correctable. Giornate are never published by region x tipo istituto, and
  discharge shares do not substitute — public is 74.4% of acute ordinary
  discharges but 81.3% of giornate.
- Reproduction test on Abruzzo: the SDO denominator misses OSMED's published
  figure by **-14.7% (2023)** and **-7.8% (2024)**, and the implied OSMED
  denominator moves in the **opposite direction** year over year. A constant
  offset would be correctable; a sign-changing one is not.
- The numerator differs too, **-17.8% to +41.5%** across these four Aziende,
  because one procures centrally and acquisti attach to the buyer.

**Never draw the 78.76 line on a per-ASL chart.** It appears in no source: it is
computed at runtime as that territory's OSMED 2022 rate x 0.95
(`components/pillar-a-osmed.tsx`). It is now labelled "riferimento derivato".

Full reasoning: `docs/PNCAR_DENOMINATOR_DATA_REQUEST.md`.

**`ven_mapping` stays empty.** MDS-3 ch. 40.3 publishes the V/E/N *criteria*;
the assignments are a per-formulary clinician judgement. `resolveVen` returning
`no_approved_mapping` and the matrix declining to draw is correct behaviour, not
a gap to be filled with a guess.

**`lib/analytics/pillar-a-osmed-rank.ts` no longer claims** that no per-structure
denominator exists "in any source the project holds". It does:
`hospital_structure_activity_2022.csv` carries `giornate_degenza` per structure
with `codice_asl` across 53 ASLs. It remains unusable — 2022 only against
2023-2025 consumption, no accessi column where OSMED needs ordinary days plus
DH/DS, and it does not reconcile to regional totals — but "nothing exists" is the
kind of claim that stops the next reader looking.

---

## Remaining, in priority order

1. **Narrow the data request.** `docs/PNCAR_DENOMINATOR_DATA_REQUEST.md` asks for
   three things; only **item 1, the 2022 workbook year**, is actually justified.
   The PNCAR target is relative, so 2022 on the existing A3/T1 denominator
   answers it without solving OSMED at all. Items 2 and 3 serve level
   comparability, which the numerator divergence means they would not deliver
   anyway. Recipients are unresolved: probably routed via the Region, and the
   items split across pharmacy versus flussi informativi / controllo di gestione.
2. **Mark the ISTAT series break** at 2018/2019 (intercensal reconstruction to
   POSAS) in `components/pillar-a-public.tsx`. The methodology panel discloses
   it; the chart does not. A line crossing a definition change looks continuous
   when it is not.
3. **VEN draft.** WHO EML 2025 carries 50 antibiotics, 10 Reserve; **8 of those
   10 are in this release, covering 40.6% of spend**. Loading an EML-derived
   draft as `status='pending'` — never `approved` — would hand the panel a cited
   starting point instead of a blank sheet. The schema already supports it and
   `resolveVen` will keep ignoring it until a second person approves.
4. **Guido feedback answers for items 3 and 4.** Items 1 and 2 are drafted.
5. **Commit the generators.** The scripts that produced the 1,316-row import
   exist only in a session scratchpad, and `private-staging/` is git-ignored.
   Nobody can regenerate this for a future release. The artefact outlives the
   thing that made it.
6. **The SDO audit script silently drops riabilitazione and lungodegenza** —
   18.5% of national giornate in 2024, with the acute share swinging from 66.1%
   to 91.9% across regions. It lives in the sibling `../viscompass` repo.

---

## Blocked on a human

- **Guido's Colab notebook.** The link does not resolve — Drive returns "file not
  found" on both readings of the ID. A `.ipynb` export would settle whether the
  per-ASL comparison matches what he had in mind; his note says it shows
  "multiple possibilities".
- **The four open Region questions** in `CLAUDE.md` remain open. Do not answer
  any of them by inference.
- **`canonical_fact` is still 0 rows.** That, not the four Region questions, is
  what blocks upload reconciliation: a comparison against an empty table always
  agrees, so `reconcileRows` reports the comparison unavailable rather than
  claiming a pass it has not earned.
- **Confirm Guido's approval** for the private activation is on the record.
