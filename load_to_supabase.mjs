// VIS PHARMA COMPASS — Supabase data loader
// Loads the already-verified local files into the schema created by supabase_schema.sql.
// Run AFTER: (1) running supabase_schema.sql in your project, (2) setting env vars below.
//
// Usage:
//   npm install @supabase/supabase-js csv-parse
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node load_to_supabase.mjs
//
// SUPABASE_SERVICE_ROLE_KEY (not the anon key) is required — this script writes data
// and must bypass Row Level Security. Never expose the service role key in client code
// or commit it to git; pass it as an environment variable only.

import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import fs from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Fails the whole run (not a silent skip) — a present-but-wrong-shaped file means our
// column assumptions are stale and every mapped field is suspect, not just the missing one.
function assertExpectedColumns(table, filePath, headerRow, expectedColumns) {
  if (!expectedColumns) return;
  const missing = expectedColumns.filter((c) => !headerRow.includes(c));
  if (missing.length > 0) {
    throw new Error(
      `${table}: "${filePath}" is missing expected column(s): ${missing.join(", ")}.\n` +
        `  Found columns: ${headerRow.join(", ")}.\n` +
        `  This source file's header doesn't match what the mapping function in ` +
        `load_to_supabase.mjs assumes. Update the mapping to match the real file — ` +
        `do not run this loader as-is, it would silently load nulls for these fields.`
    );
  }
}

async function loadCsvInBatches(table, filePath, mapRow, { batchSize = 500, expectedColumns } = {}) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping ${table}: no file at ${filePath}. Place it there first (see comment above this loader) and re-run.`);
    return;
  }

  console.log(`Loading ${filePath} -> ${table} ...`);
  const raw = fs.readFileSync(filePath, "utf-8");
  const delimiter = filePath.endsWith(".csv") && raw.split("\n")[0].includes(";") ? ";" : ",";

  const [headerRow] = parse(raw, { to_line: 1, delimiter });
  assertExpectedColumns(table, filePath, headerRow ?? [], expectedColumns);

  const records = parse(raw, { columns: true, skip_empty_lines: true, delimiter });

  let inserted = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize).map(mapRow).filter(Boolean);
    const { error } = await supabase.from(table).upsert(batch);
    if (error) {
      console.error(`  Batch ${i}-${i + batchSize} failed:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  console.log(`  Done: ${inserted}/${records.length} rows upserted into ${table}`);
}

// ---- AIC_Normalization_Resolved.csv (our own verified parser output) ----
await loadCsvInBatches(
  "aic_normalization_resolved",
  "./AIC_Normalization_Resolved.csv",
  (r) => ({
    aic: r.aic,
    description: r.description,
    spend_eur: parseFloat(r.spend_eur) || null,
    resolved: r.resolved === "True" || r.resolved === "true",
    confidence: r.confidence,
    method: r.method,
    unresolved_category: r.unresolved_category || null,
    units: r.units ? parseFloat(r.units) : null,
    content_per_unit_mg: r.content_per_unit_mg ? parseFloat(r.content_per_unit_mg) : null,
    total_content_mg: r.total_content_mg ? parseFloat(r.total_content_mg) : null,
    source_note: r.source_note || null,
  }),
  {
    expectedColumns: [
      "aic", "description", "spend_eur", "resolved", "confidence", "method",
      "unresolved_category", "units", "content_per_unit_mg", "total_content_mg", "source_note",
    ],
  }
);

// ---- AIFA shortage list (fetch fresh at load time — do not commit this file to git) ----
// Download from https://www.aifa.gov.it (elenco dei medicinali carenti) and place at
// ./elenco_medicinali_carenti.csv before running.
await loadCsvInBatches(
  "aifa_shortage_list",
  "./elenco_medicinali_carenti.csv",
  (r) => ({
    nome_medicinale: r["Nome medicinale"],
    aic: r["Codice AIC"],
    principio_attivo: r["Principio attivo"],
    forma_dosaggio: r["Forma farmaceutica e dosaggio"],
    titolare_aic: r["Titolare AIC"],
    data_inizio: r["Data inizio"] || null,
    fine_presunta: r["Fine presunta"] || null,
    equivalente: r["Equivalente"],
    motivazioni: r["Motivazioni"],
    suggerimenti: r["Suggerimenti/Indicazioni AIFA"],
    nota_aifa: r["Nota AIFA"],
    classe_rimborso: r["Classe di rimborsabilità"],
    codice_atc: r["Codice ATC"],
  }),
  {
    expectedColumns: [
      "Nome medicinale", "Codice AIC", "Principio attivo", "Forma farmaceutica e dosaggio",
      "Titolare AIC", "Data inizio", "Fine presunta", "Equivalente", "Motivazioni",
      "Suggerimenti/Indicazioni AIFA", "Nota AIFA", "Classe di rimborsabilità", "Codice ATC",
    ],
  }
);

// ---- S05 — AIFA product master (drive.aifa.gov.it) ----
// Not yet exported into this repo. Export from the source and place at
// ./aifa_product_master.csv before running. Column names below are a best guess at
// what the export uses (matching the schema's own column names) — if the real file's
// header differs, this loader throws naming exactly which columns don't match, rather
// than silently loading nulls. Fix the mapping below, don't just rename the CSV header.
await loadCsvInBatches(
  "aifa_product_master",
  "./aifa_product_master.csv",
  (r) => ({
    aic: r.aic,
    cod_farmaco: r.cod_farmaco || null,
    cod_confezione: r.cod_confezione || null,
    denominazione: r.denominazione || null,
    descrizione: r.descrizione || null,
    codice_ditta: r.codice_ditta || null,
    ragione_sociale: r.ragione_sociale || null,
    stato_amministrativo: r.stato_amministrativo || null,
    tipo_procedura: r.tipo_procedura || null,
    forma: r.forma || null,
    codice_atc: r.codice_atc || null,
    pa_associati: r.pa_associati || null,
    fornitura: r.fornitura || null,
  }),
  {
    expectedColumns: [
      "aic", "cod_farmaco", "cod_confezione", "denominazione", "descrizione",
      "codice_ditta", "ragione_sociale", "stato_amministrativo", "tipo_procedura",
      "forma", "codice_atc", "pa_associati", "fornitura",
    ],
  }
);

// ---- S06 — AIFA ingredient master (drive.aifa.gov.it) ----
// Not yet exported into this repo. Export from the source and place at
// ./aifa_ingredient_master.csv before running. Same caveat as product master above:
// column names are a best guess, verify against the real header once the file exists.
await loadCsvInBatches(
  "aifa_ingredient_master",
  "./aifa_ingredient_master.csv",
  (r) => ({
    aic: r.aic,
    principio_attivo: r.principio_attivo || null,
    quantita: r.quantita ? parseFloat(r.quantita) : null,
    unita_misura: r.unita_misura || null,
  }),
  {
    expectedColumns: ["aic", "principio_attivo", "quantita", "unita_misura"],
  }
);

console.log("Load complete.");
