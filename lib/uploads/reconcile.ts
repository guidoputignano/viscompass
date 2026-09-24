// Upload reconciliation.
//
// The previous version was a no-op, on the grounds that a comparison against an
// empty canonical_fact could only ever report "no discrepancy" — indistinguishable
// from a real pass. That reasoning was right about the canonical comparison and
// wrong to conclude nothing could be done: a supplied file can be validated,
// staged, quarantined and reconciled against ITSELF, which is most of the value.
// So the file-internal work happens now, and the canonical comparison reports
// itself unavailable rather than claiming a pass it has not earned.
//
// Rules applied here are the ones AGENTS.md records as RESOLVED. The ones it
// lists as open questions for the Region are not decided: those rows are
// quarantined with their amounts visible, so a reviewer sees exactly how much
// sits outside the reconciled total instead of the loader inventing a rule.

/** One row as read from the supplied extraction, before any judgement. */
export type UploadRow = {
  /** 1-based row number in the source file: provenance for every decision. */
  sourceRow: number;
  aslCode: string | null;
  /** As read. Not padded or coerced here: a wrong key must not become a right one. */
  aic: string | null;
  manufacturer?: string | null;
  /** Column (a): erogato quantity on the DD + DPC + CO basis (the group header
   *  is correct; the per-column labels in the source omit DPC and are wrong). */
  quantity: number | null;
  /** Column (c): erogato cost on the same basis. */
  cost: number | null;
  /** Months actually covered. Partial coverage is normal, not a defect. */
  months?: number | null;
};

export type QuarantineCode =
  | "aic_not_nine_digits"
  | "asl_code_missing"
  | "nd_asl_unresolved"
  | "orphan_asl_code_130106"
  | "duplicate_source_key"
  | "negative_adjustment"
  | "cost_without_quantity";

export type QuarantinedRow = {
  sourceRow: number;
  code: QuarantineCode;
  reason: string;
  /** Carried always, so the amount held back is visible rather than implied. */
  cost: number | null;
  quantity: number | null;
  /** True when AGENTS.md records this as an open question for the Region. */
  awaitingRegion: boolean;
};

export type AcceptedRow = UploadRow & {
  /** Zero-padded 9-digit key, present only once the row is accepted. */
  aicKey: string;
  /**
   * Column (b). Null when the quantity is zero or absent: `c / a` does not
   * divide. AGENTS.md settles this — blank and #DIV/0 are treated identically
   * and the price is undefined, never zero.
   */
  unitPrice: number | null;
  /** Fewer than twelve months is the norm in this extraction. */
  partialMonths: boolean;
};

export type ReconciliationStatus =
  | "reconciled"
  | "incomplete_data"
  | "discrepancy_found"
  | "nothing_to_reconcile"
  | "canonical_comparison_unavailable";

export type CanonicalTotals = {
  /** Rows actually found in canonical_fact for this org and period. */
  rowCount: number;
  costEur: number;
};

export type ReconciliationReport = {
  status: ReconciliationStatus;
  rows: { total: number; accepted: number; quarantined: number };
  amounts: {
    /** Summed cost of accepted rows: the reconciled total. */
    accepted: number;
    /** Summed cost held back. Never folded into the accepted total. */
    quarantined: number;
    /** The part of that awaiting a Region decision. */
    awaitingRegion: number;
  };
  quarantine: QuarantinedRow[];
  /** The file against its own declared total, when it declares one. */
  declared: { total: number; summed: number; difference: number; withinTolerance: boolean } | null;
  /** Against canonical_fact. Never a pass when there is nothing to compare. */
  canonical:
    | { available: false; reason: string }
    | { available: true; expected: number; difference: number; withinTolerance: boolean };
  notes: string[];
};

const DIGITS = /^\d{1,9}$/;
const ND_CODES = new Set(["ND", "nd", "N.D.", "n.d."]);
// A second, otherwise unused Teramo code. AGENTS.md question 3: whether it is in
// the perimeter is the Region's call, so the row is held rather than attributed.
const ORPHAN_ASL = "130106";

/**
 * Zero-pad an AIC to nine characters, or reject it.
 *
 * A key that is not digits, or longer than nine, is left unresolved rather than
 * trimmed into range: stripping the letters out of an ATC code yields a
 * real-looking but entirely wrong AIC, which is the failure AGENTS.md documents.
 */
export function normaliseAic(raw: string | null): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!DIGITS.test(trimmed)) return null;
  return trimmed.padStart(9, "0");
}

const sourceKey = (r: UploadRow) => `${r.aslCode?.trim() ?? ""}|${normaliseAic(r.aic) ?? r.aic ?? ""}|${r.manufacturer?.trim() ?? ""}`;

/**
 * Reconcile a supplied extraction.
 *
 * `canonical` is what the database actually holds for this organization and
 * period; pass null when it could not be read. An empty canonical set is NOT a
 * pass — a comparison against nothing always agrees — so it is reported as
 * unavailable.
 */
export function reconcileRows(
  rows: readonly UploadRow[],
  options: { declaredTotalCost?: number | null; canonical?: CanonicalTotals | null; toleranceEur?: number } = {},
): ReconciliationReport {
  const tolerance = options.toleranceEur ?? 0.01;
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error("Invalid reconciliation tolerance");
  if (options.declaredTotalCost != null && !Number.isFinite(options.declaredTotalCost)) throw new Error("Invalid declared total");
  if (options.canonical && (!Number.isSafeInteger(options.canonical.rowCount) || options.canonical.rowCount < 0 || !Number.isFinite(options.canonical.costEur))) throw new Error("Invalid canonical totals");
  // Invalid numbers must never silently contaminate totals or become a pass.
  for (const row of rows) {
    for (const value of [row.cost, row.quantity]) {
      if (value != null && !Number.isFinite(value)) throw new Error(`Row ${row.sourceRow}: non-finite amount`);
    }
  }
  const quarantine: QuarantinedRow[] = [];
  const accepted: AcceptedRow[] = [];
  const notes: string[] = [];

  const hold = (row: UploadRow, code: QuarantineCode, reason: string, awaitingRegion: boolean) =>
    quarantine.push({ sourceRow: row.sourceRow, code, reason, cost: row.cost, quantity: row.quantity, awaitingRegion });

  // Duplicates are counted first: being duplicated is a property of the set, not
  // of one row, so both copies have to be held.
  const keyCounts = new Map<string, number>();
  for (const row of rows) {
    const k = sourceKey(row);
    keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }

  for (const row of rows) {
    const asl = row.aslCode?.trim() ?? "";
    if (!asl) { hold(row, "asl_code_missing", "no ASL code on the row", false); continue; }
    if (ND_CODES.has(asl)) {
      hold(row, "nd_asl_unresolved", "ASL 'ND': what it is, and which Azienda it belongs to, is an open question for the Region", true);
      continue;
    }
    if (asl === ORPHAN_ASL) {
      hold(row, "orphan_asl_code_130106", "second, otherwise unused Teramo code: perimeter membership is an open question for the Region", true);
      continue;
    }

    const aicKey = normaliseAic(row.aic);
    if (!aicKey) {
      hold(row, "aic_not_nine_digits", `AIC ${JSON.stringify(row.aic)} is not a 1-9 digit key; left unresolved rather than coerced`, false);
      continue;
    }

    if ((row.quantity ?? 0) < 0 || (row.cost ?? 0) < 0) {
      hold(row, "negative_adjustment", "negative quantity or cost: the handling rule is undefined and is not invented here", true);
      continue;
    }

    if (row.cost != null && row.cost > 0 && row.quantity == null) {
      hold(row, "cost_without_quantity", "cost reported with no quantity cell", false);
      continue;
    }

    if ((keyCounts.get(sourceKey(row)) ?? 0) > 1) {
      hold(row, "duplicate_source_key", "repeated ASL/AIC/manufacturer key: which row is authoritative is undefined", true);
      continue;
    }

    const q = row.quantity;
    const unitPrice = q == null || q === 0 || row.cost == null ? null : row.cost / q;
    const months = row.months ?? null;
    accepted.push({ ...row, aicKey, unitPrice, partialMonths: months != null && months < 12 });
  }

  const sum = (list: readonly { cost: number | null }[]) => list.reduce((s, r) => s + (r.cost ?? 0), 0);
  const acceptedCost = sum(accepted);
  const quarantinedCost = sum(quarantine);
  const awaitingRegionCost = sum(quarantine.filter((q) => q.awaitingRegion));

  const partial = accepted.filter((r) => r.partialMonths).length;
  if (partial) notes.push(`${partial} accepted row(s) cover fewer than twelve months, which is normal for this extraction and is not treated as incomplete`);
  const undefinedPrice = accepted.filter((r) => r.unitPrice === null).length;
  if (undefinedPrice) notes.push(`${undefinedPrice} accepted row(s) have no unit price because the quantity is zero or absent; the price is undefined, not zero`);
  if (awaitingRegionCost > 0) notes.push(`EUR ${awaitingRegionCost.toFixed(2)} is held pending an answer from the Region and is excluded from the reconciled total`);

  const declared =
    options.declaredTotalCost == null
      ? null
      : {
          total: options.declaredTotalCost,
          summed: acceptedCost,
          difference: acceptedCost - options.declaredTotalCost,
          withinTolerance: Math.abs(acceptedCost - options.declaredTotalCost) <= tolerance,
        };

  let canonical: ReconciliationReport["canonical"];
  if (!options.canonical) {
    canonical = { available: false, reason: "canonical_fact could not be read for this organization and period" };
  } else if (options.canonical.rowCount === 0) {
    // The load-bearing case: comparing against an empty table always agrees, and
    // reporting that as reconciled would look exactly like a real pass.
    canonical = {
      available: false,
      reason: "canonical_fact holds no rows for this organization and period: there is nothing to compare against, and an empty comparison is not a pass",
    };
  } else {
    const difference = acceptedCost - options.canonical.costEur;
    canonical = { available: true, expected: options.canonical.costEur, difference, withinTolerance: Math.abs(difference) <= tolerance };
  }

  let status: ReconciliationStatus;
  if (!accepted.length) status = "nothing_to_reconcile";
  else if (accepted.some(row => row.cost == null)) {
    status = "incomplete_data";
    notes.push("Costi mancanti: il totale include soltanto gli importi riportati e non certifica una riconciliazione completa.");
  }
  else if ((declared && !declared.withinTolerance) || (canonical.available && !canonical.withinTolerance)) status = "discrepancy_found";
  else if (canonical.available) status = "reconciled";
  else if (declared) status = declared.withinTolerance ? "reconciled" : "discrepancy_found";
  else status = "canonical_comparison_unavailable";

  return {
    status,
    rows: { total: rows.length, accepted: accepted.length, quarantined: quarantine.length },
    amounts: { accepted: acceptedCost, quarantined: quarantinedCost, awaitingRegion: awaitingRegionCost },
    quarantine,
    declared,
    canonical,
    notes,
  };
}

/**
 * Render the report as the text stored on the upload row.
 *
 * States the quarantined amount in every outcome: a reconciled total that
 * silently excluded a million euro would read exactly like a clean one.
 */
export function summariseReconciliation(report: ReconciliationReport): string {
  const eur = (v: number) => `EUR ${v.toFixed(2)}`;
  const head: Record<ReconciliationStatus, string> = {
    reconciled: "Riconciliato",
    incomplete_data: "Dati incompleti",
    discrepancy_found: "Scostamento rilevato",
    nothing_to_reconcile: "Nessuna riga utilizzabile",
    canonical_comparison_unavailable: "Confronto canonico non disponibile",
  };
  const parts = [
    `${head[report.status]}.`,
    `${report.rows.accepted} righe accettate su ${report.rows.total} per ${eur(report.amounts.accepted)}.`,
  ];
  if (report.rows.quarantined) {
    parts.push(`${report.rows.quarantined} righe in quarantena per ${eur(report.amounts.quarantined)}, escluse dal totale.`);
  }
  if (!report.canonical.available) parts.push(report.canonical.reason);
  else if (!report.canonical.withinTolerance) parts.push(`Differenza rispetto ai dati canonici: ${eur(report.canonical.difference)}.`);
  if (report.declared && !report.declared.withinTolerance) parts.push(`Differenza rispetto al totale dichiarato: ${eur(report.declared.difference)}.`);
  return parts.concat(report.notes).join(" ");
}
