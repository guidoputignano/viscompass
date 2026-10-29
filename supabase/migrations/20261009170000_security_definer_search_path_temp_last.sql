-- SECURITY DEFINER functions — the session's temporary schema can no longer
-- stand in for the tables they read with their owner's privileges.
--
-- Append-only. Idempotent. Rewrites no function body and changes no grant,
-- owner, comment, volatility or security mode: six ALTER FUNCTION ... SET
-- search_path statements and nothing else.
--
-- THE DEFECT. Six SECURITY DEFINER functions were created with
-- `set search_path = public`:
--
--   my_objective_rank(text)                                         supabase_schema.sql
--   request_organization_membership(text, text, text)               20260831224500
--   accept_organization_invitation(uuid)                            20260831224500
--   decline_organization_invitation(uuid)                           20260831224500
--   admin_decide_organization_membership(bigint, text, uuid, text)  20260831224500
--   admin_revoke_organization_membership(bigint, uuid, text)        20260831224500
--
-- When pg_temp is not named in search_path, PostgreSQL searches the session's
-- temporary schema FIRST for relation and type names (never for functions or
-- operators): the CVE-2018-1058 pattern. my_objective_rank() reads
-- user_organizations, organizations, objectives and canonical_fact
-- unqualified, as its owner, so canonical_fact's RLS does not apply inside it.
-- In a session that has run
--
--     create temp table user_organizations (user_id uuid, org_code text, ...);
--
-- the function takes the caller's membership from THAT table: the session can
-- name any Azienda as its own and get that Azienda's biosimilar share and rank,
-- computed from canonical_fact rows its RLS hides. A temporary objectives
-- table chooses the ATC scope and the period as well.
--
-- WHO CAN DO IT. Only a direct SQL session that can create temporary tables
-- and holds EXECUTE (authenticated, or a login role that can become it).
-- PostgREST callers cannot create temporary tables. Such a session already
-- controls what auth.uid() returns (it reads a session setting), but it cannot
-- invent a membership, an objective or an organisation; the temporary schema
-- is what let it, and this migration takes that away.
--
-- THE FIVE ACCESS-CONTROL FUNCTIONS. As 20260831224500 redefined them, they
-- read only schema-qualified relations (public.organizations,
-- public.user_organizations, public.organization_invitations, %rowtype
-- included). The temporary schema can reach only the built-in type names in
-- their declarations (a temporary table named uuid makes the session's own
-- call fail, nothing more). But supabase_schema.sql carries their earlier
-- bodies, which name the same tables unqualified: in a database built from
-- that file alone (as it stood before it stated pg_temp last), a temporary
-- organization_invitations holding an invitation nobody sent makes
-- accept_organization_invitation() write an APPROVED row into the real
-- user_organizations. ALTER FUNCTION keeps whichever body is installed, so
-- the same statement closes both.
--
-- THE FIX. ALTER FUNCTION ... SET search_path = pg_catalog, public, pg_temp
-- for all six. pg_catalog was already searched before public (implicitly,
-- when it is not listed) and public stays where it was, so every name resolves
-- exactly as before unless a temporary object was shadowing it. Every table
-- and type the bodies name exists in pg_catalog or public, so the temporary
-- schema, now last, is never reached for any of them.
--
-- WHY public STAYS IN THE PATH. The alternative, pg_catalog, pg_temp with
-- every relation schema-qualified (as pillar_b_regional_comparator,
-- 20261009120000, already does; it is not touched here), means recreating each
-- body. my_objective_rank() reads its four tables unqualified, and so do the
-- supabase_schema.sql bodies of the other five; recreating them would replace
-- whatever body is installed with this repository's copy of it. An ALTER
-- changes the one setting and nothing else.
--
-- supabase_schema.sql. Its six headers now state the same search_path, bodies
-- untouched, so a database built from it is hardened from the start and this
-- migration only re-sets the value already there. Databases built from the
-- file before that change, production among them, need the ALTERs below.
--
-- LATER MIGRATIONS. CREATE OR REPLACE resets a function's SET clauses. A later
-- migration that recreates any SECURITY DEFINER function must state pg_temp
-- last itself, or this hardening is silently undone for that function;
-- tests/security-definer-search-path.test.mjs checks the final search_path of
-- every SECURITY DEFINER function across supabase_schema.sql and all
-- migrations.

alter function public.my_objective_rank(text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.request_organization_membership(text, text, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.accept_organization_invitation(uuid)
  set search_path = pg_catalog, public, pg_temp;
alter function public.decline_organization_invitation(uuid)
  set search_path = pg_catalog, public, pg_temp;
alter function public.admin_decide_organization_membership(bigint, text, uuid, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.admin_revoke_organization_membership(bigint, uuid, text)
  set search_path = pg_catalog, public, pg_temp;
