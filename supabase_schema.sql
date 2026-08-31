-- VIS PHARMA COMPASS — Supabase schema
-- Generated from Master_Database.xlsx > Canonical_Data_Template, 21 Aug 2026.
-- Run this in the Supabase SQL editor (or via `supabase db push`) BEFORE running
-- the data-loading script. Requires your own Supabase project — no credentials
-- are embedded here.

-- ============================================================
-- 1. Canonical fact table — one row per observed expenditure/consumption fact
-- ============================================================
create table if not exists canonical_fact (
  id                    bigint generated always as identity primary key,
  source_record_id      text not null,
  source_version_id     text not null,
  year                  int not null,
  month                 int,
  region_code           text,
  region_name           text,
  asl_code              text,
  channel               text,
  aic                   text,               -- 9-digit, kept as text to preserve leading zeros
  atc1                  text,
  atc2                  text,
  atc3                  text,
  atc4                  text,
  atc5                  text,
  product_description_raw text,
  brand_name            text,
  active_substance      text,
  quantity_packs        numeric,
  total_cost_eur        numeric,
  biosimilar_flag       boolean,
  originator_flag       boolean,
  units_per_pack        numeric,
  strength_value_mg     numeric,
  volume_per_unit_ml    numeric,
  ddd_value_mg          numeric,
  unit_cost_eur         numeric,             -- computed: total_cost_eur / quantity_packs
  total_content_mg      numeric,             -- computed per Section 3 formulas
  ddds_per_pack          numeric,             -- computed: total_content_mg / ddd_value_mg
  cost_per_mg           numeric,             -- computed: unit_cost_eur / total_content_mg
  cost_per_ddd          numeric,             -- computed: unit_cost_eur / ddds_per_pack
  mapping_confidence    text check (mapping_confidence in ('Authoritative','Validated','Candidate','Unresolved')),
  quality_status        text,
  created_at            timestamptz default now(),
  unique (source_record_id, source_version_id)
);

create index if not exists idx_canonical_fact_aic on canonical_fact (aic);
create index if not exists idx_canonical_fact_region_year_month on canonical_fact (region_code, year, month);
create index if not exists idx_canonical_fact_atc4 on canonical_fact (atc4);

-- ============================================================
-- 2. Reference tables — one per verified source in Source_Catalog
-- ============================================================

-- S05/S06 — AIFA product + ingredient master (drive.aifa.gov.it)
create table if not exists aifa_product_master (
  aic               text primary key,
  cod_farmaco       text,
  cod_confezione    text,
  denominazione     text,
  descrizione       text,
  codice_ditta      text,
  ragione_sociale   text,
  stato_amministrativo text,
  tipo_procedura    text,
  forma             text,
  codice_atc        text,
  pa_associati      text,
  fornitura         text,
  updated_at        timestamptz default now()
);

create table if not exists aifa_ingredient_master (
  id                bigint generated always as identity primary key,
  aic               text not null,
  principio_attivo  text,
  quantita          numeric,
  unita_misura      text,
  updated_at        timestamptz default now()
);
create index if not exists idx_aifa_ingredient_aic on aifa_ingredient_master (aic);

-- S17 — AIFA shortage list (verified live 21 Aug 2026)
create table if not exists aifa_shortage_list (
  id                bigint generated always as identity primary key,
  nome_medicinale   text,
  aic               text,
  principio_attivo  text,
  forma_dosaggio    text,
  titolare_aic      text,
  data_inizio       date,
  fine_presunta     date,
  equivalente       text,
  motivazioni       text,
  suggerimenti      text,
  nota_aifa         text,
  classe_rimborso   text,
  codice_atc        text,
  file_updated_date date,        -- the date stated INSIDE the source file, not our fetch date
  loaded_at         timestamptz default now()
);
create index if not exists idx_aifa_shortage_aic on aifa_shortage_list (aic);

-- Resolved M2 normalization output (our own parser result)
create table if not exists aic_normalization_resolved (
  aic                     text primary key,
  description             text,
  spend_eur               numeric,
  resolved                boolean,
  confidence              text,
  method                  text,
  unresolved_category     text,   -- oxygen_gas / multi_active_combo / single_dose_device_ambiguous / other / null
  units                   numeric,
  content_per_unit_mg     numeric,
  total_content_mg        numeric,
  source_note             text,
  loaded_at               timestamptz default now()
);

-- ============================================================
-- 3. Tenancy — organizations, memberships, objectives, feature requests, uploads
-- ============================================================
create table if not exists organizations (
  org_code      text primary key,
  org_name      text not null,
  org_type      text not null check (org_type in ('asl','regione')),
  region_code   text,
  created_at    timestamptz default now()
);

create table if not exists user_organizations (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  org_code      text not null references organizations(org_code),
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at  timestamptz default now(),
  approved_at   timestamptz,
  approved_by   uuid references auth.users(id),
  unique (user_id, org_code)
);

create table if not exists objectives (
  id              bigint generated always as identity primary key,
  region_code     text not null,
  metric          text not null,
  atc_scope       text,
  target_value    numeric not null,
  period_start    date not null,
  period_end      date not null,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);

create table if not exists feature_requests (
  id              bigint generated always as identity primary key,
  submitted_by    uuid not null references auth.users(id),
  org_code        text references organizations(org_code),
  description     text not null,
  decision_impact text,
  frequency       text,
  status          text not null default 'pending' check (status in ('pending','answered','declined')),
  response        text,
  responded_by    uuid references auth.users(id),
  responded_at    timestamptz,
  created_at      timestamptz default now()
);

create table if not exists uploads (
  id                     bigint generated always as identity primary key,
  org_code               text not null references organizations(org_code),
  uploaded_by            uuid not null references auth.users(id),
  file_name              text not null,
  storage_path           text not null,
  period_covered_start   date,
  period_covered_end     date,
  status                 text not null default 'uploaded' check (status in ('uploaded','processing','reconciled','discrepancy_found')),
  reconciliation_summary jsonb,
  uploaded_at            timestamptz default now(),
  reconciled_at          timestamptz
);

-- ============================================================
-- 4. Row Level Security — scoped per organization membership
-- ============================================================
drop policy if exists "authenticated read" on canonical_fact;

alter table organizations enable row level security;
create policy "read org list" on organizations for select
  using (auth.role() = 'authenticated');

alter table user_organizations enable row level security;
create policy "read own memberships" on user_organizations for select
  using (user_id = auth.uid());
create policy "request own membership" on user_organizations for insert
  with check (user_id = auth.uid());

alter table canonical_fact enable row level security;
create policy "read approved orgs' facts" on canonical_fact for select
  using (exists (
    select 1 from user_organizations uo
    join organizations o on o.org_code = uo.org_code
    where uo.user_id = auth.uid() and uo.status = 'approved'
      and (
        (o.org_type = 'asl' and o.org_code = canonical_fact.asl_code)
        or (o.org_type = 'regione' and o.region_code = canonical_fact.region_code)
      )
  ));

alter table objectives enable row level security;
create policy "read objectives in scope" on objectives for select
  using (exists (
    select 1 from user_organizations uo
    join organizations o on o.org_code = uo.org_code
    where uo.user_id = auth.uid() and uo.status = 'approved'
      and o.region_code = objectives.region_code
  ));

alter table feature_requests enable row level security;
create policy "read own requests" on feature_requests for select
  using (submitted_by = auth.uid());
create policy "submit own requests" on feature_requests for insert
  with check (submitted_by = auth.uid());

alter table uploads enable row level security;
create policy "read own org uploads" on uploads for select
  using (exists (
    select 1 from user_organizations uo
    where uo.user_id = auth.uid() and uo.status = 'approved' and uo.org_code = uploads.org_code
  ));
create policy "upload for own approved org" on uploads for insert
  with check (exists (
    select 1 from user_organizations uo
    where uo.user_id = auth.uid() and uo.status = 'approved' and uo.org_code = uploads.org_code
  ));

-- ============================================================
-- 5. Fix INSERT policies to prevent client-side status escalation
-- (approval/response/reconciliation must happen via the service-role
-- key — same key load_to_supabase.mjs uses — not through a logged-in
-- user's own insert. No admin UI for this exists yet; until it does,
-- flip these values directly in the Supabase dashboard.)
-- ============================================================
drop policy if exists "request own membership" on user_organizations;
create policy "request own membership" on user_organizations for insert
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "submit own requests" on feature_requests;
create policy "submit own requests" on feature_requests for insert
  with check (
    submitted_by = auth.uid()
    and status = 'pending'
    and response is null
    and responded_by is null
    and responded_at is null
  );

drop policy if exists "upload for own approved org" on uploads;
create policy "upload for own approved org" on uploads for insert
  with check (
    exists (select 1 from user_organizations uo
            where uo.user_id = auth.uid() and uo.status = 'approved'
              and uo.org_code = uploads.org_code)
    and status = 'uploaded'
    and reconciliation_summary is null
    and reconciled_at is null
  );

-- ============================================================
-- 6. Anonymized cross-ASL objective ranking
--
-- "You're 3rd" without exposing who's 1st and 2nd can't be done with a
-- plain RLS-scoped select — an ASL-scoped caller's RLS never grants it
-- other ASLs' identity, by design. This SECURITY DEFINER function derives
-- the caller's own org purely from auth.uid() (never from p_metric or any
-- other client input), computes the rank internally across every ASL in
-- that org's region, and returns only the caller's own row.
--
-- Metric coverage: only objectives with a non-null atc_scope have a
-- confirmed formula here — biosimilar spend share within that ATC scope,
-- for the objective's own period. Metrics without an atc_scope (e.g.
-- "Spesa diretta su FSN", "Giorni di copertura scorte critiche") have no
-- agreed formula derivable from canonical_fact alone; rather than invent
-- one, the function returns zero rows for them so the caller can render
-- "ranking not available for this metric" instead of a fabricated number.
-- If/when those formulas are confirmed, extend the branch below — don't
-- guess at them here.
-- ============================================================
create or replace function my_objective_rank(p_metric text)
returns table(
  my_org_code text,
  my_value numeric,
  my_rank int,
  total_orgs int,
  target_value numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_org_code text;
  v_caller_region_code text;
  v_atc_scope text;
  v_target_value numeric;
  v_period_start date;
  v_period_end date;
begin
  -- Derive the caller's own ASL membership purely from auth.uid() — never
  -- from a client parameter. Only an ASL has its own spend row to rank; a
  -- regione-type caller isn't itself one of the ranked entities.
  select o.org_code, o.region_code
    into v_caller_org_code, v_caller_region_code
  from user_organizations uo
  join organizations o on o.org_code = uo.org_code
  where uo.user_id = auth.uid()
    and uo.status = 'approved'
    and o.org_type = 'asl'
  order by uo.approved_at asc nulls last
  limit 1;

  if v_caller_org_code is null then
    return; -- no approved ASL membership: nothing to rank
  end if;

  select ob.atc_scope, ob.target_value, ob.period_start, ob.period_end
    into v_atc_scope, v_target_value, v_period_start, v_period_end
  from objectives ob
  where ob.region_code = v_caller_region_code
    and ob.metric = p_metric
  order by ob.period_start desc
  limit 1;

  if v_atc_scope is null then
    return; -- objective not found, or found but has no confirmed formula
  end if;

  return query
  with per_asl as (
    select
      o.org_code as asl_org_code,
      coalesce(sum(cf.total_cost_eur) filter (where cf.biosimilar_flag), 0) as bio_spend,
      coalesce(sum(cf.total_cost_eur), 0) as total_spend
    from organizations o
    left join canonical_fact cf
      on cf.asl_code = o.org_code
     and (cf.atc5 = v_atc_scope or cf.atc4 = v_atc_scope)
     and (cf.year * 12 + coalesce(cf.month, 1)) between
         (extract(year from v_period_start)::int * 12 + extract(month from v_period_start)::int)
         and (extract(year from v_period_end)::int * 12 + extract(month from v_period_end)::int)
    where o.org_type = 'asl'
      and o.region_code = v_caller_region_code
    group by o.org_code
  ),
  ranked as (
    select
      asl_org_code,
      case when total_spend = 0 then 0 else bio_spend / total_spend end as value,
      rank() over (order by
        case when total_spend = 0 then 0 else bio_spend / total_spend end desc
      ) as rnk,
      count(*) over () as n
    from per_asl
  )
  select asl_org_code, value, rnk::int, n::int, v_target_value
  from ranked
  where asl_org_code = v_caller_org_code;
end;
$$;

revoke all on function my_objective_rank(text) from public;
grant execute on function my_objective_rank(text) to authenticated;

-- ============================================================
-- 7. Storage — the "uploads" bucket backing the dati module
--
-- Objects are stored at "<org_code>/<file>" so the same org-membership
-- predicate already used by the uploads table's own RLS (see section 4)
-- can be applied to the path's first segment. storage.objects already
-- has RLS enabled by default on every Supabase project — only the bucket
-- and policies need to be declared here.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

drop policy if exists "upload to own approved org folder" on storage.objects;
create policy "upload to own approved org folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and exists (
      select 1 from user_organizations uo
      where uo.user_id = auth.uid() and uo.status = 'approved'
        and uo.org_code = (storage.foldername(name))[1]
    )
  );

drop policy if exists "read own approved org folder" on storage.objects;
create policy "read own approved org folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'uploads'
    and exists (
      select 1 from user_organizations uo
      where uo.user_id = auth.uid() and uo.status = 'approved'
        and uo.org_code = (storage.foldername(name))[1]
    )
  );

-- ============================================================
-- 8. Antibiotic stewardship (AWaRe) consumption fact
--
-- One row per org x unit x AWaRe category x year. unit_code is null for
-- ASL-level rows (loaded now); department-level (UU.OO.) rows will carry
-- a real unit_code once the department-name legend is confirmed — see
-- load_antibiotic_consumption.mjs for why those aren't loaded yet.
--
-- RLS reuses the exact org-scoping predicate already proven on
-- canonical_fact: an asl-type caller sees only its own org_code; a
-- regione-type caller sees every org sharing its region_code.
-- ============================================================
create table if not exists antibiotic_consumption_fact (
  id             bigint generated always as identity primary key,
  org_code       text not null references organizations(org_code),
  unit_code      text,              -- hospital dept code (AL/DC/DM/EM/PN/PO/TI),
                                     -- null when the row is ASL-level, not dept-level
  aware_category text not null check (aware_category in ('A','W','R','T')),
  year           int not null,
  cost_eur       numeric,
  ddd_count      numeric,
  bed_days       numeric,           -- denominator for DDD/100 bed-days
  source_note    text,              -- e.g. "OSMED methodology, Flusso Traccia/NSIS CO"
  loaded_at      timestamptz default now(),
  unique (org_code, unit_code, aware_category, year)
);

-- The table-level unique(...) above does NOT dedupe ASL-level rows: SQL
-- unique constraints treat NULL as distinct from NULL, and unit_code is
-- always null for the ASL-level rows loaded by
-- load_antibiotic_consumption.mjs (verified: two rows with identical
-- org_code/aware_category/year and unit_code null both insert cleanly
-- without this index). This partial index closes that gap without
-- touching the constraint above, which still applies as-is once
-- department-level rows (non-null unit_code) are loaded.
create unique index if not exists antibiotic_consumption_fact_asl_level_uniq
  on antibiotic_consumption_fact (org_code, aware_category, year)
  where unit_code is null;

alter table antibiotic_consumption_fact enable row level security;
create policy "read approved orgs' antibiotic data" on antibiotic_consumption_fact
  for select using (exists (
    select 1 from user_organizations uo
    join organizations o on o.org_code = uo.org_code
    where uo.user_id = auth.uid() and uo.status = 'approved'
      and (
        (o.org_type = 'asl' and o.org_code = antibiotic_consumption_fact.org_code)
        or (o.org_type = 'regione' and o.region_code = (
              select region_code from organizations where org_code = antibiotic_consumption_fact.org_code))
      )
  ));
