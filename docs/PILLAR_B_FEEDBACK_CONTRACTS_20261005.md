# Pillar B — measure and disclosure contracts for the evidence-gated feedback items

Companion to `PILLAR_B_GUIDO_ALBERTO_FEEDBACK_TRACKER_20261005.md`. The tracker's
second group (PB-GA-07, 08, 10, 11, 13, 15, 16) asks for a measure or an access
decision before anything is plotted. This document writes each contract down so
it can be approved, proved on the frozen workbook and in authenticated sessions,
and only then wired. Nothing here is implemented; nothing here is a migration.
No figure from the confidential workbook or ledger appears in this file (the
repository is public).

Standing rules every contract inherits: never a realised saving, a causal
effect or a forecast; missing is not zero; 2026 (January–May) is never
comparable; no AIFA list price as a local net price; adoption only as the two
validity-gated denominators side by side (a status-based biosimilar share is a
forbidden third denominator); an Azienda never receives another Azienda's rows
or identity; Regione sees other Aziende as ASL 1–4, the three approved reviewers
see real names; Italian formatting only through `lib/dashboard-review/format.ts`.

---

## PB-GA-07 · Spend composition per Azienda (biosimilar euros against a "total")

**Question the reviewers asked.** "A comparison on the amount of biosimilar and
the total amount of the drugs that has been deployed by the ASL."

**What "total" can mean, and the choice to make first.**

| Candidate denominator | Per Azienda, per year | Status |
| --- | --- | --- |
| A. Whole ledger (every row of the Azienda) | available now via `pillar_b_facets` totals narrowed by `asl_code` | allowed; it is the ledger share, not an adoption share |
| B. Biosimilar + reference spend by status (the classified perimeter) | available via the perimeter facet narrowed by `asl_code` | **the numerator divided by B is the forbidden third denominator** when the numerator is the biosimilar status spend |
| C. The two validity-gated denominators | `pillar_b_value_uptake_scoped` narrowed by `asl_code` | already published as "adoption"; selecting the Azienda in the filter bar shows both |

**Contract (if approved).** A *spend composition* panel per Azienda with three
euro amounts and two shares, never called uptake or adoption:

- `biosimilar_eur` = spend of rows with `perimeter_status = 'biosimilar'`;
- `reference_eur` = spend of rows with `perimeter_status = 'reference_medicine'`;
- `ledger_eur` = all rows of the Azienda under the same year and channel filters;
- printed shares: `biosimilar_eur ÷ ledger_eur` and `(biosimilar_eur + reference_eur) ÷ ledger_eur`
  — both of the whole ledger (denominator A). The ratio `biosimilar_eur ÷ (biosimilar_eur + reference_eur)`
  is **not** printed and the two status euros are never sent to a client component
  that could divide them (the `AziendaPanelRow` rule in `facets.ts` already enforces this).

**Data path.** One `pillar_b_facets` call per Azienda with `["perimeter"]`,
under the viewer's RLS; for a Regione or reviewer the panel lists every Azienda
in scope; for an Azienda viewer only itself. No new function, no migration.

**Proof before wiring.** Harness: for each Azienda and year, `biosimilar_eur +
reference_eur` equals the perimeter of bridge B for that scope (b46 section B
already proves the perimeter two ways); shares recomputed in SQL agree to the
cent. Live: a reviewer session and an Azienda session, the latter showing one
row only.

**Wording.** "Composizione della spesa per Azienda: quanto del libro mastro è
biosimilare, quanto è perimetro. Non è una misura di adozione: quella è nelle
due quote con regola di validità."

---

## PB-GA-08 · Same-year regional comparator in the channel composition

**Request.** Replace the pooled cross-year "Totale" bar (removed in `ada403d`)
with the Region's composition so one Azienda is read against the Region.

**Measure.** For each year selected: the channel shares of (a) the selected
Azienda and (b) the whole visible Region, computed on the same filters
(year, molecule), each summing to 100% on its own population. Never a pooled
year; never a share of a different denominator in the same bar.

**Disclosure contract — who may see the regional bar.**

| Viewer | Regional comparator | Why |
| --- | --- | --- |
| Approved reviewer (allow-list) | yes, real names | widened scope already authorised |
| Regione account | yes, as "Regione" | its own scope |
| Azienda account | **not until approved**: the regional aggregate is computed from other Aziende's rows | needs an explicit decision that a four-Azienda aggregate does not identify a peer; with four Aziende a reader who knows two can bound the other two |

An approved aggregate for an Azienda viewer must be computed **server-side under
the service-role client in the reviewer branch pattern** (`scope.ts`), returned
as three channel shares and a total only, with no asl codes, and the page must
say "Regione (4 Aziende)" without naming them. Until approved, the Azienda view
shows its own years only and says why (the lead already does).

**Proof before wiring.** Harness: regional shares equal the facets channel
breakdown over all four Aziende for the same year and molecule; each bar sums
to 100%; an Azienda session's HTML and JS chunks contain no other Azienda's
euros or codes (the public-surface test pattern). Live: reviewer, Regione and
Azienda sessions.

---

## PB-GA-10 · The Italian milestone, not the EU date

**Request.** Compare when a biosimilar was "published in Italy" with its first
observed local use, instead of the EU authorisation date.

**Three different events — the contract must name one.**

| Event | Source of record | Granularity |
| --- | --- | --- |
| EU marketing authorisation of the first biosimilar of the substance | EMA EPAR (already the validity basis of `classification_valid_from`) | date |
| AIFA authorisation / classification of the biosimilar product (AIC, class, reimbursement; Gazzetta Ufficiale determination) | AIFA determinations, Gazzetta Ufficiale, AIFA Banca Dati Farmaci | date, per AIC |
| First marketing / first availability in Italy (effective commercialisation) | AIFA "farmaci in commercio" lists, company notices; weaker and later | month, per AIC |

The reviewers' phrase "originally published in Italy" is closest to the AIFA
classification determination in Gazzetta Ufficiale. The contract: **milestone =
date of the AIFA determination that classifies the first biosimilar AIC of the
substance for reimbursement (class A/H)**, versioned with the determination
number and the Gazzetta issue, stored per AIC in a provenance-tagged reference
table (a migration, under explicit authorisation only).

**What may not be done meanwhile.** The EU date may not be relabelled "disponibile
in Italia"; a first use in January 2024 may not be called a first-ever use (the
release starts there: left-censored); no gap may be called a delay or a missed
saving.

**Proof before wiring.** Every substance of the perimeter has either a sourced
milestone or an explicit "non reperito"; the milestone is never later than the
first observed local use without a note; the harness reconciles the per-AIC
table against the taxonomy (B03) AIC list.

---

## PB-GA-11 · Region-first versus Azienda-first observed use, with the gap

**Request.** For a substance (ustekinumab was the example), show when the
Region first used a biosimilar and when the selected Azienda did, and the gap.

**Measure.** Three months per substance, all "first observed in the release":
`first_region` = min over the visible Aziende of the first biosimilar
dispensing month; `first_azienda` = the selected Azienda's; `gap_months` =
`first_azienda − first_region` (null when either is missing). Plus, when
PB-GA-10 lands, `milestone_it`. The `opened` clock in
`pillar_b_value_uptake_scoped` already yields `first_azienda` per scope; the
regional one is the same call without `p_asl_code`.

**Disclosure.** For a reviewer or Regione: both months and the gap, real names
or ASL 1–4 as today. For an **Azienda viewer**: the regional first month is an
aggregate over peers; it reveals that *some* peer switched earlier, not which.
Treat as the PB-GA-08 decision: allowed only after the owner approves the
four-Azienda aggregate; until then the Azienda sees its own clock and the
Region's **month only if approved**.

**Censoring.** A first month equal to the first month of the release (2024-01)
is marked "≤ 2024-01" (left-censored); a substance never observed in a scope
gets "non osservato nel rilascio", never a gap of zero.

**Wording.** "Mesi fra il primo biosimilare osservato nella Regione e nell'Azienda
selezionata. È un intervallo osservato nel rilascio, non un ritardo clinico né
un risparmio mancato."

**Proof before wiring.** Harness: `first_region` equals the minimum of the four
per-Azienda clocks for every substance; gaps recomputed in SQL; left-censored
rows flagged. Live: ustekinumab in a reviewer session and in an Azienda session.

---

## PB-GA-13 · Regional comparator in the adoption comparison

**Request.** Selected-Azienda values beside the Region's in the per-molecule
adoption chart, with exact euros in details (the exact values part landed in
`ba18fb0`: every dot carries its two quotas and reference euros, and the timeline
has an exact-values table).

**Measure.** For each substance: the two quotas (validity-gated, locally-observed)
and their euros for the selected Azienda, and the same for the whole visible
Region, under the same year and channel filters. Both are already produced by
`pillar_b_value_uptake_scoped` with and without `p_asl_code`; the window rule is
per scope (the Region's window opens at the earliest Azienda), which the page
already states.

**Disclosure.** As PB-GA-08/11: reviewer and Regione now; Azienda viewer only
after the aggregate is approved, and then as euros and quotas for "Regione (4
Aziende)" without peer names or codes. Never a ranking of Aziende.

**Proof before wiring.** Harness: the regional row per substance equals the
service-role call without `p_asl_code` (b45/b46 pattern); the four per-Azienda
window references sum to at most the regional date-valid reference; live checks
in three session types.

---

## PB-GA-15 · Management review queues

**What landed now, as presentation of validated measures (`2570ad7`).**
Two lists under the bridge, per molecule, each row linking to the molecule's
evidence: (1) biosimilar already in use here with reference spend after its
first local use (sums to B_ADDRESSABLE_REFERENCE); (2) biosimilar EU-authorised,
not observed in this release in the visible Aziende, with date-valid reference
spend (with the pre-switch months of the switched molecules, sums to B4).
The first is an organisational review question; the second is an EU-status
evidence question, not an Italy-ready alternative. Neither is a saving or a
prescribing instruction. They are reconciled to the bridge gates in the unit test
and in harness b46 section D on the real release, in every page scope.

**What stays gated.** A third queue, "evidence and coverage questions"
(unresolved substances, withheld volume groups, undated validity), is a
presentation of sheets 07/08/12 material that is partly blocked (sheet 08) and
is deferred until the comparability gates are live. A queue status per
molecule ("in revisione", "chiusa", with an owner) is **application state**
that the page does not hold: it needs a table, a policy and a migration.

---

## PB-GA-16 · B4 and the Italian status

**Request.** `B4_eu_authorised_never_bought_here` is not useful without the
Italy-specific status.

**Contract.** Keep B4 as the audit gate (sheet 09's identifier and arithmetic
are unchanged, reconciled to the cent). On the page it is already worded "non
ancora acquistato qui" and its review list says "non osservato in questo
rilascio" and that the EU authorisation says nothing about Italy. Once
PB-GA-10's milestone table exists, the list splits into: (a) classified in
Italy before the period and not observed here; (b) classified during the
period, not observed here (with the month); (c) no Italian classification found
(not an opportunity). Until then no row is presented as an Italy-ready
alternative.

---

## The nine HTML prototypes

Read in full on 5 October 2026. They are visual references only. Every one of
them embeds concrete euro and percentage figures inline with no stated source;
several carry wording the project forbids (price-cut effects, a scenario
amount, a forecast, a 95% interval on a counterfactual, an Azienda ranking, a
status-based biosimilar share, a 29-month pooled window that adds the 2026
partial year). They are **not** committed to this repository and must not be
served from it. Ideas worth reusing, and the gate before each:

| Prototype | Reusable idea | Gate |
| --- | --- | --- |
| watchlist by substance | substance-level list with a data-availability category kept apart from any judgement; first-biosimilar year in the label | no "converted / slow" verdicts; the Italian milestone (PB-GA-10) before any "available" status |
| volume vs value uptake | plot quantity share against spend share per unit so divergence is visible without naming a price | only on the 16 reconciled volume pairs, per unit and stratum; no "price as % of reference" |
| monthly spend and coverage | two panels on one month axis; 2026 nulls shaded and labelled | already covered by the calendar and coverage views; keep 2026 comparison-free |
| price-cut propagation | dumbbell per product across Aziende with redundant shape encoding | no "cut", "wave" or propagation narrative; unit-value changes are observations, cross-Azienda detail stays access-controlled |
| raw vs standardised uptake | hollow/filled dumbbell for before/after an adjustment | sheet 16 not live; no ranking |
| expenditure change bridge | floating-bar waterfall with formulas under each label; residual kept distinct | sheet 13 needs a provenance-tagged result; no "lowers spend / saving" reading of a price term |
| opportunity funnel | remaining bar + dropped segment + one-line reason per step; tier labels | the validated bridge stops at a population of spend; no "Scenario A" amount or interval |
| spend overview | expandable ranking rows with definitions; concentration curve with thresholds | each measure independently; no projection, price effect or opportunity claim |
| comparability exclusions by gate | bars by gate id with a remediation class | sheet 08 gates not live; the ledger total must not be published |
