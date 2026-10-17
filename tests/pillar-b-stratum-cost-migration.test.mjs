import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// The per-stratum unit cost function (supabase/migrations/20261018090000),
// pinned as text. Its rules are the margin's own (lib/dashboard-review/
// biosimilar.ts); each predicate below names the line of that file it mirrors.
// The behaviour itself, parity with that code per Azienda × year × molecule ×
// stratum, role isolation and the edge cases, is proven in PGlite on the
// frozen release by outputs/pillar-b/stratum-cost/b54 (outside this public
// repository). A change to either side that is not made to the other must
// fail somewhere: here for the text, there for the figures.

const dir = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
const FILE = "20261018090000_pillar_b_stratum_unit_cost.sql";
const sql = fs.readFileSync(`${dir}${FILE}`, "utf8").replace(/\r\n/g, "\n");
// The same naive comment stripper as tests/pillar-b-search-path.test.mjs: the
// migration keeps every double hyphen out of its string literals for it.
const code = sql.replace(/--[^\n]*/g, "");
const body = code.slice(code.indexOf("as $$"), code.lastIndexOf("$$;"));
/** One CTE of the body, from its name to the next one's. */
const cte = (name, next) => {
  const start = body.search(new RegExp(String.raw`\b${name} as (?:materialized )?\(`));
  const end = body.search(new RegExp(String.raw`\b${next} as (?:materialized )?\(`));
  assert.ok(start >= 0 && end > start, `${name} precedes ${next}`);
  return body.slice(start, end);
};

test("it runs after the search-path hardening, and its header is prose about an owner-approved apply", () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(files.indexOf(FILE) > files.indexOf("20261009160000_pillar_b_search_path_temp_last.sql"));
  assert.match(sql, /^-- Pillar B — observed gross spend and quantity per comparability stratum, for\n-- ONE Azienda/);
  for (const phrase of [/DORMANT UNTIL APPLIED/, /explicit owner approval/, /17 October 2026/, /no ratio,\n-- no difference, no saving/i,
    /SECURITY INVOKER/, /NULL AZIENDA IS REFUSED/, /Not PB-V5-08/, /MASS UNITS ONLY/, /LATER MIGRATIONS/]) {
    assert.match(sql, phrase);
  }
  // No figure in the header: the repository is public.
  const header = sql.slice(0, sql.indexOf("create or replace function"));
  // Migration ids, the decision date, tracker ids and the release's years are not figures.
  assert.doesNotMatch(header.replace(/(?<!\d)2026\d{10}(?!\d)|17 October 2026|PB-V5-0\d|b54|\b202[4-6]\b/g, ""), /\d{2,}|€/);
});

test("one function: signature, return type, volatility, security mode and search_path", () => {
  assert.equal((code.match(/create or replace function/g) ?? []).length, 1);
  assert.match(code, /create or replace function public\.pillar_b_stratum_unit_cost\(\n  p_years      int\[\],\n  p_asl_code   text,\n  p_channels   text\[\] default null,\n  p_substance  text   default null\n\)\nreturns jsonb\nlanguage plpgsql\nstable\nsecurity invoker\nset search_path = pg_catalog, public, pg_temp\nas \$\$\n/);
  for (const bad of [/security\s+definer/i, /\bdrop\b/i, /\balter\s+policy\b/i, /\balter\s+table\b/i, /\bcreate\s+table\b/i,
    /\bgrant\b[^;]*\banon\b/i, /\bcreate\s+temp/i, /\bowner\s+to\b/i, /exception\s+when\s+others/i]) {
    assert.doesNotMatch(code, bad);
  }
  const grants = [...code.matchAll(/^\s*(grant|revoke)\b[^;]*;/gim)].map((m) => m[0].trim());
  assert.deepEqual(grants, [
    "revoke all on function public.pillar_b_stratum_unit_cost(int[], text, text[], text) from public, anon;",
    "grant execute on function public.pillar_b_stratum_unit_cost(int[], text, text[], text) to authenticated, service_role;",
  ]);
  assert.match(code, /comment on function public\.pillar_b_stratum_unit_cost\(int\[\], text, text\[\], text\) is/);
});

test("the refusals: years 2024/2025 only, one Azienda, a real channel list; all as 22023", () => {
  assert.match(body, /if p_years is null or cardinality\(p_years\) = 0\n\s+or array_position\(p_years, null\) is not null\n\s+or not \(p_years <@ array\[2024, 2025\]\) then\n\s+raise exception 'pillar_b_stratum_unit_cost: p_years must name 2024, 2025 or both'\n\s+using errcode = '22023'/);
  assert.match(body, /if p_asl_code is null or btrim\(p_asl_code\) = '' then\n\s+raise exception 'pillar_b_stratum_unit_cost: p_asl_code is required; unit costs are read one Azienda at a time'\n\s+using errcode = '22023';/,
    "no pooling across Aziende in SQL (organization-biosimilar.ts)");
  assert.match(body, /if p_channels is not null\n\s+and \(cardinality\(p_channels\) = 0 or array_position\(p_channels, null\) is not null\) then\n\s+raise exception '[^']*'\n\s+using errcode = '22023';/,
    "an empty array would silently select nothing");
  assert.equal((body.match(/using errcode = '22023'/g) ?? []).length, 3);
  assert.match(body, /v_release := public\.pillar_b_release\(\);/, "gated on the active release");
});

test("the margin's rules, each pinned to the line it mirrors", () => {
  // R1 whole release, ONE Azienda; no year, channel, status or route predicate in the base set.
  const azienda = cte("azienda", "opened");
  assert.match(azienda, /from public\.canonical_fact f\n\s+where f\.source_version_id = v_release\n\s+and f\.asl_code = p_asl_code\n\s+\),\n\s*$/);
  assert.doesNotMatch(azienda.slice(azienda.indexOf("where")), /year|channel|perimeter_status|route|source_disposition/);
  // R2 isBiosimilar (biosimilar.ts:153-155).
  assert.ok(azienda.includes("coalesce(f.biosimilar_flag is true or f.perimeter_status = 'biosimilar', false) as is_bio,"));
  // R3 isOriginatorSide (biosimilar.ts:162-165): never unresolved or same-substance.
  assert.ok(azienda.includes(`coalesce(not coalesce(f.biosimilar_flag is true or f.perimeter_status = 'biosimilar', false)
               and (f.originator_flag is true or f.biosimilar_flag is false
                    or f.perimeter_status = 'reference_medicine'), false) as is_ref,`));
  // R4 monthSpan (biosimilar.ts:83-90): no valid month spans January to December.
  assert.ok(azienda.includes("f.year * 12 + case when f.month between 1 and 12 then f.month else 1 end  as first_key"));
  assert.ok(azienda.includes("f.year * 12 + case when f.month between 1 and 12 then f.month else 12 end as last_key"));
  // R5 firstLocalDispensing (biosimilar.ts:173-188): skip an empty substance, packs or spend positive, min.
  const opened = cte("opened", "pop");
  assert.ok(opened.includes(`    where a.is_bio
      and coalesce(a.active_substance, '') <> ''
      and (coalesce(a.quantity_packs, 0) > 0 or coalesce(a.total_cost_eur, 0) > 0)
    group by a.active_substance`));
  assert.match(opened, /min\(a\.first_key\) as opening_key/);
  for (const narrowing of ["p_channels", "v_years", "p_substance", "year", "channel", "route"]) {
    assert.ok(!opened.includes(narrowing), `the opening is never narrowed by ${narrowing}`);
  }
  // R6 the population, R8 isLocallySubstitutable (biosimilar.ts:204), R9 MG_PER_UNIT (biosimilar.ts:100).
  const pop = cte("pop", "mol");
  assert.ok(pop.includes("coalesce(o.opening_key is not null and a.last_key >= o.opening_key, false) as in_window"));
  assert.ok(pop.includes("case when a.comparable_eligible is true then"));
  assert.ok(pop.includes("case a.unit when 'MG' then 1::numeric when 'MCG' then 0.001::numeric when 'G' then 1000::numeric end"));
  assert.match(pop, /where a\.year = any \(v_years\)\n\s+and \(p_channels  is null or a\.channel          = any \(p_channels\)\)\n\s+and \(p_substance is null or a\.active_substance = p_substance\)/);
  // R7 a molecule needs a biosimilar row that year, at any cost (biosimilar.ts:458-468).
  assert.match(cte("mol", "rows_in"), /where p\.is_bio and coalesce\(p\.active_substance, ''\) <> ''/);
  // R10 measurableFacts (biosimilar.ts:216-222).
  assert.ok(body.includes("coalesce(p.mg_factor is not null and p.comparable_quantity > 0 and p.total_cost_eur > 0, false) as measurable"));
  assert.match(cte("meas", "shared"), /where r\.in_window and r\.measurable and \(r\.is_bio or r\.is_ref\)/);
  // R12 shared strata (biosimilar.ts:503-508).
  assert.match(cte("shared", "side_channel"), /group by m\.year, m\.active_substance, m\.comparable_stratum_id\n\s+having bool_or\(m\.is_ref\) and bool_or\(m\.is_bio\)/);
  // R11 the legacy mass branch is counted, never used.
  assert.match(body, /and p\.comparable_eligible is not true\n\s+and p\.total_content_mg > 0 and p\.quantity_packs > 0 and p\.total_cost_eur > 0\)\s+as legacy_mass_rows/);
  // No filter the margin does not have.
  for (const absent of ["source_disposition", "classification_valid_from", "product_route"]) assert.ok(!body.includes(absent), absent);
  // Every relation it reads is schema-qualified, or one of its own CTEs.
  const rels = [...body.matchAll(/\b(?:from|join)\s+([a-z_][\w.]*)/gi)].map((m) => m[1].toLowerCase());
  const ctes = new Set(["azienda", "opened", "pop", "mol", "rows_in", "meas", "shared", "side_channel", "side", "strata", "funnel", "year_level", "unnest"]);
  assert.deepEqual([...new Set(rels.filter((r) => !ctes.has(r)))].sort(), ["public.canonical_fact"]);
});

test("the answer's keys are the contract's, with no organisation code and no release id", () => {
  const keys = new Set([...body.matchAll(/'([a-z_]+)',\s/g)].map((m) => m[1]));
  const CONTRACT = new Set([
    "years", "channels", "substance", "by_year", "year", "months_observed", "reference_all_eur", "reference_undated_eur",
    "reference_no_substance_eur", "reference_without_biosimilar_eur", "legacy_mass_rows", "molecules", "active_substance",
    "opening_key", "opening_from_undated", "reference", "biosimilar", "not_compared", "strata", "r_eur", "p_eur", "w_eur",
    "m_eur", "s_eur", "rows_n", "b_eur", "unresolved_eur", "non_biosimilar_same_substance_eur", "other_eur", "stratum_id",
    "shared", "spend_eur", "quantity", "mass_mg", "unit", "unit_count",
  ]);
  // Literals that are values, not keys.
  const values = new Set(["biosimilar", "reference_medicine", "unresolved", "non_biosimilar_same_substance", "MG", "MCG", "G"]);
  const unknown = [...keys].filter((k) => !CONTRACT.has(k) && !values.has(k));
  assert.deepEqual(unknown, []);
  for (const k of ["channels", "strata", "spend_eur", "quantity", "mass_mg", "opening_key"]) assert.ok(keys.has(k), k);
  assert.doesNotMatch(body, /'asl_code'|'release'|'release_id'|to_jsonb\(p_asl_code\)|to_jsonb\(v_release\)/);
});
