/** Pillar C organisation-scoped delivery: the last check before any scoped payload leaves the server.
 * Pure. Every response or page property is REBUILT from a closed allow-list of its schema (an unknown or
 * missing key at any depth fails, so a reviewer-only block such as lineage, evidence or a workbook hash cannot
 * hitchhike), then every string is scanned according to what its field is:
 *   - org: exactly one of the audience's units;
 *   - identifier and text fields: no province key (O3), no place name, no NSIS Azienda code, no unit key the
 *     audience cannot read, and for identifiers not the reviewer aggregate key «Regione» either;
 *   - public product and portfolio descriptors (labels, ATC codes): the place-name rule only. They legitimately
 *     contain the same two letters (a manufacturer suffix «TE», an ATC code such as N05CH01).
 * The rule covers the union of units the audience reads. It is the builder's token rule (private build
 * rec5-scoped-v1), re-applied on the served bytes. */
import { C_ATTR_CHANNELS, C_ATTR_PERIODS } from "@/lib/dashboard-review/pillar-c/attribution";
import { C_COMPONENT_LABELS, C_PERIODS } from "@/lib/dashboard-review/pillar-c/review";
import { isCScopedUnit, type CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";
import type { PillarCScopedAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";

/** count: a person or identifier count, 0 or at least 5 (the small-cell rule of the January DPC and File F extension);
 * share: a proportion in [0, 1]; num: a finite number; bool: true or false. */
type Leaf = "org" | "id" | "text" | "desc" | "hash" | "int" | "money" | "null" | "count" | "share" | "num" | "bool";
type Spec = Leaf | { lit: readonly (string | number)[] } | { nullable: Spec } | { list: Spec; max: number } | { obj: Readonly<Record<string, Spec>> };

/** A province key standing alone (not inside a word): AQ, CH, PE or TE. */
export const C_PROVINCE_TOKEN = /(^|[^A-Za-z])(AQ|CH|PE|TE)([^A-Za-z]|$)/;
/** Azienda and Region place names (word-bounded, any case) and the NSIS Azienda codes. */
export const C_PLACE_NAME = /(^|[^\p{L}])(l['’]?aquila|aquila|avezzano|sulmona|chieti|lanciano|vasto|pescara|teramo|abruzz[oi]|atri|giulianova|sant['’]?omero|ortona|marsica)(?=$|[^\p{L}])/iu;
export const C_NSIS_CODE = /(^|\D)13020[1-4](?=\D|$)/;
const UNIT_KEY = /(?:^|[^A-Za-z0-9])(asl-[0-9]+|aggregato)(?=$|[^A-Za-z0-9])/g;
/** Reviewer-only blocks, named so that a refusal says why. Any other unknown key fails as well. */
export const C_REVIEWER_ONLY_KEYS = ["lineage", "evidence", "workbookSha256", "workbookVersion", "generatedAt", "receiptSha256", "workbookRanges", "sourceHashes", "methodHashes", "crossSystemReceiptSha256", "forecast"] as const;

export class CScopedGuardError extends Error {
  constructor(reason: string) { super(`PCS_GUARD_${reason}`); }
}
const fail = (reason: string): never => { throw new CScopedGuardError(reason); };

const STATS: Spec = { obj: { n: "int", net: "money", abs: "money", positive: "money", negative: "money" } };
const STATES: Spec = { obj: { S2: STATS, S3: STATS, S4: STATS, S5: STATS } };
const PERIOD: Spec = { lit: C_ATTR_PERIODS };
const CHANNEL: Spec = { lit: C_ATTR_CHANNELS };
const LOCAL_CHANNEL: Spec = { lit: ["CO", "DD", "DPC"] };
const PORTFOLIO: Spec = { obj: { id: "id", label: "desc", kind: "text" } };
const PORTFOLIOS: Spec = { list: PORTFOLIO, max: 40 };
const CANDIDATES: Spec = { list: "id", max: 40 };
const ATTR_PRODUCT: Spec = { obj: { key: "id", label: "desc", atc: "desc", state: { lit: ["S3", "S4", "S5"] }, candidates: CANDIDATES, n: "int", net: "money", abs: "money", positive: "money", negative: "money" } };
const BOUND: Spec = { obj: { id: "id", fixed: "money", shared: STATS, lower1: "money", upper1: "money", lower2: "money", upper2: "money" } };
const ATTR_SCOPE: Spec = { obj: { period: PERIOD, org: "org", channel: CHANNEL, total: STATS, states: STATES, observedAllocation: "null", bounds: { list: BOUND, max: 40 }, products: { list: ATTR_PRODUCT, max: 6500 } } };
const PORT_PRODUCT: Spec = { obj: { key: "id", label: "desc", atc: "desc", state: { lit: ["S2", "S3"] }, candidates: CANDIDATES, n: "int", net: "money", abs: "money", positive: "money", negative: "money" } };
const SUMMARY_FIELDS = { id: "id", label: "desc", kind: "text", fixed: STATS, shared: STATS, lower1: "money", upper1: "money", lower2: "money", upper2: "money" } as const satisfies Record<string, Spec>;
const MONTH: Spec = { obj: { month: "int", fixed: { nullable: STATS }, shared: { nullable: STATS } } };
const DOSSIER: Spec = { obj: { ...SUMMARY_FIELDS, observedAllocation: "null", monthly: { list: MONTH, max: 12 }, products: { list: PORT_PRODUCT, max: 6500 }, sharedProducts: { list: PORT_PRODUCT, max: 6500 } } };
const SCOPE_SUMMARY: Spec = { obj: { period: PERIOD, org: "org", channel: CHANNEL, total: STATS, states: STATES } };
const CHANGE: Spec = { obj: { key: "id", label: "desc", atc: "desc", current: { nullable: STATS }, previous: { nullable: STATS }, delta: "money", kind: { lit: ["continuing", "entry", "exit"] } } };
// January 2026 DPC and File F 2025 extension (points 15-16): one closed shape for every unit; non-additive aggregate fields are null.
const EXT_CELL: Spec = { obj: { id: "id", label: "desc", count: "count", share: "share" } };
const EXT_DIST: Spec = { obj: { status: { lit: ["released", "withheld"] }, total: { nullable: "count" }, cells: { list: EXT_CELL, max: 12 } } };
const EXT_QUART: Spec = { nullable: { obj: { q1: "num", median: "num", q3: "num" } } };
const EXT_SEX: Spec = { obj: { female: "share", male: "share", unknownLeftOut: "bool" } };
const EXT_USE: Spec = { obj: { quartiles: EXT_QUART, bins: EXT_DIST } };
const N_SHARE: Spec = { nullable: "share" }, N_NUM: Spec = { nullable: "num" };
const EXT_JANUARY: Spec = { obj: {
  recipients: "count", recipientsAreSum: "bool", age: EXT_DIST, sex: EXT_SEX,
  cost: { obj: { quartiles: EXT_QUART, bins: EXT_DIST, top10: N_SHARE, top20: N_SHARE, gini: N_SHARE, lorenz: { nullable: { list: "share", max: 11 } } } },
  use: { obj: { packs: EXT_USE, prescriptions: EXT_USE, distinctAICs: EXT_USE } },
  ingredients: EXT_DIST, portfolioStatus: { list: EXT_CELL, max: 8 }, singleCandidateReach: { list: EXT_CELL, max: 12 },
  attribution: { obj: { single: "share", narrowed: "share", indicative: "share", notInformative: "share", agreementLines: N_SHARE, sharedRecipientsNarrowed: N_SHARE } },
  services: { obj: { serviceShare: "share", servicePerPack: "num", under10Packs: N_SHARE, under10Service: N_SHARE, pharmacies: { nullable: "int" }, pharmacyTop10: N_SHARE,
    intervalQ1: N_NUM, intervalMedian: N_NUM, intervalQ3: N_NUM, within7: N_SHARE, sameDay: N_SHARE, pharmacyFeeQ1: N_NUM, pharmacyFeeMedian: N_NUM, pharmacyFeeQ3: N_NUM } },
} };
// Owner decision D2 (23 Oct 2026): the unit's own per-pack components on the products common to the four ASLs; public product descriptors.
const EXT_UNIT_COSTS: Spec = { nullable: { obj: { products: { list: { obj: { aic: "id", name: "desc", pack: "desc", atc: "desc", acquisition: "num", service: "num", combined: "num" } }, max: 1000 } } } };
// Owner decision D1: File F month-to-month bridges, amounts with sign.
const EXT_BRIDGE: Spec = { obj: { from: "id", to: "id", opening: "num", closing: "num", change: "num", continuingIncrease: "num", continuingDecrease: "num", entries: "num", exits: "num",
  mode09Change: "num", withoutMode09: "num", products: "int", top10Share: "share" } };
const EXT_FILEF: Spec = { nullable: { obj: {
  year: { lit: [2025] }, identifiers: "count", identifiersByMonth: { list: { obj: { month: "id", count: "count" } }, max: 12 },
  age: EXT_DIST, sex: EXT_SEX,
  concentration: { obj: { q1: "num", median: "num", q3: "num", top10: "share", top1: "share", gini: "share", top10WithoutMode09: "share", top1WithoutMode09: "share" } },
  contacts: EXT_DIST, monthsActive: EXT_DIST, medianContacts: "num", medianMonths: "num",
  portfolioShares: { obj: { single: "share", shared: "share", unmapped: "share" } },
  singleCandidateReach: { list: { obj: { id: "id", label: "desc", share: "share" } }, max: 12 },
  months: { list: { obj: { month: "id", amount: "num", mode09: "num", withoutMode09: "num" } }, max: 12 },
  modes: { list: { obj: { id: "id", label: "desc", rowsShare: "share", amountShare: "share" } }, max: 8 },
  bridges: { list: EXT_BRIDGE, max: 11 },
} } };
const EXT_UNIT: Spec = { obj: { schema: { lit: ["pillar-c-extension-unit-v2"] }, unit: "org", period: { lit: ["2026-01"] }, channel: { lit: ["DPC"] }, january: EXT_JANUARY, unitCosts: EXT_UNIT_COSTS, fileF: EXT_FILEF,
  notes: { obj: { fileFMode09: { nullable: "text" } } } } };
const EXT_FINDING: Spec = { obj: { id: "id", title: "text", scope: "text", source: "text", detail: "text", action: "text" } };

export const C_SCOPED_PAYLOAD_SPECS = {
  extension: EXT_UNIT,
  extensionReviewer: { obj: {
    schema: { lit: ["pillar-c-extension-reviewer-v3"] }, units: { list: EXT_UNIT, max: 5 },
    drivers: { obj: { supportProducts: "int", referencePer1000: "num", units: { list: { obj: { unit: "org", per1000: "num", difference: "num", reach: "num", intensity: "num", mix: "num",
      acquisition: "num", service: "num", reachPer1000: "num", packsPerRecipient: "num", coverage: "share" } }, max: 4 } } },
    baskets: { obj: { products: "int", units: { list: { obj: { unit: "org", acquisition: "num", service: "num", combined: "num" } }, max: 4 } } },
    // The File F quarterly index on fixed common products is a price measure: reviewer-only (O1), never in a unit object.
    fileFBasket: { obj: { unit: "org", products: "int", quarters: { list: { obj: { quarter: "id", index: "num", coverage: "share" } }, max: 4 } } },
    findings: { obj: { version: { lit: ["ext-v1"] }, rows: { list: EXT_FINDING, max: 20 } } },
  } },
  attribution: { obj: {
    schema: { lit: ["pillar-c-attribution-view-v1"] }, sourceSha256: "hash", classificationSha256: "hash", mappingVersion: "text", sourceSnapshot: "hash",
    portfolios: PORTFOLIOS, scope: ATTR_SCOPE, comparison: { nullable: ATTR_SCOPE },
  } },
  portfolio: { obj: {
    schema: { lit: ["pillar-c-portfolio-view-v1"] }, precision: { lit: ["exact-source-literals-21"] }, sourceSha256: "hash", classificationSha256: "hash", sourceSnapshot: "hash",
    mappingVersion: "text", mappingStatus: { lit: ["draft"] }, attributionBasis: { lit: ["atc-portfolio-proxy"] }, portfolios: PORTFOLIOS,
    scope: SCOPE_SUMMARY, summaries: { list: { obj: SUMMARY_FIELDS }, max: 40 }, dossier: DOSSIER,
    comparison: { nullable: { obj: { scope: SCOPE_SUMMARY, dossier: DOSSIER } } }, productChanges: { list: CHANGE, max: 13000 }, change: { nullable: "money" },
    changeSemantic: { lit: ["later-minus-earlier"] }, changePeriods: { obj: { from: PERIOD, to: PERIOD } },
  } },
  review: { obj: {
    schema: { lit: ["pillar-c-review-client-v1"] }, state: { lit: ["review_only"] }, monthlyMode: { lit: ["explicit"] }, orgs: { list: "org", max: 5 },
    monthly: { list: { obj: { year: { lit: [2024, 2025, 2026] }, month: "int", org: "org", channel: LOCAL_CHANNEL, rows: "int", net: "money", positive: "money", negative: "money" } }, max: 2500 },
    baseline: { list: { obj: { period: { lit: C_PERIODS }, org: "org", channel: CHANNEL, rows: "int", net: "money", positive: "money", negative: "money" } }, max: 750 },
    bridges: { list: { obj: { comparison: { lit: ["K1", "K2"] }, org: "org", channel: CHANNEL, component: { lit: Object.keys(C_COMPONENT_LABELS) }, value: "money", cells: "int" } }, max: 1000 },
    budgets: { list: { obj: { id: "id", period: { lit: ["FY2024", "FY2025", "JM2026"] }, org: "org", channel: LOCAL_CHANNEL, level: { lit: ["Disciplina", "Dipartimento"] }, area: "id", basis: { lit: ["published"] }, budget: "money", actual: { nullable: "money" }, alternative: { nullable: "money" } } }, max: 1500 },
    counts: { list: { obj: { period: { lit: ["FY2024", "FY2025"] }, org: "org", portfolio: "id", spend: { nullable: "money" }, persons: { nullable: "money" }, perPerson: { nullable: "money" }, lowCountCost: { nullable: "money" }, highCountCost: { nullable: "money" }, state: { lit: ["CALCOLATO", "NON_DISPONIBILE", "NESSUN_RECORD"] } } }, max: 2000 },
  } },
} as const satisfies Record<string, Spec>;
export type CScopedPayloadKind = keyof typeof C_SCOPED_PAYLOAD_SPECS;

const PRINTABLE = /^[^\u0000-\u001f\u007f]*$/;
const MONEY = /^-?\d{1,40}(?:\.\d{1,40})?$/;

function scan(value: string, field: "id" | "text" | "desc", units: readonly CScopedUnit[]) {
  if (!PRINTABLE.test(value)) fail("CONTROL");
  if (C_PLACE_NAME.test(value) || C_NSIS_CODE.test(value)) fail("PLACE");
  for (const match of value.matchAll(UNIT_KEY)) if (!units.includes(match[1] as CScopedUnit)) fail("FOREIGN_UNIT");
  if (field === "desc") return;
  if (C_PROVINCE_TOKEN.test(value)) fail("PROVINCE");
  if (field === "id" && /regione/i.test(value)) fail("REGIONE_KEY");
}

function rebuild(value: unknown, spec: Spec, units: readonly CScopedUnit[], path: string): unknown {
  if (typeof spec === "string") {
    switch (spec) {
      case "org": return typeof value === "string" && isCScopedUnit(value) && units.includes(value) ? value : fail(`ORG ${path}`);
      case "id": if (typeof value !== "string" || value.length < 1 || value.length > 120) fail(`ID ${path}`); scan(value as string, "id", units); return value;
      case "text": if (typeof value !== "string" || value.length < 1 || value.length > 600) fail(`TEXT ${path}`); scan(value as string, "text", units); return value;
      case "desc": if (typeof value !== "string" || value.length > 500) fail(`DESC ${path}`); scan(value as string, "desc", units); return value;
      case "hash": return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : fail(`HASH ${path}`);
      case "int": return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fail(`INT ${path}`);
      case "money": return typeof value === "string" && MONEY.test(value) ? value : fail(`MONEY ${path}`);
      case "null": return value === null ? null : fail(`NULL ${path}`);
      case "count": return typeof value === "number" && Number.isSafeInteger(value) && (value === 0 || value >= 5) ? value : fail(`COUNT ${path}`);
      case "share": return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fail(`SHARE ${path}`);
      case "num": return typeof value === "number" && Number.isFinite(value) && Math.abs(value) < 1e12 ? value : fail(`NUM ${path}`);
      case "bool": return typeof value === "boolean" ? value : fail(`BOOL ${path}`);
    }
  }
  if ("lit" in spec) return spec.lit.includes(value as string | number) ? value : fail(`VALUE ${path}`);
  if ("nullable" in spec) return value === null ? null : rebuild(value, spec.nullable, units, path);
  if ("list" in spec) {
    if (!Array.isArray(value) || value.length > spec.max) fail(`LIST ${path}`);
    return (value as unknown[]).map((v, i) => rebuild(v, spec.list, units, `${path}[${i}]`));
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`OBJECT ${path}`);
  const record = value as Record<string, unknown>, wanted = Object.keys(spec.obj);
  for (const key of Object.keys(record)) {
    if ((C_REVIEWER_ONLY_KEYS as readonly string[]).includes(key)) fail(`REVIEWER_ONLY ${path}.${key}`);
    if (!wanted.includes(key)) fail(`UNKNOWN_FIELD ${path}.${key}`);
  }
  const out: Record<string, unknown> = {};
  for (const key of wanted) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) fail(`MISSING_FIELD ${path}.${key}`);
    out[key] = rebuild(record[key], spec.obj[key], units, `${path}.${key}`);
  }
  return out;
}

/** Returns a fresh copy of `value` holding only the schema's keys, or throws CScopedGuardError. */
export function guardCScopedPayload<T>(kind: CScopedPayloadKind, value: unknown, units: readonly CScopedUnit[]): T {
  if (!Array.isArray(units) || units.length === 0 || !units.every(isCScopedUnit)) fail("AUDIENCE");
  return rebuild(value, C_SCOPED_PAYLOAD_SPECS[kind], units, kind) as T;
}

const CLIENT_AUDIENCE_KEYS = ["schema", "kind", "monthlyMode", "aggregateKey", "orgs", "defaultOrg", "budgetOrgs", "capabilities", "scopeLine", "exportLabel"] as const;
const CAPABILITY_KEYS = ["workbook", "insights", "evidence", "pvm", "lineage", "syntheticBudgets"] as const;
/** The audience a scoped page receives: its own units only, every capability off, and no name but its own.
 * The viewer's own organisation name (O1) is the one string exempt from the place-name rule. */
export function guardCClientAudience<T>(value: unknown, audience: PillarCScopedAudience): T {
  const units = audience.units as readonly CScopedUnit[], own = audience.kind === "azienda" ? audience.orgName : null;
  const closed = (v: unknown, keys: readonly string[], path: string) => {
    if (v === null || typeof v !== "object" || Array.isArray(v)) fail(`OBJECT ${path}`);
    const r = v as Record<string, unknown>;
    if (Object.keys(r).length !== keys.length || !keys.every((k) => Object.prototype.hasOwnProperty.call(r, k))) fail(`FIELDS ${path}`);
    return r;
  };
  const label = (v: unknown, key: string, path: string) => {
    if (typeof v !== "string" || v.length < 1 || v.length > 200) fail(`LABEL ${path}`);
    if (own !== null && audience.kind === "azienda" && key === audience.unit) return v === own ? v : fail(`OWN_LABEL ${path}`);
    scan(v as string, "text", units); return v;
  };
  const line = (v: unknown, path: string) => {
    if (typeof v !== "string" || v.length < 1 || v.length > 400) fail(`LINE ${path}`);
    scan(own ? (v as string).split(own).join(" ") : v as string, "text", units); return v;
  };
  const options = (v: unknown, keys: readonly string[], path: string) => {
    if (!Array.isArray(v) || v.length !== keys.length) fail(`OPTIONS ${path}`);
    return (v as unknown[]).map((o, i) => { const r = closed(o, ["key", "label"], `${path}[${i}]`); if (r.key !== keys[i]) fail(`OPTION_KEY ${path}[${i}]`); return { key: r.key, label: label(r.label, r.key as string, `${path}[${i}]`) }; });
  };
  const c = closed(value, CLIENT_AUDIENCE_KEYS, "audience");
  if (c.schema !== "pillar-c-client-audience-v1" || c.kind !== audience.kind || c.monthlyMode !== "explicit" || c.aggregateKey !== "aggregato" || c.defaultOrg !== units[0]) fail("AUDIENCE_SHAPE");
  const capabilities = closed(c.capabilities, CAPABILITY_KEYS, "audience.capabilities");
  if (!CAPABILITY_KEYS.every((k) => capabilities[k] === false)) fail("CAPABILITY");
  const budgetKeys = audience.kind === "azienda" ? [audience.unit] : units.filter((u) => u !== "aggregato");
  return { schema: c.schema, kind: c.kind, monthlyMode: c.monthlyMode, aggregateKey: c.aggregateKey, orgs: options(c.orgs, units, "audience.orgs"), defaultOrg: c.defaultOrg,
    budgetOrgs: options(c.budgetOrgs, budgetKeys, "audience.budgetOrgs"), capabilities: Object.fromEntries(CAPABILITY_KEYS.map((k) => [k, false])),
    scopeLine: line(c.scopeLine, "audience.scopeLine"), exportLabel: line(c.exportLabel, "audience.exportLabel") } as T;
}
