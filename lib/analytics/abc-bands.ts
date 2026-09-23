// The single ABC banding rule for the whole product.
//
// The convention is the private workbook's, which bands on the cumulative share
// of the items ranked BEFORE the item, not including it:
//
//   Prodotti!O6  =IF(ISNUMBER(N6),IF(N6<0.8,"A",IF(N6<0.95,"B","C")),"")
//
// where N6 is the preceding cumulative share. The item that carries the running
// total across 80% therefore belongs to band A, because everything ranked ahead
// of it was still below the threshold. Banding on the inclusive share instead
// pushes that crossing item into B and makes the two artifacts disagree about
// the same product, which is why this rule lives in one place.
export type AbcBand = "A" | "B" | "C";

export type AbcItem<T> = T & {
  share: number;
  /** Cumulative share of every item ranked ahead of this one. Drives the band. */
  precedingShare: number;
  /** Cumulative share including this item. For display only. */
  cumulativeShare: number;
  band: AbcBand;
};

export const ABC_THRESHOLDS = { a: 0.8, b: 0.95 } as const;

export function bandOf(precedingShare: number): AbcBand {
  if (precedingShare < ABC_THRESHOLDS.a) return "A";
  if (precedingShare < ABC_THRESHOLDS.b) return "B";
  return "C";
}

/**
 * Rank `items` by `value` descending and assign ABC bands.
 *
 * `tieBreak` keeps the ordering deterministic when two items carry the same
 * value: without it the band of a tied pair would depend on input order, and
 * the workbook and the web app could disagree about identical data.
 */
export function assignAbcBands<T>(
  items: readonly T[],
  value: (item: T) => number,
  tieBreak: (item: T) => string,
): AbcItem<T>[] {
  const ranked = items
    .filter((item) => value(item) > 0)
    .slice()
    .sort((a, b) => value(b) - value(a) || tieBreak(a).localeCompare(tieBreak(b)));

  const total = ranked.reduce((sum, item) => sum + value(item), 0);
  if (total <= 0) return [];

  let preceding = 0;
  return ranked.map((item) => {
    const share = value(item) / total;
    const precedingShare = preceding;
    preceding += share;
    return { ...item, share, precedingShare, cumulativeShare: preceding, band: bandOf(precedingShare) };
  });
}
