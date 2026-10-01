-- The login organisation uses the local ASL code (201), while the frozen
-- dispensing ledger uses the Ministry composite code (130201).  Keep the
-- comparison region-bound: a local code alone must never grant cross-region
-- access.  Existing exact-code memberships remain valid.
drop policy if exists "read approved orgs' facts" on public.canonical_fact;

create policy "read approved orgs' facts" on public.canonical_fact
  for select to authenticated
  using (exists (
    select 1
    from public.user_organizations uo
    join public.organizations o on o.org_code = uo.org_code
    where uo.user_id = auth.uid()
      and uo.status = 'approved'
      and (
        (o.org_type = 'asl'
          and o.region_code = canonical_fact.region_code
          and canonical_fact.asl_code in (o.org_code, o.region_code || o.org_code))
        or (o.org_type = 'regione'
          and o.region_code = canonical_fact.region_code)
      )
  ));
