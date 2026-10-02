-- Pillar B — scoped value uptake and spend facets.
--
-- DORMANT UNTIL APPLIED. Nothing live is altered: pillar_b_value_uptake(int,
-- text, text) is left exactly as applied on 2026-10-02, and the two functions
-- below are additions. The harness (outputs/pillar-b/logs/b39) proves that for
-- every (year, channel, substance) the scoped function returns the live one's
-- figures to the cent, so the two cannot drift without a test failing.
--
-- WHY A SECOND FUNCTION RATHER THAN A FOURTH PARAMETER. Adding a parameter to
-- the live signature would create an overload. PostgREST resolves a call by the
-- named arguments it receives, and a call omitting the new argument would match
-- both overloads and fail with PGRST203 — on the page that is already deployed.
-- A new name has no such hazard.
--
-- WHAT THE NEW PARAMETERS ARE FOR.
--
--   p_years int[]       EXPLICIT, NEVER NULL. The live function's year predicate
--                       has no upper bound, so p_year = null quietly aggregated
--                       January–May 2026 under a chip reading "2024 e 2025"
--                       (39,48% where the labelled scope is 37,70%). The page
--                       worked around that with two calls and a merge. Here the
--                       set of years is a required argument, so there is no
--                       state in which the function sums years nobody named.
--
--   p_channels text[]   Any subset of CO / DD / DPC; null means all three.
--
--   p_asl_code text     Narrows to one Azienda. SAFE UNDER RLS BY CONSTRUCTION:
--                       the function is SECURITY INVOKER, so the policy on
--                       canonical_fact has already decided which rows exist
--                       before this predicate is applied. An Azienda naming
--                       another Azienda's code gets an empty set, not that
--                       Azienda's rows. A Regione or a platform reviewer, who
--                       can see every Azienda, uses it to look at one. The
--                       `opened` clock is narrowed by the same code, so "first
--                       local dispensing" means that Azienda's own.
--
-- The validity rule, the predates_window evidence list and the T2 definition
-- are copied verbatim from 20261002170000 and are documented there. They are
-- not restated here so that there is one place to read them.

-- ---------------------------------------------------------- value uptake, scoped
create or replace function public.pillar_b_value_uptake_scoped(
  p_years      int[],
  p_channels   text[] default null,
  p_substance  text   default null,
  p_asl_code   text   default null
)
returns table (
  active_substance            text,
  inside_biosimilar_eur       numeric,
  inside_reference_eur        numeric,
  predates_biosimilar_eur     numeric,
  predates_reference_eur      numeric,
  boundary_biosimilar_eur     numeric,
  boundary_reference_eur      numeric,
  outside_biosimilar_eur      numeric,
  outside_reference_eur       numeric,
  unknown_biosimilar_eur      numeric,
  unknown_reference_eur       numeric,
  window_biosimilar_eur       numeric,
  window_reference_eur        numeric,
  first_local_month_key       int,
  perimeter_rows              bigint,
  undated_rows                bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_years is null or cardinality(p_years) = 0 then
    raise exception 'pillar_b_value_uptake_scoped: p_years must name the years to aggregate'
      using hint = 'pass array[2024, 2025]; a null would sweep in the partial 2026';
  end if;

  return query
  with scoped as (
    select
      cf.active_substance,
      cf.perimeter_status,
      cf.total_cost_eur,
      cf.aic,
      cf.classification_valid_from,
      (cf.year * 12 + cf.month) as month_key,
      make_date(cf.year, cf.month, 1) as month_first,
      (make_date(cf.year, cf.month, 1) + interval '1 month' - interval '1 day')::date as month_last
    from canonical_fact cf
    where cf.source_version_id = public.pillar_b_release()
      and cf.perimeter_status in ('biosimilar', 'reference_medicine')
      and cf.month between 1 and 12
      and cf.year = any (p_years)
      and (p_channels  is null or cf.channel          = any (p_channels))
      and (p_substance is null or cf.active_substance = p_substance)
      and (p_asl_code  is null or cf.asl_code         = p_asl_code)
  ),
  classified as (
    select s.*,
      case
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
  -- Full visible history, NOT the filtered set: year and channel are display
  -- choices and must not restart the clock. The Azienda narrowing IS applied,
  -- because for that Azienda the question is whether a switch happened there.
  opened as (
    select f.active_substance, min(f.year * 12 + f.month) as first_key
    from canonical_fact f
    where f.source_version_id = public.pillar_b_release()
      and f.perimeter_status = 'biosimilar'
      and f.month between 1 and 12
      and coalesce(f.source_quantity, 0) > 0
      and (p_asl_code is null or f.asl_code = p_asl_code)
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
  group by c.active_substance;
end
$$;

comment on function public.pillar_b_value_uptake_scoped(int[], text[], text, text) is
  'pillar_b_value_uptake with an explicit set of years, a set of channels and an '
  'optional Azienda. Same validity rule, same predates_window list, same T2. '
  'Reconciled to the live function cell by cell in outputs/pillar-b/logs/b39.';

grant execute on function public.pillar_b_value_uptake_scoped(int[], text[], text, text) to authenticated;
revoke execute on function public.pillar_b_value_uptake_scoped(int[], text[], text, text) from public, anon;


-- ---------------------------------------------------------------------- facets
-- Spend broken down by month, Azienda, channel, perimeter status and active
-- substance, under the same filters, from ONE scan, as ONE jsonb row.
--
-- One row because PostgREST caps a response at 1,000 rows and pages an RPC by
-- re-running the aggregate — the 57014 that molecule paging produced. A single
-- jsonb value cannot be paged.
--
-- WHAT EACH FACET CARRIES. Reported spend (sum of total_cost_eur, which is
-- gross, VAT-inclusive, pre-payback — never a net price), the record count,
-- the comparable-eligible share of that spend, and within the biosimilar
-- perimeter the biosimilar / reference split. The split here is BY PERIMETER
-- STATUS ONLY: it does not apply the monthly validity rule, so it is "spend in
-- the perimeter", not adoption. Adoption is pillar_b_value_uptake_scoped.
--
-- NO QUANTITY OF ANY KIND. The basis is packages, units, mixed and unknown in
-- the same release; a sum across them has no unit.
--
-- p_facets names which facets to compute (null = all). The page uses this to
-- draw the 29-month calendar with p_years = {2024, 2025, 2026} while every
-- other facet is computed on the years the reader selected: January–May 2026
-- may appear as five labelled months, never inside a total.
create or replace function public.pillar_b_facets(
  p_years      int[],
  p_channels   text[] default null,
  p_substance  text   default null,
  p_asl_code   text   default null,
  p_facets     text[] default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  want_months     boolean := p_facets is null or 'months'     = any (p_facets);
  want_asl        boolean := p_facets is null or 'asl'        = any (p_facets);
  want_channels   boolean := p_facets is null or 'channels'   = any (p_facets);
  want_perimeter  boolean := p_facets is null or 'perimeter'  = any (p_facets);
  want_molecules  boolean := p_facets is null or 'molecules'  = any (p_facets);
  result jsonb;
begin
  if p_years is null or cardinality(p_years) = 0 then
    raise exception 'pillar_b_facets: p_years must name the years to aggregate'
      using hint = 'pass array[2024, 2025]; a null would sweep in the partial 2026';
  end if;

  with scoped as materialized (
    select
      cf.year, cf.month, cf.asl_code, cf.channel, cf.aic, cf.active_substance,
      cf.perimeter_status, cf.total_cost_eur, cf.comparable_eligible
    from canonical_fact cf
    where cf.source_version_id = public.pillar_b_release()
      and cf.month between 1 and 12
      and cf.year = any (p_years)
      and (p_channels  is null or cf.channel          = any (p_channels))
      and (p_substance is null or cf.active_substance = p_substance)
      and (p_asl_code  is null or cf.asl_code         = p_asl_code)
  ),
  months as (
    select jsonb_agg(jsonb_build_object(
        'year', s.year, 'month', s.month, 'key', s.year * 12 + s.month,
        'spend_eur', s.spend, 'rows_n', s.n,
        'comparable_spend_eur', s.cmp,
        'biosimilar_eur', s.bio, 'reference_eur', s.ref
      ) order by s.year, s.month) as j
    from (
      select year, month,
        sum(total_cost_eur) as spend, count(*) as n,
        sum(total_cost_eur) filter (where comparable_eligible) as cmp,
        sum(total_cost_eur) filter (where perimeter_status = 'biosimilar') as bio,
        sum(total_cost_eur) filter (where perimeter_status = 'reference_medicine') as ref
      from scoped where want_months group by year, month
    ) s
  ),
  asl as (
    select jsonb_agg(jsonb_build_object(
        'asl_code', s.asl_code, 'year', s.year,
        'spend_eur', s.spend, 'rows_n', s.n,
        'comparable_spend_eur', s.cmp,
        'biosimilar_eur', s.bio, 'reference_eur', s.ref
      ) order by s.asl_code, s.year) as j
    from (
      select asl_code, year,
        sum(total_cost_eur) as spend, count(*) as n,
        sum(total_cost_eur) filter (where comparable_eligible) as cmp,
        sum(total_cost_eur) filter (where perimeter_status = 'biosimilar') as bio,
        sum(total_cost_eur) filter (where perimeter_status = 'reference_medicine') as ref
      from scoped where want_asl group by asl_code, year
    ) s
  ),
  channels as (
    select jsonb_agg(jsonb_build_object(
        'channel', s.channel, 'year', s.year,
        'spend_eur', s.spend, 'rows_n', s.n,
        'comparable_spend_eur', s.cmp,
        'biosimilar_eur', s.bio, 'reference_eur', s.ref
      ) order by s.channel, s.year) as j
    from (
      select channel, year,
        sum(total_cost_eur) as spend, count(*) as n,
        sum(total_cost_eur) filter (where comparable_eligible) as cmp,
        sum(total_cost_eur) filter (where perimeter_status = 'biosimilar') as bio,
        sum(total_cost_eur) filter (where perimeter_status = 'reference_medicine') as ref
      from scoped where want_channels group by channel, year
    ) s
  ),
  perimeter as (
    select jsonb_agg(jsonb_build_object(
        'perimeter_status', coalesce(s.perimeter_status, 'unclassified'),
        'aic_count', s.aics, 'rows_n', s.n, 'spend_eur', s.spend
      ) order by s.spend desc nulls last) as j
    from (
      select perimeter_status,
        count(distinct aic) as aics, count(*) as n, sum(total_cost_eur) as spend
      from scoped where want_perimeter group by perimeter_status
    ) s
  ),
  -- Every substance, ranked by spend. Bounded by the release's own vocabulary
  -- (1,820 substances on R2), well under what one jsonb value carries; the page
  -- shows the head of the list and states how many it did not show.
  molecules as (
    select jsonb_agg(jsonb_build_object(
        'active_substance', s.active_substance,
        'spend_eur', s.spend, 'rows_n', s.n,
        'comparable_spend_eur', s.cmp,
        'in_perimeter', s.in_perimeter
      ) order by s.spend desc nulls last, s.active_substance) as j
    from (
      select active_substance,
        sum(total_cost_eur) as spend, count(*) as n,
        sum(total_cost_eur) filter (where comparable_eligible) as cmp,
        bool_or(perimeter_status in ('biosimilar', 'reference_medicine')) as in_perimeter
      from scoped where want_molecules group by active_substance
    ) s
  ),
  totals as (
    select jsonb_build_object(
      'spend_eur', sum(total_cost_eur), 'rows_n', count(*),
      'comparable_spend_eur', sum(total_cost_eur) filter (where comparable_eligible),
      'asl_count', count(distinct asl_code),
      'substance_count', count(distinct active_substance)
    ) as j
    from scoped
  )
  select jsonb_build_object(
    'release', public.pillar_b_release(),
    'years', to_jsonb(p_years),
    'channels', to_jsonb(p_channels),
    'substance', to_jsonb(p_substance),
    'asl_code', to_jsonb(p_asl_code),
    'totals', (select j from totals),
    'months', case when want_months then coalesce((select j from months), '[]'::jsonb) end,
    'asl', case when want_asl then coalesce((select j from asl), '[]'::jsonb) end,
    'channels_by_year', case when want_channels then coalesce((select j from channels), '[]'::jsonb) end,
    'perimeter', case when want_perimeter then coalesce((select j from perimeter), '[]'::jsonb) end,
    'molecules', case when want_molecules then coalesce((select j from molecules), '[]'::jsonb) end
  ) into result;

  return result;
end
$$;

comment on function public.pillar_b_facets(int[], text[], text, text, text[]) is
  'Reported spend by month, Azienda, channel, perimeter status and substance '
  'under one set of filters, from one scan, as one jsonb row. Spend only; no '
  'quantity. Perimeter split is by status, not by validity — not adoption.';

grant execute on function public.pillar_b_facets(int[], text[], text, text, text[]) to authenticated;
revoke execute on function public.pillar_b_facets(int[], text[], text, text, text[]) from public, anon;


-- ------------------------------------------------------------ the reviewer path
-- An allow-listed platform reviewer reads Pillar B through the service-role
-- client, exactly as the private Pillar A workbook is read (lib/dashboard-
-- review/pillar-b/scope.ts). service_role bypasses RLS but still needs the
-- ordinary grants. Supabase's default privileges normally provide them; they
-- are stated here explicitly so the reviewer path does not depend on how a
-- table happened to be created. All idempotent.
grant select on public.canonical_fact, public.pillar_b_active_release to service_role;
grant execute on function public.pillar_b_release() to service_role;
grant execute on function public.pillar_b_spend(int, int, int) to service_role;
grant execute on function public.pillar_b_uptake(int, int, int) to service_role;
grant execute on function public.pillar_b_uptake_rows(int, int, int) to service_role;
grant execute on function public.pillar_b_uptake_withheld(int, int, int) to service_role;
grant execute on function public.pillar_b_uptake_scope(int, int, int) to service_role;
grant execute on function public.pillar_b_evidence_funnel(int, int, int) to service_role;
grant execute on function public.pillar_b_perimeter_coverage(int) to service_role;
grant execute on function public.pillar_b_molecule_spend_json(int, int, int) to service_role;
grant execute on function public.pillar_b_value_uptake(int, text, text) to service_role;
grant execute on function public.pillar_b_value_uptake_scoped(int[], text[], text, text) to service_role;
grant execute on function public.pillar_b_facets(int[], text[], text, text, text[]) to service_role;

analyze public.canonical_fact;
