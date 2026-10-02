-- Pillar B — biosimilar vs reference SPEND, on both of B05's denominators,
-- filterable server-side.
--
-- Section 14.
--
-- WHY perimeter_status AND NOT biosimilar_flag. `biosimilar_flag` and
-- `originator_flag` are 100% NULL on release PILLAR-B-R2-20261001 (measured:
-- 0 of 261,153). The split that IS populated is `perimeter_status`, at 99.6%,
-- with values biosimilar / reference_medicine / outside_biosimilar_perimeter /
-- unresolved. A view built on the flags would render 0 against 0 and look like
-- "no biosimilar activity".
--
-- TWO DENOMINATORS, NEVER ONE. B05 publishes both because they answer different
-- questions, and either alone misleads:
--
--   date-valid   months at or after the product's recorded classification
--                validity. 39,48% region-wide.
--   locally      months at or after the FIRST month a biosimilar of that
--   observed     substance was actually dispensed in the VISIBLE scope. 59,78%
--   (T2)         region-wide. This is the honest "was a switch possible here".
--
-- Under RLS "visible scope" is the caller's own perimeter: an Azienda's T2 is
-- its own first local dispensing, the Region's is the first across the four.
-- That is the correct scoping, and the UI must say which it is showing.
--
-- VALUE uptake is a share of MONEY, not of patients. A biosimilar costs less per
-- unit, so a share of money necessarily UNDERSTATES the share of treatment —
-- B05 confirmed this in 14 of 16 comparable pairs. The volume measure is
-- pillar_b_uptake and is reported separately, with its withheld complement.
--
-- SECURITY INVOKER: RLS on canonical_fact decides the rows. Never widen it here.
-- Bounded: one row per active substance in the biosimilar perimeter (tens, not
-- thousands), so there is nothing to page and no 57014 risk.

create or replace function public.pillar_b_value_uptake(
  p_year       int  default null,
  p_channel    text default null,
  p_substance  text default null
)
returns table (
  active_substance            text,
  date_valid_biosimilar_eur   numeric,
  date_valid_reference_eur    numeric,
  window_biosimilar_eur       numeric,
  window_reference_eur        numeric,
  first_local_month_key       int,
  perimeter_rows              bigint,
  date_valid_rows             bigint,
  window_rows                 bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select cf.*,
           (cf.year * 12 + cf.month) as month_key,
           case when cf.classification_valid_from is null then null
                else (extract(year from cf.classification_valid_from)::int * 12
                      + extract(month from cf.classification_valid_from)::int)
           end as valid_from_key
      from canonical_fact cf
     where cf.source_version_id = public.pillar_b_release()
       and cf.perimeter_status in ('biosimilar', 'reference_medicine')
       and cf.month between 1 and 12
       and (p_year      is null or cf.year    = p_year)
       and (p_channel   is null or cf.channel = p_channel)
       and (p_substance is null or cf.active_substance = p_substance)
  ),
  -- The first month a biosimilar of this substance was actually DISPENSED in
  -- the visible scope. Positive cost, because a credit note is not a dispensing.
  opened as (
    select s.active_substance, min(s.month_key) as first_key
      from scoped s
     where s.perimeter_status = 'biosimilar'
       and coalesce(s.total_cost_eur, 0) > 0
     group by s.active_substance
  )
  select
    s.active_substance,
    sum(s.total_cost_eur) filter (
      where s.perimeter_status = 'biosimilar'
        and s.valid_from_key is not null and s.month_key >= s.valid_from_key),
    sum(s.total_cost_eur) filter (
      where s.perimeter_status = 'reference_medicine'
        and s.valid_from_key is not null and s.month_key >= s.valid_from_key),
    sum(s.total_cost_eur) filter (
      where s.perimeter_status = 'biosimilar'
        and o.first_key is not null and s.month_key >= o.first_key),
    sum(s.total_cost_eur) filter (
      where s.perimeter_status = 'reference_medicine'
        and o.first_key is not null and s.month_key >= o.first_key),
    max(o.first_key)::int,
    count(*)::bigint,
    count(*) filter (where s.valid_from_key is not null and s.month_key >= s.valid_from_key)::bigint,
    count(*) filter (where o.first_key is not null and s.month_key >= o.first_key)::bigint
    from scoped s
    left join opened o on o.active_substance = s.active_substance
   group by s.active_substance
$$;

comment on function public.pillar_b_value_uptake(int, text, text) is
  'Biosimilar vs reference SPEND per substance on two denominators: date-valid '
  'months and locally observed months (B05). Value uptake is a share of money '
  'and understates share of treatment. perimeter_status is used because '
  'biosimilar_flag is 100% null on this release.';

grant execute on function public.pillar_b_value_uptake(int, text, text) to authenticated;
revoke execute on function public.pillar_b_value_uptake(int, text, text) from public, anon;

-- The filter path is (release, perimeter_status, year, channel, substance).
create index if not exists idx_canonical_fact_perimeter_filter
  on public.canonical_fact (source_version_id, perimeter_status, year, channel, active_substance);

analyze public.canonical_fact;
