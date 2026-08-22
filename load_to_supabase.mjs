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

async function loadCsvInBatches(table, filePath, mapRow, batchSize = 500) {
  console.log(`Loading ${filePath} -> ${table} ...`);
  const raw = fs.readFileSync(filePath, "utf-8");
  const records = parse(raw, { columns: true, skip_empty_lines: true, delimiter: filePath.endsWith(".csv") && raw.split("\n")[0].includes(";") ? ";" : "," });

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
  })
);

// ---- AIFA shortage list (fetch fresh at load time — do not commit this file to git) ----
// Uncomment once you've downloaded a fresh copy locally:
//
// await loadCsvInBatches(
//   "aifa_shortage_list",
//   "./elenco_medicinali_carenti.csv",
//   (r) => ({
//     nome_medicinale: r["Nome medicinale"],
//     aic: r["Codice AIC"],
//     principio_attivo: r["Principio attivo"],
//     forma_dosaggio: r["Forma farmaceutica e dosaggio"],
//     titolare_aic: r["Titolare AIC"],
//     data_inizio: r["Data inizio"] || null,
//     fine_presunta: r["Fine presunta"] || null,
//     equivalente: r["Equivalente"],
//     motivazioni: r["Motivazioni"],
//     suggerimenti: r["Suggerimenti/Indicazioni AIFA"],
//     nota_aifa: r["Nota AIFA"],
//     classe_rimborso: r["Classe di rimborsabilit\u00e0"],
//     codice_atc: r["Codice ATC"],
//   })
// );

console.log("Load complete.");
