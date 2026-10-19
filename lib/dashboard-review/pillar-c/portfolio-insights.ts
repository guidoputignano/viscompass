import { cAttrAtoms, cAttrSum } from "@/lib/dashboard-review/pillar-c/attribution";
import type { CPortfolioView } from "@/lib/dashboard-review/pillar-c/portfolio";

export function cPortfolioDirection(view: CPortfolioView) {
  const earlier = view.scope.period === view.changePeriods.from ? view.dossier : view.comparison?.dossier;
  const later = view.scope.period === view.changePeriods.to ? view.dossier : view.comparison?.dossier;
  return { earlier, later };
}

/** Contributions describe accounting change within this proxy portfolio, never causality. */
export function cPortfolioDrivers(view: CPortfolioView) {
  const groups = ["continuing", "entry", "exit"] as const;
  const components = groups.map(kind => ({ kind, value: view.change === null ? null : cAttrSum(view.productChanges.filter(r => r.kind === kind).map(r => r.delta)) }));
  if (view.change !== null && cAttrSum(components.map(r => r.value!)) !== view.change) throw Error("C_PORTFOLIO_DRIVERS");
  const largestIncrease = view.productChanges.find(r => cAttrAtoms(r.delta) > BigInt(0)) ?? null;
  const largestDecrease = view.productChanges.find(r => cAttrAtoms(r.delta) < BigInt(0)) ?? null;
  const { earlier } = cPortfolioDirection(view);
  const relativeChange = view.change !== null && earlier && cAttrAtoms(earlier.fixed.net) > BigInt(0) ? Number(view.change) / Number(earlier.fixed.net) : null;
  return { components, largestIncrease, largestDecrease, relativeChange };
}

/** User assumption on the single-portfolio component only. No forecast or approved budget is inferred. */
export function cPortfolioPlanning(view: CPortfolioView, basisPoints: number) {
  if (!Number.isInteger(basisPoints) || basisPoints < -5000 || basisPoints > 10000) throw Error("C_PORTFOLIO_ASSUMPTION");
  if (view.dossier.fixed.n === 0) return null;
  const fixed = cAttrAtoms(view.dossier.fixed.net), numerator = fixed * BigInt(10000 + basisPoints);
  // Finite basis-point multiplication is exact at scale 10^-25, including display ties.
  const scaled = (value:bigint) => { const neg=value<BigInt(0),v=neg?-value:value,scale=BigInt(10)**BigInt(25),fraction=(v%scale).toString().padStart(25,'0').replace(/0+$/,'');return `${neg?'-':''}${v/scale}${fraction?`.${fraction}`:''}`; };
  const delta = numerator - fixed*BigInt(10000);
  return {
    mode: "user-assumption" as const, basisPoints, fixed: scaled(numerator), change: scaled(delta),
    lower: scaled(numerator + cAttrAtoms(view.dossier.shared.negative)*BigInt(10000)),
    upper: scaled(numerator + cAttrAtoms(view.dossier.shared.positive)*BigInt(10000)),
  };
}
