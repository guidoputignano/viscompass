-- 11. canonical_fact — Pillar B provenance and comparability
-- Append-only. Every statement is idempotent, so applying this twice, or
-- applying it after the same DDL has been appended to supabase_schema.sql, is
-- safe and is exercised by the Gate 2 idempotency test.
--
-- WHY THESE COLUMNS EXIST
--
-- The Pillar B release imports 261,153 frozen rows of which only 260,089 are
-- analytical, and of the analytical rows only part can carry a comparable unit
-- cost. Dropping the rest at load would make the table's totals disagree with
-- the source ledger, which is the one thing this project exists to prevent. So
-- every row is loaded and the reason it is or is not usable travels WITH the
-- row.
--
-- The key design decision is `comparable_eligible`. A query that forgets a
-- filter is the likeliest way a non-comparable row reaches a published €/unit
-- figure, so eligibility is not left to the caller's discipline: it is a
-- generated-by-check column that CANNOT be true unless the row is analytical
-- and carries no exclusion reason. The database refuses the bad state rather
-- than trusting every future query to exclude it.
--
-- Nullable throughout, so Pillar A rows and any row loaded before this section
-- existed are unaffected.
-- ============================================================

-- Which lane the source row is in. `analytical` rows are AIC-keyed and may enter
-- analysis; `non_aic` rows are keyed by something that is not a 9-digit AIC
-- (bare ATC7, E-/G-prefixed codes, truncated stems) and carry real spend that
-- must stay in the ledger total while never entering a product comparison.
alter table canonical_fact add column if not exists source_disposition text;
alter table canonical_fact add column if not exists source_key_class   text;

-- B03 perimeter. `unresolved` is a real, preserved answer: it is never collapsed
-- to originator and never dropped. Blank biosimilar status in the source does
-- NOT mean confirmed originator.
alter table canonical_fact add column if not exists perimeter_status         text;
alter table canonical_fact add column if not exists perimeter_evidence_grade text;

-- When the classification became valid. Only a minority of AICs carry one, and a
-- null here means "not established", never "valid from the beginning of time".
alter table canonical_fact add column if not exists classification_valid_from date;

-- B04 comparability. `comparable_stratum_id` identifies the stratum within which
-- a unit cost may be compared; `exclusion_reason` is the bridge-A class that
-- removed the row from comparability (A0..A6), null when nothing excluded it.
alter table canonical_fact add column if not exists comparable_stratum_id text;
alter table canonical_fact add column if not exists exclusion_reason      text;

-- The structural gate. See the note above: this is why a forgotten WHERE clause
-- cannot publish an excluded row.
alter table canonical_fact add column if not exists comparable_eligible boolean not null default false;

-- B04-compatible quantity, in the stratum's own unit.
--
-- quantity_packs is a COUNT OF PACKAGES and is not a quantity share: one pack of
-- 1x40mg and one pack of 6x40mg are one package each and six times apart in drug.
-- Any uptake or volume figure built on packages across different presentations is
-- measuring the wrong thing.
--
-- comparable_quantity is taken from the independently parsed presentation in
-- b04_comparable_quantity, NOT derived by division. An earlier version derived it
-- and "verified" the derivation by multiplying the quotient back by the same
-- total -- x/y*y == x, which cannot fail; checked against the parser's own
-- presentation factor it disagreed for 764 pairs. That claim is retracted and
-- must not be restated. comparable_unit carries the unit so a figure can never be
-- summed across MG, UI, MCG and PACK.
alter table canonical_fact add column if not exists comparable_quantity numeric;
alter table canonical_fact add column if not exists comparable_unit     text;

-- The source quantity, with its basis NOT asserted.
--
-- canonical_fact.quantity_packs is named for packages. The source column this
-- release loads is `q`, and what `q` COUNTS is not established: the B04 parser
-- infers packages-or-units per group from price consensus, and 1,628 of 5,314
-- AICs carry more than one inferred convention across their own groups. Writing
-- that value into a column called quantity_packs, and summing it as "confezioni",
-- asserts a fact nobody has confirmed.
--
-- So the raw value is kept here under a neutral name with its basis stated, and
-- `quantity_packs` is populated ONLY where the package count is established. The
-- product publishes no aggregate package figure until the Region confirms what
-- the source quantity counts (open question 5).
alter table canonical_fact add column if not exists source_quantity       numeric;
alter table canonical_fact add column if not exists source_quantity_basis text;

alter table canonical_fact drop constraint if exists canonical_fact_source_quantity_basis_check;
alter table canonical_fact add constraint canonical_fact_source_quantity_basis_check
  check (source_quantity_basis is null or source_quantity_basis in (
    'packages',   -- the parse determined q counts packages (INFERRED, not confirmed)
    'units',      -- the parse determined q counts dispensing units (INFERRED)
    'mixed',      -- this product's groups carry more than one inferred convention
    'unknown'     -- no parse available
  ));

-- Whether the two independent parses AGREE on the quantity basis.
--
-- The B04 parser decides per group whether the source `q` means packages or
-- units, by price consensus; 1,628 of 5,314 AICs carry more than one convention
-- across their groups, while the strata applied one convention per AIC. Where
-- the two disagree beyond floating-point noise the quantity basis is genuinely
-- ambiguous, and the source's own quantity semantics are an open question to the
-- Region, not something a loader may settle. Those rows keep their comparability
-- and their spend, and carry NO normalized quantity: uptake withholds them by
-- name rather than averaging over a basis nobody has confirmed.
alter table canonical_fact add column if not exists quantity_basis_status text;

alter table canonical_fact drop constraint if exists canonical_fact_quantity_basis_check;
alter table canonical_fact add constraint canonical_fact_quantity_basis_check
  check (quantity_basis_status is null or quantity_basis_status in (
    -- NAMES MATTER HERE. `parses_agree` means exactly that the two independent
    -- parses reconcile. It does NOT mean the Region has validated what the source
    -- quantity counts: both parses could agree on an inference that is wrong.
    -- An earlier value named 'agreed' invited precisely that misreading.
    'parses_agree',
    'parses_conflict',   -- the two parses disagree; quantity withheld
    'absent'             -- no parsed presentation at all
  ));

-- A quantity may only be present when the basis is agreed.
alter table canonical_fact drop constraint if exists canonical_fact_quantity_requires_agreement;
alter table canonical_fact add constraint canonical_fact_quantity_requires_agreement
  check (comparable_quantity is null or quantity_basis_status = 'parses_agree');

-- What the money actually is. `C` in this source is a weighted average cost
-- INCLUSIVE OF VAT and GROSS of payback and AIFA registry credit notes. It is
-- not a net price and must never be presented as one, nor compared with an AIFA
-- reference price as though the two were the same quantity.
alter table canonical_fact add column if not exists cost_gross_status text;

-- ---------------------------------------------------------------- vocabularies
-- A closed vocabulary is what stops a future loader inventing a sixth perimeter
-- status, or silently promoting `unresolved` to `reference_medicine`.

alter table canonical_fact drop constraint if exists canonical_fact_source_disposition_check;
alter table canonical_fact add constraint canonical_fact_source_disposition_check
  check (source_disposition is null or source_disposition in ('analytical','non_aic'));

alter table canonical_fact drop constraint if exists canonical_fact_perimeter_status_check;
alter table canonical_fact add constraint canonical_fact_perimeter_status_check
  check (perimeter_status is null or perimeter_status in (
    'biosimilar',
    'reference_medicine',
    'non_biosimilar_same_substance',
    'outside_biosimilar_perimeter',
    'unresolved'
  ));

alter table canonical_fact drop constraint if exists canonical_fact_exclusion_reason_check;
alter table canonical_fact add constraint canonical_fact_exclusion_reason_check
  check (exclusion_reason is null or exclusion_reason in (
    'A0_non_analytical_key',
    'A1_no_quantity_observation',
    'A1b_cost_mismatch',
    'A2_conflict_quarantined',
    'A3_coherence_contradiction',
    'A4_route_not_agreed',
    'A5_pack_not_agreed',
    'A6_no_comparable_presentation_or_quantity'
  ));

alter table canonical_fact drop constraint if exists canonical_fact_cost_gross_status_check;
alter table canonical_fact add constraint canonical_fact_cost_gross_status_check
  check (cost_gross_status is null or cost_gross_status in (
    'gross_incl_vat_pre_payback',
    'net_of_payback',
    'unspecified'
  ));

-- The invariant that makes the gate structural rather than advisory.
--
-- NOTE on comparable_unit: it is deliberately NOT required here. Comparability
-- is membership of a comparable stratum, which reconciles exactly to the frozen
-- bridge. Whether a normalized quantity could be parsed is a separate axis; a
-- row can be comparable and still have no usable quantity, and uptake withholds
-- it by name rather than by pretending it is not comparable.
--
-- The stratum is part of it. An earlier version required only that the row be
-- analytical and unexcluded, which would have admitted an analytical row with a
-- NULL comparable_stratum_id — a row marked comparable with nothing to compare
-- it within. Eligibility means "this row belongs to a named comparable stratum",
-- so the constraint says exactly that, and the null-stratum case is tested.
alter table canonical_fact drop constraint if exists canonical_fact_comparable_eligible_check;
alter table canonical_fact add constraint canonical_fact_comparable_eligible_check
  check (
    comparable_eligible = false
    or (
      source_disposition = 'analytical'
      and exclusion_reason is null
      and comparable_stratum_id is not null
    )
  );

-- ---------------------------------------------------------------------- indexes
create index if not exists idx_canonical_fact_comparable
  on canonical_fact (comparable_eligible) where comparable_eligible;
create index if not exists idx_canonical_fact_perimeter_status
  on canonical_fact (perimeter_status);
create index if not exists idx_canonical_fact_source_version
  on canonical_fact (source_version_id);

-- ---------------------------------------------------------------------- comments
comment on column canonical_fact.source_disposition is
  'analytical (AIC-keyed, may enter analysis) or non_aic (real spend, never comparable).';
comment on column canonical_fact.perimeter_status is
  'B03 perimeter. unresolved is preserved, never collapsed to originator.';
comment on column canonical_fact.classification_valid_from is
  'Null means not established, never valid-from-forever.';
comment on column canonical_fact.exclusion_reason is
  'Bridge-A class that removed this row from comparability; null when nothing did.';
comment on column canonical_fact.comparable_eligible is
  'Structural gate. Enforced by check constraint: cannot be true for a non-analytical or excluded row.';
comment on column canonical_fact.cost_gross_status is
  'What the money is. gross_incl_vat_pre_payback is NOT a net price and is not an AIFA reference price.';

comment on column canonical_fact.comparable_quantity is
  'Quantity in comparable_unit. NOT packages: packages are not comparable across presentations.';
comment on column canonical_fact.comparable_unit is
  'MG/UI/MCG/PACK/... Never sum or rank across different values of this column.';

comment on column canonical_fact.source_quantity is
  'The raw source quantity. Its basis is NOT asserted - see source_quantity_basis.';
comment on column canonical_fact.source_quantity_basis is
  'INFERRED by the parser, never confirmed by the Region. mixed = this product carries more than one inferred convention.';
comment on column canonical_fact.quantity_basis_status is
  'parses_agree means the two independent parses reconcile. It does NOT mean the source definition is validated.';
