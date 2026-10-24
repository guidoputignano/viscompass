// Shared synthetic set-up of the Pillar C scoped-storage SQL tests, copied verbatim from
// tests/pillar-c-scoped-storage-sql.test.mjs (which keeps its own copy): the Supabase-like shim (API roles,
// auth.uid(), the storage schema and functions), the two private buckets, the synthetic directory, users,
// memberships and rollout rows. Every organisation, user, name and hash is SYNTHETIC: this repository is public.
export const SHIM = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                  nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
grant usage on schema auth to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  public boolean default false, avif_autodetection boolean default false,
  file_size_limit bigint, allowed_mime_types text[], owner_id text);
create unique index bname on storage.buckets (name);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz default now(),
  metadata jsonb, path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text, owner_id text, user_metadata jsonb);
create unique index bucketid_objname on storage.objects (bucket_id, name);
create index name_prefix_search on storage.objects (name text_pattern_ops);
create table storage.prefixes (bucket_id text references storage.buckets(id), name text not null, level int not null,
  created_at timestamptz default now(), primary key (bucket_id, level, name));
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
alter table storage.prefixes enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;

create function storage.foldername(name text) returns text[] language plpgsql as $function$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$function$;
create function storage.filename(name text) returns text language plpgsql as $function$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$function$;

-- storage-api tenant migration 0024-operation-function.sql, verbatim: the
-- operation of the current request, which storage-api sets locally on every
-- request (src/internal/database/postgres/scope.ts), named as in
-- src/http/routes/operations.ts.
CREATE OR REPLACE FUNCTION storage.operation()
    RETURNS text AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- Listing, as storage-api issues it: SECURITY INVOKER plpgsql over
-- storage.objects (reconstructed; PRECHECK fingerprints the live bodies).
create function storage.search(prefix text, bucketname text, limits int default 100, levels int default 1,
  offsets int default 0, search text default '', sortcolumn text default 'name', sortorder text default 'asc')
returns table (name text, id uuid, updated_at timestamptz, created_at timestamptz, last_accessed_at timestamptz, metadata jsonb)
language plpgsql stable as $function$
begin
  return query
    with folders as (
      select o.path_tokens[levels] as folder
      from storage.objects o
      where o.name ilike prefix || search || '%' and o.bucket_id = bucketname
        and array_length(o.path_tokens, 1) <> levels
      group by 1)
    select f.folder, null::uuid, null::timestamptz, null::timestamptz, null::timestamptz, null::jsonb from folders f
    union all
    select o.path_tokens[levels], o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata
    from storage.objects o
    where o.name ilike prefix || search || '%' and o.bucket_id = bucketname
      and array_length(o.path_tokens, 1) = levels
    limit limits offset offsets;
end
$function$;
create function storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text,
  max_keys integer default 100, start_after text default '', next_token text default '')
returns table (name text, id uuid, metadata jsonb, updated_at timestamptz)
language plpgsql as $function$
begin
  return query execute
    'select distinct on (name collate "C") * from (
       select case when position($2 in substring(name from length($1) + 1)) > 0
                   then substring(name from 1 for length($1) + position($2 in substring(name from length($1) + 1)))
                   else name end as name, id, metadata, updated_at
       from storage.objects
       where bucket_id = $5 and name ilike $1 || ''%''
         and case when $6 != '''' then name collate "C" > $6 else true end
       order by name collate "C" asc) as e
     order by name collate "C" limit $3'
    using prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
end
$function$;
`;

export const POST_SCHEMA = `
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('pillar-c-review', 'pillar-c-review', false, null, null),
  ('pillar-c-evidence', 'pillar-c-evidence', false, 4194304, array['application/pdf', 'text/csv', 'text/plain']);
`;

export const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const ID = {
  a1: uid(1), a1b: uid(2), a3: uid(3), r: uid(4), rb: uid(5), pending: uid(6), rejected: uid(7), revoked: uid(8),
  none: uid(9), multi: uid(10), otherAsl: uid(11), otherRegione: uid(12), unmapped: uid(13), fullCode: uid(14),
  reviewerLike: uid(15), c203: uid(16),
};
export const GHOST = uid(99); // a JWT subject with no auth.users row
export const MEMBERSHIPS = [
  [ID.a1, "204", "approved"], [ID.a1b, "204", "approved"], [ID.a3, "202", "approved"],
  [ID.r, "130", "approved"], [ID.rb, "130", "approved"],
  [ID.pending, "204", "pending"], [ID.rejected, "204", "rejected"], [ID.revoked, "204", "revoked"],
  [ID.multi, "204", "approved"], [ID.multi, "130", "approved"],
  [ID.otherAsl, "301", "approved"], [ID.otherRegione, "140", "approved"], [ID.unmapped, "205", "approved"],
  [ID.fullCode, "130204", "approved"], [ID.reviewerLike, "201", "approved"], [ID.c203, "203", "approved"],
];
export const SEED = `
insert into public.organizations (org_code, org_name, org_type, region_code) values
  ('201', 'Azienda sintetica 1', 'asl', '130'), ('202', 'Azienda sintetica 2', 'asl', '130'),
  ('203', 'Azienda sintetica 3', 'asl', '130'), ('204', 'Azienda sintetica 4', 'asl', '130'),
  ('130', 'Regione sintetica', 'regione', '130'),
  ('205', 'Azienda sintetica non mappata', 'asl', '130'), ('130204', 'Codice esteso sintetico', 'asl', '130'),
  ('301', 'Azienda sintetica altrove', 'asl', '140'), ('140', 'Regione sintetica altrove', 'regione', '140');
`;
export const SEED_USERS = () => `
insert into auth.users (id, email) values ${Object.entries(ID).map(([k, v]) => `('${v}', '${k}@synthetic.invalid')`).join(", ")};
-- Two approved memberships for one user are impossible in production (unique
-- index); the index is dropped so the helper's own count check is exercised.
drop index if exists public.user_organizations_one_approved_per_user;
insert into public.user_organizations (user_id, org_code, status) values
  ${MEMBERSHIPS.map(([u, o, s]) => `('${u}', '${o}', '${s}')`).join(",\n  ")};
`;
export const ROLLOUT = `
insert into public.pillar_c_scoped_org_switch (org_code, mode, note) values
  ('204', 'allowlist', 'synthetic test phase'), ('130', 'allowlist', 'synthetic test phase');
insert into public.pillar_c_scoped_user_allow (org_code, user_id, note) values
  ('204', '${ID.a1}', 'A1'), ('130', '${ID.r}', 'A2'),
  ('204', '${ID.rb}', 'cross-organisation row'), ('204', '${ID.pending}', 'pending'), ('204', '${ID.rejected}', 'rejected'),
  ('204', '${ID.revoked}', 'revoked'), ('204', '${ID.none}', 'no membership'), ('204', '${ID.multi}', 'two memberships'),
  ('130', '${ID.multi}', 'two memberships');
`;

