import { cAttrAtoms, cAttrDecimal, cAttrSum } from "@/lib/dashboard-review/pillar-c/attribution";
import { cPortfolioDirection, cPortfolioDrivers } from "@/lib/dashboard-review/pillar-c/portfolio-insights";
import type { CPortfolioProductChange, CPortfolioView } from "@/lib/dashboard-review/pillar-c/portfolio";

const kinds = ["continuing", "entry", "exit"] as const;
type Kind = typeof kinds[number];
const magnitude = (v: bigint) => v < BigInt(0) ? -v : v;
const identity = (r: CPortfolioProductChange) => JSON.stringify([r.key, r.atc]);

/** Accounting explanation of the fixed portfolio component, not an inferred clinical cause. */
export function cPortfolioExplanation(view: CPortfolioView) {
  const { earlier, later } = cPortfolioDirection(view);
  // Reuse the strict whole-bridge check; sorting below never mutates its source.
  cPortfolioDrivers(view);
  const available = view.change !== null;
  const rank = (rows: CPortfolioProductChange[]) => [...rows].sort((a, b) => {
    const diff = magnitude(cAttrAtoms(b.delta)) - magnitude(cAttrAtoms(a.delta));
    return diff > BigInt(0) ? 1 : diff < BigInt(0) ? -1 : identity(a).localeCompare(identity(b));
  });
  const rises = rank(view.productChanges.filter(r => cAttrAtoms(r.delta) > BigInt(0)));
  const falls = rank(view.productChanges.filter(r => cAttrAtoms(r.delta) < BigInt(0)));
  const positive = available ? cAttrSum(rises.map(r => r.delta)) : null;
  const negative = available ? cAttrSum(falls.map(r => r.delta)) : null;
  const components = kinds.map(kind => {
    const rows = view.productChanges.filter(r => r.kind === kind);
    return { kind, count: rows.length, value: available ? cAttrSum(rows.map(r => r.delta)) : null };
  });
  if (available && cAttrSum([positive!, negative!]) !== view.change) throw Error("C_PORTFOLIO_EXPLANATION");
  const componentOrder = [...components].sort((a,b) => {
    const diff = magnitude(cAttrAtoms(b.value ?? "0")) - magnitude(cAttrAtoms(a.value ?? "0"));
    return diff > BigInt(0) ? 1 : diff < BigInt(0) ? -1 : kinds.indexOf(a.kind) - kinds.indexOf(b.kind);
  });
  const dominant = available && cAttrAtoms(componentOrder[0].value!) !== BigInt(0) ? componentOrder[0] : null;
  return {
    state: available ? "available" as const : "unavailable" as const,
    direction: view.change === null ? null : cAttrAtoms(view.change) > BigInt(0) ? "increase" as const : cAttrAtoms(view.change) < BigInt(0) ? "decrease" as const : "unchanged" as const,
    opening: earlier?.fixed.n ? earlier.fixed.net : null,
    closing: later?.fixed.n ? later.fixed.net : null,
    net: view.change, positive, negative, components, dominant,
    increases: { count: rises.length, top: rises.slice(0,3), remainder: available ? cAttrSum(rises.slice(3).map(r => r.delta)) : null },
    decreases: { count: falls.length, top: falls.slice(0,3), remainder: available ? cAttrSum(falls.slice(3).map(r => r.delta)) : null },
    unchangedProducts: view.productChanges.filter(r => cAttrAtoms(r.delta) === BigInt(0)).length,
    hasOffsets: positive !== null && negative !== null && cAttrAtoms(positive) > BigInt(0) && cAttrAtoms(negative) < BigInt(0),
  };
}

export const C_CHANGE_KIND_LABELS: Record<Kind, string> = {
  continuing: "Prodotti presenti nei due periodi",
  entry: "Prodotti entrati nel portafoglio",
  exit: "Prodotti usciti dal portafoglio",
};

/** Finite exact coordinate values: presentation only, never used to calculate money. */
export function cPortfolioExplanationSteps(view: CPortfolioView) {
  const explanation = cPortfolioExplanation(view);
  if (explanation.state !== "available") return [];
  let level = BigInt(0);
  return explanation.components.map(c => {
    const from = level; level += cAttrAtoms(c.value!);
    return { ...c, from: cAttrDecimal(from), to: cAttrDecimal(level) };
  });
}
