-- Pillar B — the regional comparator for an ordinary Azienda (PB-V5-01).
--
-- DORMANT UNTIL APPLIED, and applied only with the owner's explicit approval:
-- this is a security change. Nothing existing is altered. canonical_fact's
-- RLS policy is untouched, so an Azienda reading canonical_fact directly, or
-- through any existing SECURITY INVOKER function, still sees its own rows only.
--
-- THE DECISION (owner, 9 October 2026). An ordinary Azienda may see its own
-- results and a POOLED aggregate of its own Region; never another Azienda's
-- figures and never another Region's. A Regione sees its Aziende through RLS;
-- a platform reviewer sees everything through the server's reviewer path.
-- Neither of them needs this function.
--
-- WHY SECURITY DEFINER, AND WHY THIS ONE IS SAFE. A pooled regional figure is
-- computed from peers' rows, which the Azienda's RLS rightly hides, so the
-- function must read as its owner (canonical_fact has RLS enabled, not
-- forced). What makes that acceptable is everything the function refuses:
--   * It takes NO organisation, region or user argument. The caller's Azienda
--     and Region come from auth.uid() and the caller's single approved
--     membership, read here, inside the database. A browser cannot name a peer.
--   * It returns only PERCENTAGES pooled over the whole Region (the caller's
--     own Azienda included): no euro amount, no row, no per-Azienda group, no
--     Azienda code or name, no count of contributing Aziende.
--   * Every row of the Region is attributed to ONE registered Azienda of that
--     Region (organizations, asl, either code form: region || org or the bare
--     org, as the RLS policy accepts). A row with no code, an unknown code, or
--     a code that two organisations could claim makes the whole answer
--     unavailable: such a row would otherwise enter the totals unchecked, or
--     count as an extra "other Azienda" and unlock a figure the rule withholds.
--   * Every row of the Region carries channel CO, DD or DPC, or the whole
--     answer is unavailable (unexpected_channel). The quotas count every
--     channel and the mix these three, as the Azienda's own figures do; a
--     fourth channel would split the two, and their difference would be a
--     quantity the rule does not check.
--   * Its scope is FIXED and coarse: the whole biosimilar perimeter (the whole
--     reported spend for the channel mix), the three channels together, and a
--     choice of years only. There is no molecule and no channel filter.
--   * Every quantity an attacker could reconstruct from its answers must pass
--     the disclosure rule below. The caller knows its own amounts exactly, so
--     each answered ratio is a linear equation in the other Aziende's sums.
--     Ratios alone fix no amount while every part has two or more
--     contributors (they are unchanged when the whole Region is scaled); an
--     outside figure, such as a published regional total, or a part that is
--     zero for every other Azienda (the zero exceptions below), can fix the
--     scale. The rule is therefore applied to everything the answers would
--     then determine, including the differences between measures. With
--     arbitrary channel subsets that would have meant every channel's share of
--     every measure, and their differences (quota 1 minus quota 2 per channel)
--     can belong to a single Azienda; with the fixed scope it is the parts
--     listed below. The harness checks this by rank, with and without such
--     anchors. What remains (bounds, the visibility of a withheld answer,
--     combinations under outside knowledge of zero cells) is documented in
--     docs/PILLAR_B_REGIONAL_COMPARATOR.md §8.
--   * search_path is pg_catalog, pg_temp: built-in names resolve first, and
--     the session's temporary schema LAST (left out of the path, PostgreSQL
--     would search it first for table and type names). Every relation is
--     schema-qualified, and the active release is read here directly rather
--     than through another function with its own search_path. No temporary
--     table is used; the computation is one statement after the checks.
--   * EXECUTE is granted to authenticated only; PUBLIC, anon and service_role
--     are revoked (Supabase grants new functions to all three by default).
--   * It calls no other function of this application except auth.uid().
--
-- THE DISCLOSURE RULE (documented in docs/PILLAR_B_REGIONAL_COMPARATOR.md,
-- attacked in outputs/pillar-b/logs/b49). A part PASSES when, over the
-- Aziende OTHER than the caller:
--   (a) at least TWO of them have a positive amount;
--   (b) none of them has a negative amount;
--   (c) the largest of them is at most 75% of their total (a p%-rule with
--       p = 1/3: the others must hide the largest by at least a third of it).
-- The parts, per selected YEAR (the uptake shares span the three channels):
--   W_bio, W_ref   biosimilar / reference spend in each Azienda's quota-2
--                  window (quota 2's numerator and the rest of its
--                  denominator);
--   Q1_bio, Q1_ref the same over all date-valid months (quota 1);
--   P_bio, P_ref   Q1 minus W: date-valid spend before the Azienda's own
--                  first use (what quota 1 minus quota 2 would expose);
--   Rest           the reported spend outside Q1 (what the spend minus
--                  quota 1 would expose);
-- and per selected (YEAR, CHANNEL) of CO, DD and DPC: the reported spend
-- (each channel-mix share is one channel's spend).
-- Quota 1 is answered when Q1_bio, Q1_ref and Rest pass in every selected
-- year; quota 2 when W_bio, W_ref, P_bio, P_ref and Rest do. P_bio, P_ref and
-- Rest, which are differences rather than measures, also pass when they are
-- exactly zero for every other Azienda (nothing to expose); so does a
-- channel's spend in the mix, provided at least one channel of the year
-- passes on (a)-(c). The channel mix of a year is answered when its three
-- channels pass, and is withheld whole otherwise (the other shares would imply
-- the missing one). A share that falls outside 0-100% (credit notes larger
-- than the spend) is "not computable". Anything not answered is "non
-- disponibile" (null with a reason), never zero. A two-year answer is a sum of
-- passing parts, which passes too: the largest of a sum is at most the sum of
-- the largest, so (c) is closed under addition, and so are (a) and (b).
--
-- THE MEASURES, defined exactly as the page defines the Azienda's own when no
-- channel or molecule filter is set.
--   quota 1: biosimilar spend in date-valid months (validity inside, or the
--            predates_window evidence list) ÷ biosimilar + reference spend in
--            the same months, summed over every Azienda of the Region, the
--            three channels.
--   quota 2: the same over the months from the first local biosimilar
--            dispensing, where "first" is EACH AZIENDA'S OWN first use of the
--            substance (the clock its own quota 2 uses), summed. This is NOT
--            the quota 2 a Regione account sees for its Region, which counts
--            from the first use by any Azienda of the Region.
--   channel mix: the share of CO, DD and DPC in the Region's reported spend
--            in the year.
-- Pooled = summed numerators over summed denominators; never the mean of
-- Azienda percentages. The validity rule and the predates_window list are
-- copied from 20261003090000_pillar_b_scoped_views.sql; the harness
-- reconciles this function against that function, against each Azienda's own
-- figures read as itself, and against direct SQL.

create or replace function public.pillar_b_regional_comparator(p_years int[])
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_n         int;
  v_org_code  text;
  v_org_type  text;
  v_region    text;
  v_release   text;
  v_years     int[];
  v_codes     text[];
  v_orgs      text[];
  v_bad       boolean;
  v_odd       boolean;
  v_result    jsonb;
begin
  -- 1. WHO. Exactly one approved membership, of an Azienda, with a Region.
  -- (A unique index already allows one approved membership per user; the
  -- count is checked again so the function never has to choose.)
  if v_uid is null then
    return jsonb_build_object('status', 'no_session');
  end if;
  select count(*) into v_n
  from public.user_organizations uo
  where uo.user_id = v_uid and uo.status = 'approved';
  if v_n = 0 then
    return jsonb_build_object('status', 'no_membership');
  elsif v_n > 1 then
    return jsonb_build_object('status', 'ambiguous_membership');
  end if;
  select o.org_code, o.org_type, o.region_code
    into v_org_code, v_org_type, v_region
  from public.user_organizations uo
  join public.organizations o on o.org_code = uo.org_code
  where uo.user_id = v_uid and uo.status = 'approved';
  if v_org_type is distinct from 'asl' then
    return jsonb_build_object('status', 'not_an_azienda');
  end if;
  if v_region is null or v_region = '' then
    return jsonb_build_object('status', 'no_region');
  end if;

  -- 2. WHICH YEARS. The comparable pair only (2026 is partial).
  if p_years is null or cardinality(p_years) = 0
     or array_position(p_years, null) is not null
     or not (p_years <@ array[2024, 2025]) then
    return jsonb_build_object('status', 'invalid_filter', 'reason', 'years');
  end if;
  v_years := array(select distinct y from unnest(p_years) as u(y) order by y);

  -- 3. WHICH RELEASE: exactly one active, read here (fail closed otherwise).
  select count(*), min(r.release_id) into v_n, v_release
  from public.pillar_b_active_release r;
  if v_n <> 1 or v_release is null then
    return jsonb_build_object('status', 'no_release');
  end if;

  -- 4. WHOSE ROWS, WHICH CHANNELS. Every asl_code of the Region in this
  -- release must be one form of exactly one registered Azienda of the Region,
  -- and every row must carry CO, DD or DPC; otherwise nothing. One scan.
  with codes as (
    select f.asl_code,
           bool_or(f.channel is null or f.channel not in ('CO', 'DD', 'DPC')) as odd_channel
    from public.canonical_fact f
    where f.source_version_id = v_release and f.region_code = v_region
    group by f.asl_code
  ),
  claims as (
    select c.asl_code, c.odd_channel, o.org_code, o.org_type, o.region_code
    from codes c
    left join public.organizations o
      on c.asl_code is not null
     and (c.asl_code = o.org_code or c.asl_code = coalesce(o.region_code, '') || o.org_code)
  ),
  resolved as (
    select cl.asl_code,
           bool_or(cl.odd_channel) as odd_channel,
           count(cl.org_code) as n,
           min(cl.org_code) as org_code,
           bool_and(cl.org_type = 'asl' and cl.region_code = v_region) as in_region
    from claims cl
    group by cl.asl_code
  )
  select coalesce(bool_or(rs.asl_code is null or rs.n <> 1 or not coalesce(rs.in_region, false)), false),
         coalesce(bool_or(rs.odd_channel), false),
         array_agg(rs.asl_code) filter (where rs.asl_code is not null and rs.n = 1 and rs.in_region),
         array_agg(rs.org_code) filter (where rs.asl_code is not null and rs.n = 1 and rs.in_region)
    into v_bad, v_odd, v_codes, v_orgs
  from resolved rs;
  if v_bad then
    return jsonb_build_object('status', 'unresolved_rows');
  end if;
  if v_odd then
    return jsonb_build_object('status', 'unexpected_channel');
  end if;

  -- 5.-8. One statement.
  with azienda as (
    select m.asl_code, m.org_code
    from unnest(coalesce(v_codes, array[]::text[]), coalesce(v_orgs, array[]::text[])) as m(asl_code, org_code)
  ),
  base as (
    select
      a.org_code as az, cf.year, cf.channel, cf.active_substance, cf.perimeter_status,
      cf.total_cost_eur, cf.aic, cf.classification_valid_from,
      (cf.year * 12 + cf.month) as month_key,
      make_date(cf.year, cf.month, 1) as month_first,
      (make_date(cf.year, cf.month, 1) + interval '1 month' - interval '1 day')::date as month_last
    from public.canonical_fact cf
    join azienda a on a.asl_code = cf.asl_code
    where cf.source_version_id = v_release
      and cf.region_code = v_region
      and cf.month between 1 and 12
      and cf.year = any (v_years)
  ),
  classified as (
    select b.*,
      case
        when b.perimeter_status not in ('biosimilar', 'reference_medicine') then null
        when b.classification_valid_from is null
             and b.aic in ('044039028','044039079','044039143','044039206',
                           '044039269','044269037','044269064','044269090',
                           '044269126','044269153')      then 'predates_window'
        when b.classification_valid_from is null          then 'unknown'
        when b.classification_valid_from <= b.month_first then 'inside'
        when b.classification_valid_from >  b.month_last  then 'outside'
        else                                                   'boundary'
      end as validity
    from base b
  ),
  -- EACH AZIENDA'S OWN first local use, over its full history and every
  -- channel (the year is a display choice and must not restart the clock),
  -- across both forms of its code.
  opened as (
    select a.org_code as az, f.active_substance, min(f.year * 12 + f.month) as first_key
    from public.canonical_fact f
    join azienda a on a.asl_code = f.asl_code
    where f.source_version_id = v_release
      and f.region_code = v_region
      and f.perimeter_status = 'biosimilar'
      and f.month between 1 and 12
      and coalesce(f.source_quantity, 0) > 0
      and (
        (f.classification_valid_from is null
           and f.aic in ('044039028','044039079','044039143','044039206',
                         '044039269','044269037','044269064','044269090',
                         '044269126','044269153'))
        or f.classification_valid_from <= make_date(f.year, f.month, 1)
      )
    group by a.org_code, f.active_substance
  ),
  -- Per Azienda of the Region x year x channel: every component.
  cells as (
    select
      c.az, c.year, c.channel, (c.az = v_org_code) as own,
      coalesce(sum(c.total_cost_eur), 0) as spend,
      coalesce(sum(c.total_cost_eur) filter (
        where c.perimeter_status = 'biosimilar' and c.validity in ('inside', 'predates_window')), 0) as q1_bio,
      coalesce(sum(c.total_cost_eur) filter (
        where c.perimeter_status = 'reference_medicine' and c.validity in ('inside', 'predates_window')), 0) as q1_ref,
      coalesce(sum(c.total_cost_eur) filter (
        where c.perimeter_status = 'biosimilar' and c.validity in ('inside', 'predates_window')
          and o.first_key is not null and c.month_key >= o.first_key), 0) as q2_bio,
      coalesce(sum(c.total_cost_eur) filter (
        where c.perimeter_status = 'reference_medicine' and c.validity in ('inside', 'predates_window')
          and o.first_key is not null and c.month_key >= o.first_key), 0) as q2_ref
    from classified c
    left join opened o on o.az = c.az and o.active_substance = c.active_substance
    group by c.az, c.year, c.channel
  ),
  -- The uptake shares span the three channels: their parts are per year.
  year_cells as (
    select x.az, x.year, x.own,
      sum(x.q1_bio) as q1_bio, sum(x.q1_ref) as q1_ref,
      sum(x.q2_bio) as w_bio,  sum(x.q2_ref) as w_ref,
      sum(x.q1_bio - x.q2_bio) as p_bio, sum(x.q1_ref - x.q2_ref) as p_ref,
      sum(x.spend - x.q1_bio - x.q1_ref) as rest
    from cells x
    group by x.az, x.year, x.own
  ),
  year_comps as (
    select y.year, y.own, k.comp,
      case k.comp
        when 'q1_bio' then y.q1_bio
        when 'q1_ref' then y.q1_ref
        when 'w_bio'  then y.w_bio
        when 'w_ref'  then y.w_ref
        when 'p_bio'  then y.p_bio
        when 'p_ref'  then y.p_ref
        else               y.rest
      end as val
    from year_cells y
    cross join (values ('q1_bio'), ('q1_ref'), ('w_bio'), ('w_ref'),
                       ('p_bio'), ('p_ref'), ('rest')) as k(comp)
  ),
  -- 6. THE DISCLOSURE RULE over the OTHER Aziende. A selected year with no
  -- row at all fails (a). The three differences may instead be zero for all.
  uptake_rule as (
    select gy.year, k.comp,
      (    count(c.val) filter (where not c.own and c.val > 0) >= 2
       and count(c.val) filter (where not c.own and c.val < 0) = 0
       and coalesce(max(c.val) filter (where not c.own), 0)
             <= 0.75 * coalesce(sum(c.val) filter (where not c.own), 0))
      or (k.comp in ('p_bio', 'p_ref', 'rest')
          and count(c.val) filter (where not c.own and c.val <> 0) = 0) as pass
    from unnest(v_years) as gy(year)
    cross join (values ('q1_bio'), ('q1_ref'), ('w_bio'), ('w_ref'),
                       ('p_bio'), ('p_ref'), ('rest')) as k(comp)
    left join year_comps c on c.year = gy.year and c.comp = k.comp
    group by gy.year, k.comp
  ),
  mix_rule as (
    select gy.year, gc.channel,
      (    count(x.spend) filter (where not x.own and x.spend > 0) >= 2
       and count(x.spend) filter (where not x.own and x.spend < 0) = 0
       and coalesce(max(x.spend) filter (where not x.own), 0)
             <= 0.75 * coalesce(sum(x.spend) filter (where not x.own), 0)) as strict_pass,
      count(x.spend) filter (where not x.own and x.spend <> 0) = 0 as zero_for_all
    from unnest(v_years) as gy(year)
    cross join (values ('CO'), ('DD'), ('DPC')) as gc(channel)
    left join cells x on x.year = gy.year and x.channel = gc.channel
    group by gy.year, gc.channel
  ),
  totals as (
    select sum(y.q1_bio) as q1b, sum(y.q1_bio + y.q1_ref) as q1d,
           sum(y.w_bio) as q2b, sum(y.w_bio + y.w_ref) as q2d
    from year_cells y
  ),
  -- 7. THE TWO UPTAKE SHARES, each on its own parts.
  uptake as (
    select jsonb_build_object(
      'quota1', case
        when exists (select 1 from uptake_rule r
                     where r.comp in ('q1_bio', 'q1_ref', 'rest') and not r.pass)
          then jsonb_build_object('available', false, 'reason', 'cell_rule', 'share', null)
        when coalesce(t.q1d, 0) <= 0 or t.q1b < 0 or t.q1b > t.q1d
          then jsonb_build_object('available', false, 'reason', 'not_computable', 'share', null)
        else jsonb_build_object('available', true, 'reason', null, 'share', t.q1b / t.q1d)
      end,
      'quota2', case
        when exists (select 1 from uptake_rule r
                     where r.comp in ('w_bio', 'w_ref', 'p_bio', 'p_ref', 'rest') and not r.pass)
          then jsonb_build_object('available', false, 'reason', 'cell_rule', 'share', null)
        when coalesce(t.q2d, 0) <= 0 or t.q2b < 0 or t.q2b > t.q2d
          then jsonb_build_object('available', false, 'reason', 'not_computable', 'share', null)
        else jsonb_build_object('available', true, 'reason', null, 'share', t.q2b / t.q2d)
      end) as j
    from totals t
  ),
  -- 8. THE CHANNEL MIX, per year: all three channels pass (at least one on
  -- the rule itself), or the whole year is withheld (the other shares would
  -- imply the missing one).
  year_total as (
    select gy.year,
      (select coalesce(sum(x.spend), 0) from cells x
        where x.year = gy.year and x.channel in ('CO', 'DD', 'DPC')) as total,
      exists (select 1 from (select x.channel, sum(x.spend) as s from cells x
                             where x.year = gy.year and x.channel in ('CO', 'DD', 'DPC')
                             group by x.channel) t where t.s < 0) as has_negative,
      exists (select 1 from mix_rule r where r.year = gy.year and not (r.strict_pass or r.zero_for_all))
        or not exists (select 1 from mix_rule r where r.year = gy.year and r.strict_pass) as fails
    from unnest(v_years) as gy(year)
  ),
  mix as (
    select yt.year,
      case
        when yt.fails
          then jsonb_build_object('year', yt.year, 'available', false, 'reason', 'cell_rule', 'shares', null)
        when yt.total <= 0 or yt.has_negative
          then jsonb_build_object('year', yt.year, 'available', false, 'reason', 'not_computable', 'shares', null)
        else jsonb_build_object('year', yt.year, 'available', true, 'reason', null, 'shares', (
          select jsonb_object_agg(gc.channel,
                   (select coalesce(sum(x.spend), 0) from cells x
                     where x.year = yt.year and x.channel = gc.channel) / yt.total)
          from (values ('CO'), ('DD'), ('DPC')) as gc(channel)))
      end as j
    from year_total yt
  )
  select jsonb_build_object(
    'status', 'ok',
    'years', to_jsonb(v_years),
    'uptake', (select u.j from uptake u),
    'channel_mix', (select coalesce(jsonb_agg(m.j order by m.year), '[]'::jsonb) from mix m)
  ) into v_result;

  return v_result;
end
$$;

comment on function public.pillar_b_regional_comparator(int[]) is
  'PB-V5-01. For an ordinary Azienda: pooled shares of ITS OWN Region (itself '
  'included), derived from auth.uid(), over CO, DD and DPC together and the '
  'whole perimeter; years are the only choice. No peer row, amount, code, name or '
  'count. Every part an answer could expose must pass the disclosure rule '
  '(>= 2 other Aziende positive, none negative, largest <= 75% of the others). '
  'Reconciled and attacked in outputs/pillar-b/logs/b49.';

revoke all on function public.pillar_b_regional_comparator(int[]) from public;
revoke all on function public.pillar_b_regional_comparator(int[]) from anon;
revoke all on function public.pillar_b_regional_comparator(int[]) from service_role;
grant execute on function public.pillar_b_regional_comparator(int[]) to authenticated;
