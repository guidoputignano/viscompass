// Pillar B dashboard data contract.
//
// Every figure this product publishes carries, in the type system, the things a
// reviewer needs to judge it: what unit it is in, which period it covers, how
// much of the population it was computed over, and what was excluded. A number
// without those is not publishable here, so the contract does not allow one to
// exist.
//
// The data behind this contract comes from accepted facts in `canonical_fact`.
// It is NEVER read from the workbook at request time, and never from a fixture.
// The workbook is the artifact a reviewer checks the product against; if the
// product read it directly, parity would be a tautology rather than a test.

/**
 * The physical unit a quantity is expressed in.
 *
 * `eur` is included deliberately, because the most common way these get mixed is
 * ranking a euro figure against a volume figure and calling the result a league
 * table. The unit travels with every value so that cannot happen silently.
 */
export type PhysicalUnit = "mg" | "packs" | "ddd" | "eur";

/** Where a number came from. `observed` and `derived` must never be summed. */
export type Provenance = "observed" | "derived";

/**
 * A period. Full years and year-to-date windows are different kinds, because
 * comparing one to the other is the single easiest way to publish a false
 * decline — 2026 has five months of data and would look like a collapse.
 */
export type Period =
  | { kind: "full_year"; year: number; months: 12 }
  | { kind: "ytd"; year: number; throughMonth: number; months: number };

/**
 * A comparison between periods that the type system guarantees is fair: either
 * two full years, or two windows covering the SAME months. There is no
 * constructor for a full year against a YTD window.
 */
export type PeriodComparison =
  | { kind: "full_year"; current: Period; previous: Period }
  | { kind: "matched_ytd"; throughMonth: number; current: Period; previous: Period };

/**
 * How much of the relevant population a figure was actually computed over.
 *
 * `eligibleSpendEur / totalSpendEur` is the honest denominator. A figure whose
 * coverage is low is not wrong, but it is not the same claim as one at full
 * coverage, and the UI must be able to say so.
 */
export interface Coverage {
  /** Rows that carried the measure. */
  observedRows: number;
  /** Rows in scope, whether or not they carried it. */
  totalRows: number;
  /** Spend the measure was computed over. */
  eligibleSpendEur: number;
  /** Spend in scope. */
  totalSpendEur: number;
  /** Why the difference exists, most material first. Empty means full coverage. */
  exclusions: ReadonlyArray<{ reason: string; rows: number; spendEur: number }>;
}

/**
 * A publishable quantity.
 *
 * `value: null` means NOT OBSERVED and is categorically different from `0`,
 * which means observed and zero. Collapsing them is how "no data" becomes "no
 * spending", which has been a real defect in this project before.
 */
export interface Measure {
  value: number | null;
  unit: PhysicalUnit;
  provenance: Provenance;
  period: Period;
  coverage: Coverage;
  /** Set when the figure must not be published, with the reason. */
  withheld?: string;
}

/** A measure attached to the thing it describes, for tables and rankings. */
export interface MeasuredRow<T> {
  subject: T;
  measure: Measure;
}

/**
 * The source lane. Public AIFA context and private ASL facts are different
 * kinds and may never be summed, ranked together, or silently concatenated: an
 * AIFA reference price is not an ASL net contract price.
 */
export type SourceLane = "private_asl" | "public_aifa";

export interface Scoped<T> {
  lane: SourceLane;
  /** Release the figures were computed from, for the audit trail. */
  sourceVersionId: string;
  data: T;
}

/** The B03 perimeter vocabulary. `unresolved` is a real answer, never originator. */
export type PerimeterStatus =
  | "biosimilar"
  | "reference_medicine"
  | "non_biosimilar_same_substance"
  | "outside_biosimilar_perimeter"
  | "unresolved";

export interface UptakePoint {
  period: Period;
  /** Share across the whole period. */
  wholePeriod: Measure;
  /**
   * Share across only the months in which a biosimilar of that molecule was
   * actually dispensed locally. Reported separately, never averaged with the
   * above: they answer different questions and differ materially.
   */
  locallySubstitutable: Measure;
}
