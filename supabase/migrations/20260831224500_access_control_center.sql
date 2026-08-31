-- VIS PHARMA COMPASS — organization access lifecycle
-- Apply this migration before deploying the Control Center application code.

begin;

alter table public.user_organizations
  add column if not exists requested_role text,
  add column if not exists request_message text,
  add column if not exists decision_note text,
  add column if not exists decided_at timestamptz,
  add column if not exists revoked_at timestamptz;

alter table public.user_organizations
  drop constraint if exists user_organizations_status_check;

alter table public.user_organizations
  add constraint user_organizations_status_check
  check (status in ('pending', 'approved', 'rejected', 'revoked'));

-- The current UI renders one organizational scope at a time. Enforce that
-- invariant in the database as well as in the application.
create unique index if not exists user_organizations_one_approved_per_user
  on public.user_organizations (user_id)
  where status = 'approved';

create table if not exists public.organization_invitations (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  org_code          text not null references public.organizations(org_code),
  invited_role      text,
  invitation_note   text,
  status            text not null default 'pending'
                    check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  delivery_status   text not null default 'pending'
                    check (delivery_status in ('pending', 'email_sent', 'in_app', 'failed')),
  delivery_error    text,
  invited_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default (now() + interval '7 days'),
  responded_at      timestamptz,
  accepted_by       uuid references auth.users(id)
);

create unique index if not exists organization_invitations_one_pending_per_email_org
  on public.organization_invitations (lower(email), org_code)
  where status = 'pending';

create index if not exists organization_invitations_recipient_idx
  on public.organization_invitations (lower(email), status, expires_at);

alter table public.organization_invitations enable row level security;

drop policy if exists "read invitations addressed to own email" on public.organization_invitations;
create policy "read invitations addressed to own email"
  on public.organization_invitations for select to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Applications are created through a narrowly-scoped function so a caller
-- can never submit an approved status or another user's UUID.
create or replace function public.request_organization_membership(
  p_org_code text,
  p_requested_role text default null,
  p_request_message text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership_id bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.organizations where org_code = p_org_code) then
    raise exception 'Unknown organization';
  end if;

  if length(coalesce(trim(p_requested_role), '')) > 120 then
    raise exception 'Requested role is too long';
  end if;

  if length(coalesce(trim(p_request_message), '')) > 1200 then
    raise exception 'Request message is too long';
  end if;

  insert into public.user_organizations (
    user_id,
    org_code,
    status,
    requested_at,
    requested_role,
    request_message,
    approved_at,
    approved_by,
    decision_note,
    decided_at,
    revoked_at
  )
  values (
    v_user_id,
    p_org_code,
    'pending',
    now(),
    nullif(trim(p_requested_role), ''),
    nullif(trim(p_request_message), ''),
    null,
    null,
    null,
    null,
    null
  )
  on conflict (user_id, org_code) do update
    set status = 'pending',
        requested_at = now(),
        requested_role = excluded.requested_role,
        request_message = excluded.request_message,
        approved_at = null,
        approved_by = null,
        decision_note = null,
        decided_at = null,
        revoked_at = null
    where user_organizations.status in ('pending', 'rejected', 'revoked')
  returning id into v_membership_id;

  if v_membership_id is null then
    raise exception 'This organization membership is already approved';
  end if;

  return v_membership_id;
end;
$$;

create or replace function public.accept_organization_invitation(
  p_invitation_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invitation public.organization_invitations%rowtype;
begin
  if v_user_id is null or v_email = '' then
    raise exception 'Authentication required';
  end if;

  select * into v_invitation
  from public.organization_invitations
  where id = p_invitation_id
    and lower(email) = v_email
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invitation.expires_at <= now() then
    update public.organization_invitations
      set status = 'expired', responded_at = now()
      where id = p_invitation_id;
    return '__expired__';
  end if;

  if exists (
    select 1 from public.user_organizations
    where user_id = v_user_id
      and status = 'approved'
      and org_code <> v_invitation.org_code
  ) then
    raise exception 'An approved membership already exists for another organization';
  end if;

  insert into public.user_organizations (
    user_id,
    org_code,
    status,
    requested_at,
    requested_role,
    request_message,
    approved_at,
    approved_by,
    decision_note,
    decided_at,
    revoked_at
  )
  values (
    v_user_id,
    v_invitation.org_code,
    'approved',
    v_invitation.created_at,
    v_invitation.invited_role,
    v_invitation.invitation_note,
    now(),
    v_invitation.invited_by,
    'Accesso accettato tramite invito',
    now(),
    null
  )
  on conflict (user_id, org_code) do update
    set status = 'approved',
        requested_role = excluded.requested_role,
        request_message = excluded.request_message,
        approved_at = now(),
        approved_by = v_invitation.invited_by,
        decision_note = 'Accesso accettato tramite invito',
        decided_at = now(),
        revoked_at = null;

  update public.organization_invitations
    set status = 'accepted',
        responded_at = now(),
        accepted_by = v_user_id
    where id = p_invitation_id;

  return v_invitation.org_code;
end;
$$;

create or replace function public.decline_organization_invitation(
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Authentication required';
  end if;

  update public.organization_invitations
    set status = 'declined', responded_at = now()
    where id = p_invitation_id
      and lower(email) = v_email
      and status = 'pending';

  if not found then
    raise exception 'Invitation not found';
  end if;
end;
$$;

-- Admin mutations are transactional RPCs. The application invokes them
-- only with the server-held service-role key after checking ADMIN_EMAILS.
create or replace function public.admin_decide_organization_membership(
  p_membership_id bigint,
  p_outcome text,
  p_admin_id uuid,
  p_decision_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.user_organizations%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_outcome not in ('approved', 'rejected') then raise exception 'Invalid outcome'; end if;

  select * into v_membership from public.user_organizations
  where id = p_membership_id and status = 'pending'
  for update;
  if not found then raise exception 'Pending membership not found'; end if;

  if p_outcome = 'approved' and exists (
    select 1 from public.user_organizations
    where user_id = v_membership.user_id and status = 'approved' and id <> p_membership_id
  ) then
    raise exception 'User already has an approved organization';
  end if;

  update public.user_organizations
  set status = p_outcome,
      approved_at = case when p_outcome = 'approved' then now() else null end,
      approved_by = case when p_outcome = 'approved' then p_admin_id else null end,
      decided_at = now(),
      decision_note = nullif(trim(p_decision_note), ''),
      revoked_at = null
  where id = p_membership_id;

  if p_outcome = 'approved' then
    update public.user_organizations
    set status = 'rejected',
        decided_at = now(),
        decision_note = 'Sostituita da un altro accesso approvato'
    where user_id = v_membership.user_id
      and status = 'pending'
      and id <> p_membership_id;
  end if;

  return p_outcome;
end;
$$;

create or replace function public.admin_revoke_organization_membership(
  p_membership_id bigint,
  p_admin_id uuid,
  p_decision_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;

  update public.user_organizations
  set status = 'revoked',
      approved_at = null,
      approved_by = p_admin_id,
      decided_at = now(),
      decision_note = coalesce(nullif(trim(p_decision_note), ''), 'Accesso revocato'),
      revoked_at = now()
  where id = p_membership_id and status = 'approved';

  if not found then raise exception 'Approved membership not found'; end if;
end;
$$;

revoke all on function public.request_organization_membership(text, text, text) from public;
revoke all on function public.accept_organization_invitation(uuid) from public;
revoke all on function public.decline_organization_invitation(uuid) from public;
revoke all on function public.admin_decide_organization_membership(bigint, text, uuid, text) from public;
revoke all on function public.admin_revoke_organization_membership(bigint, uuid, text) from public;

grant execute on function public.request_organization_membership(text, text, text) to authenticated;
grant execute on function public.accept_organization_invitation(uuid) to authenticated;
grant execute on function public.decline_organization_invitation(uuid) to authenticated;
grant execute on function public.admin_decide_organization_membership(bigint, text, uuid, text) to service_role;
grant execute on function public.admin_revoke_organization_membership(bigint, uuid, text) to service_role;

commit;
