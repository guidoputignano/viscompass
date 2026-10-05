// The review queue: bridge B read per molecule, as questions.
//
// Bridge B (sheet 09) partitions the ledger into gates; a decision-maker
// needs the gates that can be acted on listed by molecule, with the euros
// and the evidence each one rests on. Two of the gates are per-molecule
// populations of the value-uptake view and are listed here:
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
