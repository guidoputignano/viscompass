# ABC–VEN: the mapping mechanism

Status: **implemented**, 24 September 2026. No VEN classification is asserted by
this document or by the product, and none can be until a panel supplies one.

The mechanism proposed below is now built:

- `lib/analytics/ven.ts` — the criteria quoted from MDS-3 chapter 40.3, the
  versioned mapping type, `validateVenMapping`, `resolveVen` with five explicit
  states, `venCoverage`, and `abcVenMatrix`, which refuses to draw below a
  coverage threshold and returns the excluded products with their spend.
- `supabase/migrations/20260924_ven_mapping.sql` — the same rules as database
  constraints, RLS on, and no client-facing INSERT or UPDATE: loading and
  approval happen server-side with the service-role key.
- `tests/ven.test.mjs` — 11 tests covering malformed rows, conflicting classes,
  self-approval, 9-digit AIC handling, validity-period edges, every unmapped
  state, coverage, and the matrix's refusal on partial coverage.
- `data/provenance/ven-criteria.json` — the retrieved source and its digest.

The criteria turned out to be published and were the only part that needed
finding. What remains is not a software gap: it is items 1–5 at the end of this
document, all of which are human decisions.

Today `resolveVen` returns `no_approved_mapping` for every product, which is the
truthful state, and the matrix does not draw.

This responds to the feedback request to "develop the ABC-VEN analysis for
antibiotics [which] combines financial expenditure tracking with therapeutic
criticality". It proposes how a VEN classification would be *obtained, versioned
and validated*. It deliberately proposes no V/E/N assignments, because the
project may not produce them: VEN is a therapeutic-criticality judgement.

## What the two cited papers actually do

Both were fetched and read rather than characterised from memory.

**PMC8477259** — *Antibiotic procurement and ABC analysis for a comprehensive
primary health care clinic in the Eastern Cape province, South Africa.* Tier:
`VERIFIED-SOURCE`.

This paper performs **ABC analysis only. It contains no VEN analysis and no
ABC–VEN matrix.** Its therapeutic axis is the WHO AWaRe categorisation
(Access / Watch / Reserve / antituberculosis), not VEN — the authors combine ABC
with the WHO EML "to investigate whether antibiotics being dispensed belong to
the 'Access' and 'Watch' categories". Its ABC cutoffs are A 75–80% of
expenditure, B 15–20%, C 5–10%. Setting: one primary-health-care clinic,
31–35 antibiotics per year, 2015–2018.

Consequence: this paper is a precedent for what the product **already does**
(ABC by spend, presented beside AWaRe, with neither treated as a ranking of
clinical value). It is not a precedent for VEN.

**PMID 36829254 / PMC10129016** — *Analysis of pharmaceutical inventory
management based on ABC-VEN analysis in Rwanda: a case study of Nyamagabe
district*, J Pharm Policy Pract, February 2023. Tier: `VERIFIED-SOURCE`.

This one does perform an ABC–VEN matrix, but note the setting: a medical-supply
distribution branch (Rwanda Medical Supply Ltd, Nyamagabe), across all product
categories over FY2017/18–2019/20 — not a hospital antibiotic formulary. Its
ABC result was A = 19.84% of items carrying 74.91% of cost.

The load-bearing finding for us is its method. **The VEN assignment was made by
"judgmental methods", by asking health professionals against "existing
references".** It was not computed from the cost data. The paper does not publish
its V/E/N criteria, and its own methodology section concedes this.

That concession is the failure mode the mechanism below exists to prevent. An
ABC–VEN matrix whose VEN axis cannot be traced to a named source and a named
reviewer is not auditable, and under this project's rules it is not publishable.

## The rule this establishes

**VEN cannot be derived from anything the product holds.**

- ABC is a ranking of spend concentration. It measures money, not criticality.
- AWaRe is a stewardship categorisation about resistance risk. Access/Watch/
  Reserve is not Vital/Essential/Non-essential, and mapping one onto the other
  would be inventing a clinical judgement — a Reserve antibiotic may be the only
  vital option for one patient group and non-essential to a formulary that never
  treats that organism.
- No staged or supplied source in this repository contains a VEN column.

So VEN enters the product only as an **input supplied by a clinician panel**, or
not at all. Until one is supplied and approved, every product stays explicitly
unmapped and no ABC–VEN matrix is rendered.

## Proposed mechanism

Each step mirrors a pattern already in the codebase, so this introduces no new
trust model.

### 1. Versioned mapping, never edited in place

A `ven_mapping` table keyed by `(mapping_version, scope_key)` where `scope_key`
is an ATC5 code or an AIC, carrying `ven_class` constrained to `V`, `E`, `N`,
plus `source_hash`, `supplied_by`, `supplied_at`, `status`.

This follows the existing `release_id` convention in
`supabase/migrations/20260923_private_pillar_a.sql` and the versioned-reference
convention in `lib/analytics/pillar-a-local-perimeter.json`. A new panel decision
is a new `mapping_version`; an existing version is never mutated, so any figure
ever shown can be reproduced against the mapping that produced it.

`supabase_schema.sql` is append-only (AGENTS.md), so this is a new numbered
section, not an edit to an existing one.

### 2. Submission constrained by value, not identity

A clinician may INSERT only rows with `status = 'pending'` and with
`approved_by` / `approved_at` null. Approval is written **only** by the
service-role key server-side, with no client-facing UPDATE policy.

This is the same treatment already applied to memberships, feature requests and
upload reconciliation, and it exists because self-approval was a real escalation
bug in this codebase. An INSERT policy that constrains identity but not values
would let a submitter approve their own clinical classification.

### 3. Ingestion validation that fails loudly

A staging script that:

- hashes the supplied file and refuses to overwrite an existing
  `mapping_version` — "release already exists: no overwrite";
- asserts every `ven_class` is exactly one of `V`, `E`, `N`, rejecting the file
  on anything else rather than coercing it;
- asserts every `scope_key` resolves inside the declared perimeter
  (`lib/analytics/pillar-a-local-perimeter.json`, 78 J01 codes), reporting
  unknown keys rather than dropping them;
- records who supplied it and when, and does not accept a file with no named
  supplier.

This mirrors `assertLegend()` in `load_antibiotic_consumption.mjs`: a source that
changes shape aborts the load instead of silently producing nulls.

### 4. An explicit unmapped state, in the type system

```
ven:        "" | "V" | "E" | "N"
ven_status: "approved_mapping_match"
          | "not_in_approved_mapping"
          | "ambiguous_in_approved_mapping"
          | "no_approved_mapping"
```

`no_approved_mapping` is the state today, for every product.

The precedent is exactly how AWaRe residuals are already handled on `/pillar-a`:
`Da disambiguare` and `Non trovato nel riferimento` are rendered as their own
labelled count chips, excluded from every share denominator, and the page states
how many codes were excluded. Unmapped VEN must be equally visible — an item
with no approved classification is not "non-essential", and `null` is not `0`.

### 5. Rendering rules

- No ABC–VEN matrix renders while `no_approved_mapping` holds for the perimeter.
  A partially-mapped perimeter renders the matrix only with an on-screen count of
  the unmapped items, which are excluded from every cell and every percentage.
- The matrix is private, not public: it depends on per-product spend at Azienda
  grain, which is hospital data.
- Every rendering carries the `mapping_version` and the panel that approved it.
- No quadrant is labelled with an action ("cut", "deprioritise"). The matrix
  describes where spend and declared criticality coincide; it does not
  recommend, which keeps it the same distance from clinical decision-making as
  every other module (AGENTS.md, the MDR boundary).

## What must be obtained before any of this produces output

1. **A named clinician panel** with the authority to classify for the
   perimeter — a pharmacy-and-therapeutics committee, or Alberto nominating one.
2. **The criteria they applied**, published with the mapping. This is the thing
   the Rwanda paper omitted, and omitting it makes the result unauditable.
3. **The reference list** used, if any, with its edition.
4. **The perimeter and period** the classification is valid for, since criticality
   is a property of a formulary and a case mix, not of a molecule in the abstract.
5. **A re-review interval**, because the panel's judgement expires.

Items 1–5 are a human decision and are outside what this project may decide for
itself. Until they arrive, ABC ships alone — which is exactly what PMC8477259
does, and it is a published, defensible position rather than a gap.

## What is implemented today

Nothing from this document. The current state is a correct negative guardrail:
no VEN table, column, type or claim exists anywhere in the product, and
`/pillar-a` states in Italian that ABC describes spend concentration and AWaRe
describes stewardship, and that neither is a general ranking of efficacy.
