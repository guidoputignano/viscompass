// Pillar B production loader — release PILLAR-B-R2-20261001.
//
// This module is the loader that ships. It takes an injected connection so the
// Gate 2 harness can exercise THIS code against a throwaway Postgres rather than
// a reproduction of it; a harness that retypes the logic tests the reproduction,
// not the loader.
//
// Design rules this file is built around:
//
//   * Every frozen input is verified by SHA-256 against the release manifest
//     before a single row is read. A loader that will happily read a changed
//     file is not loading a frozen release.
//   * All 261,153 rows are loaded. Nothing is filtered out: the 1,064 non-AIC
//     rows and the 828 negative-cost rows carry real spend, and dropping them
//     would make the table disagree with the source ledger. They are excluded
//     from comparability by a COLUMN, not by absence.
//   * `comparable_eligible` is derived only from the FROZEN strata, and the
//     load aborts unless the eligible spend reproduces the frozen bridge's
//     A_ELIGIBLE to the cent.
//   * The whole load is one transaction with post-conditions. If any assertion
//     fails the transaction rolls back and the database is untouched.
//   * There is no code path here that can write a synthetic row.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import path from "node:path";

export const RELEASE_ID = "PILLAR-B-R2-20261001";
export const REGION_CODE = "130";
export const REGION_NAME = "ABRUZZO";

// Cost semantics for this source. `C` is a weighted average cost inclusive of
// VAT and gross of payback and AIFA registry credit notes. It is not a net
// price, and it is not an AIFA reference price.
export const COST_GROSS_STATUS = "gross_incl_vat_pre_payback";
// The source is the regional DD+DPC+CO dispensing flow, i.e. erogato.
export const COST_BASIS = "erogato";

const BATCH = 1000;

const COLUMNS = [
  "source_record_id", "source_version_id", "year", "month",
  "region_code", "region_name", "asl_code", "channel", "aic", "active_substance",
  "source_quantity", "source_quantity_basis", "quantity_packs",
  "total_cost_eur", "erogato_cost_eur", "cost_basis",
  "source_disposition", "source_key_class",
  "perimeter_status", "perimeter_evidence_grade", "classification_valid_from",
  "comparable_stratum_id", "exclusion_reason", "comparable_eligible", "product_route",
  "comparable_quantity", "comparable_unit", "quantity_basis_status",
  "cost_gross_status", "mapping_confidence",
];

async function sha256File(file) {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}

// Manifest key for each file this loader actually opens. Hashing a path derived
// from the manifest is not protection: it verifies a file the loader may never
// read. Every one of these is hashed AT THE PATH THE LOADER WILL READ.
const READ_PATHS = {
  factsJsonl: "derived/canonical_monthly_facts.jsonl",
  aslMapJson: "derived/blk04_line1_qc_basis.json",
  strataJson: "freeze-20260930-r3/derived/b04_strata_v3.json",
  taxonomyJson: "freeze-20260930-r3/derived/b03_reconciled_taxonomy.json",
  comparableQuantityJson: "derived/b04_comparable_quantity.json",
};

/**
 * Abort before reading anything if a frozen input is not the frozen input.
 *
 * Two distinct checks, because they catch different failures:
 *   1. every input the manifest freezes still hashes correctly at `root`
 *      — catches a changed release;
 *   2. every file THIS CALL will actually open hashes to its manifest entry
 *      — catches a substituted or modified file passed in by path, which check 1
 *        cannot see at all.
 */
export async function verifyFrozenInputs(manifestPath, root, readPaths = {}) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.release_id !== RELEASE_ID) {
    throw new Error(`manifest is ${manifest.release_id}, loader is ${RELEASE_ID}`);
  }
  const frozen = manifest.frozen_inputs ?? {};
  if (Object.keys(frozen).length === 0) throw new Error("manifest lists no frozen inputs");

  const checked = [];
  for (const [rel, meta] of Object.entries(frozen)) {
    const actual = await sha256File(path.join(root, rel));
    if (actual !== meta.sha256) {
      throw new Error(`frozen input changed: ${rel}\n  manifest ${meta.sha256}\n  actual   ${actual}`);
    }
    checked.push(rel);
  }

  for (const [key, manifestKey] of Object.entries(READ_PATHS)) {
    const actualPath = readPaths[key];
    if (!actualPath) throw new Error(`loader was given no path for ${key}`);
    const meta = frozen[manifestKey];
    if (!meta) {
      throw new Error(`${manifestKey} is read by the loader but is not frozen in the manifest`);
    }
    const actual = await sha256File(actualPath);
    if (actual !== meta.sha256) {
      throw new Error(
        `frozen input changed: ${manifestKey}\n` +
        `  read from ${actualPath}\n` +
        `  manifest sha256 ${meta.sha256}\n` +
        `  actual   sha256 ${actual}`);
    }
  }
  return checked;
}

/**
 * Annual group key -> stratum key, from the FROZEN strata.
 * A group appearing in two strata would make eligibility ambiguous, so that is
 * rejected rather than resolved by last-write-wins.
 */
/**
 * AIC -> unambiguous route, from the frozen strata.
 *
 * Only products whose strata agree on ONE route get a route. The alternative
 * source (b04_parse_v1) covers more AICs but is multi-valued for some, and a
 * multi-valued route cannot key a comparison group.
 */
export function buildRouteIndex(strataJson) {
  const seen = new Map();
  for (const st of strataJson.strata) {
    for (const aic of Object.keys(st.aic_quantity ?? {})) {
      if (!seen.has(aic)) seen.set(aic, new Set());
      seen.get(aic).add(st.route ?? null);
    }
  }
  const index = new Map();
  for (const [aic, routes] of seen) {
    const clean = [...routes].filter((r) => r !== null && r !== "");
    if (clean.length === 1) index.set(aic, clean[0]);   // unambiguous only
  }
  return index;
}

export function buildStratumIndex(strataJson) {
  const index = new Map();
  for (const st of strataJson.strata) {
    for (const gk of st.group_keys ?? []) {
      const prior = index.get(gk);
      if (prior !== undefined && prior !== st.key) {
        throw new Error(`group ${gk} appears in two strata: ${prior} / ${st.key}`);
      }
      index.set(gk, st.key);
    }
  }
  return index;
}

/**
 * Content per package for every (ASL, AIC, channel, year) group, from the
 * INDEPENDENTLY PARSED presentation.
 *
 * An earlier version derived this as `strata aic_quantity / observed packs` and
 * "verified" it by multiplying the quotient back by the same observed total —
 * x/y*y == x, which cannot fail. Checked against the parser's own presentation
 * factor (contentPerUnit * packSize) it disagreed for 764 of 2,736 pairs, often
 * by a clean factor of 10. The circular check reported 100% success on that data.
 *
 * `b04_comparable_quantity.json` carries, per group, packSize, convention,
 * packages, units, contentPerUnit, contentUnit and the resulting content. Three
 * identities hold against it with zero failures:
 *   content == units * contentPerUnit          (32,838 groups)
 *   units   == packages * packSize             (38,881 groups)
 *   group q == packs summed from the import    (39,393 groups)
 * and inside strata the coverage is complete: 9,440 of 9,440 groups carry
 * content, and contentUnit always equals the stratum's unit.
 *
 * Content per pack is constant within a group (one AIC, one packSize), so
 * apportioning a group's content across its months by packs is exact rather than
 * an assumption — and identity 3 is what makes the divisor trustworthy.
 */
/** AIC -> {status, grade, validFrom, substance} from the FROZEN taxonomy. */
export function buildPerimeterIndex(taxonomyJson) {
  const index = new Map();
  for (const r of taxonomyJson.records) {
    index.set(r.aic, {
      status: r.status ?? "unresolved",
      grade: r.evidence_grade ?? null,
      validFrom: r.valid_from ?? null,
      // The substance is what makes a biosimilar comparable with its reference
      // medicine: they are different AICs, so a comparison grouped by AIC puts
      // each product alone in its own group and every uptake share collapses to
      // 0% or 100%.
      substance: r.substance ?? null,
    });
  }
  return index;
}

export function buildQuantityIndex(comparableQuantityJson, stratumIndex, strataJson) {
  // Σ parsed content per (stratum, AIC), to be checked against the strata's own
  // aic_quantity. A RELATIVE tolerance: an absolute one classified 59 pairs of
  // accumulated float error as genuine divergence, including the largest
  // "conflict" in the set (8,126,680 vs 8,126,679.9936).
  const REL = 1e-9;
  const summed = new Map();
  for (const g of comparableQuantityJson) {
    const sk = stratumIndex.get(`${g.year}|${g.asl}|${g.aic}|${g.channel}`);
    if (sk === undefined || g.content === null || g.content === undefined) continue;
    const key = `${sk}||${g.aic}`;
    summed.set(key, (summed.get(key) ?? 0) + Number(g.content));
  }
  // Products whose own groups carry more than one inferred convention: the basis
  // is mixed for ALL of them, whether or not the totals happen to reconcile.
  const conventionsByAic = new Map();
  for (const g of comparableQuantityJson) {
    if (!conventionsByAic.has(g.aic)) conventionsByAic.set(g.aic, new Set());
    conventionsByAic.get(g.aic).add(g.convention ?? null);
  }
  const conflicted = new Set();
  for (const st of strataJson.strata) {
    for (const [aic, declared] of Object.entries(st.aic_quantity ?? {})) {
      const key = `${st.key}||${aic}`;
      const got = summed.get(key);
      if (got === undefined) continue;
      const want = Number(declared);
      if (Math.abs(got - want) / Math.max(Math.abs(want), 1) > REL) conflicted.add(key);
    }
  }

  const index = new Map();
  for (const g of comparableQuantityJson) {
    const groupKey = `${g.year}|${g.asl}|${g.aic}|${g.channel}`;
    const sk = stratumIndex.get(groupKey);
    const conflict = sk !== undefined && conflicted.has(`${sk}||${g.aic}`);
    const content = g.content;
    const q = Number(g.q ?? 0);
    if (content === null || content === undefined || q === 0) {
      index.set(groupKey, { perPack: null, unit: null, basis: "absent", convention: null, packages: null });
      continue;
    }
    if (conflict) {
      // The two parses disagree on what the source quantity means. Withheld.
      index.set(groupKey, { perPack: null, unit: null, basis: "parses_conflict",
                            convention: "mixed", packages: null });
      continue;
    }
    index.set(groupKey, {
      perPack: Number(content) / q,
      unit: g.contentUnit ?? null,
      basis: "parses_agree",
      // The parse's inferred convention, and the package count IT derived.
      // Carried separately so the raw source quantity is never relabelled.
      convention: g.convention ?? null,
      packages: g.packages === null || g.packages === undefined ? null : Number(g.packages),
    });
  }
  index.conflictedPairs = conflicted.size;
  index.conventionsByAic = conventionsByAic;
  return index;
}

function rowToTuple(r, { aslMap, stratumIndex, perimeterIndex, quantityIndex, routeIndex }) {
  const aslCode = aslMap[r.asl];
  if (!aslCode) throw new Error(`unmapped ASL '${r.asl}' at source row ${r.src_row}`);

  const analytical = r.disposition === "analytical";
  const groupKey = `${r.anno}|${r.asl}|${r.prodotto_key}|${r.canale}`;
  const stratum = analytical ? (stratumIndex.get(groupKey) ?? null) : null;

  // A non-AIC row is exactly bridge A's A0 class. For an analytical row that no
  // stratum admits, the specific A-class is NOT carried per row by the freeze,
  // so it is left null rather than guessed. `comparable_eligible` is false
  // either way, and the check constraint enforces that.
  const exclusion = analytical ? null : "A0_non_analytical_key";

  const perimeter = analytical
    ? (perimeterIndex.get(r.prodotto_key) ?? { status: "unresolved", grade: null, validFrom: null, substance: null })
    : { status: null, grade: null, validFrom: null, substance: null };

  const norm = quantityIndex.get(groupKey);
  const multiConvention = (norm?.convention === "mixed")
    || (quantityIndex.conventionsByAic?.get(r.prodotto_key)?.size ?? 0) > 1;
  const sourceBasis = norm === undefined ? "unknown"
    : multiConvention ? "mixed"
    : (norm.convention === "packages" || norm.convention === "units") ? norm.convention
    : "unknown";
  const cost = r.c === null || r.c === undefined ? null : Number(r.c);
  const qty = r.q === null || r.q === undefined ? null : Number(r.q);
  const month = r.mese === null || r.mese === undefined || r.mese === "" ? null : Number(r.mese);

  return [
    `${RELEASE_ID}:${r.src_row}`,          // source_record_id — stable, so the load is idempotent
    RELEASE_ID,
    Number(r.anno),
    month,
    REGION_CODE,
    REGION_NAME,
    aslCode,
    r.canale ?? null,
    analytical ? r.prodotto_key : null,    // only a real 9-digit AIC goes in the aic column
    perimeter.substance,                   // groups a biosimilar with its reference medicine
    qty,                                   // source_quantity -- basis NOT asserted
    sourceBasis,                           // source_quantity_basis
    // quantity_packs is left NULL for every Pillar B row, deliberately.
    //
    // Even where the two parses agree, the package/unit convention is INFERRED
    // from price consensus and has not been confirmed by the Region. Populating
    // this column would let any caller compute an aggregate "confezioni" figure
    // on an unvalidated basis, and nothing downstream could tell that it was
    // unvalidated. Null removes the whole class of error: there is no package
    // total to publish until open question 5 is answered. The raw value is in
    // source_quantity with its basis stated.
    null,
    cost,
    cost,                                   // erogato basis: same figure, named for what it is
    COST_BASIS,
    r.disposition ?? null,
    r.key_class ?? null,
    perimeter.status,
    perimeter.grade,
    perimeter.validFrom,
    stratum,
    exclusion,
    // Comparability is stratum membership, which reconciles exactly to the
    // frozen bridge. Whether a normalized quantity exists is a DIFFERENT axis:
    // letting it redefine comparability silently moved EUR 659,535.47 out of
    // the eligible total and broke the reconciliation, which is how it was
    // caught. Rows in a stratum with no parsed presentation keep their
    // eligibility and are withheld from uptake with a named reason.
    stratum !== null,                       // comparable_eligible
    analytical ? (routeIndex.get(r.prodotto_key) ?? null) : null,   // product_route
    norm === undefined || norm.perPack === null || qty === null ? null : qty * norm.perPack,
    norm === undefined ? null : norm.unit,
    norm === undefined ? null : norm.basis,
    COST_GROSS_STATUS,
    // mapping_confidence is the ATC-mapping confidence and nothing else. THIS
    // LOADER PERFORMS NO ATC LOOKUP -- atc1..atc5 are not in COLUMNS, so every
    // row is inserted with NULL ATC. Stamping 'Validated' claimed a mapping that
    // was never attempted, and queries.ts isUnresolved() tests exactly this
    // column, so the "Record irrisolti" KPI would have read 1,064 instead of
    // 261,153. 'Unresolved' is this vocabulary's own word for "no match in
    // either source", which is the true state here.
    "Unresolved",
  ];
}

/**
 * Load the frozen release.
 *
 * @param db        { query(sql, params), exec(sql) }
 * @param paths     { factsJsonl, strataJson, taxonomyJson, manifestJson, root }
 * @param expected  { rows, totalCostEur, eligibleCostEur }
 * @param opts      { dryRun } — dryRun rolls back instead of committing
 */
export async function loadPillarBFacts(db, paths, expected, opts = {}) {
  const log = [];
  const say = (m) => { log.push(m); if (opts.verbose !== false) console.log(`  ${m}`); };

  const verified = await verifyFrozenInputs(paths.manifestJson, paths.root, paths);
  say(`frozen inputs verified by sha256: ${verified.length} (including the files this load reads)`);

  const strata = JSON.parse(await readFile(paths.strataJson, "utf8"));
  const taxonomy = JSON.parse(await readFile(paths.taxonomyJson, "utf8"));
  const qc = JSON.parse(await readFile(paths.aslMapJson, "utf8"));
  const aslMap = qc.asl_mapping_proved_by_exact_DPC_cost;
  if (!aslMap) throw new Error("asl mapping absent from its evidence file");

  const stratumIndex = buildStratumIndex(strata);
  const routeIndex = buildRouteIndex(strata);
  const perimeterIndex = buildPerimeterIndex(taxonomy);

  const comparableQuantity = JSON.parse(await readFile(paths.comparableQuantityJson, "utf8"));
  const quantityIndex = buildQuantityIndex(comparableQuantity, stratumIndex, strata);
  say(`quantity basis unresolved for ${quantityIndex.conflictedPairs} (stratum,AIC) pairs -- withheld`);
  say(`route index ${routeIndex.size} AICs with an unambiguous route`);
  say(`stratum index ${stratumIndex.size} groups, perimeter index ${perimeterIndex.size} AICs, `
      + `quantity index ${quantityIndex.size} (stratum,AIC) pairs`);

  await db.exec("begin");
  let inserted = 0;
  try {
    // Idempotency: a re-run of the same release replaces its own rows and can
    // never touch another release's. Cheaper and far clearer than per-row upsert.
    const prior = await db.query(
      "delete from canonical_fact where source_version_id = $1", [RELEASE_ID],
    );
    if (prior.affectedRows) say(`removed ${prior.affectedRows} rows from a previous load of this release`);

    const placeholders = (n, width) =>
      Array.from({ length: n }, (_, i) =>
        `(${Array.from({ length: width }, (_, j) => `$${i * width + j + 1}`).join(",")})`).join(",");
    const insertSql = (n) =>
      `insert into canonical_fact (${COLUMNS.join(",")}) values ${placeholders(n, COLUMNS.length)}`;

    let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      await db.query(insertSql(batch.length), batch.flat());
      inserted += batch.length;
      batch = [];
    };

    const rl = createInterface({
      input: createReadStream(paths.factsJsonl, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line.trim()) continue;
      batch.push(rowToTuple(JSON.parse(line), { aslMap, stratumIndex, perimeterIndex, quantityIndex, routeIndex }));
      if (batch.length >= BATCH) await flush();
    }
    await flush();
    say(`inserted ${inserted.toLocaleString()} rows`);

    // ---- post-conditions. Any failure throws and the transaction rolls back.
    const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

    const counts = await one(
      `select count(*)::bigint as rows,
              coalesce(sum(total_cost_eur),0)::numeric as total,
              count(distinct asl_code)::int as asls,
              count(distinct channel)::int as channels,
              count(*) filter (where comparable_eligible)::bigint as eligible_rows,
              coalesce(sum(total_cost_eur) filter (where comparable_eligible),0)::numeric as eligible_total,
              count(*) filter (where source_version_id <> $1)::bigint as foreign_rows
         from canonical_fact`, [RELEASE_ID]);

    const check = (name, actual, want) => {
      if (String(actual) !== String(want)) {
        throw new Error(`post-condition failed: ${name}\n  expected ${want}\n  actual   ${actual}`);
      }
      say(`post-condition ok: ${name} = ${actual}`);
    };

    check("row count", counts.rows, expected.rows);
    check("total cost", Number(counts.total).toFixed(2), Number(expected.totalCostEur).toFixed(2));
    check("distinct ASLs", counts.asls, 4);
    check("distinct channels", counts.channels, 3);
    check("eligible spend reconciles to frozen bridge",
      Number(counts.eligible_total).toFixed(2), Number(expected.eligibleCostEur).toFixed(2));
    check("no rows from another release", counts.foreign_rows, 0);

    // The structural gate must hold in the data, not only in the constraint.
    const leak = await one(
      `select count(*)::bigint as n from canonical_fact
        where comparable_eligible and (source_disposition <> 'analytical' or exclusion_reason is not null)`);
    check("no non-analytical or excluded row is comparable", leak.n, 0);

    // The derived quantity must reconstruct the frozen per-stratum totals. If it
    // does not, the normalization is wrong and every uptake figure built on it
    // would be wrong in a way nothing downstream could detect.
    const units = await one(
      `select count(*) filter (where comparable_eligible and comparable_unit is null)::bigint as no_unit,
              count(distinct comparable_unit)::int as units,
              count(*) filter (where comparable_eligible and comparable_quantity is null)::bigint as no_qty
         from canonical_fact where source_version_id = $1`, [RELEASE_ID]);
    // Comparable rows WITHOUT a parsed quantity are expected and are reported,
    // not asserted away: they are withheld from uptake by name. Quantifying the
    // gap here is what keeps it from drifting unnoticed.
    const gap = await one(
      `select coalesce(sum(total_cost_eur),0)::numeric as eur, count(*)::bigint as n
         from canonical_fact
        where source_version_id = $1 and comparable_eligible and comparable_quantity is null`,
      [RELEASE_ID]);
    say(`comparable rows with no parsed presentation: ${gap.n} (${Number(gap.eur).toFixed(2)} EUR) -- withheld from uptake`);
    say(`comparable units in play: ${units.units}; comparable rows without a quantity: ${units.no_qty}`);

    // The rows that must survive the load intact.
    const preserved = await one(
      `select count(*) filter (where source_disposition = 'non_aic')::bigint as non_aic,
              count(*) filter (where total_cost_eur < 0)::bigint as negative_cost
         from canonical_fact where source_version_id = $1`, [RELEASE_ID]);
    say(`preserved: ${preserved.non_aic} non-AIC rows, ${preserved.negative_cost} negative-cost rows`);
    if (Number(preserved.non_aic) === 0) throw new Error("non-AIC rows were lost");
    if (Number(preserved.negative_cost) === 0) throw new Error("negative adjustments were lost");

    if (opts.dryRun) {
      await db.exec("rollback");
      say("DRY RUN — rolled back, database unchanged");
      return { inserted, committed: false, log };
    }
    await db.exec("commit");
    say("committed");
    return { inserted, committed: true, log };
  } catch (err) {
    await db.exec("rollback");
    say(`rolled back: ${err.message}`);
    throw err;
  }
}
