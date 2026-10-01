-- B19 / tenancy-rls, CRITICAL.
--
-- Four tables created in section 2 of supabase_schema.sql need explicit
-- production read/write grants and policies:
--
--     aifa_product_master        (line  57)
--     aifa_ingredient_master     (line  74)
--     aifa_shortage_list         (line  85)
--     aic_normalization_resolved (line 106)
--
-- Production audit on 2026-09-30 found RLS already enabled on all four, but
-- not forced; anon/authenticated retained table-level grants, with no policies.
-- With RLS enabled and no policies, client roles are default-denied despite
-- those grants. This migration makes the intended access explicit and removes
-- the broad grants, rather than claiming a demonstrated public CRUD exposure.
--
-- The three aifa_* tables are public AIFA reference data. The owner approved
-- leaving AIC_Normalization_Resolved.csv public; database access remains
-- scoped to approved organizations as defense in depth.
--
-- Explicit write revocation protects against future RLS policy changes. The
-- normalization reference drives per-mg calculations and must remain writable
-- only through the controlled service-role loader.
--
-- This applies the lockdown idiom the project already uses elsewhere
-- (supabase/migrations/20260907120000_secure_hospital_file_staging.sql and the
-- Pillar A release migrations): enable + force RLS, revoke the default grants,
-- grant read to authenticated only, and leave writes to the service role, which
-- is what load_to_supabase.mjs uses.
--
-- `force` matters: without it the table owner bypasses RLS, and Supabase runs
-- some maintenance paths as the owner.

-- ---------------------------------------------------------------- AIFA masters
-- Public reference data. Readable by any signed-in user; writable only by the
-- loader running under the service role.

alter table public.aifa_product_master enable row level security;
alter table public.aifa_product_master force row level security;
revoke all on public.aifa_product_master from anon, authenticated;
grant select on public.aifa_product_master to authenticated;
grant all on public.aifa_product_master to service_role;

drop policy if exists "aifa product master readable by authenticated" on public.aifa_product_master;
create policy "aifa product master readable by authenticated"
on public.aifa_product_master for select to authenticated
using (true);

alter table public.aifa_ingredient_master enable row level security;
alter table public.aifa_ingredient_master force row level security;
revoke all on public.aifa_ingredient_master from anon, authenticated;
grant select on public.aifa_ingredient_master to authenticated;
grant all on public.aifa_ingredient_master to service_role;

drop policy if exists "aifa ingredient master readable by authenticated" on public.aifa_ingredient_master;
create policy "aifa ingredient master readable by authenticated"
on public.aifa_ingredient_master for select to authenticated
using (true);

alter table public.aifa_shortage_list enable row level security;
alter table public.aifa_shortage_list force row level security;
revoke all on public.aifa_shortage_list from anon, authenticated;
grant select on public.aifa_shortage_list to authenticated;
grant all on public.aifa_shortage_list to service_role;

drop policy if exists "aifa shortage list readable by authenticated" on public.aifa_shortage_list;
create policy "aifa shortage list readable by authenticated"
on public.aifa_shortage_list for select to authenticated
using (true);

-- ------------------------------------------------- AIC normalization reference
-- Derived from the non-public hospital dataset. Read is restricted to users with
-- an APPROVED organization membership, matching how canonical_fact is treated,
-- rather than to any authenticated account: a registered user with no approved
-- membership has no business reading the spend column.

alter table public.aic_normalization_resolved enable row level security;
alter table public.aic_normalization_resolved force row level security;
revoke all on public.aic_normalization_resolved from anon, authenticated;
grant select on public.aic_normalization_resolved to authenticated;
grant all on public.aic_normalization_resolved to service_role;

drop policy if exists "aic normalization readable by approved members" on public.aic_normalization_resolved;
create policy "aic normalization readable by approved members"
on public.aic_normalization_resolved for select to authenticated
using (
  exists (
    select 1
    from public.user_organizations uo
    where uo.user_id = auth.uid()
      and uo.status = 'approved'
  )
);

-- ------------------------------------------------------------------ assertion
-- Fail the migration rather than leave a table half-locked. A deployment that
-- silently no-ops is how the original gap survived.

do $$
declare
  unprotected text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'aifa_product_master',
      'aifa_ingredient_master',
      'aifa_shortage_list',
      'aic_normalization_resolved'
    )
    and (c.relrowsecurity is false or c.relforcerowsecurity is false);

  if unprotected is not null then
    raise exception 'row level security not enforced on: %', unprotected;
  end if;
end $$;
