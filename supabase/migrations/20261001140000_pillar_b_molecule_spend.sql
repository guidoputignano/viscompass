-- Pillar B — spend by active substance, for the review page's trend and
-- concentration views.
--
-- Section 13, following 20261001120000_pillar_b_dashboard_rpc.sql.
--
-- WHY A SEPARATE FUNCTION. pillar_b_spend aggregates by (asl_code, channel),
-- which is the right grain for the channel view and the wrong one for a molecule
-- trend. Rather than let the application regroup rows it fetched for another
-- purpose -- which is how the legacy layer ended up summing across bases, years
-- and dispositions -- the grain it needs is produced here, under exactly the same
-- release scoping and the same filters.
--
-- SPEND ONLY. There is no quantity aggregate, for the reason given at length on
-- pillar_b_spend: the source quantity's package-vs-unit convention is
-- unconfirmed, so adding 50 packages to 1,200 units yields a scalar with no
-- coherent unit. Basis COVERAGE is returned instead, so a caller can state what
-- share of the figure rests on each basis.
--
-- SECURITY INVOKER, like every other function in this set: row-level security on
-- canonical_fact decides which ASLs the caller may see, and this function must
-- not widen that. A SECURITY DEFINER here would hand every caller every ASL.

create or replace function public.pillar_b_molecule_spend(
  p_year       int,
  p_from_month int default 1,
  p_to_month   int default 12
)
returns table (
  active_substance      text,
  asl_code              text,
  channel               text,
  rows_n                bigint,
  spend_eur             numeric,
  comparable_rows       bigint,
  comparable_spend_eur  numeric,
  negative_rows         bigint,
  rows_basis_packages   bigint,
  rows_basis_units      bigint,
  rows_basis_mixed      bigint,
  rows_basis_unknown    bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    -- A row with no resolved substance is NOT folded into a neighbour and NOT
    -- dropped: it is named, so the share it carries is visible rather than
    -- silently redistributed across the molecules that do have one.
    coalesce(cf.active_substance, 'Principio attivo non risolto'),
    cf.asl_code,
    cf.channel,
    count(*)::bigint,
    sum(cf.total_cost_eur),
    count(*) filter (where cf.comparable_eligible)::bigint,
    sum(cf.total_cost_eur) filter (where cf.comparable_eligible),
    count(*) filter (where cf.total_cost_eur < 0)::bigint,
    count(*) filter (where cf.source_quantity_basis = 'packages')::bigint,
    count(*) filter (where cf.source_quantity_basis = 'units')::bigint,
    count(*) filter (where cf.source_quantity_basis = 'mixed')::bigint,
    count(*) filter (where cf.source_quantity_basis = 'unknown')::bigint
  from canonical_fact cf
  where cf.source_version_id = public.pillar_b_release()
    and cf.year = p_year
    and cf.month between p_from_month and p_to_month
  group by 1, cf.asl_code, cf.channel
$$;

comment on function public.pillar_b_molecule_spend(int, int, int) is
  'Spend by active substance x ASL x channel for one year under the active '
  'release. Spend only: no quantity aggregate, because the source quantity basis '
  'is unconfirmed. Unresolved substances are named, never folded or dropped.';

grant execute on function public.pillar_b_molecule_spend(int, int, int)
  to authenticated;

-- Deliberately NOT granted to anon. The anonymous role must not reach Pillar B
-- facts at any grain; the review page is authenticated.
revoke execute on function public.pillar_b_molecule_spend(int, int, int) from anon;
