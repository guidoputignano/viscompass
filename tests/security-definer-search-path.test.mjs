import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Every SECURITY DEFINER function searches the session's temporary schema
// LAST (supabase/migrations/20261009170000). With pg_temp left out of
// search_path, PostgreSQL searches it FIRST for table and type names, so a
// session temporary table named user_organizations handed my_objective_rank(),
// which reads canonical_fact as its owner, past RLS, any membership the session
// chose. The behaviour, before and after, is proven in PGlite by
// outputs/pillar-b/logs/b52 (outside this public repository). Here the
// migration source is pinned, supabase_schema.sql is held to the same path
// (a fresh build must not reopen what the migration closed), and every later
// file is held to it: CREATE OR REPLACE resets a function's SET clauses, so
// one careless recreation would quietly undo the fix for that function.

const root = new URL("../", import.meta.url);
const read = (rel) => fs.readFileSync(fileURLToPath(new URL(rel, root)), "utf8").replace(/\r\n/g, "\n");
const SCHEMA = "supabase_schema.sql";
const ACCESS = "supabase/migrations/20260831224500_access_control_center.sql";
const MIGRATION = "supabase/migrations/20261009170000_security_definer_search_path_temp_last.sql";
// supabase_schema.sql is the base; the migrations apply on top of it, in order.
const FILES = [SCHEMA, ...fs.readdirSync(fileURLToPath(new URL("supabase/migrations/", root)))
  .filter((f) => f.endsWith(".sql")).sort().map((f) => `supabase/migrations/${f}`)];

const SIX = {
  my_objective_rank: { args: "text", file: SCHEMA, grantee: "authenticated" },
  request_organization_membership: { args: "text, text, text", file: ACCESS, grantee: "authenticated" },
  accept_organization_invitation: { args: "uuid", file: ACCESS, grantee: "authenticated" },
  decline_organization_invitation: { args: "uuid", file: ACCESS, grantee: "authenticated" },
  admin_decide_organization_membership: { args: "bigint, text, uuid, text", file: ACCESS, grantee: "service_role" },
  admin_revoke_organization_membership: { args: "bigint, uuid, text", file: ACCESS, grantee: "service_role" },
};

const stripComments = (sql) => sql.replace(/--[^\n]*/g, "");
// "public" | "pg_catalog, pg_temp" | '' (an empty path: pg_temp still first).
const normPath = (p) => p.split(",").map((s) => s.trim().replace(/^(['"])(.*)\1$/, "$2")).filter(Boolean).join(", ");
const lastIsTemp = (p) => p !== null && p.split(", ").at(-1) === "pg_temp";
const argTypes = (params) => params.split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
  const words = p.replace(/\s+(?:default\b|=)[\s\S]*$/i, "").split(/\s+/).filter((w) => !/^(?:in|out|inout|variadic)$/i.test(w));
  return words.length > 1 ? words.slice(1).join(" ") : words[0];
}).join(", ");
// Relations a body names without a schema (CTE names included; the callers
// below look for specific tables in the result, or for none at all).
const unqualified = (body) => new Set([
  ...[...body.matchAll(/\b(?:from|join|into|update)\s+(?!public\.|set\b|v_)([a-z_]+)\b(?!\s*\()/gi)].map((m) => m[1].toLowerCase()),
  ...[...body.matchAll(/(?<![\w.])([a-z_]+)%rowtype/gi)].map((m) => m[1].toLowerCase()),
]);

// Every statement that creates a function or alters its search_path or
// security mode, in file order. A CREATE whose header states no search_path
// resets it (searchPath null); an ALTER leaves what it does not mention.
const STATEMENT = new RegExp(
  String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:\w+\.)?(\w+)\s*\(([\s\S]*?)\bas\s+(\$\w*\$)([\s\S]*?)\3` +
  String.raw`|alter\s+function\s+(?:\w+\.)?(\w+)\s*\(([^)]*)\)\s+([^;]*);`, "gi");

function parse(sql, file) {
  const out = [];
  for (const m of stripComments(sql).matchAll(STATEMENT)) {
    if (m[1]) {
      const [, params, rest] = m[2].match(/^([\s\S]*?)\)\s*(returns\b[\s\S]*)$/i) ?? [null, m[2], ""];
      const set = rest.match(/\bset\s+search_path\s*(?:=|to)\s*([^\n]+?)\s*$/im);
      out.push({ file, kind: "create", name: m[1], args: argTypes(params), body: m[4],
        secdef: /\bsecurity\s+definer\b/i.test(rest), searchPath: set ? normPath(set[1]) : null });
    } else {
      const actions = m[7];
      const set = actions.match(/\bset\s+search_path\s*(?:=|to)\s*([\s\S]+)$/i);
      const reset = /\breset\s+(?:search_path|all)\b/i.test(actions);
      const sec = actions.match(/\bsecurity\s+(definer|invoker)\b/i);
      out.push({ file, kind: "alter", name: m[5], args: m[6].trim().replace(/\s*,\s*/g, ", "),
        secdef: sec ? sec[1].toLowerCase() === "definer" : undefined,
        searchPath: set ? normPath(set[1]) : reset ? null : undefined });
    }
  }
  return out;
}

function finalState(statements) {
  const state = new Map();
  for (const s of statements) {
    if (s.kind === "create") {
      state.set(s.name, { secdef: s.secdef, searchPath: s.searchPath, file: s.file, created: s });
    } else {
      const cur = state.get(s.name) ?? { secdef: false, searchPath: null, created: null };
      state.set(s.name, { ...cur, file: s.file,
        secdef: s.secdef ?? cur.secdef, searchPath: s.searchPath === undefined ? cur.searchPath : s.searchPath });
    }
  }
  return state;
}

const ALL = FILES.flatMap((f) => parse(read(f), f));
const offenders = (state) => [...state].filter(([, s]) => s.secdef && !lastIsTemp(s.searchPath))
  .map(([n, s]) => `${n} [${s.searchPath}] in ${s.file}`);

test("the parser sees every function every file creates", () => {
  for (const f of FILES) {
    const creates = (stripComments(read(f)).match(/\bcreate\s+(?:or\s+replace\s+)?function\b/gi) ?? []).length;
    assert.equal(parse(read(f), f).filter((s) => s.kind === "create").length, creates, f);
  }
  assert.ok(FILES.includes(MIGRATION), "the migration under test is in supabase/migrations");
});

test("20260831224500, applied and untouched, installs the five access functions searching pg_temp first (search_path = public)", () => {
  const installed = finalState(parse(read(ACCESS), ACCESS));
  for (const name of Object.keys(SIX).filter((n) => SIX[n].file === ACCESS)) {
    const s = installed.get(name);
    assert.deepEqual({ secdef: s?.secdef, searchPath: s?.searchPath }, { secdef: true, searchPath: "public" }, name);
  }
});

test("supabase_schema.sql states the migration's search_path for all six, so a fresh build agrees with a migrated database", () => {
  const base = parse(read(SCHEMA), SCHEMA).filter((s) => s.kind === "create" && s.name in SIX);
  assert.deepEqual(base.map((s) => s.name).sort(), Object.keys(SIX).sort(), "each of the six is created once in the file");
  for (const s of base) {
    assert.deepEqual({ secdef: s.secdef, searchPath: s.searchPath }, { secdef: true, searchPath: "pg_catalog, public, pg_temp" }, s.name);
  }
  assert.deepEqual(offenders(finalState(parse(read(SCHEMA), SCHEMA))), [], "no SECURITY DEFINER function in the file searches pg_temp first");
});

test("after the last migration, every SECURITY DEFINER function names pg_temp last", () => {
  const after = finalState(ALL);
  const definers = [...after].filter(([, s]) => s.secdef).map(([n]) => n);
  for (const name of Object.keys(SIX)) assert.ok(definers.includes(name), `${name} is found as SECURITY DEFINER`);
  assert.deepEqual(offenders(after), [],
    "a SECURITY DEFINER function without pg_temp last lets a session temporary table shadow its tables and types");
  for (const name of Object.keys(SIX)) assert.equal(after.get(name).searchPath, "pg_catalog, public, pg_temp", name);
});

test("the migration is six ALTERs that set search_path and nothing else", () => {
  assert.deepEqual(parse(read(MIGRATION), MIGRATION).filter((s) => s.kind === "create"), [], "no body is recreated");
  // The whole migration, comments stripped: exactly these statements, in this
  // order. No grant, revoke, owner, comment, security, volatility or drop.
  const statements = stripComments(read(MIGRATION)).replace(/\s+/g, " ").split(";")
    .map((s) => s.trim()).filter(Boolean).map((s) => `${s};`);
  assert.deepEqual(statements, Object.entries(SIX).map(([name, f]) =>
    `alter function public.${name}(${f.args}) set search_path = pg_catalog, public, pg_temp;`));
});

test("each ALTER names the overload that is installed, with the grants it already has", () => {
  for (const [name, f] of Object.entries(SIX)) {
    const created = finalState(ALL).get(name).created;
    assert.equal(created.file, f.file, `${name}: last created in ${f.file}, no later file recreates it`);
    assert.equal(created.args, f.args, `${name}: the ALTER's signature is the created one`);
    const def = read(f.file);
    const sig = String.raw`(?:public\.)?${name}\(${f.args.replace(/, /g, ",\\s*")}\)`;
    assert.match(def, new RegExp(String.raw`revoke all on function ${sig} from public;`), `${name}: revoked from PUBLIC`);
    assert.match(def, new RegExp(String.raw`grant execute on function ${sig} to ${f.grantee};`), `${name}: granted to ${f.grantee}`);
  }
});

test("public stays in the path: an installed body may name its tables unqualified", () => {
  const after = finalState(ALL);
  const rank = unqualified(after.get("my_objective_rank").created.body);
  for (const t of ["user_organizations", "organizations", "objectives", "canonical_fact"]) {
    assert.ok(rank.has(t), `my_objective_rank reads ${t} unqualified`);
  }
  for (const name of Object.keys(SIX).filter((n) => n !== "my_objective_rank")) {
    // As 20260831224500 installs them: every relation, %rowtype included, is
    // schema-qualified, so pg_temp reached only built-in type names...
    assert.deepEqual([...unqualified(after.get(name).created.body)], [], `${name} (20260831224500)`);
    // ...but supabase_schema.sql still carries bodies that name them bare.
    const base = parse(read(SCHEMA), SCHEMA).find((s) => s.kind === "create" && s.name === name);
    assert.ok(unqualified(base.body).size > 0, `${name} (supabase_schema.sql) names a relation unqualified`);
  }
  // The old path was "public" (20260831224500 still states it), with
  // pg_catalog implicitly before it and pg_temp implicitly before both. The new
  // one states pg_catalog where it already was, keeps public after it, and
  // moves pg_temp from first to last.
  for (const name of Object.keys(SIX)) {
    const path = after.get(name).searchPath.split(", ");
    assert.deepEqual([path[0], path.at(-1)], ["pg_catalog", "pg_temp"], name);
    assert.equal(path.slice(1, -1).join(", "), "public", `${name}: the old path, in between`);
  }
});

test("the guard is not vacuous: each way of undoing the fix later is caught", () => {
  const later = "supabase/migrations/29991231000000_later.sql";
  const caught = (sql) => offenders(finalState([...ALL, ...parse(sql, later)]));
  const cases = [
    ["my_objective_rank", "create or replace function public.my_objective_rank(p_metric text) returns table(x int) language plpgsql security definer set search_path = public as $$ begin end $$;"],
    ["accept_organization_invitation", "create or replace function public.accept_organization_invitation(p_invitation_id uuid)\nreturns text\nlanguage plpgsql\nsecurity definer\nas $$ begin return null; end $$;"],
    ["admin_revoke_organization_membership", "alter function public.admin_revoke_organization_membership(bigint, uuid, text) reset search_path;"],
    ["decline_organization_invitation", "alter function public.decline_organization_invitation(uuid) set search_path = '';"],
    ["request_organization_membership", "alter function public.request_organization_membership(text, text, text) set search_path = pg_temp, pg_catalog, public;"],
    ["new_definer", "create function public.new_definer() returns int language sql security definer as $$ select 1 $$;"],
  ];
  for (const [name, sql] of cases) {
    assert.deepEqual(caught(sql).map((o) => o.split(" ")[0]), [name], sql);
  }
  // ...while a recreation that states pg_temp last itself, or one that is no
  // longer SECURITY DEFINER, is not flagged.
  assert.deepEqual(caught("create or replace function public.my_objective_rank(p_metric text) returns table(x int) language plpgsql security definer set search_path = pg_catalog, pg_temp as $$ begin end $$;"), []);
  assert.deepEqual(caught("create or replace function public.my_objective_rank(p_metric text) returns table(x int) language plpgsql security invoker set search_path = public as $$ begin end $$;"), []);
});
