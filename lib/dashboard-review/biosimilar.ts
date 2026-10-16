import type { BiosimilarComparisonRow, CanonicalFact, TherapeuticAreaStatus } from "./types";

/**
 * Biosimilar comparison, rebuilt to match the verified Pillar B analysis.
 *
 * The previous computation multiplied a molecule's ENTIRE originator spend by the
 * price differential and labelled the result `potential_savings_eur`. Measured
 * against the verified figure it returned 2,43x the defensible upper bound, on a
 * population the analysis explicitly rejects, with no interval. Three things are
 * fixed here.
 *
 * 1. THE BASE IS LOCALLY SUBSTITUTABLE SPEND, NOT ALL OF IT.
 *    Originator spend only counts from the month a biosimilar of that molecule was
 *    ACTUALLY DISPENSED somewhere in the organisation. Before that month there was
 *    nothing to switch to here, however many biosimilars existed elsewhere, so
 *    counting it asserts a substitution that was not available. In the verified
 *    analysis this is the difference between EUR 60,9 M and EUR 20,3 M.
 *
 *    This also subsumes a date-validity check the fact table cannot support on its
 *    own: a biosimilar cannot be dispensed before it is authorised, so months at or
 *    after first local dispensing are necessarily months in which it existed.
 *
 * 2. A DIFFERENTIAL IS ONLY APPLIED WHERE IT IS MEASURABLE.
 *    Both sides must carry a positive normalised volume and a positive cost inside
 *    that window. Where they do not, the row reports no headroom rather than an
 *    imputed one.
 *
 * 3. IT IS NOT CALLED A SAVING.
 *    `substitution_headroom_eur` is an UPPER BOUND under assumptions this data
 *    cannot test -- clinical substitutability, price durability at higher volume,
 *    absence of contract lock-in, absence of offsetting cost. The field name, the
 *    `headroom_is_upper_bound` flag and the UI all say so.
 *
 * Penetration is reported on TWO denominators because one is not defensible: the
 * share across all months, and the share across locally-substitutable months only.
 * They answer different questions and differ materially.
 *
 * WHAT THIS STILL CANNOT DO. The fact table carries no route, pack-count agreement
 * or cross-source coherence flag, so the verified comparability gate cannot be
 * fully reproduced here. `comparable_share` reports how much of the molecule's
 * spend cleared the gate that IS implementable, and it is not the verified 64,86%
 * eligible share, which is computed over the whole ledger upstream.
 */

/** year*12 + month. Only ever called with a month already validated as 1..12. */
function monthKey(year: number, month: number): number {
  return year * 12 + month;
}

/**
 * When a fact could have occurred, as an inclusive month interval.
 *
 * A fact with a valid month occupies that single month. A fact WITHOUT one is
 * known only to the year, so it spans January to December of it — we do not know
 * when inside the year it happened, and pretending otherwise is what the previous
 * version did wrong.
 *
 * That version read a missing month as December when opening the window and as
 * January when testing membership, calling it "conservative in both directions".
 * It is not conservative, and it broke three ways:
 *
 *   1. It CHERRY-PICKED THE PRICE. A month-less biosimilar row was excluded from
 *      the window it had itself helped open. Drop an expensive biosimilar row and
 *      the measured biosimilar cost per mg falls, so the differential — and the
 *      headroom — RISE. Exactly the direction an upper bound must not drift.
 *   2. It ZEROED ANNUAL DATA. Where a molecule's first biosimilar dispensing sits
 *      in a month-less fact in the reported year, the opening registered at
 *      December and every same-year fact was retested at January, so the window
 *      excluded everything — including the fact that opened it. Year-granularity
 *      uploads are a supported shape (queries.ts branches on it), and for them the
 *      whole comparison silently collapsed to zero.
 *   3. It was ASYMMETRIC between the two sides for no stated reason.
 *
 * Spanning the year applies one rule to both sides, so nothing is cherry-picked.
 * The residual is stated plainly: at year granularity the window cannot exclude
 * originator spend that preceded the biosimilar WITHIN the opening year, so a row
 * built from month-less facts is a weaker claim than one built from monthly facts.
 *
 * An out-of-range, non-integer or NaN month is treated as absent rather than
 * trusted: month 0 would otherwise alias December of the previous year through
 * `year*12 + 0` and open the window a year early.
 */
function monthSpan(fact: CanonicalFact): { first: number; last: number } | null {
  if (!Number.isInteger(fact.year)) return null;
  const month = fact.month;
  if (month === null || !Number.isInteger(month) || month < 1 || month > 12) {
    return { first: monthKey(fact.year, 1), last: monthKey(fact.year, 12) };
  }
  return { first: monthKey(fact.year, month), last: monthKey(fact.year, month) };
}

/** A numeric column that may arrive as a JSON number or as a string (pg wire); null stays null. */
function finite(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Mass units the comparable quantity can be converted from, to mg. */
const MG_PER_UNIT: Record<string, number> = { MG: 1, MCG: 0.001, G: 1000 };

/**
 * The row's normalised mass in mg, or null when it has none.
 *
 * Pillar B release rows carry it as `comparable_quantity`, in the comparability
 * stratum's own unit, and only rows that passed the release's comparability gate
 * (`comparable_eligible`) may enter a €/mg figure. Units that are not a mass
 * (packs, IU, ml, MBq, …) are never converted to mg and never mixed with it.
 * Rows from earlier loads carry it as per-pack content × packs.
 */
export function normalizedMg(fact: CanonicalFact): number | null {
  if (fact.comparable_eligible === true) return comparableMassMg(fact);
  const perPack = finite(fact.total_content_mg), packs = finite(fact.quantity_packs);
  return perPack !== null && packs !== null && perPack > 0 && packs > 0 ? perPack * packs : null;
}

/**
 * The gated Pillar B mass in mg: a row that passed the comparability gate and
 * whose stratum unit is a mass. This, not `normalizedMg`, decides whether a
 * release row counts as normalised: earlier loads keep their own per-row
 * `cost_per_mg`/`cost_per_ddd` rule unchanged.
 */
export function comparableMassMg(fact: CanonicalFact): number | null {
  if (fact.comparable_eligible !== true) return null;
  const factor = fact.comparable_unit ? MG_PER_UNIT[fact.comparable_unit.trim().toUpperCase()] : undefined;
  const quantity = finite(fact.comparable_quantity);
  return factor !== undefined && quantity !== null && quantity > 0 ? quantity * factor : null;
}

/**
 * The gated quantity of a release row in its stratum's OWN unit (mg, IU, U, MU …),
 * with the stratum it belongs to; null when the row has none. A quantity is only
 * ever added to quantities of the same stratum, whose id carries the unit, so IU
 * products (enoxaparin, epoetins, insulins) count without any unit conversion and
 * two units are never summed.
 */
export function comparableQuantity(fact: CanonicalFact): { stratum: string; quantity: number } | null {
  if (fact.comparable_eligible !== true || !fact.comparable_stratum_id || !fact.comparable_unit) return null;
  const quantity = finite(fact.comparable_quantity);
  if (quantity === null || quantity <= 0) return null;
  return { stratum: `${fact.comparable_stratum_id}|${fact.comparable_unit.trim().toUpperCase()}`, quantity };
}

/**
 * Biosimilar side. The Pillar B release records it as the B03 perimeter status;
 * earlier loads as `biosimilar_flag`.
 */
/** Comparability stratum of a row; earlier loads carry none and pool as one. */
function stratumOf(fact: CanonicalFact): string {
  return fact.comparable_stratum_id ?? "";
}

export function isBiosimilar(fact: CanonicalFact): boolean {
  return fact.biosimilar_flag === true || fact.perimeter_status === "biosimilar";
}

/**
 * Originator side: the EPAR-named reference medicine. «unresolved» and
 * «non_biosimilar_same_substance» are deliberately NOT originators (B03 rules R1,
 * R2): blank or unproven status never becomes "originator".
 */
export function isOriginatorSide(fact: CanonicalFact): boolean {
  if (isBiosimilar(fact)) return false;
  return fact.originator_flag === true || fact.biosimilar_flag === false || fact.perimeter_status === "reference_medicine";
}

/**
 * The earliest month a biosimilar of each molecule could have been dispensed here.
 *
 * Computed over the WHOLE fact set, never a single year: a biosimilar first
 * dispensed in 2024 must not look new in 2025.
 */
export function firstLocalDispensing(facts: CanonicalFact[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const fact of facts) {
    if (!isBiosimilar(fact)) continue;
    if (!fact.active_substance) continue;
    // A row with no packs and no spend records no dispensing. Negative values are
    // credit notes against an earlier dispensing, which does not open a window on
    // its own — the dispensing it reverses already did.
    if ((fact.quantity_packs ?? 0) <= 0 && (fact.total_cost_eur ?? 0) <= 0) continue;
    const span = monthSpan(fact);
    if (span === null) continue;
    const seen = out.get(fact.active_substance);
    if (seen === undefined || span.first < seen) out.set(fact.active_substance, span.first);
  }
  return out;
}

/**
 * True when a fact could have occurred at or after its molecule's first local
 * dispensing — that is, when the latest month it could belong to is not earlier
 * than the opening.
 */
export function isLocallySubstitutable(
  fact: CanonicalFact,
  firstDispensed: Map<string, number>,
): boolean {
  if (!fact.active_substance) return false;
  const opened = firstDispensed.get(fact.active_substance);
  if (opened === undefined) return false;
  const span = monthSpan(fact);
  if (span === null) return false;
  return span.last >= opened;
}

export function normalizedVolumeMg(facts: CanonicalFact[]): number {
  return facts.reduce((sum, fact) => sum + (normalizedMg(fact) ?? 0), 0);
}

export function spendOf(facts: CanonicalFact[]): number {
  return facts.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
}

/** Facts carrying a positive normalised volume AND positive spend. */
export function measurableFacts(facts: CanonicalFact[]): CanonicalFact[] {
  return facts.filter(
    (fact) =>
      (normalizedMg(fact) ?? 0) > 0 &&
      (fact.total_cost_eur ?? 0) > 0,
  );
}

/**
 * Cost per mg, with numerator and denominator over the SAME rows.
 *
 * Two fallbacks were removed here, both of which overstated the figure.
 *
 * The first averaged the per-row `cost_per_mg` weighted by pack count when no
 * normalised volume existed. That mixes a derived per-row figure with an aggregate
 * and produces a number whose denominator is not stated.
 *
 * The second was subtler and worse: dividing TOTAL spend by NORMALISED volume. A
 * fact with no `total_content_mg` contributes its euros to the numerator and
 * nothing to the denominator, so a partially-normalised set reports a cost per mg
 * inflated by exactly the unnormalised share. On the originator side that inflates
 * the price differential and therefore the headroom. The subset is now taken first
 * and both sides are computed on it.
 */
export function costPerMg(facts: CanonicalFact[]): number | null {
  const subset = measurableFacts(facts);
  const volume = normalizedVolumeMg(subset);
  const spend = spendOf(subset);
  if (volume > 0 && spend > 0) return spend / volume;
  return null;
}

/**
 * Biosimilar share by comparable quantity (release rows), then mg (earlier
 * loads), falling back to packs then spend, with the basis named.
 *
 * A basis is used only when it is COMPLETE over the facts being compared. The
 * previous version used mg whenever ANY fact carried a normalised volume, which
 * silently dropped unnormalised rows out of the denominator while their
 * counterparts stayed in the numerator — a molecule whose originator rows lacked
 * strength data could read as nearly 100% biosimilar. Falling back to a coarser
 * but complete basis reports less precision; reporting an incomplete one reports
 * the wrong number.
 */
export type PenetrationBasis = "comparable_quantity" | "mg" | "packs" | "spend";

/** Finest first. A coarser basis is used only when a finer one is incomplete. */
const BASIS_ORDER: PenetrationBasis[] = ["comparable_quantity", "mg", "packs", "spend"];

/**
 * A molecule's quantity figure is used only when the gated quantities cover at
 * least this share of the spend on EACH side present. A side left mostly ungated
 * is not a sample of it: epoetin alfa and somatropin carry gated quantities on
 * the biosimilar side only, and the gated subset alone reads 100% biosimilar.
 * The same 80% marks a molecule's evidence «ready» in buildBiosimilarRows.
 */
const QUANTITY_SIDE_COVERAGE = 0.8;

const positiveSpend = (fact: CanonicalFact) => Math.max(0, fact.total_cost_eur ?? 0);

/**
 * Biosimilar share on the release's comparable quantity, with spend kept only
 * where quantity cannot be read.
 *
 * On spend the share understates use, because the biosimilar costs less per unit.
 * Here each molecule whose quantities cover both sides (see
 * QUANTITY_SIDE_COVERAGE) is measured in quantity INSIDE each comparability
 * stratum (molecule, route, form, unit), and its strata are weighted by their
 * spend: a subcutaneous and an intravenous presentation are never added in mg,
 * and IU products are measured in IU. Every other molecule keeps its spend share.
 * Molecules are then weighted by their spend, so the figure still covers all of
 * it; `quantity_coverage` is the share of that spend measured in quantity.
 */
export function comparableQuantityShare(facts: CanonicalFact[]): {
  value: number | null;
  quantity_coverage: number | null;
} {
  const byMolecule = new Map<string, CanonicalFact[]>();
  for (const fact of contributingFacts(facts)) {
    const key = fact.active_substance ?? "";
    const list = byMolecule.get(key) ?? [];
    list.push(fact);
    byMolecule.set(key, list);
  }
  let weight = 0, weighted = 0, onQuantity = 0;
  for (const group of byMolecule.values()) {
    const spend = group.reduce((sum, fact) => sum + positiveSpend(fact), 0);
    if (spend <= 0) continue;
    let share = group.filter(isBiosimilar).reduce((sum, fact) => sum + positiveSpend(fact), 0) / spend;
    const sides = [group.filter(isBiosimilar), group.filter((fact) => !isBiosimilar(fact))];
    const covered = sides.every((side) => {
      const total = side.reduce((sum, fact) => sum + positiveSpend(fact), 0);
      const gated = side.filter((fact) => comparableQuantity(fact) !== null).reduce((sum, fact) => sum + positiveSpend(fact), 0);
      return total <= 0 || gated / total >= QUANTITY_SIDE_COVERAGE;
    });
    if (covered) {
      const strata = new Map<string, { bio: number; all: number; spend: number }>();
      for (const fact of group) {
        const q = comparableQuantity(fact);
        if (q === null) continue;
        const s = strata.get(q.stratum) ?? { bio: 0, all: 0, spend: 0 };
        s.all += q.quantity;
        if (isBiosimilar(fact)) s.bio += q.quantity;
        s.spend += positiveSpend(fact);
        strata.set(q.stratum, s);
      }
      const stratumWeight = [...strata.values()].reduce((sum, s) => sum + s.spend, 0);
      if (stratumWeight > 0) {
        share = [...strata.values()].reduce((sum, s) => sum + s.spend * (s.bio / s.all), 0) / stratumWeight;
        onQuantity += spend;
      }
    }
    weight += spend;
    weighted += spend * share;
  }
  if (weight <= 0 || onQuantity <= 0) return { value: null, quantity_coverage: null };
  return { value: weighted / weight, quantity_coverage: onQuantity / weight };
}

/**
 * The facts a share is computed over: flagged as originator or biosimilar, and
 * carrying some signal. A row with neither packs nor spend records nothing and
 * must not be allowed to fail a completeness test it could never pass.
 */
function contributingFacts(facts: CanonicalFact[]): CanonicalFact[] {
  return facts.filter(
    (fact) =>
      (isBiosimilar(fact) || isOriginatorSide(fact)) &&
      ((fact.quantity_packs ?? 0) > 0 || (fact.total_cost_eur ?? 0) > 0),
  );
}

function basisIsComplete(contributing: CanonicalFact[], basis: PenetrationBasis): boolean {
  if (contributing.length === 0) return false;
  // Complete by construction (spend where quantity is missing); usable once at
  // least one molecule is actually measured in quantity, or it is a spend share.
  if (basis === "comparable_quantity") return comparableQuantityShare(contributing).value !== null;
  if (basis === "mg") {
    return contributing.every(
      (fact) => (normalizedMg(fact) ?? 0) > 0,
    );
  }
  if (basis === "packs") return contributing.every((fact) => (fact.quantity_packs ?? 0) > 0);
  return true; // spend is the last resort and is never gated
}

function measureOn(facts: CanonicalFact[], basis: PenetrationBasis): number {
  if (basis === "mg") return normalizedVolumeMg(facts);
  if (basis === "packs") return facts.reduce((sum, f) => sum + (f.quantity_packs ?? 0), 0);
  return spendOf(facts);
}

/** Biosimilar share on an explicitly chosen basis, whether or not it is complete. */
export function penetrationOn(facts: CanonicalFact[], basis: PenetrationBasis): number | null {
  if (basis === "comparable_quantity") return comparableQuantityShare(facts).value;
  const contributing = contributingFacts(facts);
  const total = measureOn(contributing, basis);
  if (total <= 0) return null;
  const bio = contributing.filter(isBiosimilar);
  return measureOn(bio, basis) / total;
}

export function penetration(facts: CanonicalFact[]): {
  value: number | null;
  basis: PenetrationBasis | null;
  /** On the comparable-quantity basis, the share of the compared spend measured in quantity; else null. */
  quantity_coverage: number | null;
} {
  const contributing = contributingFacts(facts);
  if (contributing.length === 0) return { value: null, basis: null, quantity_coverage: null };
  for (const basis of BASIS_ORDER) {
    if (!basisIsComplete(contributing, basis)) continue;
    if (basis === "comparable_quantity") {
      const share = comparableQuantityShare(contributing);
      if (share.value !== null) return { value: share.value, basis, quantity_coverage: share.quantity_coverage };
      continue;
    }
    const value = penetrationOn(facts, basis);
    if (value !== null) return { value, basis, quantity_coverage: null };
  }
  return { value: null, basis: null, quantity_coverage: null };
}

/**
 * The finest basis complete for EVERY group in a set that will be shown side by
 * side, so the figures share a denominator.
 *
 * Choosing a basis per group independently is what makes a comparison table lie:
 * one ASL missing a single strength value drops only that ASL to packs, and its
 * percentage is then set against its neighbours' mg percentages as though the two
 * were the same measure — a gap produced by a data gap, not by prescribing. A
 * whole cohort on a coarser basis is commensurable; a mixed cohort is not.
 */
export function commonPenetrationBasis(groups: CanonicalFact[][]): PenetrationBasis | null {
  const populated = groups.map(contributingFacts).filter((group) => group.length > 0);
  if (populated.length === 0) return null;
  for (const basis of BASIS_ORDER) {
    if (populated.every((group) => basisIsComplete(group, basis))) return basis;
  }
  return null;
}

export interface BuildOptions {
  classifyArea: (fact: CanonicalFact) => { label: string; status: TherapeuticAreaStatus };
}

/**
 * Build one comparison row per molecule.
 *
 * `facts` must be the WHOLE fact set, not a single year: first local dispensing is
 * established across all of it. `latestYear` selects which year the row reports.
 */
/**
 * Total substitution headroom over the molecules whose €/mg differential was
 * measurable. An unmeasurable molecule stores 0, so a plain sum would publish
 * "0 €" when nothing could be computed: with no measurable molecule the total is
 * `null` ("not computable"). A measured 0 (the biosimilar is not cheaper) stays 0.
 */
export function headroomTotal(rows: BiosimilarComparisonRow[]): {
  total: number | null;
  measurable: number;
  molecules: number;
} {
  const measurable = rows.filter((row) => row.evidence_status !== "unresolved");
  return {
    total: measurable.length === 0 ? null : measurable.reduce((sum, row) => sum + row.substitution_headroom_eur, 0),
    measurable: measurable.length,
    molecules: rows.length,
  };
}

export function buildBiosimilarRows(
  facts: CanonicalFact[],
  latestYear: number | null,
  options: BuildOptions,
): BiosimilarComparisonRow[] {
  if (latestYear === null) return [];

  const firstDispensed = firstLocalDispensing(facts);
  const inYear = facts.filter((fact) => fact.year === latestYear);

  const byMolecule = new Map<string, CanonicalFact[]>();
  for (const fact of inYear) {
    if (!fact.active_substance) continue;
    const list = byMolecule.get(fact.active_substance) ?? [];
    list.push(fact);
    byMolecule.set(fact.active_substance, list);
  }

  const out: BiosimilarComparisonRow[] = [];
  for (const [activeSubstance, group] of byMolecule) {
    const bio = group.filter(isBiosimilar);
    if (bio.length === 0) continue;
    const orig = group.filter(isOriginatorSide);

    const origSpend = spendOf(orig);
    const bioSpend = spendOf(bio);
    const totalSpend = origSpend + bioSpend;

    // --- gate 1: the locally-substitutable window ---------------------------
    const subsOrig = orig.filter((f) => isLocallySubstitutable(f, firstDispensed));
    const subsBio = bio.filter((f) => isLocallySubstitutable(f, firstDispensed));

    // Credit notes carry a NEGATIVE total_cost_eur, and this data has them. They
    // reduce `origSpend` but are excluded from `measurableFacts` (which requires
    // positive spend), so without a floor the measurable base could exceed the
    // window, the window could exceed the molecule's own spend, and
    // `comparable_share` could pass 1 — a funnel running backwards. Each stage is
    // therefore clamped to the one above it. If net originator spend is zero or
    // negative there is nothing to substitute and the whole funnel is zero.
    const origCeiling = Math.max(0, origSpend);
    const substitutableOrigSpend = Math.min(Math.max(0, spendOf(subsOrig)), origCeiling);

    // --- gate 2: the part of that window where a rate is measurable ---------
    // The differential is a rate per mg, so it may only be applied to spend whose
    // mg are known. Applying it to the whole window would extrapolate the rate
    // onto rows that were never measured — the narrowing the verified analysis
    // makes twice (all reference spend -> window -> measurable) and the previous
    // computation made not at all.
    //
    // --- gate 3: only inside one comparability stratum ------------------------
    // A per-mg rate is compared only between rows of the SAME stratum (molecule,
    // route, pharmaceutical form, unit). A subcutaneous originator set against an
    // intravenous biosimilar is two different products, and pooling them produced
    // a differential between them. Each stratum present on both sides gets its own
    // differential; strata on one side only contribute nothing. Earlier loads carry
    // no stratum and pool as one, exactly as before.
    const measOrig = measurableFacts(subsOrig);
    const measBio = measurableFacts(subsBio);
    const bioStrata = new Set(measBio.map(stratumOf));
    const shared = new Set(measOrig.map(stratumOf).filter((s) => bioStrata.has(s)));
    const sharedOrig = measOrig.filter((f) => shared.has(stratumOf(f)));
    const sharedBio = measBio.filter((f) => shared.has(stratumOf(f)));
    let rawBase = 0;
    let rawHeadroom = 0;
    for (const stratum of shared) {
      const o = sharedOrig.filter((f) => stratumOf(f) === stratum);
      const b = sharedBio.filter((f) => stratumOf(f) === stratum);
      const oCost = costPerMg(o);
      const bCost = costPerMg(b);
      const base = Math.max(0, spendOf(o));
      rawBase += base;
      // A differential is applied ONLY where both sides are measurable AND the
      // biosimilar is actually cheaper. Where it costs more per mg the headroom is
      // zero, never negative: a negative "saving" would silently offset a real one.
      if (oCost !== null && bCost !== null && oCost > 0 && oCost > bCost) rawHeadroom += base * (1 - bCost / oCost);
    }
    const headroomBase = Math.min(rawBase, substitutableOrigSpend);

    const origCostPerMg = costPerMg(sharedOrig);
    const bioCostPerMg = costPerMg(sharedBio);
    const measurable = shared.size > 0 && origCostPerMg !== null && bioCostPerMg !== null && origCostPerMg > 0;
    // The base is clamped to the window above it; the headroom follows the clamp.
    const headroom = measurable && rawBase > 0 ? rawHeadroom * (headroomBase / rawBase) : 0;

    const coverage = normalizationCoverage(group);
    const penAll = penetration(group);
    const penSubs = penetration([...subsOrig, ...subsBio]);
    const area = options.classifyArea(group[0]);

    out.push({
      active_substance: activeSubstance,
      atc4: group[0]?.atc4 ?? null,
      therapeutic_area: area.label,
      therapeutic_area_status: area.status,
      originator_cost_per_mg: origCostPerMg,
      biosimilar_cost_per_mg: bioCostPerMg,
      originator_spend_eur: origSpend,
      biosimilar_spend_eur: bioSpend,
      originator_share: totalSpend > 0 ? origSpend / totalSpend : 0,
      substitution_headroom_eur: headroom,
      headroom_is_upper_bound: true,
      headroom_basis: measurable
        ? "locally substitutable months, measurable differential"
        : "no measurable differential",
      substitutable_originator_spend_eur: substitutableOrigSpend,
      headroom_base_eur: headroomBase,
      biosimilar_penetration: penAll.value,
      penetration_basis: penAll.basis ?? "spend",
      penetration_quantity_coverage: penAll.quantity_coverage,
      penetration_locally_substitutable: penSubs.value,
      // The window figure has its OWN basis and it need not match the all-months
      // one — the window is a different row set, so a basis complete over one can
      // be incomplete over the other. Publishing both numbers under a single basis
      // label mislabelled the second one.
      penetration_locally_substitutable_basis: penSubs.basis,
      comparable_share: origCeiling > 0 ? headroomBase / origCeiling : null,
      normalized_volume_mg: normalizedVolumeMg(group) > 0 ? normalizedVolumeMg(group) : null,
      normalization_coverage: coverage,
      // All three arms must be reachable and mean something. The previous version
      // read `measurable ? "ready" : bio.length > 0 ? "partial" : "unresolved"`,
      // but a molecule with no biosimilar has already been skipped above, so
      // "unresolved" could never be produced while the UI still rendered a state
      // for it — and "ready" had stopped implying anything about coverage.
      evidence_status: !measurable
        ? "unresolved"
        : (coverage ?? 0) >= 0.8
          ? "ready"
          : "partial",
      latest_year: latestYear,
    });
  }

  out.sort((a, b) => b.substitution_headroom_eur - a.substitution_headroom_eur);
  return out;
}

/**
 * Share of spending rows carrying a normalised per-unit cost.
 *
 * Kept for the other views that already report it. It is a ROW-COUNT share, not a
 * spend share, and it is NOT the verified eligible share of the ledger -- that is
 * computed upstream over the whole source and is materially lower.
 */
export function normalizationCoverage(facts: CanonicalFact[]): number | null {
  const eligible = facts.filter((fact) => (fact.total_cost_eur ?? 0) > 0);
  if (eligible.length === 0) return null;
  const normalized = eligible.filter(
    (fact) => fact.cost_per_mg !== null || fact.cost_per_ddd !== null || comparableMassMg(fact) !== null,
  );
  return normalized.length / eligible.length;
}
