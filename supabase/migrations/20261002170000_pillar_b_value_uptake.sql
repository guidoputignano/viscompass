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
        -- No EU centralised date: the decentralised-procedure enoxaparins.
        when s.classification_valid_from is null                then 'predates_window'
        when s.classification_valid_from <= s.month_first       then 'inside'
        when s.classification_valid_from >  s.month_last        then 'outside'
        else                                                         'boundary'
      end as validity
    from scoped s
  ),
  -- The OBSERVED LOCAL clock, third of the three the audit keeps apart. The
  -- workbook defines it as "first month the AIC appears with non-zero QUANTITY
  -- in any of the four ASLs" -- quantity, not cost. A credit note carries a
  -- negative cost and no dispensing; a zero-cost dispensing is still a
  -- dispensing. Keyed on the substance because that is the grain the uptake
  -- measure is published at.
  opened as (
    select c.active_substance, min(c.month_key) as first_key
    from classified c
    where c.perimeter_status = 'biosimilar'
      and coalesce(c.source_quantity, 0) > 0
    group by c.active_substance
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
    -- T2 is a SUBSTITUTION TIER, and the tiers partition the whole reference
    -- total differently from the date-valid measure. The workbook's
    -- local_substitutability.py gives
    --   T0 no biosimilar existed anywhere yet   EUR 14.993.664,38  (= `outside`)
    --   T1 EU-authorised, never dispensed here  EUR 25.583.172,71
    --   T2 dispensed locally by then            EUR 20.322.838,90
    --   total reference-medicine                EUR 60.899.675,99
    -- T0+T1+T2 is the FULL reference total, so the tiers include `boundary`
    -- while the date-valid measure excludes it. T2 therefore excludes only
    -- `outside`; restricting it to inside+predates as well understated it by
    -- EUR 257.478,77, which is the boundary spend falling inside the window.
    sum(c.total_cost_eur) filter (
      where c.perimeter_status = 'biosimilar'
        and c.validity <> 'outside'
        and o.first_key is not null and c.month_key >= o.first_key),
    sum(c.total_cost_eur) filter (
      where c.perimeter_status = 'reference_medicine'
        and c.validity <> 'outside'
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
