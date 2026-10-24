/** Pillar C organisation-scoped delivery: closed parsers for the per-unit index and review files, and the
 * client review packet they merge into. Pure and browser-safe; the transport is in scoped-transport.ts.
 *
 * Each object belongs to exactly one unit, and every row it carries names that unit. An unknown key, a
 * row of another unit, a modelled budget, a lineage or evidence block, or a total that does not reconcile
 * fails loudly. An empty section is no data, never zero. */
import type { CAttrView } from "@/lib/dashboard-review/pillar-c/attribution-loader";
import type { CAttrPortfolio, CAttrScope } from "@/lib/dashboard-review/pillar-c/attribution";
import type { CPortfolioDossier, CPortfolioScopeSummary, CPortfolioView } from "@/lib/dashboard-review/pillar-c/portfolio";
import { C_REVIEW_SECTIONS, EVIDENCE_OPTIONAL, EVIDENCE_REQUIRED, type CBaseline, type CBridge, type CBudget, type CCount, type CEvidence, type CMonthly, type CReviewFilters, type CSection } from "@/lib/dashboard-review/pillar-c/review";
import { C_SCOPED_AGGREGATE, C_SCOPED_ASL_UNITS, isCScopedUnit, type CScopedAslUnit, type CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

export type CScopedMonthly = Omit<CMonthly, "org"> & { org: CScopedUnit };
export type CScopedBaseline = Omit<CBaseline, "org"> & { org: CScopedUnit };
export type CScopedBridge = Omit<CBridge, "org"> & { org: CScopedUnit };
/** Published acts only in the unit files (owner decision O4): an Azienda never receives a modelled budget. */
export type CScopedBudget = Omit<CBudget, "org" | "basis"> & { org: CScopedAslUnit; basis: "published" };
/** A modelled budget row of the Regione's regional object (owner decision of 24 Oct 2026: O4 lifted for the Regione). */
export type CScopedModelledBudget = Omit<CBudget, "org" | "basis"> & { org: CScopedAslUnit; basis: "synthetic" };
export type CScopedCount = Omit<CCount, "org"> & { org: CScopedUnit };
export type CScopedReviewRows = { monthly: CScopedMonthly[]; baseline: CScopedBaseline[]; bridges: CScopedBridge[]; budgets: CScopedBudget[]; counts: CScopedCount[] };
export type CScopedReviewFile = { schema: "pillar-c-review-scoped-v1"; state: "review_only"; unit: CScopedUnit; monthlyBasis: "source_rows" | "derived_exact_sum_of_asl_units" } & CScopedReviewRows;
/** What a scoped page receives. `monthlyMode: "explicit"`: every series is read from the rows carrying exactly the
 * selected key; the aggregate has its own rows and nothing is summed across organisations in the browser. */
export type CScopedClientReview = { schema: "pillar-c-review-client-v1"; state: "review_only"; monthlyMode: "explicit"; orgs: CScopedUnit[] } & Omit<CScopedReviewRows, "budgets"> & {
  /** Published acts of the unit files; for the Regione also the modelled rows of its regional object. */
  budgets: (CScopedBudget | CScopedModelledBudget)[];
};
/** What the reviewer's «Fonti e significato delle analisi» and «Versione e tracciabilità» panels render. */
export type CScopedProvenance = { workbookVersion: string; workbookSha256: string; evidence: CEvidence; sections: CSection[] };
/** The Regione's regional review object (pillar-c-regional-review-v1): modelled budgets and provenance. */
export type CScopedRegionalReview = { provenance: CScopedProvenance; budgets: CScopedModelledBudget[] };
export type CScopedReviewFilters = Omit<CReviewFilters, "org"> & { org: CScopedUnit };

export type CScopedRef = { name: string; sha256: string; bytes: number };
export type CScopedShardIndex = { sourceSha256: string; classificationSha256: string; mappingVersion: string; precision: "exact-source-literals-21"; portfolios: CAttrPortfolio[]; scopes: Record<string, CScopedRef> };
export type CScopedIndex = {
  schema: "pillar-c-scoped-index-v1"; build: string; root: string; unit: CScopedUnit;
  source: { review: string; attribution: string; portfolio: string };
  review: CScopedRef; attribution: CScopedShardIndex; portfolio: CScopedShardIndex;
};
export type CScopedAttrScope = Omit<CAttrScope, "org"> & { org: CScopedUnit };
/** Same wire shape as the reviewer view; `org` is the unit key and `sourceSnapshot` the unit's pinned index. */
export type CScopedAttrView = Omit<CAttrView, "scope" | "comparison"> & { scope: CScopedAttrScope; comparison: CScopedAttrScope | null };
export type CScopedPortfolioScope = Omit<CPortfolioScopeSummary, "org"> & { org: CScopedUnit };
export type CScopedPortfolioView = Omit<CPortfolioView, "scope" | "comparison"> & { scope: CScopedPortfolioScope; comparison: { scope: CScopedPortfolioScope; dossier: CPortfolioDossier } | null };

export const C_SCOPED_PERIODS = ["FY2024", "FY2025", "JM2025", "JM2026"] as const;
export const C_SCOPED_CHANNELS = ["Tutti", "CO", "DD", "DPC"] as const;
const LOCAL_CHANNELS = ["CO", "DD", "DPC"] as const;
const COMPONENTS = ["B-C", "B-E", "B-X", "B-N"] as const;
const HASH = /^[a-f0-9]{64}$/;
const DECIMAL = /^-?(?:0|[1-9]\d{0,12})(?:\.\d{1,30})?$/;
const IDENTIFIER = /^[A-Za-z0-9_-]{1,80}$/;
const PRINTABLE = /^[^\u0000-\u001f\u007f]+$/;
const INDEX_KEYS = ["schema", "build", "root", "unit", "source", "review", "attribution", "portfolio"] as const;
const SHARD_INDEX_KEYS = ["sourceSha256", "classificationSha256", "mappingVersion", "precision", "portfolios", "scopes"] as const;
const FILE_KEYS = ["schema", "state", "unit", "monthlyBasis", "monthly", "baseline", "bridges", "budgets", "counts"] as const;
/** The reviewer's ROW_KEYS (review.ts), in the same order: a scoped row is a reviewer row re-keyed to its unit. */
export const C_SCOPED_ROW_KEYS = {
  monthly: ["year", "month", "org", "channel", "rows", "net", "positive", "negative"],
  baseline: ["period", "org", "channel", "rows", "net", "positive", "negative"],
  bridges: ["comparison", "org", "channel", "component", "value", "cells"],
  budgets: ["id", "period", "org", "channel", "level", "area", "basis", "budget", "actual", "alternative"],
  counts: ["period", "org", "portfolio", "spend", "persons", "perPerson", "lowCountCost", "highCountCost", "state"],
} as const;
const LIMITS = { monthly: 500, baseline: 150, bridges: 200, budgets: 1500, counts: 400 } as const;

function need(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`PILLAR_C_SCOPED_${reason}`);
}
function object(value: unknown): Record<string, unknown> {
  need(value !== null && typeof value === "object" && !Array.isArray(value), "OBJECT");
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, wanted: readonly string[]) {
  const present = Object.keys(value);
  need(present.length === wanted.length && wanted.every((k) => Object.prototype.hasOwnProperty.call(value, k)), "FIELDS");
}
function rows(value: unknown, max: number): Record<string, unknown>[] {
  need(Array.isArray(value) && value.length <= max, "ROWS");
  return (value as unknown[]).map(object);
}
function oneOf(value: unknown, values: readonly unknown[]) { need(values.includes(value), "CATEGORY"); }
function money(value: unknown, nullable = false) { need((nullable && value === null) || (typeof value === "string" && DECIMAL.test(value)), "MONEY"); }
function integer(value: unknown) { need(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, "COUNT"); }
function identifier(value: unknown) { need(typeof value === "string" && IDENTIFIER.test(value), "IDENTIFIER"); }
function hash(value: unknown) { need(typeof value === "string" && HASH.test(value), "HASH"); }
function text(value: unknown, max: number) { need(typeof value === "string" && value.length > 0 && value.length <= max && PRINTABLE.test(value), "TEXT"); }
function unique(list: Record<string, unknown>[], fields: readonly string[]) {
  need(new Set(list.map((r) => fields.map((f) => String(r[f])).join("|"))).size === list.length, "DUPLICATE");
}
// Exact 30-place decimal arithmetic, as in review.ts. Number conversion is never used for a check.
function scaled(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  return BigInt(`${whole}${fraction.padEnd(30, "0")}`) * BigInt(negative ? -1 : 1);
}
const pick = (list: Record<string, unknown>[], fields: readonly string[]) => list.map((r) => Object.fromEntries(fields.map((k) => [k, r[k]])));

function ref(value: unknown, name: (sha: string) => string, maxBytes: number): CScopedRef {
  const r = object(value); exact(r, ["name", "sha256", "bytes"]); hash(r.sha256);
  need(r.name === name(r.sha256 as string), "REF_NAME");
  need(Number.isSafeInteger(r.bytes) && (r.bytes as number) >= 2 && (r.bytes as number) <= maxBytes, "REF_BYTES");
  return { name: r.name as string, sha256: r.sha256 as string, bytes: r.bytes as number };
}
function shardIndex(value: unknown, unit: CScopedUnit, kind: "attr" | "port", maxBytes: number): CScopedShardIndex {
  const s = object(value); exact(s, SHARD_INDEX_KEYS);
  hash(s.sourceSha256); hash(s.classificationSha256); text(s.mappingVersion, 100);
  need(s.precision === "exact-source-literals-21", "PRECISION");
  need(Array.isArray(s.portfolios) && s.portfolios.length > 0 && s.portfolios.length <= 40, "PORTFOLIOS");
  const ids = new Set<string>();
  const portfolios = (s.portfolios as unknown[]).map((p) => {
    const v = object(p); exact(v, ["id", "label", "kind"]);
    need(typeof v.id === "string" && /^[A-Z0-9]{2,12}$/.test(v.id) && !ids.has(v.id), "PORTFOLIO_ID"); ids.add(v.id as string);
    text(v.label, 500); text(v.kind, 80);
    return { id: v.id as string, label: v.label as string, kind: v.kind as string };
  });
  const scopes = object(s.scopes), expected: string[] = [];
  for (const period of C_SCOPED_PERIODS) for (const channel of C_SCOPED_CHANNELS) expected.push(`${period}|${unit}|${channel}`);
  exact(scopes, expected);
  const out: Record<string, CScopedRef> = {};
  for (const key of expected) {
    const [period, , channel] = key.split("|");
    out[key] = ref(scopes[key], (sha) => `${kind}-${period}-${channel}-${sha}.json`, maxBytes);
  }
  return { sourceSha256: s.sourceSha256 as string, classificationSha256: s.classificationSha256 as string, mappingVersion: s.mappingVersion as string, precision: "exact-source-literals-21", portfolios, scopes: out };
}

/** Closed index of one unit (schema pillar-c-scoped-index-v1). The caller supplies the pins it expects. */
export function parseCScopedIndex(raw: unknown, expected: { unit: CScopedUnit; root: string; build: string; source: { review: string; attribution: string; portfolio: string } }): CScopedIndex {
  const p = object(raw); exact(p, INDEX_KEYS);
  need(p.schema === "pillar-c-scoped-index-v1" && p.build === expected.build && p.root === expected.root, "INDEX_SCHEMA");
  need(isCScopedUnit(expected.unit) && p.unit === expected.unit, "INDEX_UNIT");
  const source = object(p.source); exact(source, ["review", "attribution", "portfolio"]);
  for (const k of ["review", "attribution", "portfolio"] as const) need(source[k] === expected.source[k], "INDEX_SOURCE");
  return {
    schema: "pillar-c-scoped-index-v1", build: expected.build, root: expected.root, unit: expected.unit,
    source: { ...expected.source },
    review: ref(p.review, (sha) => `review-${sha}.json`, 1_000_000),
    attribution: shardIndex(p.attribution, expected.unit, "attr", 1_000_000),
    portfolio: shardIndex(p.portfolio, expected.unit, "port", 5_000_000),
  };
}

/** Closed review file of one unit (schema pillar-c-review-scoped-v1). */
export function parseCScopedReviewFile(raw: unknown, unit: CScopedUnit): CScopedReviewFile {
  need(isCScopedUnit(unit), "UNIT");
  const p = object(raw); exact(p, FILE_KEYS);
  need(p.schema === "pillar-c-review-scoped-v1" && p.state === "review_only" && p.unit === unit, "FILE_SCHEMA");
  const aggregate = unit === C_SCOPED_AGGREGATE;
  need(p.monthlyBasis === (aggregate ? "derived_exact_sum_of_asl_units" : "source_rows"), "MONTHLY_BASIS");
  const monthly = rows(p.monthly, LIMITS.monthly), baseline = rows(p.baseline, LIMITS.baseline), bridges = rows(p.bridges, LIMITS.bridges);
  const budgets = rows(p.budgets, LIMITS.budgets), counts = rows(p.counts, LIMITS.counts);
  for (const [list, fields] of [[monthly, C_SCOPED_ROW_KEYS.monthly], [baseline, C_SCOPED_ROW_KEYS.baseline], [bridges, C_SCOPED_ROW_KEYS.bridges], [budgets, C_SCOPED_ROW_KEYS.budgets], [counts, C_SCOPED_ROW_KEYS.counts]] as const) {
    for (const r of list) { exact(r, fields); need(r.org === unit, "FOREIGN_ROW"); }
  }
  for (const list of [monthly, baseline]) for (const r of list) {
    oneOf(r.channel, list === monthly ? LOCAL_CHANNELS : [...LOCAL_CHANNELS, "Tutti"]);
    integer(r.rows);
    for (const f of ["net", "positive", "negative"]) money(r[f]);
    need(scaled(r.positive as string) >= BigInt(0) && scaled(r.negative as string) <= BigInt(0) && scaled(r.net as string) === scaled(r.positive as string) + scaled(r.negative as string), "SIGNED_TOTAL");
    if (list === monthly) {
      oneOf(r.year, [2024, 2025, 2026]); integer(r.month);
      need((r.month as number) >= 1 && (r.month as number) <= (r.year === 2026 ? 5 : 12), "PERIOD");
    } else oneOf(r.period, C_SCOPED_PERIODS);
  }
  for (const r of bridges) {
    oneOf(r.comparison, ["K1", "K2"]); oneOf(r.channel, [...LOCAL_CHANNELS, "Tutti"]); oneOf(r.component, COMPONENTS);
    money(r.value); integer(r.cells);
  }
  // O4: only published acts reach a scoped audience, only for an Azienda, never for the aggregate.
  need(!aggregate || budgets.length === 0, "AGGREGATE_BUDGET");
  for (const r of budgets) {
    identifier(r.id); need(typeof r.id === "string" && new RegExp(`^${unit}-b-\\d{4}$`).test(r.id), "BUDGET_ID");
    oneOf(r.period, ["FY2024", "FY2025", "JM2026"]); oneOf(r.channel, LOCAL_CHANNELS); oneOf(r.level, ["Disciplina", "Dipartimento"]);
    need(typeof r.area === "string" && /^\d{2,4}$/.test(r.area), "NON_AREA");
    need(r.basis === "published", "MODELLED_BUDGET");
    // As in the reviewer parser: the only published act is the 2024 departmental budget of ASL 4.
    need(unit === "asl-4" && r.period === "FY2024", "BUDGET_SOURCE");
    money(r.budget); money(r.actual, true); money(r.alternative, true);
    need((r.actual === null) === (r.alternative === null), "ALLOCATION_PAIR");
  }
  for (const r of counts) {
    oneOf(r.period, ["FY2024", "FY2025"]); identifier(r.portfolio);
    oneOf(r.state, ["CALCOLATO", "NON_DISPONIBILE", "NESSUN_RECORD"]);
    for (const f of ["spend", "persons", "perPerson", "lowCountCost", "highCountCost"]) money(r[f], true);
    if (r.state === "CALCOLATO") need(r.spend !== null && r.persons !== null && scaled(r.persons as string) > BigInt(0) && r.perPerson !== null && r.lowCountCost !== null && r.highCountCost !== null, "SCENARIO_REQUIRED");
    else need(r.perPerson === null && r.lowCountCost === null && r.highCountCost === null, "MISSING_SCENARIO");
  }
  unique(monthly, ["year", "month", "channel"]); unique(baseline, ["period", "channel"]);
  unique(bridges, ["comparison", "channel", "component"]); unique(budgets, ["id"]); unique(counts, ["period", "portfolio"]);
  unique(budgets, ["period", "channel", "level", "area"]);
  // Every scope conserves its own rows: the baseline is the exact sum of this unit's monthly rows, and the bridge
  // components sum to the change of this unit's baseline. The aggregate is checked against its own explicit rows.
  for (const r of baseline) {
    const year = Number(String(r.period).slice(2));
    const months = monthly.filter((m) => m.year === year && (r.channel === "Tutti" || m.channel === r.channel) && (!String(r.period).startsWith("JM") || (m.month as number) <= 5));
    need(months.length > 0, "BASELINE_EMPTY");
    for (const f of ["net", "positive", "negative"]) need(months.reduce((s, m) => s + scaled(m[f] as string), BigInt(0)) === scaled(r[f] as string), "MONTHLY_RECONCILIATION");
    need(months.reduce((s, m) => s + (m.rows as number), 0) === r.rows, "ROW_RECONCILIATION");
  }
  for (const r of bridges) {
    const components = bridges.filter((v) => v.comparison === r.comparison && v.channel === r.channel);
    need(components.length === 4, "BRIDGE_COMPONENTS");
    const [p0, p1] = r.comparison === "K1" ? ["FY2024", "FY2025"] : ["JM2025", "JM2026"];
    const left = baseline.find((v) => v.period === p0 && v.channel === r.channel), right = baseline.find((v) => v.period === p1 && v.channel === r.channel);
    need(left && right && components.reduce((s, v) => s + scaled(v.value as string), BigInt(0)) === scaled(right.net as string) - scaled(left.net as string), "BRIDGE_RECONCILIATION");
  }
  return {
    schema: "pillar-c-review-scoped-v1", state: "review_only", unit, monthlyBasis: p.monthlyBasis as CScopedReviewFile["monthlyBasis"],
    monthly: pick(monthly, C_SCOPED_ROW_KEYS.monthly), baseline: pick(baseline, C_SCOPED_ROW_KEYS.baseline), bridges: pick(bridges, C_SCOPED_ROW_KEYS.bridges),
    budgets: pick(budgets, C_SCOPED_ROW_KEYS.budgets), counts: pick(counts, C_SCOPED_ROW_KEYS.counts),
  } as CScopedReviewFile;
}

/** For an audience that reads all five units: the aggregate's explicit monthly rows are exactly the sum of the
 * four Aziende per (year, month, channel), every field and the row count, with no cell missing on either side. */
export function checkCScopedAggregate(files: readonly CScopedReviewFile[]): void {
  const aggregate = files.find((f) => f.unit === C_SCOPED_AGGREGATE);
  const asl = C_SCOPED_ASL_UNITS.map((u) => files.find((f) => f.unit === u));
  need(aggregate && asl.every(Boolean), "AGGREGATE_UNITS");
  const cell = (r: CScopedMonthly) => `${r.year}|${r.month}|${r.channel}`;
  const sums = new Map<string, { rows: number; net: bigint; positive: bigint; negative: bigint }>();
  for (const file of asl) for (const r of file!.monthly) {
    const s = sums.get(cell(r)) ?? { rows: 0, net: BigInt(0), positive: BigInt(0), negative: BigInt(0) };
    s.rows += r.rows; s.net += scaled(r.net); s.positive += scaled(r.positive); s.negative += scaled(r.negative);
    sums.set(cell(r), s);
  }
  need(sums.size === aggregate!.monthly.length, "AGGREGATE_CELLS");
  for (const r of aggregate!.monthly) {
    const s = sums.get(cell(r));
    need(s && s.rows === r.rows && s.net === scaled(r.net) && s.positive === scaled(r.positive) && s.negative === scaled(r.negative), "AGGREGATE_SUM");
  }
}

/** The client packet of one audience: the files of its units, in the audience's order, nothing else. */
export function mergeCScopedReview(units: readonly CScopedUnit[], files: readonly CScopedReviewFile[]): CScopedClientReview {
  need(units.length > 0 && units.length === files.length && new Set(units).size === units.length, "MERGE_UNITS");
  files.forEach((f, i) => need(f.unit === units[i], "MERGE_ORDER"));
  if (units.length === 5) checkCScopedAggregate(files);
  const all = <K extends keyof CScopedReviewRows>(key: K) => files.flatMap((f) => f[key] as unknown[]) as CScopedReviewRows[K];
  return structuredClone({ schema: "pillar-c-review-client-v1", state: "review_only", monthlyMode: "explicit", orgs: [...units],
    monthly: all("monthly"), baseline: all("baseline"), bridges: all("bridges"), budgets: all("budgets"), counts: all("counts") } as CScopedClientReview);
}

const REGIONAL_REVIEW_KEYS = ["schema", "workbookVersion", "workbookSha256", "evidence", "sections", "budgets"] as const;
/** The Regione's regional review object, closed (regional analytical parity; owner decision of 24 Oct 2026 lifting O4
 * and the lineage restriction for the Regione). The modelled rows are the reviewer's, re-keyed to their unit, with ids
 * <unit>-m-NNNN; the provenance is what the reviewer's two provenance panels render. `workbookSha256` is the pinned
 * workbook the reviewer packet names. */
export function parseCRegionalReview(raw: unknown, workbookSha256: string): CScopedRegionalReview {
  const p = object(raw); exact(p, REGIONAL_REVIEW_KEYS);
  need(p.schema === "pillar-c-regional-review-v1" && HASH.test(workbookSha256) && p.workbookSha256 === workbookSha256, "REGIONAL_SCHEMA");
  need(typeof p.workbookVersion === "string" && /^[A-Za-z0-9. -]{1,50}$/.test(p.workbookVersion), "REGIONAL_VERSION");
  const evidence = object(p.evidence);
  need(Object.keys(evidence).every((k) => (EVIDENCE_REQUIRED as readonly string[]).includes(k) || (EVIDENCE_OPTIONAL as readonly string[]).includes(k)), "REGIONAL_EVIDENCE");
  for (const k of EVIDENCE_REQUIRED) hash(evidence[k]);
  for (const k of Object.keys(evidence)) hash(evidence[k]);
  need(Array.isArray(p.sections) && p.sections.length > 0 && p.sections.length <= Object.keys(C_REVIEW_SECTIONS).length
    && p.sections.every((s) => Object.prototype.hasOwnProperty.call(C_REVIEW_SECTIONS, s as string)) && new Set(p.sections).size === p.sections.length, "REGIONAL_SECTIONS");
  const budgets = rows(p.budgets, LIMITS.budgets * 2);
  need(budgets.length > 0, "REGIONAL_BUDGETS");
  for (const r of budgets) {
    exact(r, C_SCOPED_ROW_KEYS.budgets);
    oneOf(r.org, C_SCOPED_ASL_UNITS);
    identifier(r.id); need(typeof r.id === "string" && new RegExp(`^${r.org}-m-\\d{4}$`).test(r.id), "BUDGET_ID");
    oneOf(r.period, ["FY2024", "FY2025", "JM2026"]); oneOf(r.channel, LOCAL_CHANNELS); oneOf(r.level, ["Disciplina", "Dipartimento"]);
    need(typeof r.area === "string" && /^\d{2,4}$/.test(r.area), "NON_AREA");
    need(r.basis === "synthetic", "PUBLISHED_IN_MODELLED");
    money(r.budget); money(r.actual, true); money(r.alternative, true);
    need((r.actual === null) === (r.alternative === null), "ALLOCATION_PAIR");
  }
  unique(budgets, ["id"]); unique(budgets, ["period", "org", "channel", "level", "area"]);
  return {
    provenance: { workbookVersion: p.workbookVersion as string, workbookSha256, evidence: Object.fromEntries(Object.keys(evidence).map((k) => [k, evidence[k]])) as CEvidence, sections: [...p.sections] as CSection[] },
    budgets: pick(budgets, C_SCOPED_ROW_KEYS.budgets) as CScopedModelledBudget[],
  };
}
