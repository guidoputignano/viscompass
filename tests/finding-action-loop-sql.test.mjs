// The action loop for findings, on real PostgreSQL with synthetic users and invented findings only.
//   - No session reads a row or calls a function; only the service role, which the gated server uses.
//   - A finding's identity is checked in SQL: kind, release, Azienda and subject hash to its key.
//   - The lifecycle: assign to an approved member of the stated organisation, start, decide, close with an outcome,
//     reopen with a reason; every revision audited, history append only, stale writes refused.
//   - Overdue reminders are claimed once per case, due date and owner.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite, PGLITE_SKIP } from "./helpers/pglite.mjs";

const migration = await readFile(new URL("../supabase/migrations/20261029200000_finding_action_loop.sql", import.meta.url), "utf8");
const reviewer = "00000000-0000-4000-8000-000000000001";
const member = "00000000-0000-4000-8000-000000000002";
const otherMember = "00000000-0000-4000-8000-000000000003";
const pending = "00000000-0000-4000-8000-000000000004";
const key = (kind, release, asl, subject) => createHash("sha256").update(`${kind}|${release}|${asl}|${subject}`).digest("hex");
const biosimilar = {
  kind: "biosimilar", release: "synthetic-release-1", org_code: "SYN-A", org_label: "Azienda sintetica A", asl_code: "999001",
  subject: "SOSTANZA SINTETICA", subject_label: "Sostanza sintetica", cohort: "after_local_switch", reference_eur: "12345.67",
  first_local: "2024-03", years: "2024-2025", channels: "all",
};
biosimilar.source_key = key("biosimilar", biosimilar.release, biosimilar.asl_code, biosimilar.subject);
const benchmark = {
  kind: "benchmark", release: "synthetic-release-1", org_code: "SYN-A", org_label: "Azienda sintetica A", asl_code: "999001",
  subject: "unit_cost_index", subject_label: "Costo unitario per gli stessi prodotti", year: "2025", unit_cost_index: "112.4", unit_cost_coverage: "0.870",
};
benchmark.source_key = key("benchmark", benchmark.release, benchmark.asl_code, benchmark.subject);

const shim = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create schema auth; create table auth.users(id uuid primary key);
create table public.organizations(org_code text primary key);
create table public.user_organizations(user_id uuid references auth.users(id),org_code text references public.organizations(org_code),status text);
grant usage on schema auth to service_role;
grant select on public.user_organizations, public.organizations to service_role;
insert into auth.users values ('${reviewer}'),('${member}'),('${otherMember}'),('${pending}');
insert into public.organizations values ('SYN-A'),('SYN-B'),('SYN-R');
insert into public.user_organizations values
('${reviewer}','SYN-R','approved'),('${member}','SYN-A','approved'),('${otherMember}','SYN-B','approved'),('${pending}','SYN-A','pending');
`;
async function withDb(fn) {
  const db = new PGlite();
  try { await db.exec(shim); await db.exec(migration); await fn(db); } finally { await db.close(); }
}
async function role(db, name, fn) {
  await db.exec(`set role ${name}`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const create = async (db, input = biosimilar, actor = reviewer) =>
  (await db.query("select public.finding_case_create($1::uuid,$2::jsonb) as value", [actor, JSON.stringify(input)])).rows[0].value;
const mutate = async (db, c, action, payload = {}, actor = reviewer, revision = c.revision) => (await db.query(
  "select public.finding_case_mutate($1::uuid,$2::uuid,$3::integer,$4::text,$5::jsonb) as value",
  [actor, c.id, revision, action, JSON.stringify(payload)])).rows[0].value;
const rejected = (fn, code) => assert.rejects(fn, (error) => error.code === code, `expected SQLSTATE ${code}`);
const assignTo = (owner = member, org = "SYN-A", due = "2099-12-31") => ({ owner_id: owner, owner_org: org, due_date: due });

test("the migration forces RLS, grants nothing to sessions and pins every function's search path", () => {
  for (const name of ["cases", "events", "reminders"]) {
    assert.match(migration, new RegExp(`alter table public\\.finding_${name} enable row level security`));
    assert.match(migration, new RegExp(`alter table public\\.finding_${name} force row level security`));
  }
  assert.doesNotMatch(migration, /create\s+policy|grant\s+[^;]+\s+to\s+(?:authenticated|anon)\b/i);
  assert.doesNotMatch(migration, /security\s+definer/i);
  assert.doesNotMatch(migration, /(?:update|insert into|delete from)\s+(?:public\.)?(?:canonical_fact|user_organizations|organizations|pillar_[abc]_\w+)\b/i);
  assert.doesNotMatch(migration, /btrim\(\s*(?:coalesce\(\s*)?p_(?:payload|source)/i);
  assert.match(migration, /^begin;$/m); assert.match(migration, /^commit;\s*$/m);
});

test("real PostgreSQL: sessions read nothing and call nothing; the service role calls three functions", { skip: PGLITE_SKIP }, async () => withDb(async (db) => {
  const c = await role(db, "service_role", () => create(db));
  await db.exec(migration);
  assert.equal((await db.query("select id from public.finding_cases")).rows[0].id, c.id, "the migration is idempotent");
  for (const name of ["anon", "authenticated"]) await role(db, name, async () => {
    for (const table of ["cases", "events", "reminders"]) await rejected(() => db.query(`select * from public.finding_${table}`), "42501");
    await rejected(() => create(db), "42501");
    await rejected(() => mutate(db, c, "assign", assignTo()), "42501");
    await rejected(() => db.query("select public.finding_reminder_claim($1::uuid, current_date, $2::uuid)", [c.id, member]), "42501");
  });
  const functions = (await db.query(`select p.proname, p.prosecdef, p.proconfig,
    has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
    has_function_privilege('service_role', p.oid, 'execute') as service from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname like 'finding_%' order by p.proname`)).rows;
  for (const f of functions) {
    assert.equal(f.prosecdef, false, f.proname); assert.equal(f.anon, false, f.proname); assert.equal(f.authenticated, false, f.proname);
    assert.ok(f.proconfig?.some((s) => s.startsWith("search_path=")), `${f.proname} pins search_path`);
  }
  assert.deepEqual(functions.filter((f) => f.service).map((f) => f.proname), ["finding_case_create", "finding_case_mutate", "finding_reminder_claim", "finding_trim"]);
  // RLS itself denies every row even if a table grant were restored by mistake.
  await db.exec("grant select, insert, update on public.finding_cases to authenticated");
  await role(db, "authenticated", async () => {
    assert.equal((await db.query("select * from public.finding_cases")).rows.length, 0);
    assert.equal((await db.query("update public.finding_cases set state='closed' returning id")).rows.length, 0);
  });
}));

test("real PostgreSQL: a finding's source is validated, its key checked, and a second open returns the same case", { skip: PGLITE_SKIP }, async () => withDb(async (db) => role(db, "service_role", async () => {
  for (const actor of [null, pending]) await rejected(() => create(db, biosimilar, actor), "42501");
  const bad = [null, [], "x", { ...biosimilar, extra: "x" }, { ...biosimilar, source_key: "a".repeat(64) },
    { ...biosimilar, org_code: "SYN-UNKNOWN" }, { ...biosimilar, reference_eur: "12345.6" }, { ...biosimilar, cohort: "not_observed_here" },
    { ...biosimilar, channels: "CO" }, { ...biosimilar, first_local: "2024-13" }, { ...biosimilar, subject_label: "a\u0007b" },
    { ...biosimilar, reference_eur: 12345.67 }, { ...benchmark, unit_cost_index: "112.45" }, { ...benchmark, unit_cost_coverage: "1.5" },
    { ...benchmark, subject: "spend_index", source_key: key("benchmark", benchmark.release, benchmark.asl_code, "spend_index") },
    { ...biosimilar, release: "synthetic-release-2" }];
  for (const input of bad) await rejected(() => create(db, input), "22023");
  const c = await create(db);
  assert.equal(c.state, "open"); assert.equal(c.revision, 1); assert.equal(c.owner_id, null); assert.equal(c.kind, "biosimilar");
  assert.equal(c.org_code, "SYN-A"); assert.equal(c.subject_key, "SOSTANZA SINTETICA"); assert.equal(c.release_stamp, "synthetic-release-1");
  assert.deepEqual(await create(db), c, "opening the same finding again returns its case");
  const b = await create(db, benchmark);
  assert.notEqual(b.id, c.id); assert.equal(b.kind, "benchmark");
  // A new release of the same finding is a new case.
  const next = { ...biosimilar, release: "synthetic-release-2" };
  next.source_key = key("biosimilar", next.release, next.asl_code, next.subject);
  assert.notEqual((await create(db, next)).id, c.id);
  // Same key, different frozen content: refused.
  await rejected(() => create(db, { ...biosimilar, reference_eur: "1.00" }), "22023");
  assert.equal((await db.query("select count(*)::int as n from public.finding_events")).rows[0].n, 3);
})));

test("real PostgreSQL: the lifecycle from assignment to outcome, reopening and a second cycle", { skip: PGLITE_SKIP }, async () => withDb(async (db) => role(db, "service_role", async () => {
  let c = await create(db);
  await rejected(() => mutate(db, c, "start"), "22023");
  await rejected(() => mutate(db, c, "record_decision", { decision: "action_planned", note: "x" }), "22023");
  // The owner must be approved in the organisation the server names.
  await rejected(() => mutate(db, c, "assign", assignTo(member, "SYN-B")), "42501");
  await rejected(() => mutate(db, c, "assign", assignTo(pending, "SYN-A")), "42501");
  for (const payload of [{}, { ...assignTo(), extra: "x" }, { ...assignTo(), due_date: "2099-02-30" }, { ...assignTo(), due_date: "2000-01-01" }, { ...assignTo(), owner_id: "nope" }])
    await rejected(() => mutate(db, c, "assign", payload), "22023");
  c = await mutate(db, c, "assign", assignTo());
  assert.equal(c.state, "assigned"); assert.equal(c.owner_id, member); assert.equal(c.owner_org, "SYN-A"); assert.equal(c.due_date, "2099-12-31");
  await rejected(() => mutate(db, c, "assign", assignTo(), reviewer, c.revision - 1), "40001");
  await rejected(() => mutate(db, c, "close", { outcome: "x" }), "22023");
  c = await mutate(db, c, "start", {}, member);
  assert.equal(c.state, "in_review");
  for (const payload of [{ decision: "saving", note: "x" }, { decision: "action_planned", note: " \n " }, { decision: "action_planned" }])
    await rejected(() => mutate(db, c, "record_decision", payload, member), "22023");
  c = await mutate(db, c, "record_decision", { decision: "action_planned", note: "  Revisione con la farmacia  " }, member);
  assert.equal(c.state, "decision_recorded"); assert.equal(c.decision_note, "Revisione con la farmacia");
  c = await mutate(db, c, "record_decision", { decision: "data_to_verify", note: "Prima verificare il dato" }, member);
  assert.equal(c.decision, "data_to_verify");
  await rejected(() => mutate(db, c, "close", {}, member), "22023");
  c = await mutate(db, c, "close", { outcome: "Dato verificato" }, member);
  assert.equal(c.state, "closed"); assert.ok(c.closed_at); assert.equal(c.outcome, "Dato verificato");
  await rejected(() => mutate(db, c, "record_decision", { decision: "action_planned", note: "x" }), "22023");
  await rejected(() => mutate(db, c, "reopen", {}), "22023");
  c = await mutate(db, c, "reopen", { note: "Nuovo dato disponibile" });
  assert.equal(c.state, "in_review"); assert.equal(c.outcome, null); assert.equal(c.closed_at, null);
  assert.equal(c.decision, "data_to_verify", "the earlier decision stays visible until a new one is recorded");
  await rejected(() => mutate(db, c, "close", { outcome: "x" }), "22023");
  c = await mutate(db, c, "record_decision", { decision: "already_addressed", note: "Già concordato" }, member);
  c = await mutate(db, c, "close", { outcome: "Chiuso" }, member);
  const events = (await db.query("select revision, action, detail from public.finding_events where case_id=$1 order by revision", [c.id])).rows;
  assert.deepEqual(events.map((e) => e.action), ["create", "assign", "start", "record_decision", "record_decision", "close", "reopen", "record_decision", "close"]);
  assert.deepEqual(events.map((e) => e.revision), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(events[3].detail.payload.note, "Revisione con la farmacia", "the event records the note as applied");
  assert.equal(events[6].detail.payload.note, "Nuovo dato disponibile");
})));

test("real PostgreSQL: history is append only and a direct write without its event is rolled back", { skip: PGLITE_SKIP }, async () => withDb(async (db) => {
  const c = await role(db, "service_role", () => create(db));
  await role(db, "service_role", async () => {
    await rejected(() => db.query("update public.finding_cases set source='{}'::jsonb, revision=2 where id=$1", [c.id]), "22023");
    await rejected(() => db.query("update public.finding_cases set state='assigned' where id=$1", [c.id]), "40001");
    await rejected(() => db.query("update public.finding_events set action='close'"), "42501");
    await rejected(() => db.query("insert into public.finding_events(case_id,revision,action,actor_id,detail) values($1,5,'close',$2,'{}')", [c.id, reviewer]), "40001");
  });
  // A revision written outside the functions, with no event, fails at commit.
  await rejected(() => db.transaction(async (tx) => {
    await tx.query("update public.finding_cases set revision=2, updated_at=clock_timestamp() where id=$1", [c.id]);
  }), "42501");
  for (const table of ["cases", "events", "reminders"]) await rejected(() => db.query(`truncate public.finding_${table} cascade`), "42501");
  assert.equal((await db.query("select revision from public.finding_cases where id=$1", [c.id])).rows[0].revision, 1);
}));

test("real PostgreSQL: an overdue reminder is claimed once per case, due date and owner", { skip: PGLITE_SKIP }, async () => withDb(async (db) => {
  let c = await role(db, "service_role", async () => mutate(db, await create(db), "assign", assignTo()));
  const claim = (due = "2020-01-01", owner = member) => role(db, "service_role", async () =>
    (await db.query("select public.finding_reminder_claim($1::uuid,$2::date,$3::uuid) as ok", [c.id, due, owner])).rows[0].ok);
  assert.equal(await claim("2099-12-31"), false, "not overdue");
  // Move the due date into the past the way only an audited revision can (superuser, with its event).
  await db.transaction(async (tx) => {
    await tx.query("update public.finding_cases set due_date='2020-01-01', revision=revision+1 where id=$1", [c.id]);
    await tx.query("insert into public.finding_events(case_id,revision,action,actor_id,detail) values($1,$2,'assign',$3,'{}')", [c.id, c.revision + 1, reviewer]);
  });
  assert.equal(await claim("2020-01-01", otherMember), false, "only the current owner");
  assert.equal(await claim(), true);
  assert.equal(await claim(), false, "never twice");
  assert.equal((await db.query("select count(*)::int as n from public.finding_reminders")).rows[0].n, 1);
  await role(db, "service_role", () => rejected(() => db.query("delete from public.finding_reminders"), "42501"));
}));
