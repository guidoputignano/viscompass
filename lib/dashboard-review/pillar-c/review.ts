/** Private reviewer inspection contract. Never an accepted production release. */
import { itNumberFormat } from "@/lib/format/it-number";
export type COrg = "AQ" | "CH" | "PE" | "TE" | "Regione";
export type CChannel = "CO" | "DD" | "DPC";
export type CPeriod = "FY2024" | "FY2025" | "JM2025" | "JM2026";
export type CComparison = "K1" | "K2";
export type Money = string;
export type CMonthly = { year: number; month: number; org: Exclude<COrg, "Regione">; channel: CChannel; rows: number; net: Money; positive: Money; negative: Money };
export type CBaseline = { period: CPeriod; org: COrg; channel: CChannel | "Tutti"; rows: number; net: Money; positive: Money; negative: Money };
export type CBridge = { comparison: CComparison; org: COrg; channel: CChannel | "Tutti"; component: "B-C" | "B-E" | "B-X" | "B-N"; value: Money; cells: number };
export type CBudget = { id: string; period: "FY2024" | "FY2025" | "JM2026"; org: Exclude<COrg, "Regione">; channel: CChannel; level: "Disciplina" | "Dipartimento"; area: string; basis: "published" | "synthetic"; budget: Money; actual: Money | null; alternative: Money | null };
export type CCount = { period: "FY2024" | "FY2025"; org: COrg; portfolio: string; spend: Money | null; persons: Money | null; perPerson: Money | null; lowCountCost: Money | null; highCountCost: Money | null; state: "CALCOLATO" | "NON_DISPONIBILE" | "NESSUN_RECORD" };
export const C_REVIEW_SECTIONS = {
  spend: { label: "Spesa riportata", outputIds: ["O-09-01", "O-09-02", "O-09-07"], claim: "reported_spend", numericState: "scoped_pass", verification: "implementation_separated_not_formal_v2" },
  change: { label: "Variazioni contabili", outputIds: ["O-12-01", "O-12-02"], claim: "reported_spend", numericState: "scoped_pass", verification: "implementation_separated_not_formal_v2" },
  budget: { label: "Pianificazione di budget", outputIds: ["ML-2-TE24", "ML-2-FY2025", "ML-2-JM2026"], claim: "modelled_budget_allocation", numericState: "scoped_pass", verification: "implementation_separated_not_formal_v2" },
  counts: { label: "Numerosità nello scenario CO", outputIds: ["ML-3-CO-R", "ML-3-CO-A", "ML-3-SENS"], claim: "modelled_count", numericState: "scoped_pass", verification: "implementation_separated_not_formal_v2" },
  // A regional public-data forecast (AIFA tracciabilità), never an Azienda
  // forecast, budget, ceiling or clinical estimate. Its acceptance is pending.
  forecast: { label: "Previsione regionale", outputIds: ["ML-5-ADM", "ML-5-FC"], claim: "regional_public_forecast", numericState: "cross_system_pass", verification: "cross_system_codex_v2" },
} as const;
export type CSection = keyof typeof C_REVIEW_SECTIONS;
type CSectionDefinition = (typeof C_REVIEW_SECTIONS)[CSection];
export type CLineage = { section: CSection; numericState: CSectionDefinition["numericState"]; acceptance: "pending"; verification: CSectionDefinition["verification"]; outputIds: string[]; workbookRanges: string[]; checkedFields: string[]; sourceHashes: string[]; methodHashes: string[]; receiptSha256: string; claim: CSectionDefinition["claim"]; crossSystemReceiptSha256?: string; workbookSha256?: string };
export type CEvidence = { financial: string; budgetCount: string; financialR5Review?: string; budgetCountR5Review?: string; forecast?: string; forecastInputs?: string; forecastWorkbookIntegration?: string };

/** The fixed label of every regional forecast value. The packet must carry exactly this text. */
export const C_FORECAST_LABEL = "Fonte pubblica · AIFA (CC BY 4.0) · previsione regionale, non aziendale";
export const C_FORECAST_SERIES = ["TOT", "A", "H", "C"] as const;
export type CForecastSeries = typeof C_FORECAST_SERIES[number];
/** Class C is never forecast (binding): the selector offers the three admissible series only. */
export const C_FORECAST_SELECTABLE = ["TOT", "A", "H"] as const;
export type CForecastSelectable = typeof C_FORECAST_SELECTABLE[number];
export const C_FORECAST_MODELS = ["ARIMA_011_011_12", "ETS_AAA"] as const;
export const C_FORECAST_VARIANTS = ["primaria", "sensibilita_2020"] as const;
export const C_FORECAST_CONDITIONS = ["a_origini", "b_mase", "c_copertura80", "d_winkler", "e_nessuna_stima_trattenuta"] as const;
type CForecastModel = typeof C_FORECAST_MODELS[number];
type CForecastVariantId = typeof C_FORECAST_VARIANTS[number];
type CForecastCondition = typeof C_FORECAST_CONDITIONS[number];
/** The model registered for every admitted series: ARIMA(0,1,1)(0,1,1)12. */
const C_FORECAST_ADMITTED_MODEL: CForecastModel = "ARIMA_011_011_12";
export type CForecastCandidate = { candidate: CForecastModel; admitted: boolean; failedConditions: CForecastCondition[]; mase: string; maseThreshold: string; maseRatio: string; coverage80: string; coverage95: string; winkler80: string };
export type CForecastVariant = { variant: CForecastVariantId; bestBaseline: string; maseBaseline: string; winkler80Baseline: string; candidates: CForecastCandidate[] };
export type CForecastAdmission = { series: CForecastSeries; label: string; decision: "AMMESSA" | "RIFIUTATA"; model: CForecastModel | null; registeredReasons: string[]; variants: CForecastVariant[]; rejection: { reason: string; fallback: string } | null };
export type CForecastMonth = { series: CForecastSeries; month: string; point: Money; low80: Money; high80: Money; low95: Money; high95: Money; sigma: Money };
export type CForecastAnnual = { series: CForecastSeries; total: Money; low80: Money; high80: Money; low95: Money; high95: Money; sigma: Money; monthlyPointsSum: Money };
export type CForecastObserved = { series: CForecastSeries; month: string; value: Money | null; rowsSource: number; rowsValued: number; rowsMissing: number; blankShareFlagged: boolean };
export type CForecastLabels = { forecast: typeof C_FORECAST_LABEL; observed: string; tier: "Fonte pubblica"; tierState: "V2_IN_ATTESA"; base: string; method: string; note: string; reading: string; caveats: string; observedNote: string; annualType: string; licence: "CC BY 4.0"; attribution: string; seriesLabels: Record<CForecastSeries, string>; models: Record<CForecastModel, string>; variants: Record<CForecastVariantId, string>; conditions: Record<CForecastCondition, string>; amendments: string[] };
export type CForecast = { region: "Abruzzo"; scope: "regional_public_forecast"; labels: CForecastLabels; admission: CForecastAdmission[]; monthly: CForecastMonth[]; annual: CForecastAnnual[]; observed2025: CForecastObserved[] };

export type CReviewPacket = {
  schema: "pillar-c-review-v1" | "pillar-c-review-v2";
  state: "review_only";
  workbookSha256: string;
  workbookVersion: string;
  generatedAt: string;
  evidence: CEvidence;
  lineage: CLineage[];
  monthly: CMonthly[];
  baseline: CBaseline[];
  bridges: CBridge[];
  budgets: CBudget[];
  counts: CCount[];
  /** Optional in v1 (absent from the R4 packet), required in v2. */
  forecast?: CForecast;
};
export const C_ORGS: readonly COrg[] = ["Regione", "AQ", "CH", "PE", "TE"];
export const C_PERIODS: readonly CPeriod[] = ["FY2024", "FY2025", "JM2025", "JM2026"];
export const C_ORG_LABELS: Record<COrg, string> = { Regione: "Aggregato delle quattro Aziende", AQ: "ASL 1", CH: "ASL 2", PE: "ASL 3", TE: "ASL 4" };
export const C_PERIOD_LABELS: Record<CPeriod, string> = { FY2024: "Anno 2024", FY2025: "Anno 2025", JM2025: "Gen–mag 2025", JM2026: "Gen–mag 2026" };
export const C_COMPONENT_LABELS = { "B-C": "Prodotti presenti nei due periodi", "B-E": "Prodotti entrati nel perimetro locale", "B-X": "Prodotti usciti dal perimetro locale", "B-N": "Identificativi non AIC o senza ATC" };
const HASH = /^[a-f0-9]{64}$/;
const DECIMAL = /^-?(?:0|[1-9]\d{0,12})(?:\.\d{1,30})?$/;
// Forecast amounts are carried to the cent; the annual tolerance below relies on it.
const CENT = /^-?(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/;
const code = /^[A-Za-z0-9_-]{1,80}$/;
// Packet-carried copy: printable text only, and never a claim of verification or a demo.
const COPY = /^[^\u0000-\u001f\u007f]+$/;
const FORBIDDEN_COPY = /verificat|\bdemo\b|dimostra/i;
const localOrgs = ["AQ", "CH", "PE", "TE"] as const;
const channels = ["CO", "DD", "DPC"] as const;

// Explicit allow-lists. v2 is a closed schema (an unknown key fails loudly)
// and requires every evidence pin and every lineage key, including the
// cross-system ones; v1 keeps its original behaviour (an unknown key is
// dropped, the R5 pins are optional). Both serialize only these keys, so
// nothing can hitchhike into the RSC payload.
const TOP_LEVEL_KEYS = ["schema", "state", "workbookSha256", "workbookVersion", "generatedAt", "evidence", "lineage", "monthly", "baseline", "bridges", "budgets", "counts"] as const;
const EVIDENCE_REQUIRED = ["financial", "budgetCount"] as const;
const EVIDENCE_OPTIONAL = ["financialR5Review", "budgetCountR5Review", "forecast", "forecastInputs", "forecastWorkbookIntegration"] as const;
const LINEAGE_REQUIRED = ["section", "numericState", "acceptance", "verification", "outputIds", "workbookRanges", "checkedFields", "sourceHashes", "methodHashes", "receiptSha256", "claim"] as const;
const LINEAGE_OPTIONAL = ["crossSystemReceiptSha256", "workbookSha256"] as const;
const ROW_KEYS = {
  monthly: ["year", "month", "org", "channel", "rows", "net", "positive", "negative"],
  baseline: ["period", "org", "channel", "rows", "net", "positive", "negative"],
  bridges: ["comparison", "org", "channel", "component", "value", "cells"],
  budgets: ["id", "period", "org", "channel", "level", "area", "basis", "budget", "actual", "alternative"],
  counts: ["period", "org", "portfolio", "spend", "persons", "perPerson", "lowCountCost", "highCountCost", "state"],
} as const;
const FORECAST_KEYS = ["region", "scope", "labels", "admission", "monthly", "annual", "observed2025"] as const;
const FORECAST_LABEL_TEXT = ["forecast", "observed", "tier", "tierState", "base", "method", "note", "reading", "caveats", "observedNote", "annualType", "licence", "attribution"] as const;
const FORECAST_LABEL_MAPS = ["seriesLabels", "models", "variants", "conditions"] as const;
const ADMISSION_KEYS = ["series", "label", "decision", "model", "registeredReasons", "variants", "rejection"] as const;
const VARIANT_KEYS = ["variant", "bestBaseline", "maseBaseline", "winkler80Baseline", "candidates"] as const;
const CANDIDATE_KEYS = ["candidate", "admitted", "failedConditions", "mase", "maseThreshold", "maseRatio", "coverage80", "coverage95", "winkler80"] as const;
const CANDIDATE_METRICS = ["mase", "maseThreshold", "maseRatio", "coverage80", "coverage95", "winkler80"] as const;
const FORECAST_MONTH_KEYS = ["series", "month", "point", "low80", "high80", "low95", "high95", "sigma"] as const;
const FORECAST_ANNUAL_KEYS = ["series", "total", "low80", "high80", "low95", "high95", "sigma", "monthlyPointsSum"] as const;
const OBSERVED_KEYS = ["series", "month", "value", "rowsSource", "rowsValued", "rowsMissing", "blankShareFlagged"] as const;
// Which evidence entry each section's receipt (and optional cross-system receipt) must equal.
const SECTION_RECEIPTS: Record<CSection, { receipt: keyof CEvidence; crossSystem: keyof CEvidence }> = {
  spend: { receipt: "financial", crossSystem: "financialR5Review" },
  change: { receipt: "financial", crossSystem: "financialR5Review" },
  budget: { receipt: "budgetCount", crossSystem: "budgetCountR5Review" },
  counts: { receipt: "budgetCount", crossSystem: "budgetCountR5Review" },
  forecast: { receipt: "forecast", crossSystem: "forecastWorkbookIntegration" },
};
const CALENDAR = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

function requireCondition(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`PILLAR_C_PACKET_${reason}`);
}
function object(value: unknown): Record<string, unknown> {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), "OBJECT");
  return value as Record<string, unknown>;
}
function array(value: unknown, max: number): Record<string, unknown>[] {
  requireCondition(Array.isArray(value) && value.length > 0 && value.length <= max, "ROWS");
  return value.map(object);
}
function list(value: unknown, min: number, max: number): unknown[] {
  requireCondition(Array.isArray(value) && value.length >= min && value.length <= max, "ROWS");
  return value;
}
function has(value: Record<string, unknown>, key: string) { return Object.prototype.hasOwnProperty.call(value, key); }
function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) {
  for (const key of required) requireCondition(has(value, key), "MISSING_FIELD");
  for (const key of Object.keys(value)) requireCondition(required.includes(key) || optional.includes(key), "UNKNOWN_FIELD");
}
function oneOf(value: unknown, values: readonly unknown[]) { requireCondition(values.includes(value), "CATEGORY"); }
function money(value: unknown, nullable = false) {
  requireCondition((nullable && value === null) || (typeof value === "string" && DECIMAL.test(value) && Number.isFinite(Number(value))), "MONEY");
}
function cent(value: unknown, nullable = false) { requireCondition((nullable && value === null) || (typeof value === "string" && CENT.test(value)), "MONEY"); }
function metric(value: unknown) { money(value); requireCondition(!(value as string).startsWith("-"), "FORECAST_METRIC"); }
function positive(value: unknown) { money(value); requireCondition(scaled(value as string) > BigInt(0), "FORECAST_SIGMA"); }
function integer(value: unknown) { requireCondition(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, "COUNT"); }
function identifier(value: unknown) { requireCondition(typeof value === "string" && code.test(value), "IDENTIFIER"); }
function text(value: unknown, max: number) { requireCondition(typeof value === "string" && value.length <= max && COPY.test(value) && !FORBIDDEN_COPY.test(value), "TEXT"); }
function unique(rows: Record<string, unknown>[], fields: readonly string[]) {
  requireCondition(new Set(rows.map((r) => fields.map((f) => String(r[f])).join("|"))).size === rows.length, "DUPLICATE");
}
// Exact 30-place decimal arithmetic is used for admission checks. Number
// conversion is for chart coordinates only, not a new financial calculation.
function scaled(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  return BigInt(`${whole}${fraction.padEnd(30, "0")}`) * BigInt(negative ? -1 : 1);
}
function reconciles(a: string, b: string, c: string) { return scaled(a) === scaled(b) + scaled(c); }
function unscaled(value: bigint): Money {
  const negative = value < BigInt(0), literal = (negative ? -value : value).toString().padStart(31, "0");
  const fraction = literal.slice(-30).replace(/0+$/, "");
  return `${negative ? "-" : ""}${literal.slice(0, -30)}${fraction ? `.${fraction}` : ""}`;
}
/** Every bound in order: low95 <= low80 <= point <= high80 <= high95, exactly. */
function ordered(row: Record<string, unknown>, centre: "point" | "total") {
  const values = [row.low95, row.low80, row[centre], row.high80, row.high95].map((v) => scaled(v as string));
  for (let i = 1; i < values.length; i++) requireCondition(values[i - 1] <= values[i], "FORECAST_BOUNDS");
}
/** Exact decimal subtraction for table/headline values, not chart coordinates. */
export function cMoneyDifference(left: Money, right: Money): Money { return unscaled(scaled(left) - scaled(right)); }
/** ROUND_HALF_AWAY_FROM_ZERO to cents before locale formatting. */
export function cMoneyLabel(value: Money | number | null): string {
  if (value === null) return "Non disponibile";
  if (typeof value === "number") return Number.isFinite(value) ? itNumberFormat({ style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value) : "Non disponibile";
  money(value);
  const original = scaled(value), absolute = original < BigInt(0) ? -original : original;
  const unit = BigInt(10) ** BigInt(28), cents = (absolute + unit / BigInt(2)) / unit;
  const major = cents / BigInt(100), minor = (cents % BigInt(100)).toString().padStart(2, "0");
  return `${original < BigInt(0) && cents > BigInt(0) ? "-" : ""}${itNumberFormat({ maximumFractionDigits: 0 }).format(major)},${minor}\u00a0€`;
}
function jsonSafeCopy(value: unknown): unknown { return JSON.parse(JSON.stringify(value)); }
// Rebuild from explicit keys: arbitrary fields cannot hitchhike into RSC.
function pick(rows: Record<string, unknown>[], fields: readonly string[]) { return rows.map((r) => Object.fromEntries(fields.map((key) => [key, r[key]]))); }

/** Strict forecast section. Always closed: any key outside the contract fails. */
function parseCForecast(input: unknown): CForecast {
  const f = object(input);
  keys(f, FORECAST_KEYS);
  requireCondition(f.region === "Abruzzo" && f.scope === "regional_public_forecast", "FORECAST_SCOPE");
  const labels = object(f.labels);
  keys(labels, [...FORECAST_LABEL_TEXT, ...FORECAST_LABEL_MAPS, "amendments"]);
  for (const field of FORECAST_LABEL_TEXT) text(labels[field], 600);
  requireCondition(labels.forecast === C_FORECAST_LABEL && labels.tier === "Fonte pubblica" && labels.tierState === "V2_IN_ATTESA" && labels.licence === "CC BY 4.0", "FORECAST_LABEL");
  const dictionary = (value: unknown, names: readonly string[]) => {
    const d = object(value); keys(d, names);
    for (const name of names) text(d[name], 200);
    return Object.fromEntries(names.map((name) => [name, d[name]])) as Record<string, string>;
  };
  const seriesLabels = dictionary(labels.seriesLabels, C_FORECAST_SERIES), models = dictionary(labels.models, C_FORECAST_MODELS);
  const variantLabels = dictionary(labels.variants, C_FORECAST_VARIANTS), conditions = dictionary(labels.conditions, C_FORECAST_CONDITIONS);
  const amendments = list(labels.amendments, 1, 10);
  for (const amendment of amendments) identifier(amendment);
  requireCondition(new Set(amendments).size === amendments.length && ["ML-A15", "ML-A17"].every((a) => amendments.includes(a)), "FORECAST_AMENDMENTS");

  const admission = list(f.admission, C_FORECAST_SERIES.length, C_FORECAST_SERIES.length).map(object);
  const variantsOf = new Map<Record<string, unknown>, Record<string, unknown>[]>(), candidatesOf = new Map<Record<string, unknown>, Record<string, unknown>[]>();
  for (const a of admission) {
    keys(a, ADMISSION_KEYS);
    oneOf(a.series, C_FORECAST_SERIES); oneOf(a.decision, ["AMMESSA", "RIFIUTATA"]);
    requireCondition(a.label === seriesLabels[a.series as string], "FORECAST_LABEL");
    const reasons = list(a.registeredReasons, 0, 20);
    for (const reason of reasons) text(reason, 400);
    const variants = list(a.variants, C_FORECAST_VARIANTS.length, C_FORECAST_VARIANTS.length).map(object);
    variantsOf.set(a, variants);
    for (const v of variants) {
      keys(v, VARIANT_KEYS);
      oneOf(v.variant, C_FORECAST_VARIANTS); identifier(v.bestBaseline); metric(v.maseBaseline); metric(v.winkler80Baseline);
      const candidates = list(v.candidates, C_FORECAST_MODELS.length, C_FORECAST_MODELS.length).map(object);
      candidatesOf.set(v, candidates);
      for (const c of candidates) {
        keys(c, CANDIDATE_KEYS);
        oneOf(c.candidate, C_FORECAST_MODELS); requireCondition(typeof c.admitted === "boolean", "CATEGORY");
        const failed = list(c.failedConditions, 0, C_FORECAST_CONDITIONS.length);
        for (const condition of failed) oneOf(condition, C_FORECAST_CONDITIONS);
        requireCondition(new Set(failed).size === failed.length && c.admitted === (failed.length === 0), "FORECAST_ADMISSION");
        for (const field of CANDIDATE_METRICS) metric(c[field]);
        for (const field of ["coverage80", "coverage95"]) requireCondition(scaled(c[field] as string) <= scaled("1"), "FORECAST_METRIC");
        // The registered conditions decidable from the carried values must agree with the carried outcome.
        const coverage = scaled(c.coverage80 as string);
        requireCondition(failed.includes("b_mase") === (scaled(c.mase as string) > scaled(c.maseThreshold as string)), "FORECAST_CONDITION");
        requireCondition(failed.includes("c_copertura80") === (coverage < scaled("0.7") || coverage > scaled("0.9")), "FORECAST_CONDITION");
        requireCondition(failed.includes("d_winkler") === (scaled(c.winkler80 as string) > scaled(v.winkler80Baseline as string)), "FORECAST_CONDITION");
      }
      unique(candidates, ["candidate"]);
    }
    unique(variants, ["variant"]);
    if (a.decision === "AMMESSA") {
      // Binding: C is never forecast; admitted series use the registered model, admitted in every variant.
      requireCondition(a.series !== "C" && a.model === C_FORECAST_ADMITTED_MODEL && a.rejection === null, "FORECAST_DECISION");
      requireCondition(variants.every((v) => candidatesOf.get(v)!.some((c) => c.candidate === a.model && c.admitted === true)), "FORECAST_DECISION");
    } else {
      requireCondition(a.model === null && reasons.length > 0, "FORECAST_DECISION");
      const rejection = object(a.rejection);
      keys(rejection, ["reason", "fallback"]);
      text(rejection.reason, 600); text(rejection.fallback, 600);
    }
  }
  unique(admission, ["series"]);
  const admitted = admission.filter((a) => a.decision === "AMMESSA").map((a) => a.series as CForecastSeries);

  const monthly = list(f.monthly, 0, 12 * C_FORECAST_SELECTABLE.length).map(object);
  for (const r of monthly) {
    keys(r, FORECAST_MONTH_KEYS);
    oneOf(r.series, C_FORECAST_SERIES); requireCondition(admitted.includes(r.series as CForecastSeries), "FORECAST_REJECTED_SERIES");
    requireCondition(typeof r.month === "string" && /^2026-(0[1-9]|1[0-2])$/.test(r.month), "PERIOD");
    for (const field of ["point", "low80", "high80", "low95", "high95"]) cent(r[field]);
    positive(r.sigma); ordered(r, "point");
  }
  unique(monthly, ["series", "month"]);
  // Every admitted series carries exactly the twelve months of 2026, in calendar order.
  for (const series of admitted) requireCondition(monthly.filter((r) => r.series === series).map((r) => r.month).join() === CALENDAR.map((m) => `2026-${m}`).join(), "FORECAST_MONTHS");
  requireCondition(monthly.length === admitted.length * 12, "FORECAST_MONTHS");

  const annual = list(f.annual, 0, C_FORECAST_SELECTABLE.length).map(object);
  for (const r of annual) {
    keys(r, FORECAST_ANNUAL_KEYS);
    oneOf(r.series, C_FORECAST_SERIES); requireCondition(admitted.includes(r.series as CForecastSeries), "FORECAST_REJECTED_SERIES");
    for (const field of ["total", "low80", "high80", "low95", "high95", "monthlyPointsSum"]) cent(r[field]);
    positive(r.sigma); ordered(r, "total");
    // monthlyPointsSum is the exact sum of the carried cent points. The total is
    // the single cent rounding of the sum of the UNROUNDED points (producer CSV,
    // workbook 18A row 40), so it may differ from it by at most 12 x 0.005 EUR.
    const sum = monthly.filter((m) => m.series === r.series).reduce((s, m) => s + scaled(m.point as string), BigInt(0));
    requireCondition(scaled(r.monthlyPointsSum as string) === sum, "FORECAST_ANNUAL_SUM");
    const gap = scaled(r.total as string) - sum;
    requireCondition((gap < BigInt(0) ? -gap : gap) <= scaled("0.06"), "FORECAST_ANNUAL_SUM");
  }
  unique(annual, ["series"]);
  requireCondition(annual.length === admitted.length, "FORECAST_ANNUAL");

  const observed = list(f.observed2025, 0, 12 * C_FORECAST_SERIES.length).map(object);
  for (const r of observed) {
    keys(r, OBSERVED_KEYS);
    oneOf(r.series, C_FORECAST_SERIES);
    requireCondition(typeof r.month === "string" && /^2025-(0[1-9]|1[0-2])$/.test(r.month), "PERIOD");
    cent(r.value, true); integer(r.rowsSource); integer(r.rowsValued); integer(r.rowsMissing);
    requireCondition(typeof r.blankShareFlagged === "boolean", "CATEGORY");
    // A month with no valued row is missing (null), never zero.
    requireCondition(Number(r.rowsValued) + Number(r.rowsMissing) === r.rowsSource && (r.value === null) === (r.rowsValued === 0), "OBSERVED_COVERAGE");
  }
  unique(observed, ["series", "month"]);
  const observedSeries = new Set(observed.map((r) => r.series as CForecastSeries));
  for (const series of observedSeries) requireCondition(observed.filter((r) => r.series === series).map((r) => r.month).join() === CALENDAR.map((m) => `2025-${m}`).join(), "OBSERVED_MONTHS");
  for (const series of admitted) requireCondition(observedSeries.has(series), "OBSERVED_MONTHS");

  return {
    region: f.region, scope: f.scope,
    labels: { ...Object.fromEntries(FORECAST_LABEL_TEXT.map((field) => [field, labels[field]])), seriesLabels, models, variants: variantLabels, conditions, amendments: [...amendments] },
    admission: admission.map((a) => ({
      ...Object.fromEntries(["series", "label", "decision", "model"].map((field) => [field, a[field]])),
      registeredReasons: [...(a.registeredReasons as string[])],
      variants: variantsOf.get(a)!.map((v) => ({
        ...Object.fromEntries(["variant", "bestBaseline", "maseBaseline", "winkler80Baseline"].map((field) => [field, v[field]])),
        candidates: candidatesOf.get(v)!.map((c) => ({ ...Object.fromEntries(CANDIDATE_KEYS.map((field) => [field, c[field]])), failedConditions: [...(c.failedConditions as string[])] })),
      })),
      rejection: a.rejection === null ? null : { reason: (a.rejection as Record<string, unknown>).reason, fallback: (a.rejection as Record<string, unknown>).fallback },
    })),
    monthly: pick(monthly, FORECAST_MONTH_KEYS), annual: pick(annual, FORECAST_ANNUAL_KEYS), observed2025: pick(observed, OBSERVED_KEYS),
  } as CForecast;
}

/** No privilege/query parameter can convert review_only into accepted. */
export function parseCReviewPacket(input: unknown): CReviewPacket {
  const p = object(input);
  requireCondition((p.schema === "pillar-c-review-v1" || p.schema === "pillar-c-review-v2") && p.state === "review_only", "STATE");
  const v2 = p.schema === "pillar-c-review-v2";
  const closed = (row: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) => { if (v2) keys(row, required, optional); };
  const hasForecast = has(p, "forecast");
  requireCondition(!v2 || hasForecast, "FORECAST_REQUIRED");
  closed(p, [...TOP_LEVEL_KEYS, "forecast"]);
  requireCondition(typeof p.workbookSha256 === "string" && HASH.test(p.workbookSha256), "WORKBOOK_HASH");
  requireCondition(typeof p.workbookVersion === "string" && /^[A-Za-z0-9. -]{1,50}$/.test(p.workbookVersion), "VERSION");
  requireCondition(typeof p.generatedAt === "string" && Number.isFinite(Date.parse(p.generatedAt)), "DATE");
  const evidence = object(p.evidence);
  closed(evidence, [...EVIDENCE_REQUIRED, ...EVIDENCE_OPTIONAL]);
  for (const field of EVIDENCE_REQUIRED) requireCondition(typeof evidence[field] === "string" && HASH.test(evidence[field]), "RECEIPT");
  for (const field of EVIDENCE_OPTIONAL) if (has(evidence, field)) requireCondition(typeof evidence[field] === "string" && HASH.test(evidence[field]), "RECEIPT");
  // A forecast section exists only with its own lineage row; without it the v1 four-section contract is unchanged.
  const sections = (Object.keys(C_REVIEW_SECTIONS) as CSection[]).filter((section) => section !== "forecast" || hasForecast);
  const lineage = array(p.lineage, sections.length);
  requireCondition(lineage.length === sections.length, "SECTION_LINEAGE");
  for (const row of lineage) {
    closed(row, [...LINEAGE_REQUIRED, ...LINEAGE_OPTIONAL]);
    oneOf(row.section, sections);
    const definition: CSectionDefinition = C_REVIEW_SECTIONS[row.section as CSection];
    requireCondition(row.numericState === definition.numericState && row.acceptance === "pending" && row.verification === definition.verification && row.claim === definition.claim, "SECTION_STATE");
    // In any schema, a cross-system state is never displayed without the receipt that backs it.
    if (definition.numericState === "cross_system_pass") requireCondition(has(row, "crossSystemReceiptSha256"), "MISSING_FIELD");
    requireCondition(Array.isArray(row.outputIds) && row.outputIds.length === definition.outputIds.length && definition.outputIds.every((id) => (row.outputIds as unknown[]).includes(id)), "OUTPUT_IDS");
    for (const field of ["sourceHashes", "methodHashes"]) requireCondition(Array.isArray(row[field]) && (row[field] as unknown[]).length > 0 && (row[field] as unknown[]).length <= 100 && (row[field] as unknown[]).every((hash) => typeof hash === "string" && HASH.test(hash)), "SOURCE_METHOD_PINS");
    requireCondition(Array.isArray(row.workbookRanges) && row.workbookRanges.length > 0 && row.workbookRanges.length <= 10 && row.workbookRanges.every((range) => typeof range === "string" && /^[A-Za-z0-9_]+![A-Z]+\d+(?::[A-Z]+\d+)?$/.test(range)), "WORKBOOK_RANGE");
    requireCondition(Array.isArray(row.checkedFields) && row.checkedFields.length > 0 && row.checkedFields.length <= 20 && row.checkedFields.every((field) => typeof field === "string" && code.test(field)), "CHECKED_FIELDS");
    const pins = SECTION_RECEIPTS[row.section as CSection];
    requireCondition(typeof evidence[pins.receipt] === "string" && row.receiptSha256 === evidence[pins.receipt], "SECTION_RECEIPT");
    if (has(row, "crossSystemReceiptSha256")) requireCondition(typeof evidence[pins.crossSystem] === "string" && row.crossSystemReceiptSha256 === evidence[pins.crossSystem], "SECTION_RECEIPT");
    if (has(row, "workbookSha256")) requireCondition(row.workbookSha256 === p.workbookSha256, "WORKBOOK_HASH");
  }
  unique(lineage, ["section"]);
  const monthly = array(p.monthly, 500), baseline = array(p.baseline, 150), bridges = array(p.bridges, 200);
  const budgets = array(p.budgets, 1500), counts = array(p.counts, 400);
  for (const [rows, fields] of [[monthly, ROW_KEYS.monthly], [baseline, ROW_KEYS.baseline], [bridges, ROW_KEYS.bridges], [budgets, ROW_KEYS.budgets], [counts, ROW_KEYS.counts]] as const) for (const r of rows) closed(r, fields);
  for (const rows of [monthly, baseline]) for (const r of rows) {
    oneOf(r.org, rows === monthly ? localOrgs : C_ORGS);
    oneOf(r.channel, rows === monthly ? channels : [...channels, "Tutti"]);
    integer(r.rows);
    for (const f of ["net", "positive", "negative"]) money(r[f]);
    requireCondition(Number(r.positive) >= 0 && Number(r.negative) <= 0 && reconciles(r.net as string, r.positive as string, r.negative as string), "SIGNED_TOTAL");
    if (rows === monthly) {
      oneOf(r.year, [2024, 2025, 2026]); integer(r.month);
      requireCondition(Number(r.month) >= 1 && Number(r.month) <= (r.year === 2026 ? 5 : 12), "PERIOD");
    } else oneOf(r.period, C_PERIODS);
  }
  for (const r of bridges) {
    oneOf(r.org, C_ORGS); oneOf(r.channel, [...channels, "Tutti"]); oneOf(r.comparison, ["K1", "K2"]);
    oneOf(r.component, Object.keys(C_COMPONENT_LABELS)); money(r.value); integer(r.cells);
  }
  for (const r of budgets) {
    identifier(r.id); oneOf(r.org, localOrgs); oneOf(r.channel, channels); oneOf(r.period, ["FY2024", "FY2025", "JM2026"]);
    oneOf(r.level, ["Disciplina", "Dipartimento"]); identifier(r.area); oneOf(r.basis, ["published", "synthetic"]);
    money(r.budget); money(r.actual, true); money(r.alternative, true);
    requireCondition((r.actual === null) === (r.alternative === null), "ALLOCATION_PAIR");
    requireCondition(typeof r.area === "string" && /^\d{2,4}$/.test(r.area), "NON_AREA");
    if (r.basis === "published") requireCondition(r.org === "TE" && r.period === "FY2024", "BUDGET_SOURCE");
  }
  for (const r of counts) {
    oneOf(r.org, C_ORGS); oneOf(r.period, ["FY2024", "FY2025"]); identifier(r.portfolio);
    oneOf(r.state, ["CALCOLATO", "NON_DISPONIBILE", "NESSUN_RECORD"]);
    for (const field of ["spend", "persons", "perPerson", "lowCountCost", "highCountCost"]) money(r[field], true);
    if (r.state === "CALCOLATO") requireCondition(r.spend !== null && r.persons !== null && Number(r.persons) > 0 && r.perPerson !== null && r.lowCountCost !== null && r.highCountCost !== null, "SCENARIO_REQUIRED");
    else requireCondition(r.perPerson === null && r.lowCountCost === null && r.highCountCost === null, "MISSING_SCENARIO");
  }
  unique(monthly, ["year", "month", "org", "channel"]); unique(baseline, ["period", "org", "channel"]);
  unique(bridges, ["comparison", "org", "channel", "component"]); unique(budgets, ["id"]); unique(counts, ["period", "org", "portfolio"]);
  unique(budgets, ["period", "org", "channel", "level", "area", "basis"]);
  // Every carried scope must conserve its source amounts; never admit a
  // plausible headline over a mismatched monthly series or change bridge.
  for (const r of baseline) {
    const year = Number(String(r.period).slice(2));
    const months = monthly.filter((m) => m.year === year && (r.org === "Regione" || m.org === r.org) && (r.channel === "Tutti" || m.channel === r.channel) && (!String(r.period).startsWith("JM") || Number(m.month) <= 5));
    requireCondition(months.length > 0, "BASELINE_EMPTY");
    for (const field of ["net", "positive", "negative"]) requireCondition(months.reduce((s, m) => s + scaled(m[field] as string), BigInt(0)) === scaled(r[field] as string), "MONTHLY_RECONCILIATION");
    requireCondition(months.reduce((s, m) => s + Number(m.rows), 0) === r.rows, "ROW_RECONCILIATION");
  }
  for (const r of bridges) {
    const components = bridges.filter((v) => v.comparison === r.comparison && v.org === r.org && v.channel === r.channel);
    requireCondition(components.length === 4, "BRIDGE_COMPONENTS");
    const [p0, p1] = r.comparison === "K1" ? ["FY2024", "FY2025"] : ["JM2025", "JM2026"];
    const left = baseline.find((v) => v.period === p0 && v.org === r.org && v.channel === r.channel);
    const right = baseline.find((v) => v.period === p1 && v.org === r.org && v.channel === r.channel);
    requireCondition(left && right && components.reduce((s, v) => s + scaled(v.value as string), BigInt(0)) === scaled(right.net as string) - scaled(left.net as string), "BRIDGE_RECONCILIATION");
  }
  const forecast = hasForecast ? parseCForecast(p.forecast) : undefined;
  return jsonSafeCopy({ schema: p.schema, state: p.state, workbookSha256: p.workbookSha256, workbookVersion: p.workbookVersion, generatedAt: p.generatedAt,
    evidence: Object.fromEntries([...EVIDENCE_REQUIRED, ...EVIDENCE_OPTIONAL].filter((field) => has(evidence, field)).map((field) => [field, evidence[field]])),
    lineage: pick(lineage, [...LINEAGE_REQUIRED, ...LINEAGE_OPTIONAL]),
    monthly: pick(monthly, ROW_KEYS.monthly), baseline: pick(baseline, ROW_KEYS.baseline), bridges: pick(bridges, ROW_KEYS.bridges),
    budgets: pick(budgets, ROW_KEYS.budgets), counts: pick(counts, ROW_KEYS.counts),
    ...(forecast ? { forecast } : {}),
  }) as CReviewPacket;
}

export type CReviewFilters = { org: COrg; channel: CChannel | "Tutti"; period: CPeriod; comparison: CComparison; trend: "monthly" | "cumulative"; budgetPeriod: "FY2024" | "FY2025" | "JM2026"; budget: "published" | "synthetic"; level: "Disciplina" | "Dipartimento"; budgetOrder: "amount" | "difference"; area: string; countPeriod: "FY2024" | "FY2025"; portfolio: string; forecastSeries: CForecastSelectable };
export const DEFAULT_C_REVIEW: CReviewFilters = { org: "Regione", channel: "Tutti", period: "FY2025", comparison: "K1", trend: "monthly", budgetPeriod: "FY2025", budget: "published", level: "Dipartimento", budgetOrder: "amount", area: "all", countPeriod: "FY2025", portfolio: "all", forecastSeries: "TOT" };
const parameters: Record<keyof CReviewFilters, string> = { org: "c_org", channel: "c_channel", period: "c_period", comparison: "c_comparison", trend: "c_trend", budgetPeriod: "c_budget_period", budget: "c_budget", level: "c_level", budgetOrder: "c_budget_order", area: "c_area", countPeriod: "c_count_year", portfolio: "c_portfolio", forecastSeries: "c_forecast_series" };
export function cReviewFilters(params: URLSearchParams): CReviewFilters {
  const pick = <K extends keyof CReviewFilters>(key: K, allowed: readonly CReviewFilters[K][]) => allowed.includes(params.get(parameters[key]) as CReviewFilters[K]) ? params.get(parameters[key]) as CReviewFilters[K] : DEFAULT_C_REVIEW[key];
  const portfolio = params.get(parameters.portfolio);
  const area = params.get(parameters.area);
  return { org: pick("org", C_ORGS), channel: pick("channel", [...channels, "Tutti"]), period: pick("period", C_PERIODS), comparison: pick("comparison", ["K1", "K2"]), trend: pick("trend", ["monthly", "cumulative"]), budgetPeriod: pick("budgetPeriod", ["FY2024", "FY2025", "JM2026"]), budget: pick("budget", ["published", "synthetic"]), level: pick("level", ["Disciplina", "Dipartimento"]), budgetOrder: pick("budgetOrder", ["amount", "difference"]), area: area && /^\d{2,4}$/.test(area) ? area : "all", countPeriod: pick("countPeriod", ["FY2024", "FY2025"]), portfolio: portfolio && /^[A-Z0-9_-]{1,20}$/.test(portfolio) ? portfolio : "all", forecastSeries: pick("forecastSeries", C_FORECAST_SELECTABLE) };
}
export function cReviewSearch(search: string, patch: Partial<CReviewFilters>, reset = false) {
  const params = new URLSearchParams(search), filters = reset ? DEFAULT_C_REVIEW : { ...cReviewFilters(params), ...patch };
  for (const key of Object.keys(parameters) as (keyof CReviewFilters)[]) {
    if (filters[key] === DEFAULT_C_REVIEW[key]) params.delete(parameters[key]); else params.set(parameters[key], filters[key]);
  }
  return params.size ? `?${params}` : "";
}
export function selectCReview(packet: CReviewPacket, f: CReviewFilters) {
  const baseline = packet.baseline.find((r) => r.period === f.period && r.org === f.org && r.channel === f.channel) ?? null;
  const year = Number(f.period.slice(2)), cap = f.period.startsWith("JM") ? 5 : 12;
  let running: bigint | null = BigInt(0);
  const months = Array.from({ length: cap }, (_, i) => {
    const rows = packet.monthly.filter((r) => r.year === year && r.month === i + 1 && (f.org === "Regione" || r.org === f.org) && (f.channel === "Tutti" || r.channel === f.channel));
    const value = rows.length ? rows.reduce((s, r) => s + scaled(r.net), BigInt(0)) : null;
    running = running !== null && value !== null ? running + value : null;
    const exact = f.trend === "cumulative" ? running : value;
    return { month: i + 1, amount: exact === null ? null : Number(unscaled(exact)), exact: exact === null ? null : unscaled(exact), rows: rows.reduce((s, r) => s + r.rows, 0) };
  });
  const [leftPeriod, rightPeriod] = f.comparison === "K1" ? ["FY2024", "FY2025"] : ["JM2025", "JM2026"];
  const bridge = packet.bridges.filter((r) => r.comparison === f.comparison && r.org === f.org && r.channel === f.channel);
  const left = packet.baseline.find((r) => r.period === leftPeriod && r.org === f.org && r.channel === f.channel) ?? null;
  const right = packet.baseline.find((r) => r.period === rightPeriod && r.org === f.org && r.channel === f.channel) ?? null;
  // An aggregate filter is NOT permission to compare/sum all modelled areas.
  const availableBudgets = f.org === "Regione" || f.channel === "Tutti" ? [] : packet.budgets.filter((r) => r.org === f.org && r.channel === f.channel && r.period === f.budgetPeriod && r.basis === f.budget && r.level === f.level);
  const budgets = availableBudgets.filter((r) => f.area === "all" || r.area === f.area).sort((a, b) => {
    if (a.actual === null || b.actual === null) return a.actual === b.actual ? a.id.localeCompare(b.id) : a.actual === null ? 1 : -1;
    const aa = f.budgetOrder === "amount" ? Number(a.actual) : Math.abs(Number(cMoneyDifference(a.actual, a.budget)));
    const bb = f.budgetOrder === "amount" ? Number(b.actual) : Math.abs(Number(cMoneyDifference(b.actual, b.budget)));
    return bb - aa || a.id.localeCompare(b.id);
  });
  const counts = packet.counts.filter((r) => r.org === f.org && r.period === f.countPeriod && (f.portfolio === "all" || r.portfolio === f.portfolio));
  return { baseline, months, bridge, left, right, leftPeriod, rightPeriod, budgets, availableBudgets, counts };
}

export type CForecastChartRow = {
  key: string; year: 2025 | 2026; month: number;
  observed: number | null; point: number | null; band80: [number, number] | null; band95: [number, number] | null;
  exact: { observed: Money | null; point: Money | null; low80: Money | null; high80: Money | null; low95: Money | null; high95: Money | null };
  /** 2025 only: the observed value sums the valued source rows; blank rows are missing, never zero. */
  rows: { valued: number; source: number } | null;
};
/** One series of the regional forecast. The global Azienda/channel filters never apply to it. */
export function selectCForecast(forecast: CForecast, series: CForecastSelectable) {
  const admission = forecast.admission.find((r) => r.series === series) ?? null;
  const months = forecast.monthly.filter((r) => r.series === series);
  const observed = forecast.observed2025.filter((r) => r.series === series);
  const annual = forecast.annual.find((r) => r.series === series) ?? null;
  const rows = months.map((r) => ({ month: Number(r.month.slice(5)), forecast: r, observed: observed.find((o) => o.month.slice(5) === r.month.slice(5)) ?? null }));
  const chart: CForecastChartRow[] = [
    ...observed.map((o) => ({ key: o.month, year: 2025 as const, month: Number(o.month.slice(5)), observed: o.value === null ? null : Number(o.value), point: null, band80: null, band95: null,
      exact: { observed: o.value, point: null, low80: null, high80: null, low95: null, high95: null }, rows: { valued: o.rowsValued, source: o.rowsSource } })),
    ...months.map((r) => ({ key: r.month, year: 2026 as const, month: Number(r.month.slice(5)), observed: null, point: Number(r.point), band80: [Number(r.low80), Number(r.high80)] as [number, number], band95: [Number(r.low95), Number(r.high95)] as [number, number],
      exact: { observed: null, point: r.point, low80: r.low80, high80: r.high80, low95: r.low95, high95: r.high95 }, rows: null })),
  ];
  return { series, label: forecast.labels.seriesLabels[series], admission, rows, annual, observed, chart,
    /** Exact total − sum of the twelve displayed cents: rounding only, never a new estimate. */
    roundingDifference: annual ? cMoneyDifference(annual.total, annual.monthlyPointsSum) : null };
}
