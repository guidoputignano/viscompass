-- VIS PHARMA COMPASS — AWaRe analytics enrichment and communication consent audit

begin;

create table if not exists public.communication_consents (
  user_id                          uuid primary key references auth.users(id) on delete cascade,
  email                            text not null,
  vis_newsletter_opt_in            boolean not null default false,
  vis_newsletter_consented_at      timestamptz,
  partner_newsletter_opt_in        boolean not null default false,
  partner_newsletter_consented_at  timestamptz,
  consent_version                  text not null,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now(),
  check (vis_newsletter_opt_in = (vis_newsletter_consented_at is not null)),
  check (partner_newsletter_opt_in = (partner_newsletter_consented_at is not null))
);

alter table public.communication_consents enable row level security;

drop policy if exists "read own communication consent" on public.communication_consents;
create policy "read own communication consent"
  on public.communication_consents for select to authenticated
  using (user_id = auth.uid());

grant select on public.communication_consents to authenticated;

create table if not exists public.antibiotic_consumption_fact (
  id             bigint generated always as identity primary key,
  org_code       text not null references public.organizations(org_code),
  unit_code      text,
  aware_category text not null check (aware_category in ('A','W','R','T')),
  year           int not null,
  cost_eur       numeric,
  ddd_count      numeric,
  bed_days       numeric,
  population     numeric,
  unit_name      text,
  period_status  text check (period_status in ('complete','provisional')),
  source_note    text,
  loaded_at      timestamptz default now(),
  unique (org_code, unit_code, aware_category, year)
);

alter table public.antibiotic_consumption_fact
  add column if not exists population numeric,
  add column if not exists unit_name text,
  add column if not exists period_status text;

alter table public.antibiotic_consumption_fact
  drop constraint if exists antibiotic_consumption_fact_period_status_check;

alter table public.antibiotic_consumption_fact
  add constraint antibiotic_consumption_fact_period_status_check
  check (period_status in ('complete','provisional'));

create unique index if not exists antibiotic_consumption_fact_asl_level_uniq
  on public.antibiotic_consumption_fact (org_code, aware_category, year)
  where unit_code is null;

alter table public.antibiotic_consumption_fact enable row level security;

drop policy if exists "read approved orgs' antibiotic data" on public.antibiotic_consumption_fact;
create policy "read approved orgs' antibiotic data"
  on public.antibiotic_consumption_fact for select to authenticated
  using (exists (
    select 1
    from public.user_organizations uo
    join public.organizations caller_org on caller_org.org_code = uo.org_code
    join public.organizations row_org on row_org.org_code = antibiotic_consumption_fact.org_code
    where uo.user_id = auth.uid()
      and uo.status = 'approved'
      and (
        (caller_org.org_type = 'asl' and caller_org.org_code = antibiotic_consumption_fact.org_code)
        or (caller_org.org_type = 'regione' and caller_org.region_code = row_org.region_code)
      )
  ));

grant select on public.antibiotic_consumption_fact to authenticated;

commit;
