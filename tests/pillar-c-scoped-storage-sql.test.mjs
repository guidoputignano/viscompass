import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { orgDisplayName, REVIEWED_PSEUDONYM_CODES } from "../lib/analytics/org-pseudonym.ts";

// PILLAR C RECOMMENDATION 5: organisation-scoped delivery enforced by Storage
// RLS (supabase/migrations/20261020120000_pillar_c_scoped_storage.sql).
//
// The harness is a real PostgreSQL (the pinned PGlite 0.5.8, PostgreSQL 18.3,
// installed outside the public checkout, as for tests/pillar-c-evidence-sql)
// set up the way Supabase sets up a project: the API roles, auth.uid() and
// auth.role() as Supabase defines them, the storage schema (buckets, objects,
// prefixes, RLS enabled, ALL granted to the API roles so that RLS decides),
// storage.foldername() as Supabase defines it, the real supabase_schema.sql
// (organizations, user_organizations and the 'uploads' policies, exactly as
// production was built), and the two existing private Pillar C buckets with no
// policies. Each Storage operation is issued as the Storage server issues it:
// one transaction, set_config of the role and the JWT claims, then the
// statement. Every organisation, user, name and hash is SYNTHETIC: this
// repository is public.

const migration = await readFile(new URL("../supabase/migrations/20261020120000_pillar_c_scoped_storage.sql", import.meta.url), "utf8");
const schema = await readFile(new URL("../supabase_schema.sql", import.meta.url), "utf8");
let PGlite;
try {
  ({ PGlite } = await import("../../outputs/pillar-b/node_modules/@electric-sql/pglite/dist/index.js"));
} catch {
  // The pinned PostgreSQL harness lives outside the public checkout. Do not add
  // or upgrade production dependencies to install the test engine.
}
const SKIP = !PGlite && "Pinned external PGlite harness unavailable";
const sql = migration.replace(/\r\n/g, "\n");

// The operations the policy refuses, named exactly as storage-api's src/http/routes/operations.ts names them (the same
// names in every revision since the operation names were introduced) and as the routes declare them:
//   signing (getSignedURL.ts, getSignedURLs.ts): a signed URL is served by its token, without RLS, until it expires;
//   server-side copy and move (object/copyObject.ts, object/moveObject.ts, s3/commands/copy-object.ts and
//   upload-part-copy.ts): a copy into the caller's own 'uploads' folder outlives a revoke and every member of the
//   organisation can read it (review finding REV-SD-01).
// Each of them reads the source through RLS under its operation before acting.
const SIGN_OPS = ["storage.object.sign", "storage.object.sign_many"];
const COPY_OPS = ["storage.object.copy", "storage.object.move", "storage.s3.object.copy", "storage.s3.upload.part_copy"];
const REFUSED_OPS = [...SIGN_OPS, ...COPY_OPS];
// Every plain read storage-api names for an object, and a request with no operation: these must keep reading.
const READ_OPS = ["storage.object.get_authenticated", "storage.object.info_authenticated", "object.get_authenticated_info",
  "object.head_authenticated_info", "storage.object.list", "storage.object.list_v2", "storage.s3.object.get", "storage.s3.object.info",
  "storage.s3.object.list", "storage.render.image_authenticated", ""];
// The policy's operation term, exactly as the migration writes it, and the policy's whole USING clause.
const REFUSAL = "\n    and coalesce((select storage.operation()), '') not in ('storage.object.sign', 'storage.object.sign_many',\n      'storage.object.copy', 'storage.object.move', 'storage.s3.object.copy', 'storage.s3.upload.part_copy')";
const POLICY_USING = /\n  using \(\n([\s\S]*?)\n  \);\n/.exec(sql)?.[1];
const SIGN_ONLY = "\n    and coalesce((select storage.operation()), '') not in ('storage.object.sign', 'storage.object.sign_many')";

// ------------------------------------------------------------------ harness

const SHIM = `
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

const POST_SCHEMA = `
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('pillar-c-review', 'pillar-c-review', false, null, null),
  ('pillar-c-evidence', 'pillar-c-evidence', false, 4194304, array['application/pdf', 'text/csv', 'text/plain']);
`;

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ID = {
  a1: uid(1), a1b: uid(2), a3: uid(3), r: uid(4), rb: uid(5), pending: uid(6), rejected: uid(7), revoked: uid(8),
  none: uid(9), multi: uid(10), otherAsl: uid(11), otherRegione: uid(12), unmapped: uid(13), fullCode: uid(14),
  reviewerLike: uid(15), c203: uid(16),
};
const GHOST = uid(99); // a JWT subject with no auth.users row
const MEMBERSHIPS = [
  [ID.a1, "204", "approved"], [ID.a1b, "204", "approved"], [ID.a3, "202", "approved"],
  [ID.r, "130", "approved"], [ID.rb, "130", "approved"],
  [ID.pending, "204", "pending"], [ID.rejected, "204", "rejected"], [ID.revoked, "204", "revoked"],
  [ID.multi, "204", "approved"], [ID.multi, "130", "approved"],
  [ID.otherAsl, "301", "approved"], [ID.otherRegione, "140", "approved"], [ID.unmapped, "205", "approved"],
  [ID.fullCode, "130204", "approved"], [ID.reviewerLike, "201", "approved"], [ID.c203, "203", "approved"],
];
const SEED = `
insert into public.organizations (org_code, org_name, org_type, region_code) values
  ('201', 'Azienda sintetica 1', 'asl', '130'), ('202', 'Azienda sintetica 2', 'asl', '130'),
  ('203', 'Azienda sintetica 3', 'asl', '130'), ('204', 'Azienda sintetica 4', 'asl', '130'),
  ('130', 'Regione sintetica', 'regione', '130'),
  ('205', 'Azienda sintetica non mappata', 'asl', '130'), ('130204', 'Codice esteso sintetico', 'asl', '130'),
  ('301', 'Azienda sintetica altrove', 'asl', '140'), ('140', 'Regione sintetica altrove', 'regione', '140');
`;
const SEED_USERS = () => `
insert into auth.users (id, email) values ${Object.entries(ID).map(([k, v]) => `('${v}', '${k}@synthetic.invalid')`).join(", ")};
-- Two approved memberships for one user are impossible in production (unique
-- index); the index is dropped so the helper's own count check is exercised.
drop index if exists public.user_organizations_one_approved_per_user;
insert into public.user_organizations (user_id, org_code, status) values
  ${MEMBERSHIPS.map(([u, o, s]) => `('${u}', '${o}', '${s}')`).join(",\n  ")};
`;
const ROLLOUT = `
insert into public.pillar_c_scoped_org_switch (org_code, mode, note) values
  ('204', 'allowlist', 'synthetic test phase'), ('130', 'allowlist', 'synthetic test phase');
insert into public.pillar_c_scoped_user_allow (org_code, user_id, note) values
  ('204', '${ID.a1}', 'A1'), ('130', '${ID.r}', 'A2'),
  ('204', '${ID.rb}', 'cross-organisation row'), ('204', '${ID.pending}', 'pending'), ('204', '${ID.rejected}', 'rejected'),
  ('204', '${ID.revoked}', 'revoked'), ('204', '${ID.none}', 'no membership'), ('204', '${ID.multi}', 'two memberships'),
  ('130', '${ID.multi}', 'two memberships');
`;

const sha = (s) => createHash("sha256").update(`synthetic:${s}`).digest("hex");
const UNITS = ["aggregato", "asl-1", "asl-2", "asl-3", "asl-4"];
const ROOTS = ["v1", "v2", "v999"];
const KINDS = ["review", "attr-index", "attr-FY2025-Tutti", "port-JM2026-DPC"];
const VALID = ROOTS.flatMap((root) => UNITS.flatMap((unit) => KINDS.map((kind) => ({ root, unit, name: `${root}/${unit}/${kind}-${sha(root + unit + kind)}.json` }))));
const s = sha("adversarial");
const ADVERSARIAL = [
  `v1/asl-4/../asl-1/review-${s}.json`, `v1/asl-4/sub/review-${s}.json`, `v1/asl-4/review-${s}.json/x`,
  `v1/asl-40/review-${s}.json`, `v1/asl-0/review-${s}.json`, `v1/asl-5/review-${s}.json`, `v1/ASL-4/review-${s}.json`,
  `v1/asl-４/review-${s}.json`, `V1/asl-4/review-${s}.json`, `v0/asl-4/review-${s}.json`, `v01/asl-4/review-${s}.json`,
  `v1000/asl-4/review-${s}.json`, `vx/asl-4/review-${s}.json`, `v/asl-4/review-${s}.json`, `xv1/asl-4/review-${s}.json`,
  `/v1/asl-4/review-${s}.json`, `v1//asl-4/review-${s}.json`, `asl-4/review-${s}.json`, `v1/asl-4/`, `v1/asl-4`,
  `v1/asl-4/review-${s}.JSON`, `v1/asl-4/review-${s}.json.json`, `v1/asl-4/review-${s}.jsonx`, `v1/asl-4/review-${s}.json\n`,
  `v1/asl-4/review-${s}.json `, `v1/asl-4/review-${s.toUpperCase()}.json`, `v1/asl-4/review-${s.slice(1)}.json`,
  `v1/asl-4/review-${s}0.json`, `v1/asl-4/review.json`, `v1/asl-4/-${s}.json`, `v1/asl-4/review--${s}.json`,
  `v1/asl-4/review_x-${s}.json`, `v1/asl-4/rev iew-${s}.json`, `v1/asl-4/review-${s}`,
  `v1/regione/review-${s}.json`, `v1/azienda/204/review-${s}.json`, `v1/aggregato130/review-${s}.json`,
  `v1/aggregato/130/review-${s}.json`, `v1/Aggregato/review-${s}.json`,
];
const OTHER_BUCKET_NAMES = [...VALID.slice(0, 10).map((v) => v.name), "r5/review.json"];
const UPLOADS = ["201/a.csv", "204/b.csv", "130/c.csv"];

const OBJECTS = `
insert into storage.objects (bucket_id, name, metadata) values
  ${[
    ...VALID.map((v) => ["pillar-c-scoped", v.name]),
    ...ADVERSARIAL.map((n) => ["pillar-c-scoped", n]),
    ...OTHER_BUCKET_NAMES.map((n) => ["pillar-c-review", n]),
    ...OTHER_BUCKET_NAMES.map((n) => ["pillar-c-evidence", n]),
    ...UPLOADS.map((n) => ["uploads", n]),
  ].map(([b, n]) => `('${b}', '${n.replace(/'/g, "''")}', '{"mimetype":"application/json"}')`).join(",\n  ")};
`;

// The pre-migration project (shim, supabase_schema.sql, buckets, directory) is
// built once and cloned for every test, so each test starts from the same
// state without paying for initdb and the schema again.
let template = null;
async function fresh() {
  template ??= (async () => {
    const db = new PGlite();
    await db.exec(SHIM);
    await db.exec(schema);
    await db.exec(POST_SCHEMA);
    await db.exec(SEED);
    return db;
  })();
  return (await template).clone();
}
after(async () => { if (template) await (await template).close(); });
async function applyMigration(db, text = migration) {
  try { await db.exec(text); } catch (error) { await db.exec("rollback"); throw error; }
}
// Fully set up: migration applied, users, memberships, objects, rollout rows.
async function ready({ text = migration, rollout = true } = {}) {
  const db = await fresh();
  await applyMigration(db, text);
  await db.exec(SEED_USERS());
  await db.exec(OBJECTS);
  if (rollout) await db.exec(ROLLOUT);
  return db;
}
async function withDb(make, fn) {
  const db = await make();
  try { return await fn(db); } finally { await db.close(); }
}

// One Storage-server or PostgREST request: a transaction with the role and the
// JWT claims set locally, rolled back afterwards. A Storage request also sets
// its operation (storage-api route names; default: an authenticated download).
//   who = { sub, style: 'storage' | 'postgrest', op? } | 'anon' | 'service_role' | 'noclaims'
async function as(db, who, fn) {
  await db.exec("begin");
  try {
    if (who === "service_role" || who === "anon" || who === "noclaims") {
      const role = who === "noclaims" ? "authenticated" : who;
      await db.query("select set_config('request.jwt.claims', $1, true), set_config('role', $2, true)",
        [JSON.stringify({ role }), role]);
    } else if (who.style === "postgrest") {
      await db.query("select set_config('request.jwt.claims', $1, true), set_config('role', 'authenticated', true)",
        [JSON.stringify({ sub: who.sub, role: "authenticated", aud: "authenticated" })]);
    } else {
      // storage-api's TenantConnection.setScope
      await db.query(`select set_config('role', 'authenticated', true), set_config('request.jwt.claim.role', 'authenticated', true),
        set_config('request.jwt', '', true), set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true),
        set_config('request.headers', '{}', true), set_config('request.method', 'GET', true), set_config('request.path', '', true),
        set_config('storage.operation', $3, true)`,
        [who.sub, JSON.stringify({ sub: who.sub, role: "authenticated", aud: "authenticated" }), who.op ?? "storage.object.get_authenticated"]);
    }
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}
const user = (sub, style = "storage", op) => ({ sub, style, op });
const sqlState = async (fn) => { try { await fn(); return "ok"; } catch (e) { return e.code ?? String(e.message); } };
const sameList = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const C_SORT = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const expectedScoped = (units) => VALID.filter((v) => units.includes(v.unit)).map((v) => v.name).sort(C_SORT);
const expectedUploads = (sub) => UPLOADS.filter((n) => MEMBERSHIPS.some(([u, o, st]) => u === sub && st === "approved" && n.startsWith(`${o}/`))).sort(C_SORT);

// What one identity can see: its units, and the exact object names readable
// in every bucket, as the Storage server would list them.
async function observe(db, who) {
  return as(db, who, async () => {
    const units = (await db.query("select public.pillar_c_scoped_units() as u")).rows[0].u;
    const names = async (bucket) => (await db.query(`select name from storage.objects where bucket_id = $1 order by name collate "C"`, [bucket])).rows.map((r) => r.name);
    return {
      units, scoped: await names("pillar-c-scoped"), review: await names("pillar-c-review"),
      evidence: await names("pillar-c-evidence"), uploads: await names("uploads"),
    };
  });
}
async function expectSees(db, fail, label, who, units) {
  let got;
  try { got = await observe(db, who); } catch (e) { fail.push(`${label}: error ${e.code ?? e.message}`); return; }
  const want = [...units].sort(C_SORT);
  if (JSON.stringify(got.units) !== JSON.stringify(want)) fail.push(`${label}: units ${JSON.stringify(got.units)} expected ${JSON.stringify(want)}`);
  if (JSON.stringify(got.scoped) !== JSON.stringify(expectedScoped(want))) fail.push(`${label}: ${got.scoped.length} scoped objects visible, expected ${expectedScoped(want).length}`);
  if (got.review.length || got.evidence.length) fail.push(`${label}: reviewer or evidence objects visible`);
  if (typeof who === "object" && JSON.stringify(got.uploads) !== JSON.stringify(expectedUploads(who.sub))) fail.push(`${label}: uploads bucket changed (${JSON.stringify(got.uploads)})`);
}
const ALL5 = ["aggregato", "asl-1", "asl-2", "asl-3", "asl-4"];
const AZ4 = ["aggregato", "asl-4"];

// The lookup storage-api issues before a download, a signature, a copy or a move, under each operation name: an
// entitled object is readable under every plain read and under none of `refused`, one at a time or as a batch (sign_many,
// list); a peer is readable under none.
async function operationMatrix(db, fail, refused) {
  const own = VALID.find((v) => v.root === "v1" && v.unit === "asl-4").name;
  const agg = VALID.find((v) => v.root === "v1" && v.unit === "aggregato").name;
  const peer = VALID.find((v) => v.root === "v1" && v.unit === "asl-1").name;
  const find = (name) => db.query("select id from storage.objects where name = $1 and bucket_id = 'pillar-c-scoped'", [name]);
  const count = (prefix) => db.query("select count(*)::int as n from storage.objects where bucket_id = 'pillar-c-scoped' and name like $1", [`${prefix}%`]);
  for (const [label, id, entitled, units] of [["A1", ID.a1, [own, agg], AZ4], ["R", ID.r, [peer, agg], ALL5]]) {
    for (const op of [...READ_OPS, ...refused]) {
      const want = refused.includes(op) ? 0 : 1;
      for (const name of entitled) {
        const n = await as(db, user(id, "storage", op), async () => (await find(name)).rows.length);
        if (n !== want) fail.push(`${label} ${op || "(no operation)"} ${name.split("/")[1]}: ${n} rows, expected ${want}`);
      }
      const all = await as(db, user(id, "storage", op), async () => (await count("v1/")).rows[0].n);
      const wantAll = refused.includes(op) ? 0 : expectedScoped(units).filter((n) => n.startsWith("v1/")).length;
      if (all !== wantAll) fail.push(`${label} ${op || "(no operation)"} v1/: ${all} rows, expected ${wantAll}`);
    }
  }
  for (const op of [...READ_OPS, ...refused]) {
    const n = await as(db, user(ID.a1, "storage", op), async () => (await find(VALID.find((v) => v.root === "v1" && v.unit === "asl-2").name)).rows.length);
    if (n !== 0) fail.push(`A1 ${op || "(no operation)"} peer asl-2: ${n} rows`);
  }
}

// ---------------------------------------------------------------- scenarios
// Each pushes human-readable failures; the named tests assert none, and the
// mutant test asserts that every mutant produces at least one.

const SCENARIOS = {
  async baseline(db, fail) {
    await expectSees(db, fail, "A1 (204, allow-listed)", user(ID.a1), AZ4);
    await expectSees(db, fail, "A1 via PostgREST claims", user(ID.a1, "postgrest"), AZ4);
    await expectSees(db, fail, "R (130, allow-listed)", user(ID.r), ALL5);
    await expectSees(db, fail, "R via PostgREST claims", user(ID.r, "postgrest"), ALL5);
    for (const [label, id] of [
      ["A1b (204, not listed)", ID.a1b], ["A3 (202, org off)", ID.a3], ["Rb (130 member listed only under 204)", ID.rb],
      ["pending 204", ID.pending], ["rejected 204", ID.rejected], ["revoked 204", ID.revoked], ["no membership", ID.none],
      ["two approved memberships", ID.multi], ["asl in another region", ID.otherAsl], ["regione of another region", ID.otherRegione],
      ["unmapped asl code 205", ID.unmapped], ["full NSIS code 130204", ID.fullCode], ["reviewer-like 201 member", ID.reviewerLike],
      ["203 member", ID.c203],
    ]) {
      await expectSees(db, fail, label, user(id), []);
      await expectSees(db, fail, `${label} via PostgREST claims`, user(id, "postgrest"), []);
    }
    await expectSees(db, fail, "JWT subject with no auth user", user(GHOST), []);
    await expectSees(db, fail, "authenticated without a subject", "noclaims", []);
  },

  async storageOperations(db, fail) {
    const own = VALID.find((v) => v.root === "v1" && v.unit === "asl-4").name;
    const agg = VALID.find((v) => v.root === "v1" && v.unit === "aggregato").name;
    const peer = VALID.find((v) => v.root === "v1" && v.unit === "asl-1").name;
    const find = (name, bucket = "pillar-c-scoped") => db.query("select id, version, metadata from storage.objects where name = $1 and bucket_id = $2 limit 1", [name, bucket]);
    // download, HEAD, info and createSignedUrl all start with this lookup
    for (const [label, name, bucket, n] of [["own", own, "pillar-c-scoped", 1], ["aggregate", agg, "pillar-c-scoped", 1], ["peer", peer, "pillar-c-scoped", 0], ["review copy", own, "pillar-c-review", 0]]) {
      const got = await as(db, user(ID.a1), async () => (await find(name, bucket)).rows.length);
      if (got !== n) fail.push(`A1 lookup ${label}: ${got} rows, expected ${n}`);
    }
    for (const id of [ID.a1, ID.r]) {
      const who = user(id);
      const target = id === ID.a1 ? own : peer;
      const fresh = `v1/asl-4/review-${sha("new" + id)}.json`;
      const expect42501 = async (label, statement, params) => {
        const st = await as(db, who, () => sqlState(() => db.query(statement, params)));
        if (st !== "42501") fail.push(`${label} as ${id}: ${st}, expected 42501`);
      };
      const expectNone = async (label, statement, params) => {
        const n = await as(db, who, async () => (await db.query(statement, params)).rows.length);
        if (n !== 0) fail.push(`${label} as ${id}: ${n} rows changed, expected 0`);
      };
      await expect42501("upload", "insert into storage.objects (bucket_id, name, owner, owner_id, metadata, version) values ('pillar-c-scoped', $1, $2::uuid, $2::text, '{}', 'x') returning id", [fresh, id]);
      await expect42501("upsert", "insert into storage.objects (bucket_id, name, metadata) values ('pillar-c-scoped', $1, '{}') on conflict (bucket_id, name) do update set metadata = excluded.metadata returning id", [target]);
      await expect42501("copy", "insert into storage.objects (bucket_id, name, metadata) select bucket_id, $2, metadata from storage.objects where bucket_id = 'pillar-c-scoped' and name = $1 returning id", [target, fresh]);
      await expectNone("move", "update storage.objects set name = $2 where bucket_id = 'pillar-c-scoped' and name = $1 returning id", [target, fresh]);
      await expectNone("overwrite metadata", "update storage.objects set metadata = '{}' where bucket_id = 'pillar-c-scoped' returning id", []);
      await expectNone("delete", "delete from storage.objects where bucket_id = 'pillar-c-scoped' and name = $1 returning id", [target]);
      await expectNone("make the bucket public", "update storage.buckets set public = true where id = 'pillar-c-scoped' returning id", []);
      await expect42501("create a bucket", "insert into storage.buckets (id, name, public) values ('pcs-forged', 'pcs-forged', true) returning id", []);
      for (const table of ["pillar_c_scoped_org_switch", "pillar_c_scoped_user_allow"]) {
        await expect42501(`read ${table}`, `select * from public.${table}`, []);
        await expect42501(`write ${table}`, `delete from public.${table}`, []);
      }
      await expect42501("enable own organisation", "insert into public.pillar_c_scoped_org_switch (org_code, mode, note) values ('202', 'all', 'forged')", []);
    }
    // The bucket and objects are untouched, and the service role (the uploader)
    // still writes: it bypasses RLS and never calls the helper.
    const bucket = (await db.query("select public, file_size_limit::int as l from storage.buckets where id = 'pillar-c-scoped'")).rows[0];
    if (bucket.public !== false || bucket.l !== 5242880) fail.push("bucket changed by a client");
    const count = (await db.query("select count(*)::int as n from storage.objects where bucket_id = 'pillar-c-scoped'")).rows[0].n;
    if (count !== VALID.length + ADVERSARIAL.length) fail.push(`object count changed: ${count}`);
    const service = await as(db, "service_role", async () => ({
      all: (await db.query("select count(*)::int as n from storage.objects where bucket_id = 'pillar-c-scoped'")).rows[0].n,
      insert: (await db.query(`insert into storage.objects (bucket_id, name, metadata) values ('pillar-c-scoped', 'v1/asl-1/review-${sha("svc")}.json', '{}') returning id`)).rows.length,
    }));
    if (service.all !== VALID.length + ADVERSARIAL.length || service.insert !== 1) fail.push(`service role path changed: ${JSON.stringify(service)}`);
    if (await as(db, "service_role", () => sqlState(() => db.query("select public.pillar_c_scoped_units()"))) !== "42501") fail.push("service_role may execute the helper");
    // anon: no row in any bucket, no error, and no helper.
    const anon = await as(db, "anon", async () => (await db.query("select bucket_id, count(*)::int as n from storage.objects group by 1")).rows);
    if (anon.length) fail.push(`anon sees objects: ${JSON.stringify(anon)}`);
    if (await as(db, "anon", () => sqlState(() => db.query("select public.pillar_c_scoped_units()"))) !== "42501") fail.push("anon may execute the helper");
  },

  // REC5-SEC-01: a signed URL is served by its token, without RLS, until it
  // expires, so it would outlive a revoke. storage-api signs only after the
  // same RLS lookup as a download, with the request's operation set; the
  // policy refuses the two signing operations, and every plain read stays.
  async signing(db, fail) {
    const own = VALID.find((v) => v.root === "v1" && v.unit === "asl-4").name;
    const agg = VALID.find((v) => v.root === "v1" && v.unit === "aggregato").name;
    const peer = VALID.find((v) => v.root === "v1" && v.unit === "asl-1").name;
    const find = (name, bucket = "pillar-c-scoped") => db.query("select id from storage.objects where name = $1 and bucket_id = $2", [name, bucket]);
    await operationMatrix(db, fail, SIGN_OPS);
    // The 'uploads' bucket keeps its own policy, signing included.
    for (const op of SIGN_OPS) {
      const n = await as(db, user(ID.a1, "storage", op), async () => (await find("204/b.csv", "uploads")).rows.length);
      if (n !== 1) fail.push(`A1 ${op} own upload: ${n} rows, expected 1 (the uploads policy is not this migration's)`);
    }
    // A request with no operation at all (storage.operation() answers null:
    // a direct database session) reads as before.
    await db.exec("create or replace function storage.operation() returns text language plpgsql stable as $f$ begin return null; end; $f$");
    for (const [label, id, entitled] of [["A1", ID.a1, [own, agg]], ["R", ID.r, [peer, agg]]]) {
      for (const style of ["storage", "postgrest"]) {
        for (const name of entitled) {
          const n = await as(db, user(id, style), async () => (await find(name)).rows.length);
          if (n !== 1) fail.push(`${label} null operation (${style}) ${name.split("/")[1]}: ${n} rows, expected 1`);
        }
      }
    }
    await db.exec(SHIM.slice(SHIM.indexOf("CREATE OR REPLACE FUNCTION storage.operation()"), SHIM.indexOf("$$ LANGUAGE plpgsql STABLE;") + "$$ LANGUAGE plpgsql STABLE;".length));
    if ((await as(db, user(ID.a1, "storage", "storage.object.sign"), async () => (await find(own)).rows.length)) !== 0) fail.push("storage.operation() not restored");
  },

  // REV-SD-01: storage-api copies (REST /object/copy, S3 CopyObject and
  // UploadPartCopy) or moves an object only after reading the source through
  // RLS under the route's operation, then writes the destination under the
  // caller's own policies. A copy into the caller's 'uploads' folder, which the
  // uploads INSERT policy admits, would outlive a revoke and be readable by
  // every member of the organisation. The policy refuses the four copy and
  // move operations at the source; plain reads stay.
  async copyAndMove(db, fail) {
    const own = VALID.find((v) => v.root === "v1" && v.unit === "asl-4").name;
    const agg = VALID.find((v) => v.root === "v1" && v.unit === "aggregato").name;
    await operationMatrix(db, fail, COPY_OPS);
    // storage-api's Storage.copyObject: findObject(source, 'bucket_id,metadata,user_metadata,version') as the caller,
    // then the destination row, checked against the caller's INSERT policies.
    const source = (name, bucket = "pillar-c-scoped") => db.query("select bucket_id, metadata, user_metadata, version from storage.objects where bucket_id = $1 and name = $2 limit 1", [bucket, name]);
    const copyIntoUploads = (op, name, destination) => as(db, user(ID.a1, "storage", op), async () => {
      const src = (await source(name)).rows[0];
      if (!src) return "source not found";
      const st = await sqlState(() => db.query("insert into storage.objects (bucket_id, name, owner, owner_id, metadata, version) values ('uploads', $1, $2::uuid, $2::text, $3, 'copy') returning id", [destination, ID.a1, src.metadata]));
      return st === "ok" ? "copied" : `destination refused ${st}`;
    });
    for (const op of COPY_OPS) {
      for (const name of [own, agg]) {
        const got = await copyIntoUploads(op, name, `204/copy-${name.split("/")[1]}.json`);
        if (got !== "source not found") fail.push(`A1 ${op} ${name.split("/")[1]} into uploads/204/: ${got}, expected the source refused`);
      }
    }
    // Control: under a plain read the same steps would complete, so the refusal at the source is what stops the copy
    // (the uploads INSERT policy admits the destination). Nothing persists: every request is rolled back.
    if ((await copyIntoUploads("storage.object.get_authenticated", agg, "204/copy-control.json")) !== "copied") fail.push("control: a copy into the caller's uploads folder is not admitted, so this scenario proves nothing");
    if ((await db.query("select count(*)::int as n from storage.objects where bucket_id = 'uploads' and name like '204/copy-%'")).rows[0].n !== 0) fail.push("a copy persisted");
    // Moving needs the source row too, then an UPDATE of it (a DELETE and an INSERT on a versioned bucket), and no
    // UPDATE or DELETE policy exists: nothing moves under any operation.
    for (const op of [...COPY_OPS, ...READ_OPS]) {
      const n = await as(db, user(ID.a1, "storage", op), async () => (await db.query("update storage.objects set bucket_id = 'uploads', name = '204/moved.json' where bucket_id = 'pillar-c-scoped' and name = $1 returning id", [own])).rows.length);
      if (n !== 0) fail.push(`A1 ${op || "(no operation)"} moved ${n} object(s)`);
    }
    // The 'uploads' bucket keeps its own policy under the copy and move operations: a member still copies its own file.
    for (const op of COPY_OPS) {
      const n = await as(db, user(ID.a1, "storage", op), async () => (await source("204/b.csv", "uploads")).rows.length);
      if (n !== 1) fail.push(`A1 ${op} own upload: ${n} rows, expected 1 (the uploads policy is not this migration's)`);
    }
  },

  async listing(db, fail) {
    const list = (who, f) => as(db, who, f);
    for (const [label, who, units] of [["A1", user(ID.a1), AZ4], ["R", user(ID.r), ALL5], ["A1b", user(ID.a1b), []], ["A3", user(ID.a3), []]]) {
      const prefix = await list(who, async () => (await db.query(`select name from storage.objects where bucket_id = 'pillar-c-scoped' and name like 'v1/%' order by name collate "C"`)).rows.map((r) => r.name));
      if (!sameList(prefix, expectedScoped(units).filter((n) => n.startsWith("v1/")))) fail.push(`${label} prefix list v1/: ${prefix.length}`);
      for (const peer of ["asl-1", "asl-2", "asl-3", "asl-4", "aggregato"].filter((u) => !units.includes(u))) {
        const n = await list(who, async () => (await db.query(`select count(*)::int as n from storage.objects where bucket_id = 'pillar-c-scoped' and name like $1`, [`v1/${peer}/%`])).rows[0].n);
        if (n) fail.push(`${label} lists ${n} names under v1/${peer}/`);
      }
      const folders = await list(who, async () => (await db.query(`select name from storage.search('v1/', 'pillar-c-scoped', 1000, 2, 0) where id is null order by 1`)).rows.map((r) => r.name));
      if (!sameList(folders, units)) fail.push(`${label} search v1/ folders ${JSON.stringify(folders)}`);
      const files = await list(who, async () => (await db.query(`select name from storage.search('v1/asl-4/', 'pillar-c-scoped', 1000, 3, 0) where id is not null`)).rows.length);
      if (files !== (units.includes("asl-4") ? KINDS.length : 0)) fail.push(`${label} search v1/asl-4/ files ${files}`);
      const roots = await list(who, async () => (await db.query(`select name from storage.list_objects_with_delimiter('pillar-c-scoped', '', '/', 1000)`)).rows.map((r) => r.name));
      if (!sameList(roots, units.length ? ROOTS.map((r) => `${r}/`) : [])) fail.push(`${label} root listing ${JSON.stringify(roots)}`);
      const inUnit = await list(who, async () => (await db.query(`select name from storage.list_objects_with_delimiter('pillar-c-scoped', 'v2/', '/', 1000)`)).rows.map((r) => r.name));
      if (!sameList(inUnit, units.map((u) => `v2/${u}/`))) fail.push(`${label} v2/ listing ${JSON.stringify(inUnit)}`);
      const search = await list(who, async () => (await db.query(`select count(*)::int as n from storage.search('v1/', 'pillar-c-scoped', 1000, 3, 0, 'asl-1')`)).rows[0].n);
      if (search !== (units.includes("asl-1") ? KINDS.length : 0)) fail.push(`${label} search option asl-1: ${search}`);
    }
  },

  async rollout(db, fail) {
    await db.exec("update public.pillar_c_scoped_org_switch set mode = 'all' where org_code = '204'");
    await expectSees(db, fail, "A1 under 'all'", user(ID.a1), AZ4);
    await expectSees(db, fail, "A1b under 'all'", user(ID.a1b), AZ4);
    for (const id of [ID.pending, ID.rejected, ID.revoked, ID.none, ID.multi, ID.rb, ID.a3, ID.reviewerLike]) await expectSees(db, fail, `${id} under 204 'all'`, user(id), []);
    await expectSees(db, fail, "R unaffected by 204", user(ID.r), ALL5);
    await db.exec("delete from public.pillar_c_scoped_org_switch where org_code = '204'");
    if ((await db.query("select count(*)::int as n from public.pillar_c_scoped_user_allow where org_code = '204'")).rows[0].n !== 0) fail.push("204 allow rows survive the switch row");
    await expectSees(db, fail, "A1 after 204 switched off", user(ID.a1), []);
    await expectSees(db, fail, "A1b after 204 switched off", user(ID.a1b), []);
    await expectSees(db, fail, "R after 204 switched off", user(ID.r), ALL5);
    await db.query("delete from public.pillar_c_scoped_user_allow where org_code = '130' and user_id = $1", [ID.r]);
    await expectSees(db, fail, "R after its allow row is deleted", user(ID.r), []);
    await db.exec("update public.pillar_c_scoped_org_switch set mode = 'all' where org_code = '130'");
    await expectSees(db, fail, "R under 130 'all'", user(ID.r), ALL5);
    await expectSees(db, fail, "Rb under 130 'all'", user(ID.rb), ALL5);
    await expectSees(db, fail, "two memberships under 130 'all'", user(ID.multi), []);
    await db.exec("insert into public.pillar_c_scoped_org_switch (org_code, mode, note) values ('202', 'allowlist', 'synthetic')");
    await expectSees(db, fail, "A3 with 202 on and no allow row", user(ID.a3), []);
    await db.query("insert into public.pillar_c_scoped_user_allow (org_code, user_id, note) values ('202', $1, 'A3')", [ID.a3]);
    await expectSees(db, fail, "A3 listed under 202", user(ID.a3), ["aggregato", "asl-2"]);
    await db.query("update public.user_organizations set status = 'revoked' where user_id = $1", [ID.a3]);
    await expectSees(db, fail, "A3 after its membership is revoked", user(ID.a3), []);
    await db.query("update public.user_organizations set status = 'approved' where user_id = $1", [ID.a3]);
    await expectSees(db, fail, "A3 approved again", user(ID.a3), ["aggregato", "asl-2"]);
    await db.query("delete from auth.users where id = $1", [ID.a3]);
    if ((await db.query("select count(*)::int as n from public.pillar_c_scoped_user_allow where user_id = $1", [ID.a3])).rows[0].n !== 0) fail.push("allow row survives the deleted user");
    await expectSees(db, fail, "deleted user's token", user(ID.a3), []);
  },

  async everyAudience(db, fail) {
    // Every organisation switched on for all its members: each audience reads
    // exactly its own unit and the aggregate (the Regione all five), and
    // nobody else gains anything.
    await db.exec(`insert into public.pillar_c_scoped_org_switch (org_code, mode, note) values
      ('201', 'all', 'synthetic'), ('202', 'all', 'synthetic'), ('203', 'all', 'synthetic')
      on conflict (org_code) do update set mode = 'all';
      update public.pillar_c_scoped_org_switch set mode = 'all'`);
    for (const [label, id, units] of [
      ["201 member", ID.reviewerLike, ["aggregato", "asl-1"]], ["202 member", ID.a3, ["aggregato", "asl-2"]],
      ["203 member", ID.c203, ["aggregato", "asl-3"]], ["204 member", ID.a1, AZ4], ["other 204 member", ID.a1b, AZ4],
      ["130 member", ID.r, ALL5], ["other 130 member", ID.rb, ALL5],
      ["two memberships", ID.multi, []], ["pending", ID.pending, []], ["rejected", ID.rejected, []], ["revoked", ID.revoked, []],
      ["no membership", ID.none, []], ["other region asl", ID.otherAsl, []], ["other region regione", ID.otherRegione, []],
      ["205", ID.unmapped, []], ["130204", ID.fullCode, []],
    ]) await expectSees(db, fail, `${label} with every organisation on`, user(id), units);
  },

  async directoryDrift(db, fail) {
    await db.exec("update public.organizations set region_code = '140' where org_code = '204'");
    await expectSees(db, fail, "A1 when 204 moves region", user(ID.a1), []);
    await db.exec("update public.organizations set region_code = '130', org_type = 'regione' where org_code = '204'");
    await expectSees(db, fail, "A1 when 204 becomes a regione", user(ID.a1), []);
    await db.exec("update public.organizations set org_type = 'asl' where org_code = '204'");
    await expectSees(db, fail, "A1 restored", user(ID.a1), AZ4);
    await db.exec("update public.organizations set org_type = 'asl' where org_code = '130'");
    await expectSees(db, fail, "R when 130 becomes an asl", user(ID.r), []);
    await db.exec("update public.organizations set org_type = 'regione', region_code = '140' where org_code = '130'");
    await expectSees(db, fail, "R when 130 moves region", user(ID.r), []);
    await db.exec("update public.organizations set region_code = '130' where org_code = '130'");
    await expectSees(db, fail, "R restored", user(ID.r), ALL5);
  },
};
const SCENARIO_ORDER = ["baseline", "storageOperations", "signing", "copyAndMove", "listing", "rollout", "everyAudience", "directoryDrift"];

// ------------------------------------------------------------------- tests

test("migration text: one transaction, one SELECT policy for authenticated, a definer helper, forced RLS, no client grants", () => {
  const code = sql.replace(/--.*$/gm, "");
  assert.match(code, /^begin;$/m);
  assert.match(code, /^commit;\s*$/m);
  assert.equal(code.match(/^begin;$/gm).length, 1);
  assert.equal(code.match(/^commit;$/gm).length, 1);
  const policies = [...code.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+([\w.]+)\s+as\s+(\w+)\s+for\s+(\w+)\s+to\s+(\w+)/gi)];
  assert.equal((code.match(/create\s+policy/gi) ?? []).length, 1, "exactly one policy");
  assert.deepEqual(policies.map((m) => m.slice(1)), [["pillar c scoped: entitled units read", "storage.objects", "permissive", "select", "authenticated"]]);
  assert.doesNotMatch(code, /\bfor\s+(insert|update|delete|all)\b/i);
  assert.ok(code.includes([
    "  using (",
    "    bucket_id = 'pillar-c-scoped'",
    "    and name ~ '^v[1-9][0-9]{0,2}/(asl-[1-4]|aggregato)/[A-Za-z0-9]+(-[A-Za-z0-9]+)*-[0-9a-f]{64}[.]json$'",
    "    and (storage.foldername(name))[2] = any ((select public.pillar_c_scoped_units())::text[])",
    "    and coalesce((select storage.operation()), '') not in ('storage.object.sign', 'storage.object.sign_many',",
    "      'storage.object.copy', 'storage.object.move', 'storage.s3.object.copy', 'storage.s3.upload.part_copy')",
    "  );",
  ].join("\n")), "the policy predicate, InitPlan form, signing, copy and move refused");
  assert.ok(sql.includes(`\n  using (\n${POLICY_USING}\n  );\n`) && POLICY_USING.endsWith(REFUSAL), "the harness reads the policy as written");
  // The refused operations are named exactly as storage-api's src/http/routes/operations.ts names them (SIGN_OPS,
  // COPY_OPS above), and the post-condition requires the applied policy to refuse every one of them.
  const quoted = (text) => [...text.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  assert.deepEqual(quoted(/not in \(([^)]*)\)\n  \);/.exec(code)[1]), REFUSED_OPS, "the policy refuses exactly these operations");
  assert.deepEqual(quoted(/v_refused constant text\[\] := array\[([^\]]*)\];/.exec(code)[1]), REFUSED_OPS, "the post-condition requires exactly the same ones");
  assert.ok(code.includes("position('storage.operation()' in p.qual) > 0"), "post-condition: the policy reads the operation");
  assert.ok(code.includes("and not exists (select 1 from unnest(v_refused) as r(op)\n                        where position(quote_literal(r.op) in p.qual) = 0)) <> 1"), "post-condition: every refusal");
  assert.ok(code.includes("'PCS_POST_POLICY: the storage policy for pillar-c-scoped is not the reviewed one, or does not refuse signing, copy and move'"));
  assert.equal((code.match(/^security definer$/gim) ?? []).length, 1, "one definer function");
  assert.doesNotMatch(code, /^security invoker$/im);
  assert.ok(code.includes("create or replace function public.pillar_c_scoped_units()\nreturns text[]\nlanguage sql\nstable\nsecurity definer\nset search_path = pg_catalog, pg_temp\n"));
  assert.ok(code.includes("revoke all on function public.pillar_c_scoped_units() from public, anon, service_role;\ngrant execute on function public.pillar_c_scoped_units() to authenticated;"));
  for (const t of ["pillar_c_scoped_org_switch", "pillar_c_scoped_user_allow"]) {
    assert.ok(code.includes(`alter table public.${t} enable row level security;`), t);
    assert.ok(code.includes(`alter table public.${t} force row level security;`), t);
  }
  assert.ok(code.includes("revoke all on table public.pillar_c_scoped_org_switch, public.pillar_c_scoped_user_allow from public, anon, authenticated;"));
  assert.doesNotMatch(code.replace("grant execute on function public.pillar_c_scoped_units() to authenticated;", ""), /^\s*grant\b[^;]+\bto\b[^;]*\b(anon|authenticated|public)\b/im);
  assert.ok(code.includes("values ('pillar-c-scoped', 'pillar-c-scoped', false, 5242880, array['application/json'])"));
  assert.doesNotMatch(code, /(update|insert into|delete from)\s+(public\.)?(user_organizations|organizations|canonical_fact)\b/i);
  assert.doesNotMatch(code, /'pillar-c-(review|evidence)'/);
  // Transfer-safe and anonymised, comments included: no backslash, no E''
  // string, no UUID, no province key, place name or Region name.
  assert.doesNotMatch(sql, /\\/);
  assert.doesNotMatch(sql, /\bE'/);
  assert.doesNotMatch(sql, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.doesNotMatch(sql, /\b(AQ|CH|PE|TE)\b/);
  assert.doesNotMatch(sql, /aquila|chieti|pescara|teramo|abruzzo|avezzano|sulmona|lanciano|vasto/i);
  // Every documented precondition code is raised, and every raised code is documented.
  const documented = [...sql.matchAll(/^--\s+(PCS_PRE_[A-Z_]+)\s/gm)].map((m) => m[1]).sort();
  const raised = [...new Set([...sql.matchAll(/raise exception '(PCS_PRE_[A-Z_]+):/g)].map((m) => m[1]))].sort();
  assert.deepEqual(raised, documented);
  assert.equal(documented.length, 11);
  // One raise per code, so the PRECHECK's checks map one to one onto the migration's guards.
  assert.equal([...sql.matchAll(/raise exception '(PCS_PRE_[A-Z_]+):/g)].length, 11);
});

test("the unit names follow the reviewed pseudonym order 201 -> ASL 1 ... 204 -> ASL 4", () => {
  assert.deepEqual(REVIEWED_PSEUDONYM_CODES, ["201", "202", "203", "204"]);
  for (const code of REVIEWED_PSEUDONYM_CODES) {
    const n = orgDisplayName(code, null).replace(/^ASL /, "");
    assert.match(sql, new RegExp(`when '${code}' then 'asl-${n}'`), code);
  }
  assert.equal((sql.match(/when '20[1-4]' then 'asl-[1-4]'/g) ?? []).length, 4);
});

for (const name of SCENARIO_ORDER) {
  test(`real PostgreSQL: ${name}`, { skip: SKIP }, () => withDb(() => ready(), async (db) => {
    const fail = [];
    await SCENARIOS[name](db, fail);
    assert.deepEqual(fail, []);
  }));
}

test("real PostgreSQL: default off, no unit for anyone until the owner writes a rollout row", { skip: SKIP }, () => withDb(() => ready({ rollout: false }), async (db) => {
  const fail = [];
  for (const id of Object.values(ID)) await expectSees(db, fail, id, user(id), []);
  assert.deepEqual(fail, []);
  assert.equal((await db.query("select (select count(*) from public.pillar_c_scoped_org_switch) + (select count(*) from public.pillar_c_scoped_user_allow) as n")).rows[0].n, 0);
}));

test("real PostgreSQL: helper attributes, grants, policy fingerprint and a once-per-statement call", { skip: SKIP }, () => withDb(() => ready(), async (db) => {
  const fn = (await db.query(`select p.prosecdef, p.provolatile, p.proconfig, p.pronargs, p.prorettype::regtype::text as ret, p.proacl::text as acl,
      has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth,
      has_function_privilege('service_role', p.oid, 'execute') as service
    from pg_proc p where p.oid = 'public.pillar_c_scoped_units()'::regprocedure`)).rows[0];
  const { acl, ...attributes } = fn;
  assert.deepEqual(attributes, { prosecdef: true, provolatile: "s", proconfig: ["search_path=pg_catalog, pg_temp"], pronargs: 0, ret: "text[]", anon: false, auth: true, service: false });
  assert.doesNotMatch(acl, /(^|[{,])=X/, "no PUBLIC execute");
  const policies = (await db.query(`select tablename, policyname, cmd, permissive, roles::text as roles, with_check is null as no_check
    from pg_policies where schemaname = 'storage' order by policyname`)).rows;
  assert.deepEqual(policies.map((p) => [p.tablename, p.policyname, p.cmd, p.permissive, p.roles, p.no_check]), [
    ["objects", "pillar c scoped: entitled units read", "SELECT", "PERMISSIVE", "{authenticated}", true],
    ["objects", "read own approved org folder", "SELECT", "PERMISSIVE", "{authenticated}", true],
    ["objects", "upload to own approved org folder", "INSERT", "PERMISSIVE", "{authenticated}", false],
  ]);
  for (const t of ["pillar_c_scoped_org_switch", "pillar_c_scoped_user_allow"]) {
    const c = (await db.query("select relrowsecurity, relforcerowsecurity from pg_class where oid = $1::regclass", [`public.${t}`])).rows[0];
    assert.deepEqual(c, { relrowsecurity: true, relforcerowsecurity: true }, t);
    const grants = (await db.query("select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = $1 and grantee <> current_user order by 1, 2", [t])).rows;
    assert.deepEqual(grants.map((g) => `${g.grantee}:${g.privilege_type}`), ["service_role:DELETE", "service_role:INSERT", "service_role:SELECT", "service_role:UPDATE"], t);
    assert.equal((await db.query("select count(*)::int as n from pg_policies where tablename = $1", [t])).rows[0].n, 0, `${t} has no policy`);
  }
  // Even a restored broad grant would not open the rollout tables (forced RLS, no policy).
  await db.exec("grant select, insert on public.pillar_c_scoped_org_switch, public.pillar_c_scoped_user_allow to authenticated");
  await as(db, user(ID.a1), async () => assert.equal((await db.query("select * from public.pillar_c_scoped_user_allow")).rows.length, 0));
  assert.equal(await as(db, user(ID.a1), () => sqlState(() => db.query("insert into public.pillar_c_scoped_org_switch (org_code, mode, note) values ('202', 'all', 'forged')"))), "42501");
  // The policy calls the helper as an uncorrelated InitPlan: once per statement.
  const plan = await as(db, user(ID.a1), async () => (await db.query(`explain (costs off, verbose) select name from storage.objects where bucket_id = 'pillar-c-scoped'`)).rows.map((r) => Object.values(r)[0]).join("\n"));
  assert.match(plan, /= ANY \(\(InitPlan \d+\)\.col1\)/, plan);
  assert.equal((plan.match(/pillar_c_scoped_units\(\)/g) ?? []).length, 1, plan);
  assert.match(plan, /InitPlan \d+\n\s+->\s+Result\n\s+Output: (public\.)?pillar_c_scoped_units\(\)/, plan);
  // The operation is read the same way: once per statement, as its own InitPlan.
  assert.equal((plan.match(/storage\.operation\(\)/g) ?? []).length, 1, plan);
  assert.match(plan, /InitPlan \d+\n\s+->\s+Result\n\s+Output: storage\.operation\(\)/, plan);
  // The 'uploads' bucket keeps its own behaviour, and the private reviewer and
  // evidence buckets keep no policy at all.
  assert.deepEqual((await db.query("select id, public from storage.buckets where id in ('pillar-c-review', 'pillar-c-evidence', 'uploads') order by id")).rows,
    [{ id: "pillar-c-evidence", public: false }, { id: "pillar-c-review", public: false }, { id: "uploads", public: false }]);
}));

test("real PostgreSQL: a definer owned like Supabase's postgres (no superuser, BYPASSRLS) behaves the same; one that cannot bypass RLS answers nothing", { skip: SKIP }, () => withDb(() => ready(), async (db) => {
  const grants = (role) => `grant usage on schema auth, public to ${role};
    grant select on public.user_organizations, public.organizations, public.pillar_c_scoped_org_switch, public.pillar_c_scoped_user_allow to ${role};
    grant execute on function auth.uid() to ${role};`;
  await db.exec(`create role pcs_owner_bypass nologin bypassrls; ${grants("pcs_owner_bypass")}
    alter function public.pillar_c_scoped_units() owner to pcs_owner_bypass;`);
  const fail = [];
  await SCENARIOS.baseline(db, fail);
  assert.deepEqual(fail, []);
  await db.exec(`create role pcs_owner_plain nologin; ${grants("pcs_owner_plain")}
    alter function public.pillar_c_scoped_units() owner to pcs_owner_plain;`);
  for (const id of [ID.a1, ID.r]) await expectSees(db, fail, `${id} with a non-bypass owner`, user(id), []);
  assert.deepEqual(fail, []);
  assert.deepEqual(await as(db, user(ID.a1), async () => (await db.query("select has_function_privilege('authenticated', 'public.pillar_c_scoped_units()', 'execute') as x")).rows[0].x), true);
}));

const snapshot = async (db) => (await db.query(`select jsonb_build_object(
    'policies', (select jsonb_agg(jsonb_build_array(tablename, policyname, cmd, permissive, roles::text, qual, with_check) order by tablename, policyname) from pg_policies where schemaname in ('storage', 'public')),
    'fn', (select jsonb_build_array(prosecdef, provolatile, proconfig, proacl::text, md5(prosrc), proowner::regrole::text) from pg_proc where oid = 'public.pillar_c_scoped_units()'::regprocedure),
    'grants', (select jsonb_agg(jsonb_build_array(table_name, grantee, privilege_type) order by 1, 2, 3) from information_schema.role_table_grants where table_name like 'pillar_c_scoped%'),
    'rls', (select jsonb_agg(jsonb_build_array(relname, relrowsecurity, relforcerowsecurity) order by relname) from pg_class where relname like 'pillar_c_scoped%' and relkind = 'r'),
    'bucket', (select jsonb_agg(to_jsonb(b) - 'created_at' - 'updated_at' order by id) from storage.buckets b),
    'rows', jsonb_build_array((select jsonb_agg(to_jsonb(s) order by org_code) from public.pillar_c_scoped_org_switch s),
                              (select jsonb_agg(to_jsonb(a) order by org_code, user_id) from public.pillar_c_scoped_user_allow a)),
    'objects', (select count(*) from storage.objects)) as s`)).rows[0].s;

test("real PostgreSQL: re-running is idempotent while the bucket is empty, and refused once it holds objects", { skip: SKIP }, () => withDb(() => fresh(), async (db) => {
  await applyMigration(db);
  await db.exec(SEED_USERS());
  await db.exec(ROLLOUT);
  const first = await snapshot(db);
  await applyMigration(db);
  await applyMigration(db);
  assert.deepEqual(await snapshot(db), first, "identical after two more runs, rollout rows kept");
  await db.exec(OBJECTS);
  const loaded = await snapshot(db);
  await assert.rejects(() => applyMigration(db), /PCS_PRE_BUCKET/);
  assert.deepEqual(await snapshot(db), loaded, "a refused run changes nothing");
  const fail = [];
  await SCENARIOS.baseline(db, fail);
  assert.deepEqual(fail, []);
}));

test("real PostgreSQL: an empty bucket created by hand is re-hardened, never adopted with objects", { skip: SKIP }, () => withDb(() => fresh(), async (db) => {
  await db.exec("insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('pillar-c-scoped', 'pillar-c-scoped', true, 52428800, array['text/html'])");
  await applyMigration(db);
  assert.deepEqual((await db.query("select public, file_size_limit::int as l, allowed_mime_types from storage.buckets where id = 'pillar-c-scoped'")).rows[0],
    { public: false, l: 5242880, allowed_mime_types: ["application/json"] });
}));

// Each perturbation of the reviewed starting state must abort the whole
// migration with its stable code and leave nothing behind.
const GUARDS = [
  ["PCS_PRE_AUTH", "alter function auth.uid() rename to uid_renamed"],
  ["PCS_PRE_STORAGE", "alter table storage.objects rename to objects_renamed"],
  ["PCS_PRE_STORAGE", "alter function storage.foldername(text) rename to foldername_renamed"],
  ["PCS_PRE_OWNER", "create role pcs_migrator nologin; grant usage on schema storage, auth to pcs_migrator; set role pcs_migrator"],
  ["PCS_PRE_STORAGE_RLS", "alter table storage.objects disable row level security"],
  ["PCS_PRE_STORAGE_RLS", "alter table storage.buckets disable row level security"],
  ["PCS_PRE_STORAGE_RLS", "alter table storage.prefixes disable row level security"],
  ["PCS_PRE_FOLDERNAME", "create or replace function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$"],
  ["PCS_PRE_OPERATION", "drop function storage.operation()"],
  ["PCS_PRE_OPERATION", "create or replace function storage.operation() returns text language sql stable as $$ select 'storage.object.get_authenticated'::text $$"],
  ["PCS_PRE_OPERATION", "revoke execute on function storage.operation() from public"],
  ["PCS_PRE_STORAGE_DEFINER", "alter function storage.search(text, text, int, int, int, text, text, text) security definer"],
  ["PCS_PRE_STORAGE_DEFINER", "alter function storage.list_objects_with_delimiter(text, text, text, integer, text, text) security definer"],
  ["PCS_PRE_STORAGE_POLICY", `drop policy "read own approved org folder" on storage.objects;
    create policy "read own approved org folder" on storage.objects for select to authenticated using (true)`],
  ["PCS_PRE_STORAGE_POLICY", `create policy "pillar c scoped: early read" on storage.objects for select to authenticated using (bucket_id = 'pillar-c-scoped')`],
  ["PCS_PRE_STORAGE_POLICY", `create policy "list buckets" on storage.buckets for select to authenticated using (true)`],
  ["PCS_PRE_STORAGE_POLICY", `alter policy "read own approved org folder" on storage.objects to public`],
  ["PCS_PRE_STORAGE_POLICY", `create policy "narrowing" on storage.objects as restrictive for select to authenticated using (true)`],
  ["PCS_PRE_STORAGE_POLICY", `create policy "prefixes read" on storage.prefixes for select to authenticated using (true)`],
  ["PCS_PRE_DIRECTORY", "delete from public.organizations where org_code = '204'"],
  ["PCS_PRE_DIRECTORY", "update public.organizations set region_code = '140' where org_code = '204'"],
  ["PCS_PRE_DIRECTORY", "update public.organizations set org_type = 'regione' where org_code = '201'"],
  ["PCS_PRE_DIRECTORY", "update public.organizations set org_type = 'asl' where org_code = '130'"],
  ["PCS_PRE_BUCKET", `insert into storage.buckets (id, name, public) values ('pillar-c-scoped', 'pillar-c-scoped', false);
    insert into storage.objects (bucket_id, name) values ('pillar-c-scoped', 'v1/asl-1/review-${sha("stray")}.json')`],
  ["PCS_PRE_BUCKET", "insert into storage.buckets (id, name, public) values ('pcs-other', 'pillar-c-scoped', false)"],
  ["PCS_PRE_ROLLOUT_POLICY", `create table public.pillar_c_scoped_org_switch (org_code text primary key);
    alter table public.pillar_c_scoped_org_switch enable row level security;
    create policy "open" on public.pillar_c_scoped_org_switch for select to authenticated using (true)`],
  ["PCS_POST_ROLLOUT_SHAPE", "create table public.pillar_c_scoped_user_allow (org_code text, user_id uuid, note text, added_at timestamptz, extra text)"],
];

test("real PostgreSQL: every precondition guard fires with its code and leaves nothing behind", { skip: SKIP }, async () => {
  for (const [code, perturb] of GUARDS) {
    await withDb(() => fresh(), async (db) => {
      await db.exec(perturb);
      const error = await applyMigration(db).then(() => null, (e) => e);
      await db.exec("reset role");
      assert.ok(error, `${code}: the migration applied after: ${perturb}`);
      assert.match(error.message, new RegExp(`^${code}:`), `${perturb} -> ${error.message}`);
      const left = (await db.query(`select to_regprocedure('public.pillar_c_scoped_units()') is null as fn,
        not exists (select 1 from pg_policies where policyname = 'pillar c scoped: entitled units read') as policy`)).rows[0];
      assert.deepEqual(left, { fn: true, policy: true }, `${code}: ${perturb}`);
      if (!/pillar_c_scoped_(org_switch|user_allow)/.test(perturb)) {
        assert.equal((await db.query("select to_regclass('public.pillar_c_scoped_org_switch') is null and to_regclass('public.pillar_c_scoped_user_allow') is null as gone")).rows[0].gone, true, code);
      }
      if (!/'pillar-c-scoped'/.test(perturb)) {
        assert.equal((await db.query("select count(*)::int as n from storage.buckets where id = 'pillar-c-scoped'")).rows[0].n, 0, code);
      }
    });
  }
});

// Every mutant must be caught: either the migration's own post-conditions
// refuse it, or a behavioural scenario fails.
const MUTANTS = [
  ["membership status ignored", "\n      and uo.status = 'approved'\n  ),", "\n  ),"],
  ["more than one membership accepted", "where (select count(*) from me) = 1", "where true"],
  ["no caller filter", "where uo.user_id = (select auth.uid())\n      and uo.status", "where uo.status"],
  ["asl branch without the region pin", "where e.org_type = 'asl' and e.region_code = '130'", "where e.org_type = 'asl'"],
  ["aggregate for any region", "where e.region_code = '130'\n      and ((e.org_type", "where ((e.org_type"],
  ["regione branch without the type", "where e.org_type = 'regione' and e.org_code = '130' and e.region_code = '130'", "where e.org_code = '130' and e.region_code = '130'"],
  ["allowlist acts as all", "where s.mode = 'all'\n       or", "where true\n       or"],
  ["allow row of any organisation", "where a.org_code = one.org_code\n               and a.user_id", "where a.user_id"],
  ["switch row of any organisation", "join public.pillar_c_scoped_org_switch s on s.org_code = one.org_code", "join public.pillar_c_scoped_org_switch s on true"],
  ["no bucket predicate", "bucket_id = 'pillar-c-scoped'\n    and name ~", "name ~"],
  ["unanchored name", "name ~ '^v[1-9][0-9]{0,2}/", "name ~ 'v[1-9][0-9]{0,2}/"],
  ["unanchored end", "[.]json$'", "[.]json'"],
  ["any root", "name ~ '^v[1-9][0-9]{0,2}/", "name ~ '^[^/]+/"],
  ["nested folders", "/[A-Za-z0-9]+(-[A-Za-z0-9]+)*-[0-9a-f]{64}[.]json$'", "/.+-[0-9a-f]{64}[.]json$'"],
  ["first folder instead of the unit", "(storage.foldername(name))[2]", "(storage.foldername(name))[1]"],
  ["for all", "  as permissive\n  for select\n", "  as permissive\n  for all\n"],
  ["to public", "  for select\n  to authenticated\n", "  for select\n  to public\n"],
  ["invoker helper", "security definer\nset search_path", "security invoker\nset search_path"],
  ["helper for anon", "grant execute on function public.pillar_c_scoped_units() to authenticated;", "grant execute on function public.pillar_c_scoped_units() to authenticated, anon;"],
  ["no revoke on the rollout tables", "revoke all on table public.pillar_c_scoped_org_switch, public.pillar_c_scoped_user_allow from public, anon, authenticated;\n", ""],
  ["allow table not forced", "alter table public.pillar_c_scoped_user_allow force row level security;\n", ""],
  ["public bucket", "values ('pillar-c-scoped', 'pillar-c-scoped', false,", "values ('pillar-c-scoped', 'pillar-c-scoped', true,"],
  ["peer mapping swapped", "when '204' then 'asl-4'", "when '204' then 'asl-1'"],
  ["201 mapped to a peer", "when '201' then 'asl-1'", "when '201' then 'asl-3'"],
  ["Regione loses Aziende", "cross join unnest(array['asl-1', 'asl-2', 'asl-3', 'asl-4'])", "cross join unnest(array['asl-1', 'asl-2'])"],
  ["no operation refused", REFUSAL, ""],
  ["signing only refused (copy and move allowed)", REFUSAL, SIGN_ONLY],
  ["batch signing allowed", "not in ('storage.object.sign', 'storage.object.sign_many',\n", "not in ('storage.object.sign',\n"],
  ["copy allowed", "'storage.object.sign_many',\n      'storage.object.copy', 'storage.object.move'", "'storage.object.sign_many',\n      'storage.object.move'"],
  ["move allowed", "'storage.object.copy', 'storage.object.move', 'storage.s3.object.copy'", "'storage.object.copy', 'storage.s3.object.copy'"],
  ["S3 copy allowed", "'storage.object.move', 'storage.s3.object.copy', 'storage.s3.upload.part_copy')", "'storage.object.move', 'storage.s3.upload.part_copy')"],
  ["S3 part copy allowed", ", 'storage.s3.upload.part_copy')\n  );", ")\n  );"],
  ["an unset operation hides objects", "coalesce((select storage.operation()), '') not in", "(select storage.operation()) not in"],
  ["reads refused instead of signing", "'') not in ('storage.object.sign'", "'') in ('storage.object.sign'"],
  ["Azienda without the aggregate","where e.region_code = '130'\n      and ((e.org_type = 'asl' and e.org_code in ('201', '202', '203', '204'))\n        or (e.org_type", "where e.region_code = '130'\n      and ((false)\n        or (e.org_type"],
];
const withoutPostConditions = (text) => text.replace(/do \$post\$[\s\S]*?\$post\$;\n/, "");

// About 50 fresh-database passes (the control, 35 mutants, and a second pass for each mutant a post-condition refuses):
// about 85 s alone, so a suite-wide --test-timeout of 60 s would cancel it. Its own bound overrides that default.
test("real PostgreSQL: every SQL mutant of the migration is caught", { skip: SKIP, timeout: 300_000 }, async (t) => {
  // Runs the scenarios on a migrated database; returns the first failure.
  const behaviour = async (text) => {
    const db = await fresh();
    try {
      const refused = await applyMigration(db, text).then(() => null, (e) => e.message);
      if (refused) return { refused };
      await db.exec(SEED_USERS());
      await db.exec(OBJECTS);
      await db.exec(ROLLOUT);
      for (const name of SCENARIO_ORDER) {
        // Every scenario starts from the same seeded state, as in its own test.
        const copy = await db.clone();
        const fail = [];
        try { await SCENARIOS[name](copy, fail); } catch (e) { fail.push(`error ${e.code ?? e.message}`); } finally { await copy.close(); }
        if (fail.length) return { caught: `${name}: ${fail[0]}` };
      }
      return {};
    } finally { await db.close(); }
  };
  assert.deepEqual(await behaviour(withoutPostConditions(sql)), {}, "the migration without its post-conditions still passes every scenario");
  const escaped = [];
  for (const [label, from, to] of MUTANTS) {
    const text = sql.replace(from, () => to); // a function: no $-patterns in the replacement
    assert.notEqual(text, sql, `mutant "${label}" did not change the migration`);
    assert.equal(sql.split(from).length, 2, `mutant "${label}" targets exactly one place`);
    const result = await behaviour(text);
    if (result.refused) {
      assert.match(result.refused, /^PCS_POST_[A-Z_]+:/, `${label}: refused for another reason: ${result.refused}`);
      // Defence in depth: would the behaviour have caught it without the post-conditions?
      const bare = await behaviour(withoutPostConditions(text));
      t.diagnostic(`${label}: refused by ${result.refused.split(":")[0]}; without post-conditions ${bare.caught ? `caught by ${bare.caught}` : "post-condition only"}`);
    } else if (result.caught) {
      t.diagnostic(`${label}: caught by ${result.caught}`);
    } else {
      escaped.push(label);
    }
  }
  assert.deepEqual(escaped, [], "mutants that survived every scenario");
});

// ------------------------------------------------- private SQL runbooks
// The owner-run production checks live in the private outputs repository
// (outputs/pillar-c/rec5/sql). When present, they are run here against the
// same harness, so the PRECHECK's verdict is proven equal to the migration's
// own guards, VERIFY's pinned fingerprints to the migration as tested, and
// the impersonation sweep and rollout templates to their documented effect.
// They hold no figures; this public test prints no private value.

const PRIVATE_SQL = new URL("../../outputs/pillar-c/rec5/sql/", import.meta.url);
const runbook = {};
for (const name of ["PRECHECK", "VERIFY", "INVENTORY", "IMPERSONATE_ROLLBACK", "ROLLOUT_ENABLE", "ROLLOUT_DISABLE"]) {
  try { runbook[name] = (await readFile(new URL(`${name}.sql`, PRIVATE_SQL), "utf8")).replace(/\r\n/g, "\n"); } catch { /* absent */ }
}
const RUNBOOK_SKIP = SKIP || (Object.keys(runbook).length !== 6 && "Private SQL runbooks unavailable");

// Run a read-only file the way the SQL editor does (one transaction), rolled
// back afterwards; returns the last statement's single jsonb value.
async function readOnly(db, text) {
  await db.exec("begin");
  try {
    const results = await db.exec(text);
    const row = results.at(-1).rows[0];
    return Object.values(row)[0];
  } finally { await db.exec("rollback"); }
}
async function sweep(db, { only = [], testAccounts = [] } = {}) {
  const text = runbook.IMPERSONATE_ROLLBACK
    .replace("v_only uuid[] := '{}';", () => `v_only uuid[] := '{${only.join(",")}}';`)
    .replace("v_test uuid[] := '{}';", () => `v_test uuid[] := '{${testAccounts.join(",")}}';`);
  const error = await db.exec(text).then(() => null, (e) => e);
  assert.ok(error, "the sweep always ends with its result raised as an error");
  assert.match(error.message, /^PCS_SWEEP_RESULT \{/, error.message);
  return JSON.parse(error.message.slice("PCS_SWEEP_RESULT ".length));
}
const filled = (text, values) => Object.entries(values).reduce((t, [k, v]) => t.split(k).join(v), text);
const WELL_FORMED = `
insert into storage.objects (bucket_id, name, metadata) values
  ${VALID.filter((v) => v.root === "v1").map((v) => `('pillar-c-scoped', '${v.name}', '{"mimetype":"application/json","cacheControl":"private, no-store, max-age=0","size":10}')`).join(",\n  ")};
`;

test("private runbooks: read-only files are read-only and no template carries a real UUID", { skip: RUNBOOK_SKIP }, () => {
  for (const [name, text] of Object.entries(runbook)) {
    const code = text.replace(/--.*$/gm, "");
    assert.doesNotMatch(text, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, `${name}: no UUID literal`);
    assert.doesNotMatch(text, /\\/, `${name}: no backslash (editor transfer)`);
    if (name.startsWith("ROLLOUT_")) continue;
    assert.doesNotMatch(code, /\b(insert\s+into|update\s+\w+\.?\w*\s+set|delete\s+from|create|alter|drop|grant|revoke|truncate|commit)\b/i, `${name}: no write`);
    assert.match(code, name === "IMPERSONATE_ROLLBACK" ? /perform set_config\('transaction_read_only', 'on', true\);/ : /^set local transaction_read_only = on;$/m, name);
  }
  assert.match(runbook.ROLLOUT_ENABLE, /'<A1_USER_UUID>'/);
  assert.match(runbook.ROLLOUT_ENABLE, /'<A2_USER_UUID>'/);
  assert.match(runbook.ROLLOUT_DISABLE, /'<SCOPE>'/);
});

test("private runbooks: the PRECHECK verdict equals the migration's own guards", { skip: RUNBOOK_SKIP }, async () => {
  await withDb(() => fresh(), async (db) => {
    const pre = await readOnly(db, runbook.PRECHECK);
    assert.equal(pre.read_only, true);
    assert.equal(pre.search_path_pinned, true);
    assert.equal(pre.would_pass, true, JSON.stringify(pre.checks));
    assert.ok(Object.values(pre.checks).every(Boolean));
    assert.ok(Object.values(pre.first_apply).every(Boolean));
    assert.deepEqual(pre.storage_policies.map((p) => [p.policyname, p.reviewed]), [["read own approved org folder", true], ["upload to own approved org folder", true]]);
    assert.deepEqual(pre.unreviewed_policy_texts, []);
    assert.equal(pre.directory.length, 5);
    assert.ok(pre.storage_tables.some((t) => t.table === "objects" && t.rls === true));
    await applyMigration(db);
    const verify = await readOnly(db, runbook.VERIFY);
    assert.deepEqual(verify.storage_tables, pre.storage_tables, "the migration changes no storage table");
    assert.deepEqual(verify.storage_functions, pre.storage_functions, "the migration changes no storage function");
  });
  // The same perturbations as the guard test, wherever the read-only file can
  // run at all (a renamed storage table or foldername breaks its own parse).
  // The migration raises the FIRST failing guard in its order, so the first
  // false check in that order must be the code the migration raised.
  const ORDER = [...sql.matchAll(/raise exception '(PCS_PRE_[A-Z_]+):/g)].map((m) => m[1]);
  for (const [code, perturb] of GUARDS.filter(([c]) => !["PCS_PRE_STORAGE", "PCS_PRE_OWNER", "PCS_POST_ROLLOUT_SHAPE"].includes(c))) {
    await withDb(() => fresh(), async (db) => {
      await db.exec(perturb);
      const pre = await readOnly(db, runbook.PRECHECK);
      assert.equal(pre.would_pass, false, `${code}: ${perturb}`);
      assert.deepEqual(Object.keys(pre.checks).sort(), [...ORDER].sort());
      assert.equal(ORDER.find((k) => pre.checks[k] === false), code, `${code}: ${perturb}`);
    });
  }
});

test("private runbooks: VERIFY passes on the migration as tested and catches a malformed or unlabelled object", { skip: RUNBOOK_SKIP }, () => withDb(() => fresh(), async (db) => {
  await applyMigration(db);
  let v = await readOnly(db, runbook.VERIFY);
  assert.equal(v.ok, true, JSON.stringify(v.parts));
  assert.equal(v.parts.ok_operation, true);
  assert.equal(v.parts.ok_refusals, true);
  assert.ok(v.policy.qual.endsWith(` AND (COALESCE(( SELECT storage.operation() AS operation), ''::text) <> ALL (ARRAY[${REFUSED_OPS.map((op) => `'${op}'::text`).join(", ")}])))`), v.policy.qual);
  assert.deepEqual(v.refused_operations, Object.fromEntries(REFUSED_OPS.map((op) => [op, true])));
  assert.deepEqual(v.storage_operation, { returns: "text", arguments: 0, reads_setting: true, execute_authenticated: true, definition_md5: v.storage_operation.definition_md5 });
  assert.deepEqual(v.editor_units, []);
  assert.deepEqual(v.rollout.rows, { org_switch: 0, user_allow: 0, switched_on: {} });
  await db.exec(SEED_USERS());
  await db.exec(WELL_FORMED);
  await db.exec(ROLLOUT);
  v = await readOnly(db, runbook.VERIFY);
  assert.equal(v.ok, true, JSON.stringify(v.parts));
  assert.equal(v.objects.total, VALID.length / ROOTS.length);
  assert.deepEqual(Object.keys(v.objects.per_unit).sort(), UNITS.map((u) => `v1/${u}`));
  assert.deepEqual(v.rollout.rows.switched_on, { 130: "allowlist", 204: "allowlist" });
  await db.exec(`insert into storage.objects (bucket_id, name, metadata) values ('pillar-c-scoped', 'v1/asl-4/review.json', '{"mimetype":"application/json","cacheControl":"private, no-store, max-age=0"}'),
    ('pillar-c-scoped', 'v1/asl-4/review-${sha("cache")}.json', '{"mimetype":"application/json","cacheControl":"max-age=3600"}')`);
  v = await readOnly(db, runbook.VERIFY);
  assert.equal(v.ok, false);
  assert.equal(v.parts.ok_names, false);
  assert.equal(v.parts.ok_object_metadata, false);
  assert.equal(v.objects.names_not_matching_policy, 1);
  assert.equal(v.objects.cache_control_not_private, 1);
  await db.exec(`create policy "drift" on storage.objects for select to authenticated using (bucket_id = 'pillar-c-scoped')`);
  v = await readOnly(db, runbook.VERIFY);
  assert.equal(v.parts.ok_no_other_storage_policy, false);
  assert.equal(v.parts.ok_no_policy_on_private_buckets, false);
  // Without an executable storage.operation() every read of the bucket would fail: VERIFY says so.
  await db.exec("revoke execute on function storage.operation() from public");
  v = await readOnly(db, runbook.VERIFY);
  assert.equal(v.parts.ok_operation, false);assert.equal(v.ok, false);
}));

test("private runbooks: VERIFY's policy fingerprint is the migration's policy as tested, every refusal included", { skip: RUNBOOK_SKIP }, async () => {
  // The same migration without the refusal: the fingerprint no longer matches.
  await withDb(() => fresh(), async (db) => {
    await applyMigration(db, withoutPostConditions(sql).replace(REFUSAL, ""));
    const v = await readOnly(db, runbook.VERIFY);
    assert.equal(v.parts.ok_policy, false);assert.equal(v.parts.ok_refusals, false);assert.equal(v.ok, false);
    assert.doesNotMatch(v.policy.qual, /storage\.operation/);
  });
  // The previous policy, which refused signing only: VERIFY names the copy and move operations it lets through.
  await withDb(() => fresh(), async (db) => {
    await applyMigration(db, withoutPostConditions(sql).replace(REFUSAL, SIGN_ONLY));
    const v = await readOnly(db, runbook.VERIFY);
    assert.equal(v.parts.ok_policy, false);assert.equal(v.parts.ok_refusals, false);assert.equal(v.ok, false);
    assert.deepEqual(v.refused_operations, Object.fromEntries(REFUSED_OPS.map((op) => [op, SIGN_OPS.includes(op)])));
  });
});

test("private runbooks: INVENTORY and the impersonation sweep, before and after the test rollout", { skip: RUNBOOK_SKIP }, () => withDb(() => ready({ rollout: false }), async (db) => {
  let inv = await readOnly(db, runbook.INVENTORY);
  const members = (org) => inv.members.filter((m) => m.org_code === org).map((m) => m.user_id).sort();
  assert.deepEqual(members("204"), [ID.a1, ID.a1b, ID.multi].sort());
  assert.deepEqual(members("130"), [ID.r, ID.rb, ID.multi].sort());
  assert.equal(inv.members.find((m) => m.user_id === ID.multi).approved_total, 2);
  assert.equal(inv.members.find((m) => m.user_id === ID.a1).memberships_total, 1);
  assert.ok(inv.members.every((m) => m.allow_listed === false));
  // L2/L3: no rollout row, every approved member of 201-204 and 130 has no unit.
  let s = await sweep(db);
  assert.equal(s.ok, true, JSON.stringify(s.failures));
  assert.equal(s.members_checked, 8);
  // Pending accounts can be checked by UUID before approval.
  s = await sweep(db, { only: [ID.pending, ID.none] });
  assert.equal(s.ok, true);
  assert.equal(s.members_checked, 2);
  // AP4 through the template: placeholders refuse, a wrong account refuses,
  // the right accounts enable exactly A1 and A2.
  const enable = (a1, a2) => db.exec(filled(runbook.ROLLOUT_ENABLE, { "<A1_USER_UUID>": a1, "<A2_USER_UUID>": a2 })).then(() => null, async (e) => { await db.exec("rollback"); return e; });
  assert.equal((await db.exec(runbook.ROLLOUT_ENABLE).then(() => null, async (e) => { await db.exec("rollback"); return e; })).code, "22P02");
  assert.match((await enable(ID.multi, ID.r)).message, /^PCS_ENABLE: A1 must hold exactly one membership/);
  assert.match((await enable(ID.a1, ID.a1)).message, /^PCS_ENABLE: A1 and A2 must be different/);
  assert.match((await enable(ID.a3, ID.r)).message, /^PCS_ENABLE: A1 must hold exactly one membership/);
  assert.equal((await db.query("select count(*)::int as n from public.pillar_c_scoped_org_switch")).rows[0].n, 0, "refusals wrote nothing");
  assert.equal(await enable(ID.a1, ID.r), null);
  assert.equal(await enable(ID.a1, ID.r), null, "idempotent");
  inv = await readOnly(db, runbook.INVENTORY);
  assert.deepEqual(inv.switched_on, { 130: "allowlist", 204: "allowlist" });
  assert.deepEqual(inv.members.filter((m) => m.allow_listed).map((m) => m.user_id).sort(), [ID.a1, ID.r].sort());
  s = await sweep(db, { testAccounts: [ID.a1, ID.r, ID.a3] });
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.equal(s.signable_total, 0, "no member can sign an object");
  assert.equal(s.copyable_total, 0, "no member can copy or move an object");
  const policyUsing = (text) => db.exec(`alter policy "pillar c scoped: entitled units read" on storage.objects using (\n${text})`);
  // A policy that lost its operation refusal is reported member by member, even though every read is still correct.
  await policyUsing(POLICY_USING.replace(REFUSAL, ""));
  const lost = await sweep(db, { testAccounts: [ID.a1, ID.r, ID.a3] });
  assert.equal(lost.ok, false);
  assert.deepEqual(lost.failures.map((f) => [f.user_id, f.outside, f.signable > 0, f.copyable > 0, f.download === f.visible_total]).sort(),
    [[ID.a1, 0, true, true, true], [ID.r, 0, true, true, true]].sort());
  // The previous policy, which refused signing only: the same members are reported as able to copy (REV-SD-01).
  await policyUsing(POLICY_USING.replace(REFUSAL, SIGN_ONLY));
  const signOnly = await sweep(db, { testAccounts: [ID.a1, ID.r, ID.a3] });
  assert.equal(signOnly.ok, false);
  assert.equal(signOnly.signable_total, 0);
  assert.ok(signOnly.copyable_total > 0);
  assert.deepEqual(signOnly.failures.map((f) => [f.user_id, f.outside, f.signable, f.copyable > 0, f.download === f.visible_total]).sort(),
    [[ID.a1, 0, 0, true, true], [ID.r, 0, 0, true, true]].sort());
  await policyUsing(POLICY_USING);
  assert.equal((await sweep(db, { testAccounts: [ID.a1, ID.r, ID.a3] })).ok, true, "restored");
  const fail = [];
  await expectSees(db, fail, "A1 after ROLLOUT_ENABLE", user(ID.a1), AZ4);
  await expectSees(db, fail, "A2 after ROLLOUT_ENABLE", user(ID.r), ALL5);
  await expectSees(db, fail, "A3 after ROLLOUT_ENABLE", user(ID.a3), []);
  await expectSees(db, fail, "another 204 member after ROLLOUT_ENABLE", user(ID.a1b), []);
  assert.deepEqual(fail, []);
  // The sweep is not vacuous: a member switched on outside the test accounts,
  // or a drifted policy, is reported.
  await db.exec("update public.pillar_c_scoped_org_switch set mode = 'all' where org_code = '204'");
  s = await sweep(db, { testAccounts: [ID.a1, ID.r, ID.a3] });
  assert.equal(s.ok, false);
  assert.deepEqual(s.non_test_members_with_units.map((m) => m.user_id), [ID.a1b]);
  await db.exec("update public.pillar_c_scoped_org_switch set mode = 'allowlist' where org_code = '204'");
  await db.exec(`create policy "drift" on storage.objects for select to authenticated using (bucket_id = 'pillar-c-scoped')`);
  s = await sweep(db, { testAccounts: [ID.a1, ID.r, ID.a3] });
  assert.equal(s.ok, false);
  assert.ok(s.failures.some((f) => f.user_id === ID.a1b && f.outside > 0));
  await db.exec(`drop policy "drift" on storage.objects`);
  // The kill switch, through the template.
  const disable = (scope, org = "<ORG_CODE>", uid = "<USER_UUID>") => db.exec(filled(runbook.ROLLOUT_DISABLE, { "<SCOPE>": scope, "<ORG_CODE>": org, "<USER_UUID>": uid })).then(() => null, async (e) => { await db.exec("rollback"); return e; });
  assert.match((await db.exec(runbook.ROLLOUT_DISABLE).then(() => null, async (e) => { await db.exec("rollback"); return e; })).message, /^PCS_DISABLE: set v_scope/);
  assert.match((await disable("user", "204", ID.a1b)).message, /^PCS_DISABLE: no allow row/);
  assert.equal(await disable("user", "204", ID.a1), null);
  await expectSees(db, fail, "A1 after its allow row is deleted", user(ID.a1), []);
  await expectSees(db, fail, "A2 unaffected", user(ID.r), ALL5);
  assert.equal(await disable("org", "130"), null);
  await expectSees(db, fail, "A2 after 130 is switched off", user(ID.r), []);
  assert.match((await disable("org", "130")).message, /^PCS_DISABLE: organisation 130 was not switched on/);
  assert.equal(await disable("all"), null);
  assert.deepEqual(fail, []);
  inv = await readOnly(db, runbook.INVENTORY);
  assert.deepEqual([inv.switched_on, inv.allow_rows], [{}, 0]);
  s = await sweep(db, { testAccounts: [ID.a1, ID.r, ID.a3] });
  assert.equal(s.ok, true);
}));
