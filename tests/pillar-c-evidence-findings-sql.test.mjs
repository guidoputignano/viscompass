// Pillar C point 18: finding cases in the evidence workflow, on real PostgreSQL (PGlite), after both migrations.
// Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../supabase/migrations/20261019120000_pillar_c_evidence_workflow.sql", import.meta.url), "utf8");
const findings = await readFile(new URL("../supabase/migrations/20261022200000_pillar_c_evidence_findings.sql", import.meta.url), "utf8");
import { PGlite, PGLITE_SKIP } from "./helpers/pglite.mjs";
const actor = "00000000-0000-4000-8000-000000000001", owner = "00000000-0000-4000-8000-000000000002", pending = "00000000-0000-4000-8000-000000000003";
const shim = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create schema auth; create table auth.users(id uuid primary key);
create table public.organizations(org_code text primary key);
create table public.user_organizations(user_id uuid references auth.users(id),org_code text references public.organizations(org_code),status text);
grant usage on schema auth to service_role;
grant select on public.user_organizations to service_role;
insert into auth.users values ('${actor}'),('${owner}'),('${pending}');
insert into public.organizations values ('SYNTHETIC-A'),('SYNTHETIC-B');
insert into public.user_organizations values ('${actor}','SYNTHETIC-A','approved'),('${owner}','SYNTHETIC-B','approved'),('${pending}','SYNTHETIC-A','pending');
`;
const finding = { source_snapshot: "d".repeat(64), source_group: "f".repeat(64), finding_version: "ext-v1", product_key: "F01", product_label: "Rilievo sintetico", scope: "Ambito sintetico", origin: "Punto sintetico", source_state: "F" };
const attribution = { source_snapshot: "a".repeat(64), source_group: "e".repeat(64), source_sha256: "b".repeat(64), classification_sha256: "c".repeat(64), mapping_version: "test-synthetic-v1", period: "FY2025", org: "Regione", channel: "Tutti", product_key: "SYNTHETIC-001", product_label: "Invented aggregate evidence fixture", source_state: "S3" };
async function withDb(fn) { const db = new PGlite(); try { await db.exec(shim); await db.exec(workflow); await db.exec(findings); await fn(db); } finally { await db.close(); } }
const create = async (db, input = finding, who = actor) => (await db.query("select public.c_evidence_create_finding($1::uuid,$2::jsonb) as value", [who, JSON.stringify(input)])).rows[0].value;
const mutate = async (db, c, action, payload = {}) => (await db.query("select public.c_evidence_mutate($1::uuid,$2::uuid,$3::integer,$4::text,$5::jsonb) as value", [actor, c.id, c.revision, action, JSON.stringify(payload)])).rows[0].value;
const rejected = (fn, code) => assert.rejects(fn, (e) => e.code === code, `expected SQLSTATE ${code}`);

test("the findings migration is additive, keeps the grants closed and checks its precondition", () => {
  assert.match(findings, /revoke all on function public\.c_evidence_create_finding\(uuid,jsonb\) from public, anon, authenticated/);
  assert.match(findings, /grant execute on function public\.c_evidence_create_finding\(uuid,jsonb\) to service_role/);
  assert.doesNotMatch(findings, /create\s+policy|grant\s+[^;]+\s+to\s+(?:authenticated|anon)\b|drop\s+(?:table|function|policy)|function\s+public\.c_evidence_(?:mutate|create)\s*\(/i);
  assert.match(findings, /PCF_PRE/);
});

test("a finding case is created once, carries its source, and follows the unchanged workflow to closure", { skip: PGLITE_SKIP }, async () => {
  await withDb(async (db) => {
    const c = await create(db);
    assert.equal(c.source_state, "F"); assert.equal(c.product_key, "F01"); assert.equal(c.state, "unassigned"); assert.deepEqual(c.source, finding);
    assert.equal((await create(db)).id, c.id, "idempotent on the same source");
    await rejected(() => create(db, { ...finding, product_label: "Altro titolo" }), "22023");
    const events = (await db.query("select action from public.c_evidence_events where case_id=$1", [c.id])).rows;
    assert.deepEqual(events.map((e) => e.action), ["create"]);
    let x = await mutate(db, c, "assign", { owner_id: owner, role: "Servizio farmaceutico", due_date: "2026-11-30" });
    assert.equal(x.state, "assigned");
    x = await mutate(db, x, "review", {});
    assert.equal(x.state, "in_review");
    x = await mutate(db, x, "record_decision", { decision: "remains_uncertain", note: "Serve la risposta del titolare del flusso." });
    assert.equal(x.state, "decision_recorded");
    // The attribution path is untouched: an S3 case is still created by its own function, and cannot be created as a finding.
    assert.equal((await db.query("select public.c_evidence_create($1::uuid,$2::jsonb) as value", [actor, JSON.stringify(attribution)])).rows[0].value.source_state, "S3");
    await rejected(() => create(db, { ...attribution }), "22023");
  });
});

test("invalid finding sources and actors are refused", { skip: PGLITE_SKIP }, async () => {
  await withDb(async (db) => {
    for (const bad of [
      { ...finding, product_key: "X01" }, { ...finding, product_key: "F1" }, { ...finding, finding_version: "ext-v2" }, { ...finding, source_state: "S3" },
      { ...finding, source_snapshot: "z".repeat(64) }, { ...finding, source_group: "f".repeat(63) }, { ...finding, product_label: "" }, { ...finding, scope: "a\u0001b" },
      { ...finding, extra: "x" }, Object.fromEntries(Object.entries(finding).filter(([k]) => k !== "origin")), { ...finding, scope: 3 },
    ]) await rejected(() => create(db, bad), "22023");
    await rejected(() => create(db, finding, pending), "42501");
    await rejected(() => create(db, finding, null), "42501");
    // A direct insert with any other state is still refused by the widened check.
    await rejected(() => db.query("insert into public.c_evidence_cases(source,source_snapshot,source_group,product_key,source_state,created_by,updated_by) values('{}'::jsonb,$1,$2,'F09','X',$3,$3)", ["1".repeat(64), "2".repeat(64), actor]), "23514");
  });
});
