-- Pillar B — coverage of the volume-uptake measure, narrowable by Azienda and
-- substance.
--
-- DORMANT UNTIL APPLIED. Additive: nothing live is altered.
--
-- WHAT THIS IS FOR. The volume-uptake measure consumes only the rows that
-- pillar_b_uptake_rows admits (comparable, same unit, both roles present in
-- the (Azienda, substance, route) group). Everything else in the analytical
-- perimeter is WITHHELD, and the page must show the measure beside what it
-- excludes. pillar_b_uptake_scope and pillar_b_uptake_withheld give those two
-- numbers for the whole visible perimeter only: neither takes an Azienda or a
-- substance, so under those filters the page could only withhold the coverage.
--
-- THE IDENTITY, STATED AND ENFORCED HERE. scope = used + withheld, row by row:
-- every analytical perimeter row is either consumed by the measure or
-- withheld from it. pillar_b_uptake_scope documents exactly this ("the
-- in-scope total both of the above partition"), and on 2025 the live ledger
-- shows it to the cent: used EUR 7,469,067.17 (1,416 rows) + withheld
-- EUR 28,747,938.98 (5,523) = scope EUR 36,217,006.15 (6,939). This function
-- returns the three figures from ONE left join, so the identity cannot be
-- broken by composing three calls, and no caller can add withheld to a scope
-- that already contains it.
--
-- NARROWING IS EXACT. The eligibility rule in pillar_b_uptake_rows is decided
-- per (Azienda, substance, route) group, so filtering the admitted rows by
-- Azienda or substance AFTER the rule gives the same set as applying the rule
-- inside the filter. The function therefore reuses pillar_b_uptake_rows rather
-- than restating its rule, which is the one place that rule may live.
--
-- SECURITY INVOKER: RLS decides the rows before any predicate here applies.
-- An Azienda naming another Azienda gets an empty scope, not that Azienda's.

create or replace function public.pillar_b_uptake_coverage(
  p_year       int,
  p_asl_code   text default null,
  p_substance  text default null
)
returns table (
  rows_n              bigint,    -- analytical perimeter rows in scope
  spend_eur           numeric,   -- their spend: used + withheld
  used_rows           bigint,
  used_spend_eur      numeric,
  withheld_rows       bigint,
  withheld_spend_eur  numeric,
  -- basis COVERAGE of the scope, not a quantity: see pillar_b_spend.
  rows_basis_packages bigint,
  rows_basis_units    bigint,
  rows_basis_mixed    bigint,
  rows_basis_unknown  bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with scope as (
    select cf.source_record_id, cf.total_cost_eur, cf.source_quantity_basis
      from canonical_fact cf
     where cf.source_version_id = public.pillar_b_release()
       and cf.year = p_year
       and cf.month between 1 and 12
       and cf.source_disposition = 'analytical'
       and cf.perimeter_status in ('biosimilar', 'reference_medicine')
       and (p_asl_code  is null or cf.asl_code         = p_asl_code)
       and (p_substance is null or cf.active_substance = p_substance)
  ),
  used as (
    select u.source_record_id, u.spend_eur
      from public.pillar_b_uptake_rows(p_year, 1, 12) u
     where (p_asl_code  is null or u.asl_code         = p_asl_code)
       and (p_substance is null or u.active_substance = p_substance)
  )
  select
    count(*)::bigint,
    sum(s.total_cost_eur),
    count(u.source_record_id)::bigint,
    sum(u.spend_eur),
    count(*) filter (where u.source_record_id is null)::bigint,
    sum(s.total_cost_eur) filter (where u.source_record_id is null),
    count(*) filter (where s.source_quantity_basis = 'packages')::bigint,
    count(*) filter (where s.source_quantity_basis = 'units')::bigint,
    count(*) filter (where s.source_quantity_basis = 'mixed')::bigint,
    count(*) filter (where s.source_quantity_basis = 'unknown')::bigint
  from scope s
  left join used u on u.source_record_id = s.source_record_id
$$;

comment on function public.pillar_b_uptake_coverage(int, text, text) is
  'Scope, used and withheld rows/spend of the volume-uptake measure for one '
  'year, optionally one Azienda and one substance. scope = used + withheld by '
  'construction (one left join over pillar_b_uptake_rows).';

grant execute on function public.pillar_b_uptake_coverage(int, text, text) to authenticated, service_role;
revoke execute on function public.pillar_b_uptake_coverage(int, text, text) from public, anon;
