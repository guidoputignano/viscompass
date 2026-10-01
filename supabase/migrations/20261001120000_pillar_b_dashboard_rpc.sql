-- 12. Pillar B dashboard read API
-- Append-only. Idempotent (create or replace).
--
-- supabase-js cannot issue raw SQL, and PostgREST cannot express these
-- aggregations, so the dashboard reads through RPC functions. Three properties
-- matter and are deliberate:
--
--   SECURITY INVOKER (the default, stated here for the reader). These functions
--   run as the CALLER, so the canonical_fact RLS policy applies INSIDE them. An
--   ASL calling pillar_b_spend() aggregates only its own rows; the Regione
--   aggregates its four. There is no org parameter, because a parameter is
--   something a client can lie about — scope comes from auth.uid() via RLS, the
--   same reason my_objective_rank() derives the caller's org rather than
--   accepting it. (my_objective_rank is SECURITY DEFINER because it must read
--   OTHER orgs to compute a rank while revealing none; these functions must not
--   read other orgs at all, so invoker is both sufficient and safer.)
--
--   NULL IS NOT ZERO. Every aggregate returns null when nothing was observed.
--   `sum()` over no rows is already null in Postgres; that is preserved rather
--   than coalesced, because "no data" rendering as "zero spending" has been a
--   real defect in this project.
--
--   NO QUANTITY AGGREGATE. These functions return euros, row counts and BASIS
--   COVERAGE. They deliberately return no summed quantity of any kind: the source
--   quantity's package/unit convention is inferred, never confirmed, so a total
--   over it has no coherent unit. Per-row quantities stay on canonical_fact for
--   audit; only uptake aggregates them, and only inside one substance, route and
--   unit.
--
-- Month bounds are inclusive and are how the matched January–May 2026 window is
-- expressed. No function offers a full-year-against-YTD comparison; that is
-- enforced in the TypeScript period model, which has no constructor for it.
-- ============================================================


-- ---------------------------------------------------------------- release guard
-- Every RPC below reads ONE release. Without this, loading a future source
-- version alongside this one would silently double every total, and the figures
-- would still look plausible. The active release is declared, not inferred, and
-- a function raises rather than guessing when the declaration is missing or the
-- table holds a release that was never declared.
create table if not exists pillar_b_active_release (
  release_id  text primary key,
  activated_at timestamptz not null default now(),
  only_one    boolean generated always as (true) stored unique
);
alter table pillar_b_active_release enable row level security;
revoke all on pillar_b_active_release from anon, authenticated;
grant select on pillar_b_active_release to authenticated;
drop policy if exists "active release readable" on pillar_b_active_release;
create policy "active release readable" on pillar_b_active_release
  for select to authenticated using (true);

create or replace function public.pillar_b_release() returns text
language plpgsql stable security invoker set search_path = public as $$
declare rid text;
begin
  select release_id into rid from pillar_b_active_release;
  if rid is null then
    raise exception 'no active Pillar B release is declared; refusing to aggregate'
      using hint = 'insert the release id into pillar_b_active_release';
  end if;
  return rid;
end $$;
revoke all on function public.pillar_b_release() from public, anon;
grant execute on function public.pillar_b_release() to authenticated;

-- ---------------------------------------------------------------- spend
-- Observed spend and quantity for a period, with the comparability split.
create or replace function public.pillar_b_spend(
  p_year       int,
  p_from_month int default 1,
  p_to_month   int default 12
)
returns table (
  asl_code              text,
  channel               text,
  rows_observed         bigint,
  spend_eur             numeric,   -- null when nothing observed
  -- NO QUANTITY AGGREGATE OF ANY KIND.
  --
  -- A package total would assert a convention nobody has confirmed. But summing
  -- the RAW values is no better: adding 50 packages to 1,200 units to a row whose
  -- basis is unknown produces a scalar with no coherent unit, and calling it
  -- "raw" does not give it one. An earlier version returned exactly that.
  --
  -- What a caller legitimately needs is COVERAGE: how many rows rest on each
  -- basis, so the share of the figure that could ever carry a unit is visible.
  -- The per-row source_quantity remains on canonical_fact for audit.
  rows_basis_packages   bigint,
  rows_basis_units      bigint,
  rows_basis_mixed      bigint,
  rows_basis_unknown    bigint,
  comparable_rows       bigint,
  comparable_spend_eur  numeric,
  negative_rows         bigint     -- returns/corrections, retained
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    cf.asl_code,
    cf.channel,
    count(*)::bigint,
    sum(cf.total_cost_eur),
    count(*) filter (where cf.source_quantity_basis = 'packages')::bigint,
    count(*) filter (where cf.source_quantity_basis = 'units')::bigint,
    count(*) filter (where cf.source_quantity_basis = 'mixed')::bigint,
    count(*) filter (where cf.source_quantity_basis = 'unknown')::bigint,
    count(*) filter (where cf.comparable_eligible)::bigint,
    sum(cf.total_cost_eur) filter (where cf.comparable_eligible),
    count(*) filter (where cf.total_cost_eur < 0)::bigint
  from canonical_fact cf
  where cf.source_version_id = public.pillar_b_release()
    and cf.year = p_year
    and cf.month between p_from_month and p_to_month
  group by cf.asl_code, cf.channel
$$;

-- ---------------------------------------------------------------- uptake
-- Biosimilar uptake on a normalized quantity, within one SUBSTANCE and ROUTE,
-- on two denominators.
--
-- GROUPING BY STRATUM WAS WRONG AND IS FIXED HERE. A comparable stratum is
-- keyed by molecule|route|form|unit|year, and a biosimilar and its reference
-- medicine very often sit in DIFFERENT strata: of the strata touching the
-- perimeter, only 16 contain both sides, while 37 hold a biosimilar alone and 55
-- a reference alone. Grouping by stratum therefore forced the share to 0% or
-- 100% for 92 of 108 of them, which is the same defect as the earlier AIC
-- grouping wearing a different key.
--
-- The grain that actually answers the question is (ASL, substance, ROUTE, year).
-- Route is part of it, not a detail: 13 substance-years span ENDOVENOSO and
-- SOTTOCUTANEO -- ustekinumab, natalizumab, tocilizumab among them -- and pooling
-- an intravenous with a subcutaneous presentation is not a substitution share.
--
-- ONE UNIT IS REQUIRED, NOT ASSUMED. The stratum used to carry that guarantee;
-- at substance grain it must be enforced, so a group whose sides do not share a
-- single comparable_unit is withheld. Four substance-years need it: enoxaparin
-- sodium (MG and UI) and insulin glargine (U, UI and UNITA).
--
-- BOTH SIDES MUST BE PRESENT. A group with no biosimilar row has no uptake to
-- report -- not 0%, which would assert the biosimilar was available and unused.
create or replace function public.pillar_b_uptake(
  p_year       int,
  p_from_month int default 1,
  p_to_month   int default 12
)
returns table (
  asl_code                      text,
  active_substance              text,
  route                         text,
  comparable_unit               text,
  whole_period_biosimilar_qty   numeric,
  whole_period_total_qty        numeric,
  window_biosimilar_qty         numeric,
  window_total_qty              numeric,
  first_local_biosimilar_key    int,
  strata_pooled                 int
)
language sql
stable
security invoker
set search_path = public
as $$
  with usable as (
    select cf.*,
           -- route is the third segment of the stratum key
           split_part(cf.comparable_stratum_id, '|', 3) as route_key
      from canonical_fact cf
     where cf.source_version_id = public.pillar_b_release()
       and cf.year = p_year
       and cf.month between p_from_month and p_to_month
       and cf.source_disposition = 'analytical'
       and cf.perimeter_status in ('biosimilar','reference_medicine')
       and cf.comparable_eligible
       and cf.comparable_quantity is not null
       and cf.comparable_unit is not null
       and cf.active_substance is not null
  ),
  grouped as (
    select asl_code, active_substance, route_key,
           count(distinct comparable_unit) as units,
           count(*) filter (where perimeter_status = 'biosimilar')         as bio_rows,
           count(*) filter (where perimeter_status = 'reference_medicine') as ref_rows
      from usable
     group by 1, 2, 3
  ),
  eligible_groups as (
    -- one unit, and both sides present
    select * from grouped where units = 1 and bio_rows > 0 and ref_rows > 0
  ),
  opened as (
    -- observed POSITIVE source quantity, across the WHOLE fact set, and NOT
    -- restricted to comparable rows: availability is a fact about dispensing.
    select cf.asl_code, cf.active_substance,
           split_part(cf.comparable_stratum_id, '|', 3) as route_key,
           min(cf.year * 12 + cf.month) as first_key
      from canonical_fact cf
     where cf.source_version_id = public.pillar_b_release()
       and cf.source_disposition = 'analytical'
       and cf.perimeter_status = 'biosimilar'
       and cf.active_substance is not null
       and cf.source_quantity > 0
       and cf.month is not null
     group by 1, 2, 3
  )
  select
    u.asl_code,
    u.active_substance,
    u.route_key,
    max(u.comparable_unit),
    sum(u.comparable_quantity) filter (where u.perimeter_status = 'biosimilar'),
    sum(u.comparable_quantity),
    sum(u.comparable_quantity) filter (
      where u.perimeter_status = 'biosimilar'
        and o.first_key is not null and (u.year * 12 + u.month) >= o.first_key),
    sum(u.comparable_quantity) filter (
      where o.first_key is not null and (u.year * 12 + u.month) >= o.first_key),
    max(o.first_key),
    count(distinct u.comparable_stratum_id)::int
  from usable u
  join eligible_groups g
    on g.asl_code = u.asl_code and g.active_substance = u.active_substance
   and g.route_key = u.route_key
  left join opened o
    on o.asl_code = u.asl_code and o.active_substance = u.active_substance
   and o.route_key = u.route_key
  group by u.asl_code, u.active_substance, u.route_key
$$;

-- --------------------------------------------------------- uptake, withheld
-- Everything in scope for uptake that uptake could NOT use, as its own rows.
--
-- An earlier version attached a withheld count to each uptake row. That both
-- DUPLICATED (a substance spanning two strata carried the same count twice) and
-- DISAPPEARED (a group with no usable stratum produced no uptake row at all, so
-- its withheld rows vanished). Neither is detectable by looking at the output.
--
-- Returned separately, every in-scope row appears exactly once across the two
-- functions, so usable + withheld reconciles to the in-scope total by row count
-- AND by euros. The reason is named so the loss can be read, not just measured.
create or replace function public.pillar_b_uptake_withheld(
  p_year       int,
  p_from_month int default 1,
  p_to_month   int default 12
)
returns table (
  asl_code          text,
  active_substance  text,
  withheld_reason   text,
  rows_n              bigint,
  spend_eur           numeric
  -- No quantity total here either. The withheld set spans every basis by
  -- definition, so a sum over it is the least coherent of all.
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    cf.asl_code,
    cf.active_substance,
    case
      when cf.active_substance is null         then 'substance not named by the frozen taxonomy'
      when not cf.comparable_eligible          then 'no comparable stratum'
      when cf.quantity_basis_status = 'parses_conflict'
        then 'quantity basis unresolved: the two independent parses disagree'
      when cf.quantity_basis_status = 'absent'
        then 'no parsed presentation for this product'
      when cf.comparable_quantity is null      then 'no normalized quantity for this presentation'
      when cf.comparable_unit is null          then 'no comparable unit'
      else 'substance/route group not usable: mixed units, or only one side present'
    end,
    count(*)::bigint,
    sum(cf.total_cost_eur)
  from canonical_fact cf
  where cf.source_version_id = public.pillar_b_release()
    and cf.year = p_year
    and cf.month between p_from_month and p_to_month
    and cf.source_disposition = 'analytical'
    and cf.perimeter_status in ('biosimilar','reference_medicine')
    and not exists (
      -- anything pillar_b_uptake actually used
      select 1 from public.pillar_b_uptake(p_year, p_from_month, p_to_month) u
       where u.asl_code = cf.asl_code
         and u.active_substance is not distinct from cf.active_substance
         and u.route = split_part(cf.comparable_stratum_id, '|', 3)
    )
  group by 1, 2, 3
$$;

-- ------------------------------------------------- uptake scope denominator
-- The in-scope total both of the above partition. Exists so the reconciliation
-- is a query rather than an assumption.
create or replace function public.pillar_b_uptake_scope(
  p_year       int,
  p_from_month int default 1,
  p_to_month   int default 12
)
returns table (
  rows_n              bigint,
  spend_eur           numeric,
  -- basis COVERAGE, not a quantity total: see the note on pillar_b_spend.
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
  select count(*)::bigint,
         sum(cf.total_cost_eur),
         count(*) filter (where cf.source_quantity_basis = 'packages')::bigint,
         count(*) filter (where cf.source_quantity_basis = 'units')::bigint,
         count(*) filter (where cf.source_quantity_basis = 'mixed')::bigint,
         count(*) filter (where cf.source_quantity_basis = 'unknown')::bigint
    from canonical_fact cf
   where cf.source_version_id = public.pillar_b_release()
     and cf.year = p_year
     and cf.month between p_from_month and p_to_month
     and cf.source_disposition = 'analytical'
     and cf.perimeter_status in ('biosimilar','reference_medicine')
$$;

-- ---------------------------------------------------------------- funnel
-- The evidence funnel: source spend narrowed step by step, with the euros and
-- rows lost at each step named. This is the first thing a reviewer should see,
-- before any per-unit figure, because it states how much of the ledger the rest
-- of the dashboard is entitled to speak about.
create or replace function public.pillar_b_evidence_funnel(
  p_year       int default null,
  p_from_month int default 1,
  p_to_month   int default 12
)
returns table (
  stage      text,
  step       int,
  rows_n     bigint,
  spend_eur  numeric,
  note       text
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select * from canonical_fact cf
     where cf.source_version_id = public.pillar_b_release()
       and (p_year is null or cf.year = p_year)
       and (p_year is null or cf.month between p_from_month and p_to_month)
  )
  -- NOTE ON MONOTONICITY. Spend is SIGNED: the ledger carries 828 negative rows
  -- (returns and corrections). A later stage can therefore exceed an earlier one
  -- in euros while still being a strict ROW subset, because the stage that drops
  -- a negative row gains its absolute value. An earlier monotonicity check passed
  -- only because it was run on the aggregate; it fails for reachable ASL/month
  -- slices. Row counts are the monotone quantity here and are returned alongside,
  -- and the note tells the reader which is which.
  select 'Spesa osservata', 1, count(*)::bigint, sum(total_cost_eur),
         'Tutte le righe nel perimetro, incluse le rettifiche negative (spesa con segno)'
    from scoped
  union all
  select 'Riga classificabile (AIC)', 2,
         count(*) filter (where source_disposition = 'analytical')::bigint,
         sum(total_cost_eur) filter (where source_disposition = 'analytical'),
         'Le righe non AIC restano nel totale ma non entrano in alcun confronto'
    from scoped
  union all
  select 'Perimetro biosimilare', 3,
         count(*) filter (where perimeter_status in
           ('biosimilar','reference_medicine','non_biosimilar_same_substance'))::bigint,
         sum(total_cost_eur) filter (where perimeter_status in
           ('biosimilar','reference_medicine','non_biosimilar_same_substance')),
         'Lo stato irrisolto è conservato: non è un originatore'
    from scoped
  union all
  -- NESTED under stage 3, not beside it. An earlier version filtered only on
  -- comparable_eligible, which spans the whole ledger and is orthogonal to the
  -- perimeter: stage 4 came out LARGER than stage 3 and the "funnel" widened.
  -- A funnel whose stages are not subsets is not a funnel.
  select 'Quantità confrontabile', 4,
         count(*) filter (where comparable_eligible and perimeter_status in
           ('biosimilar','reference_medicine','non_biosimilar_same_substance'))::bigint,
         sum(total_cost_eur) filter (where comparable_eligible and perimeter_status in
           ('biosimilar','reference_medicine','non_biosimilar_same_substance')),
         'Solo le righe del perimetro in uno strato confrontabile con unità comune'
    from scoped
  order by 2
$$;

-- ---------------------------------------------------------------- perimeter
-- Spend by perimeter status, so the unresolved share is visible rather than
-- folded into a residual.
create or replace function public.pillar_b_perimeter_coverage(
  p_year int default null
)
returns table (
  perimeter_status text,
  aic_count        bigint,
  rows_n           bigint,
  spend_eur        numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select cf.perimeter_status,
         count(distinct cf.aic)::bigint,
         count(*)::bigint,
         sum(cf.total_cost_eur)
    from canonical_fact cf
   where cf.source_version_id = public.pillar_b_release()
     and (p_year is null or cf.year = p_year)
     and cf.source_disposition = 'analytical'
   group by cf.perimeter_status
$$;

revoke all on function public.pillar_b_spend(int, int, int) from public, anon;
revoke all on function public.pillar_b_uptake(int, int, int) from public, anon;
revoke all on function public.pillar_b_evidence_funnel(int, int, int) from public, anon;
revoke all on function public.pillar_b_perimeter_coverage(int) from public, anon;

grant execute on function public.pillar_b_spend(int, int, int) to authenticated;
grant execute on function public.pillar_b_uptake(int, int, int) to authenticated;
grant execute on function public.pillar_b_evidence_funnel(int, int, int) to authenticated;
grant execute on function public.pillar_b_perimeter_coverage(int) to authenticated;

comment on function public.pillar_b_spend(int, int, int) is
  'Observed spend/quantity for a period. SECURITY INVOKER: scope comes from RLS, never a parameter.';
comment on function public.pillar_b_uptake(int, int, int) is
  'Biosimilar uptake on two denominators (whole period, locally substitutable window). Never average them.';
comment on function public.pillar_b_evidence_funnel(int, int, int) is
  'Source spend narrowed to comparable, with euros lost at each step.';

revoke all on function public.pillar_b_uptake_withheld(int,int,int) from public, anon;
revoke all on function public.pillar_b_uptake_scope(int,int,int) from public, anon;
grant execute on function public.pillar_b_uptake_withheld(int,int,int) to authenticated;
grant execute on function public.pillar_b_uptake_scope(int,int,int) to authenticated;
