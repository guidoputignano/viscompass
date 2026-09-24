import type { ReconciliationReport, ReconciliationStatus } from "@/lib/uploads/reconcile";

// Reads uploads.reconciliation_summary for display.
//
// The column is jsonb: it holds whatever a past release wrote, and rows written
// before a shape change are not migrated. So every field is read defensively and
// an unreadable summary degrades to "unknown" — never to a pass. This is the
// whole point of the module: `status` alone cannot be trusted to describe the
// outcome, because three of the reconciler's five outcomes map back onto
// 'uploaded' (see lib/uploads/process-upload.ts). A file that could not be
// reconciled would otherwise render as "Caricato", which reads as fine.

export type SummaryTone = "neutral" | "warning" | "positive" | "danger";

/** Quarantine folded to one line per reason: 77 individual rows are noise. */
export type QuarantineGroup = {
  code: string;
  /** The first reason recorded under this code — the codes are templated, so
   *  this names the actual cause without a second translation table to drift. */
  reason: string;
  rows: number;
  cost: number;
  awaitingRegion: boolean;
};

export type ReconciliationView =
  | { kind: "none" }
  | { kind: "failed"; label: string; tone: SummaryTone; message: string; at: string | null }
  | {
      kind: "report";
      label: string;
      tone: SummaryTone;
      /** null when the stored outcome is not one this release knows. */
      outcome: ReconciliationStatus | null;
      message: string;
      rows: { total: number; accepted: number; quarantined: number } | null;
      amounts: ReconciliationReport["amounts"] | null;
      canonical: ReconciliationReport["canonical"] | null;
      declared: ReconciliationReport["declared"];
      notes: string[];
      quarantine: QuarantineGroup[];
      /** The group header the basis assertion passed on: provenance for the figures. */
      basis: string | null;
      at: string | null;
    };

const OUTCOME: Record<ReconciliationStatus, { label: string; tone: SummaryTone }> = {
  reconciled: { label: "Riconciliato", tone: "positive" },
  discrepancy_found: { label: "Scarto rilevato", tone: "danger" },
  incomplete_data: { label: "Dati incompleti", tone: "warning" },
  nothing_to_reconcile: { label: "Nessuna riga utilizzabile", tone: "warning" },
  canonical_comparison_unavailable: { label: "Confronto canonico non disponibile", tone: "neutral" },
};

const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
/** Non-finite is absent, not zero: a NaN rendered as 0 would understate a total. */
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function counts(v: unknown) {
  const o = obj(v);
  if (!o) return null;
  const total = num(o.total), accepted = num(o.accepted), quarantined = num(o.quarantined);
  return total === null || accepted === null || quarantined === null
    ? null
    : { total, accepted, quarantined };
}

function amounts(v: unknown): ReconciliationReport["amounts"] | null {
  const o = obj(v);
  if (!o) return null;
  const accepted = num(o.accepted), quarantined = num(o.quarantined), awaitingRegion = num(o.awaitingRegion);
  return accepted === null || quarantined === null || awaitingRegion === null
    ? null
    : { accepted, quarantined, awaitingRegion };
}

function canonical(v: unknown): ReconciliationReport["canonical"] | null {
  const o = obj(v);
  if (!o) return null;
  // Only an explicit `available: true` is a comparison. Anything else — absent,
  // malformed, a truthy string — is treated as no comparison, because a missing
  // comparison must never read as one that passed.
  if (o.available !== true) {
    return { available: false, reason: str(o.reason) ?? "Confronto canonico non disponibile." };
  }
  const expected = num(o.expected), difference = num(o.difference);
  if (expected === null || difference === null) {
    return { available: false, reason: "Confronto canonico illeggibile." };
  }
  return { available: true, expected, difference, withinTolerance: o.withinTolerance === true };
}

function declared(v: unknown): ReconciliationReport["declared"] {
  const o = obj(v);
  if (!o) return null;
  const total = num(o.total), summed = num(o.summed), difference = num(o.difference);
  if (total === null || summed === null || difference === null) return null;
  return { total, summed, difference, withinTolerance: o.withinTolerance === true };
}

function quarantine(v: unknown): QuarantineGroup[] {
  const groups = new Map<string, QuarantineGroup>();
  for (const entry of arr(v)) {
    const o = obj(entry);
    if (!o) continue;
    const code = str(o.code) ?? "sconosciuto";
    const g = groups.get(code) ?? {
      code,
      reason: str(o.reason) ?? code,
      rows: 0,
      cost: 0,
      awaitingRegion: false,
    };
    g.rows += 1;
    g.cost += num(o.cost) ?? 0;
    // Sticky: if any row under this code awaits the Region, the group does.
    g.awaitingRegion = g.awaitingRegion || o.awaitingRegion === true;
    groups.set(code, g);
  }
  // Largest amount held first — that is the order someone resolving them wants.
  return [...groups.values()].sort((a, b) => b.cost - a.cost);
}

export function readReconciliationSummary(raw: Record<string, unknown> | null | undefined): ReconciliationView {
  const o = obj(raw);
  if (!o) return { kind: "none" };
  const at = str(o.at);

  if (o.ok === false) {
    return {
      kind: "failed",
      label: "Elaborazione non riuscita",
      tone: "danger",
      message: str(o.message) ?? "La riconciliazione non è stata completata.",
      at,
    };
  }

  const stored = str(o.outcome);
  const known = stored !== null && stored in OUTCOME ? (stored as ReconciliationStatus) : null;
  const badge = known
    ? OUTCOME[known]
    : { label: "Esito non riconosciuto", tone: "warning" as SummaryTone };

  return {
    kind: "report",
    label: badge.label,
    tone: badge.tone,
    outcome: known,
    message: str(o.message) ?? badge.label,
    rows: counts(o.rows),
    amounts: amounts(o.amounts),
    canonical: canonical(o.canonical),
    declared: declared(o.declared),
    notes: arr(o.notes).map(str).filter((s): s is string => s !== null),
    quarantine: quarantine(o.quarantine),
    basis: str(obj(o.source)?.basisHeader),
    at,
  };
}
