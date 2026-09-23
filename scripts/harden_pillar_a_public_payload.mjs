// Rebuild the published Pillar A payload so it carries only what the public page
// renders. Removes: the J04A/tuberculosis family Guido asked to drop, the source
// hash manifest, internal filesystem paths, internal check results, and monthly
// rows for years the page never plots.
//
// Deterministic: same input -> same output. Run from the target worktree.
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root) throw new Error("usage: node harden_public_payload.cjs <worktree-root>");

const jsonPath = path.join(root, "public/data/pillar-a.json");
const csvPath = path.join(root, "public/data/pillar-a-annual.csv");

const before = fs.statSync(jsonPath).size;
const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

const DROP_GROUP = "tuberculosis";
const MONTHLY_YEARS = new Set([2023, 2024, 2025]); // the only years the monthly charts plot

const report = {};
const count = (k, v) => { report[k] = v; };

count("annual_before", data.annual.length);
count("monthly_before", data.monthly.length);
count("candidates_before", data.candidates.length);

// 1. Drop the tuberculosis family everywhere it is published.
data.annual = data.annual.filter((r) => r.group !== DROP_GROUP);
data.monthly = data.monthly.filter((r) => r.group !== DROP_GROUP);
data.candidates = data.candidates.filter((r) => r.group !== DROP_GROUP);
if (data.scope && Array.isArray(data.scope.groups)) {
  data.scope.groups = data.scope.groups.filter((g) => g.id !== DROP_GROUP);
}

// 2. Publish monthly detail only for the years actually charted.
data.monthly = data.monthly.filter((r) => MONTHLY_YEARS.has(r.year));

// 3. Strip internal provenance from activity rows (Windows paths, sha256, cell refs).
data.activity = data.activity.map(({ source_file, source_sha256, source_cells, ...keep }) => keep);

// 4. Drop the source hash manifest and internal check results entirely.
delete data.sources;
delete data.checks;

// 5. Scope metadata describes internal delegation state; keep only the perimeter.
if (data.scope) {
  data.scope = {
    groups: data.scope.groups,
    awarePolicy: data.scope.awarePolicy,
    historicalPolicy: data.scope.historicalPolicy,
  };
}

count("annual_after", data.annual.length);
count("monthly_after", data.monthly.length);
count("candidates_after", data.candidates.length);

fs.writeFileSync(jsonPath, JSON.stringify(data));
count("json_bytes_before", before);
count("json_bytes_after", fs.statSync(jsonPath).size);

// 6. The annual CSV moves behind authentication, but still must not carry the
//    dropped family. Preserve the original BOM and CRLF line endings.
const raw = fs.readFileSync(csvPath, "utf8");
const bom = raw.startsWith("﻿") ? "﻿" : "";
const body = bom ? raw.slice(1) : raw;
const eol = body.includes("\r\n") ? "\r\n" : "\n";
const lines = body.split(/\r?\n/);
const header = lines[0];
const groupIdx = header.split(",").indexOf("group");
if (groupIdx === -1) throw new Error("group column not found in CSV header");
const kept = lines.slice(1).filter((l) => l && l.split(",")[groupIdx] !== DROP_GROUP);
count("csv_rows_before", lines.slice(1).filter(Boolean).length);
count("csv_rows_after", kept.length);
fs.writeFileSync(csvPath, bom + [header, ...kept].join(eol) + eol);

for (const [k, v] of Object.entries(report)) console.log(`  ${k}: ${typeof v === "number" ? v.toLocaleString("en-US") : v}`);
