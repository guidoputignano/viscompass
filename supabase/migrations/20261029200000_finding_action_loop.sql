-- The action loop for biosimilar and benchmark findings (pack priority 2).
-- A reviewer or admin opens a case from a finding about ONE Azienda and assigns
-- it to an approved member of that Azienda (or, for internal triage, to a
-- reviewer or admin). The owner acknowledges it, records a decision, and closes
-- it with an outcome. Every change is one audited revision.
--
-- As in c_evidence_*, no authenticated user has a grant. The server checks the
-- live session and who may take each action, then calls these functions with
-- the service role; p_actor comes only from that server. The cases record
-- organisational follow-up: they never change data, releases or care.

begin;

create table if not exists public.finding_cases (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('biosimilar', 'benchmark')),
  source jsonb not null check (jsonb_typeof(source) = 'object'),
  source_key text not null unique check (source_key ~ '^[a-f0-9]{64}$'),
  release_stamp text not null check (length(release_stamp) between 1 and 96),
  org_code text not null references public.organizations(org_code),
  subject_key text not null check (length(subject_key) between 1 and 160),
  state text not null default 'open'
    check (state in ('open', 'assigned', 'in_review', 'decision_recorded', 'closed')),
  revision integer not null default 1 check (revision >= 1),
  cycle_start_revision integer not null default 1,
  owner_id uuid references auth.users(id),
  owner_org text references public.organizations(org_code),
  due_date date,
  decision text check (decision in ('action_planned', 'no_action_justified', 'data_to_verify', 'already_addressed')),
  decision_note text,
  decision_revision integer,
  outcome text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  check ((owner_id is null) = (owner_org is null)),
  check ((owner_id is null) = (due_date is null)),
  check ((state = 'open') = (owner_id is null)),
  check (cycle_start_revision between 1 and revision),
  check ((decision is null) = (decision_note is null)),
  check ((decision is null) = (decision_revision is null)),
  check (decision_note is null or length(decision_note) between 1 and 2400),
  check (outcome is null or length(outcome) between 1 and 2400),
  check ((state = 'closed') = (closed_at is not null)),
  check (state <> 'closed' or (decision is not null and outcome is not null))
);

create table if not exists public.finding_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.finding_cases(id),
  revision integer not null check (revision >= 1),
  action text not null check (action in ('create', 'assign', 'start', 'record_decision', 'close', 'reopen')),
  actor_id uuid not null references auth.users(id),
  detail jsonb not null check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  unique (case_id, revision)
);

-- One overdue reminder per case, due date and owner: a new owner or a new due
-- date can be reminded again. Kept apart from the case so that a reminder never
-- changes the revision an owner is editing.
create table if not exists public.finding_reminders (
  case_id uuid not null references public.finding_cases(id),
  due_date date not null,
  owner_id uuid not null references auth.users(id),
  sent_at timestamptz not null default clock_timestamp(),
  primary key (case_id, due_date, owner_id)
);

create index if not exists finding_cases_org_idx on public.finding_cases(org_code, state);
create index if not exists finding_cases_due_idx on public.finding_cases(due_date) where state in ('assigned', 'in_review', 'decision_recorded');
create index if not exists finding_events_case_idx on public.finding_events(case_id, created_at);

alter table public.finding_cases enable row level security;
alter table public.finding_cases force row level security;
alter table public.finding_events enable row level security;
alter table public.finding_events force row level security;
alter table public.finding_reminders enable row level security;
alter table public.finding_reminders force row level security;

-- No policies: no session reads a row; the gated server reads with the service role.
revoke all on public.finding_cases, public.finding_events, public.finding_reminders from public, anon, authenticated;
revoke all on public.finding_cases, public.finding_events, public.finding_reminders from service_role;
grant select, insert, update on public.finding_cases to service_role;
grant select, insert on public.finding_events, public.finding_reminders to service_role;

create or replace function public.finding_guard()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if tg_table_name <> 'finding_cases' or tg_op <> 'UPDATE' then
    raise exception 'Finding history is append only' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or new.kind is distinct from old.kind or new.source is distinct from old.source
    or new.source_key is distinct from old.source_key or new.release_stamp is distinct from old.release_stamp
    or new.org_code is distinct from old.org_code or new.subject_key is distinct from old.subject_key
    or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Finding source is immutable' using errcode = '22023';
  end if;
  if new.revision <> old.revision + 1 then
    raise exception 'Finding revision must advance once' using errcode = '40001';
  end if;
  return new;
end;
$$;
revoke all on function public.finding_guard() from public, anon, authenticated;

drop trigger if exists finding_case_guard on public.finding_cases;
create trigger finding_case_guard before update or delete on public.finding_cases
  for each row execute function public.finding_guard();
drop trigger if exists finding_event_guard on public.finding_events;
create trigger finding_event_guard before update or delete on public.finding_events
  for each row execute function public.finding_guard();
drop trigger if exists finding_reminder_guard on public.finding_reminders;
create trigger finding_reminder_guard before update or delete on public.finding_reminders
  for each row execute function public.finding_guard();

-- Row triggers do not fire on TRUNCATE.
drop trigger if exists finding_case_truncate_guard on public.finding_cases;
create trigger finding_case_truncate_guard before truncate on public.finding_cases
  for each statement execute function public.finding_guard();
drop trigger if exists finding_event_truncate_guard on public.finding_events;
create trigger finding_event_truncate_guard before truncate on public.finding_events
  for each statement execute function public.finding_guard();
drop trigger if exists finding_reminder_truncate_guard on public.finding_reminders;
create trigger finding_reminder_truncate_guard before truncate on public.finding_reminders
  for each statement execute function public.finding_guard();

-- An event may only record the case's current revision.
create or replace function public.finding_event_matches_case()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (select 1 from public.finding_cases where id = new.case_id and revision = new.revision) then
    raise exception 'Finding event must match the current case revision' using errcode = '40001';
  end if;
  return new;
end;
$$;
revoke all on function public.finding_event_matches_case() from public, anon, authenticated;
drop trigger if exists finding_event_matches_case on public.finding_events;
create trigger finding_event_matches_case before insert on public.finding_events
  for each row execute function public.finding_event_matches_case();

-- Every committed revision has its audit event, so a direct write that skips
-- the functions below is rolled back.
create or replace function public.finding_case_audited()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (select 1 from public.finding_events where case_id = new.id and revision = new.revision) then
    raise exception 'Every finding case revision needs an audit event' using errcode = '42501';
  end if;
  return null;
end;
$$;
revoke all on function public.finding_case_audited() from public, anon, authenticated;
drop trigger if exists finding_case_audited on public.finding_cases;
create constraint trigger finding_case_audited after insert or update on public.finding_cases
  deferrable initially deferred for each row execute function public.finding_case_audited();

-- The same whitespace set as c_evidence_trim (what String.prototype.trim removes).
create or replace function public.finding_trim(p_value text)
returns text language sql immutable strict parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select btrim(p_value, (select string_agg(chr(code), '') from unnest(array[
    9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202,
    8232, 8233, 8239, 8287, 12288, 65279]) as code));
$$;
revoke all on function public.finding_trim(text) from public, anon, authenticated;
grant execute on function public.finding_trim(text) to service_role;

create or replace function public.finding_case_create(p_actor uuid, p_source jsonb)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_case public.finding_cases%rowtype;
  v_kind text;
  v_keys text[];
begin
  if p_actor is null or not exists (
    select 1 from public.user_organizations where user_id = p_actor and status = 'approved'
  ) then raise exception 'Approved actor required' using errcode = '42501'; end if;
  if p_source is null or jsonb_typeof(p_source) <> 'object' or length(p_source::text) > 4000 then
    raise exception 'Invalid finding source' using errcode = '22023';
  end if;
  v_kind := p_source->>'kind';
  v_keys := case v_kind
    when 'biosimilar' then array['kind','source_key','release','org_code','org_label','asl_code','subject','subject_label','cohort','reference_eur','first_local','years','channels']
    when 'benchmark' then array['kind','source_key','release','org_code','org_label','asl_code','subject','subject_label','year','unit_cost_index','unit_cost_coverage']
  end;
  if v_keys is null or (p_source - v_keys) <> '{}'::jsonb or not (p_source ?& v_keys)
    or exists (select 1 from jsonb_each(p_source) as kv where jsonb_typeof(kv.value) <> 'string')
    or exists (select 1 from jsonb_each_text(p_source) as kv where kv.value ~ '[[:cntrl:]]')
    or length(public.finding_trim(p_source->>'release')) not between 1 and 96
    or not exists (select 1 from public.organizations where org_code = p_source->>'org_code')
    or length(public.finding_trim(p_source->>'org_label')) not between 1 and 200
    or coalesce(p_source->>'asl_code', '') !~ '^[0-9A-Za-z]{1,16}$'
    or length(public.finding_trim(p_source->>'subject')) not between 1 and 160
    or length(public.finding_trim(p_source->>'subject_label')) not between 1 and 300
    -- The identity of a finding: kind, release, Azienda and subject. A new release is a new finding.
    or p_source->>'source_key' <> encode(sha256(convert_to(
      (p_source->>'kind') || '|' || (p_source->>'release') || '|' || (p_source->>'asl_code') || '|' || (p_source->>'subject'), 'UTF8')), 'hex')
    or (v_kind = 'biosimilar' and (
      p_source->>'cohort' <> 'after_local_switch'
      or p_source->>'reference_eur' !~ '^[0-9]{1,12}\.[0-9]{2}$'
      or p_source->>'first_local' !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
      or p_source->>'years' !~ '^20[0-9]{2}(-20[0-9]{2})?$'
      or p_source->>'channels' <> 'all'))
    or (v_kind = 'benchmark' and (
      p_source->>'subject' <> 'unit_cost_index'
      or p_source->>'year' !~ '^20[0-9]{2}$'
      or p_source->>'unit_cost_index' !~ '^[0-9]{1,4}\.[0-9]$'
      or p_source->>'unit_cost_coverage' !~ '^(0\.[0-9]{3}|1\.000)$')) then
    raise exception 'Invalid finding source' using errcode = '22023';
  end if;
  insert into public.finding_cases(kind, source, source_key, release_stamp, org_code, subject_key, created_by, updated_by)
    values(v_kind, p_source, p_source->>'source_key', p_source->>'release', p_source->>'org_code', p_source->>'subject', p_actor, p_actor)
    on conflict (source_key) do nothing returning * into v_case;
  if found then
    insert into public.finding_events(case_id, revision, action, actor_id, detail)
      values(v_case.id, 1, 'create', p_actor, jsonb_build_object('source', p_source));
  else
    select * into v_case from public.finding_cases where source_key = p_source->>'source_key';
    if v_case.source is distinct from p_source then
      raise exception 'Frozen finding source conflict' using errcode = '22023';
    end if;
  end if;
  return to_jsonb(v_case);
end;
$$;

create or replace function public.finding_case_mutate(p_actor uuid, p_case uuid, p_expected integer, p_action text, p_payload jsonb)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_case public.finding_cases%rowtype;
  v_before jsonb;
  v_payload jsonb;
  v_owner uuid;
  v_due date;
  v_now timestamptz := clock_timestamp();
begin
  if p_actor is null or not exists (
    select 1 from public.user_organizations where user_id = p_actor and status = 'approved'
  ) then raise exception 'Approved actor required' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 6000 then
    raise exception 'Invalid finding operation' using errcode = '22023';
  end if;
  select * into v_case from public.finding_cases where id = p_case for update;
  if not found then raise exception 'Finding case not found' using errcode = 'P0002'; end if;
  if p_expected is null or p_expected <> v_case.revision then
    raise exception 'Finding case changed; reload before saving' using errcode = '40001';
  end if;
  v_before := to_jsonb(v_case);
  if v_case.state = 'closed' and p_action <> 'reopen' then
    raise exception 'Reopen the case before changing it' using errcode = '22023';
  end if;

  if p_action = 'assign' then
    if v_case.state not in ('open', 'assigned', 'in_review')
      or (p_payload - array['owner_id','owner_org','due_date']) <> '{}'::jsonb
      or not (p_payload ?& array['owner_id','owner_org','due_date'])
      or exists (select 1 from jsonb_each(p_payload) as kv where jsonb_typeof(kv.value) <> 'string')
      or p_payload->>'owner_id' !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
      or p_payload->>'due_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Invalid assignment' using errcode = '22023';
    end if;
    v_owner := (p_payload->>'owner_id')::uuid;
    begin v_due := (p_payload->>'due_date')::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception 'Invalid due date' using errcode = '22023'; end;
    if v_due < current_date then raise exception 'The due date is in the past' using errcode = '22023'; end if;
    if not exists (select 1 from public.user_organizations
      where user_id = v_owner and org_code = p_payload->>'owner_org' and status = 'approved') then
      raise exception 'Approved owner required' using errcode = '42501'; end if;
    v_case.owner_id := v_owner; v_case.owner_org := p_payload->>'owner_org'; v_case.due_date := v_due; v_case.state := 'assigned';
  elsif p_action = 'start' then
    if p_payload <> '{}'::jsonb or v_case.state <> 'assigned'
      or not exists (select 1 from public.user_organizations
        where user_id = v_case.owner_id and org_code = v_case.owner_org and status = 'approved') then
      raise exception 'An approved assignment is required before review' using errcode = '22023'; end if;
    v_case.state := 'in_review';
  elsif p_action = 'record_decision' then
    if v_case.state not in ('in_review', 'decision_recorded')
      or (p_payload - array['decision','note']) <> '{}'::jsonb
      or jsonb_typeof(p_payload->'decision') is distinct from 'string'
      or coalesce(p_payload->>'decision', '') not in ('action_planned','no_action_justified','data_to_verify','already_addressed')
      or jsonb_typeof(p_payload->'note') is distinct from 'string'
      or length(public.finding_trim(coalesce(p_payload->>'note', ''))) not between 1 and 2400 then
      raise exception 'Invalid finding decision' using errcode = '22023'; end if;
    v_case.decision := p_payload->>'decision'; v_case.decision_note := public.finding_trim(p_payload->>'note');
    v_case.decision_revision := v_case.revision + 1; v_case.state := 'decision_recorded';
  elsif p_action = 'close' then
    if (p_payload - array['outcome']) <> '{}'::jsonb
      or jsonb_typeof(p_payload->'outcome') is distinct from 'string'
      or length(public.finding_trim(coalesce(p_payload->>'outcome', ''))) not between 1 and 2400 then
      raise exception 'An outcome is required to close a case' using errcode = '22023'; end if;
    if v_case.state <> 'decision_recorded' or v_case.decision_revision < v_case.cycle_start_revision then
      raise exception 'A decision recorded in this cycle is required before closing' using errcode = '22023'; end if;
    v_case.outcome := public.finding_trim(p_payload->>'outcome'); v_case.state := 'closed'; v_case.closed_at := v_now;
  elsif p_action = 'reopen' then
    if v_case.state <> 'closed' or (p_payload - array['note']) <> '{}'::jsonb
      or jsonb_typeof(p_payload->'note') is distinct from 'string'
      or length(public.finding_trim(coalesce(p_payload->>'note', ''))) not between 1 and 2400 then
      raise exception 'A reason is required to reopen a closed case' using errcode = '22023'; end if;
    -- The earlier decision and outcome stay in the events; this cycle needs its own.
    v_case.state := 'in_review'; v_case.closed_at := null; v_case.outcome := null;
    v_case.cycle_start_revision := v_case.revision + 1;
  else
    raise exception 'Unknown finding operation' using errcode = '22023';
  end if;

  v_case.revision := v_case.revision + 1; v_case.updated_at := v_now; v_case.updated_by := p_actor;
  update public.finding_cases set
    state = v_case.state, revision = v_case.revision, cycle_start_revision = v_case.cycle_start_revision,
    owner_id = v_case.owner_id, owner_org = v_case.owner_org, due_date = v_case.due_date,
    decision = v_case.decision, decision_note = v_case.decision_note, decision_revision = v_case.decision_revision,
    outcome = v_case.outcome, updated_by = v_case.updated_by, updated_at = v_case.updated_at, closed_at = v_case.closed_at
    where id = p_case;
  select coalesce(jsonb_object_agg(kv.key, case when kv.key in ('note', 'outcome') and jsonb_typeof(kv.value) = 'string'
      then to_jsonb(public.finding_trim(kv.value #>> '{}')) else kv.value end), '{}'::jsonb)
    into v_payload from jsonb_each(p_payload) as kv;
  insert into public.finding_events(case_id, revision, action, actor_id, detail, created_at)
    values(p_case, v_case.revision, p_action, p_actor, jsonb_build_object('payload', v_payload, 'before', v_before, 'after', to_jsonb(v_case)), v_now);
  return to_jsonb(v_case);
end;
$$;

-- Claims the overdue reminder for the case's current owner and due date. True
-- when this call claimed it (send the email), false when it was already sent or
-- the case is no longer overdue with that owner.
create or replace function public.finding_reminder_claim(p_case uuid, p_due date, p_owner uuid)
returns boolean language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.finding_cases
    where id = p_case and owner_id = p_owner and due_date = p_due and due_date < current_date
      and state in ('assigned', 'in_review', 'decision_recorded')
  ) then return false; end if;
  insert into public.finding_reminders(case_id, due_date, owner_id) values(p_case, p_due, p_owner)
    on conflict do nothing;
  return found;
end;
$$;

revoke all on function public.finding_case_create(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.finding_case_mutate(uuid,uuid,integer,text,jsonb) from public, anon, authenticated;
revoke all on function public.finding_reminder_claim(uuid,date,uuid) from public, anon, authenticated;
grant execute on function public.finding_case_create(uuid,jsonb) to service_role;
grant execute on function public.finding_case_mutate(uuid,uuid,integer,text,jsonb) to service_role;
grant execute on function public.finding_reminder_claim(uuid,date,uuid) to service_role;

comment on table public.finding_cases is 'Action loop for biosimilar and benchmark findings. No authenticated grants; the server checks reviewer, admin and owner rights before every service call.';
comment on table public.finding_events is 'Append only history of finding cases, including superseded decisions and outcomes.';
comment on table public.finding_reminders is 'Append only record of the overdue reminders sent, one per case, due date and owner.';

commit;
