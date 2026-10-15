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
  spend: { label: "Spesa riportata", outputIds: ["O-09-01", "O-09-02", "O-09-07"], claim: "reported_spend" },
  change: { label: "Variazioni contabili", outputIds: ["O-12-01", "O-12-02"], claim: "reported_spend" },
  budget: { label: "Pianificazione di budget", outputIds: ["ML-2-TE24", "ML-2-FY2025", "ML-2-JM2026"], claim: "modelled_budget_allocation" },
  counts: { label: "Numerosità nello scenario CO", outputIds: ["ML-3-CO-R", "ML-3-CO-A", "ML-3-SENS"], claim: "modelled_count" },
} as const;
export type CLineage = { section: keyof typeof C_REVIEW_SECTIONS; numericState: "scoped_pass"; acceptance: "pending"; verification: "implementation_separated_not_formal_v2"; outputIds: string[]; workbookRanges: string[]; checkedFields: string[]; sourceHashes: string[]; methodHashes: string[]; receiptSha256: string; claim: "reported_spend" | "modelled_budget_allocation" | "modelled_count" };
export type CReviewPacket = {
  schema: "pillar-c-review-v1";
  state: "review_only";
  workbookSha256: string;
  workbookVersion: string;
  generatedAt: string;
  evidence: { financial: string; budgetCount: string };
  lineage: CLineage[];
  monthly: CMonthly[];
  baseline: CBaseline[];
  bridges: CBridge[];
  budgets: CBudget[];
  counts: CCount[];
};
export const C_ORGS: readonly COrg[] = ["Regione", "AQ", "CH", "PE", "TE"];
export const C_PERIODS: readonly CPeriod[] = ["FY2024", "FY2025", "JM2025", "JM2026"];
export const C_ORG_LABELS: Record<COrg, string> = { Regione: "Aggregato delle quattro Aziende", AQ: "ASL 1", CH: "ASL 2", PE: "ASL 3", TE: "ASL 4" };
export const C_PERIOD_LABELS: Record<CPeriod, string> = { FY2024: "Anno 2024", FY2025: "Anno 2025", JM2025: "Gen–mag 2025", JM2026: "Gen–mag 2026" };
export const C_COMPONENT_LABELS = { "B-C": "Prodotti presenti nei due periodi", "B-E": "Prodotti entrati nel perimetro locale", "B-X": "Prodotti usciti dal perimetro locale", "B-N": "Identificativi non AIC o senza ATC" };
const HASH = /^[a-f0-9]{64}$/;
const DECIMAL = /^-?(?:0|[1-9]\d{0,12})(?:\.\d{1,30})?$/;
const code = /^[A-Za-z0-9_-]{1,80}$/;
const localOrgs = ["AQ", "CH", "PE", "TE"] as const;
const channels = ["CO", "DD", "DPC"] as const;

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
function oneOf(value: unknown, values: readonly unknown[]) { requireCondition(values.includes(value), "CATEGORY"); }
function money(value: unknown, nullable = false) {
  requireCondition((nullable && value === null) || (typeof value === "string" && DECIMAL.test(value) && Number.isFinite(Number(value))), "MONEY");
}
function integer(value: unknown) { requireCondition(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, "COUNT"); }
function identifier(value: unknown) { requireCondition(typeof value === "string" && code.test(value), "IDENTIFIER"); }
function unique(rows: Record<string, unknown>[], fields: string[]) {
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

/** No privilege/query parameter can convert review_only into accepted. */
export function parseCReviewPacket(input: unknown): CReviewPacket {
  const p = object(input);
  requireCondition(p.schema === "pillar-c-review-v1" && p.state === "review_only", "STATE");
  requireCondition(typeof p.workbookSha256 === "string" && HASH.test(p.workbookSha256), "WORKBOOK_HASH");
  requireCondition(typeof p.workbookVersion === "string" && /^[A-Za-z0-9. -]{1,50}$/.test(p.workbookVersion), "VERSION");
  requireCondition(typeof p.generatedAt === "string" && Number.isFinite(Date.parse(p.generatedAt)), "DATE");
  const evidence = object(p.evidence);
  for (const field of ["financial", "budgetCount"]) requireCondition(typeof evidence[field] === "string" && HASH.test(evidence[field]), "RECEIPT");
  const lineage = array(p.lineage, 4);
  requireCondition(lineage.length === 4, "SECTION_LINEAGE");
  for (const row of lineage) {
    oneOf(row.section, Object.keys(C_REVIEW_SECTIONS));
    const definition = C_REVIEW_SECTIONS[row.section as keyof typeof C_REVIEW_SECTIONS];
    requireCondition(row.numericState === "scoped_pass" && row.acceptance === "pending" && row.verification === "implementation_separated_not_formal_v2" && row.claim === definition.claim, "SECTION_STATE");
    requireCondition(Array.isArray(row.outputIds) && row.outputIds.length === definition.outputIds.length && definition.outputIds.every((id) => (row.outputIds as unknown[]).includes(id)), "OUTPUT_IDS");
    for (const field of ["sourceHashes", "methodHashes"]) requireCondition(Array.isArray(row[field]) && (row[field] as unknown[]).length > 0 && (row[field] as unknown[]).length <= 100 && (row[field] as unknown[]).every((hash) => typeof hash === "string" && HASH.test(hash)), "SOURCE_METHOD_PINS");
    requireCondition(Array.isArray(row.workbookRanges) && row.workbookRanges.length > 0 && row.workbookRanges.length <= 10 && row.workbookRanges.every((range) => typeof range === "string" && /^[A-Za-z0-9_]+![A-Z]+\d+(?::[A-Z]+\d+)?$/.test(range)), "WORKBOOK_RANGE");
    requireCondition(Array.isArray(row.checkedFields) && row.checkedFields.length > 0 && row.checkedFields.length <= 20 && row.checkedFields.every((field) => typeof field === "string" && code.test(field)), "CHECKED_FIELDS");
    requireCondition(row.receiptSha256 === (row.section === "spend" || row.section === "change" ? evidence.financial : evidence.budgetCount), "SECTION_RECEIPT");
  }
  unique(lineage, ["section"]);
  const monthly = array(p.monthly, 500), baseline = array(p.baseline, 150), bridges = array(p.bridges, 200);
  const budgets = array(p.budgets, 1500), counts = array(p.counts, 400);
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
  // Rebuild from explicit keys: arbitrary fields cannot hitchhike into RSC.
  const pick = (rows: Record<string, unknown>[], keys: string[]) => rows.map((r) => Object.fromEntries(keys.map((key) => [key, r[key]])));
  return jsonSafeCopy({ schema: p.schema, state: p.state, workbookSha256: p.workbookSha256, workbookVersion: p.workbookVersion, generatedAt: p.generatedAt,
    evidence: { financial: evidence.financial, budgetCount: evidence.budgetCount },
    lineage: pick(lineage, ["section", "numericState", "acceptance", "verification", "outputIds", "workbookRanges", "checkedFields", "sourceHashes", "methodHashes", "receiptSha256", "claim"]),
    monthly: pick(monthly, ["year", "month", "org", "channel", "rows", "net", "positive", "negative"]),
    baseline: pick(baseline, ["period", "org", "channel", "rows", "net", "positive", "negative"]),
    bridges: pick(bridges, ["comparison", "org", "channel", "component", "value", "cells"]),
    budgets: pick(budgets, ["id", "period", "org", "channel", "level", "area", "basis", "budget", "actual", "alternative"]),
    counts: pick(counts, ["period", "org", "portfolio", "spend", "persons", "perPerson", "lowCountCost", "highCountCost", "state"]),
  }) as CReviewPacket;
}

export type CReviewFilters = { org: COrg; channel: CChannel | "Tutti"; period: CPeriod; comparison: CComparison; trend: "monthly" | "cumulative"; budgetPeriod: "FY2024" | "FY2025" | "JM2026"; budget: "published" | "synthetic"; level: "Disciplina" | "Dipartimento"; budgetOrder: "amount" | "difference"; area: string; countPeriod: "FY2024" | "FY2025"; portfolio: string };
export const DEFAULT_C_REVIEW: CReviewFilters = { org: "Regione", channel: "Tutti", period: "FY2025", comparison: "K1", trend: "monthly", budgetPeriod: "FY2025", budget: "published", level: "Dipartimento", budgetOrder: "amount", area: "all", countPeriod: "FY2025", portfolio: "all" };
const parameters: Record<keyof CReviewFilters, string> = { org: "c_org", channel: "c_channel", period: "c_period", comparison: "c_comparison", trend: "c_trend", budgetPeriod: "c_budget_period", budget: "c_budget", level: "c_level", budgetOrder: "c_budget_order", area: "c_area", countPeriod: "c_count_year", portfolio: "c_portfolio" };
export function cReviewFilters(params: URLSearchParams): CReviewFilters {
  const pick = <K extends keyof CReviewFilters>(key: K, allowed: readonly CReviewFilters[K][]) => allowed.includes(params.get(parameters[key]) as CReviewFilters[K]) ? params.get(parameters[key]) as CReviewFilters[K] : DEFAULT_C_REVIEW[key];
  const portfolio = params.get(parameters.portfolio);
  const area = params.get(parameters.area);
  return { org: pick("org", C_ORGS), channel: pick("channel", [...channels, "Tutti"]), period: pick("period", C_PERIODS), comparison: pick("comparison", ["K1", "K2"]), trend: pick("trend", ["monthly", "cumulative"]), budgetPeriod: pick("budgetPeriod", ["FY2024", "FY2025", "JM2026"]), budget: pick("budget", ["published", "synthetic"]), level: pick("level", ["Disciplina", "Dipartimento"]), budgetOrder: pick("budgetOrder", ["amount", "difference"]), area: area && /^\d{2,4}$/.test(area) ? area : "all", countPeriod: pick("countPeriod", ["FY2024", "FY2025"]), portfolio: portfolio && /^[A-Z0-9_-]{1,20}$/.test(portfolio) ? portfolio : "all" };
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
