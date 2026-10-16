import { comparableQuantity } from "./biosimilar.ts";
import type { CanonicalFact } from "./types";

export type UnitCostIndex = { index: number | null; coverage: number | null };

/**
 * Unit cost of each Azienda against the cohort, for the SAME products.
 *
 * The release carries no pack counts, so a cost per pack cannot be formed; and a
 * cost per mg across products would compare the mix, not the price. Each gated
 * row instead has a quantity inside a comparability stratum (molecule, route,
 * form, unit). For every stratum dispensed by at least two Aziende the cohort
 * price is pooled, P_s = Σ spend ÷ Σ quantity over those Aziende. An Azienda's
 * index is then
 *
 *   Σ_s spend_{a,s} ÷ Σ_s quantity_{a,s} × P_s × 100
 *
 * over the strata it shares: what it spent on its own quantities, against what
 * those quantities cost at the cohort's price. 100 is the cohort's price for this
 * Azienda's own mix, so a difference is a price difference, never a mix one.
 * `coverage` is the share of the Azienda's spend inside those strata.
 *
 * Only rows with a positive quantity and positive spend enter (credit notes carry
 * no quantity to price), on the spend `spendOf` returns: the dispensed basis,
 * which alone is attributable per Azienda.
 */
export function unitCostIndexByOrg(
  groups: Map<string, CanonicalFact[]>,
  spendOf: (fact: CanonicalFact) => number | null,
): { byOrg: Map<string, UnitCostIndex>; sharedStrata: number } {
  const strata = new Map<string, Map<string, { spend: number; quantity: number }>>();
  const totalSpend = new Map<string, number>();
  for (const [org, facts] of groups) {
    for (const fact of facts) {
      const spend = spendOf(fact);
      if (spend === null || spend <= 0) continue;
      totalSpend.set(org, (totalSpend.get(org) ?? 0) + spend);
      const q = comparableQuantity(fact);
      if (q === null) continue;
      const byOrg = strata.get(q.stratum) ?? new Map<string, { spend: number; quantity: number }>();
      const cell = byOrg.get(org) ?? { spend: 0, quantity: 0 };
      cell.spend += spend;
      cell.quantity += q.quantity;
      byOrg.set(org, cell);
      strata.set(q.stratum, byOrg);
    }
  }
  const shared = [...strata.values()].filter((byOrg) => byOrg.size >= 2);
  const out = new Map<string, UnitCostIndex>();
  for (const org of groups.keys()) {
    let spent = 0, atCohortPrice = 0;
    for (const byOrg of shared) {
      const own = byOrg.get(org);
      if (!own) continue;
      let spend = 0, quantity = 0;
      for (const cell of byOrg.values()) { spend += cell.spend; quantity += cell.quantity; }
      spent += own.spend;
      atCohortPrice += own.quantity * (spend / quantity);
    }
    const total = totalSpend.get(org) ?? 0;
    out.set(org, {
      index: groups.size >= 2 && atCohortPrice > 0 ? (spent / atCohortPrice) * 100 : null,
      coverage: groups.size >= 2 && total > 0 && atCohortPrice > 0 ? spent / total : null,
    });
  }
  return { byOrg: out, sharedStrata: groups.size >= 2 ? shared.length : 0 };
}
