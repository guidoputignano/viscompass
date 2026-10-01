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
  where cf.year = p_year
    and cf.month between p_from_month and p_to_month
  group by cf.asl_code, cf.channel
$$;

-- ---------------------------------------------------------------- uptake
-- Biosimilar uptake on TWO denominators, which are never averaged together.
--
--   whole_period          : every month of the window
--   locally_substitutable : only months at or after the first month a biosimilar
--                           of that molecule was actually dispensed in that ASL
--
-- Before that month there was nothing locally to switch to, however many
-- biosimilars existed elsewhere, so the two answer different questions and
-- differ materially. Both are returned; the caller may not collapse them.
--
-- The share is computed on PACKS, one physical unit, not on a mixture. Rows with
-- no quantity contribute to neither numerator nor denominator, so the share is
-- null rather than misleading when quantity is absent.
create or replace function public.pillar_b_uptake(
  p_year       int,
  p_from_month int default 1,
  p_to_month   int default 12
)
returns table (
  asl_code                       text,
  active_substance_key           text,
  whole_period_biosimilar_packs  numeric,
  whole_period_total_packs       numeric,
  window_biosimilar_packs        numeric,
  window_total_packs             numeric,
  first_local_biosimilar_key     int
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select cf.asl_code, cf.aic, cf.year, cf.month, cf.quantity_packs, cf.perimeter_status,
           coalesce(cf.active_substance, cf.aic) as substance_key
      from canonical_fact cf
     where cf.year = p_year
       and cf.month between p_from_month and p_to_month
       and cf.source_disposition = 'analytical'
       and cf.perimeter_status in ('biosimilar','reference_medicine')
  ),
  -- Opened across the WHOLE fact set, never within the queried period. A
  -- biosimilar first dispensed in 2024 must not look new in 2025: restricting
  -- this to the period makes the window start at the period's own first month,
  -- so the two denominators collapse into the same number and the second one
  -- silently stops meaning anything. Keyed on (year, month) so the comparison is
  -- chronological rather than month-of-year.
  opened as (
    select cf.asl_code,
           coalesce(cf.active_substance, cf.aic) as substance_key,
           min(cf.year * 12 + cf.month) as first_key
      from canonical_fact cf
     where cf.source_disposition = 'analytical'
       and cf.perimeter_status = 'biosimilar'
       and coalesce(cf.quantity_packs, 0) > 0
       and cf.month is not null
     group by 1, 2
  )
  select
    s.asl_code,
    s.substance_key,
    sum(s.quantity_packs) filter (where s.perimeter_status = 'biosimilar'),
    sum(s.quantity_packs),
    sum(s.quantity_packs) filter (
      where s.perimeter_status = 'biosimilar'
        and o.first_key is not null and (s.year * 12 + s.month) >= o.first_key),
    sum(s.quantity_packs) filter (
      where o.first_key is not null and (s.year * 12 + s.month) >= o.first_key),
    max(o.first_key)
  from scoped s
  left join opened o
    on o.asl_code = s.asl_code and o.substance_key = s.substance_key
  group by s.asl_code, s.substance_key
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
     where (p_year is null or cf.year = p_year)
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
   where (p_year is null or cf.year = p_year)
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
