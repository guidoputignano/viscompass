-- Persistent evidence resolution inside the existing private Pillar C pilot.
-- The application checks the CURRENT approved reviewer/admin allowlists before
-- every service call, including owner selection. No authenticated user receives
-- a database or Storage grant. There is deliberately no stale SQL reviewer list.
-- p_actor is supplied only by the gated server, from the live auth.getUser().
-- These records document organizational evidence; they never alter mappings,
-- accepted analytical releases, source observations or individual care.

begin;

create table if not exists public.c_evidence_cases (
  id uuid primary key default gen_random_uuid(),
  source jsonb not null check (jsonb_typeof(source) = 'object'),
  source_snapshot text not null check (source_snapshot ~ '^[a-f0-9]{64}$'),
  source_group text not null check (source_group ~ '^[a-f0-9]{64}$'),
  product_key text not null check (length(product_key) between 1 and 160),
  source_state text not null check (source_state in ('S3', 'S4')),
  state text not null default 'unassigned'
    check (state in ('unassigned', 'assigned', 'in_review', 'decision_recorded', 'follow_up', 'closed')),
  revision integer not null default 1 check (revision >= 1),
  cycle_start_revision integer not null default 1,
  owner_id uuid references auth.users(id),
  responsible_org_code text references public.organizations(org_code),
  assigned_role text,
  due_date date,
  decision text check (decision in ('remains_uncertain', 'evidence_sufficient', 'needs_local_allocation', 'identifier_corrected')),
  decision_note text,
  decision_revision integer,
  follow_up_owner_id uuid references auth.users(id),
  follow_up_due_date date,
  follow_up_note text,
  follow_up_outcome text,
  follow_up_revision integer,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  unique (source_snapshot, source_group),
  check ((owner_id is null) = (responsible_org_code is null)),
  check (cycle_start_revision between 1 and revision),
  check (assigned_role is null or length(assigned_role) between 1 and 120),
  check (decision_note is null or length(decision_note) between 1 and 2400),
  check (follow_up_note is null or length(follow_up_note) between 1 and 2400),
  check (follow_up_outcome is null or length(follow_up_outcome) between 1 and 2400),
  check ((state = 'closed') = (closed_at is not null))
);

create table if not exists public.c_evidence_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.c_evidence_cases(id),
  revision integer not null check (revision >= 1),
  action text not null check (action in ('create', 'assign', 'review', 'record_decision', 'followup', 'close', 'reopen', 'attach')),
  actor_id uuid not null references auth.users(id),
  detail jsonb not null check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  unique (case_id, revision)
);

create table if not exists public.c_evidence_attachments (
  id uuid primary key,
  case_id uuid not null references public.c_evidence_cases(id),
  file_name text not null check (length(file_name) between 1 and 240 and file_name !~ '[[:cntrl:]/\\]'),
  bucket_id text not null default 'pillar-c-evidence' check (bucket_id = 'pillar-c-evidence'),
  storage_path text not null unique,
  media_type text not null check (media_type in ('application/pdf', 'text/csv', 'text/plain')),
  byte_size integer not null check (byte_size between 1 and 4194304),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  check (storage_path = case_id::text || '/' || id::text)
);

create index if not exists c_evidence_events_case_idx on public.c_evidence_events(case_id, created_at);
create index if not exists c_evidence_attachments_case_idx on public.c_evidence_attachments(case_id);

alter table public.c_evidence_cases enable row level security;
alter table public.c_evidence_cases force row level security;
alter table public.c_evidence_events enable row level security;
alter table public.c_evidence_events force row level security;
alter table public.c_evidence_attachments enable row level security;
alter table public.c_evidence_attachments force row level security;

-- No policies: even an approved ordinary or former reviewer session gets no row.
revoke all on public.c_evidence_cases, public.c_evidence_events, public.c_evidence_attachments from public, anon, authenticated;
revoke all on public.c_evidence_cases, public.c_evidence_events, public.c_evidence_attachments from service_role;
grant select, insert, update on public.c_evidence_cases to service_role;
grant select, insert on public.c_evidence_events, public.c_evidence_attachments to service_role;

create or replace function public.c_evidence_guard()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if tg_table_name <> 'c_evidence_cases' or tg_op <> 'UPDATE' then
    raise exception 'Evidence history is append only' using errcode = '42501';
  end if;
  if new.source is distinct from old.source or new.source_snapshot is distinct from old.source_snapshot
    or new.source_group is distinct from old.source_group or new.product_key is distinct from old.product_key or new.source_state is distinct from old.source_state
    or new.id is distinct from old.id or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Evidence source is immutable' using errcode = '22023';
  end if;
  if new.revision <> old.revision + 1 then
    raise exception 'Evidence revision must advance once' using errcode = '40001';
  end if;
  return new;
end;
$$;
revoke all on function public.c_evidence_guard() from public, anon, authenticated;

drop trigger if exists c_evidence_case_guard on public.c_evidence_cases;
create trigger c_evidence_case_guard before update or delete on public.c_evidence_cases
  for each row execute function public.c_evidence_guard();
drop trigger if exists c_evidence_event_guard on public.c_evidence_events;
create trigger c_evidence_event_guard before update or delete on public.c_evidence_events
  for each row execute function public.c_evidence_guard();
drop trigger if exists c_evidence_attachment_guard on public.c_evidence_attachments;
create trigger c_evidence_attachment_guard before update or delete on public.c_evidence_attachments
  for each row execute function public.c_evidence_guard();

-- Row triggers do not fire on TRUNCATE: guard it per statement as well, so an
-- owner cleaning up in the SQL editor cannot silently empty the history.
drop trigger if exists c_evidence_case_truncate_guard on public.c_evidence_cases;
create trigger c_evidence_case_truncate_guard before truncate on public.c_evidence_cases
  for each statement execute function public.c_evidence_guard();
drop trigger if exists c_evidence_event_truncate_guard on public.c_evidence_events;
create trigger c_evidence_event_truncate_guard before truncate on public.c_evidence_events
  for each statement execute function public.c_evidence_guard();
drop trigger if exists c_evidence_attachment_truncate_guard on public.c_evidence_attachments;
create trigger c_evidence_attachment_truncate_guard before truncate on public.c_evidence_attachments
  for each statement execute function public.c_evidence_guard();

-- An event may only record the case's CURRENT revision. Both RPCs write the case
-- before its event, so a stray out-of-band insert can no longer occupy revision
-- N+1 and freeze the case.
create or replace function public.c_evidence_event_matches_case()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (select 1 from public.c_evidence_cases where id = new.case_id and revision = new.revision) then
    raise exception 'Evidence event must match the current case revision' using errcode = '40001';
  end if;
  return new;
end;
$$;
revoke all on function public.c_evidence_event_matches_case() from public, anon, authenticated;
drop trigger if exists c_evidence_event_matches_case on public.c_evidence_events;
create trigger c_evidence_event_matches_case before insert on public.c_evidence_events
  for each row execute function public.c_evidence_event_matches_case();

-- Every committed case revision must have its audit event, so a direct
-- INSERT/UPDATE that skips c_evidence_create/c_evidence_mutate is rolled back.
create or replace function public.c_evidence_case_audited()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (select 1 from public.c_evidence_events where case_id = new.id and revision = new.revision) then
    raise exception 'Every evidence case revision needs an audit event' using errcode = '42501';
  end if;
  return null;
end;
$$;
revoke all on function public.c_evidence_case_audited() from public, anon, authenticated;
drop trigger if exists c_evidence_case_audited on public.c_evidence_cases;
create constraint trigger c_evidence_case_audited after insert or update on public.c_evidence_cases
  deferrable initially deferred for each row execute function public.c_evidence_case_audited();

-- Attachment metadata commits only together with its 'attach' event, so a bare
-- row cannot satisfy the evidence preconditions of a decision or a closure.
create or replace function public.c_evidence_attachment_audited()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.c_evidence_events
    where case_id = new.case_id and action = 'attach' and lower(detail #>> '{payload,attachment_id}') = new.id::text
  ) then
    raise exception 'Every evidence attachment needs its audit event' using errcode = '42501';
  end if;
  return null;
end;
$$;
revoke all on function public.c_evidence_attachment_audited() from public, anon, authenticated;
drop trigger if exists c_evidence_attachment_audited on public.c_evidence_attachments;
create constraint trigger c_evidence_attachment_audited after insert on public.c_evidence_attachments
  deferrable initially deferred for each row execute function public.c_evidence_attachment_audited();

-- Free text is trimmed of every character JavaScript's String.prototype.trim
-- removes (ASCII spaces, tab, LF, VT, FF, CR, NBSP, the Unicode space separators,
-- LS, PS and BOM), so a note made only of newlines is rejected and the stored
-- values match what the client compares after .trim(). chr() keeps the set
-- free of backslash escapes.
create or replace function public.c_evidence_trim(p_value text)
returns text language sql immutable strict parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select btrim(p_value, (select string_agg(chr(code), '') from unnest(array[
    9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202,
    8232, 8233, 8239, 8287, 12288, 65279]) as code));
$$;
revoke all on function public.c_evidence_trim(text) from public, anon, authenticated;
grant execute on function public.c_evidence_trim(text) to service_role;

create or replace function public.c_evidence_create(p_actor uuid, p_source jsonb)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_case public.c_evidence_cases%rowtype;
begin
  if p_actor is null or not exists (
    select 1 from public.user_organizations where user_id = p_actor and status = 'approved'
  ) then raise exception 'Approved actor required' using errcode = '42501'; end if;
  if p_source is null or jsonb_typeof(p_source) <> 'object'
    or (p_source - array['source_snapshot','source_group','source_sha256','classification_sha256','mapping_version','period','org','channel','product_key','product_label','source_state']) <> '{}'::jsonb
    or not (p_source ?& array['source_snapshot','source_group','source_sha256','classification_sha256','mapping_version','period','org','channel','product_key','product_label','source_state'])
    or exists (select 1 from jsonb_each(p_source) as kv where jsonb_typeof(kv.value) <> 'string')
    or coalesce(p_source->>'period', '') <> 'FY2025' or coalesce(p_source->>'org', '') <> 'Regione'
    or coalesce(p_source->>'channel', '') <> 'Tutti' or coalesce(p_source->>'source_state', '') not in ('S3','S4')
    or coalesce(p_source->>'source_snapshot', '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_source->>'source_group', '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_source->>'source_sha256', '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_source->>'classification_sha256', '') !~ '^[a-f0-9]{64}$'
    or length(public.c_evidence_trim(coalesce(p_source->>'mapping_version',''))) not between 1 and 96
    or length(public.c_evidence_trim(coalesce(p_source->>'product_key',''))) not between 1 and 160
    or length(public.c_evidence_trim(coalesce(p_source->>'product_label',''))) not between 1 and 300
    or exists (select 1 from jsonb_each_text(p_source) as kv where kv.value ~ '[[:cntrl:]]') then
    raise exception 'Invalid frozen evidence source' using errcode = '22023';
  end if;
  insert into public.c_evidence_cases(source, source_snapshot, source_group, product_key, source_state, created_by, updated_by)
    values(p_source, p_source->>'source_snapshot', p_source->>'source_group', p_source->>'product_key', p_source->>'source_state', p_actor, p_actor)
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

create or replace function public.c_evidence_mutate(p_actor uuid, p_case uuid, p_expected integer, p_action text, p_payload jsonb)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_case public.c_evidence_cases%rowtype;
  v_before jsonb;
  v_payload jsonb;
  v_owner uuid;
  v_org text;
  v_due date;
  v_note text;
  v_attachment uuid;
  v_now timestamptz := clock_timestamp();
begin
  if p_actor is null or not exists (
    select 1 from public.user_organizations where user_id = p_actor and status = 'approved'
  ) then raise exception 'Approved actor required' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or length(p_payload::text) > 12000 then
    raise exception 'Invalid evidence operation' using errcode = '22023';
  end if;
  select * into v_case from public.c_evidence_cases where id = p_case for update;
  if not found then raise exception 'Evidence case not found' using errcode = 'P0002'; end if;
  if p_expected is null or p_expected <> v_case.revision then
    raise exception 'Evidence case changed; reload before saving' using errcode = '40001';
  end if;
  v_before := to_jsonb(v_case);
  if v_case.state = 'closed' and p_action <> 'reopen' then
    raise exception 'Reopen the case before changing it' using errcode = '22023';
  end if;

  if p_action in ('assign', 'followup') then
    if (p_payload - case when p_action = 'assign' then array['owner_id','role','due_date'] else array['owner_id','due_date','note','outcome'] end) <> '{}'::jsonb
      or jsonb_typeof(p_payload->'owner_id') is distinct from 'string'
      or jsonb_typeof(p_payload->'due_date') is distinct from 'string'
      or coalesce(p_payload->>'owner_id','') !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
      or coalesce(p_payload->>'due_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Invalid assignment' using errcode = '22023';
    end if;
    v_owner := (p_payload->>'owner_id')::uuid;
    begin v_due := (p_payload->>'due_date')::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception 'Invalid due date' using errcode = '22023'; end;
    -- Deterministic even if an owner ever holds several approved memberships.
    -- 'review' then re-checks that exact stored (owner, org) pair is still approved.
    select org_code into v_org from public.user_organizations
      where user_id = v_owner and status = 'approved' order by org_code limit 1;
    if not found then raise exception 'Approved owner required' using errcode = '42501'; end if;
  end if;

  if p_action = 'assign' then
    if v_case.state not in ('unassigned','assigned','in_review') or jsonb_typeof(p_payload->'role') is distinct from 'string'
      or length(public.c_evidence_trim(coalesce(p_payload->>'role',''))) not between 1 and 120 then
      raise exception 'Invalid assignment transition' using errcode = '22023'; end if;
    v_case.owner_id := v_owner; v_case.responsible_org_code := v_org;
    v_case.assigned_role := public.c_evidence_trim(p_payload->>'role'); v_case.due_date := v_due; v_case.state := 'assigned';
  elsif p_action = 'review' then
    if p_payload <> '{}'::jsonb or v_case.state <> 'assigned' or v_case.owner_id is null or v_case.due_date is null
      or not exists(select 1 from public.user_organizations where user_id = v_case.owner_id and org_code = v_case.responsible_org_code and status = 'approved') then
      raise exception 'An approved assignment is required before review' using errcode = '22023'; end if;
    v_case.state := 'in_review';
  elsif p_action = 'record_decision' then
    if v_case.state <> 'in_review' or (p_payload - array['decision','note']) <> '{}'::jsonb
      or jsonb_typeof(p_payload->'decision') is distinct from 'string'
      or coalesce(p_payload->>'decision','') not in ('remains_uncertain','evidence_sufficient','needs_local_allocation','identifier_corrected')
      or jsonb_typeof(p_payload->'note') is distinct from 'string'
      or length(public.c_evidence_trim(coalesce(p_payload->>'note',''))) not between 1 and 2400 then
      raise exception 'Invalid evidence decision' using errcode = '22023'; end if;
    if p_payload->>'decision' = 'evidence_sufficient' and not exists (
      select 1 from public.c_evidence_attachments where case_id = p_case
    ) then raise exception 'Supporting evidence is required for this decision' using errcode = '22023'; end if;
    v_case.decision := p_payload->>'decision'; v_case.decision_note := public.c_evidence_trim(p_payload->>'note');
    v_case.decision_revision := v_case.revision + 1; v_case.state := 'decision_recorded';
  elsif p_action = 'followup' then
    if v_case.state not in ('decision_recorded','follow_up')
      or jsonb_typeof(p_payload->'note') is distinct from 'string'
      or length(public.c_evidence_trim(coalesce(p_payload->>'note',''))) not between 1 and 2400
      or (p_payload ? 'outcome' and (jsonb_typeof(p_payload->'outcome') <> 'string' or length(public.c_evidence_trim(p_payload->>'outcome')) > 2400)) then
      raise exception 'Invalid follow up' using errcode = '22023'; end if;
    v_case.follow_up_owner_id := v_owner; v_case.follow_up_due_date := v_due;
    v_case.follow_up_note := public.c_evidence_trim(p_payload->>'note'); v_case.follow_up_outcome := nullif(public.c_evidence_trim(p_payload->>'outcome'),'');
    v_case.follow_up_revision := v_case.revision + 1; v_case.state := 'follow_up';
  elsif p_action = 'close' then
    if (p_payload - array['outcome']) <> '{}'::jsonb
      or (p_payload ? 'outcome' and (jsonb_typeof(p_payload->'outcome') <> 'string' or length(public.c_evidence_trim(p_payload->>'outcome')) not between 1 and 2400)) then
      raise exception 'Invalid follow up outcome' using errcode = '22023'; end if;
    if p_payload ? 'outcome' then v_case.follow_up_outcome := public.c_evidence_trim(p_payload->>'outcome'); end if;
    if v_case.state <> 'follow_up' or v_case.decision is null
      or v_case.decision_revision < v_case.cycle_start_revision
      or v_case.follow_up_revision < v_case.decision_revision
      or v_case.follow_up_outcome is null or v_case.follow_up_owner_id is null
      or not exists (select 1 from public.user_organizations where user_id = v_case.follow_up_owner_id and status = 'approved')
      or not exists (select 1 from public.c_evidence_attachments where case_id = p_case) then
      raise exception 'Evidence, decision and completed follow up are required' using errcode = '22023'; end if;
    v_case.state := 'closed'; v_case.closed_at := v_now;
  elsif p_action = 'reopen' then
    if v_case.state <> 'closed' or (p_payload - array['note']) <> '{}'::jsonb
      or jsonb_typeof(p_payload->'note') is distinct from 'string'
      or length(public.c_evidence_trim(coalesce(p_payload->>'note',''))) not between 1 and 2400 then
      raise exception 'A reason is required to reopen a closed case' using errcode = '22023'; end if;
    -- Prior decisions remain in immutable events and the case summary. A new
    -- decision/follow up must be recorded in this cycle before closing again.
    v_case.state := 'in_review'; v_case.closed_at := null; v_case.cycle_start_revision := v_case.revision + 1;
  elsif p_action = 'attach' then
    if (p_payload - array['attachment_id','file_name','storage_path','media_type','byte_size','sha256']) <> '{}'::jsonb
      or not (p_payload ?& array['attachment_id','file_name','storage_path','media_type','byte_size','sha256'])
      or exists (select 1 from jsonb_each(p_payload) kv where kv.key <> 'byte_size' and jsonb_typeof(kv.value) <> 'string')
      or coalesce(p_payload->>'attachment_id','') !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
      or length(public.c_evidence_trim(coalesce(p_payload->>'file_name',''))) not between 1 and 240
      or (p_payload->>'file_name') ~ '[[:cntrl:]/\\]'
      or coalesce(p_payload->>'media_type','') not in ('application/pdf','text/csv','text/plain')
      or jsonb_typeof(p_payload->'byte_size') is distinct from 'number'
      or coalesce(p_payload->>'byte_size','') !~ '^[0-9]{1,8}$'
      or coalesce(p_payload->>'sha256','') !~ '^[a-f0-9]{64}$' then
      raise exception 'Invalid evidence attachment' using errcode = '22023'; end if;
    v_attachment := (p_payload->>'attachment_id')::uuid;
    if (p_payload->>'byte_size')::integer not between 1 and 4194304
      or p_payload->>'storage_path' <> p_case::text || '/' || v_attachment::text then
      raise exception 'Invalid evidence attachment path or size' using errcode = '22023'; end if;
    if (select count(*) from public.c_evidence_attachments where case_id = p_case) >= 10 then
      raise exception 'A case can contain at most ten evidence attachments' using errcode = '22023'; end if;
    insert into public.c_evidence_attachments(id,case_id,file_name,storage_path,media_type,byte_size,sha256,created_by)
      values(v_attachment,p_case,public.c_evidence_trim(p_payload->>'file_name'),p_payload->>'storage_path',p_payload->>'media_type',
        (p_payload->>'byte_size')::integer,p_payload->>'sha256',p_actor);
  else
    raise exception 'Unknown evidence operation' using errcode = '22023';
  end if;

  v_case.revision := v_case.revision + 1; v_case.updated_at := v_now; v_case.updated_by := p_actor;
  update public.c_evidence_cases set
    state=v_case.state,revision=v_case.revision,cycle_start_revision=v_case.cycle_start_revision,
    owner_id=v_case.owner_id,responsible_org_code=v_case.responsible_org_code,assigned_role=v_case.assigned_role,due_date=v_case.due_date,
    decision=v_case.decision,decision_note=v_case.decision_note,decision_revision=v_case.decision_revision,
    follow_up_owner_id=v_case.follow_up_owner_id,follow_up_due_date=v_case.follow_up_due_date,
    follow_up_note=v_case.follow_up_note,follow_up_outcome=v_case.follow_up_outcome,follow_up_revision=v_case.follow_up_revision,
    updated_by=v_case.updated_by,updated_at=v_case.updated_at,closed_at=v_case.closed_at where id=p_case;
  -- The audit payload records the free text as applied (trimmed), e.g. the reopen
  -- reason, which lives only in its event.
  select coalesce(jsonb_object_agg(kv.key, case when kv.key in ('role','note','outcome','file_name') and jsonb_typeof(kv.value) = 'string'
      then to_jsonb(public.c_evidence_trim(kv.value #>> '{}')) else kv.value end), '{}'::jsonb)
    into v_payload from jsonb_each(p_payload) as kv;
  insert into public.c_evidence_events(case_id,revision,action,actor_id,detail,created_at)
    values(p_case,v_case.revision,p_action,p_actor,jsonb_build_object('payload',v_payload,'before',v_before,'after',to_jsonb(v_case)),v_now);
  return to_jsonb(v_case);
end;
$$;

revoke all on function public.c_evidence_create(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.c_evidence_mutate(uuid,uuid,integer,text,jsonb) from public, anon, authenticated;
grant execute on function public.c_evidence_create(uuid,jsonb) to service_role;
grant execute on function public.c_evidence_mutate(uuid,uuid,integer,text,jsonb) to service_role;

comment on table public.c_evidence_cases is 'Private Pillar C pilot evidence cases. No authenticated grants. Current reviewer/admin access is checked by the server before service calls.';
comment on table public.c_evidence_events is 'Append only organizational evidence history, including superseded decisions. No analytical acceptance or mapping activation.';

-- Private evidence bucket. Engines without Supabase Storage (the PGlite harness)
-- skip it; on Supabase it is created or re-hardened on every run. The 4 MiB limit
-- equals C_EVIDENCE_MAX_FILE (Vercel rejects request bodies over 4.5 MB). There
-- are deliberately no storage.objects policies: only the service role, which
-- bypasses RLS, reads or writes these objects.
do $bucket$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('pillar-c-evidence', 'pillar-c-evidence', false, 4194304, array['application/pdf', 'text/csv', 'text/plain'])
    on conflict (id) do update
      set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end
$bucket$;

commit;
