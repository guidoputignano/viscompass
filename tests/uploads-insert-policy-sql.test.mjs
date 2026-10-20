import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261020150000_uploads_insert_path_check.sql", import.meta.url), "utf8");
let PGlite;
try {
  ({ PGlite } = await import("../../outputs/pillar-b/node_modules/@electric-sql/pglite/dist/index.js"));
} catch {
  // The pinned PostgreSQL harness lives outside the public checkout; no production dependency is added for it.
}

// Synthetic identities only.
const A = "00000000-0000-4000-8000-0000000000a1", B = "00000000-0000-4000-8000-0000000000b2", P = "00000000-0000-4000-8000-0000000000c3";
const BS = String.fromCharCode(92);
// The production shape of the tables and policies this migration touches (supabase_schema.sql sections 3–4).
const shim = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.organizations(org_code text primary key);
create table public.user_organizations(user_id uuid references auth.users(id), org_code text references public.organizations(org_code), status text);
create table public.uploads (
  id bigint generated always as identity primary key,
  org_code text not null references public.organizations(org_code),
  uploaded_by uuid not null references auth.users(id),
  file_name text not null, storage_path text not null,
  period_covered_start date, period_covered_end date,
  status text not null default 'uploaded' check (status in ('uploaded','processing','reconciled','discrepancy_found')),
  reconciliation_summary jsonb, uploaded_at timestamptz default now(), reconciled_at timestamptz);
alter table public.uploads enable row level security;
create policy "read own org uploads" on public.uploads for select using (exists (
  select 1 from public.user_organizations uo where uo.user_id = auth.uid() and uo.status = 'approved' and uo.org_code = uploads.org_code));
create policy "upload for own approved org" on public.uploads for insert with check (
  exists (select 1 from public.user_organizations uo where uo.user_id = auth.uid() and uo.status = 'approved' and uo.org_code = uploads.org_code)
  and status = 'uploaded' and reconciliation_summary is null and reconciled_at is null);
grant usage on schema public, auth to authenticated; grant execute on function auth.uid() to authenticated;
grant select on public.user_organizations, public.organizations to authenticated; grant select, insert on public.uploads to authenticated;
insert into auth.users values ('${A}'), ('${B}'), ('${P}');
insert into public.organizations values ('201'), ('202'), ('130');
insert into public.user_organizations values ('${A}', '201', 'approved'), ('${B}', '202', 'approved'), ('${P}', '201', 'pending');
`;
async function withDb(fn, { migrate = true } = {}) {
  const db = new PGlite();
  try { await db.exec(shim); if (migrate) await db.exec(migration); await fn(db); } finally { await db.close(); }
}
async function insertAs(db, user, row) {
  await db.exec("set role authenticated");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    await db.query("insert into public.uploads(org_code, uploaded_by, file_name, storage_path) values ($1, $2, 'x.xlsx', $3)", [row.org, row.by ?? user, row.path]);
    return true;
  } catch (e) {
    assert.equal(e.code, "42501", `${row.path}: refused by the policy, not by another error (${e.message})`);
    return false;
  } finally { await db.exec("reset role"); }
}
const skip = !PGlite && "Pinned external PGlite harness unavailable";

test("before this migration a client-chosen path outside the own folder is accepted (the gap)", { skip }, () => withDb(async db => {
  assert.equal(await insertAs(db, A, { org: "201", path: "202/1729000000000-x.xlsx" }), true);
  assert.equal(await insertAs(db, A, { org: "201", path: "201/../../pillar-c-scoped/v1/asl-1/x.json" }), true);
}, { migrate: false }));

test("the policy accepts the upload shell's paths and refuses every other folder, traversal and spoofed uploader", { skip }, () => withDb(async db => {
  for (const path of ["201/1729000000000-DIR_OSP_TRA_003AS_estrazione_2025.xlsx", "201/1729000000000-Spesa 2025 (v2).xlsx", "201/file.xlsx", "201/1729000000000-a!b*c'd&e$f=g@h;i:j+k,l?m-n_o.csv"])
    assert.equal(await insertAs(db, A, { org: "201", path }), true, path);
  const refused = [
    "202/1729000000000-x.xlsx", "2010/x.xlsx", "20/x.xlsx", "/201/x.xlsx", "201//x.xlsx", "201/sub/x.xlsx", "201/", "201",
    "../pillar-c-scoped/v1/asl-1/x.json", "201/../x.xlsx", "201/..", "201/a..b.xlsx", "201/.hidden.xlsx", "201/-x.xlsx",
    "201/%2e%2e/x.json", "201/a%2fb.xlsx", `201/..${BS}x.json`, `201/a${BS}b.xlsx`, "201/x\ty.xlsx", "201/x\ny.xlsx", "201/è.xlsx", "201/x#1.xlsx",
    `201/${"a".repeat(1021)}`,
  ];
  for (const path of refused) assert.equal(await insertAs(db, A, { org: "201", path }), false, JSON.stringify(path));
  assert.equal(await insertAs(db, A, { org: "201", path: `201/${"a".repeat(1020)}` }), true, "1024 characters is the inclusive limit");
  assert.equal(await insertAs(db, A, { org: "202", path: "202/x.xlsx" }), false, "another organisation's row");
  assert.equal(await insertAs(db, A, { org: "201", path: "201/x.xlsx", by: B }), false, "a spoofed uploader");
  assert.equal(await insertAs(db, P, { org: "201", path: "201/x.xlsx" }), false, "a pending member");
  assert.equal(await insertAs(db, B, { org: "202", path: "202/1729000000000-x.xlsx" }), true, "each organisation in its own folder");
}));

test("the migration is idempotent and refuses a database whose policies differ from the reviewed shape", { skip }, async () => {
  await withDb(async db => { await db.exec(migration); assert.equal((await db.query("select count(*)::int n from pg_policies where tablename = 'uploads' and cmd = 'INSERT'")).rows[0].n, 1); });
  await withDb(async db => {
    await db.exec(`create policy "extra insert" on public.uploads for insert with check (true)`);
    await assert.rejects(() => db.exec(migration), /UPL_PRE_OTHER_POLICY/);
  }, { migrate: false });
  await withDb(async db => {
    await db.exec(`drop policy "upload for own approved org" on public.uploads`);
    await assert.rejects(() => db.exec(migration), /UPL_PRE_POLICY/);
  }, { migrate: false });
});

test("the SQL rule and the application rule (lib/uploads/storage-path.ts) use the same character set", async () => {
  const app = await readFile(new URL("../lib/uploads/storage-path.ts", import.meta.url), "utf8");
  const appSet = app.match(/const SEGMENT = \/\^\[A-Za-z0-9\]\[([^\]]+)\]\*\$\//)?.[1];
  const sqlSet = migration.match(/\^\[A-Za-z0-9\]\[([^\]]+)\]\*\$/)?.[1]?.replace("''", "'");
  assert.ok(appSet && sqlSet, "both rules are present");
  assert.equal(sqlSet, appSet);
  assert.doesNotMatch(migration, new RegExp(BS + BS), "the migration carries no backslash");
});
