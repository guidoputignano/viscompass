# Pillar A — remediation of the outstanding feedback points

Date: 2026-09-23. Baseline: `c6053f5`. Source document: `Feedback v1.docx`,
SHA-256 `4cabcbd5a6e4f63a39d23c71c86d63b403aeac38389f7e75ceb58c8fc84708ea`.

This pass addresses the feedback points that were still open after the
2026-09-23 checkpoint recorded in `PILLAR_A_CLOSURE_PLAN.md`. Points already
satisfied at that checkpoint were left untouched; where a point was only
partly satisfied, the existing implementation was kept and the missing part
added rather than rebuilt.

## Confidentiality — the point with a consequence beyond presentation

The reviewer wrote: *"All those statistics and links are something we should
keep internally. Not like on the website. Our database is the most important
asset we can have."* Nothing had been done for this, and the deployed state was
the opposite of the request. `lib/supabase/proxy.ts` allowlisted three data
paths past authentication, and the largest of them was verified reachable with
no credentials, carrying considerably more than the page renders.

| Item | Before | After |
|---|---|---|
| `/data/pillar-a.json` | 2,364,723 bytes | 707,372 bytes |
| Monthly rows published | 15,840 (2016–2025) | 3,168 (2023–2025, the only years plotted) |
| Source manifest | 20 records with SHA-256 digests | removed |
| Internal check results | published | removed |
| Activity provenance | absolute Windows paths, digests, cell references | removed |
| Full annual CSV | public download button | behind authentication |

The four internal filesystem paths were of the form
`data\raw\denominators\ministry\sdo_reports\2021\C_17_pubblicazioni_3410_1_alleg.xlsx`.

`/data/pillar-a-annual.csv` is no longer in the middleware allowlist, so an
unauthenticated request is redirected to `/auth/login`. The page's download
control now reads *"Serie annuali complete · area riservata"*. The
source panel keeps the publisher attribution, which the page's own premise
requires, but no longer carries deep links or the exact source-table
identifiers; it points to the reserved area instead. That balance is a
judgement call and is the one item here worth confirming with the reviewer.

## Points closed in this pass

- **Antitubercolari removed, not merely hidden.** The family had been dropped
  from the selector while all 440 annual rows, 5,280 monthly rows and 10 J04A
  candidates stayed in the published files — visible to anyone opening the CSV,
  where they began at line 6. `lib/analytics/pillar-a-scope.json` no longer
  declares the group, the published payloads no longer contain it, and the
  unreachable `group === "tuberculosis"` UI branch is gone.
- **Molecule-level longitudinal analysis.** A new ATC4 × year × territory ×
  channel series is published at `/data/pillar-a-atc4.json` (286,588 bytes,
  10,570 rows, 31 categories). ATC4 is the finest level AIFA publishes; the
  panel states explicitly that it groups several active substances and is not
  the single molecule, and that AWaRe classes are not derivable at this level.
- **ABC analysis.** The same series drives a spend-concentration view with
  A/B/C bands (A to 80% cumulative, B to 95%, C the remainder) and a full table
  of share and cumulative share. Nationally for 2025: band A is 6 categories
  and 78.3% of spend, B is 6 and 15.4%, C is 11 and 6.3%.
- **AWaRe composition chart.** The classification explorer keeps its existing
  category selector, counts and table, and gains a donut of the Access / Watch /
  Reserve split that recomputes for the selected ATC4 category. Codes without an
  assigned class are excluded from the shares and the exclusion is stated.
- **Objective positioning.** The PNCAR panel keeps its existing figures and
  gains the territory's rank among the 21 on both consumption intensity and
  2024/2022 change, plus how many territories are already below the −5%
  threshold, with an explicit note that a lower level is not by itself a better
  result.
- **Duplicated monthly panel.** The region-versus-Italy comparison built at the
  previous checkpoint is unchanged. The national-only panel it duplicated is now
  suppressed when a territory is selected, so only one monthly chart shows.
- **Definitions travel with the data.** `public/data/pillar-a-annual-dictionary.csv`
  documents all 13 columns of the annual export, with units and caveats.

## Reproduction

```text
node scripts/build_pillar_a_atc4_series.mjs <source-root> .
node scripts/harden_pillar_a_public_payload.mjs .
node --test tests/pillar-a-*.test.mjs
```

`build_pillar_a_atc4_series.mjs` re-reads the AIFA sources listed in
`aifa_series_manifest.json`, verifies each file's SHA-256 before use, applies the
same aggregation contract as `build_pillar_a_public_series.py`, and sums money as
scaled `BigInt` because the AIFA cells carry up to ten decimal places. It fails
unless all 880 published annual spend values re-aggregate from it within a cent.

`harden_pillar_a_public_payload.mjs` mutates the published payload in place and is
**not** idempotent across a regeneration: it must run after
`build_pillar_a_public_series.py`, otherwise the source manifest, the internal
check results and the full monthly range return to the public file.

## Verification

TypeScript check clean; `next build --webpack` succeeded; Pillar A tests 21
passed, 0 failed, 2 skipped (the pre-existing optional-fixture skips). Rendering
was confirmed against a production server: ABC bands, donut shares (84 + 130 + 26
= 240 classified), the ranking line for Abruzzo (13th on intensity, 14th on
change) and the single monthly panel. `eslint` could not run — its configuration
is broken on the baseline commit, independently of these changes.

## Not addressed, and why

- **ABC-VEN.** Needs a validated clinical VEN classification. None exists in any
  staged or supplied source, and VEN is a therapeutic-criticality judgement that
  must not be produced here. ABC ships without it.
- **The Azienda-level workbook points** (the deviations plot for ASL 201–204, the
  per-Azienda decomposition, the year-by-year ASL comparison, the two
  decomposition plots side by side). Each refers to the reviewer's own workbook
  screenshots of Aziende 201–204. That work depends on the private view reverted
  in `be93729` under an explicit instruction, and remains parked; reactivating it
  is a separate decision. The reviewer's own confidentiality point above argues
  against placing any of it on the public page.
- **Hospital-level positioning.** No entity below ASL exists in the data model,
  so ranking a hospital against its peers is not possible without the private
  work above.
