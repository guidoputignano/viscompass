-- Versioned private aggregates; preserves the previous workbook table.
begin;
create table public.pillar_a_private_fact (
  release_id text not null,
  org_code text not null references public.organizations(org_code),
  year integer not null check (year between 2023 and 2025),
  aware_category text not null check (aware_category in ('A','W','R','T')),
  cf numeric not null check (cf >= 0 and cf <> 'NaN'::numeric),
  cmr numeric not null check (cmr >= 0 and cmr <> 'NaN'::numeric),
  ddd numeric not null check (ddd >= 0 and ddd <> 'NaN'::numeric),
  activity numeric not null check (activity > 0 and activity <> 'NaN'::numeric),
  activity_variant text not null check (activity_variant = 'A3/T1'),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  loaded_at timestamptz not null default now(),
  primary key (release_id, org_code, year, aware_category)
);
alter table public.pillar_a_private_fact enable row level security;
alter table public.pillar_a_private_fact force row level security;
revoke all on public.pillar_a_private_fact from anon, authenticated;
grant select on public.pillar_a_private_fact to authenticated;
grant all on public.pillar_a_private_fact to service_role;
create policy "approved organization private workbook read"
on public.pillar_a_private_fact for select to authenticated
using (exists (
  select 1 from public.user_organizations uo
  join public.organizations o on o.org_code=uo.org_code
  where uo.user_id=auth.uid() and uo.status='approved' and (
    (o.org_type='asl' and o.org_code=pillar_a_private_fact.org_code)
    or (o.org_type='regione' and exists (
      select 1 from public.organizations target
      where target.org_code=pillar_a_private_fact.org_code
        and target.region_code=o.region_code and target.org_type='asl'
    ))
  )
));
commit;
