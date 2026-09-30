/** Ratios use each category's own supplied DDD, never an average of ratios. */
export function costPerSuppliedDdd(cost: number | null, ddd: number | null): number | null {
  return cost !== null && ddd !== null && Number.isFinite(cost) && Number.isFinite(ddd) && cost >= 0 && ddd > 0
    ? cost / ddd : null;
}
