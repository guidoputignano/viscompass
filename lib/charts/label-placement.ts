// Deterministic collision avoidance for point labels in hand-drawn SVG charts.
//
// The problem it solves: labelling every point at a fixed offset produces
// unreadable overlap wherever points cluster. In the deviation plot the
// trajectories converge near the origin — which is where the reference sits by
// construction — so the year labels printed over each other as "20242024".
//
// Each label takes the FIRST candidate offset whose box does not overlap one
// already placed. If none is free the label is dropped rather than drawn on top
// of another: an unreadable label is worse than an absent one, and the caller is
// expected to carry the full values in an adjacent table.
//
// Placement is a pure function of the input in the given order, with a fixed
// candidate list and no randomness or measurement. Server and browser therefore
// produce byte-identical SVG — anything probabilistic here would be a hydration
// mismatch, which is the failure mode this codebase has already been bitten by.

/** Candidate offsets from the anchor point, tried in this order. */
export const LABEL_OFFSETS: readonly (readonly [number, number])[] = [
  [9, -9],
  [9, 15],
  [-9, -9],
  [-9, 15],
  [0, -15],
  [0, 22],
];

/** Approximate advance width per character at fontSize 11, and the line box. */
const CHAR_WIDTH = 6.2;
const LINE_HEIGHT = 12;

export type LabelInput = { text: string; cx: number; cy: number };
export type PlacedLabel = {
  text: string;
  lx: number;
  ly: number;
  anchor: "start" | "middle" | "end";
};

type Box = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function boxFor(text: string, lx: number, ly: number, anchor: PlacedLabel["anchor"]): Box {
  const w = text.length * CHAR_WIDTH;
  const x0 = anchor === "end" ? lx - w : anchor === "middle" ? lx - w / 2 : lx;
  return { x0, y0: ly - LINE_HEIGHT, x1: x0 + w, y1: ly };
}

/**
 * Place as many labels as fit without overlap, in input order.
 *
 * Earlier items win, so order the input by whatever should be labelled first.
 * Returns only the labels that found room; the result may be shorter than the
 * input, and the caller must not assume a one-to-one mapping.
 */
export function placeLabels(items: readonly LabelInput[]): PlacedLabel[] {
  const taken: Box[] = [];
  const placed: PlacedLabel[] = [];
  for (const item of items) {
    for (const [dx, dy] of LABEL_OFFSETS) {
      const anchor: PlacedLabel["anchor"] = dx < 0 ? "end" : dx > 0 ? "start" : "middle";
      const lx = item.cx + dx;
      const ly = item.cy + dy;
      const box = boxFor(item.text, lx, ly, anchor);
      if (taken.some((b) => overlaps(box, b))) continue;
      taken.push(box);
      placed.push({ text: item.text, lx, ly, anchor });
      break;
    }
  }
  return placed;
}

/** Exposed so tests can assert the no-overlap property on the real geometry. */
export function labelBox(l: PlacedLabel): Box {
  return boxFor(l.text, l.lx, l.ly, l.anchor);
}
