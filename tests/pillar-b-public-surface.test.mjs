import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PUBLIC_PATHS, isPublicPath } from "../lib/supabase/public-paths.ts";

// The confidentiality boundary of the public Pillar B page, as code that can
// fail. Everything derived from the confidential Abruzzo workbook stays behind
// login; /pillar-b renders an independently published AIFA table and nothing
// else.

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const EXT = [".ts", ".tsx", ".mjs", ".js", ".json"];

function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = path.join(root, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null;   // a package
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const e of EXT) if (fs.existsSync(base + e)) return base + e;
  for (const e of EXT) if (fs.existsSync(path.join(base, "index" + e))) return path.join(base, "index" + e);
  return null;
}
const IMPORT = /(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;
function importGraph(entry) {
  const seen = new Map();
  const stack = [path.join(root, entry)];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const specs = [...text.matchAll(IMPORT)].map((m) => m[1] ?? m[2] ?? m[3]);
    seen.set(file, specs);
    if (file.endsWith(".json")) continue;
    for (const s of specs) { const r = resolveSpecifier(s, file); if (r) stack.push(r); }
  }
  return seen;
}

test("the public paths are exactly these, matched exactly", () => {
  assert.deepEqual([...PUBLIC_PATHS], ["/pillar-a", "/api/pillar-a/series", "/api/pillar-a/osmed", "/api/pillar-a/atc4", "/pillar-b"]);
  assert.equal(isPublicPath("/pillar-b"), true);
  for (const p of ["/pillar-b/", "/pillar-b/dati", "/api/pillar-b", "/dashboard-review/revisione-pillar-b", "/pillar-bx", "/Pillar-B"]) {
    assert.equal(isPublicPath(p), false, `${p} must need a session`);
  }
  const proxy = read("lib/supabase/proxy.ts");
  assert.ok(proxy.includes("if (isPublicPath(request.nextUrl.pathname)) {"), "the proxy uses the exact-match helper");
  assert.equal(/startsWith\(\s*["']\/pillar/.test(proxy), false, "no prefix rule for the public pages");
});

test("the public page's whole import graph stays outside the private modules", () => {
  const graph = importGraph("app/pillar-b/page.tsx");
  const files = [...graph.keys()].map((f) => path.relative(root, f).replaceAll("\\", "/"));
  assert.ok(files.includes("components/pillar-b-public.tsx") && files.includes("lib/pillar-b-public/server-data.ts"), "the walk reaches the page's modules");
  // One file under lib/dashboard-review is shared on purpose: the Italian
  // formatter (format.ts), which holds no data and imports only the number
  // helper. Everything else under the private folders is forbidden.
  const SHARED = new Set(["lib/dashboard-review/format.ts"]);
  assert.ok(files.every((f) => !SHARED.has(f) || !/from ["']@\/lib\/(dashboard-review\/pillar-b|supabase|auth)/.test(read(f))), "the shared formatter imports nothing private");
  for (const f of files) {
    if (SHARED.has(f)) continue;
    for (const forbidden of ["lib/dashboard-review/", "components/dashboard-review/", "lib/supabase/", "lib/auth/", "lib/analytics/private"]) {
      assert.equal(f.startsWith(forbidden), false, `/pillar-b reaches ${f}`);
    }
  }
  for (const [file, specs] of graph) {
    for (const s of specs) assert.equal(s.startsWith("@supabase/"), false, `${path.relative(root, file)} imports ${s}`);
  }
  const page = read("app/pillar-b/page.tsx");
  assert.ok(page.includes("@/lib/pillar-b-public/server-data"), "the page reads the public asset through the server loader");
  const loader = read("lib/pillar-b-public/server-data.ts");
  assert.ok(loader.includes('import "server-only"'));
  assert.ok(loader.includes("data/public-compiled/pillar-b-aifa-ev-sc-2025.json"));
});

test("no client component imports a module that holds confidential figures, keys or private scope", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (!["node_modules", ".next"].includes(entry.name)) walk(rel); continue; }
      if (!/\.(tsx?|mjs)$/.test(entry.name)) continue;
      const text = read(rel);
      if (!/^\s*["']use client["']/.test(text)) continue;
      for (const m of text.matchAll(IMPORT)) {
        const spec = m[1] ?? m[2] ?? m[3];
        if (/pillar-b\/(workbook-map|scope|rpc)$|supabase\/service-role$|auth\/reviewer$/.test(spec)) offenders.push(`${rel} -> ${spec}`);
      }
    }
  };
  for (const d of ["app", "components"]) walk(d);
  assert.deepEqual(offenders, []);
});

test("the public asset carries no provenance, no private identifiers and no euro amount", () => {
  const text = read("data/public-compiled/pillar-b-aifa-ev-sc-2025.json");
  assert.equal(/[a-f0-9]{64}/.test(text), false, "digest-shaped value in the public asset");
  assert.equal(/(^|[\\/])data[\\/]raw[\\/]/.test(text), false);
  for (const word of ["ASL 1", "ASL 2", "Azienda", "130201", "130202", "130203", "130204", "canonical", "workbook", "VIS_PillarB"]) {
    assert.equal(text.includes(word), false, `public asset mentions "${word}"`);
  }
  const data = JSON.parse(text);
  const seen = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) { seen.add(k); walk(v); }
  };
  walk(data);
  for (const key of ["sources", "checks", "sourceFile", "source_file", "sha256", "source_sha256", "source_cells", "method"]) {
    assert.equal(seen.has(key), false, `public asset carries the "${key}" key`);
  }
  for (const r of data.rows) {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "number" && k !== "page") assert.ok(v <= 100, `${k} = ${v}`);
    }
  }
  const prov = JSON.parse(read("data/provenance/pillar-b-aifa-ev-sc-2025.json"));
  assert.match(prov.source_sha256, /^[a-f0-9]{64}$/);
  assert.equal(prov.tables.length, 9);
  assert.equal(prov.checks.rows, data.rows.length);
  assert.equal(prov.source_url, data.source.url);
});

test("nothing of Pillar B is served as a static asset, and no API route reads the private modules", () => {
  const NAME = /pillar[-_ ]?b|canonical_fact|VIS_PillarB/i;
  assert.ok(NAME.test("pillar_b_facets.json") && NAME.test("PillarB.csv"), "the pattern catches both spellings");
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (NAME.test(entry.name) && /\.(json|csv|xlsx|parquet|ndjson|txt|js)$/i.test(entry.name)) offenders.push(path.relative(root, full));
    }
  };
  const publicDir = path.join(root, "public");
  if (fs.existsSync(publicDir)) walk(publicDir);
  assert.deepEqual(offenders, []);
  assert.equal(fs.existsSync(path.join(root, "app/api/pillar-b")), false, "no Pillar B API route exists");
  const routes = [];
  const walkApi = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkApi(full);
      else if (/^route\.(ts|tsx|js)$/.test(entry.name)) routes.push(full);
    }
  };
  walkApi(path.join(root, "app/api"));
  for (const r of routes) {
    assert.equal(fs.readFileSync(r, "utf8").includes("@/lib/dashboard-review/pillar-b"), false, `${path.relative(root, r)} reads the private Pillar B modules`);
  }
});

test("the public navigation names Pillar B beside Pillar A and the page links into the reserved analysis", () => {
  const home = read("app/page.tsx");
  assert.ok(home.includes('href="/pillar-a"'));
  assert.ok(home.includes('href="/pillar-b"'));
  assert.ok(home.includes("Biosimilari ed esclusività"), "the Pillar B link carries its subtitle");
  const page = read("app/pillar-b/page.tsx");
  assert.ok(page.includes("/dashboard-review/revisione-pillar-b"), "the public page points to the reserved analysis");
  const component = read("components/pillar-b-public.tsx");
  for (const phrase of ["tre molecole", "acquisti diretti", "2025", "non contiene dati sull&apos;esclusività"]) {
    assert.ok(component.toLowerCase().includes(phrase.toLowerCase()), `the public page must say "${phrase}"`);
  }
  // The position tile counts from the highest share whatever the table order.
  assert.ok(component.includes('rankTerritories(asset, sel.molecule, sel.measure, "desc")'));
  assert.ok(component.includes("positionOf(rankDesc, sel.territory)"));
});
