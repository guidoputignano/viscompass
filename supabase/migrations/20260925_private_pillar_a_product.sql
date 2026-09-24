-- Product-grain private Pillar A facts.
--
-- The 20260923 table stores org x year x AWaRe aggregates, which cannot answer
-- "which products carry the spend" or "how did this molecule move". This adds the
-- product grain the ABC and ATC5 views need. It does not replace the aggregate
-- table: that one is the reconciliation target, and this one must sum to it.
--
-- Verified against private-staging/closure/product-analysis.json before writing:
--   1,316 rows, 238 distinct AIC, 64 distinct ATC5, 4 org codes, 2023-2025
--   (year, org, aic) is unique; no nulls, no non-finite values, no negatives
--   product CF/CN/CMR/DDD sum to the aggregate 'T' row exactly (0.00 EUR)
--
-- Two properties of this data drive the schema:
--
--   * All 238 AIC begin with '0'. Numeric coercion would corrupt every key, not
--     merely an edge case, so aic is text with a 9-digit check and is never
--     compared to a number.
--   * ATC5 does not determine the AWaRe class. J01XX01 fosfomicina is Watch as
--     oral packs and Reserve as IV packs, in every org-year. So aware_category
--     belongs on the product row, and an ATC5 rollup must not carry one.
begin;

create table public.pillar_a_private_product_fact (
  release_id text not null,
  org_code text not null references public.organizations(org_code),
  year integer not null check (year between 2023 and 2025),
  aic text not null check (aic ~ '^[0-9]{9}$'),
  atc5 text not null check (atc5 ~ '^[A-Z][0-9]{2}[A-Z]{2}[0-9]{2}$'),
  -- No 'T' at product grain: the total is a sum, never a stored row.
  aware_category text not null check (aware_category in ('A','W','R')),
  product_name text not null check (length(btrim(product_name)) > 0),
  qmr numeric not null check (qmr > 0 and qmr <> 'NaN'::numeric),
  ddd_aic numeric not null check (ddd_aic > 0 and ddd_aic <> 'NaN'::numeric),
  cf numeric not null check (cf > 0 and cf <> 'NaN'::numeric),
  -- CN has no definition in any supplied source. It is carried so the release is
  -- complete and reproducible, and is deliberately not surfaced or labelled
  -- anywhere until the Region defines it. Do not present it as a cost basis.
  cn numeric not null check (cn > 0 and cn <> 'NaN'::numeric),
  cmr numeric not null check (cmr > 0 and cmr <> 'NaN'::numeric),
  ddd numeric not null check (ddd > 0 and ddd <> 'NaN'::numeric),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  loaded_at timestamptz not null default now(),
  primary key (release_id, org_code, year, aic),
  -- DDD = QMR x DDD_AIC holds exactly on all 1,316 source rows, so it is a
  -- constraint rather than a convention a later loader could quietly break.
  constraint product_ddd_is_derived check (abs(ddd - qmr * ddd_aic) < 0.000001)
);

alter table public.pillar_a_private_product_fact enable row level security;
alter table public.pillar_a_private_product_fact force row level security;
revoke all on public.pillar_a_private_product_fact from anon, authenticated;
grant select on public.pillar_a_private_product_fact to authenticated;
grant all on public.pillar_a_private_product_fact to service_role;

-- Same perimeter rule as the aggregate table: an ASL sees itself, a regione sees
-- the ASLs in its own region_code, and nobody sees anything else. Deriving the
-- caller's organization from auth.uid() rather than from a parameter is what
-- makes this safe; do not reimplement it by filtering in the application.
create policy "approved organization private product read"
on public.pillar_a_private_product_fact for select to authenticated
using (exists (
  select 1 from public.user_organizations uo
  join public.organizations o on o.org_code = uo.org_code
  where uo.user_id = auth.uid() and uo.status = 'approved' and (
    (o.org_type = 'asl' and o.org_code = pillar_a_private_product_fact.org_code)
    or (o.org_type = 'regione' and exists (
      select 1 from public.organizations target
      where target.org_code = pillar_a_private_product_fact.org_code
        and target.org_type = 'asl'
        and target.region_code = o.region_code
    ))
  )
));

create index pillar_a_private_product_scope
  on public.pillar_a_private_product_fact (release_id, org_code, year);
create index pillar_a_private_product_molecule
  on public.pillar_a_private_product_fact (release_id, org_code, atc5, year);

commit;
