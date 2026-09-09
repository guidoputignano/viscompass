// VIS PHARMA COMPASS — gold-file loader (DIR_OSP_TRA_003AS sell-in / sell-out)
// Loads the regional sell-in/sell-out extraction into canonical_fact, resolving
// atc1..atc5 from the two AIC→ATC sources described below.
//
// Usage:
//   npm install @supabase/supabase-js exceljs
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node load_gold_file.mjs --year=2025 [--atc-workbook="./Combined data.xlsx"] \
//       [--source-version=...] [--dry-run] [path-to-gold-file.xlsx]
//
// --year is REQUIRED and is the operator's declaration of which extraction this
// is. See "Year validation" below for why it cannot be inferred.
//
// Uses exceljs rather than the "xlsx" package, for the reason documented in
// load_antibiotic_consumption.mjs: the xlsx npm release carries a disclosed
// high-severity advisory that SheetJS only fixed in CDN-only releases.
//
// SUPABASE_SERVICE_ROLE_KEY (not the anon key) is required — this script writes
// data and must bypass Row Level Security. Never expose the service role key in
// client code or commit it to git; pass it as an environment variable only.
//
// ---------------------------------------------------------------------------
// Year validation
// ---------------------------------------------------------------------------
// A 2024 and a 2025 extraction are structurally identical: same sheet name, same
// 34 columns, same row shape. Neither the filename nor the shape can tell them
// apart, and the filename is operator-supplied anyway. Only the Anno column in
// the file contents can. Loading the same year twice, or loading 2024 under the
// belief that it is 2025, silently corrupts every trend, every year-on-year
// figure and every cross-Azienda comparison downstream, with no error at any
// point. So the loader reads Anno from the data, requires it to be a single
// value, and refuses to write anything unless it equals the declared --year.
//
// ---------------------------------------------------------------------------
// AIC→ATC resolution
// ---------------------------------------------------------------------------
// Both sources are sheets of "Combined data.xlsx", which is ~100 MB and so is
// not committed here. It ships as "Combined data.zip" in the companion
// repository github.com/Lufemos/vis; unzip it and pass the path via
// --atc-workbook. (That repository is read-only for us as a data source. Nothing
// is deployed or merged from it — see AGENTS.md.)
//
// Source 1 (precedence): "Abruzzo_AIC_Data" sheet of the combined workbook.
//   Columns 10/12/14/16/18 carry ATC/GMP levels 1-4 plus last-available-level,
//   already classified. Authoritative for this perimeter because it is the
//   Region's own classification of its own dispensing, not a national lookup.
//   Levels are read as-is; nothing is derived.
// Source 2 (fallback): "AIFA_Products" sheet, column 11 CODICE_ATC, a full ATC7
//   string. Levels are derived by substring at 1/3/4/5/7 characters, and only
//   for as many levels as the code actually carries — a 4-character code yields
//   atc1..atc3 and leaves atc4/atc5 null rather than inventing them.
// No match in either source leaves atc1..atc5 null and mapping_confidence
// 'Unresolved'. An ATC is never guessed from a product name or description.
//
// mapping_confidence: 'Authoritative' (source 1), 'Validated' (source 2),
// 'Unresolved' (neither).
//
// ---------------------------------------------------------------------------
// AIC key normalisation
// ---------------------------------------------------------------------------
// AIC codes are 9-digit strings whose leading zeros are significant. Every one
// of the three files stores them differently depending on how it was produced,
// and a spreadsheet that has read one as a number has already dropped the
// leading zeros. Both sides of every join are normalised to 9-digit zero-padded
// text before matching. A code that cannot be normalised to exactly 9 digits is
// reported and left Unresolved rather than truncated or padded on guesswork.
//
// ---------------------------------------------------------------------------
// Cost bases (see docs/M6_DECISION.md and supabase_schema.sql section 10)
// ---------------------------------------------------------------------------
// acquistato_cost_eur <- column 26 "Costo aziendale stimato (h)"  (sell-in)
// erogato_cost_eur    <- column 21 "Costo SellOut (DD+CO)(c)"     (sell-out)
// total_cost_eur      <- the erogato value, with cost_basis 'erogato', so every
//   module that still reads total_cost_eur is reading the dispensed basis, which
//   is the only one comparable across Aziende.
//
// Note on the source's own column labels: columns 19 (a) and 21 (c) are labelled
// "Distribuzione Diretta + Consumi Ospedalieri", but both in fact include
// Distribuzione per Conto. Verified against the file: the DD/DPC/CO cost columns
// (14/16/18) sum to 451,587,418 = the sum of column 21 to the euro, and the
// DD/DPC/CO quantity columns (13/15/17) sum to column 19 likewise. The labels
// understate what the columns contain; the values are the three-channel totals.

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const flag = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const positional = args.filter((a) => !a.startsWith("--"));

const GOLD_PATH = positional[0] ?? "./DIR_OSP_TRA_003AS_SellInSellOut_nuova_estrazione_2025.xlsx";
const ATC_WORKBOOK_PATH = flag("atc-workbook") ?? "./Combined data.xlsx";
const DECLARED_YEAR = flag("year");
const SOURCE_VERSION = flag("source-version") ?? path.basename(GOLD_PATH, path.extname(GOLD_PATH));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!DECLARED_YEAR || !/^\d{4}$/.test(DECLARED_YEAR)) {
  fail(
    "--year=YYYY is required.\n" +
      "  It is the year you are declaring this extraction to be. The loader reads the\n" +
      "  Anno column out of the file and refuses to load if the two disagree, because a\n" +
      "  2024 and a 2025 extraction are structurally identical and only the data can\n" +
      "  tell them apart."
  );
}
const expectedYear = Number(DECLARED_YEAR);

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  fail("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --dry-run to validate without writing.");
}
for (const [label, filePath] of [["gold file", GOLD_PATH], ["ATC workbook", ATC_WORKBOOK_PATH]]) {
  if (!fs.existsSync(filePath)) fail(`No ${label} at "${filePath}".`);
}

// ---------------------------------------------------------------------------
// AIC normalisation
// ---------------------------------------------------------------------------

// Returns a 9-digit zero-padded AIC, or null if the value cannot be one. Never
// truncates: a value with more than 9 digits is a shape error in the source, not
// something to trim into range.
function normaliseAic(value) {
  if (value === null || value === undefined) return null;
  const raw = typeof value === "object" && value !== null && "result" in value ? value.result : value;
  let text = String(raw).trim();
  if (text === "") return null;
  // A cell read as a number arrives as "2039055", or "2039055.0" / "2.039055e6"
  // once a spreadsheet has been through it. Recover the integer part only when
  // the value really is a plain number.
  if (/^\d+(\.0+)?$/.test(text)) text = text.split(".")[0];
  else if (/^\d+(\.\d+)?e\+?\d+$/i.test(text)) text = BigInt(Math.round(Number(text))).toString();
  if (!/^\d+$/.test(text) || text.length > 9) return null;
  return text.padStart(9, "0");
}

const ATC_LEVEL_LENGTHS = [1, 3, 4, 5, 7];
// Accepts a full or partial ATC code and returns the five levels it actually
// supports, null for the rest. Rejects anything that is not shaped like an ATC
// code — better to leave a row Unresolved than to carry a fabricated class.
function atcLevelsFromCode(raw) {
  const code = String(raw ?? "").trim().toUpperCase();
  if (!/^[A-Z](\d{2}([A-Z]([A-Z](\d{2})?)?)?)?$/.test(code)) return null;
  return ATC_LEVEL_LENGTHS.map((length) => (code.length >= length ? code.slice(0, length) : null));
}

function cellText(value) {
  if (value === null || value === undefined) return null;
  const raw = typeof value === "object" && value !== null && "result" in value ? value.result : value;
  const text = String(raw).trim();
  return text === "" || text.toLowerCase() === "null" ? null : text;
}

function cellNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "object" && value !== null && "result" in value ? value.result : value;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const text = String(raw).trim();
  if (text === "") return null;
  const parsed = Number(text.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------
// Build the AIC→ATC map from the combined workbook (streamed: it is ~100 MB)
// ---------------------------------------------------------------------------

const ABRUZZO_SHEET = "Abruzzo_AIC_Data";
const AIFA_SHEET = "AIFA_Products";
// 1-based column positions in the combined workbook, asserted against the header
// row below before anything is read.
const ABRUZZO_AIC_COL = 5;
const ABRUZZO_LEVEL_COLS = [10, 12, 14, 16, 18];
const AIFA_AIC_COL = 1;
const AIFA_ATC_COL = 11;

function assertHeader(sheet, headerRow, expected) {
  const mismatched = expected.filter(
    ([column, label]) => !(cellText(headerRow.getCell(column).value) ?? "").toLowerCase().startsWith(label.toLowerCase())
  );
  if (mismatched.length > 0) {
    fail(
      `${sheet}: header does not match what this loader assumes.\n` +
        mismatched
          .map(([column, label]) => `  column ${column}: expected "${label}...", found "${cellText(headerRow.getCell(column).value) ?? "(empty)"}"`)
          .join("\n") +
        `\n  The columns this loader reads have moved or been renamed. Fix the column\n` +
        `  constants above rather than running as-is: loading against the wrong columns\n` +
        `  would attach real-looking ATC classes to the wrong products.`
    );
  }
}

async function buildAtcMap() {
  const abruzzo = new Map();
  const abruzzoConflicts = new Set();
  const aifa = new Map();
  let abruzzoRows = 0;
  let aifaRows = 0;
  const unnormalisable = new Map();

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(ATC_WORKBOOK_PATH, {
    entries: "emit",
    sharedStrings: "cache",
    worksheets: "emit",
  });

  for await (const worksheet of reader) {
    const isAbruzzo = worksheet.name === ABRUZZO_SHEET;
    const isAifa = worksheet.name === AIFA_SHEET;
    if (!isAbruzzo && !isAifa) continue;

    let seenHeader = false;
    for await (const row of worksheet) {
      if (!seenHeader) {
        seenHeader = true;
        if (isAbruzzo) {
          assertHeader(ABRUZZO_SHEET, row, [
            [ABRUZZO_AIC_COL, "COD AIC"],
            [ABRUZZO_LEVEL_COLS[0], "Codice ATC/GMP di 1"],
            [ABRUZZO_LEVEL_COLS[4], "Codice ATC/GMP ultimo livello"],
          ]);
        } else {
          assertHeader(AIFA_SHEET, row, [
            [AIFA_AIC_COL, "CODICE_AIC"],
            [AIFA_ATC_COL, "CODICE_ATC"],
          ]);
        }
        continue;
      }

      if (isAbruzzo) {
        abruzzoRows += 1;
        const aic = normaliseAic(row.getCell(ABRUZZO_AIC_COL).value);
        if (!aic) {
          unnormalisable.set(ABRUZZO_SHEET, (unnormalisable.get(ABRUZZO_SHEET) ?? 0) + 1);
          continue;
        }
        const levels = ABRUZZO_LEVEL_COLS.map((column) => cellText(row.getCell(column).value));
        if (levels[0] === null) continue;
        const existing = abruzzo.get(aic);
        if (existing === undefined) abruzzo.set(aic, levels);
        else if (existing.join("|") !== levels.join("|")) abruzzoConflicts.add(aic);
      } else {
        aifaRows += 1;
        const aic = normaliseAic(row.getCell(AIFA_AIC_COL).value);
        if (!aic) {
          unnormalisable.set(AIFA_SHEET, (unnormalisable.get(AIFA_SHEET) ?? 0) + 1);
          continue;
        }
        const levels = atcLevelsFromCode(cellText(row.getCell(AIFA_ATC_COL).value));
        if (levels && !aifa.has(aic)) aifa.set(aic, levels);
      }
    }
  }

  // An AIC classified two different ways inside the Region's own file is a
  // defect in the source, not a tie to break. Those AICs are dropped from the
  // authoritative map and left to the fallback (or to Unresolved) rather than
  // resolved by picking whichever row was read first.
  for (const aic of abruzzoConflicts) abruzzo.delete(aic);

  console.log(
    `ATC map: ${abruzzo.size} AICs from ${ABRUZZO_SHEET} (${abruzzoRows} rows), ` +
      `${aifa.size} from ${AIFA_SHEET} (${aifaRows} rows).`
  );
  if (abruzzoConflicts.size > 0) {
    console.warn(
      `  ${abruzzoConflicts.size} AIC(s) carry conflicting ATC levels in ${ABRUZZO_SHEET} and were ` +
        `excluded from the authoritative map: ${[...abruzzoConflicts].join(", ")}`
    );
  }
  for (const [sheet, count] of unnormalisable) {
    // Expected, not a defect: the Region's sheet carries some rows keyed by ATC
    // code or by a non-AIC internal code instead of a 9-digit AIC. They cannot
    // participate in an AIC join, so they are skipped rather than coerced —
    // stripping the letters out of "C08CA05" would produce a real-looking but
    // entirely wrong AIC.
    console.warn(`  ${sheet}: ${count} row(s) skipped, key is not a 9-digit AIC.`);
  }
  return { abruzzo, aifa };
}

// ---------------------------------------------------------------------------
// Read the gold file
// ---------------------------------------------------------------------------

// 1-based column positions in the gold file. Row 1 is a short label row, row 2
// is the real header, data starts at row 3.
const GOLD = {
  anno: 1,
  regionCode: 2,
  regionName: 3,
  aslCode: 4,
  aslName: 5,
  productName: 7,
  aic: 8,
  supplierCode: 11,
  quantity: 19,
  erogatoCost: 21,
  acquistatoCost: 26,
};
// The three dispensing channels, each with its own quantity and cost column.
// A gold-file row aggregates all three, so it is emitted as one canonical_fact
// row per channel that actually carries a value — that is what canonical_fact
// .channel is for, and it is the only way the dispensed side can be read per
// channel downstream.
const GOLD_CHANNELS = [
  { code: "DD", label: "Distribuzione diretta", quantity: 13, cost: 14 },
  { code: "DPC", label: "Distribuzione per conto", quantity: 15, cost: 16 },
  { code: "CO", label: "Consumi ospedalieri", quantity: 17, cost: 18 },
];
const GOLD_HEADER = [
  [GOLD.anno, "Anno"],
  [GOLD.aslCode, "Codice Azienda Sanitaria"],
  [GOLD.aic, "Codice AIC confezione"],
  [GOLD.quantity, "Quantità (Distribuzione Diretta"],
  [GOLD.erogatoCost, "Costo SellOut"],
  [GOLD.acquistatoCost, "Costo aziendale stimato"],
  ...GOLD_CHANNELS.map((channel) => [channel.cost, "Costo di Acquisto"]),
];

async function readGoldRows() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(GOLD_PATH);
  const worksheet = workbook.worksheets[0];
  assertHeader(`gold file "${path.basename(GOLD_PATH)}"`, worksheet.getRow(2), GOLD_HEADER);

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;
    if (cellText(row.getCell(GOLD.anno).value) === null) return;
    rows.push({
      year: cellNumber(row.getCell(GOLD.anno).value),
      regionCode: cellText(row.getCell(GOLD.regionCode).value),
      regionName: cellText(row.getCell(GOLD.regionName).value),
      aslCodeRaw: cellText(row.getCell(GOLD.aslCode).value),
      aslName: cellText(row.getCell(GOLD.aslName).value),
      productName: cellText(row.getCell(GOLD.productName).value),
      aicRaw: row.getCell(GOLD.aic).value,
      supplierCode: cellText(row.getCell(GOLD.supplierCode).value),
      quantity: cellNumber(row.getCell(GOLD.quantity).value),
      erogato: cellNumber(row.getCell(GOLD.erogatoCost).value),
      acquistato: cellNumber(row.getCell(GOLD.acquistatoCost).value),
      channels: GOLD_CHANNELS.map((channel) => ({
        code: channel.code,
        quantity: cellNumber(row.getCell(channel.quantity).value),
        cost: cellNumber(row.getCell(channel.cost).value),
      })),
    });
  });
  return rows;
}

// The Anno check. Runs before any write and exits non-zero on mismatch.
function assertDeclaredYear(rows) {
  const found = [...new Set(rows.map((row) => row.year).filter((year) => year !== null))].sort();
  if (found.length === 0) {
    fail(`Year validation failed: the Anno column is empty in every row of "${GOLD_PATH}". Nothing was loaded.`);
  }
  if (found.length > 1) {
    fail(
      `Year validation failed: "${GOLD_PATH}" contains more than one year: ${found.join(", ")}.\n` +
        `  You declared --year=${expectedYear}. This loader handles one extraction, one year at a\n` +
        `  time, so that a partial reload can never mix years. Nothing was loaded.`
    );
  }
  if (found[0] !== expectedYear) {
    fail(
      `Year validation FAILED. Nothing was loaded.\n` +
        `  Year found in the file (Anno column): ${found[0]}\n` +
        `  Year declared on the command line:    ${expectedYear}\n` +
        `  A ${found[0]} and a ${expectedYear} extraction are structurally identical, so this\n` +
        `  mismatch is exactly the case the check exists for: loading it would have written\n` +
        `  ${found[0]} data under the ${expectedYear} label and corrupted every trend and\n` +
        `  cross-Azienda comparison downstream. Re-run with --year=${found[0]} if the file is\n` +
        `  the one you meant, or supply the ${expectedYear} extraction.`
    );
  }
  console.log(`Year validation passed: Anno = ${found[0]} in all ${rows.length} rows, matching --year=${expectedYear}.`);
}

// ---------------------------------------------------------------------------
// Join and load
// ---------------------------------------------------------------------------

function resolveAtc(aic, map) {
  if (!aic) return { levels: [null, null, null, null, null], confidence: "Unresolved" };
  const authoritative = map.abruzzo.get(aic);
  if (authoritative) return { levels: authoritative, confidence: "Authoritative" };
  const validated = map.aifa.get(aic);
  if (validated) return { levels: validated, confidence: "Validated" };
  return { levels: [null, null, null, null, null], confidence: "Unresolved" };
}

async function main() {
  const map = await buildAtcMap();
  const rows = await readGoldRows();
  assertDeclaredYear(rows);

  // source_record_id must be stable across reloads of the same extraction, and
  // (anno, azienda, AIC, fornitore) is not quite unique — 15 of 13,116 rows in
  // the 2025 file repeat it. A content hash disambiguates those deterministically
  // without depending on the order rows happen to appear in the sheet.
  const seen = new Map();
  const records = [];
  const unmatched = new Map();
  const counts = { Authoritative: 0, Validated: 0, Unresolved: 0 };

  for (const row of rows) {
    const aic = normaliseAic(row.aicRaw);
    const { levels, confidence } = resolveAtc(aic, map);
    counts[confidence] += 1;

    if (confidence === "Unresolved") {
      const key = aic ?? `unnormalisable:${String(row.aicRaw ?? "").trim()}`;
      const entry = unmatched.get(key) ?? { description: row.productName, acquistato: 0, erogato: 0, rows: 0 };
      entry.acquistato += row.acquistato ?? 0;
      entry.erogato += row.erogato ?? 0;
      entry.rows += 1;
      unmatched.set(key, entry);
    }

    const naturalKey = [row.year, row.aslCodeRaw, aic ?? "?", row.supplierCode ?? "?"].join(":");
    const contentHash = crypto
      .createHash("sha1")
      .update([naturalKey, row.quantity, row.erogato, row.acquistato, row.productName].join("|"))
      .digest("hex")
      .slice(0, 8);
    const occurrence = (seen.get(`${naturalKey}:${contentHash}`) ?? 0) + 1;
    seen.set(`${naturalKey}:${contentHash}`, occurrence);
    const recordId = `${naturalKey}:${contentHash}:${occurrence}`;

    const common = {
      source_version_id: SOURCE_VERSION,
      year: row.year,
      month: null,
      region_code: row.regionCode,
      region_name: row.regionName,
      // Rows carrying a non-numeric Azienda code ("ND") are unattributed in the
      // source; they are loaded with a null asl_code rather than as a synthetic
      // Azienda that would then appear in cross-Azienda views.
      asl_code: /^\d+$/.test(row.aslCodeRaw ?? "") ? row.aslCodeRaw : null,
      aic,
      atc1: levels[0],
      atc2: levels[1],
      atc3: levels[2],
      atc4: levels[3],
      atc5: levels[4],
      product_description_raw: row.productName,
      mapping_confidence: confidence,
    };

    // One row per dispensing channel that carries a value. total_cost_eur
    // mirrors the dispensed figure so every existing reader stays on the
    // comparable basis; acquistato is null here because a purchase has no
    // channel, and splitting it across the three would be an invented
    // allocation.
    for (const channel of row.channels) {
      if ((channel.cost ?? 0) === 0 && (channel.quantity ?? 0) === 0) continue;
      records.push({
        ...common,
        source_record_id: `${recordId}:${channel.code}`,
        channel: channel.code,
        quantity_packs: channel.quantity,
        total_cost_eur: channel.cost,
        acquistato_cost_eur: null,
        erogato_cost_eur: channel.cost,
        cost_basis: "erogato",
      });
    }

    // One row carrying the purchase, with no channel. total_cost_eur is left
    // null: the dispensed rows above already account for every euro of spend,
    // and repeating the purchase there would double-count it. quantity_packs is
    // null for the same reason — the Traccia quantity is on a different basis
    // from the dispensed packs and must not be added into a pack total.
    if ((row.acquistato ?? 0) !== 0) {
      records.push({
        ...common,
        source_record_id: `${recordId}:ACQ`,
        channel: null,
        quantity_packs: null,
        total_cost_eur: null,
        acquistato_cost_eur: row.acquistato,
        erogato_cost_eur: null,
        cost_basis: "acquistato",
      });
    }
  }

  const matched = counts.Authoritative + counts.Validated;
  console.log(
    `\nAIC→ATC join over ${rows.length} gold-file rows:\n` +
      `  Authoritative (${ABRUZZO_SHEET}): ${counts.Authoritative}\n` +
      `  Validated (${AIFA_SHEET}):        ${counts.Validated}\n` +
      `  Unresolved:                       ${counts.Unresolved}\n` +
      `  coverage: ${((matched / rows.length) * 100).toFixed(2)}% (${matched}/${rows.length})\n` +
      `  emitted as ${records.length} canonical_fact rows (one per dispensing channel, plus one per purchase).`
  );

  if (unmatched.size > 0) {
    const total = [...unmatched.values()].reduce(
      (sum, entry) => ({ acquistato: sum.acquistato + entry.acquistato, erogato: sum.erogato + entry.erogato }),
      { acquistato: 0, erogato: 0 }
    );
    console.warn(
      `\nUnmatched AICs (${unmatched.size}), carrying ` +
        `${total.acquistato.toFixed(2)} EUR acquistato and ${total.erogato.toFixed(2)} EUR erogato. ` +
        `These are loaded with null atc1..atc5 and mapping_confidence 'Unresolved', so the gap stays\n` +
        `visible in the data rather than being closed by a guess:`
    );
    for (const [aic, entry] of [...unmatched.entries()].sort((a, b) => b[1].acquistato - a[1].acquistato)) {
      console.warn(
        `  ${aic}  ${(entry.description ?? "").slice(0, 44).padEnd(44)} ` +
          `acquistato ${entry.acquistato.toFixed(2).padStart(12)}  erogato ${entry.erogato.toFixed(2).padStart(12)}  (${entry.rows} row(s))`
      );
    }
  }

  const totals = records.reduce(
    (sum, record) => ({
      acquistato: sum.acquistato + (record.acquistato_cost_eur ?? 0),
      erogato: sum.erogato + (record.erogato_cost_eur ?? 0),
    }),
    { acquistato: 0, erogato: 0 }
  );
  console.log(
    `\nTotals: acquistato ${Math.round(totals.acquistato).toLocaleString("en-US")} EUR, ` +
      `erogato ${Math.round(totals.erogato).toLocaleString("en-US")} EUR, ` +
      `net ${Math.round(totals.acquistato - totals.erogato).toLocaleString("en-US")} EUR.`
  );

  if (DRY_RUN) {
    console.log("\n--dry-run: validated and joined, nothing written.");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const batchSize = 500;
  let upserted = 0;
  for (let start = 0; start < records.length; start += batchSize) {
    const batch = records.slice(start, start + batchSize);
    const { error } = await supabase
      .from("canonical_fact")
      .upsert(batch, { onConflict: "source_record_id,source_version_id" });
    if (error) fail(`Batch ${start}-${start + batch.length} failed: ${error.message}`);
    upserted += batch.length;
  }
  console.log(`\nDone: ${upserted}/${records.length} rows upserted into canonical_fact (source_version_id "${SOURCE_VERSION}").`);
}

await main();
