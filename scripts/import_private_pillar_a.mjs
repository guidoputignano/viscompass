// Import the verified private Pillar A release, and verify it afterwards.
//
// The generated private-v2-import.sql needs a SQL execution path (dashboard or
// psql). This does the same work over PostgREST with the service-role key, which
// is the credential actually available, and keeps the same guard: it refuses to
// touch an existing release rather than overwriting one.
//
// Run:  node scripts/import_private_pillar_a.mjs [--apply]
// Without --apply it validates and reports, and writes nothing.
//
// Never prints the key. Requires in the environment:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = fileURLToPath(new URL("..", import.meta.url));
const apply = process.argv.includes("--apply");
const TABLE = "pillar_a_private_fact";
const RELEASE = "closure-20260923";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API).");
  process.exit(2);
}

const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const facts = read("private-staging/closure/private-v2-facts.json");
const indicators = read("private-staging/closure/indicators.json");

// ---- validate the payload before it goes anywhere near the database ----
const problems = [];
const EXPECTED = { rows: 48, orgs: 4, years: 3, categories: 4 };
if (facts.length !== EXPECTED.rows) problems.push(`expected ${EXPECTED.rows} rows, found ${facts.length}`);

const orgs = [...new Set(facts.map((r) => r.org_code))].sort();
const years = [...new Set(facts.map((r) => r.year))].sort();
const cats = [...new Set(facts.map((r) => r.aware_category))].sort();
if (orgs.length !== EXPECTED.orgs) problems.push(`expected ${EXPECTED.orgs} org codes, found ${orgs.join(",")}`);
if (years.length !== EXPECTED.years) problems.push(`expected ${EXPECTED.years} years, found ${years.join(",")}`);
if (cats.join(",") !== "A,R,T,W") problems.push(`expected categories A,R,T,W, found ${cats.join(",")}`);

for (const row of facts) {
  const at = `${row.org_code}/${row.year}/${row.aware_category}`;
  if (row.release_id !== RELEASE) problems.push(`${at}: release_id is ${row.release_id}`);
  if (row.activity_variant !== "A3/T1") problems.push(`${at}: activity_variant is ${row.activity_variant}`);
  if (!/^[a-f0-9]{64}$/.test(String(row.source_hash ?? ""))) problems.push(`${at}: source_hash is not a sha256`);
  for (const field of ["cf", "cmr", "ddd", "activity"]) {
    const v = row[field];
    if (typeof v !== "number" || !Number.isFinite(v)) problems.push(`${at}: ${field} is not a finite number`);
    else if (v < 0) problems.push(`${at}: ${field} is negative`);
  }
  if (!(row.activity > 0)) problems.push(`${at}: activity must be positive to be a denominator`);
}

// The T row must equal the sum of A + W + R for the same org and year. This is
// the identity the aggregate rests on; if it fails, the import is wrong.
for (const org of orgs) {
  for (const year of years) {
    const of = (c) => facts.find((r) => r.org_code === org && r.year === year && r.aware_category === c);
    const total = of("T");
    if (!total) { problems.push(`${org}/${year}: no T row`); continue; }
    for (const field of ["cf", "cmr", "ddd"]) {
      const parts = ["A", "W", "R"].reduce((s, c) => s + (of(c)?.[field] ?? 0), 0);
      const diff = Math.abs(parts - total[field]);
      if (diff > 0.01) problems.push(`${org}/${year} ${field}: A+W+R ${parts} != T ${total[field]} (${diff})`);
    }
  }
}

// And the payload must agree with the independently computed indicators.
for (const row of facts) {
  const want = indicators.find((r) => r.org === row.org_code && r.year === row.year && r.aware === row.aware_category);
  if (!want) { problems.push(`${row.org_code}/${row.year}/${row.aware_category}: no matching indicator row`); continue; }
  for (const [field, key2] of [["cf", "CF"], ["cmr", "CMR"], ["ddd", "DDD"], ["activity", "activity"]]) {
    if (Math.abs(row[field] - want[key2]) > 0.01) {
      problems.push(`${row.org_code}/${row.year}/${row.aware_category} ${field}: ${row[field]} != indicators ${want[key2]}`);
    }
  }
}

console.log(`payload: ${facts.length} rows · orgs ${orgs.join(",")} · years ${years.join(",")} · categories ${cats.join(",")}`);
if (problems.length) {
  console.error(`\nREFUSING: ${problems.length} problem(s) in the payload`);
  problems.slice(0, 15).forEach((p) => console.error("  - " + p));
  process.exit(1);
}
console.log("payload validated: totals reconcile with indicators.json and A+W+R equals T everywhere");

const db = createClient(url, key, { auth: { persistSession: false } });

// ---- refuse to touch an existing release ----
const { count, error: countError } = await db.from(TABLE).select("*", { count: "exact", head: true }).eq("release_id", RELEASE);
if (countError) {
  console.error(`Cannot read ${TABLE}: ${countError.message}`);
  console.error(countError.code === "42P01" ? "The table does not exist: apply supabase/migrations/20260923_private_pillar_a.sql first." : "");
  process.exit(1);
}
console.log(`database: ${TABLE} currently holds ${count} row(s) for release ${RELEASE}`);
if (count > 0) {
  console.error("Release already exists: no overwrite. Delete it deliberately if you mean to reload.");
  process.exit(1);
}

if (!apply) {
  console.log("\nDry run. Re-run with --apply to insert.");
  process.exit(0);
}

const { error: insertError } = await db.from(TABLE).insert(facts.map((r) => ({ ...r })));
if (insertError) {
  console.error(`Insert failed: ${insertError.message}`);
  process.exit(1);
}

// ---- verify what actually landed, by reading it back ----
const { data: back, error: readError } = await db.from(TABLE).select("*").eq("release_id", RELEASE);
if (readError) { console.error(`Read-back failed: ${readError.message}`); process.exit(1); }

const failures = [];
if (back.length !== EXPECTED.rows) failures.push(`read back ${back.length} rows, expected ${EXPECTED.rows}`);
for (const row of facts) {
  const got = back.find((r) => r.org_code === row.org_code && r.year === row.year && r.aware_category === row.aware_category);
  if (!got) { failures.push(`${row.org_code}/${row.year}/${row.aware_category} missing after insert`); continue; }
  for (const field of ["cf", "cmr", "ddd", "activity"]) {
    if (Math.abs(Number(got[field]) - row[field]) > 0.01) failures.push(`${row.org_code}/${row.year}/${row.aware_category} ${field} changed on write`);
  }
}

console.log(`\nread back ${back.length} rows · ${[...new Set(back.map((r) => r.org_code))].sort().join(",")}`);
if (failures.length) {
  console.error(`VERIFICATION FAILED: ${failures.length} problem(s)`);
  failures.slice(0, 10).forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log("PASS: 48 rows imported and read back identical. Isolation tests next; do not enable the private section until they pass.");
