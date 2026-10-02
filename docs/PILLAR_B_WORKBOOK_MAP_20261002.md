# Pillar B workbook map: the 25 sheets in four states

**2 October 2026.** Workbook `VIS_PillarB_Analytical_R2.xlsx` (SHA-256
`334d2aa5…`, 25 sheets, extracted verbatim to the evidence repository as
`derived/workbook_r2_sheets.json`; read-only). Live release
`PILLAR-B-R2-20261001`. Figures from the workbook are deliberately not quoted here: this repository is public, and every workbook-derived figure stays behind login (owner decision, 2 October 2026). The per-cell reconciliations are in the local evidence repository (`outputs/pillar-b/logs`).

The owner asked for every sheet to be placed in one of four states. The
state is that of the sheet's **full** content; where a headline is live and a
breakdown is not, the note says so. The same map is rendered on the private
page (section *Dalla visualizzazione alla fonte* → "Il workbook, foglio per
foglio") from `lib/dashboard-review/pillar-b/workbook-map.ts`, and pinned by
`tests/pillar-b-workbook-map.test.mjs`.

| state | meaning | sheets |
|---|---|---|
| **Evidenza e audit** | documentation, verification or a published refusal; not an analysis to render | 00, 01, 07b, 19, 22, 23 |
| **Analisi riservata implementata** | computed on the live ledger by an RLS-bound RPC and reconciled to the sheet (harnesses b36–b43) | 03, 04, 05, 06, 07, 10, 11, 12, 24 |
| **Implementabile con le funzioni autenticate attuali** | derivable from an RPC already applied, not yet labelled | 09 |
| **Bloccato: contratto dati o migrazione** | a frozen statistical result (Python) or a cross-Azienda table that needs either a provenance-tagged import or a new SQL function | 08, 13, 14, 15, 16, 17, 18, 20, 21 |

Tally: 6 · 9 · 1 · 9 = 25.

## Sheet by sheet

| # | Sheet | Holds | State | On the page | Note |
|---|---|---|---|---|---|
| 00 | README | release notes, bases, period | evidence | provenance line in *Fonte* | |
| 01 | Verification | Excel re-sums | evidence | superseded by harness b39 (re-sums on the live ledger) | |
| 03 | Spend_by_Period | monthly totals | implemented | *Panorama* → monthly profile (bars; period and metric controls) | every month to the cent (b39, b44); 2026 drawn alone, flagged partial, never compared |
| 04 | Spend_by_ASL | 4 Aziende × 3 years | implemented | *Panorama* → Aziende | every cell and total to the cent (b39, b44); real names for reviewers only |
| 05 | Spend_by_Channel | 3 channels × 3 years | implemented | *Panorama* → channels; *Spesa* → channel slope | to the cent (b41) |
| 06 | Spend_by_Molecule | substances ranked by spend | implemented | *Spesa* → molecule changes; *Concentrazione* | every substance to the cent; top-25 order exact |
| 07 | Perimeter | 5 statuses, AIC counts, spend | implemented | *Evidenza* → spend by perimeter status | counts and spend to the cent; non-AIC keys shown as "fuori dalla tassonomia" |
| 07b | B03_Candidates | candidate AICs not adopted | evidence | not shown: a record of what was not changed | |
| 08 | Bridge_A_Comparability | nine exclusion gates partitioning the ledger total | blocked | *Evidenza* → funnel (stages) | **partial**: stages live; the nine named gates with euros need a per-gate function (migration) |
| 09 | Bridge_B_Opportunity | 6 gates partitioning the same total | implementable | *Adozione* → amounts outside the two shares | T2, B1, B2 live; B0 and B4 derivable from the same RPC, not yet labelled as a bridge |
| 10 | Coverage_Cuts | comparable share by Azienda / channel / month | implemented | *Panorama* (metric "quota con quantità confrontabile") | every cut to the cent (b39, b44) |
| 11 | Date_and_Availability | inside / predates / boundary / outside; T0–T2 | implemented | *Adozione* → amounts outside the two shares; the two cards | four-way split and tiers to the cent (b36, b38, b39) |
| 12 | Uptake | value uptake on two denominators; by year; 16 volume pairs | implemented | *Adozione* | headline and by-year to the cent; coverage exact (b42); the 16 volume pairs not yet reconciled pair by pair |
| 13 | Expenditure_Change | B06 price / volume / interaction on matched strata; entry / exit | blocked | not shown; *Spesa* shows the annual change only | frozen statistical result: provenance-tagged import, or a SQL re-derivation embedding the price-plausibility adjudication |
| 14 | Benchmarks | B07: same-AIC/year/channel comparisons across Aziende | blocked | not shown | cross-Azienda table via import (Region/reviewer); "your price vs the regional minimum" needs a SECURITY DEFINER function |
| 15 | Trends_and_Adoption | B08 Newey–West slopes, business-day correction | blocked | *Adozione* → first-use timeline is the live, non-statistical counterpart | frozen statistical result |
| 16 | Heterogeneity | B09 Friedman, permutations, raw vs standardised | blocked | *Limiti*: no Azienda ranking | the conclusion (refusal of a league table) is honoured; the figures are a frozen result |
| 17 | Anomalies | B11 change points over the monthly series | blocked | not shown | import with per-Azienda rows under RLS |
| 18 | Uncertainty | B13 specification curve; bootstrap intervals | blocked | not shown | first import candidate |
| 19 | Opportunity_Scenarios | B14 scenarios A / B / C | evidence | *Limiti*: no savings figure | refusal published by the workbook, stated as such; never a realised saving |
| 20 | Exclusivity | B15: reference medicines, EU dates, years unchallenged | blocked | *Adozione* → local first use (live half); *Limiti*: not legal exclusivity | EU dates live in the frozen EMA manifest, not the ledger |
| 21 | Action_Register | B16: 6 review + 2 data actions, owner/due blank | blocked | not shown | only with honestly blank fields; no invented owners |
| 22 | Refusals | B10 no forecast; B12 no causal claim | evidence | *Limiti* | |
| 23 | Artifact_Manifest | SHA-256 of every derived artefact | evidence | provenance; harness checks inputs against the release manifest | |
| 24 | Caveats | 10 caveats | implemented | *Limiti* | as text, one per entry |

## What an import would be, if the owner decides it

Unchanged from `PILLAR_B_WORKBOOK_COVERAGE_20261002.md` in the evidence
repository: a table `pillar_b_published_result (release_id, gate, sheet,
row_key, asl_code null, payload jsonb, source_sha256, computed_at)` loaded once
from the frozen extraction, RLS by `asl_code`, the reviewer path reading all;
every rendered figure labelled "calcolato sul workbook R2 congelato (sha …),
non ricalcolato dal vivo". It is **not** a re-import of the release rows and
it is not done until the owner says so. No migration is applied under this
handover.

## What the data forbids regardless of effort

No aggregate *confezioni* (the quantity basis is mixed and partly unresolved);
no realised saving; no causal claim; no forecast; 2026 is not a year; "years
unchallenged" is not legal exclusivity; no AIFA list price as a local net
price; no case-mix adjustment.
