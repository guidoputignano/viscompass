import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// The Pillar B read functions search the session's temporary schema LAST
// (supabase/migrations/20261009160000). With pg_temp left out of search_path,
// PostgreSQL searches it FIRST for table and type names, so a session
// temporary table named pillar_b_active_release chose the release that every
// gated function aggregated. The behaviour, before and after, is proven in
// PGlite on the frozen release by outputs/pillar-b/logs/b51 (outside this
// public repository). Here the migration source is pinned, and every later
// migration is held to it: CREATE OR REPLACE resets a function's SET clauses,
// so one careless recreation would quietly undo the fix for that function.

const dir = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
const read = (f) => fs.readFileSync(`${dir}${f}`, "utf8").replace(/\r\n/g, "\n");
const MIGRATION = "20261009160000_pillar_b_search_path_temp_last.sql";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const stripComments = (sql) => sql.replace(/--[^\n]*/g, "");
const normPath = (p) => (p === null ? null : p.split(",").map((s) => s.trim()).join(", "));

const PRE_EXISTING = [
  "pillar_b_release", "pillar_b_spend", "pillar_b_uptake_rows", "pillar_b_uptake", "pillar_b_uptake_withheld",
  "pillar_b_uptake_scope", "pillar_b_evidence_funnel", "pillar_b_perimeter_coverage", "pillar_b_molecule_spend",
  "pillar_b_molecule_spend_json", "pillar_b_value_uptake", "pillar_b_value_uptake_scoped", "pillar_b_facets",
  "pillar_b_uptake_coverage",
];

// Every statement that sets a Pillar B function's search_path, in migration
// order: a CREATE OR REPLACE (whose header may state none, which resets it) or
// an ALTER FUNCTION ... SET search_path.
const STATEMENT = new RegExp(
  String.raw`create\s+or\s+replace\s+function\s+(?:public\.)?(pillar_b_\w+)\s*\(([\s\S]*?)\bas\s+(\$\w*\$)([\s\S]*?)\3` +
  String.raw`|alter\s+function\s+(?:public\.)?(pillar_b_\w+)\s*\([^)]*\)\s+set\s+search_path\s*(?:=|to)\s*([^;]+);`, "gi");

function statements(file) {
  const out = [];
  for (const m of stripComments(read(file)).matchAll(STATEMENT)) {
    if (m[1]) {
      const set = m[2].match(/\bset\s+search_path\s*(?:=|to)\s*(.+?)\s*$/im);
      out.push({ file, kind: "create", name: m[1], header: m[2], body: m[4], searchPath: normPath(set ? set[1] : null) });
    } else {
      out.push({ file, kind: "alter", name: m[5], searchPath: normPath(m[6]) });
    }
  }
  return out;
}

const finalPaths = (upTo = null) => {
  const state = new Map();
  for (const f of files) {
    if (upTo !== null && f >= upTo) break;
    for (const s of statements(f)) state.set(s.name, { searchPath: s.searchPath, file: f });
  }
  return state;
};

test("before this migration, every Pillar B read function searched pg_temp first (search_path = public)", () => {
  const before = finalPaths(MIGRATION);
  for (const name of PRE_EXISTING) {
    assert.equal(before.get(name)?.searchPath, "public", `${name} as created`);
  }
});

test("after the last migration, every Pillar B function names pg_temp last", () => {
  const state = finalPaths();
  for (const name of PRE_EXISTING) assert.ok(state.has(name), `${name} is found by the parser`);
  const offenders = [...state].filter(([, s]) => s.searchPath === null || s.searchPath.split(", ").at(-1) !== "pg_temp");
  assert.deepEqual(offenders.map(([n, s]) => `${n} [${s.searchPath}] in ${s.file}`), [],
    "a function recreated without pg_temp last lets a session temporary table shadow its tables and types");
});

test("pillar_b_release: pg_catalog then pg_temp, and the release table schema-qualified", () => {
  const creates = files.flatMap(statements).filter((s) => s.kind === "create" && s.name === "pillar_b_release");
  const last = creates.at(-1);
  assert.equal(last.file, MIGRATION);
  assert.equal(last.searchPath, "pg_catalog, pg_temp", "no public in the path: nothing in the body resolves through it");
  assert.match(last.body, /\bfrom public\.pillar_b_active_release;/);
  assert.doesNotMatch(last.body, /\b(?:from|join)\s+(?!public\.)[a-z_]/i, "every relation it reads is schema-qualified");
  assert.match(last.header, /^\) returns text\s+language plpgsql stable security invoker set search_path/,
    "still STABLE and SECURITY INVOKER, still returns text");
});

test("pillar_b_release keeps its behaviour: the original body but for one schema prefix", () => {
  const creates = files.flatMap(statements).filter((s) => s.kind === "create" && s.name === "pillar_b_release");
  const original = creates.find((s) => s.file === "20261001120000_pillar_b_dashboard_rpc.sql");
  const fixed = creates.find((s) => s.file === MIGRATION);
  assert.equal(original.searchPath, "public");
  assert.equal(fixed.body, original.body.replace("from pillar_b_active_release;", "from public.pillar_b_active_release;"));
  assert.notEqual(fixed.body, original.body);
  assert.match(fixed.body, /raise exception 'no active Pillar B release is declared; refusing to aggregate'\n\s+using hint = 'insert the release id into pillar_b_active_release';/,
    "the gate still raises, with the same message and hint");
});

test("grants: restated exactly as they stand, nothing else granted, revoked or dropped", () => {
  const rpc = read("20261001120000_pillar_b_dashboard_rpc.sql");
  assert.match(rpc, /revoke all on function public\.pillar_b_release\(\) from public, anon;\ngrant execute on function public\.pillar_b_release\(\) to authenticated;/);
  assert.match(read("20261003090000_pillar_b_scoped_views.sql"), /grant execute on function public\.pillar_b_release\(\) to service_role;/);
  const mig = stripComments(read(MIGRATION));
  const grants = [...mig.matchAll(/^\s*(grant|revoke)\b[^;]*;/gim)].map((m) => m[0].trim());
  assert.deepEqual(grants, [
    "revoke all on function public.pillar_b_release() from public, anon;",
    "grant execute on function public.pillar_b_release() to authenticated, service_role;",
  ]);
  assert.doesNotMatch(mig, /\bdrop\b|security\s+definer|\bowner\s+to\b|\bcomment\s+on\b/i);
});

test("the other thirteen: search_path moved, bodies untouched, every one of them and nothing more", () => {
  const mig = stripComments(read(MIGRATION));
  const own = statements(MIGRATION);
  assert.deepEqual(own.filter((s) => s.kind === "create").map((s) => s.name), ["pillar_b_release"], "only pillar_b_release is recreated");
  const alters = own.filter((s) => s.kind === "alter");
  assert.deepEqual(alters.map((s) => s.name).sort(), PRE_EXISTING.filter((n) => n !== "pillar_b_release").sort());
  for (const a of alters) assert.equal(a.searchPath, "pg_catalog, public, pg_temp", a.name);
  // Every ALTER sets search_path and nothing else (no SECURITY, volatility,
  // owner or rename clause riding along).
  const alterStatements = [...mig.matchAll(/alter\s+function[^;]*;/gi)].map((m) => m[0].replace(/\s+/g, " "));
  assert.equal(alterStatements.length, 13);
  for (const s of alterStatements) {
    assert.match(s, /^alter function public\.pillar_b_\w+\([^)]*\) set search_path = pg_catalog, public, pg_temp;$/, s);
  }
});
