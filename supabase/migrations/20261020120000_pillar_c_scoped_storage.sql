-- Pillar C, Recommendation 5: organisation-scoped delivery, enforced by
-- Storage row level security.
--
-- DORMANT UNTIL APPLIED, and applied only with the owner's explicit approval,
-- after the private read-only PRECHECK. One transaction. Idempotent while the
-- bucket is empty; it refuses to run once the bucket holds objects
-- (PCS_PRE_BUCKET), so a later change is a new migration.
--
-- OWNER DECISIONS, 19 October 2026 (working session). The database enforces
-- WHO reads WHICH unit (O1-O3). WHAT each unit contains (O4-O6: budgets,
-- counts, aggregate product rows, no small-cell suppression) is decided by the
-- private builder that writes the per-unit copies. Province keys are elided
-- in this public file; the verbatim record is private.
--   O1  An Azienda user sees its own Azienda AND the Regione aggregate
--       («Aggregato delle quattro Aziende») as reviewers see it, never another
--       individual Azienda. Complement disclosure (aggregate minus own = the
--       other three combined, and exactly one Azienda where only one other
--       dispenses a product) was explained and accepted, for Pillar C only.
--   O2  Enforcement by database rules from the start: per-unit copies in a
--       private Storage bucket, a storage.objects SELECT policy, the user's own
--       session reads. The reviewer path keeps its existing application-level
--       exception (service role, REVIEWER_EMAILS/ADMIN_EMAILS, bucket
--       pillar-c-review) unchanged. Nothing here touches pillar-c-review or
--       pillar-c-evidence.
--   O3  Regione delivery now: a Regione user (org 130, region 130) sees the
--       aggregate («Aggregato regionale») and the four Aziende labelled ASL 1-4
--       with opaque keys; no province key or real Azienda name in payloads,
--       DOM, URLs or export names.
--
-- THE UNITS. Each Azienda is pseudonymised ONCE, in the private builder:
--   <root>/asl-1 ... <root>/asl-4   one Azienda each (201 -> asl-1 ... 204 -> asl-4,
--                                   the reviewed order of REVIEWED_PSEUDONYMS in
--                                   lib/analytics/org-pseudonym.ts)
--   <root>/aggregato                the four Aziende together
-- Entitlement: Azienda 20n (asl, region 130) reads asl-n and aggregato;
-- Regione 130 (regione, region 130) reads all five. Nothing else reads any.
-- Region 130 and the five codes are pinned on purpose: O1 and O3 were decided
-- for this Region only; another Region needs its own reviewed migration.
--
-- OBJECT NAMES. <root>/<unit>/<file>, where <root> is a build root of the
-- family v1 ... v999 (no leading zero) and <file> is
-- <kind>[-<period>][-<channel>]-<sha256>.json: letters, digits and single
-- hyphens, ending in the object's 64-hex lowercase SHA-256. Neutral: no
-- organisation key in any name. Anything else in the bucket is unreadable.
--
-- ROLLOUT, IN THE DATABASE. Two tables, empty by default, so nothing is
-- readable by anyone (even an entitled member) until the owner enables it:
--   pillar_c_scoped_org_switch   one row per enabled organisation, mode
--                                'allowlist' (only listed users) or 'all';
--   pillar_c_scoped_user_allow   (org_code, user_id) for 'allowlist' mode.
-- A unit is readable only when the caller's OWN organisation has a switch row
-- and (mode 'all' or the caller is listed for that organisation). What a
-- deletion turns off depends on the mode:
--   * deleting an organisation's switch row is the kill switch for that
--     organisation, in either mode: every member loses every unit, and its
--     allow rows are deleted with it (on delete cascade);
--   * deleting a user's allow row turns that user off only while the
--     organisation is in 'allowlist' mode. In mode 'all' allow rows are
--     ignored, so deleting one does nothing; the stop for one user is then
--     revoking the membership.
-- Either takes effect on the caller's next statement, with no redeploy. The
-- tables force RLS and have no policies; only the service role and the owner
-- of the tables (postgres, which bypasses RLS) can read or write them. An
-- app-only switch would not do: the Storage API answers any approved member
-- directly.
--
-- REVOCATION, SIGNED URLS AND SERVER-SIDE COPIES. Switching the organisation
-- off, deleting the user's allow row in 'allowlist' mode, or revoking the
-- membership stops every SESSION read of that user on the next request.
-- Two things would outlive all three, so the policy refuses the operations
-- that create them:
--   * a signed URL: Storage serves it by its token, without RLS, until it
--     expires. Refused: storage.object.sign, storage.object.sign_many;
--   * a server-side copy: Storage copies an object it can read into any
--     destination the caller may write, such as the caller's organisation
--     folder of the 'uploads' bucket, which the uploads INSERT policy admits
--     and every approved member of that organisation can read. Refused:
--     storage.object.copy and its S3 forms storage.s3.object.copy and
--     storage.s3.upload.part_copy, and storage.object.move (also stopped by
--     the absence of any UPDATE or DELETE policy on this bucket; refusing its
--     source read as well keeps it closed if one is ever added).
-- storage-api sets the transaction-local setting storage.operation on every
-- request (src/internal/database/postgres/scope.ts; its tenant migration 0024
-- defines storage.operation() to read it). It signs, copies or moves an object
-- only after reading the source through RLS under the route's operation:
-- src/http/routes/object/getSignedURL.ts, getSignedURLs.ts, copyObject.ts and
-- moveObject.ts, src/http/routes/s3/commands/copy-object.ts and
-- upload-part-copy.ts, with the names of src/http/routes/operations.ts, which
-- are unchanged in every revision since the operation names were introduced.
-- The application never signs, copies or moves. Plain reads (download, HEAD,
-- info, list, the S3 get, head and list, image rendering) are unaffected, and
-- a request with no operation (the SQL editor, a direct database session)
-- reads as before. What a revoke leaves behind is a copy downloaded while
-- entitled. The live checks must still prove that production refuses
-- signing (LIVE_CHECKLIST L5, entitled-sign-refused). If a signed URL may
-- exist some other way, re-key: publish the next build under a NEW root
-- (v2, v3, ...) and delete every object of the old root with the service
-- role. The policy accepts the whole root family, so this needs no
-- migration.
--
-- WHY SECURITY DEFINER, AND WHY THIS ONE IS SAFE. The policy is evaluated as
-- the caller (role authenticated), and the rollout tables are deliberately not
-- readable by authenticated, so an INVOKER helper would always answer "no
-- unit". public.pillar_c_scoped_units() therefore reads as its owner. What
-- makes that acceptable:
--   * it takes NO argument: the caller is auth.uid(), never a parameter;
--   * every read is filtered explicitly by user_id = auth.uid() (a definer
--     reads past user_organizations' own-rows RLS, so the filter is the rule);
--   * exactly one approved membership, or nothing (fail closed);
--   * it returns only the caller's own unit names, never a row or a figure;
--   * search_path is pg_catalog, pg_temp and every relation is
--     schema-qualified, so a session's temporary objects cannot stand in;
--   * STABLE; EXECUTE is revoked from PUBLIC, anon and service_role and
--     granted to authenticated only;
--   * its owner must bypass RLS to read the forced rollout tables
--     (PCS_PRE_OWNER); an owner that cannot would make every answer empty.
-- The policy calls it as an uncorrelated scalar subquery cast to the array,
-- = any ((select f())::text[]), so it runs once per statement (an InitPlan),
-- not once per object row. (Without the cast, = any ((select f())) would parse
-- as ANY over a subquery and compare text with text[].)
--
-- PRECONDITIONS. Each failure aborts the whole transaction with a stable code:
--   PCS_PRE_AUTH            auth.users or auth.uid() missing
--   PCS_PRE_STORAGE         storage.objects, storage.buckets or storage.foldername missing
--   PCS_PRE_OWNER           the migration role cannot bypass RLS
--   PCS_PRE_STORAGE_RLS     row level security off on storage.objects, buckets or prefixes
--   PCS_PRE_FOLDERNAME      storage.foldername() does not return the folder segments
--   PCS_PRE_OPERATION       storage.operation() missing, not executable by authenticated, or not reading the request operation
--   PCS_PRE_STORAGE_DEFINER a storage listing function runs as its owner (bypassing RLS)
--   PCS_PRE_STORAGE_POLICY  a storage policy outside the reviewed fingerprint set
--   PCS_PRE_DIRECTORY       organisations 201-204 (asl, 130) and 130 (regione, 130) not as reviewed
--   PCS_PRE_BUCKET          bucket pillar-c-scoped present and not empty
--   PCS_PRE_ROLLOUT_POLICY  a policy already exists on a rollout table
-- After creating, a post-condition block re-reads what was created (rollout
-- table columns and access, the helper's attributes and grants, the policy,
-- the bucket) and aborts with a PCS_POST_* code if it is not the reviewed
-- definition.
-- A storage policy fingerprint is
--   tablename|policyname|cmd|permissive|roles|md5(qual)|md5(with_check)
-- with qual and with_check deparsed under search_path pg_catalog, pg_temp
-- (md5 of '' when null). The reviewed set is the two 'uploads' policies of
-- supabase_schema.sql section 7, as PostgreSQL 18.3 deparses them in the
-- reviewed harness; the PRECHECK prints the production fingerprints and texts,
-- so a different deparse shows up there before anything is applied. Policies
-- are permissive and OR-ed, so a same-named but broadened policy could open
-- this bucket: anything else fails, and is reviewed and added here before
-- applying. storage.buckets needs no policy: download, HEAD, info and list
-- need only SELECT on storage.objects, and signing and copying, which also
-- need only that on the source, are refused by the policy itself.

begin;

do $pre$
declare
  v_search_path text := pg_catalog.current_setting('search_path');
  v_reviewed constant text[] := array[
    'objects|read own approved org folder|SELECT|PERMISSIVE|{authenticated}|839ab94c7b67e79a8693e426a29fd7ce|d41d8cd98f00b204e9800998ecf8427e',
    'objects|upload to own approved org folder|INSERT|PERMISSIVE|{authenticated}|d41d8cd98f00b204e9800998ecf8427e|839ab94c7b67e79a8693e426a29fd7ce'
  ];
  v_bad text;
  v_n bigint;
  v_op text;
  v_op_ok boolean := false;
begin
  -- Deparsed policy text depends on search_path: pin it for this block only.
  perform pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);

  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null then
    raise exception 'PCS_PRE_AUTH: auth.users or auth.uid() is missing';
  end if;

  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null
     or to_regprocedure('storage.foldername(text)') is null then
    raise exception 'PCS_PRE_STORAGE: storage.objects, storage.buckets or storage.foldername(text) is missing';
  end if;

  if not exists (select 1 from pg_roles r where r.rolname = current_user and (r.rolbypassrls or r.rolsuper)) then
    raise exception 'PCS_PRE_OWNER: role % cannot bypass row level security, so the helper it would own could not read the rollout tables', current_user;
  end if;

  select string_agg(c.relname, ', ' order by c.relname) into v_bad
  from pg_class c
  where c.relnamespace = to_regnamespace('storage')
    and c.relname in ('objects', 'buckets', 'prefixes')
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity;
  if v_bad is not null then
    raise exception 'PCS_PRE_STORAGE_RLS: row level security is disabled on storage table(s) %', v_bad;
  end if;

  if storage.foldername('v9/asl-1/review-0.json') is distinct from array['v9', 'asl-1']::text[] then
    raise exception 'PCS_PRE_FOLDERNAME: storage.foldername() does not return the folder segments of an object name';
  end if;

  -- The policy refuses signing, copy and move through storage.operation():
  -- it must exist, return text, be executable by authenticated (the policy
  -- runs as the caller, so a missing grant would break every read) and
  -- answer the transaction-local setting storage-api sets. The probe value
  -- is set locally and the previous value restored.
  if to_regprocedure('storage.operation()') is not null
     and (select p.prorettype from pg_proc p where p.oid = to_regprocedure('storage.operation()')) = 'text'::regtype
     and has_function_privilege('authenticated', to_regprocedure('storage.operation()'), 'execute') then
    v_op := pg_catalog.current_setting('storage.operation', true);
    perform pg_catalog.set_config('storage.operation', 'storage.object.sign', true);
    v_op_ok := storage.operation() is not distinct from 'storage.object.sign';
    perform pg_catalog.set_config('storage.operation', coalesce(v_op, ''), true);
  end if;
  if not v_op_ok then
    raise exception 'PCS_PRE_OPERATION: storage.operation() is missing, does not return text, cannot be executed by authenticated, or does not return the operation of the current request';
  end if;

  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text) into v_bad
  from pg_proc p
  where p.pronamespace = to_regnamespace('storage')
    and p.prosecdef
    and (p.proname ~ '^(search|list_|get_prefix)' or p.proname = 'foldername');
  if v_bad is not null then
    raise exception 'PCS_PRE_STORAGE_DEFINER: storage function(s) % run as their owner, so a listing would bypass row level security', v_bad;
  end if;

  select string_agg(f.fp, ' ; ' order by f.fp) into v_bad
  from (
    select p.tablename || '|' || p.policyname || '|' || p.cmd || '|' || p.permissive || '|' || p.roles::text
           || '|' || md5(coalesce(p.qual, '')) || '|' || md5(coalesce(p.with_check, '')) as fp
    from pg_policies p
    where p.schemaname = 'storage'
      and not (p.tablename = 'objects' and p.policyname = 'pillar c scoped: entitled units read')
  ) f
  where not (f.fp = any (v_reviewed));
  if v_bad is not null then
    raise exception 'PCS_PRE_STORAGE_POLICY: storage policy outside the reviewed set: %', v_bad;
  end if;

  select count(*) into v_n
  from public.organizations o
  where (o.org_code in ('201', '202', '203', '204') and o.org_type = 'asl' and o.region_code = '130')
     or (o.org_code = '130' and o.org_type = 'regione' and o.region_code = '130');
  if v_n <> 5 then
    raise exception 'PCS_PRE_DIRECTORY: expected organisations 201-204 (asl, region 130) and 130 (regione, region 130), found % of 5', v_n;
  end if;

  select count(*) into v_n from storage.objects o where o.bucket_id = 'pillar-c-scoped';
  if v_n > 0 or exists (select 1 from storage.buckets b where b.name = 'pillar-c-scoped' and b.id <> 'pillar-c-scoped') then
    raise exception 'PCS_PRE_BUCKET: bucket pillar-c-scoped already holds % object(s), or its name is taken by another bucket; objects are never adopted', v_n;
  end if;

  select string_agg(p.tablename || ': ' || p.policyname, ', ' order by p.tablename, p.policyname) into v_bad
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in ('pillar_c_scoped_org_switch', 'pillar_c_scoped_user_allow');
  if v_bad is not null then
    raise exception 'PCS_PRE_ROLLOUT_POLICY: the rollout tables must have no policy, found %', v_bad;
  end if;

  perform pg_catalog.set_config('search_path', v_search_path, true);
end
$pre$;

-- 1. Rollout gates, empty (off) by default. Written only by the owner in the
--    SQL editor or by the service role.
create table if not exists public.pillar_c_scoped_org_switch (
  org_code   text primary key
             references public.organizations(org_code)
             check (org_code in ('201', '202', '203', '204', '130')),
  mode       text not null check (mode in ('allowlist', 'all')),
  note       text not null check (char_length(btrim(note)) between 1 and 200 and note !~ '[[:cntrl:]]'),
  changed_at timestamptz not null default now()
);

create table if not exists public.pillar_c_scoped_user_allow (
  org_code text not null references public.pillar_c_scoped_org_switch(org_code) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  note     text not null check (char_length(btrim(note)) between 1 and 200 and note !~ '[[:cntrl:]]'),
  added_at timestamptz not null default now(),
  primary key (org_code, user_id)
);

alter table public.pillar_c_scoped_org_switch enable row level security;
alter table public.pillar_c_scoped_org_switch force row level security;
alter table public.pillar_c_scoped_user_allow enable row level security;
alter table public.pillar_c_scoped_user_allow force row level security;

-- No policies on either table: no authenticated or anon session reads a row,
-- even if a broad table grant were ever restored by default privileges.
revoke all on table public.pillar_c_scoped_org_switch, public.pillar_c_scoped_user_allow from public, anon, authenticated;
revoke all on table public.pillar_c_scoped_org_switch, public.pillar_c_scoped_user_allow from service_role;
grant select, insert, update, delete on table public.pillar_c_scoped_org_switch, public.pillar_c_scoped_user_allow to service_role;

-- 2. The caller's readable units, derived inside the database. No argument.
create or replace function public.pillar_c_scoped_units()
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$
  with me as (
    select uo.org_code
    from public.user_organizations uo
    where uo.user_id = (select auth.uid())
      and uo.status = 'approved'
  ),
  one as (
    select o.org_code, o.org_type, o.region_code
    from me
    join public.organizations o on o.org_code = me.org_code
    where (select count(*) from me) = 1
  ),
  enabled as (
    select one.org_code, one.org_type, one.region_code
    from one
    join public.pillar_c_scoped_org_switch s on s.org_code = one.org_code
    where s.mode = 'all'
       or (s.mode = 'allowlist' and exists (
             select 1
             from public.pillar_c_scoped_user_allow a
             where a.org_code = one.org_code
               and a.user_id = (select auth.uid())))
  ),
  units as (
    select case e.org_code when '201' then 'asl-1' when '202' then 'asl-2'
                           when '203' then 'asl-3' when '204' then 'asl-4' end as unit
    from enabled e
    where e.org_type = 'asl' and e.region_code = '130'
      and e.org_code in ('201', '202', '203', '204')
    union all
    select 'aggregato'
    from enabled e
    where e.region_code = '130'
      and ((e.org_type = 'asl' and e.org_code in ('201', '202', '203', '204'))
        or (e.org_type = 'regione' and e.org_code = '130'))
    union all
    select u.unit
    from enabled e
    cross join unnest(array['asl-1', 'asl-2', 'asl-3', 'asl-4']) as u(unit)
    where e.org_type = 'regione' and e.org_code = '130' and e.region_code = '130'
  )
  select coalesce(array_agg(distinct units.unit order by units.unit), '{}'::text[])
  from units
$fn$;

revoke all on function public.pillar_c_scoped_units() from public, anon, service_role;
grant execute on function public.pillar_c_scoped_units() to authenticated;

-- 3. The private bucket. Created, or re-hardened while still empty.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pillar-c-scoped', 'pillar-c-scoped', false, 5242880, array['application/json'])
on conflict (id) do update
  set name = excluded.name, public = false,
      file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 4. The only policy this migration adds: SELECT (download, HEAD, info,
--    list), role authenticated, this bucket, well-formed names, entitled
--    units, and never for the signing, copy and move operations (see
--    REVOCATION, SIGNED URLS AND SERVER-SIDE COPIES above).
--    storage.operation() is an uncorrelated scalar subquery like the units
--    helper, so it is read once per statement; an unset operation (null or
--    '') reads as before.
--    Deliberately no INSERT, UPDATE or DELETE policy: only the service role
--    writes this bucket.
drop policy if exists "pillar c scoped: entitled units read" on storage.objects;
create policy "pillar c scoped: entitled units read"
  on storage.objects
  as permissive
  for select
  to authenticated
  using (
    bucket_id = 'pillar-c-scoped'
    and name ~ '^v[1-9][0-9]{0,2}/(asl-[1-4]|aggregato)/[A-Za-z0-9]+(-[A-Za-z0-9]+)*-[0-9a-f]{64}[.]json$'
    and (storage.foldername(name))[2] = any ((select public.pillar_c_scoped_units())::text[])
    and coalesce((select storage.operation()), '') not in ('storage.object.sign', 'storage.object.sign_many',
      'storage.object.copy', 'storage.object.move', 'storage.s3.object.copy', 'storage.s3.upload.part_copy')
  );

comment on table public.pillar_c_scoped_org_switch is
  'Pillar C Rec 5 rollout: one row per organisation enabled for scoped delivery (mode allowlist or all). Empty means off. Deleting a row is the kill switch for that organisation, in either mode; its allow rows go with it. Owner or service role only.';
comment on table public.pillar_c_scoped_user_allow is
  'Pillar C Rec 5 rollout: users enabled while their organisation is in allowlist mode. Deleting a row turns that user off only in allowlist mode; in mode all these rows are ignored, so revoke the membership instead. Owner or service role only.';
comment on function public.pillar_c_scoped_units() is
  'Pillar C Rec 5: units of bucket pillar-c-scoped the caller may read (asl-1..asl-4, aggregato), from auth.uid(), the single approved membership and the rollout gates. SECURITY DEFINER, no argument.';
comment on policy "pillar c scoped: entitled units read" on storage.objects is
  'Pillar C Rec 5: authenticated SELECT on bucket pillar-c-scoped, names v<N>/<unit>/<file>-<sha256>.json, unit in public.pillar_c_scoped_units(), never for signing (storage.object.sign, storage.object.sign_many) or server-side copy and move (storage.object.copy, storage.object.move, storage.s3.object.copy, storage.s3.upload.part_copy).';

-- 5. Post-conditions: what was just created is what was reviewed.
do $post$
declare
  v_fn oid := to_regprocedure('public.pillar_c_scoped_units()');
  v_search_path text := pg_catalog.current_setting('search_path');
  -- Every operation the policy must refuse, as storage-api names it.
  v_refused constant text[] := array['storage.object.sign', 'storage.object.sign_many', 'storage.object.copy',
                                     'storage.object.move', 'storage.s3.object.copy', 'storage.s3.upload.part_copy'];
begin
  -- The policy text below is read deparsed, which depends on search_path
  -- (storage.operation() is printed qualified only when storage is not on
  -- it): pin it for this block, as step 0 does.
  perform pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);

  if (select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || ' ' || a.attnotnull::text, ', ' order by a.attnum)
        from pg_attribute a where a.attrelid = 'public.pillar_c_scoped_org_switch'::regclass and a.attnum > 0 and not a.attisdropped)
       is distinct from 'org_code text true, mode text true, note text true, changed_at timestamp with time zone true'
     or (select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || ' ' || a.attnotnull::text, ', ' order by a.attnum)
        from pg_attribute a where a.attrelid = 'public.pillar_c_scoped_user_allow'::regclass and a.attnum > 0 and not a.attisdropped)
       is distinct from 'org_code text true, user_id uuid true, note text true, added_at timestamp with time zone true' then
    raise exception 'PCS_POST_ROLLOUT_SHAPE: a rollout table exists with columns other than the reviewed ones';
  end if;

  if exists (select 1 from pg_class c
             where c.oid in ('public.pillar_c_scoped_org_switch'::regclass, 'public.pillar_c_scoped_user_allow'::regclass)
               and not (c.relrowsecurity and c.relforcerowsecurity))
     or exists (select 1 from information_schema.role_table_grants g
                where g.table_schema = 'public'
                  and g.table_name in ('pillar_c_scoped_org_switch', 'pillar_c_scoped_user_allow')
                  and g.grantee in ('PUBLIC', 'anon', 'authenticated')) then
    raise exception 'PCS_POST_ROLLOUT_ACCESS: the rollout tables must force row level security and grant nothing to PUBLIC, anon or authenticated';
  end if;

  if v_fn is null
     or not exists (select 1 from pg_proc p
                    where p.oid = v_fn and p.prosecdef and p.provolatile = 's' and p.pronargs = 0
                      and p.prorettype = 'text[]'::regtype
                      and p.proconfig = array['search_path=pg_catalog, pg_temp'])
     or has_function_privilege('anon', v_fn, 'execute')
     or has_function_privilege('service_role', v_fn, 'execute')
     or not has_function_privilege('authenticated', v_fn, 'execute')
     or exists (select 1 from pg_proc p, aclexplode(p.proacl) x where p.oid = v_fn and x.grantee = 0) then
    raise exception 'PCS_POST_FUNCTION: public.pillar_c_scoped_units() is not the reviewed definer helper';
  end if;

  if (select count(*) from pg_policies p
      where p.schemaname = 'storage' and p.tablename = 'objects'
        and p.policyname = 'pillar c scoped: entitled units read'
        and p.cmd = 'SELECT' and p.permissive = 'PERMISSIVE'
        and p.roles = array['authenticated']::name[] and p.with_check is null
        and position('storage.operation()' in p.qual) > 0
        and not exists (select 1 from unnest(v_refused) as r(op)
                        where position(quote_literal(r.op) in p.qual) = 0)) <> 1
     or exists (select 1 from pg_policies p
                where p.schemaname = 'storage'
                  and p.policyname <> 'pillar c scoped: entitled units read'
                  and (coalesce(p.qual, '') || coalesce(p.with_check, '')) like '%pillar-c-scoped%') then
    raise exception 'PCS_POST_POLICY: the storage policy for pillar-c-scoped is not the reviewed one, or does not refuse signing, copy and move';
  end if;

  -- Object versioning (storage-api tenant migration 0062, column absent on
  -- older projects) would keep a deleted object's earlier versions, so the
  -- re-key of REVOCATION AND SIGNED URLS needs it off. Read through to_jsonb
  -- so that a project without the column passes.
  if not exists (select 1 from storage.buckets b
                 where b.id = 'pillar-c-scoped' and b.name = 'pillar-c-scoped' and b.public = false
                   and b.file_size_limit = 5242880 and b.allowed_mime_types = array['application/json']::text[]
                   and coalesce(to_jsonb(b) ->> 'versioning_status', 'DISABLED') = 'DISABLED') then
    raise exception 'PCS_POST_BUCKET: bucket pillar-c-scoped is not private, 5 MiB, application/json only, with versioning off';
  end if;

  perform pg_catalog.set_config('search_path', v_search_path, true);
end
$post$;

commit;
