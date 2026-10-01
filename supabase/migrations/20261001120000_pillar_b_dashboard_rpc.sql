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
-- Three things this shape fixes, each of which previously produced a figure that
-- looked fine:
--
--   GROUPING. A comparable stratum separates a biosimilar from its reference
--   medicine -- only 16 of 108 perimeter strata hold both sides -- so grouping by
--   stratum forced the share to 0% or 100%. The grain is (ASL, substance, route).
--
--   ROUTE comes from product_route, recorded per product, NOT from
--   split_part(comparable_stratum_id, ...). That ID is NULL on a non-comparable
--   row, so deriving route from it silently dropped 2,269 biosimilar dispensings
--   from the window, and two substances (eculizumab and teriparatide in AQ)
--   opened not late but never.
--
--   MEMBERSHIP IS ROW-LEVEL. pillar_b_uptake_rows names every source row this
--   function consumed, and the withheld function is its exact complement. An
--   earlier version excluded from withheld every row in a GROUP that had an
--   uptake result, so a row whose own quantity was withheld inside an otherwise
--   usable group appeared in neither -- and the reconciliation test used that
--   same group rule as its definition of "usable", so it passed while rows
--   disappeared.

-- Every source row pillar_b_uptake actually consumes. One definition, used by
-- the aggregate, by the withheld complement, and by the tests.
create or replace function public.pillar_b_uptake_rows(
  p_year       int,
  p_from_month int default 1,
  p_to_month   int default 12
)
returns table (
  source_record_id text,
  asl_code         text,
  active_substance text,
  route            text,
  comparable_unit  text,
  perimeter_status text,
  year             int,
  month            int,
  quantity         numeric,
  spend_eur        numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with candidate as (
    select cf.*
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
       and cf.product_route is not null
  ),
  eligible_groups as (
    select asl_code, active_substance, product_route
      from candidate
     group by 1, 2, 3
    having count(distinct comparable_unit) = 1
       and count(*) filter (where perimeter_status = 'biosimilar') > 0
       and count(*) filter (where perimeter_status = 'reference_medicine') > 0
  )
  select c.source_record_id, c.asl_code, c.active_substance, c.product_route,
         c.comparable_unit, c.perimeter_status, c.year, c.month,
         c.comparable_quantity, c.total_cost_eur
    from candidate c
    join eligible_groups g
      on g.asl_code = c.asl_code
     and g.active_substance = c.active_substance
     and g.product_route = c.product_route
$$;

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
  opening_evidence              text
)
language sql
stable
security invoker
set search_path = public
as $$
  with used as (
    select * from public.pillar_b_uptake_rows(p_year, p_from_month, p_to_month)
  ),
  opened as (
    -- observed POSITIVE source quantity, across the WHOLE fact set, NOT
    -- restricted to comparable rows, and keyed on product_route so a
    -- non-comparable dispensing still opens the window it really opened.
    select cf.asl_code, cf.active_substance, cf.product_route,
           min(cf.year * 12 + cf.month) as first_key
      from canonical_fact cf
     where cf.source_version_id = public.pillar_b_release()
       and cf.source_disposition = 'analytical'
       and cf.perimeter_status = 'biosimilar'
       and cf.active_substance is not null
       and cf.product_route is not null
       and cf.source_quantity > 0
       and cf.month is not null
     group by 1, 2, 3
  ),
  route_unknown as (
    -- a dispensing that WOULD open a window but whose route is not determinable.
    -- The substance's opening is reported as partial: the true opening may be
    -- earlier than the one computed here. Silence would have asserted otherwise.
    select cf.asl_code, cf.active_substance, count(*)::bigint as n
      from canonical_fact cf
     where cf.source_version_id = public.pillar_b_release()
       and cf.source_disposition = 'analytical'
       and cf.perimeter_status = 'biosimilar'
       and cf.active_substance is not null
       and cf.product_route is null
       and cf.source_quantity > 0
       and cf.month is not null
     group by 1, 2
  )
  select
    u.asl_code,
    u.active_substance,
    u.route,
    max(u.comparable_unit),
    sum(u.quantity) filter (where u.perimeter_status = 'biosimilar'),
    sum(u.quantity),
    sum(u.quantity) filter (
      where u.perimeter_status = 'biosimilar'
        and o.first_key is not null and (u.year * 12 + u.month) >= o.first_key),
    sum(u.quantity) filter (
      where o.first_key is not null and (u.year * 12 + u.month) >= o.first_key),
    max(o.first_key),
    case when max(ru.n) is not null
         then 'partial: route not determinable for some dispensing of this substance'
         else 'complete' end
  from used u
  left join opened o
    on o.asl_code = u.asl_code and o.active_substance = u.active_substance
   and o.product_route = u.route
  left join route_unknown ru
    on ru.asl_code = u.asl_code and ru.active_substance = u.active_substance
  group by u.asl_code, u.active_substance, u.route
$$;

-- --------------------------------------------------------- uptake, withheld
-- The EXACT complement of pillar_b_uptake_rows, row by row. Not a group rule: a
-- row whose own quantity was withheld inside an otherwise usable group must
-- appear here, and under the group rule it appeared nowhere at all.
create or replace function public.pillar_b_uptake_withheld(
  p_year       int,
  p_from_month int default 1,
  p_to_month   int default 12
)
returns table (
  asl_code          text,
  active_substance  text,
  withheld_reason   text,
  rows_n            bigint,
  spend_eur         numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  -- Materialise the used-row set ONCE. A correlated NOT EXISTS over a
  -- set-returning function re-evaluates it per outer row: the function scans the
  -- whole release and the outer query has thousands of rows, so this call took
  -- over ten minutes. A dashboard query that takes minutes is not shippable,
  -- whatever it returns.
  with used as (
    select source_record_id
      from public.pillar_b_uptake_rows(p_year, p_from_month, p_to_month)
  )
  select
    cf.asl_code,
    cf.active_substance,
    case
      when cf.active_substance is null     then 'substance not named by the frozen taxonomy'
      when not cf.comparable_eligible      then 'no comparable stratum'
      when cf.quantity_basis_status = 'parses_conflict'
        then 'quantity basis unresolved: the two independent parses disagree'
      when cf.quantity_basis_status = 'absent'
        then 'no parsed presentation for this product'
      when cf.comparable_quantity is null  then 'no normalized quantity for this presentation'
      when cf.comparable_unit is null      then 'no comparable unit'
      when cf.product_route is null        then 'route not determinable for this product'
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
    and not exists (select 1 from used u where u.source_record_id = cf.source_record_id)
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

revoke all on function public.pillar_b_uptake_rows(int,int,int) from public, anon;
grant execute on function public.pillar_b_uptake_rows(int,int,int) to authenticated;
