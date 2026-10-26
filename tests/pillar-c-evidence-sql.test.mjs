import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261019120000_pillar_c_evidence_workflow.sql", import.meta.url), "utf8");
import { PGlite, PGLITE_SKIP } from "./helpers/pglite.mjs";
const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const pending = "00000000-0000-4000-8000-000000000003";
const revoked = "00000000-0000-4000-8000-000000000004";
const attachment = "00000000-0000-4000-8000-000000000011";
const source = {
  source_snapshot: "a".repeat(64), source_group: "e".repeat(64), source_sha256: "b".repeat(64), classification_sha256: "c".repeat(64),
  mapping_version: "test-synthetic-v1", period: "FY2025", org: "Regione", channel: "Tutti",
  product_key: "SYNTHETIC-001", product_label: "Invented aggregate evidence fixture", source_state: "S3",
};
const shim = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create schema auth; create table auth.users(id uuid primary key);
create table public.organizations(org_code text primary key);
create table public.user_organizations(user_id uuid references auth.users(id),org_code text references public.organizations(org_code),status text);
grant usage on schema auth to service_role;
grant select on public.user_organizations to service_role;
insert into auth.users values ('${actor}'),('${owner}'),('${pending}'),('${revoked}');
insert into public.organizations values ('SYNTHETIC-A'),('SYNTHETIC-B');
insert into public.user_organizations values
('${actor}','SYNTHETIC-A','approved'),('${owner}','SYNTHETIC-B','approved'),
('${pending}','SYNTHETIC-A','pending'),('${revoked}','SYNTHETIC-B','revoked');
`;
async function withDb(fn) {
  const db = new PGlite();
  try { await db.exec(shim); await db.exec(migration); await fn(db); }
  finally { await db.close(); }
}
async function role(db, name, fn) {
  await db.exec(`set role ${name}`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const create = async (db, actorId = actor, input = source) => (await db.query("select public.c_evidence_create($1::uuid,$2::jsonb) as value", [actorId, JSON.stringify(input)])).rows[0].value;
const mutate = async (db, c, action, payload = {}, actorId = actor, revision = c.revision) => (await db.query(
  "select public.c_evidence_mutate($1::uuid,$2::uuid,$3::integer,$4::text,$5::jsonb) as value",
  [actorId, c.id, revision, action, JSON.stringify(payload)],
)).rows[0].value;
const rejected = (fn, code) => assert.rejects(fn, error => error.code === code, `expected SQLSTATE ${code}`);

test("private C migration exposes only service workflow RPCs and forces RLS", () => {
  for (const name of ["cases", "events", "attachments"]) {
    assert.match(migration, new RegExp(`alter table public\\.c_evidence_${name} enable row level security`, "i"));
    assert.match(migration, new RegExp(`alter table public\\.c_evidence_${name} force row level security`, "i"));
  }
  assert.doesNotMatch(migration, /create\s+policy|grant\s+[^;]+\s+to\s+(?:authenticated|anon)\b/i);
  assert.match(migration, /revoke all on function public\.c_evidence_create\(uuid,jsonb\) from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.c_evidence_mutate\(uuid,uuid,integer,text,jsonb\) from public, anon, authenticated/);
  assert.doesNotMatch(migration, /security\s+definer/i);
  assert.doesNotMatch(migration, /(?:update|insert into|delete from)\s+(?:public\.)?(?:canonical_fact|ven_mapping|pillar_[abc]_active_release)\b/i);
  for (const fn of ["c_evidence_trim(text)", "c_evidence_event_matches_case()", "c_evidence_case_audited()", "c_evidence_attachment_audited()"]) {
    assert.ok(migration.includes(`revoke all on function public.${fn} from public, anon, authenticated`), fn);
  }
  // 4 MiB everywhere (Vercel rejects function bodies over 4.5 MB); no object policies.
  assert.doesNotMatch(migration, /5242880/);
  assert.match(migration, /byte_size integer not null check \(byte_size between 1 and 4194304\)/);
  assert.match(migration, /\(p_payload->>'byte_size'\)::integer not between 1 and 4194304/);
  assert.match(migration, /'pillar-c-evidence', false, 4194304, array\['application\/pdf', 'text\/csv', 'text\/plain'\]/);
  assert.doesNotMatch(migration, /\bon\s+storage\.objects\b/i);
  // Free text uses the whitespace-aware trim, never plain btrim() or E'' escapes.
  assert.doesNotMatch(migration, /btrim\(\s*(?:coalesce\(\s*)?p_(?:payload|source)/i);
  assert.doesNotMatch(migration, /\bE'/);
  assert.match(migration, /^begin;$/m); assert.match(migration, /^commit;\s*$/m);
});

test("real PostgreSQL: anonymous, ordinary approved and stale reviewer sessions cannot read or call RPCs", { skip: PGLITE_SKIP }, async () => withDb(async db => {
  const c = await role(db, "service_role", () => create(db));
  await db.exec(migration);
  assert.equal((await db.query("select id from public.c_evidence_cases")).rows[0].id, c.id, "idempotent migration preserves cases");
  for (const name of ["anon", "authenticated"]) await role(db, name, async () => {
    for (const table of ["cases", "events", "attachments"]) {
      await rejected(() => db.query(`select * from public.c_evidence_${table}`), "42501");
      await rejected(() => db.query(`delete from public.c_evidence_${table}`), "42501");
    }
    await rejected(() => create(db), "42501");
    await rejected(() => mutate(db, c, "review"), "42501");
    await rejected(() => db.query("select public.c_evidence_trim('x')"), "42501");
  });
  const functions = (await db.query(`select p.proname, p.prosecdef, p.provolatile, p.proconfig,
    has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
    has_function_privilege('service_role', p.oid, 'execute') as service from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname like 'c_evidence_%' order by p.proname`)).rows;
  assert.deepEqual(functions.map(f => f.proname), ["c_evidence_attachment_audited", "c_evidence_case_audited", "c_evidence_create", "c_evidence_event_matches_case", "c_evidence_guard", "c_evidence_mutate", "c_evidence_trim"]);
  for (const f of functions) {
    assert.equal(f.prosecdef, false, f.proname); assert.equal(f.anon, false, f.proname); assert.equal(f.authenticated, false, f.proname);
    assert.ok(f.proconfig?.some(setting => setting.startsWith("search_path=")), `${f.proname} pins search_path`);
  }
  assert.deepEqual(functions.filter(f => f.service).map(f => f.proname), ["c_evidence_create", "c_evidence_mutate", "c_evidence_trim"]);
  assert.equal(functions.find(f => f.proname === "c_evidence_trim").provolatile, "i");
  // Prove RLS itself denies all rows even if a future default table grant were
  // accidentally restored. No caller role or JWT capability can create a row.
  await db.exec("grant select, insert, update on public.c_evidence_cases to authenticated");
  await role(db, "authenticated", async () => {
    assert.equal((await db.query("select * from public.c_evidence_cases")).rows.length, 0);
    await rejected(() => db.query("insert into public.c_evidence_cases(source,source_snapshot,source_group,product_key,source_state,created_by,updated_by) values ($1,$2,$2,'forged','S3',$3,$3)", [source, source.source_snapshot, actor]), "42501");
    assert.equal((await db.query("update public.c_evidence_cases set state='closed' returning id")).rows.length, 0);
  });
}));

test("real PostgreSQL: creates are duplicate safe, actor approvals and frozen source are enforced", { skip: PGLITE_SKIP }, async () => withDb(async db => role(db, "service_role", async () => {
  for (const id of [null, pending, revoked]) await rejected(() => create(db, id), "42501");
  for (const input of [null, [], "invalid", { ...source, period: "FY2024" }, { ...source, org: "AQ" }, { ...source, source_state: "S2" }, { ...source, injected: "value" }, { ...source, product_key: null }]) {
    await rejected(() => create(db, actor, input), "22023");
  }
  const c = await create(db);
  assert.equal(c.revision, 1); assert.equal(c.owner_id, null); assert.equal(c.state, "unassigned");
  assert.deepEqual(await create(db), c);
  await rejected(() => create(db, actor, { ...source, product_label: "changed" }), "22023");
  assert.equal((await db.query("select * from public.c_evidence_events")).rows.length, 1);
  await rejected(() => db.query("update public.c_evidence_cases set source=$1,revision=2 where id=$2", [{ ...source, period: "FY2024" }, c.id]), "22023");
  await rejected(() => mutate(db, c, "review", {}, pending), "42501");
})));

test("real PostgreSQL: source groups distinguish split product evidence and attachment cap is serialized", { skip: PGLITE_SKIP }, async () => withDb(async db => role(db, "service_role", async () => {
  let c = await create(db);
  const split = await create(db, actor, { ...source, source_group: "f".repeat(64) });
  assert.notEqual(split.id, c.id); assert.equal(split.product_key, c.product_key);
  const assigned = { owner_id: owner, role: "Verifier", due_date: "2026-11-01" };
  const saves = await Promise.allSettled([mutate(db, c, "assign", assigned), mutate(db, c, "assign", assigned)]);
  assert.equal(saves.filter(s => s.status === "fulfilled").length, 1);
  assert.equal(saves.find(s => s.status === "rejected").reason.code, "40001");
  c = saves.find(s => s.status === "fulfilled").value;
  for (let i = 1; i <= 10; i++) {
    const id = `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    c = await mutate(db, c, "attach", { attachment_id: id, file_name: `aggregate-${i}.csv`, storage_path: `${c.id}/${id}`, media_type: "text/csv", byte_size: 1, sha256: "d".repeat(64) });
  }
  const id = "10000000-0000-4000-8000-000000000011";
  await rejected(() => mutate(db, c, "attach", { attachment_id: id, file_name: "aggregate-11.csv", storage_path: `${c.id}/${id}`, media_type: "text/csv", byte_size: 1, sha256: "d".repeat(64) }), "22023");
  assert.equal((await db.query("select count(*)::integer as count from public.c_evidence_attachments where case_id=$1", [c.id])).rows[0].count, 10);
})));

test("real PostgreSQL: failure appending audit rolls back attachment metadata and revision atomically", { skip: PGLITE_SKIP }, async () => withDb(async db => {
  const c = await role(db, "service_role", () => create(db));
  // Force the LAST statement of mutate (the audit insert) to fail, after the
  // attachment and case writes. A stray event is itself rejected now, so the
  // fault is injected by the owner as a temporary constraint.
  await db.exec("alter table public.c_evidence_events add constraint tmp_fail check (action <> 'attach')");
  await role(db, "service_role", () => rejected(() => mutate(db, c, "attach", { attachment_id: attachment, file_name: "aggregate.pdf", storage_path: `${c.id}/${attachment}`, media_type: "application/pdf", byte_size: 10, sha256: "d".repeat(64) }), "23514"));
  assert.equal((await db.query("select * from public.c_evidence_attachments")).rows.length, 0);
  assert.equal((await db.query("select revision from public.c_evidence_cases where id=$1", [c.id])).rows[0].revision, 1);
}));

test("real PostgreSQL: stray events and direct case or attachment writes cannot bypass the audited state machine", { skip: PGLITE_SKIP }, async () => withDb(async db => {
  let c = await role(db, "service_role", () => create(db));
  const stray = revision => db.query("insert into public.c_evidence_events(case_id,revision,action,actor_id,detail) values($1,$2,'review',$3,'{}')", [c.id, revision, actor]);
  const directClose = () => db.query("update public.c_evidence_cases set state='closed',closed_at=clock_timestamp(),revision=revision+1 where id=$1", [c.id]);
  const bareAttachment = size => db.query("insert into public.c_evidence_attachments(id,case_id,file_name,storage_path,media_type,byte_size,sha256,created_by) values($1,$2,'aggregate.pdf',$3,'application/pdf',$4,$5,$6)", [attachment, c.id, `${c.id}/${attachment}`, size, "d".repeat(64), actor]);
  // The service role and the table owner (superuser here) are both held to it.
  for (const as of [fn => role(db, "service_role", fn), fn => fn()]) await as(async () => {
    for (const revision of [2, 3]) await rejected(() => stray(revision), "40001");
    await rejected(() => stray(1), "23505");
    await rejected(directClose, "42501");
    await rejected(() => db.query("insert into public.c_evidence_cases(source,source_snapshot,source_group,product_key,source_state,created_by,updated_by) values ($1,$2,$3,'forged','S3',$4,$4)", [source, source.source_snapshot, "9".repeat(64), actor]), "42501");
    await rejected(() => bareAttachment(10), "42501");
    await rejected(() => bareAttachment(4194305), "23514");
  });
  assert.deepEqual((await db.query("select state, revision, decision, closed_at from public.c_evidence_cases")).rows, [{ state: "unassigned", revision: 1, decision: null, closed_at: null }]);
  assert.equal((await db.query("select count(*)::integer as count from public.c_evidence_events")).rows[0].count, 1);
  assert.equal((await db.query("select count(*)::integer as count from public.c_evidence_attachments")).rows[0].count, 0);
  // The RPC path is unaffected and leaves one event per revision.
  await role(db, "service_role", async () => {
    c = await mutate(db, c, "assign", { owner_id: owner, role: "Verifier", due_date: "2026-11-01" });
    c = await mutate(db, c, "attach", { attachment_id: attachment.toUpperCase(), file_name: "aggregate.pdf", storage_path: `${c.id}/${attachment}`, media_type: "application/pdf", byte_size: 10, sha256: "d".repeat(64) });
  });
  assert.equal(c.revision, 3);
  assert.deepEqual((await db.query("select revision, action from public.c_evidence_events order by revision")).rows, [{ revision: 1, action: "create" }, { revision: 2, action: "assign" }, { revision: 3, action: "attach" }]);
}));

test("real PostgreSQL: free text is trimmed of every whitespace character and blank text is rejected", { skip: PGLITE_SKIP }, async () => withDb(async db => role(db, "service_role", async () => {
  let c = await create(db);
  const blanks = ["\n", "\r\n\t ", "  ", " ﻿"];
  for (const text of blanks) await rejected(() => mutate(db, c, "assign", { owner_id: owner, role: text, due_date: "2026-11-01" }), "22023");
  c = await mutate(db, c, "assign", { owner_id: owner, role: "\tVerifier\r\n", due_date: "2026-11-01" });
  assert.equal(c.assigned_role, "Verifier");
  c = await mutate(db, c, "review");
  for (const text of blanks) await rejected(() => mutate(db, c, "record_decision", { decision: "remains_uncertain", note: text }), "22023");
  c = await mutate(db, c, "record_decision", { decision: "remains_uncertain", note: "\n  Aggregate evidence remains insufficient\n\n" });
  assert.equal(c.decision_note, "Aggregate evidence remains insufficient");
  for (const text of blanks) await rejected(() => mutate(db, c, "followup", { owner_id: owner, due_date: "2026-11-02", note: text }), "22023");
  c = await mutate(db, c, "followup", { owner_id: owner, due_date: "2026-11-02", note: "Obtain organizational receipt\n", outcome: "\n" });
  assert.equal(c.follow_up_note, "Obtain organizational receipt"); assert.equal(c.follow_up_outcome, null);
  await rejected(() => mutate(db, c, "attach", { attachment_id: attachment, file_name: "aggregate.pdf\n", storage_path: `${c.id}/${attachment}`, media_type: "application/pdf", byte_size: 10, sha256: "d".repeat(64) }), "22023");
  c = await mutate(db, c, "attach", { attachment_id: attachment, file_name: "  aggregate evidence.pdf ", storage_path: `${c.id}/${attachment}`, media_type: "application/pdf", byte_size: 10, sha256: "d".repeat(64) });
  assert.equal((await db.query("select file_name from public.c_evidence_attachments")).rows[0].file_name, "aggregate evidence.pdf");
  for (const text of blanks) await rejected(() => mutate(db, c, "close", { outcome: text }), "22023");
  c = await mutate(db, c, "close", { outcome: "Recorded as unresolved\nwithout analytical activation\r\n" });
  assert.equal(c.follow_up_outcome, "Recorded as unresolved\nwithout analytical activation", "inner line breaks are kept");
  for (const text of blanks) await rejected(() => mutate(db, c, "reopen", { note: text }), "22023");
  c = await mutate(db, c, "reopen", { note: "New organizational evidence\n" });
  const payloads = Object.fromEntries((await db.query("select action, detail->'payload' as payload from public.c_evidence_events where case_id=$1", [c.id])).rows.map(e => [e.action, e.payload]));
  assert.equal(payloads.assign.role, "Verifier"); assert.equal(payloads.record_decision.note, "Aggregate evidence remains insufficient");
  assert.equal(payloads.followup.note, "Obtain organizational receipt"); assert.equal(payloads.followup.outcome, "");
  assert.equal(payloads.attach.file_name, "aggregate evidence.pdf"); assert.equal(payloads.reopen.note, "New organizational evidence");
  assert.equal(payloads.followup.owner_id, owner); assert.equal(payloads.attach.byte_size, 10);
})));

test("real PostgreSQL: the responsible organization is chosen deterministically and re-checked at review", { skip: PGLITE_SKIP }, async () => withDb(async db => {
  const multi = "00000000-0000-4000-8000-000000000005";
  // Inserted B first, so an unordered pick would return B.
  await db.exec(`insert into auth.users values ('${multi}'); insert into public.user_organizations values ('${multi}','SYNTHETIC-B','approved'),('${multi}','SYNTHETIC-A','approved');`);
  await role(db, "service_role", async () => {
    let c = await create(db);
    c = await mutate(db, c, "assign", { owner_id: multi, role: "Verifier", due_date: "2026-11-01" });
    assert.equal(c.responsible_org_code, "SYNTHETIC-A");
    await db.query("update public.user_organizations set status='revoked' where user_id=$1 and org_code='SYNTHETIC-A'", [multi]);
    await rejected(() => mutate(db, c, "review"), "22023");
    c = await mutate(db, c, "assign", { owner_id: multi, role: "Verifier", due_date: "2026-11-01" });
    assert.equal(c.responsible_org_code, "SYNTHETIC-B");
    c = await mutate(db, c, "review");
    assert.equal(c.state, "in_review");
  });
}));

test("real PostgreSQL: owners, transitions, attachments, closure, audit, reopening and stale saves", { skip: PGLITE_SKIP }, async () => withDb(async db => role(db, "service_role", async () => {
  let c = await create(db);
  await rejected(() => mutate(db, c, "review"), "22023");
  for (const id of [pending, revoked]) await rejected(() => mutate(db, c, "assign", { owner_id: id, role: "Verifier", due_date: "2026-11-01" }), "42501");
  await rejected(() => mutate(db, c, "assign", { owner_id: owner, role: "Verifier", due_date: "2026-02-30" }), "22023");
  c = await mutate(db, c, "assign", { owner_id: owner, role: "Verifier", due_date: "2026-11-01" });
  assert.equal(c.responsible_org_code, "SYNTHETIC-B");
  await rejected(() => mutate(db, c, "review", {}, actor, 1), "40001");
  await db.query("update public.user_organizations set status='revoked' where user_id=$1", [owner]);
  await rejected(() => mutate(db, c, "review"), "22023");
  await db.query("update public.user_organizations set status='approved' where user_id=$1", [owner]);
  await db.query("update public.user_organizations set status='revoked' where user_id=$1", [actor]);
  await rejected(() => mutate(db, c, "review"), "42501");
  await db.query("update public.user_organizations set status='approved' where user_id=$1", [actor]);
  c = await mutate(db, c, "review");
  await rejected(() => mutate(db, c, "record_decision", { decision: "mapping_activated", note: "No" }), "22023");
  await rejected(() => mutate(db, c, "record_decision", { decision: "evidence_sufficient", note: "No attachment" }), "22023");
  c = await mutate(db, c, "record_decision", { decision: "remains_uncertain", note: "Aggregate evidence remains insufficient" });
  c = await mutate(db, c, "followup", { owner_id: owner, due_date: "2026-11-02", note: "Obtain organizational receipt" });
  await rejected(() => mutate(db, c, "close", { outcome: "Recorded as unresolved" }), "22023");
  // 4 MiB is the exact limit (C_EVIDENCE_MAX_FILE); one byte more is rejected.
  const meta = { attachment_id: attachment, file_name: "aggregate-evidence.pdf", storage_path: `${c.id}/${attachment}`, media_type: "application/pdf", byte_size: 4194304, sha256: "d".repeat(64) };
  for (const bad of [{ ...meta, storage_path: `${c.id}/other` }, { ...meta, file_name: "../private.pdf" }, { ...meta, byte_size: 4194305 }, { ...meta, byte_size: 5242880 }, { ...meta, byte_size: 0 }, { ...meta, media_type: "text/html" }, { ...meta, sha256: "bad" }]) {
    await rejected(() => mutate(db, c, "attach", bad), "22023");
  }
  c = await mutate(db, c, "attach", meta);
  const beforeDuplicate = c.revision;
  await rejected(() => mutate(db, c, "attach", meta), "23505");
  assert.equal((await db.query("select revision from public.c_evidence_cases where id=$1", [c.id])).rows[0].revision, beforeDuplicate);
  c = await mutate(db, c, "close", { outcome: "Recorded as unresolved; organizational request sent" });
  assert.equal(c.state, "closed"); assert.equal(c.decision, "remains_uncertain"); assert.ok(c.closed_at);
  await rejected(() => mutate(db, c, "record_decision", { decision: "evidence_sufficient", note: "overwrite" }), "22023");
  const decision = c.decision;
  c = await mutate(db, c, "reopen", { note: "New organizational evidence received" });
  assert.equal(c.decision, decision); assert.equal(c.state, "in_review"); assert.equal(c.closed_at, null);
  await rejected(() => mutate(db, c, "close", { outcome: "reuse previous decision" }), "22023");
  c = await mutate(db, c, "record_decision", { decision: "needs_local_allocation", note: "Local ownership still requires organizational evidence" });
  c = await mutate(db, c, "followup", { owner_id: owner, due_date: "2026-11-03", note: "Await organizational allocation", outcome: "Recorded without analytical activation" });
  c = await mutate(db, c, "close");
  const events = (await db.query("select * from public.c_evidence_events where case_id=$1 order by revision", [c.id])).rows;
  assert.deepEqual(events.map(e => e.revision), Array.from({ length: c.revision }, (_, i) => i + 1));
  assert.equal(events.filter(e => e.action === "record_decision").length, 2);
  assert.equal(events.find(e => e.action === "reopen").detail.before.decision, "remains_uncertain");
  assert.equal((await db.query("select * from public.c_evidence_attachments")).rows.length, 1);
  for (const table of ["c_evidence_events", "c_evidence_attachments"]) {
    await rejected(() => db.query(`update public.${table} set created_at=clock_timestamp()`), "42501");
    await rejected(() => db.query(`delete from public.${table}`), "42501");
  }
})));

test("real PostgreSQL: append-only history and source guards also reject privileged rewrites", { skip: PGLITE_SKIP }, async () => withDb(async db => {
  const c = await role(db, "service_role", () => create(db));
  await role(db, "service_role", () => mutate(db, c, "attach", { attachment_id: attachment, file_name: "aggregate.pdf", storage_path: `${c.id}/${attachment}`, media_type: "application/pdf", byte_size: 10, sha256: "d".repeat(64) }));
  // A plain "truncate public.c_evidence_cases" already fails on the foreign keys.
  const truncates = ["truncate public.c_evidence_events", "truncate public.c_evidence_attachments", "truncate public.c_evidence_cases cascade","truncate public.c_evidence_events, public.c_evidence_attachments, public.c_evidence_cases"];
  for (const statement of ["update public.c_evidence_events set action='review'", "delete from public.c_evidence_events", "delete from public.c_evidence_cases", "update public.c_evidence_attachments set file_name='replacement.pdf'", "delete from public.c_evidence_attachments", ...truncates]) {
    await rejected(() => db.query(statement), "42501");
  }
  await rejected(() => db.query("update public.c_evidence_cases set product_key='forged',revision=2 where id=$1", [c.id]), "22023");
  await rejected(() => db.query("update public.c_evidence_cases set revision=99 where id=$1", [c.id]), "40001");
  // A non-superuser owner, as Supabase's postgres role is, is stopped the same way.
  await db.exec("create role evidence_owner nologin bypassrls; alter table public.c_evidence_cases owner to evidence_owner; alter table public.c_evidence_events owner to evidence_owner; alter table public.c_evidence_attachments owner to evidence_owner;");
  await role(db, "evidence_owner", async () => { for (const statement of truncates) await rejected(() => db.query(statement), "42501"); });
  await role(db, "service_role", async () => { for (const statement of truncates) await rejected(() => db.query(statement), "42501"); });
  const counts = (await db.query("select (select count(*) from public.c_evidence_cases)::integer as cases, (select count(*) from public.c_evidence_events)::integer as events, (select count(*) from public.c_evidence_attachments)::integer as attachments")).rows[0];
  assert.deepEqual(counts, { cases: 1, events: 2, attachments: 1 });
}));

test("real PostgreSQL: the private evidence bucket is skipped without Storage and created or re-hardened with it", { skip: PGLITE_SKIP }, async () => {
  // The standard harness has no storage schema: the guarded block is a no-op.
  await withDb(async db => assert.equal((await db.query("select to_regnamespace('storage') as schema")).rows[0].schema, null));
  const db = new PGlite();
  try {
    await db.exec(shim);
    // Minimal stand-in for Supabase's storage.buckets, with an unrelated bucket.
    await db.exec(`create schema storage;
      create table storage.buckets(id text primary key, name text not null unique, public boolean not null default false,
        file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now());
      insert into storage.buckets(id, name, public, file_size_limit) values ('uploads', 'uploads', false, 10485760);`);
    const buckets = async () => (await db.query("select id, name, public, file_size_limit::integer as size_limit, allowed_mime_types from storage.buckets order by id")).rows;
    const hardened = { id: "pillar-c-evidence", name: "pillar-c-evidence", public: false, size_limit: 4194304, allowed_mime_types: ["application/pdf", "text/csv", "text/plain"] };
    const uploads = { id: "uploads", name: "uploads", public: false, size_limit: 10485760, allowed_mime_types: null };
    await db.exec(migration);
    assert.deepEqual(await buckets(), [hardened, uploads]);
    // A bucket created or loosened by hand is re-hardened by the next run.
    await db.exec("update storage.buckets set public=true, file_size_limit=52428800, allowed_mime_types=array['text/html'] where id='pillar-c-evidence'");
    await db.exec(migration);
    assert.deepEqual(await buckets(), [hardened, uploads]);
    await db.exec(migration);
    assert.deepEqual(await buckets(), [hardened, uploads]);
    assert.equal((await db.query("select count(*)::integer as count from pg_policies where schemaname='storage'")).rows[0].count, 0);
  } finally { await db.close(); }
});
