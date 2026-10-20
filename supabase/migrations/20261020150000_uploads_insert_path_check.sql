-- Database-level counterpart of lib/uploads/storage-path.ts (CLAUDE.md §4: an INSERT policy constrains values,
-- not just identity). An uploads row may only name an object of the caller's own organisation folder in the
-- private 'uploads' bucket, written by the caller, in the character set Storage itself accepts, without "..".
-- processUpload reads storage_path with the service role, which bypasses Storage RLS, so this row value is the
-- last line between a client-chosen string and a privileged read. The app checks the same rule before writing
-- and again before reading; this policy makes a direct PostgREST insert obey it too.
--
-- The rest of the predicate is the policy as it stands (supabase_schema.sql section 4, revised): approved
-- membership of the row's organisation, status 'uploaded', no reconciliation fields.

begin;

do $pre$
begin
  if to_regclass('public.uploads') is null then raise exception 'UPL_PRE_TABLE: public.uploads is missing'; end if;
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'uploads'
      and column_name in ('org_code', 'uploaded_by', 'storage_path', 'status', 'reconciliation_summary', 'reconciled_at')) <> 6
    then raise exception 'UPL_PRE_COLUMNS: public.uploads does not have the expected columns'; end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'uploads'
      and policyname = 'upload for own approved org' and cmd = 'INSERT')
    then raise exception 'UPL_PRE_POLICY: the insert policy to replace is missing'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'uploads' and cmd in ('INSERT', 'ALL')
      and policyname <> 'upload for own approved org')
    then raise exception 'UPL_PRE_OTHER_POLICY: another insert policy on public.uploads would bypass this one'; end if;
end
$pre$;

drop policy if exists "upload for own approved org" on public.uploads;
create policy "upload for own approved org" on public.uploads for insert
  with check (
    exists (select 1 from public.user_organizations uo
            where uo.user_id = auth.uid() and uo.status = 'approved'
              and uo.org_code = uploads.org_code)
    and uploaded_by = auth.uid()
    and status = 'uploaded'
    and reconciliation_summary is null
    and reconciled_at is null
    and length(storage_path) <= 1024
    and left(storage_path, length(org_code) + 1) = org_code || '/'
    and substr(storage_path, length(org_code) + 2) ~ '^[A-Za-z0-9][A-Za-z0-9_!.*''() &$=@;:+,?-]*$'
    and position('..' in storage_path) = 0
  );

commit;
