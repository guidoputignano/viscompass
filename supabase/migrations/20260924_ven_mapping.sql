-- Versioned clinician-supplied VEN mapping.
--
-- Criticality is a property of a formulary, not of a molecule, so this table
-- only ever holds a classification somebody with clinical authority supplied and
-- somebody else approved. Nothing in the application derives a class: ABC is
-- spend concentration and AWaRe is stewardship risk, and neither is VEN.
--
-- Criteria applied by the panel are quoted in lib/analytics/ven.ts from MDS-3
-- chapter 40.3; provenance in data/provenance/ven-criteria.json.
begin;

create table public.ven_mapping (
  mapping_version text not null check (mapping_version ~ '^\d{4}-\d{2}-\d{2}\.\d+$'),
  -- ATC5 or a 9-digit AIC. Leading zeros are significant: a key that is not
  -- exactly 9 digits is a different product, never coerced into range.
  scope_key text not null check (scope_key ~ '^\d{9}$' or scope_key ~ '^[A-Z]\d{2}[A-Z]{2}\d{2}$'),
  ven_class text not null check (ven_class in ('V','E','N')),
  -- Which criterion the panel applied, in their words. Without it a
  -- classification cannot be audited, which is the failure the published
  -- literature repeatedly leaves unaddressed.
  criteria_note text,
  supplied_by text not null check (length(btrim(supplied_by)) > 0),
  supplied_at date not null,
  approved_by text,
  approved_at date,
  valid_from date not null,
  valid_to date,
  status text not null check (status in ('pending','approved','superseded')),
  created_at timestamptz not null default now(),
  primary key (mapping_version, scope_key),
  -- A period that ends before it begins classifies nothing.
  constraint ven_period_ordered check (valid_to is null or valid_to > valid_from),
  -- Approval metadata travels together, and only on approved rows.
  constraint ven_approval_complete check (
    (status = 'approved' and approved_by is not null and length(btrim(approved_by)) > 0 and approved_at is not null)
    or (status <> 'approved' and approved_by is null and approved_at is null)
  ),
  -- The submitter is not the approver. This mirrors the escalation bug already
  -- fixed on memberships: an INSERT policy must constrain values, not identity.
  constraint ven_approver_is_not_supplier check (approved_by is null or btrim(approved_by) <> btrim(supplied_by))
);

alter table public.ven_mapping enable row level security;
alter table public.ven_mapping force row level security;
revoke all on public.ven_mapping from anon, authenticated;

-- Any approved member may read the mapping: it is a clinical reference for the
-- perimeter, not one organization's data, and it carries no spend.
grant select on public.ven_mapping to authenticated;
grant all on public.ven_mapping to service_role;

create policy "approved members read the ven mapping"
on public.ven_mapping for select to authenticated
using (exists (
  select 1 from public.user_organizations uo
  where uo.user_id = auth.uid() and uo.status = 'approved'
));

-- There is deliberately no client-facing INSERT or UPDATE policy. A mapping is
-- loaded and approved server-side with the service-role key, the same way upload
-- reconciliation results and feature-request responses are, so no session can
-- promote a row to 'approved' or edit a published version in place.

create index ven_mapping_lookup on public.ven_mapping (scope_key, status, valid_from);

commit;
