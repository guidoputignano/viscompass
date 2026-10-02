-- Same approved-org access as 20261002120000, expressed as uncorrelated
-- authorized sets. Postgres can hash these once per statement rather than
-- rejoining memberships for every canonical_fact row under each RPC.
alter policy "read approved orgs' facts" on public.canonical_fact
  using (
    (canonical_fact.region_code, canonical_fact.asl_code) in (
      select o.region_code, o.org_code
      from public.user_organizations uo
      join public.organizations o on o.org_code = uo.org_code
      where uo.user_id = (select auth.uid())
        and uo.status = 'approved'
        and o.org_type = 'asl'
      union all
      select o.region_code, o.region_code || o.org_code
      from public.user_organizations uo
      join public.organizations o on o.org_code = uo.org_code
      where uo.user_id = (select auth.uid())
        and uo.status = 'approved'
        and o.org_type = 'asl'
    )
    or canonical_fact.region_code in (
      select o.region_code
      from public.user_organizations uo
      join public.organizations o on o.org_code = uo.org_code
      where uo.user_id = (select auth.uid())
        and uo.status = 'approved'
        and o.org_type = 'regione'
    )
  );
