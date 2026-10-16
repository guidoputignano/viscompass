import { comparableMassMg } from "./biosimilar.ts";
import type { CanonicalFact } from "./types";

/**
 * A record is "irrisolto" when it cannot enter a normalised €/mg or €/DDD
 * comparison: it carries neither a per-unit cost nor a gated normalised mass (see
 * `comparableMassMg`), or its quality status says it is
 * unresolved. This is the same test `normalizationCoverage` applies, so the
 * «Irrisolti» count and the «Copertura normalizzata» share always describe the
 * same records.
 *
 * It deliberately does NOT read `mapping_confidence`. That column is the ATC
 * mapping confidence; counting it here made the normalisation signal follow the
 * ATC join instead of the normalisation, so classifying a product would have
 * reported it as normalised.
 */
export function isUnresolvedRecord(fact: CanonicalFact): boolean {
  if (fact.quality_status?.toLowerCase().includes("unresolved") === true) return true;
  if (comparableMassMg(fact) !== null) return false;
  // `?? null`: a column absent from an older row reads as missing, never as a cost.
  return (fact.cost_per_mg ?? null) === null && (fact.cost_per_ddd ?? null) === null;
}
