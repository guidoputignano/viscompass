/** Browser-safe successor aggregates. Private source rows and identity keys are
 * intentionally not representable. This is not a membership or release grant. */
import type { CScopedAslUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";
import type { CPeriodMode, CPeriodSourceFamily } from "@/lib/dashboard-review/pillar-c/period-contract";

export const C_PERIOD_AGE_IDS = ["0-14", "15-24", "25-34", "35-44", "45-54", "55-64", "65-74", "75-84", "85+", "unknown"] as const;
export const C_PERIOD_USE_IDS = ["0", "1", "2", "3-5", "6-10", "11-20", "21+"] as const;
export type CPeriodMissingReason = "disclosure" | "missing-source" | "uncertified-empty" | "unsupported" | "missing-cost" | "signed-cost" | "no-recipients";
export type CPeriodUnavailable = Readonly<{ status: "withheld" | "unavailable"; reason: CPeriodMissingReason }>;
export type CPeriodReleasedCount = Readonly<{ status: "released"; value: number }> | CPeriodUnavailable;
export type CPeriodDistribution = Readonly<{
  status: "released"; total: number;
  cells: readonly Readonly<{ id: string; count: number; share: number }>[];
}> | CPeriodUnavailable;
export type CPeriodQuartiles = Readonly<{ status: "released"; n: number; q1: number; median: number; q3: number }> | CPeriodUnavailable;
export type CPeriodConcentration = Readonly<{ status: "released"; n: number; gini: number; lorenz: readonly number[] }> | CPeriodUnavailable;
export type CPeriodSummary = Readonly<{
  schema: "pillar-c-period-summary-v1";
  id: string;
  version: number;
  sourceFamily: CPeriodSourceFamily;
  unit: CScopedAslUnit;
  mode: CPeriodMode;
  window: Readonly<{
    from: string; to: string;
    timeBasis: "reporting-month" | "recorded-dispensing-month";
    ageReferenceYear: number;
    /** Certification is never inferred from the existence of source records. */
    certifiedComplete: boolean;
    months: readonly Readonly<{ month: string; status: "records" | "certified-zero" | "missing" | "uncertified-empty" }>[];
  }>;
  populationBasis: "eligible-recipients-within-unit" | "recorded-identifiers-within-unit";
  recipients: CPeriodReleasedCount;
  age: CPeriodDistribution;
  use: Readonly<{ packs: CPeriodDistribution; products: CPeriodDistribution; contacts: CPeriodDistribution }>;
  cost: Readonly<{ quartiles: CPeriodQuartiles; concentration: CPeriodConcentration }>;
}>;
