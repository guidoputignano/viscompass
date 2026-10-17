-- Pillar B — observed gross spend and quantity per comparability stratum, for
-- ONE Azienda: the working behind the spend page's «Margine (limite superiore)».
--
-- DORMANT UNTIL APPLIED. One function is added and nothing live is altered:
-- no table, policy, existing function or existing grant is touched. Applying
-- it to production needs its own explicit owner approval, separate from the
-- approval of this file; the runbook is in the private evidence folder
-- (stratum-cost/b54), not in this repository.
--
-- THE OWNER DECISION (17 October 2026). The review page may show, for one
-- Azienda at a time, the two observed gross values per unit of each
-- comparability stratum (active substance, route, form, mass unit): the
-- reference medicine's and the biosimilar's, each beside its spend, its
-- quantity in the stratum's own unit and its record count. It shows no ratio,
-- no difference, no saving, and no colour or order that says which side is
-- cheaper. This function returns numerators and denominators only and forms no
-- rate: the page divides inside one stratum and one side.
--
-- WHY p_asl_code IS SAFE. The function is SECURITY INVOKER, so the policy on
-- canonical_fact has already decided which rows exist before this predicate
-- is applied (the same argument as 20261003090000_pillar_b_scoped_views.sql).
-- An Azienda naming another Azienda's code gets an empty answer, not that
-- Azienda's rows; a Regione or a platform reviewer uses it to read one of the
-- Aziende it can already read.
--
-- WHY A NULL AZIENDA IS REFUSED. The margin is built per Azienda, each with its
-- own first local dispensing and its own prices, and never pooled across
-- Aziende (lib/dashboard-review/organization-biosimilar.ts). A null here would
-- pool them. Refusing it means no caller can obtain a stratum pooled across
-- Aziende from SQL, whatever a page does.
--
-- WHAT IT IS. The margin's own rules (lib/dashboard-review/biosimilar.ts),
-- copied rule for rule, for one Azienda and its whole release history:
--   sides         biosimilar: biosimilar_flag or status biosimilar; reference:
--                 not biosimilar, and originator_flag, biosimilar_flag false or
--                 status reference_medicine. Unresolved and same-substance
--                 non-biosimilar rows are on neither side.
--   opening       per substance, the first month of a biosimilar row with
--                 positive packs or positive spend, over the whole release:
--                 every year (2026 included), channel and route. Never narrowed
--                 by the page's filters. A credit note opens nothing.
--   month span    a record without a valid month spans January to December of
--                 its year: it opens at January and is in the window when its
--                 December is at or after the opening.
--   population    the selected years, channels and substance; a molecule enters
--                 a year only with at least one biosimilar row in it.
--   measurable    comparable_eligible, unit MG, MCG or G, positive comparable
--                 quantity and positive spend.
--   shared        a stratum with measurable window records on both sides.
-- Reference spend R splits exactly into P (before the opening), W − M (in the
-- window, not measurable), M − S (measurable, one side only) and S (both
-- sides); the biosimilar side is split the same way. The page checks these
-- identities to the cent before it prints any value per unit.
--
-- WHAT IT IS NOT. Not PB-V5-08: a stratum pools the AICs and channels of a
-- year, while PB-V5-08's grain (AIC x Azienda x channel x month) stays an
-- evidence gate. Not the margin: no differential is formed here.
--
-- MASS UNITS ONLY. IU, U, packs and every other unit stay in the
-- "not measurable" part of the window, as in the margin.
--
-- ONE jsonb VALUE, so the answer cannot be paged. No asl_code and no release id
-- in it: the caller knows the Azienda it asked for, and the release id left
-- the page with PB-V5-07.
--
-- LATER MIGRATIONS. CREATE OR REPLACE resets a function's SET clauses. A later
-- migration that recreates this function must state pg_temp last itself, or
-- the hardening of 20261009160000 is silently undone for it;
-- tests/pillar-b-search-path.test.mjs checks the final search_path of every
-- Pillar B function across all migrations.
--
-- No string literal below contains a double hyphen: the search-path test
-- strips comments with a plain pattern and would cut such a literal in two.

create or replace function public.pillar_b_stratum_unit_cost(
  p_years      int[],
  p_asl_code   text,
  p_channels   text[] default null,
  p_substance  text   default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_release text;
  v_years   int[];
  v_result  jsonb;
begin
  if p_years is null or cardinality(p_years) = 0
     or array_position(p_years, null) is not null
     or not (p_years <@ array[2024, 2025]) then
    raise exception 'pillar_b_stratum_unit_cost: p_years must name 2024, 2025 or both'
      using errcode = '22023', hint = 'pass array[2025]; 2026 is partial and never a year here';
  end if;
  if p_asl_code is null or btrim(p_asl_code) = '' then
    raise exception 'pillar_b_stratum_unit_cost: p_asl_code is required; unit costs are read one Azienda at a time'
      using errcode = '22023';
  end if;
  if p_channels is not null
     and (cardinality(p_channels) = 0 or array_position(p_channels, null) is not null) then
    raise exception 'pillar_b_stratum_unit_cost: p_channels must be null (every channel) or name at least one channel'
      using errcode = '22023';
  end if;
  v_release := public.pillar_b_release();
  v_years := array(select distinct u.y from unnest(p_years) as u(y) order by u.y);

  with azienda as materialized (
    select
      f.year, f.month, f.channel, f.active_substance, f.perimeter_status,
      f.total_cost_eur, f.quantity_packs, f.total_content_mg,
      f.comparable_eligible, f.comparable_quantity, f.comparable_stratum_id,
      -- The margin trims the unit with JavaScript trim(), which removes every
      -- Unicode space and line terminator, not only the ASCII space btrim does.
      upper(regexp_replace(f.comparable_unit, '^[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$', '', 'g')) as unit,
      coalesce(f.biosimilar_flag is true or f.perimeter_status = 'biosimilar', false) as is_bio,
      coalesce(not coalesce(f.biosimilar_flag is true or f.perimeter_status = 'biosimilar', false)
               and (f.originator_flag is true or f.biosimilar_flag is false
                    or f.perimeter_status = 'reference_medicine'), false) as is_ref,
      f.year * 12 + case when f.month between 1 and 12 then f.month else 1 end  as first_key,
      f.year * 12 + case when f.month between 1 and 12 then f.month else 12 end as last_key
    from public.canonical_fact f
    where f.source_version_id = v_release
      and f.asl_code = p_asl_code
  ),
  opened as (
    select a.active_substance,
           min(a.first_key) as opening_key,
           min(a.first_key) filter (where a.month between 1 and 12) as opening_dated_key
    from azienda a
    where a.is_bio
      and coalesce(a.active_substance, '') <> ''
      and (coalesce(a.quantity_packs, 0) > 0 or coalesce(a.total_cost_eur, 0) > 0)
    group by a.active_substance
  ),
  pop as materialized (
    select a.*,
           o.opening_key, o.opening_dated_key,
           coalesce(o.opening_key is not null and a.last_key >= o.opening_key, false) as in_window,
           case when a.comparable_eligible is true then
             case a.unit when 'MG' then 1::numeric when 'MCG' then 0.001::numeric when 'G' then 1000::numeric end
           end as mg_factor
    from azienda a
    left join opened o on o.active_substance = a.active_substance
    where a.year = any (v_years)
      and (p_channels  is null or a.channel          = any (p_channels))
      and (p_substance is null or a.active_substance = p_substance)
  ),
  mol as (
    select p.year, p.active_substance
    from pop p
    where p.is_bio and coalesce(p.active_substance, '') <> ''
    group by p.year, p.active_substance
  ),
  rows_in as (
    select p.*,
           coalesce(p.mg_factor is not null and p.comparable_quantity > 0 and p.total_cost_eur > 0, false) as measurable
    from pop p
    join mol m on m.year = p.year and m.active_substance = p.active_substance
  ),
  meas as (
    select r.* from rows_in r
    where r.in_window and r.measurable and (r.is_bio or r.is_ref)
  ),
  shared as (
    select m.year, m.active_substance, m.comparable_stratum_id
    from meas m
    group by m.year, m.active_substance, m.comparable_stratum_id
    having bool_or(m.is_ref) and bool_or(m.is_bio)
  ),
  side_channel as (
    select m.year, m.active_substance, m.comparable_stratum_id, m.is_bio,
           coalesce(m.channel, '') as channel, sum(m.total_cost_eur) as spend_eur
    from meas m
    group by m.year, m.active_substance, m.comparable_stratum_id, m.is_bio, coalesce(m.channel, '')
  ),
  side as (
    select m.year, m.active_substance, m.comparable_stratum_id, m.is_bio,
           jsonb_build_object(
             'spend_eur',  sum(m.total_cost_eur),
             'quantity',   sum(m.comparable_quantity),
             'mass_mg',    sum(m.comparable_quantity * m.mg_factor),
             'rows_n',     count(*),
             'unit',       case when count(distinct m.unit) = 1 then min(m.unit) end,
             'unit_count', count(distinct m.unit),
             'channels',   (select jsonb_object_agg(sc.channel, sc.spend_eur)
                            from side_channel sc
                            where sc.year = m.year and sc.active_substance = m.active_substance
                              and sc.comparable_stratum_id = m.comparable_stratum_id
                              and sc.is_bio = m.is_bio)
           ) as j
    from meas m
    group by m.year, m.active_substance, m.comparable_stratum_id, m.is_bio
  ),
  strata as (
    select k.year, k.active_substance,
           jsonb_agg(jsonb_build_object(
             'stratum_id', k.comparable_stratum_id,
             'shared',     sh.comparable_stratum_id is not null,
             'reference',  r.j,
             'biosimilar', b.j
           ) order by k.comparable_stratum_id) as j
    from (select distinct m.year, m.active_substance, m.comparable_stratum_id from meas m) k
    left join shared sh on sh.year = k.year and sh.active_substance = k.active_substance
                       and sh.comparable_stratum_id = k.comparable_stratum_id
    left join side r on r.year = k.year and r.active_substance = k.active_substance
                    and r.comparable_stratum_id = k.comparable_stratum_id and not r.is_bio
    left join side b on b.year = k.year and b.active_substance = k.active_substance
                    and b.comparable_stratum_id = k.comparable_stratum_id and b.is_bio
    group by k.year, k.active_substance
  ),
  funnel as (
    select r.year, r.active_substance,
      min(r.opening_key) as opening_key,
      min(r.opening_dated_key) as opening_dated_key,
      coalesce(sum(r.total_cost_eur) filter (where r.is_ref), 0)                                  as ref_r,
      coalesce(sum(r.total_cost_eur) filter (where r.is_ref and not r.in_window), 0)              as ref_p,
      coalesce(sum(r.total_cost_eur) filter (where r.is_ref and r.in_window), 0)                  as ref_w,
      coalesce(sum(r.total_cost_eur) filter (where r.is_ref and r.in_window and r.measurable), 0) as ref_m,
      coalesce(sum(r.total_cost_eur) filter (where r.is_ref and r.in_window and r.measurable
                                                 and sh.comparable_stratum_id is not null), 0)    as ref_s,
      count(*) filter (where r.is_ref)                                                            as ref_rows,
      coalesce(sum(r.total_cost_eur) filter (where r.is_bio), 0)                                  as bio_b,
      coalesce(sum(r.total_cost_eur) filter (where r.is_bio and not r.in_window), 0)              as bio_p,
      coalesce(sum(r.total_cost_eur) filter (where r.is_bio and r.in_window), 0)                  as bio_w,
      coalesce(sum(r.total_cost_eur) filter (where r.is_bio and r.in_window and r.measurable), 0) as bio_m,
      coalesce(sum(r.total_cost_eur) filter (where r.is_bio and r.in_window and r.measurable
                                                 and sh.comparable_stratum_id is not null), 0)    as bio_s,
      count(*) filter (where r.is_bio)                                                            as bio_rows,
      coalesce(sum(r.total_cost_eur) filter (where not r.is_ref and not r.is_bio
                                                 and r.perimeter_status = 'unresolved'), 0)       as nc_unresolved,
      coalesce(sum(r.total_cost_eur) filter (where not r.is_ref and not r.is_bio
                                                 and r.perimeter_status = 'non_biosimilar_same_substance'), 0) as nc_same_substance,
      coalesce(sum(r.total_cost_eur) filter (where not r.is_ref and not r.is_bio
                                                 and r.perimeter_status is distinct from 'unresolved'
                                                 and r.perimeter_status is distinct from 'non_biosimilar_same_substance'), 0) as nc_other
    from rows_in r
    left join shared sh on sh.year = r.year and sh.active_substance = r.active_substance
                       and sh.comparable_stratum_id = r.comparable_stratum_id
    group by r.year, r.active_substance
  ),
  year_level as (
    select y.year,
      (select count(distinct a.month) from azienda a
        where a.year = y.year and a.month between 1 and 12)                                     as months_observed,
      coalesce((select sum(p.total_cost_eur) from pop p where p.year = y.year and p.is_ref), 0)  as reference_all_eur,
      coalesce((select sum(p.total_cost_eur) from pop p where p.year = y.year and p.is_ref
                  and (p.month is null or p.month not between 1 and 12)), 0)                     as reference_undated_eur,
      coalesce((select sum(p.total_cost_eur) from pop p where p.year = y.year and p.is_ref
                  and coalesce(p.active_substance, '') = ''), 0)                                 as reference_no_substance_eur,
      coalesce((select sum(p.total_cost_eur) from pop p where p.year = y.year and p.is_ref
                  and coalesce(p.active_substance, '') <> ''
                  and not exists (select 1 from mol m where m.year = p.year
                                    and m.active_substance = p.active_substance)), 0)            as reference_without_biosimilar_eur,
      (select count(*) from pop p where p.year = y.year and (p.is_bio or p.is_ref)
         and p.comparable_eligible is not true
         and p.total_content_mg > 0 and p.quantity_packs > 0 and p.total_cost_eur > 0)           as legacy_mass_rows
    from unnest(v_years) as y(year)
  )
  select jsonb_build_object(
    'years',     to_jsonb(v_years),
    'channels',  to_jsonb(p_channels),
    'substance', to_jsonb(p_substance),
    'by_year', coalesce((
      select jsonb_agg(jsonb_build_object(
        'year',                             yl.year,
        'months_observed',                  yl.months_observed,
        'reference_all_eur',                yl.reference_all_eur,
        'reference_undated_eur',            yl.reference_undated_eur,
        'reference_no_substance_eur',       yl.reference_no_substance_eur,
        'reference_without_biosimilar_eur', yl.reference_without_biosimilar_eur,
        'legacy_mass_rows',                 yl.legacy_mass_rows,
        'molecules', coalesce((
          select jsonb_agg(jsonb_build_object(
            'active_substance',     f.active_substance,
            'opening_key',          f.opening_key,
            'opening_from_undated', f.opening_key is not null
                                    and (f.opening_dated_key is null or f.opening_dated_key > f.opening_key),
            'reference',  jsonb_build_object('r_eur', f.ref_r, 'p_eur', f.ref_p, 'w_eur', f.ref_w,
                                             'm_eur', f.ref_m, 's_eur', f.ref_s, 'rows_n', f.ref_rows),
            'biosimilar', jsonb_build_object('b_eur', f.bio_b, 'p_eur', f.bio_p, 'w_eur', f.bio_w,
                                             'm_eur', f.bio_m, 's_eur', f.bio_s, 'rows_n', f.bio_rows),
            'not_compared', jsonb_build_object('unresolved_eur', f.nc_unresolved,
                                               'non_biosimilar_same_substance_eur', f.nc_same_substance,
                                               'other_eur', f.nc_other),
            'strata', coalesce(st.j, '[]'::jsonb)
          ) order by f.active_substance)
          from funnel f
          left join strata st on st.year = f.year and st.active_substance = f.active_substance
          where f.year = yl.year
        ), '[]'::jsonb)
      ) order by yl.year)
      from year_level yl
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end
$$;

comment on function public.pillar_b_stratum_unit_cost(int[], text, text[], text) is
  'For ONE Azienda: observed gross spend and comparable mass quantity per comparability stratum and side '
  '(reference medicine, biosimilar), in the months from the first local biosimilar dispensing, with the '
  'reference spend split outside window / not measurable / one side / both sides. No ratio, no difference, '
  'no saving. Mass units (MG, MCG, G) only. Reconciled in outputs/pillar-b/stratum-cost/b54.';

revoke all on function public.pillar_b_stratum_unit_cost(int[], text, text[], text) from public, anon;
grant execute on function public.pillar_b_stratum_unit_cost(int[], text, text[], text) to authenticated, service_role;
