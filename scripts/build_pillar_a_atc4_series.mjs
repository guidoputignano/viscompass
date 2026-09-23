// Build the public ATC4 x year x territory x channel series from the same AIFA
// sources and the same aggregation contract as scripts/build_pillar_a_public_series.py:
//   - family membership is decided by the atc4 column against the scope prefixes
//   - direct  = spesa_flusso_tracciabilita / numero_confezioni_traccia
//   - conv.   = spesa_convenzionata        / numero_confezioni_convenzionata
//   - blank cells are counted as missing, never as zero
//   - every regional row also accumulates into the national code '000'
// Money is summed in integer cents so the totals reconcile exactly with the
// published family series, which Python produced with Decimal.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const [, , SOURCE_ROOT, TARGET_ROOT] = process.argv;
if (!SOURCE_ROOT || !TARGET_ROOT) throw new Error("usage: node build_atc4_series.cjs <source-root> <target-root>");

const scope = JSON.parse(fs.readFileSync(path.join(TARGET_ROOT, "lib/analytics/pillar-a-scope.json"), "utf8"));
const PREFIXES = scope.groups.map((g) => g.prefix);
const manifest = JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT, "data/raw/aifa/aifa_series_manifest.json"), "utf8"));

const CHANNELS = [
  ["direct", "spesa_flusso_tracciabilita", "numero_confezioni_traccia"],
  ["convenzionata", "spesa_convenzionata", "numero_confezioni_convenzionata"],
];

// AIFA money cells carry up to ten decimal places across the ten editions (e.g.
// "7.6300012247" in 2017) and the published totals keep that precision, so sum as
// scaled BigInt rather than float.
const SCALE = 14;
function toScaled(value) {
  const m = /^(-?)(\d+)(?:\.(\d{1,14}))?$/.exec(value);
  if (!m) throw new Error(`unexpected money format: ${value}`);
  const [, sign, whole, frac = ""] = m;
  return (sign === "-" ? -1n : 1n) * BigInt(whole + frac.padEnd(SCALE, "0"));
}
const fromScaled = (v) => Number(v) / 10 ** SCALE;

const sums = new Map(); // key -> {cents, packs}
const labels = new Map();
const regionNames = { "000": "Italia" };

for (const profile of manifest.profiles) {
  const file = path.join(SOURCE_ROOT, profile.file.replace(/\\/g, "/"));
  const raw = fs.readFileSync(file);
  const digest = crypto.createHash("sha256").update(raw).digest("hex");
  if (digest !== profile.sha256) throw new Error(`hash mismatch for ${file}`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(raw).replace(/^﻿/, "");
  } catch {
    text = new TextDecoder("windows-1252").decode(raw);
  }
  const lines = text.split(/\r?\n/);
  const head = lines[0].split("|");
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const f = line.split("|");
    const atc4 = (f[ix.atc4] || "").trim();
    if (!PREFIXES.some((p) => atc4.startsWith(p))) continue;
    const year = Number(f[ix.anno]);
    const region = String(f[ix.codreg]).padStart(3, "0");
    if (year !== Number(profile.year) || region === "000") throw new Error(`unexpected row: ${line.slice(0, 80)}`);
    regionNames[region] = f[ix.regione];
    if (!labels.has(atc4)) labels.set(atc4, (f[ix.descrizione_atc4] || "").trim());
    for (const [channel, costCol, packCol] of CHANNELS) {
      const cost = (f[ix[costCol]] || "").trim();
      const packs = (f[ix[packCol]] || "").trim();
      if (!cost && !packs) continue;
      for (const code of [region, "000"]) {
        const key = `${year}|${code}|${channel}|${atc4}`;
        let v = sums.get(key);
        if (!v) sums.set(key, (v = { cents: 0n, packs: 0 }));
        if (cost) v.cents += toScaled(cost);
        if (packs) v.packs += Number(packs);
      }
    }
  }
  process.stdout.write(`  ${profile.year} ok\n`);
}

const years = [...new Set([...sums.keys()].map((k) => Number(k.split("|")[0])))].sort();
const regions = [...new Set([...sums.keys()].map((k) => k.split("|")[1]))].sort();
const codes = [...labels.keys()].sort();
const channels = ["direct", "convenzionata"];
const yi = new Map(years.map((v, i) => [v, i]));
const ri = new Map(regions.map((v, i) => [v, i]));
const ci = new Map(codes.map((v, i) => [v, i]));
const hi = new Map(channels.map((v, i) => [v, i]));

const rows = [];
for (const [key, v] of sums) {
  const [year, region, channel, atc4] = key.split("|");
  rows.push([yi.get(Number(year)), ri.get(region), hi.get(channel), ci.get(atc4), fromScaled(v.cents), v.packs]);
}
rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);

const out = {
  basis: "AIFA, stessi file e stesso perimetro della serie annuale pubblicata",
  note: "Categorie ATC4. Le classi AWaRe non sono derivabili da questo livello: una categoria ATC4 puo contenere codici ATC5 di classi diverse.",
  years,
  regions,
  regionNames,
  channels,
  codes,
  labels: Object.fromEntries(codes.map((c) => [c, labels.get(c)])),
  // [yearIdx, regionIdx, channelIdx, codeIdx, spendEur, packs]
  rows,
};

const target = path.join(TARGET_ROOT, "data/public-compiled/pillar-a-atc4.json");
fs.writeFileSync(target, JSON.stringify(out));

// ---- reconciliation against the already published family series ----
const published = JSON.parse(fs.readFileSync(path.join(TARGET_ROOT, "data/public-compiled/pillar-a.json"), "utf8"));
const groupOf = (code) => scope.groups.find((g) => code.startsWith(g.prefix)).id;
// Re-sum from the scaled integers so the check itself introduces no rounding.
const rebuilt = new Map();
for (const [key, v] of sums) {
  const [year, region, channel, atc4] = key.split("|");
  const k = `${year}|${region}|${groupOf(atc4)}|${channel}`;
  rebuilt.set(k, (rebuilt.get(k) ?? 0n) + v.cents);
}
let checked = 0;
const bad = [];
for (const a of published.annual) {
  if (a.spend == null) continue;
  const got = fromScaled(rebuilt.get(`${a.year}|${a.region}|${a.group}|${a.channel}`) ?? 0n);
  checked++;
  if (Math.abs(got - a.spend) > 0.01) bad.push(`${a.year} ${a.region} ${a.group} ${a.channel}: atc4=${got} vs published=${a.spend}`);
}

console.log(`\n  rows: ${rows.length.toLocaleString("en-US")}  codes: ${codes.length}  years: ${years.length}  territories: ${regions.length}`);
console.log(`  bytes: ${fs.statSync(target).size.toLocaleString("en-US")}`);
console.log(`  reconciled against ${checked} published annual spend values`);
if (bad.length) {
  console.log(`  MISMATCHES (${bad.length}):`);
  bad.slice(0, 8).forEach((b) => console.log("    " + b));
  process.exit(1);
}
console.log("  ALL RECONCILE");
