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
