-- Pillar C point 18: findings to action in the existing private evidence workflow.
-- A finding case is a c_evidence_cases row with source_state 'F'. Its source is one versioned finding of the
-- reviewer extension object (January 2026 DPC and File F 2025): source_snapshot is that object's SHA-256 and
-- source_group the SHA-256 of "finding|<version>|<id>". It names its source, version and scope; never a person.
-- Owner, evidence, decision, follow-up and closure use the unchanged c_evidence_mutate. As before, only the gated
-- server (service role) can call it; no authenticated user receives a grant. Additive: existing rows, functions,
-- policies and grants are not changed, apart from widening the source_state check to admit 'F'.

begin;

do $$
begin
  if to_regclass('public.c_evidence_cases') is null or to_regprocedure('public.c_evidence_mutate(uuid,uuid,integer,text,jsonb)') is null then
    raise exception 'PCF_PRE: the evidence workflow migration 20261019120000 is not applied';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.c_evidence_cases'::regclass and conname = 'c_evidence_cases_source_state_check'
      and pg_get_constraintdef(oid) ~ 'S3' and pg_get_constraintdef(oid) ~ 'S4' and pg_get_constraintdef(oid) !~ '''F'''
  ) then
    raise exception 'PCF_PRE: c_evidence_cases_source_state_check is not the reviewed S3/S4 check';
  end if;
end;
$$;

alter table public.c_evidence_cases drop constraint c_evidence_cases_source_state_check;
alter table public.c_evidence_cases add constraint c_evidence_cases_source_state_check check (source_state in ('S3', 'S4', 'F'));

create or replace function public.c_evidence_create_finding(p_actor uuid, p_source jsonb)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_case public.c_evidence_cases%rowtype;
  v_keys constant text[] := array['source_snapshot','source_group','finding_version','product_key','product_label','scope','origin','source_state'];
begin
  if p_actor is null or not exists (
    select 1 from public.user_organizations where user_id = p_actor and status = 'approved'
  ) then raise exception 'Approved actor required' using errcode = '42501'; end if;
  if p_source is null or jsonb_typeof(p_source) <> 'object'
    or (p_source - v_keys) <> '{}'::jsonb or not (p_source ?& v_keys)
    or exists (select 1 from jsonb_each(p_source) as kv where jsonb_typeof(kv.value) <> 'string')
    or p_source->>'source_state' <> 'F' or p_source->>'finding_version' <> 'ext-v1'
    or p_source->>'product_key' !~ '^F[0-9]{2}$'
    or p_source->>'source_snapshot' !~ '^[a-f0-9]{64}$'
    or p_source->>'source_group' !~ '^[a-f0-9]{64}$'
    or length(public.c_evidence_trim(p_source->>'product_label')) not between 1 and 300
    or length(public.c_evidence_trim(p_source->>'scope')) not between 1 and 300
    or length(public.c_evidence_trim(p_source->>'origin')) not between 1 and 300
    or exists (select 1 from jsonb_each_text(p_source) as kv where kv.value ~ '[[:cntrl:]]') then
    raise exception 'Invalid finding source' using errcode = '22023';
  end if;
  insert into public.c_evidence_cases(source, source_snapshot, source_group, product_key, source_state, created_by, updated_by)
    values(p_source, p_source->>'source_snapshot', p_source->>'source_group', p_source->>'product_key', 'F', p_actor, p_actor)
    on conflict (source_snapshot, source_group) do nothing returning * into v_case;
  if found then
    insert into public.c_evidence_events(case_id, revision, action, actor_id, detail)
      values(v_case.id, 1, 'create', p_actor, jsonb_build_object('source', p_source));
  else
    select * into v_case from public.c_evidence_cases
      where source_snapshot = p_source->>'source_snapshot' and source_group = p_source->>'source_group';
    if v_case.source is distinct from p_source then
      raise exception 'Frozen evidence source conflict' using errcode = '22023';
    end if;
  end if;
  return to_jsonb(v_case);
end;
$$;

revoke all on function public.c_evidence_create_finding(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.c_evidence_create_finding(uuid,jsonb) to service_role;

commit;
