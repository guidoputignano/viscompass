// VEN — Vital / Essential / Non-essential.
//
// The criteria below are quoted from the standard reference. The ASSIGNMENTS are
// not, and are not in this file: MDS-3 states that VEN "assigns each
// pharmaceutical product on the formulary or essential medicines list" to a
// category, so criticality is a property of a particular formulary and case mix,
// not of a molecule in the abstract. A published list from another health system
// answers a different question from "what is vital in this perimeter".
//
// Consequence for this module: it validates, versions, resolves and reports
// coverage for a mapping somebody else supplies. It never derives a class. ABC
// measures spend concentration and AWaRe measures stewardship risk; neither is
// criticality, and neither may be used to infer one.
//
// Source: Management Sciences for Health, MDS-3: Managing Access to Medicines and
// Health Technologies, chapter 40 "Analyzing and controlling pharmaceutical
// expenditures", section 40.3 "VEN system", 2012 edition.
// https://msh.org/wp-content/uploads/2013/04/mds3-ch40-expenditures-mar2012.pdf
// SHA-256 of the retrieved file is recorded in data/provenance/ven-criteria.json.

export const VEN_SOURCE = {
  work: "MDS-3: Managing Access to Medicines and Health Technologies",
  publisher: "Management Sciences for Health",
  chapter: "40, Analyzing and controlling pharmaceutical expenditures",
  section: "40.3 VEN system",
  edition: "2012",
} as const;

export type VenClass = "V" | "E" | "N";

// Quoted definitions. Kept verbatim so a reviewer can check them against the
// source rather than against a paraphrase.
export const VEN_CRITERIA: Record<VenClass, { label: string; definition: string }> = {
  V: {
    label: "Vitale",
    definition:
      "vital medicines are potentially lifesaving, have significant withdrawal side effects (making regular supply mandatory), or are crucial to providing basic health services",
  },
  E: {
    label: "Essenziale",
    definition:
      "essential medicines are effective against less severe but nevertheless significant forms of illness but are not absolutely vital to providing basic health care",
  },
  N: {
    label: "Non essenziale",
    definition:
      "nonessential medicines are used for minor or self-limited illnesses, are of questionable efficacy, or have a comparatively high cost for a marginal therapeutic advantage",
  },
};

// MDS-3 is explicit that N does not mean "drop it": "Assignment to the
// nonessential category does not mean the medicine is no longer on the system's
// formulary or essential medicines list". Carried here so no interface implies
// a delisting recommendation.
export const VEN_N_IS_NOT_A_DELISTING =
  "L'assegnazione alla categoria non essenziale non implica l'uscita dal prontuario: indica una priorità di approvvigionamento più bassa, non un giudizio di efficacia sul singolo paziente.";

// Every state a product can be in. Closed union: an unmapped product has a
// reason, and no state means "assume non-essential".
export type VenStatus =
  | "approved_mapping_match"
  | "not_in_approved_mapping"
  | "ambiguous_in_approved_mapping"
  | "no_approved_mapping"
  | "approved_mapping_expired";

export type VenMappingRow = {
  mapping_version: string;
  /** ATC5 or a 9-digit AIC. Never trimmed or coerced: leading zeros matter. */
  scope_key: string;
  ven_class: VenClass;
  /** Which criterion the panel applied, in their words. */
  criteria_note?: string | null;
  supplied_by: string;
  supplied_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  valid_from: string;
  valid_to?: string | null;
  status: "pending" | "approved" | "superseded";
};

export type VenValidation = { ok: boolean; errors: string[]; warnings: string[] };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const AIC = /^\d{9}$/;
const ATC5 = /^[A-Z]\d{2}[A-Z]{2}\d{2}$/;
const isDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
};

/**
 * Validate a supplied mapping before it is allowed anywhere near a figure.
 *
 * Fails loudly rather than dropping rows: a mapping that is 90% loadable is not
 * 90% of a clinical decision, and silently discarding the rest would understate
 * how much of the perimeter is actually classified.
 */
export function validateVenMapping(rows: readonly VenMappingRow[], perimeter?: readonly string[]): VenValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!rows.length) return { ok: false, errors: ["mapping is empty"], warnings };

  const versions = new Set(rows.map((r) => r.mapping_version));
  if (versions.size !== 1) errors.push(`a mapping file carries exactly one version, found ${versions.size}`);

  const seen = new Map<string, VenClass>();
  const known = perimeter ? new Set(perimeter) : null;

  for (const [i, row] of rows.entries()) {
    const at = `row ${i + 1} (${row.scope_key})`;
    if (!Object.hasOwn(VEN_CRITERIA,row.ven_class)) errors.push(`${at}: "${row.ven_class}" is not V, E or N`);
    if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(row.mapping_version) || !isDate(row.mapping_version.split('.')[0])) errors.push(`${at}: invalid mapping version`);
    if (!['pending','approved','superseded'].includes(row.status)) errors.push(`${at}: invalid status`);
    if (!AIC.test(row.scope_key) && !ATC5.test(row.scope_key)) {
      errors.push(`${at}: scope key is neither a 9-digit AIC nor an ATC5 code`);
    }
    if (known && !known.has(row.scope_key)) warnings.push(`${at}: outside the declared perimeter`);

    // A conflict is an error, not a last-write-wins: two clinicians disagreeing
    // about one product is exactly the thing a reviewer must see.
    const prior = seen.get(row.scope_key);
    if (prior && prior !== row.ven_class) errors.push(`${at}: conflicting classes ${prior} and ${row.ven_class} in one version`);
    else if (prior) warnings.push(`${at}: duplicated with the same class`);
    seen.set(row.scope_key, row.ven_class);

    for (const [field, value] of [["valid_from", row.valid_from], ["supplied_at", row.supplied_at]] as const) {
      if (!isDate(value)) errors.push(`${at}: ${field} must be a valid ISO date`);
    }
    if (row.valid_to != null) {
      if (!isDate(row.valid_to)) errors.push(`${at}: valid_to must be a valid ISO date`);
      else if (row.valid_to <= row.valid_from) errors.push(`${at}: valid_to must be after valid_from`);
    }
    if (!row.supplied_by?.trim()) errors.push(`${at}: supplied_by is required — an unattributed mapping cannot be audited`);

    // Approval is a value constraint, mirroring how memberships and upload
    // reconciliation are handled: a submitter cannot approve their own row.
    // A superseded row was approved before it was replaced, so it must KEEP its
    // approver and date: that record is the audit trail for every figure the
    // version produced while it was live. Only a pending row has no approval.
    if (row.status !== "pending" && (!row.approved_by?.trim() || !isDate(row.approved_at))) {
      errors.push(`${at}: an ${row.status} row needs approved_by and an ISO approved_at`);
    }
    if (row.status === "pending" && (row.approved_by || row.approved_at)) {
      errors.push(`${at}: a pending row must not carry approval metadata`);
    }
    if (row.status === "approved" && row.approved_by?.trim() && row.approved_by.trim() === row.supplied_by.trim()) {
      errors.push(`${at}: approved_by and supplied_by are the same person`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Resolve one product against the mapping on a given date. Never guesses. */
export function resolveVen(
  scopeKey: string,
  rows: readonly VenMappingRow[],
  onDate: string,
): { ven: VenClass | null; status: VenStatus } {
  if (!isDate(onDate)) throw Error('Invalid VEN evaluation date');
  const approved = rows.filter((r) => r.status === "approved");
  if (!approved.length) return { ven: null, status: "no_approved_mapping" };

  const forKey = approved.filter((r) => r.scope_key === scopeKey);
  if (!forKey.length) return { ven: null, status: "not_in_approved_mapping" };

  const live = forKey.filter((r) => r.valid_from <= onDate && (r.valid_to == null || onDate < r.valid_to));
  if (!live.length) return { ven: null, status: "approved_mapping_expired" };

  const classes = new Set(live.map((r) => r.ven_class));
  if (classes.size > 1) return { ven: null, status: "ambiguous_in_approved_mapping" };
  return { ven: live[0].ven_class, status: "approved_mapping_match" };
}

export type VenCoverage = {
  total: number;
  byStatus: Record<VenStatus, number>;
  classified: number;
  /** Share of the perimeter carrying an approved class on this date. */
  coverage: number;
  unclassified: string[];
};

/**
 * Coverage over a perimeter. Reported before any matrix is drawn, because a
 * matrix built on a third of the products looks exactly like one built on all
 * of them.
 */
export function venCoverage(perimeter: readonly string[], rows: readonly VenMappingRow[], onDate: string): VenCoverage {
  const byStatus: Record<VenStatus, number> = {
    approved_mapping_match: 0,
    not_in_approved_mapping: 0,
    ambiguous_in_approved_mapping: 0,
    no_approved_mapping: 0,
    approved_mapping_expired: 0,
  };
  const unclassified: string[] = [];
  for (const key of perimeter) {
    const { status } = resolveVen(key, rows, onDate);
    byStatus[status]++;
    if (status !== "approved_mapping_match") unclassified.push(key);
  }
  const classified = byStatus.approved_mapping_match;
  return {
    total: perimeter.length,
    byStatus,
    classified,
    coverage: perimeter.length ? classified / perimeter.length : 0,
    unclassified,
  };
}

/**
 * Build an ABC×VEN matrix, or refuse.
 *
 * `minimumCoverage` exists so a matrix is never drawn from a fragment of the
 * perimeter. Unclassified products are excluded from every cell and returned
 * separately with their spend, so the amount left out stays visible instead of
 * quietly shrinking the totals.
 */
export function abcVenMatrix<T extends { band: "A" | "B" | "C"; scopeKey: string; value: number }>(
  items: readonly T[],
  rows: readonly VenMappingRow[],
  onDate: string,
  minimumCoverage = 1,
): {
  available: boolean;
  reason?: string;
  cells: Record<string, { count: number; value: number }>;
  excluded: { scopeKey: string; value: number; status: VenStatus }[];
} {
  if (!Number.isFinite(minimumCoverage) || minimumCoverage <= 0 || minimumCoverage > 1) throw Error('VEN coverage threshold must be in (0,1]');
  const keys = new Set<string>();
  for (const item of items) {
    if (!['A','B','C'].includes(item.band) || !Number.isFinite(item.value) || item.value < 0 || keys.has(item.scopeKey)) throw Error('Invalid or duplicate ABC-VEN item');
    keys.add(item.scopeKey);
  }
  const excluded: { scopeKey: string; value: number; status: VenStatus }[] = [];
  const cells: Record<string, { count: number; value: number }> = {};
  for (const band of ["A", "B", "C"] as const) {
    for (const ven of ["V", "E", "N"] as const) cells[`${band}${ven}`] = { count: 0, value: 0 };
  }

  for (const item of items) {
    const { ven, status } = resolveVen(item.scopeKey, rows, onDate);
    if (!ven) {
      excluded.push({ scopeKey: item.scopeKey, value: item.value, status });
      continue;
    }
    const cell = cells[`${item.band}${ven}`];
    cell.count++;
    cell.value += item.value;
  }

  const covered = items.length ? (items.length - excluded.length) / items.length : 0;
  if (!items.length) return { available: false, reason: "nessun prodotto nel perimetro", cells, excluded };
  if (covered < minimumCoverage) {
    return {
      available: false,
      reason: `classificazione VEN approvata per ${Math.round(covered * 100)}% dei prodotti: la matrice non viene mostrata sotto il ${Math.round(minimumCoverage * 100)}%`,
      cells,
      excluded,
    };
  }
  return { available: true, cells, excluded };
}
