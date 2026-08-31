// VIS PHARMA COMPASS — antibiotic stewardship (AWaRe) data loader
// Loads ASL-level rows only into antibiotic_consumption_fact (see
// supabase_schema.sql section 8). Department-level (UU.OO.) rows are
// deliberately NOT loaded here — see the comment above ASL_CODES below.
//
// Usage:
//   npm install @supabase/supabase-js exceljs
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node load_antibiotic_consumption.mjs [path-to-workbook.xlsm]
//
// Uses exceljs rather than the "xlsx" package: the xlsx package's npm
// registry release (0.18.5) carries a disclosed high-severity prototype
// pollution / ReDoS advisory that SheetJS only fixed in CDN-only releases
// npm doesn't serve — exceljs is actively maintained and has no comparable
// advisory in its own parsing path.
//
// SUPABASE_SERVICE_ROLE_KEY (not the anon key) is required — this script writes data
// and must bypass Row Level Security. Never expose the service role key in client code
// or commit it to git; pass it as an environment variable only.
//
// Source workbook layout (confirmed against Dati_Analisi_v02.xlsm, cross-checked by
// back-computing the three indicators from Dati_Rpt's own precomputed T1/T2/T3 columns
// for ASL 201/2023 and matching to rounding):
//
//   Dati_CO sheet: repeating blocks of columns
//     A=tag, B=aware_category, C=org_code, D-F=cost 2023-2025, G=blank,
//     H=org_code (repeated), I-K=ddd 2023-2025, ...
//   tag is 'CO' (raw, "flusso traccia") or 'CO1' (normalized) — the "Dati" legend
//   sheet (A3/B3 = "DATI CO - NORMALIZZATI"/"CO1") confirms CO1 is the reconciled
//   figure actually used downstream, so only CO1 rows are loaded as cost_eur/ddd_count.
//   org_code is either a numeric ASL code ('201'..'204'), '130' (the whole-region
//   total, "Abruzzo" — not an ASL, excluded), or a department code (excluded, see
//   ASL_CODES below).
//
//   Dati_GG sheet: columns A=year, B=flag, C=org_code, D=T, E=T1, F=blank, G=GG.
//   flag distinguishes three bed-days methodologies (legend: A1/A2/A3 = different
//   onere/DRG exclusion rules). The "Report" sheet's own "GG DEGENZA" label matches
//   A2's definition verbatim ("DEGENZA + ACCESSI - ESCLUDI ONERE '4' E DRG 391"),
//   and only flag='A2' rows have the GG column populated (equal to T1; 0 for the
//   other methodologies) — confirming A2/T1 is the one the real report uses. That's
//   what's loaded as bed_days.
//
// Both assumptions above are asserted against the workbook's own "Dati" legend sheet
// before loading anything (see assertLegend) — if the workbook is ever revised and the
// legend text changes, this script fails loudly instead of silently loading the wrong
// column.

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import fs from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKBOOK_PATH = process.argv[2] ?? "./Dati_Analisi_v02.xlsm";
const YEARS = [2023, 2024, 2025];

// The four real Abruzzo ASL codes carried in the source workbook, used as
// antibiotic_consumption_fact.org_code AS-IS (no invented prefix/rename) —
// this assumes the live organizations table's org_code for these four ASLs is
// literally '201'/'202'/'203'/'204'. If it uses a different convention (e.g.
// 'ASL201'), the insert below fails on the org_code foreign key — update
// ASL_CODES to match rather than silently loading under the wrong key.
//
// Anything else in the sheets (department codes AL/DC/DM/EM/PN/PO/TI, the
// 'AZ' whole-ASL check row, and '130' the region total) is excluded: this
// loader is ASL-level only. Department rows need the real unit-name legend
// confirmed first — loading them under a placeholder risks shipping wrong
// clinical-unit labels.
const ASL_CODES = new Set(["201", "202", "203", "204"]);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.");
  process.exit(1);
}

if (!fs.existsSync(WORKBOOK_PATH)) {
  console.warn(
    `No workbook at ${WORKBOOK_PATH}. Pass its path as the first argument, or place it there and re-run.`,
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function getSheet(wb, name) {
  const sheet = wb.getWorksheet(name);
  if (!sheet) throw new Error(`Workbook is missing the expected "${name}" sheet.`);
  return sheet;
}

// row.values from exceljs is a 1-indexed sparse array (values[0] is unused) —
// col(row, 1) is column A, col(row, 2) is column B, etc.
function col(row, n) {
  const v = row.values[n];
  return v === undefined ? null : v;
}

// Confirms the workbook's own legend still says what this loader assumes it
// says, before trusting any positional column mapping below.
export function assertLegend(wb) {
  const sheet = getSheet(wb, "Dati");
  const cell = (r, c) => col(sheet.getRow(r), c);
  const checks = [
    [cell(3, 1), "DATI CO - NORMALIZZATI", "Dati!A3"],
    [cell(3, 2), "CO1", "Dati!B3"],
    [cell(6, 1), 'DEGENZA + ACCESSI - ESCLUDI ONERE "4" E DRG 391', "Dati!A6"],
    [cell(6, 2), "A2", "Dati!B6"],
    [cell(9, 1), "DDD/100 GIORNATE DI DEGENZA", "Dati!A9"],
    [cell(9, 2), "T1", "Dati!B9"],
    [cell(10, 1), "SPESA PER GIORNATA DI DEGENZA", "Dati!A10"],
    [cell(10, 2), "T2", "Dati!B10"],
    [cell(11, 1), "SPESA PER DDD", "Dati!A11"],
    [cell(11, 2), "T3", "Dati!B11"],
  ];
  const mismatches = checks.filter(([actual, expected]) => actual !== expected);
  if (mismatches.length > 0) {
    throw new Error(
      "Dati sheet legend doesn't match what this loader assumes — the workbook may have " +
        "been revised. Do not run this as-is; verify the CO1/A2/T1/T2/T3 mapping by hand first.\n" +
        mismatches
          .map(([actual, expected, loc]) => `  ${loc}: expected "${expected}", found ${JSON.stringify(actual)}`)
          .join("\n"),
    );
  }
}

// Dati_CO: cost_eur + ddd_count, CO1 (normalized) rows only, ASL-level only.
// Returns Map<"org|category|year", { cost, ddd }>.
export function readCostAndDdd(wb) {
  const sheet = getSheet(wb, "Dati_CO");
  const out = new Map();
  sheet.eachRow((row) => {
    const tag = col(row, 1);
    const category = col(row, 2);
    const org = col(row, 3);
    const org2 = col(row, 8);
    if (tag !== "CO1") return;
    if (!ASL_CODES.has(String(org))) return;
    if (!["T", "A", "W", "R"].includes(category)) return;
    if (String(org2) !== String(org)) {
      throw new Error(
        `Dati_CO row ${row.number}: cost block org "${org}" and DDD block org "${org2}" don't match — ` +
          `the sheet's column layout may have shifted from what this loader assumes.`,
      );
    }
    const costs = { 2023: col(row, 4), 2024: col(row, 5), 2025: col(row, 6) };
    const ddds = { 2023: col(row, 9), 2024: col(row, 10), 2025: col(row, 11) };
    for (const year of YEARS) {
      out.set(`${org}|${category}|${year}`, { cost: costs[year], ddd: ddds[year] });
    }
  });
  return out;
}

// Dati_GG: bed_days, flag='A2' rows only, ASL-level only.
// Returns Map<"org|year", bedDays>.
export function readBedDays(wb) {
  const sheet = getSheet(wb, "Dati_GG");
  const out = new Map();
  sheet.eachRow((row) => {
    const yearRaw = col(row, 1);
    const flag = col(row, 2);
    const org = col(row, 3);
    if (flag !== "A2") return;
    if (!ASL_CODES.has(String(org))) return;
    const year = Number(yearRaw);
    if (!YEARS.includes(year)) return;
    out.set(`${org}|${year}`, col(row, 5)); // column E = T1
  });
  return out;
}

export async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORKBOOK_PATH);
  assertLegend(wb);

  const costDdd = readCostAndDdd(wb);
  const bedDaysByOrgYear = readBedDays(wb);

  const rows = Array.from(costDdd.entries()).map(([key, { cost, ddd }]) => {
    const [org, category, yearStr] = key.split("|");
    const year = Number(yearStr);
    return {
      org_code: org,
      unit_code: null,
      aware_category: category,
      year,
      cost_eur: cost,
      ddd_count: ddd,
      bed_days: bedDaysByOrgYear.get(`${org}|${year}`) ?? null,
      source_note:
        "OSMED methodology; cost/DDD from Dati_CO (CO1, normalizzati); bed-days from Dati_GG " +
        '(flag A2: degenza + accessi, esclude onere "4" e DRG 391)',
    };
  });

  if (rows.length === 0) {
    console.warn("No ASL-level rows extracted — check ASL_CODES and the sheet contents.");
    return;
  }

  console.log(`Loading ${rows.length} ASL-level antibiotic_consumption_fact rows...`);

  // Delete-then-insert per natural key rather than .upsert(): the ASL-level
  // uniqueness is enforced by a PARTIAL index (unit_code is null — see
  // supabase_schema.sql section 8), and PostgREST's upsert only infers a
  // plain (non-partial) unique constraint from an onConflict column list, so
  // it can't target that index. This is simpler and correct regardless.
  const orgCodes = Array.from(new Set(rows.map((r) => r.org_code)));
  const { error: deleteError } = await supabase
    .from("antibiotic_consumption_fact")
    .delete()
    .is("unit_code", null)
    .in("org_code", orgCodes)
    .in("year", YEARS);
  if (deleteError) {
    console.error("Failed to clear existing ASL-level rows before reload:", deleteError.message);
    process.exit(1);
  }

  const { error: insertError } = await supabase.from("antibiotic_consumption_fact").insert(rows);
  if (insertError) {
    console.error("Insert failed:", insertError.message);
    process.exit(1);
  }

  console.log(`Done: ${rows.length} rows loaded.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
