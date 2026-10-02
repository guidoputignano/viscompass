-- The live review issues year- and release-scoped reads under canonical_fact
-- RLS. The legacy indexes cover region/year and release separately, causing
-- concurrent RPCs to scan/filter the same 261k-row ledger repeatedly.
create index if not exists idx_canonical_fact_release_year_asl
  on public.canonical_fact (source_version_id, year, asl_code);

analyze public.canonical_fact;
