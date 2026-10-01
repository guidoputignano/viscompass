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
--   ONE UNIT PER MEASURE. Each function returns euros and quantities in separate
--   columns, never a single "value" whose unit depends on a parameter. Mixing mg,
--   packs and euros into one ranked measure is the mistake these signatures are
--   shaped to prevent.
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
  quantity_packs        numeric,
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
    sum(cf.quantity_packs),
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
-- Biosimilar uptake on a B04-COMPATIBLE NORMALIZED QUANTITY, within one
-- comparable stratum, on two denominators.
--
-- Packages are not a quantity share. One pack of 1x40mg and one pack of 6x40mg
-- are one package each and six times apart in drug, so a package share across
-- different presentations measures the wrong thing. This aggregates
-- comparable_quantity inside a single comparable_stratum_id, which pins molecule,
-- route, form and UNIT, so every sum is in one physical unit by construction.
--
-- Rows outside a comparable stratum have no normalized quantity and are NOT
-- folded in as zero: they are counted in withheld_rows so the caller can show
-- the uptake as partial, or withhold it, rather than publish a share computed on
-- an unknown denominator.
--
-- The two denominators:
--   whole_period          every month of the window
--   window                only months at or after the first month a biosimilar of
--                         that SUBSTANCE was actually dispensed in that ASL,
--                         established across the WHOLE fact set, not the period
-- They are returned separately and must never be averaged.
--
-- The substance comes from the frozen taxonomy. There is deliberately NO
-- fallback to the AIC: a biosimilar and its reference medicine are different
-- AICs, so an AIC fallback puts each product alone in its own group and makes
-- every share 0% or 100%. Rows without a substance are withheld and counted.
create or replace function public.pillar_b_uptake(
  p_year       int,
  p_from_month int default 1,
  p_to_month   int default 12
)
returns table (
  asl_code                      text,
  active_substance              text,
  comparable_stratum_id         text,
  comparable_unit               text,
  whole_period_biosimilar_qty   numeric,
  whole_period_total_qty        numeric,
  window_biosimilar_qty         numeric,
  window_total_qty              numeric,
  first_local_biosimilar_key    int,
  withheld_rows                 bigint,
  withheld_spend_eur            numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with in_scope as (
    select cf.*
      from canonical_fact cf
     where cf.source_version_id = public.pillar_b_release()
       and cf.year = p_year
       and cf.month between p_from_month and p_to_month
       and cf.source_disposition = 'analytical'
       and cf.perimeter_status in ('biosimilar','reference_medicine')
  ),
  -- usable: inside a comparable stratum AND named by the taxonomy
  usable as (
    select * from in_scope
     where comparable_eligible
       and comparable_quantity is not null
       and active_substance is not null
  ),
  withheld as (
    select asl_code, active_substance,
           count(*)::bigint n, sum(total_cost_eur) c
      from in_scope
     where not (comparable_eligible and comparable_quantity is not null
                and active_substance is not null)
     group by 1, 2
  ),
  opened as (
    select cf.asl_code, cf.active_substance,
           min(cf.year * 12 + cf.month) as first_key
      from canonical_fact cf
     where cf.source_version_id = public.pillar_b_release()
       and cf.source_disposition = 'analytical'
       and cf.perimeter_status = 'biosimilar'
       and cf.active_substance is not null
       and cf.comparable_quantity is not null
       and cf.comparable_quantity > 0
       and cf.month is not null
     group by 1, 2
  )
  select
    u.asl_code,
    u.active_substance,
    u.comparable_stratum_id,
    u.comparable_unit,
    sum(u.comparable_quantity) filter (where u.perimeter_status = 'biosimilar'),
    sum(u.comparable_quantity),
    sum(u.comparable_quantity) filter (
      where u.perimeter_status = 'biosimilar'
        and o.first_key is not null and (u.year * 12 + u.month) >= o.first_key),
    sum(u.comparable_quantity) filter (
      where o.first_key is not null and (u.year * 12 + u.month) >= o.first_key),
    max(o.first_key),
    coalesce(max(w.n), 0),
    max(w.c)
  from usable u
  left join opened o
    on o.asl_code = u.asl_code and o.active_substance = u.active_substance
  left join withheld w
    on w.asl_code = u.asl_code and w.active_substance is not distinct from u.active_substance
  -- grouping BY the stratum is what guarantees one unit per returned row
  group by u.asl_code, u.active_substance, u.comparable_stratum_id, u.comparable_unit
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
  select 'Spesa osservata', 1, count(*)::bigint, sum(total_cost_eur),
         'Tutte le righe nel perimetro, incluse le rettifiche negative'
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
