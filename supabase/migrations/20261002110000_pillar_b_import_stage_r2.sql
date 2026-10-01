-- Restricted staging for the frozen Pillar B R2 import. Only the service role
-- can write/read it. The active release still gates every dashboard read.
create table if not exists public.pillar_b_import_stage_r2 as
select * from public.canonical_fact where false;

revoke all on table public.pillar_b_import_stage_r2 from public, anon, authenticated;
grant select, insert, delete on table public.pillar_b_import_stage_r2 to service_role;
alter table public.pillar_b_import_stage_r2 enable row level security;

notify pgrst, 'reload schema';
