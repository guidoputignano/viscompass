-- Pillar B — biosimilar vs reference SPEND with the B05 monthly validity rule.
--
-- Section 14. NOT YET APPLIED TO PRODUCTION.
--
-- This replaces an earlier draft of the same migration that classified validity
-- two ways. That draft was wrong in two specific, measurable ways, and both are
-- fixed here. The frozen workbook already carries the corrected classification
-- (PILLAR_B_LEDGER.md item 7a), double-verified by logs/verify_item7a_v2.mjs
-- with no shared code — Node instead of Python, BigInt instead of Decimal,
-- month arithmetic written from scratch — reporting
-- "inside / predates / boundary / outside all four to the cent OK".
-- Those values are cited here, not recomputed.
--
--   inside           EUR 73.264.160,06   81,29%
--   predates_window  EUR    760.807,64    0,84%
--   boundary         EUR  1.109.464,65    1,23%
--   outside          EUR 14.993.664,38   16,64%
--   in-perimeter     EUR 90.128.096,72
--
-- THE RULE — three ways on a date, never two (logs/date_valid_classify.py):
--
--   valid_from <= first day of month  ->  INSIDE    valid for the whole month
--   valid_from >  last day of month   ->  OUTSIDE   not yet valid at all
--   otherwise                         ->  BOUNDARY  lands mid-month
--
-- BOUNDARY is ISOLATED AND REPORTED, never assigned to either side and never
-- dropped. We hold a monthly total and cannot split it, so attributing it would
-- be inventing a within-month split. The earlier draft silently folded boundary
-- into the reference side, which is exactly the EUR 1.109.464,65 by which it
-- overstated reference spend.
--
-- PREDATES_WINDOW — a fourth class, evidence-backed, not a null-handling default.
-- Ten enoxaparin biosimilar AICs carry no EU centralised valid_from because they
-- were authorised by the DECENTRALISED procedure. Measured on the live release
-- (logs/b37_perimeter_date_availability.mjs): 854 of 17,283 perimeter rows lack a
-- date, they are exactly those ten AICs, and their spend is exactly
-- EUR 760.807,64 — the workbook's predates_window line to the cent.
--
-- Four independent lines put their authorisation before 2024-01-01:
--   * aicRegistrationEra 2014/2015
--   * moleculeBiosimilarFrom 2016-09-14
--   * both B03 tracks recording periodValidity: valid-whole-period
--   * observed dispensing from 2024-01, which an unauthorised medicine cannot have
-- It is returned as its OWN column so nothing is absorbed into `inside`.
--
-- The earlier draft treated these rows as not-date-valid and dropped them, which
-- is exactly the EUR 760.807,63 by which it understated biosimilar spend. Two
-- errors, two cent-exact explanations.
--
-- THREE CLOCKS, KEPT APART, as the audit requires:
--   EU             `valid_from`. The only date the perimeter file carries.
--   Italian launch NOT HELD in any source. Recorded as a gap. The EU date is
--                  NOT substituted for it.
--   observed local first month the AIC appears with non-zero quantity in scope.
-- Biosimilars are EU-authorised long before they are dispensed here: UZPRUVO
-- +9 months, STEQEYMA +14, AFQLIR +16, PYZCHIVA +20/+22.
--
-- SECURITY INVOKER. RLS decides the rows; "in scope" means the caller's own
-- perimeter, so an Azienda's observed-local clock is its own first dispensing.
-- Bounded to one row per substance.

create or replace function public.pillar_b_value_uptake(
  p_year       int  default null,
  p_channel    text default null,
  p_substance  text default null
)
returns table (
  active_substance            text,
  -- date-valid = inside + predates_window. Kept as separate columns so the
  -- predates class is visible rather than absorbed.
  inside_biosimilar_eur       numeric,
  inside_reference_eur        numeric,
  predates_biosimilar_eur     numeric,
  predates_reference_eur      numeric,
  -- Isolated. Belongs to neither side.
  boundary_biosimilar_eur     numeric,
  boundary_reference_eur      numeric,
  -- Not yet valid: the reference was not yet a reference.
  outside_biosimilar_eur      numeric,
  outside_reference_eur       numeric,
  -- Undated and NOT on the evidence list. Counted as valid by nobody, reported
  -- so it cannot vanish.
  unknown_biosimilar_eur      numeric,
  unknown_reference_eur       numeric,
  -- T2: months at or after the first LOCALLY OBSERVED biosimilar dispensing,
  -- restricted to date-valid months on the same rule.
  window_biosimilar_eur       numeric,
  window_reference_eur        numeric,
  first_local_month_key       int,
  perimeter_rows              bigint,
  undated_rows                bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select
      cf.active_substance,
      cf.perimeter_status,
      cf.total_cost_eur,
      cf.aic,
      cf.classification_valid_from,
      cf.source_quantity,
      (cf.year * 12 + cf.month) as month_key,
      make_date(cf.year, cf.month, 1) as month_first,
      (make_date(cf.year, cf.month, 1) + interval '1 month' - interval '1 day')::date as month_last
    from canonical_fact cf
    where cf.source_version_id = public.pillar_b_release()
      and cf.perimeter_status in ('biosimilar', 'reference_medicine')
      and cf.month between 1 and 12
      and (p_year      is null or cf.year    = p_year)
      and (p_channel   is null or cf.channel = p_channel)
      and (p_substance is null or cf.active_substance = p_substance)
  ),
  classified as (
    select s.*,
      case
        -- PREDATES_WINDOW IS AN EVIDENCE LIST, NOT A NULL DEFAULT.
        -- Only these ten AICs carry the four independent lines placing their
        -- authorisation before 2024-01-01 (aicRegistrationEra 2014/2015;
        -- moleculeBiosimilarFrom 2016-09-14; both B03 tracks recording
        -- periodValidity: valid-whole-period; observed dispensing from 2024-01,
        -- which an unauthorised medicine cannot have). They are the
        -- decentralised-procedure enoxaparin biosimilars, which hold no EU
        -- centralised date.
        --
        -- Any OTHER undated AIC is `unknown` and is counted as valid by nobody.
        -- Treating null as predates_window would silently admit a future AIC
        -- whose date is merely missing -- the opposite of what the evidence says.
        when s.classification_valid_from is null
             and s.aic in ('044039028','044039079','044039143','044039206',
                           '044039269','044269037','044269064','044269090',
                           '044269126','044269153')      then 'predates_window'
        when s.classification_valid_from is null          then 'unknown'
        when s.classification_valid_from <= s.month_first then 'inside'
        when s.classification_valid_from >  s.month_last  then 'outside'
        else                                                   'boundary'
      end as validity
    from scoped s
  ),
  -- The OBSERVED LOCAL clock, third of the three the audit keeps apart.
  --
  -- COMPUTED OVER THE CALLER'S FULL VISIBLE HISTORY, BEFORE DISPLAY FILTERS.
  -- This deliberately does NOT read from `scoped`: p_year and p_channel are
  -- presentation choices, and a switch that happened in 2024 did not stop
  -- happening because a reader selected 2025. Deriving the opening from the
  -- filtered set made the clock restart at the first row of the filter, so a
  -- 2025 view would have reported an opening of 2025-01 and silently counted
  -- the whole year as "after the switch".
  --
  -- The RLS scope is still honoured: this reads canonical_fact, so an Azienda
  -- sees only its own history and gets its own opening. That is the intended
  -- meaning -- "was a switch possible HERE" -- and it is why the filter must be
  -- stripped but the tenancy must not.
  --
  -- "First month the AIC appears with non-zero QUANTITY in any of the four
  -- ASLs" -- quantity, not cost. A credit note carries a negative cost and no
  -- dispensing; a zero-cost dispensing is still a dispensing.
  opened as (
    select f.active_substance, min(f.year * 12 + f.month) as first_key
    from canonical_fact f
    where f.source_version_id = public.pillar_b_release()
      and f.perimeter_status = 'biosimilar'
      and f.month between 1 and 12
      and coalesce(f.source_quantity, 0) > 0
      -- The same validity gate, inlined: an opening cannot be claimed from a
      -- month in which the product was not yet valid.
      and (
        (f.classification_valid_from is null
           and f.aic in ('044039028','044039079','044039143','044039206',
                         '044039269','044269037','044269064','044269090',
                         '044269126','044269153'))
        or f.classification_valid_from <= make_date(f.year, f.month, 1)
      )
    group by f.active_substance
  )
  select
    c.active_substance,
    sum(c.total_cost_eur) filter (where c.validity = 'inside'          and c.perimeter_status = 'biosimilar'),
    sum(c.total_cost_eur) filter (where c.validity = 'inside'          and c.perimeter_status = 'reference_medicine'),
    sum(c.total_cost_eur) filter (where c.validity = 'predates_window' and c.perimeter_status = 'biosimilar'),
    sum(c.total_cost_eur) filter (where c.validity = 'predates_window' and c.perimeter_status = 'reference_medicine'),
    sum(c.total_cost_eur) filter (where c.validity = 'boundary'        and c.perimeter_status = 'biosimilar'),
    sum(c.total_cost_eur) filter (where c.validity = 'boundary'        and c.perimeter_status = 'reference_medicine'),
    sum(c.total_cost_eur) filter (where c.validity = 'outside'         and c.perimeter_status = 'biosimilar'),
    sum(c.total_cost_eur) filter (where c.validity = 'outside'         and c.perimeter_status = 'reference_medicine'),
    sum(c.total_cost_eur) filter (where c.validity = 'unknown'         and c.perimeter_status = 'biosimilar'),
    sum(c.total_cost_eur) filter (where c.validity = 'unknown'         and c.perimeter_status = 'reference_medicine'),
    -- BOUNDARY IS EXCLUDED FROM T2. The B05 generator states its own period
    -- rule in derived/b05_spending_and_uptake.json:
    --   "date-valid months only (inside + predates_window); outside and
    --    boundary excluded"
    -- An earlier revision here included boundary and still reproduced the
    -- aggregate EUR 20.322.838,90 -- but only because the observed-local clock
    -- was changed in the same edit. Two changes, one aggregate, no way to tell
    -- which was right. The generator's method string settles it, and the
    -- per-substance comparison in b36 now proves it cell by cell.
    sum(c.total_cost_eur) filter (
      where c.perimeter_status = 'biosimilar'
        and c.validity in ('inside', 'predates_window')
        and o.first_key is not null and c.month_key >= o.first_key),
    sum(c.total_cost_eur) filter (
      where c.perimeter_status = 'reference_medicine'
        and c.validity in ('inside', 'predates_window')
        and o.first_key is not null and c.month_key >= o.first_key),
    max(o.first_key)::int,
    count(*)::bigint,
    count(*) filter (where c.classification_valid_from is null)::bigint
  from classified c
  left join opened o on o.active_substance = c.active_substance
  group by c.active_substance
$$;

comment on function public.pillar_b_value_uptake(int, text, text) is
  'Biosimilar vs reference spend per substance under the B05 monthly validity '
  'rule: inside / boundary / outside, plus an evidence-backed predates_window '
  'class for the ten decentralised-procedure enoxaparin AICs. Boundary is '
  'isolated and never assigned to either side. date-valid = inside + predates.';

grant execute on function public.pillar_b_value_uptake(int, text, text) to authenticated;
revoke execute on function public.pillar_b_value_uptake(int, text, text) from public, anon;

create index if not exists idx_canonical_fact_perimeter_filter
  on public.canonical_fact (source_version_id, perimeter_status, year, channel, active_substance);

analyze public.canonical_fact;
