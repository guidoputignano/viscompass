/**
 * Public inpatient-activity proxy for Pillar A.
 *
 * The workbook's A2 denominator ("DEGENZA + ACCESSI - ESCLUDI ONERE "4" E DRG
 * 391") is not published by any public source at record level. This module
 * holds the vocabulary, parsing rules, and fail-closed comparison logic used
 * to place public Ministry/SDO activity next to trusted A2 values without
 * ever presenting the public figure as A2 itself.
 */

export const PUBLIC_ACTIVITY_PROXY_LABEL = "public_inpatient_activity_proxy" as const;

export const A2_SELECTOR_DESCRIPTION_VERBATIM =
  'DEGENZA + ACCESSI - ESCLUDI ONERE "4" E DRG 391' as const;

const RESERVED_EXACT_DENOMINATOR_LABELS = new Set([
  "a2",
  "a2_activity",
  "activity_a2",
  "a2_exact",
  "a2_proxy",
]);

export function isReservedExactDenominatorLabel(label: string): boolean {
  return RESERVED_EXACT_DENOMINATOR_LABELS.has(label.trim().toLowerCase());
}

export type ProxyGrain = "national" | "region" | "azienda" | "facility";

export type ProxyStatus =
  | "observed_public"
  | "derived_aggregate"
  | "capacity_not_activity"
  | "suppressed"
  | "unavailable";

export type ConfidenceStatus =
  | "VERIFIED-SOURCE"
  | "DERIVED"
  | "PROXY-CANDIDATE"
  | "INFERRED"
  | "SUPPRESSED"
  | "UNAVAILABLE";

export type ParsedNumber =
  | { status: "value"; value: number }
  | { status: "suppressed"; raw: string }
  | { status: "blank"; raw: string }
  | { status: "invalid"; raw: string };

/**
 * Parses Ministry open-data numerics. Italian locale is assumed: "." is a
 * thousands separator and "," is the decimal mark. "***" is the Ministry's
 * privacy suppression token and must stay suppressed, never zero.
 */
export function parseItalianNumber(
  raw: string | number | null | undefined,
): ParsedNumber {
  if (raw === null || raw === undefined) return { status: "blank", raw: "" };
  if (typeof raw === "number") {
    return Number.isFinite(raw)
      ? { status: "value", value: raw }
      : { status: "invalid", raw: String(raw) };
  }
  const text = raw.trim();
  if (text === "" || text === "-") return { status: "blank", raw: text };
  if (/^\*+$/.test(text)) return { status: "suppressed", raw: text };
  const normalized = text.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return { status: "invalid", raw: text };
  const value = Number(normalized);
  return Number.isFinite(value)
    ? { status: "value", value }
    : { status: "invalid", raw: text };
}

export interface RegionRegistryEntry {
  code: string;
  name: string;
}

const REGION_NAME_ALIASES: Record<string, string> = {
  PABOLZANO: "PROVAUTONBOLZANO",
  PADIBOLZANO: "PROVAUTONBOLZANO",
  PROVINCIAAUTONOMADIBOLZANO: "PROVAUTONBOLZANO",
  BOLZANO: "PROVAUTONBOLZANO",
  PATRENTO: "PROVAUTONTRENTO",
  PADITRENTO: "PROVAUTONTRENTO",
  PROVINCIAAUTONOMADITRENTO: "PROVAUTONTRENTO",
  TRENTO: "PROVAUTONTRENTO",
};

export function normalizeRegionName(name: string): string {
  const stripped = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return REGION_NAME_ALIASES[stripped] ?? stripped;
}

export type RegionResolution =
  | { status: "matched"; code: string; registryName: string }
  | { status: "unmatched"; normalized: string }
  | { status: "ambiguous"; normalized: string; codes: string[] };

export function resolveRegionCode(
  name: string,
  registry: RegionRegistryEntry[],
): RegionResolution {
  const normalized = normalizeRegionName(name);
  const matches = registry.filter(
    (entry) => normalizeRegionName(entry.name) === normalized,
  );
  const codes = [...new Set(matches.map((entry) => entry.code))];
  if (codes.length === 1) {
    return { status: "matched", code: codes[0], registryName: matches[0].name };
  }
  if (codes.length > 1) return { status: "ambiguous", normalized, codes };
  return { status: "unmatched", normalized };
}

export interface ActivityObservationRef {
  label: string;
  year: number;
  grain: ProxyGrain;
  regionCode: string | null;
  aziendaCode: string | null;
  value: number | null;
}

export interface ProxyComparisonInput {
  trusted: ActivityObservationRef;
  proxy: ActivityObservationRef & { composition: string };
}

export type ProxyComparisonUnavailableCode =
  | "missing_input"
  | "invalid_input"
  | "reserved_label"
  | "grain_below_azienda"
  | "year_mismatch"
  | "grain_mismatch"
  | "region_mismatch"
  | "azienda_mismatch"
  | "non_positive_proxy";

export interface ProxyComparison {
  year: number;
  grain: ProxyGrain;
  regionCode: string;
  aziendaCode: string | null;
  composition: string;
  trustedLabel: string;
  proxyLabel: string;
  trustedValue: number;
  proxyValue: number;
  trustedOverProxy: number;
  proxyMinusTrusted: number;
  proxyRelativeDifference: number | null;
}

export type ProxyResult<T> =
  | { status: "available"; value: T }
  | {
      status: "unavailable";
      code: ProxyComparisonUnavailableCode;
      message: string;
      fields: string[];
    };

function unavailable<T>(
  code: ProxyComparisonUnavailableCode,
  message: string,
  fields: string[] = [],
): ProxyResult<T> {
  return { status: "unavailable", code, message, fields };
}

/**
 * Compares a trusted A2 observation with one public proxy composition. The
 * comparison is only available when year, grain, region and (for Azienda
 * grain) Azienda all match. Nothing is interpolated across years or grains.
 */
export function compareTrustedActivityWithProxy(
  input: ProxyComparisonInput,
): ProxyResult<ProxyComparison> {
  const { trusted, proxy } = input;
  if (isReservedExactDenominatorLabel(proxy.label)) {
    return unavailable(
      "reserved_label",
      "A public proxy must not be labelled as the exact A2 denominator.",
      ["proxy.label"],
    );
  }
  if (trusted.grain === "facility" || proxy.grain === "facility") {
    return unavailable(
      "grain_below_azienda",
      "Facility-grain values are staging evidence below the approved first-release granularity and are never compared.",
      ["trusted.grain", "proxy.grain"],
    );
  }
  const missing = [
    ...(trusted.value === null ? ["trusted.value"] : []),
    ...(proxy.value === null ? ["proxy.value"] : []),
    ...(trusted.regionCode === null ? ["trusted.regionCode"] : []),
    ...(proxy.regionCode === null ? ["proxy.regionCode"] : []),
  ];
  if (missing.length > 0) {
    return unavailable(
      "missing_input",
      "Both observations need a value and a region before they can be compared.",
      missing,
    );
  }
  const invalid = [
    ...(!Number.isFinite(trusted.value!) ? ["trusted.value"] : []),
    ...(!Number.isFinite(proxy.value!) ? ["proxy.value"] : []),
    ...(!Number.isInteger(trusted.year) ? ["trusted.year"] : []),
    ...(!Number.isInteger(proxy.year) ? ["proxy.year"] : []),
    ...(proxy.composition.trim() === "" ? ["proxy.composition"] : []),
  ];
  if (invalid.length > 0) {
    return unavailable("invalid_input", "Observations contain non-finite or blank fields.", invalid);
  }
  if (trusted.year !== proxy.year) {
    return unavailable(
      "year_mismatch",
      `Trusted year ${trusted.year} and proxy year ${proxy.year} do not overlap.`,
      ["trusted.year", "proxy.year"],
    );
  }
  if (trusted.grain !== proxy.grain) {
    return unavailable(
      "grain_mismatch",
      `Trusted grain ${trusted.grain} and proxy grain ${proxy.grain} are not compatible.`,
      ["trusted.grain", "proxy.grain"],
    );
  }
  if (trusted.regionCode !== proxy.regionCode) {
    return unavailable(
      "region_mismatch",
      "Observations belong to different regions.",
      ["trusted.regionCode", "proxy.regionCode"],
    );
  }
  if (trusted.grain === "azienda") {
    if (trusted.aziendaCode === null || proxy.aziendaCode === null) {
      return unavailable(
        "missing_input",
        "Azienda-grain comparisons need an Azienda code on both sides.",
        ["trusted.aziendaCode", "proxy.aziendaCode"],
      );
    }
    if (trusted.aziendaCode !== proxy.aziendaCode) {
      return unavailable(
        "azienda_mismatch",
        "Observations belong to different Aziende.",
        ["trusted.aziendaCode", "proxy.aziendaCode"],
      );
    }
  } else if (trusted.aziendaCode !== null || proxy.aziendaCode !== null) {
    return unavailable(
      "grain_mismatch",
      "Regional or national comparisons must not carry an Azienda code.",
      ["trusted.aziendaCode", "proxy.aziendaCode"],
    );
  }
  if (proxy.value! <= 0) {
    return unavailable(
      "non_positive_proxy",
      "The proxy value must be positive to form a ratio.",
      ["proxy.value"],
    );
  }
  const trustedValue = trusted.value!;
  const proxyValue = proxy.value!;
  return {
    status: "available",
    value: {
      year: trusted.year,
      grain: trusted.grain,
      regionCode: trusted.regionCode!,
      aziendaCode: trusted.aziendaCode,
      composition: proxy.composition,
      trustedLabel: trusted.label,
      proxyLabel: proxy.label,
      trustedValue,
      proxyValue,
      trustedOverProxy: trustedValue / proxyValue,
      proxyMinusTrusted: proxyValue - trustedValue,
      proxyRelativeDifference:
        trustedValue === 0 ? null : (proxyValue - trustedValue) / trustedValue,
    },
  };
}

export interface GeneralizationPolicy {
  minimumDistinctAziende: number;
  minimumDistinctYears: number;
}

export interface CalibrationSummary {
  composition: string;
  observations: number;
  distinctRegions: number;
  distinctAziende: number;
  distinctYears: number;
  ratioMin: number | null;
  ratioMax: number | null;
  ratioMean: number | null;
  generalization: { status: "blocked"; reason: string } | { status: "permitted"; reason: string };
}

function isValidGeneralizationPolicy(policy: GeneralizationPolicy): boolean {
  return (
    Number.isInteger(policy.minimumDistinctAziende) &&
    policy.minimumDistinctAziende >= 1 &&
    Number.isInteger(policy.minimumDistinctYears) &&
    policy.minimumDistinctYears >= 1
  );
}

/**
 * Summarizes one composition's comparisons. A national correction factor is
 * blocked unless an approved policy with positive integer thresholds exists
 * and the evidence satisfies it. Regional observations never count as
 * Azienda evidence, and no evidence at all is never sufficient.
 */
export function summarizeCalibrationEvidence(
  composition: string,
  comparisons: ProxyComparison[],
  policy: GeneralizationPolicy | null,
): CalibrationSummary {
  const rows = comparisons.filter((row) => row.composition === composition);
  const ratios = rows.map((row) => row.trustedOverProxy);
  const distinctRegions = new Set(rows.map((row) => row.regionCode)).size;
  const distinctAziende = new Set(
    rows
      .filter((row) => row.aziendaCode !== null)
      .map((row) => `${row.regionCode}:${row.aziendaCode}`),
  ).size;
  const distinctYears = new Set(rows.map((row) => row.year)).size;
  const mean =
    ratios.length === 0 ? null : ratios.reduce((total, r) => total + r, 0) / ratios.length;

  let generalization: CalibrationSummary["generalization"];
  if (policy === null) {
    generalization = {
      status: "blocked",
      reason:
        "No approved generalization thresholds exist; a correction factor cannot be applied beyond the observed cases.",
    };
  } else if (!isValidGeneralizationPolicy(policy)) {
    generalization = {
      status: "blocked",
      reason: "The generalization policy is invalid; both thresholds must be positive integers.",
    };
  } else if (rows.length === 0) {
    generalization = {
      status: "blocked",
      reason: "No same-year, same-grain comparison exists for this composition.",
    };
  } else if (
    distinctAziende < policy.minimumDistinctAziende ||
    distinctYears < policy.minimumDistinctYears
  ) {
    generalization = {
      status: "blocked",
      reason: `Evidence covers ${distinctAziende} Aziende over ${distinctYears} year(s); policy requires at least ${policy.minimumDistinctAziende} Aziende and ${policy.minimumDistinctYears} years.`,
    };
  } else {
    generalization = {
      status: "permitted",
      reason: `Evidence covers ${distinctAziende} Aziende over ${distinctYears} year(s), meeting the approved policy.`,
    };
  }

  return {
    composition,
    observations: rows.length,
    distinctRegions,
    distinctAziende,
    distinctYears,
    ratioMin: ratios.length ? Math.min(...ratios) : null,
    ratioMax: ratios.length ? Math.max(...ratios) : null,
    ratioMean: mean,
    generalization,
  };
}

export type ExclusionHandling =
  | "excluded_by_source_definition"
  | "not_excluded"
  | "not_determinable_from_source";

export interface ProxyCompositionDefinition {
  id: string;
  grain: ProxyGrain;
  sourceId: string;
  components: string[];
  instituteScope: string;
  drg391Handling: ExclusionHandling;
  onere4Handling: ExclusionHandling;
  description: string;
}

/**
 * Candidate compositions of public activity that resemble the A2 formula.
 * None of them is A2. Each records how the two A2 exclusions are treated so
 * a reviewer can see exactly which differences remain unresolved.
 */
export const PUBLIC_ACTIVITY_PROXY_COMPOSITIONS: readonly ProxyCompositionDefinition[] = [
  {
    id: "sdo_region_acute_ro_days_plus_dh_accesses",
    grain: "region",
    sourceId: "sdo_report_2024_cap2",
    components: ["acute_ordinary_regime_days", "acute_day_regime_accesses"],
    instituteScope: "all_sdo_reporting_institutes",
    drg391Handling: "excluded_by_source_definition",
    onere4Handling: "not_excluded",
    description:
      "Tavola 2.1.6 acute ordinary-regime giornate plus acute day-regime accessi. The report lists healthy newborns (Nido, DRG 391) as a separate activity line, so the acute figures already exclude DRG 391.",
  },
  {
    id: "sdo_region_acute_ro_days_only",
    grain: "region",
    sourceId: "sdo_report_2024_cap2",
    components: ["acute_ordinary_regime_days"],
    instituteScope: "all_sdo_reporting_institutes",
    drg391Handling: "excluded_by_source_definition",
    onere4Handling: "not_excluded",
    description: "Tavola 2.1.6 acute ordinary-regime giornate without any accessi.",
  },
  {
    id: "sdo_region_all_activity_days_plus_accesses",
    grain: "region",
    sourceId: "sdo_report_2024_cap2",
    components: [
      "acute_ordinary_regime_days",
      "acute_day_regime_accesses",
      "rehab_ordinary_regime_days",
      "rehab_day_regime_accesses",
      "long_term_days",
    ],
    instituteScope: "all_sdo_reporting_institutes",
    drg391Handling: "excluded_by_source_definition",
    onere4Handling: "not_excluded",
    description:
      "Tavola 2.1.6 giornate plus accessi across acute, rehabilitation and long-term care.",
  },
  {
    id: "sdo_region_all_days_excluding_accesses",
    grain: "region",
    sourceId: "sdo_report_2024_cap2",
    components: ["acute_ordinary_regime_days", "rehab_ordinary_regime_days", "long_term_days"],
    instituteScope: "all_sdo_reporting_institutes",
    drg391Handling: "excluded_by_source_definition",
    onere4Handling: "not_excluded",
    description: "Tavola 2.1.6 ordinary-regime giornate across all activity types, no accessi.",
  },
  {
    id: "hsp_azienda_public_ordinary_days",
    grain: "azienda",
    sourceId: "hospital_structure_activity_2022",
    components: ["ordinary_regime_days"],
    instituteScope: "public_and_equiparati_presidi_only",
    drg391Handling: "not_determinable_from_source",
    onere4Handling: "not_determinable_from_source",
    description:
      "Ward-level giornate_degenza summed to the Azienda across public presidi. No accessi column exists in this source.",
  },
];
