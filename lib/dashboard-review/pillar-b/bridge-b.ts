// Bridge B — the biosimilar opportunity population (workbook sheet 09).
//
// Every euro of the ledger leaves through exactly ONE gate, so the gates
// partition the total: outside the perimeter; already biosimilar; reference
// spend in months before any biosimilar of the substance was authorised;
// reference spend in a month the authorisation cut in half; reference spend
// in valid months before a biosimilar had been dispensed in the visible
// Aziende (or in every valid month, when it never was); and the reference
// spend in the months after that first local dispensing (T2).
//
// PURE. Every gate is a sum or a difference of the value-uptake view's own
// measures (lib/dashboard-review/pillar-b/value-uptake.ts), which the evidence
// harnesses reconcile to the frozen workbook; the ledger total comes from the
// facets totals of the same filters. The one quantity formed here that is not
// in the view, B0, is the total minus the perimeter — and the perimeter is
// cross-checked, on every request, against the perimeter-status facet of a
// different database function (`bridgeBPerimeterCheck`), cent-exact. A
// mismatch is shown, never smoothed over.
//
// WHAT IS NOT HERE. No share of the perimeter: biosimilar spend over
// biosimilar-plus-reference spend by status is the third adoption denominator
// the project forbids (the Evidenza section withholds it for the same reason).
// Only shares of the ledger total are formed, as on the sheet.
//
// WHAT THE LAST GATE IS NOT. B_ADDRESSABLE_REFERENCE is reference spend in
// months after a biosimilar had been dispensed locally. The workbook labels it
// "NOT a saving" and so does every label here: it is a population, not money
// recoverable, and no price assumption is applied to it.

import type { ValueUptakeView } from "./value-uptake";
import type { FacetPerimeter } from "./facets";

export const BRIDGE_B_GATE_IDS = [
  "B0_outside_perimeter",
  "B_BIOSIMILAR_SPEND",
  "B1_before_status_valid",
  "B2_boundary_month_unsplittable",
  "B3_date_unknown",
  "B4_eu_authorised_never_bought_here",
  "B_ADDRESSABLE_REFERENCE",
] as const;
export type BridgeBGateId = (typeof BRIDGE_B_GATE_IDS)[number];

export type BridgeBKind = "outside" | "biosimilar" | "reference";

export const BRIDGE_B_GATES: Record<BridgeBGateId, { label: string; meaning: string; kind: BridgeBKind }> = {
  B0_outside_perimeter: {
    label: "Fuori dal perimetro",
    meaning: "Né un biosimilare né un medicinale di riferimento nominato in un EPAR.",
    kind: "outside",
  },
  B_BIOSIMILAR_SPEND: {
    label: "Spesa già biosimilare",
    meaning: "Spesa classificata: denaro già speso in biosimilari, in qualunque mese.",
    kind: "biosimilar",
  },
  B1_before_status_valid: {
    label: "Prima della validità dello stato",
    meaning: "Il mese precede la prima autorizzazione EU di un biosimilare della sostanza: nessuna alternativa esisteva ancora.",
    kind: "reference",
  },
  B2_boundary_month_unsplittable: {
    label: "Mese di confine, non divisibile",
    meaning: "L'autorizzazione cade a metà mese; i totali mensili non si possono dividere.",
    kind: "reference",
  },
  B3_date_unknown: {
    label: "Data di validità non disponibile",
    meaning: "Riferimento senza data di validità nelle fonti: non assegnabile a nessuna delle altre soglie.",
    kind: "reference",
  },
  B4_eu_authorised_never_bought_here: {
    label: "EU-autorizzato, non ancora acquistato qui",
    meaning: "Riferimento nei mesi validi prima della prima dispensazione locale di un biosimilare della sostanza nelle Aziende visibili, o in tutti i mesi validi se non è mai avvenuta.",
    kind: "reference",
  },
  B_ADDRESSABLE_REFERENCE: {
    label: "Riferimento sostituibile localmente",
    meaning: "Riferimento nei mesi in cui un biosimilare della sostanza era già stato dispensato nelle Aziende visibili, in qualunque canale. NON è un risparmio.",
    kind: "reference",
  },
};

export interface BridgeBGate {
  id: BridgeBGateId;
  label: string;
  meaning: string;
  kind: BridgeBKind;
  eur: number;
  /** Of the ledger total, as on the sheet; null when the total is zero: a share of nothing is not 0 %. */
  shareOfTotal: number | null;
}

export interface BridgeB {
  total: number;
  /** Biosimilar + reference spend, every validity class. */
  perimeter: number;
  biosimilar: number;
  reference: number;
  /**
   * In narrative order. The six named gates are always present, zero euro
   * included; B3 appears when the undated class holds a euro, positive or
   * negative, on either side of the perimeter.
   */
  gates: BridgeBGate[];
  /** total − sum of gates, to the cent. Zero by construction; printed so a reader can see it. */
  residual: number;
}

// Rounds to the cent and normalises -0 to 0: a float drift of −5e-17 rounds
// to negative zero, which the formatter would print as "-0 €".
const round2 = (v: number): number => {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? 0 : r;
};

/**
 * The bridge for one scope. `ledgerTotal` is the reported spend of the SAME
 * filters and years as the view (the facets totals), never a wider or a
 * narrower one.
 */
export function bridgeB(view: ValueUptakeView, ledgerTotal: number): BridgeB {
  const biosimilar = view.dateValid.biosimilar + view.boundary.biosimilar + view.outside.biosimilar + view.unknown.biosimilar;
  const reference = view.dateValid.reference + view.boundary.reference + view.outside.reference + view.unknown.reference;
  const perimeter = biosimilar + reference;
  // Date-valid reference contains the locally observed window (the window is a
  // subset of the valid months), so the difference is the reference spend in
  // valid months before the scope's first local biosimilar dispensing — all of
  // them, for a substance never dispensed as a biosimilar here.
  const notYetLocal = view.dateValid.reference - view.locallyObserved.reference;
  // The unknown class is shown as soon as it holds a euro on either side, so a
  // scope whose undated reference nets to zero but whose undated biosimilar
  // does not still shows the line at 0 €. A class whose euros ALL net to zero
  // is not detectable from the function's columns (its undated_rows count also
  // includes the evidence-listed predates rows); that case stays undetected
  // until the function returns a row count for the unknown class.
  const showUnknown = view.unknown.reference !== 0 || view.unknown.biosimilar !== 0;
  const raw: Array<[BridgeBGateId, number]> = [
    ["B0_outside_perimeter", ledgerTotal - perimeter],
    ["B_BIOSIMILAR_SPEND", biosimilar],
    ["B1_before_status_valid", view.outside.reference],
    ["B2_boundary_month_unsplittable", view.boundary.reference],
    ["B3_date_unknown", view.unknown.reference],
    ["B4_eu_authorised_never_bought_here", notYetLocal],
    ["B_ADDRESSABLE_REFERENCE", view.locallyObserved.reference],
  ];
  const gates: BridgeBGate[] = raw
    .filter(([id]) => id !== "B3_date_unknown" || showUnknown)
    .map(([id, eur]) => ({ id, ...BRIDGE_B_GATES[id], eur, shareOfTotal: ledgerTotal === 0 ? null : eur / ledgerTotal }));
  const residual = round2(ledgerTotal - gates.reduce((s, g) => s + g.eur, 0));
  return { total: ledgerTotal, perimeter, biosimilar, reference, gates, residual };
}

export interface BridgeBPerimeterCheck {
  /** Biosimilar + reference-medicine spend from the perimeter-status facet. */
  facetsPerimeter: number;
  /** bridge.perimeter − facetsPerimeter, to the cent. */
  difference: number;
  /** True only when the two readings agree to the cent, in either direction. */
  consistent: boolean;
}

/**
 * The perimeter two ways: the value-uptake function's ten validity columns,
 * and the perimeter-status facet of pillar_b_facets. Both are sums over the
 * rows whose status is biosimilar or reference_medicine under the same
 * filters, so they must agree to the cent; any larger difference is a
 * definition drift between the two functions and is reported, not absorbed.
 * Not a check on a single function against itself.
 */
export function bridgeBPerimeterCheck(bridge: BridgeB, perimeter: ReadonlyArray<FacetPerimeter>): BridgeBPerimeterCheck {
  const facetsPerimeter = perimeter
    .filter((p) => p.perimeter_status === "biosimilar" || p.perimeter_status === "reference_medicine")
    .reduce((s, p) => s + (p.spend_eur ?? 0), 0);
  const difference = round2(bridge.perimeter - facetsPerimeter);
  return { facetsPerimeter, difference, consistent: difference === 0 };
}
