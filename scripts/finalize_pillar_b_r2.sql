-- Execute as one statement in Supabase SQL Editor after staging is verified.
-- The DO statement is atomic: any failed assertion rolls back the fact insert.
do $release$
declare
  v record;
  v_inserted bigint;
begin
  if exists (select 1 from public.pillar_b_active_release) then
    raise exception 'Pillar B already has an active release';
  end if;
  if exists (select 1 from public.canonical_fact) then
    raise exception 'canonical_fact is not empty; first-load contract failed';
  end if;

  select count(*) as rows_n,
         round(sum(total_cost_eur), 2) as total_eur,
         round(sum(total_cost_eur) filter (where comparable_eligible), 2) as eligible_eur,
         count(distinct source_record_id) as distinct_ids,
         count(distinct source_version_id) as versions,
         count(distinct asl_code) as asls,
         count(distinct channel) as channels,
         count(*) filter (where quantity_packs is not null) as package_rows,
         count(*) filter (where acquistato_cost_eur is not null) as purchased_rows,
         count(*) filter (where source_disposition = 'non_aic') as non_aic_rows,
         count(*) filter (where total_cost_eur < 0) as negative_rows,
         count(*) filter (where comparable_eligible and
           (source_disposition <> 'analytical' or exclusion_reason is not null)) as bad_comparable
    into v
    from public.pillar_b_import_stage_r2;
  if v.rows_n <> 261153 or v.total_eur <> 1078943265.79 or
     v.eligible_eur <> 699820567.13 or v.distinct_ids <> v.rows_n or
     v.versions <> 1 or v.asls <> 4 or v.channels <> 3 or
     v.package_rows <> 0 or v.purchased_rows <> 0 or
     v.non_aic_rows <> 1064 or v.negative_rows <> 828 or
     v.bad_comparable <> 0 or
     exists (select 1 from public.pillar_b_import_stage_r2
             where source_version_id <> 'PILLAR-B-R2-20261001') then
    raise exception 'staged Pillar B R2 contract failed: %', row_to_json(v);
  end if;

  insert into public.canonical_fact (
    source_record_id, source_version_id, year, month,
    region_code, region_name, asl_code, channel, aic, active_substance,
    source_quantity, source_quantity_basis, quantity_packs,
    total_cost_eur, erogato_cost_eur, cost_basis,
    source_disposition, source_key_class,
    perimeter_status, perimeter_evidence_grade, classification_valid_from,
    comparable_stratum_id, exclusion_reason, comparable_eligible, product_route,
    comparable_quantity, comparable_unit, quantity_basis_status,
    cost_gross_status, mapping_confidence
  )
  select
    source_record_id, source_version_id, year, month,
    region_code, region_name, asl_code, channel, aic, active_substance,
    source_quantity, source_quantity_basis, quantity_packs,
    total_cost_eur, erogato_cost_eur, cost_basis,
    source_disposition, source_key_class,
    perimeter_status, perimeter_evidence_grade, classification_valid_from,
    comparable_stratum_id, exclusion_reason, comparable_eligible, product_route,
    comparable_quantity, comparable_unit, quantity_basis_status,
    cost_gross_status, mapping_confidence
  from public.pillar_b_import_stage_r2;
  get diagnostics v_inserted = row_count;
  if v_inserted <> 261153 then
    raise exception 'fact insert count % does not match frozen release', v_inserted;
  end if;

  select count(*) as rows_n,
         round(sum(total_cost_eur), 2) as total_eur,
         round(sum(total_cost_eur) filter (where comparable_eligible), 2) as eligible_eur
    into v
    from public.canonical_fact
   where source_version_id = 'PILLAR-B-R2-20261001';
  if v.rows_n <> 261153 or v.total_eur <> 1078943265.79 or
     v.eligible_eur <> 699820567.13 then
    raise exception 'inserted Pillar B R2 contract failed: %', row_to_json(v);
  end if;
end
$release$;
