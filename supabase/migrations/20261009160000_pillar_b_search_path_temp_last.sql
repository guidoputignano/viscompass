-- Pillar B — the session's temporary schema can no longer choose the release
-- or stand in for canonical_fact.
--
-- Append-only. Idempotent. Rewrites no function body except one schema prefix
-- in pillar_b_release(), and changes no grant, owner, comment, volatility or
-- security mode.
--
-- THE DEFECT. The fourteen Pillar B read functions of 20261001120000 to
-- 20261003130000 were created with `set search_path = public` (the regional
-- comparator, 20261009120000, already states pg_catalog, pg_temp and is not
-- touched here). When pg_temp is not named in search_path,
-- PostgreSQL searches the session's temporary schema FIRST for relation and
-- type names (never for functions or operators). So in a session that has run
--
--     create temp table pillar_b_active_release (release_id text, ...);
--
-- pillar_b_release() reads THAT table and returns whatever release id the
-- session inserted, and every function gated on it aggregates that release
-- instead of the declared one. A temporary table named canonical_fact replaces
-- the ledger the same way inside every function that reads it unqualified, and
-- one named jsonb shadows the built-in type in a cast such as '[]'::jsonb.
--
-- WHY THIS IS HARDENING, NOT A BREACH. The functions are SECURITY INVOKER, so
-- RLS on canonical_fact still applies to the caller: a session that redirects
-- the release sees only rows it could already read directly, and a temporary
-- canonical_fact holds only what the session put there. PostgREST callers
-- cannot create temporary tables; only a direct SQL session can. What it does
-- defeat, for that session's own rows, is the release gate itself: "every RPC
-- reads ONE declared release" (20261001120000).
--
-- THE FIX.
--   * pillar_b_release() is recreated with search_path pg_catalog, pg_temp and
--     a schema-qualified public.pillar_b_active_release: built-in names first,
--     the temporary schema LAST, and no unqualified relation left to resolve.
--     Nothing else in it changes: same result, same exception and hint when no
--     release is declared, STABLE, SECURITY INVOKER. CREATE OR REPLACE keeps
--     the function's OID, owner, comment and grants; the grants are restated
--     below exactly as they stand (20261001120000 and 20261003090000).
--   * The thirteen other Pillar B functions read canonical_fact unqualified
--     (pillar_b_molecule_spend_json reads none, but casts to jsonb, which the
--     temporary schema can shadow too). Their bodies are NOT rewritten.
--     ALTER FUNCTION ... SET search_path = pg_catalog, public, pg_temp moves
--     the temporary schema to the end and changes nothing else. pg_catalog was
--     already searched before public (implicitly, when it is not listed), so
--     every name resolves exactly as before unless a temporary object was
--     shadowing it.
--
-- LATER MIGRATIONS. CREATE OR REPLACE resets a function's SET clauses. A later
-- migration that recreates any of these functions must state pg_temp last
-- itself, or this hardening is silently undone for that function;
-- tests/pillar-b-search-path.test.mjs checks the final search_path of every
-- Pillar B function across all migrations.

create or replace function public.pillar_b_release() returns text
language plpgsql stable security invoker set search_path = pg_catalog, pg_temp as $$
declare rid text;
begin
  select release_id into rid from public.pillar_b_active_release;
  if rid is null then
    raise exception 'no active Pillar B release is declared; refusing to aggregate'
      using hint = 'insert the release id into pillar_b_active_release';
  end if;
  return rid;
end $$;
revoke all on function public.pillar_b_release() from public, anon;
grant execute on function public.pillar_b_release() to authenticated, service_role;

alter function public.pillar_b_spend(int, int, int)
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_uptake_rows(int, int, int)
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_uptake(int, int, int)
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_uptake_withheld(int, int, int)
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_uptake_scope(int, int, int)
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_evidence_funnel(int, int, int)
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_perimeter_coverage(int)
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_molecule_spend(int, int, int)
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_molecule_spend_json(int, int, int)
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_value_uptake(int, text, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_value_uptake_scoped(int[], text[], text, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_facets(int[], text[], text, text, text[])
  set search_path = pg_catalog, public, pg_temp;
alter function public.pillar_b_uptake_coverage(int, text, text)
  set search_path = pg_catalog, public, pg_temp;
