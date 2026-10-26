import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { GHOST, ID, POST_SCHEMA, ROLLOUT, SEED, SEED_USERS, SHIM } from "./helpers/pillar-c-storage-harness.mjs";

// Regional analytical parity (owner clarification of 23 October 2026): the region-wide objects sit in a folder
// «regione» that only an enabled member of the Regione 130 reads (supabase/migrations/20261023200000_pillar_c_scoped_regione_folder.sql).
// The migration is applied on top of the 20261020 policy in the same real PostgreSQL harness as
// tests/pillar-c-scoped-storage-sql.test.mjs, with the same synthetic directory, memberships and rollout rows:
// A1 is an allow-listed member of Azienda 204 (units aggregato, asl-4), R an allow-listed member of the Regione 130
// (all five units). Every name and hash is SYNTHETIC.

const base = (await readFile(new URL("../supabase/migrations/20261020120000_pillar_c_scoped_storage.sql", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const regione = (await readFile(new URL("../supabase/migrations/20261023200000_pillar_c_scoped_regione_folder.sql", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const schema = await readFile(new URL("../supabase_schema.sql", import.meta.url), "utf8");
import { PGlite, PGLITE_SKIP } from "./helpers/pglite.mjs";
const SKIP = PGLITE_SKIP;

const sha = (s) => createHash("sha256").update(`synthetic:${s}`).digest("hex");
const UNITS = ["asl-1", "asl-2", "asl-3", "asl-4", "aggregato"];
const EXT = UNITS.map((unit) => ({ unit, name: `v9/${unit}/estensione-${sha("ext" + unit)}.json` }));
// The region-wide objects, under two roots, as the parity build publishes them.
const REG = ["review", "workbook-index", "workbook-spesa", "ext1"].flatMap((k) => ["v9", "v10"].map((root) => ({ unit: "regione", name: `${root}/regione/${k}-${sha(k + root)}.json` })));
// Names a careless upload could use: none matches the policy's name pattern, so nobody reads them.
const STRAY = [`v9/Regione/review-${sha("R")}.json`, `v9/regione/sub/review-${sha("sub")}.json`, `v9/regione-130/review-${sha("r130")}.json`,
  `v9/regioni/review-${sha("rs")}.json`, `regione/review-${sha("root")}.json`, `v9/regione/review.json`].map((name) => ({ unit: "stray", name }));
const ALL_OBJECTS = [...EXT, ...REG, ...STRAY];

const OBJECTS = `insert into storage.objects (bucket_id, name, metadata) values
  ${ALL_OBJECTS.map((o) => `('pillar-c-scoped', '${o.name}', '{"mimetype":"application/json"}')`).join(",\n  ")};`;

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
async function apply(db, text) {
  try { await db.exec(text); } catch (error) { await db.exec("rollback"); throw error; }
}
async function ready(regioneText = regione) {
  const db = await fresh();
  await apply(db, base);
  if (regioneText) await apply(db, regioneText);
  await db.exec(SEED_USERS());
  await db.exec(OBJECTS);
  await db.exec(ROLLOUT);
  return db;
}
async function as(db, sub, op = "storage.object.get_authenticated", fn) {
  await db.exec("begin");
  try {
    await db.query(`select set_config('role', 'authenticated', true), set_config('request.jwt.claim.role', 'authenticated', true),
      set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true), set_config('storage.operation', $3, true)`,
    [sub, JSON.stringify({ sub, role: "authenticated", aud: "authenticated" }), op]);
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}
const visible = (db, sub, op) => as(db, sub, op, async () =>
  (await db.query("select name from storage.objects where bucket_id = 'pillar-c-scoped' order by name collate \"C\"")).rows.map((r) => r.name));
const sorted = (a) => [...a].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));

const EXPECT = {
  // Azienda 204: its own unit and the aggregate, exactly as before; never the regional folder.
  a1: sorted(EXT.filter((o) => o.unit === "asl-4" || o.unit === "aggregato").map((o) => o.name)),
  // Regione: every unit object and every regional object; never a stray name.
  r: sorted([...EXT, ...REG].map((o) => o.name)),
};
const NOBODY = [["A1b (204, not listed)", ID.a1b], ["A3 (202, org off)", ID.a3], ["second Regione member, not listed", ID.rb], ["pending 204", ID.pending],
  ["revoked 204", ID.revoked], ["no membership", ID.none], ["two approved memberships", ID.multi], ["203 member", ID.c203],
  ["other region's Regione", ID.otherRegione], ["other region's Azienda", ID.otherAsl], ["JWT subject with no auth user", GHOST]];

test("regional folder: the Regione reads it with every unit; an Azienda keeps its own unit and the aggregate; nobody else reads anything", { skip: SKIP }, async () => {
  const db = await ready();
  try {
    assert.deepEqual(await visible(db, ID.a1), EXPECT.a1);
    assert.deepEqual(await visible(db, ID.r), EXPECT.r);
    for (const [label, id] of NOBODY) assert.deepEqual(await visible(db, id), [], label);
  } finally { await db.close(); }
});

test("regional folder: before the migration nobody could read it, the Regione included (the gap this closes)", { skip: SKIP }, async () => {
  const db = await ready(null);
  try {
    const seen = await visible(db, ID.r);
    for (const o of REG) assert.ok(!seen.includes(o.name), `20261020 alone: ${o.name} unreadable`);
    assert.deepEqual(seen, sorted(EXT.map((o) => o.name)));
  } finally { await db.close(); }
});

test("regional folder: each of the four Aziende, enabled for every member, reads its own unit and the aggregate, never a peer or the regional folder", { skip: SKIP }, async () => {
  const db = await ready();
  try {
    // 201 and 203 get a member each; 202 already has A3 and 204 A1. Every organisation switched on for all members.
    const extra = { "201": ID.reviewerLike, "202": ID.a3, "203": ID.c203, "204": ID.a1 };
    await db.exec("update public.pillar_c_scoped_org_switch set mode = 'all'");
    await db.exec("insert into public.pillar_c_scoped_org_switch (org_code, mode, note) values ('201', 'all', 'synthetic'), ('202', 'all', 'synthetic'), ('203', 'all', 'synthetic') on conflict (org_code) do update set mode = 'all'");
    for (const [code, id] of Object.entries(extra)) {
      const unit = `asl-${Number(code) - 200}`;
      assert.deepEqual(await visible(db, id), sorted(EXT.filter((o) => o.unit === unit || o.unit === "aggregato").map((o) => o.name)), `Azienda ${code}`);
    }
    assert.deepEqual(await visible(db, ID.r), EXPECT.r, "the Regione is unchanged");
  } finally { await db.close(); }
});

test("regional folder: another region's Regione cannot be switched on and reads no regional object", { skip: SKIP }, async () => {
  const db = await ready();
  try {
    // The switch admits only the five Abruzzo organisations (20261020 check constraint), so the folder stays Abruzzo's.
    for (const code of ["140", "301"]) await assert.rejects(() => db.exec(`insert into public.pillar_c_scoped_org_switch (org_code, mode, note) values ('${code}', 'all', 'synthetic other region')`), /org_code_check/);
    assert.deepEqual(await visible(db, ID.otherRegione), []);
    assert.deepEqual(await visible(db, ID.otherAsl), []);
  } finally { await db.close(); }
});

test("regional folder: revoking the Regione member, its allow-list row or the switch removes every read at once", { skip: SKIP }, async () => {
  for (const revoke of [
    `update public.user_organizations set status = 'revoked' where user_id = '${ID.r}'`,
    `delete from public.pillar_c_scoped_user_allow where org_code = '130' and user_id = '${ID.r}'`,
    "delete from public.pillar_c_scoped_org_switch where org_code = '130'",
  ]) {
    const db = await ready();
    try {
      assert.deepEqual(await visible(db, ID.r), EXPECT.r, "before");
      await db.exec(revoke);
      assert.deepEqual(await visible(db, ID.r), [], revoke);
      assert.deepEqual(await visible(db, ID.a1), EXPECT.a1, "the Azienda is unaffected");
    } finally { await db.close(); }
  }
});

test("regional folder: signing, copy and move stay refused, for the regional objects too; plain reads still work", { skip: SKIP }, async () => {
  const db = await ready();
  try {
    for (const op of ["storage.object.sign", "storage.object.sign_many", "storage.object.copy", "storage.object.move", "storage.s3.object.copy", "storage.s3.upload.part_copy"]) {
      assert.deepEqual(await visible(db, ID.r, op), [], op);
      assert.deepEqual(await visible(db, ID.a1, op), [], op);
    }
    for (const op of ["storage.object.get_authenticated", "storage.object.info_authenticated", "storage.object.list", "storage.s3.object.get", ""]) {
      assert.deepEqual(await visible(db, ID.r, op), EXPECT.r, op || "(no operation)");
      assert.deepEqual(await visible(db, ID.a1, op), EXPECT.a1, op || "(no operation)");
    }
  } finally { await db.close(); }
});

test("regional folder: the migration changes the policy only; the units helper and the rollout tables are untouched", { skip: SKIP }, async () => {
  const before = await fresh();
  const after_ = await fresh();
  try {
    await apply(before, base);
    await apply(after_, base); await apply(after_, regione);
    const fn = "select md5(pg_get_functiondef('public.pillar_c_scoped_units()'::regprocedure)) as h";
    assert.equal((await after_.query(fn)).rows[0].h, (await before.query(fn)).rows[0].h);
    const policies = "select count(*)::int as n from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pillar c scoped: entitled units read'";
    assert.equal((await after_.query(policies)).rows[0].n, 1);
    const tables = "select string_agg(relname || ':' || relrowsecurity || relforcerowsecurity, ',' order by relname) as t from pg_class where relname in ('pillar_c_scoped_org_switch','pillar_c_scoped_user_allow')";
    assert.equal((await after_.query(tables)).rows[0].t, (await before.query(tables)).rows[0].t);
    const rows = "select (select count(*) from public.pillar_c_scoped_org_switch)::int + (select count(*) from public.pillar_c_scoped_user_allow)::int as n";
    assert.equal((await after_.query(rows)).rows[0].n, 0, "nobody is enabled by the migration");
  } finally { await before.close(); await after_.close(); }
});

test("regional folder: preconditions refuse a project without the reviewed 20261020 policy, with another policy on the bucket, or applied twice", { skip: SKIP }, async () => {
  const bare = await fresh();
  try { await assert.rejects(() => apply(bare, regione), /PCR_PRE_HELPER|PCR_PRE_POLICY/); } finally { await bare.close(); }
  const extra = await fresh();
  try {
    await apply(extra, base);
    await extra.exec(`create policy "stray read" on storage.objects for select to authenticated using (bucket_id = 'pillar-c-scoped')`);
    await assert.rejects(() => apply(extra, regione), /PCR_PRE_POLICY/);
  } finally { await extra.close(); }
  const twice = await fresh();
  try {
    await apply(twice, base); await apply(twice, regione);
    await assert.rejects(() => apply(twice, regione), /PCR_PRE_POLICY/);
  } finally { await twice.close(); }
});

test("regional folder: weakened variants of the clause are caught by the audience checks above", { skip: SKIP }, async () => {
  const FULL = "array['aggregato', 'asl-1', 'asl-2', 'asl-3', 'asl-4']::text[]";
  const mutants = {
    "overlap instead of containment (an Azienda reads it)": regione.replace(`@> ${FULL}`, `&& ${FULL}`),
    "aggregate alone suffices": regione.replace(`@> ${FULL}`, "@> array['aggregato']::text[]"),
    "any enabled session": regione.replace(/\n\s+and \(select public\.pillar_c_scoped_units\(\)\)::text\[\] @> array\[[^\]]+\]::text\[\]\)\)/, "))"),
    "folder admitted to everyone": regione.replace("or ((storage.foldername(name))[2] = 'regione'", "or ((storage.foldername(name))[2] = 'regione' or true"),
  };
  // The audience checks must catch each mutant by themselves: the migration's own post-condition is taken out, so a
  // mutant that would fail it still reaches the reads (review of 24 Oct 2026, test lens).
  const withoutPost = (text) => text.replace(/\ndo \$post\$[\s\S]*?\$post\$;\n/, "\n");
  assert.notEqual(withoutPost(regione), regione, "post-condition block found");
  for (const [label, text] of Object.entries(mutants)) {
    assert.notEqual(text, regione, `${label}: mutation applied`);
    const db = await fresh();
    try {
      await apply(db, base); await apply(db, withoutPost(text));
      await db.exec(SEED_USERS()); await db.exec(OBJECTS); await db.exec(ROLLOUT);
      const caught = JSON.stringify(await visible(db, ID.r)) !== JSON.stringify(EXPECT.r) || JSON.stringify(await visible(db, ID.a1)) !== JSON.stringify(EXPECT.a1)
        || (await visible(db, ID.a1b)).length > 0;
      assert.ok(caught, `${label}: not caught by the audience checks`);
    } finally { await db.close(); }
  }
});
