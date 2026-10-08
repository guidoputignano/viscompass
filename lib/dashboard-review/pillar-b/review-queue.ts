// The review queue: bridge B read per molecule, as questions.
//
// Bridge B (sheet 09) partitions the ledger into gates; a decision-maker
// needs one organisational review cohort and one evidence-verification
// cohort listed by molecule, with the euros each one rests on. They are
// populations of the value-uptake view:
//
//   after the local switch — reference spend in the months after the first
//     biosimilar of the substance was dispensed in the visible Aziende
//     (the sheet's B_ADDRESSABLE_REFERENCE, "NOT a saving");
//   not observed here — reference spend in date-valid months for substances
//     whose biosimilar was never dispensed in the visible Aziende in the
//     release (part of the sheet's B4). "Not observed in this release" is
//     not "never bought", and the EU authorisation says nothing about the
//     product's status in Italy: that evidence is a separate contract.
//
// PURE, and additive by construction: the first list sums to the bridge's
// B_ADDRESSABLE gate; the second list plus the pre-switch months of the
// substances that did switch sums to its B4 gate. Neither is a saving, a
// forecast or a prescribing instruction, and the labels say so.

import type { ValueUptakeView } from "./value-uptake";
import { BRIDGE_B_GATES } from "@/lib/dashboard-review/pillar-b/bridge-b";
import { formatEur } from "@/lib/dashboard-review/format";

export interface ReviewQueueRow {
  substance: string;
  /** The euros of the question: reference spend in the months the list names. */
  eur: number;
  /** "2024-03" for a switched substance, null for one never observed here. */
  firstLocalLabel: string | null;
  dateValidShare: number | null;
  locallyObservedShare: number | null;
}

export interface ReviewQueue {
  /** Substances with a local biosimilar and reference spend after its first use; by euros, descending. */
  afterLocalSwitch: ReviewQueueRow[];
  /** = bridge B_ADDRESSABLE_REFERENCE. */
  afterLocalSwitchTotal: number;
  /** Substances never observed as a biosimilar here, with date-valid reference spend; by euros, descending. */
  notObservedHere: ReviewQueueRow[];
  notObservedHereTotal: number;
  /** Date-valid reference spend of the switched substances in the months BEFORE their first local use. */
  beforeLocalSwitchTotal: number;
}

export function reviewQueue(view: ValueUptakeView): ReviewQueue {
  const row = (r: ValueUptakeView["rows"][number], eur: number): ReviewQueueRow => ({
    substance: r.substance, eur, firstLocalLabel: r.firstLocalLabel,
    dateValidShare: r.dateValid.share, locallyObservedShare: r.locallyObserved.share,
  });
  const switched = view.rows.filter((r) => r.firstLocalMonthKey !== null);
  const never = view.rows.filter((r) => r.firstLocalMonthKey === null);
  const afterLocalSwitch = switched
    .filter((r) => r.locallyObserved.reference !== 0)
    .map((r) => row(r, r.locallyObserved.reference))
    .sort((a, b) => b.eur - a.eur || a.substance.localeCompare(b.substance));
  const notObservedHere = never
    .filter((r) => r.dateValid.reference !== 0)
    .map((r) => row(r, r.dateValid.reference))
    .sort((a, b) => b.eur - a.eur || a.substance.localeCompare(b.substance));
  return {
    afterLocalSwitch,
    afterLocalSwitchTotal: afterLocalSwitch.reduce((s, r) => s + r.eur, 0),
    notObservedHere,
    notObservedHereTotal: notObservedHere.reduce((s, r) => s + r.eur, 0),
    beforeLocalSwitchTotal: switched.reduce((s, r) => s + (r.dateValid.reference - r.locallyObserved.reference), 0),
  };
}

/**
 * The footnote under the "not observed here" list, true for every sign of the
 * pre-switch reference total: the list equals the B4 gate only when that total
 * is zero to the cent; otherwise the total is added (or, when credit notes net
 * it below zero, subtracted) and named. The gate label comes from the bridge,
 * so the two cannot drift apart.
 */
const toCent = (v: number): number => {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? 0 : r;
};

export function notObservedFootnote(beforeLocalSwitchTotal: number): string {
  const label = BRIDGE_B_GATES.B4_eu_authorised_never_bought_here.label;
  const before = toCent(beforeLocalSwitchTotal);
  if (before === 0) return `Questa lista coincide con la soglia «${label}».`;
  if (before > 0) {
    return `Sommata ai ${formatEur(before)} di riferimento spesi dalle molecole già passate al biosimilare nei mesi validi prima del loro primo uso, questa lista coincide con la soglia «${label}».`;
  }
  // B4 = list + before, and before < 0: the gate is the list MINUS the
  // unsigned amount. The amount is named, so the sentence cannot be read as
  // subtracting a negative.
  return `Le molecole già passate al biosimilare hanno, nei mesi validi prima del loro primo uso, un saldo di riferimento negativo (rettifiche superiori alle dispensazioni): questa lista, meno ${formatEur(Math.abs(before))}, coincide con la soglia «${label}».`;
}

/** Whether the footnote says more than the intro: at zero both say "coincide". */
export function notObservedFootnoteAdds(beforeLocalSwitchTotal: number): boolean {
  return toCent(beforeLocalSwitchTotal) !== 0;
}

/**
 * The intro's sentence on how the second list relates to B4, on the SAME
 * rounding as the footnote, so the panel never calls the list "only part of
 * B4" where the footnote says it equals or exceeds it.
 */
export function notObservedIntro(beforeLocalSwitchTotal: number): string {
  const before = toCent(beforeLocalSwitchTotal);
  const label = `«${BRIDGE_B_GATES.B4_eu_authorised_never_bought_here.label}»`;
  if (before > 0) return `Questa lista è solo una parte della soglia ${label}: la soglia comprende anche la spesa prima del primo uso delle sostanze poi passate al biosimilare.`;
  if (before === 0) return `In questa selezione la lista coincide con la soglia ${label}: nessuna sostanza poi passata al biosimilare ha spesa di riferimento nei mesi validi prima del primo uso.`;
  return `In questa selezione la lista supera la soglia ${label}: le sostanze poi passate al biosimilare hanno, prima del primo uso, un saldo di riferimento negativo.`;
}

/** A net credit-note adjustment cannot be presented as a positive review case. */
export function reviewQueuePublishable(queue: ReviewQueue): boolean {
  return [...queue.afterLocalSwitch, ...queue.notObservedHere].every((row) => Number.isFinite(row.eur) && row.eur > 0);
}
