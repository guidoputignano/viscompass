-- Pillar C, regional analytical parity (owner clarification of 23 October 2026,
-- private record rec5/OWNER_REGIONAL_SCOPE_CLARIFICATION_20261023.md): an
-- approved Abruzzo Regione account reads the reviewer's Abruzzo analyses under
-- its own session.
--
-- DORMANT UNTIL APPLIED, and applied only with the owner's explicit approval.
-- One transaction. It replaces the one storage policy of migration
-- 20261020120000_pillar_c_scoped_storage.sql with the same policy plus one
-- folder, and changes nothing else (no table, no function, no grant, no row of
-- the rollout tables: nobody gains access until the owner enables an
-- organisation there).
--
-- WHY. The region-wide analyses (the review packet, the workbook outputs, the
-- extension's comparisons across the four Aziende) cover every Azienda at once.
-- They cannot sit in a unit folder: «aggregato» is read by every Azienda too,
-- and an ASL folder by that Azienda. Until now only the reviewer read them,
-- through the service role.
--
-- WHAT. One more folder, <root>/regione/<file>-<sha256>.json, readable only by
-- a session to which public.pillar_c_scoped_units() returns all four ASL units
-- and the aggregate: by construction an enabled member of the Regione 130 and
-- nobody else (an Azienda receives its own ASL and the aggregate; any other
-- session nothing). The units helper is unchanged and still decides who is
-- enabled. Every unit folder reads exactly as before, so an Azienda still reads
-- only its own unit and the aggregate. Signing, copy and move stay refused.
-- The folder is Abruzzo's: the helper's units are the four Abruzzo Aziende, so
-- another region's Regione receives no unit and cannot read it.
--
-- PRECONDITIONS (abort with a stable code):
--   PCR_PRE_HELPER   public.pillar_c_scoped_units() is not the reviewed helper
--   PCR_PRE_POLICY   the 20261020 policy is not present exactly once with its
--                    reviewed elements, or another storage policy mentions
--                    the bucket
-- POSTCONDITION:
--   PCR_POST_POLICY  the new policy is not present exactly once with every
--                    element of the old one plus the regional folder

begin;

do $pre$
declare
  v_search_path text := pg_catalog.current_setting('search_path');
  v_fn oid := to_regprocedure('public.pillar_c_scoped_units()');
  v_refused constant text[] := array['storage.object.sign', 'storage.object.sign_many', 'storage.object.copy',
                                     'storage.object.move', 'storage.s3.object.copy', 'storage.s3.upload.part_copy'];
begin
  perform pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);

  if v_fn is null
     or not exists (select 1 from pg_proc p
                    where p.oid = v_fn and p.prosecdef and p.provolatile = 's' and p.pronargs = 0
                      and p.prorettype = 'text[]'::regtype
                      and p.proconfig = array['search_path=pg_catalog, pg_temp'])
     or has_function_privilege('anon', v_fn, 'execute')
     or not has_function_privilege('authenticated', v_fn, 'execute') then
    raise exception 'PCR_PRE_HELPER: public.pillar_c_scoped_units() is not the reviewed definer helper';
  end if;

  if (select count(*) from pg_policies p
      where p.schemaname = 'storage' and p.tablename = 'objects'
        and p.policyname = 'pillar c scoped: entitled units read'
        and p.cmd = 'SELECT' and p.permissive = 'PERMISSIVE'
        and p.roles = array['authenticated']::name[] and p.with_check is null
        and position('pillar-c-scoped' in p.qual) > 0
        and position('pillar_c_scoped_units()' in p.qual) > 0
        and position('foldername(' in p.qual) > 0
        and position('storage.operation()' in p.qual) > 0
        and position('regione' in p.qual) = 0
        and not exists (select 1 from unnest(v_refused) as r(op)
                        where position(quote_literal(r.op) in p.qual) = 0)) <> 1
     or exists (select 1 from pg_policies p
                where p.schemaname = 'storage'
                  and p.policyname <> 'pillar c scoped: entitled units read'
                  and (coalesce(p.qual, '') || coalesce(p.with_check, '')) like '%pillar-c-scoped%') then
    raise exception 'PCR_PRE_POLICY: the storage policy of pillar-c-scoped is not the reviewed 20261020 policy';
  end if;

  perform pg_catalog.set_config('search_path', v_search_path, true);
end
$pre$;

drop policy "pillar c scoped: entitled units read" on storage.objects;
create policy "pillar c scoped: entitled units read"
  on storage.objects
  as permissive
  for select
  to authenticated
  using (
    bucket_id = 'pillar-c-scoped'
    and name ~ '^v[1-9][0-9]{0,2}/(asl-[1-4]|aggregato|regione)/[A-Za-z0-9]+(-[A-Za-z0-9]+)*-[0-9a-f]{64}[.]json$'
    and ((storage.foldername(name))[2] = any ((select public.pillar_c_scoped_units())::text[])
         or ((storage.foldername(name))[2] = 'regione'
             and (select public.pillar_c_scoped_units())::text[] @> array['aggregato', 'asl-1', 'asl-2', 'asl-3', 'asl-4']::text[]))
    and coalesce((select storage.operation()), '') not in ('storage.object.sign', 'storage.object.sign_many',
      'storage.object.copy', 'storage.object.move', 'storage.s3.object.copy', 'storage.s3.upload.part_copy')
  );

comment on policy "pillar c scoped: entitled units read" on storage.objects is
  'Pillar C Rec 5 and regional parity: authenticated SELECT on bucket pillar-c-scoped, names v<N>/<folder>/<file>-<sha256>.json; a unit folder (asl-1..asl-4, aggregato) when the unit is in public.pillar_c_scoped_units(); the folder regione only when those units are all four ASLs and the aggregate (an enabled member of the Regione 130); never for signing (storage.object.sign, storage.object.sign_many) or server-side copy and move (storage.object.copy, storage.object.move, storage.s3.object.copy, storage.s3.upload.part_copy).';

do $post$
declare
  v_search_path text := pg_catalog.current_setting('search_path');
  v_refused constant text[] := array['storage.object.sign', 'storage.object.sign_many', 'storage.object.copy',
                                     'storage.object.move', 'storage.s3.object.copy', 'storage.s3.upload.part_copy'];
begin
  perform pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
  if (select count(*) from pg_policies p
      where p.schemaname = 'storage' and p.tablename = 'objects'
        and p.policyname = 'pillar c scoped: entitled units read'
        and p.cmd = 'SELECT' and p.permissive = 'PERMISSIVE'
        and p.roles = array['authenticated']::name[] and p.with_check is null
        and position('pillar-c-scoped' in p.qual) > 0
        and position('pillar_c_scoped_units()' in p.qual) > 0
        and position('foldername(' in p.qual) > 0
        and position('storage.operation()' in p.qual) > 0
        and position('''regione''' in p.qual) > 0
        and position('asl-4' in p.qual) > 0
        and not exists (select 1 from unnest(v_refused) as r(op)
                        where position(quote_literal(r.op) in p.qual) = 0)) <> 1
     or exists (select 1 from pg_policies p
                where p.schemaname = 'storage'
                  and p.policyname <> 'pillar c scoped: entitled units read'
                  and (coalesce(p.qual, '') || coalesce(p.with_check, '')) like '%pillar-c-scoped%') then
    raise exception 'PCR_POST_POLICY: the storage policy for pillar-c-scoped is not the reviewed regional-folder policy';
  end if;
  perform pg_catalog.set_config('search_path', v_search_path, true);
end
$post$;

commit;
