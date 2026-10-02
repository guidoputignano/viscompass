-- Fix PBR-SPEND24-57014: the review page's molecule read re-runs a whole
-- aggregate once per PostgREST page.
--
-- WHAT THE EVIDENCE SAYS, and what it does not. Two earlier explanations were
-- wrong and are recorded so they are not retried:
--
--   NOT the RLS policy. The policy deployed in production
--   (20261002140000_canonical_fact_cached_scope.sql, confirmed against
--   pg_policy) already wraps auth.uid() in a scalar subquery and uses
--   uncorrelated authorized sets. Profiled against the real 261,153 rows its
--   subplan runs ONCE, and pillar_b_spend(2024) costs about 0.3 s for Azienda
--   201. The stale 20261002120000 in this repository is a correlated EXISTS and
--   does cost 110,509 subplan executions, but production does not run it.
--
--   NOT concurrency. Bounding the page to three-then-two-then-one request
--   serialises the work without reducing it, which is why it changed nothing.
--
-- WHAT IT IS. getMoleculeSpend pages with .order().range(). PostgREST wraps the
-- function in an ordered LIMIT/OFFSET query, so the ENTIRE aggregate re-executes
-- for every page. Measured per execution on the real ledger:
--
--             one execution   pages/yr   total for two years
--   201           0.44 s          2             ~3.3 s   (fits the 8 s budget)
--   Regione       5.08 s          8            ~70.5 s   (does not, by 9x)
--
-- `authenticated` carries statement_timeout = 8s on this project (`postgres`,
-- which the SQL editor uses, carries none) — which is why a standalone editor
-- measurement looked healthy while the live page was cancelled with 57014.
--
-- THE FIX. Return the whole grouped result as ONE jsonb row. One row cannot be
-- truncated by the 1,000-row cap, so there is nothing to page, and the aggregate
-- runs once. The row-returning function is kept unchanged for the reconciliation
-- harness and for any caller that wants SQL-shaped output.
--
-- No quantity aggregate is added, and unresolved substances stay named: this is
-- the same query, returned differently.

create or replace function public.pillar_b_molecule_spend_json(
  p_year       int,
  p_from_month int default 1,
  p_to_month   int default 12
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.active_substance, t.asl_code, t.channel),
                  '[]'::jsonb)
    from public.pillar_b_molecule_spend(p_year, p_from_month, p_to_month) t
$$;

comment on function public.pillar_b_molecule_spend_json(int, int, int) is
  'pillar_b_molecule_spend as a single jsonb row. Exists because paging the '
  'row-returning form made PostgREST re-execute the aggregate once per page: '
  '8 pages x 5.08 s for the Regione, against an 8s statement_timeout (57014).';

grant execute on function public.pillar_b_molecule_spend_json(int, int, int)
  to authenticated;
revoke execute on function public.pillar_b_molecule_spend_json(int, int, int)
  from public, anon;

-- The aggregate groups by (active_substance, asl_code, channel) after filtering
-- on release, year and month. This index lets that filter be an index scan and
-- keeps the grouping columns on the same tuple.
create index if not exists idx_canonical_fact_release_year_substance
  on public.canonical_fact (source_version_id, year, active_substance, asl_code, channel);

analyze public.canonical_fact;
