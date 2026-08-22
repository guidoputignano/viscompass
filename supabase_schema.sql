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
-- 3. Row Level Security — enable and scope per role as tenancy is built
-- (Left permissive for initial load; tighten before any external access.)
-- ============================================================
alter table canonical_fact enable row level security;
create policy "authenticated read" on canonical_fact for select using (auth.role() = 'authenticated');
