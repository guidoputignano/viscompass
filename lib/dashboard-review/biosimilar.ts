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

/**
 * The earliest month a biosimilar of each molecule could have been dispensed here.
 *
 * Computed over the WHOLE fact set, never a single year: a biosimilar first
 * dispensed in 2024 must not look new in 2025.
 */
export function firstLocalDispensing(facts: CanonicalFact[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const fact of facts) {
    if (fact.biosimilar_flag !== true) continue;
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
  return facts.reduce((sum, fact) => {
    if ((fact.total_content_mg ?? 0) <= 0 || (fact.quantity_packs ?? 0) <= 0) return sum;
    return sum + fact.total_content_mg! * fact.quantity_packs!;
  }, 0);
}

export function spendOf(facts: CanonicalFact[]): number {
  return facts.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
}

/** Facts carrying a positive normalised volume AND positive spend. */
export function measurableFacts(facts: CanonicalFact[]): CanonicalFact[] {
  return facts.filter(
    (fact) =>
      (fact.total_content_mg ?? 0) > 0 &&
      (fact.quantity_packs ?? 0) > 0 &&
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
 * Biosimilar share by mg, falling back to packs then spend, with the basis named.
 *
 * A basis is used only when it is COMPLETE over the facts being compared. The
 * previous version used mg whenever ANY fact carried a normalised volume, which
 * silently dropped unnormalised rows out of the denominator while their
 * counterparts stayed in the numerator — a molecule whose originator rows lacked
 * strength data could read as nearly 100% biosimilar. Falling back to a coarser
 * but complete basis reports less precision; reporting an incomplete one reports
 * the wrong number.
 */
export type PenetrationBasis = "mg" | "packs" | "spend";

/** Finest first. A coarser basis is used only when a finer one is incomplete. */
const BASIS_ORDER: PenetrationBasis[] = ["mg", "packs", "spend"];

/**
 * The facts a share is computed over: flagged as originator or biosimilar, and
 * carrying some signal. A row with neither packs nor spend records nothing and
 * must not be allowed to fail a completeness test it could never pass.
 */
function contributingFacts(facts: CanonicalFact[]): CanonicalFact[] {
  return facts.filter(
    (fact) =>
      (fact.biosimilar_flag !== null || fact.originator_flag === true) &&
      ((fact.quantity_packs ?? 0) > 0 || (fact.total_cost_eur ?? 0) > 0),
  );
}

function basisIsComplete(contributing: CanonicalFact[], basis: PenetrationBasis): boolean {
  if (contributing.length === 0) return false;
  if (basis === "mg") {
    return contributing.every(
      (fact) => (fact.total_content_mg ?? 0) > 0 && (fact.quantity_packs ?? 0) > 0,
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
  const contributing = contributingFacts(facts);
  const total = measureOn(contributing, basis);
  if (total <= 0) return null;
  const bio = contributing.filter((fact) => fact.biosimilar_flag === true);
  return measureOn(bio, basis) / total;
}

export function penetration(facts: CanonicalFact[]): {
  value: number | null;
  basis: PenetrationBasis | null;
} {
  const contributing = contributingFacts(facts);
  if (contributing.length === 0) return { value: null, basis: null };
  for (const basis of BASIS_ORDER) {
    if (!basisIsComplete(contributing, basis)) continue;
    const value = penetrationOn(facts, basis);
    if (value !== null) return { value, basis };
  }
  return { value: null, basis: null };
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
    const bio = group.filter((f) => f.biosimilar_flag === true);
    if (bio.length === 0) continue;
    const orig = group.filter((f) => f.originator_flag === true || f.biosimilar_flag === false);

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
    const headroomBase = Math.min(
      Math.max(0, spendOf(measurableFacts(subsOrig))),
      substitutableOrigSpend,
    );

    const origCostPerMg = costPerMg(subsOrig);
    const bioCostPerMg = costPerMg(subsBio);

    // A differential is applied ONLY where both sides are measurable inside the
    // window AND the biosimilar is actually cheaper. Where the biosimilar costs
    // more per mg the headroom is zero, never negative: substituting there would
    // cost money, and a negative "saving" silently offsets a real one elsewhere.
    const measurable = origCostPerMg !== null && bioCostPerMg !== null && origCostPerMg > 0;
    const headroom =
      measurable && origCostPerMg! > bioCostPerMg!
        ? headroomBase * (1 - bioCostPerMg! / origCostPerMg!)
        : 0;

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
      penetration_locally_substitutable: penSubs.value,
      // The window figure has its OWN basis and it need not match the all-months
      // one — the window is a different row set, so a basis complete over one can
      // be incomplete over the other. Publishing both numbers under a single basis
      // label mislabelled the second one.
      penetration_locally_substitutable_basis: penSubs.basis,
      comparable_share: origCeiling > 0 ? headroomBase / origCeiling : null,
      normalized_volume_mg: normalizedVolumeMg(group) > 0 ? normalizedVolumeMg(group) : null,
      normalization_coverage: normalizationCoverage(group),
      evidence_status: measurable ? "ready" : bio.length > 0 ? "partial" : "unresolved",
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
    (fact) => fact.cost_per_mg !== null || fact.cost_per_ddd !== null,
  );
  return normalized.length / eligible.length;
}
