/** Browser-safe discovery contract. A catalogue describes only datasets already
 * admitted to the caller's server-side view; it never grants access to a unit.
 * Legacy summaries do not certify source completeness, even with 12 months. */
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

export const C_PERIOD_CAPABILITIES = [
  "recipient-count", "recipient-age", "recipient-sex", "expenditure-distribution",
  "utilization-packs", "utilization-prescriptions", "utilization-products", "utilization-atc5",
  "portfolio-summary", "attribution-summary", "distribution-services", "product-unit-costs",
  "reported-amount", "identifier-count", "monthly-series", "product-change-bridge",
  "contact-distribution", "active-months-distribution",
] as const;
export type CPeriodCapability = typeof C_PERIOD_CAPABILITIES[number];
export type CPeriodSourceFamily = "nsis-dpc" | "file-f";
export type CPeriodMode = "real" | "synthetic";
export type CPeriodPopulationBasis = "eligible-recipients-within-unit" | "sum-within-unit-eligible-recipients" | "recorded-identifiers-within-unit";

export type CPeriodEntry = Readonly<{
  id: string;
  sourceFamily: CPeriodSourceFamily;
  unit: CScopedUnit;
  label: string;
  granularity: "month" | "year";
  windowFrom: string;
  windowTo: string;
  /** DPC is the submission's reference month (which can include earlier
   * dispensing); File F uses its recorded dispensing month/year. */
  timeBasis: "reporting-month" | "recorded-dispensing-month" | "recorded-dispensing-year";
  populationBasis: CPeriodPopulationBasis;
  observedMonths: readonly string[];
  certifiedComplete: false;
  capabilities: readonly CPeriodCapability[];
}>;

export type CPeriodCatalog = Readonly<{
  schema: "pillar-c-period-catalog-v1";
  mode: CPeriodMode;
  entries: readonly CPeriodEntry[];
}>;

/** All identity fields must match. A request cannot silently select a different
 * organization, source, year or grain. No role or email is accepted here. */
export type CPeriodSelection = Readonly<{
  datasetId: string;
  sourceFamily: CPeriodSourceFamily;
  unit: CScopedUnit;
  windowFrom: string;
  windowTo: string;
  capability: CPeriodCapability;
}>;
