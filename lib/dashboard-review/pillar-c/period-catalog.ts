import "server-only";
import type { CExtensionView, CExtFileF, CExtJanuary, CExtUnitCost } from "@/lib/dashboard-review/pillar-c/extension";
import { isCScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";
import { C_PERIOD_CAPABILITIES } from "@/lib/dashboard-review/pillar-c/period-contract";
import type { CPeriodCapability, CPeriodCatalog, CPeriodEntry, CPeriodMode, CPeriodSelection } from "@/lib/dashboard-review/pillar-c/period-contract";

export type CPeriodDataset =
  | { kind: "legacy-dpc"; january: CExtJanuary; unitCosts: { products: CExtUnitCost[] } | null }
  | { kind: "legacy-file-f-year"; fileF: CExtFileF }
  | { kind: "legacy-file-f-month"; month: string; reportedAmount: number | null; mode09Amount: number | null; withoutMode09Amount: number | null; identifiers: number | null };
export type CPeriodSelectionResult =
  | { status: "ready"; entry: CPeriodEntry; data: CPeriodDataset }
  | { status: "unavailable_period" | "unsupported_capability" | "invalid_selection" };

// Ephemeral object-identity binding, not a process data cache: no caller identity,
// service client, network read, or reusable cross-request key. JSON/catalogue
// copies cannot authorize a selection. The original authorized view is snapshotted.
const datasets = new WeakMap<CPeriodCatalog, ReadonlyMap<string, CPeriodDataset>>();
function fail(at: string): never { throw new Error(`C_PERIOD_INVALID:${at}`); }
const monthPattern = /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/;
const capSet = new Set<string>(C_PERIOD_CAPABILITIES);
type Obj = Record<string, unknown>;

function object(value: unknown, fields: readonly string[], at: string): Obj {
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(at);
  const o = value as Obj;
  const own = Reflect.ownKeys(o);
  if (own.length !== fields.length || own.some((k) => typeof k !== "string" || !fields.includes(k))) fail(at);
  for (const field of fields) {
    const d = Object.getOwnPropertyDescriptor(o, field);
    if (!d || !("value" in d) || !d.enumerable) fail(`${at}.${field}`);
  }
  return o;
}
function array(value: unknown, at: string): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) fail(at);
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i) || !Object.getOwnPropertyDescriptor(value, String(i))?.enumerable || !("value" in Object.getOwnPropertyDescriptor(value, String(i))!)) fail(at);
  return value;
}
function text(value: unknown, at: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 500 || /[\u0000-\u001f\u007f]/.test(value)) fail(at);
  return value;
}
function number(value: unknown, at: string, count = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || (count && (!Number.isSafeInteger(value) || value < 0))) fail(at);
  return value;
}
function share(value: unknown, at: string): void { const n = number(value, at); if (n < 0 || n > 1) fail(at); }
function bool(value: unknown, at: string): void { if (typeof value !== "boolean") fail(at); }
function month(value: unknown, at: string): string { const m = text(value, at); if (!monthPattern.test(m)) fail(at); return m; }
function nullableNumbers(o: Obj, keys: string[], at: string): void { for (const k of keys) if (o[k] !== null) number(o[k], `${at}.${k}`); }
function quartiles(value: unknown, at: string): void {
  if (value === null) return;
  const q = object(value, ["q1", "median", "q3"], at);
  for (const k of ["q1", "median", "q3"]) number(q[k], at);
  if ((q.q1 as number) > (q.median as number) || (q.median as number) > (q.q3 as number)) fail(at);
}
function cells(value: unknown, at: string): void {
  const seen = new Set<string>();
  for (const v of array(value, at)) {
    const c = object(v, ["id", "label", "count", "share"], at);
    const id = text(c.id, at); if (seen.has(id)) fail(at); seen.add(id);
    text(c.label, at); number(c.count, at, true); share(c.share, at);
  }
}
function distribution(value: unknown, at: string, expectedTotal?: number): void {
  const d = object(value, ["status", "total", "cells"], at);
  if (d.status !== "released" && d.status !== "withheld") fail(at);
  if (d.total !== null) number(d.total, at, true);
  cells(d.cells, at);
  if (d.status === "withheld" && (d.total !== null || (d.cells as unknown[]).length !== 0)) fail(at);
  if (d.status === "released" && d.total === null) fail(at);
  if (d.status === "released") {
    const total = d.total as number, rows = d.cells as { count: number; share: number }[];
    if (rows.reduce((n, c) => n + c.count, 0) !== total || (expectedTotal !== undefined && total !== expectedTotal)) fail(`${at}.total`);
    if (rows.some((c) => Math.abs(c.share - (total ? c.count / total : 0)) > 0.0005 + 1e-9)) fail(`${at}.share`);
  }
}
function sex(value: unknown, at: string): void {
  const s = object(value, ["female", "male", "unknownLeftOut"], at);
  share(s.female, at); share(s.male, at); bool(s.unknownLeftOut, at);
}
function january(value: unknown, aggregate: boolean): void {
  const j = object(value, ["recipients", "recipientsAreSum", "age", "sex", "cost", "use", "ingredients", "portfolioStatus", "singleCandidateReach", "attribution", "services"], "january");
  const recipients = number(j.recipients, "recipients", true); if (j.recipientsAreSum !== aggregate) fail("sum-basis");
  distribution(j.age, "age", recipients); sex(j.sex, "sex"); distribution(j.ingredients, "ingredients", recipients);
  cells(j.portfolioStatus, "portfolioStatus"); cells(j.singleCandidateReach, "singleCandidateReach");
  const cost = object(j.cost, ["quartiles", "bins", "top10", "top20", "gini", "lorenz"], "cost");
  quartiles(cost.quartiles, "cost.quartiles"); distribution(cost.bins, "cost.bins", recipients);
  for (const k of ["top10", "top20", "gini"]) if (cost[k] !== null) share(cost[k], k);
  if (cost.lorenz !== null) {
    const curve = array(cost.lorenz, "lorenz");
    if (curve.length !== 11 || curve[0] !== 0 || curve[10] !== 1) fail("lorenz");
    curve.forEach((v, i) => { share(v, "lorenz"); if (i && (v as number) < (curve[i - 1] as number)) fail("lorenz"); });
  }
  const use = object(j.use, ["packs", "prescriptions", "distinctAICs"], "use");
  for (const k of ["packs", "prescriptions", "distinctAICs"]) { const u = object(use[k], ["quartiles", "bins"], k); quartiles(u.quartiles, k); distribution(u.bins, k, recipients); if (aggregate && u.quartiles !== null) fail("aggregate-quantiles"); }
  const a = object(j.attribution, ["single", "narrowed", "indicative", "notInformative", "agreementLines", "sharedRecipientsNarrowed"], "attribution");
  for (const k of Object.keys(a)) if (a[k] !== null) share(a[k], k);
  const serviceKeys = ["serviceShare", "servicePerPack", "under10Packs", "under10Service", "pharmacies", "pharmacyTop10", "intervalQ1", "intervalMedian", "intervalQ3", "within7", "sameDay", "pharmacyFeeQ1", "pharmacyFeeMedian", "pharmacyFeeQ3"];
  const s = object(j.services, serviceKeys, "services"); nullableNumbers(s, serviceKeys, "services");
  if (aggregate && [cost.quartiles, cost.top10, cost.top20, cost.gini, cost.lorenz, ...serviceKeys.filter((k) => !["serviceShare", "servicePerPack"].includes(k)).map((k) => s[k]), a.agreementLines, a.sharedRecipientsNarrowed].some((v) => v !== null)) fail("aggregate-nonadditive");
}
function orderedMonths(value: unknown, fields: string[], at: string, year: number): Obj[] {
  let previous = "";
  return array(value, at).map((v) => {
    const row = object(v, fields, at); const m = month(row.month, at);
    if (!m.startsWith(`${year}-`) || m <= previous) fail(at); previous = m;
    for (const k of fields.filter((k) => k !== "month")) number(row[k], `${at}.${k}`, k === "count");
    return row;
  });
}
function fileF(value: unknown): void {
  const f = object(value, ["year", "identifiers", "identifiersByMonth", "age", "sex", "ageUnknownPooled", "concentration", "contacts", "monthsActive", "medianContacts", "medianMonths", "portfolioShares", "singleCandidateReach", "months", "modes", "bridges"], "fileF");
  // This is a legacy adapter, not permission to reinterpret another year under
  // the frozen packet. New years arrive through the successor source pipeline.
  if (f.year !== 2025) fail("legacy-fileF-year");
  const count = number(f.identifiers, "identifiers", true);
  const ids = orderedMonths(f.identifiersByMonth, ["month", "count"], "identifiersByMonth", f.year);
  if (ids.some((r) => (r.count as number) > count)) fail("monthly-identifiers");
  const months = orderedMonths(f.months, ["month", "amount", "mode09", "withoutMode09"], "months", f.year);
  if (!months.length || !ids.length || months.some((r) => Math.abs((r.amount as number) - (r.mode09 as number) - (r.withoutMode09 as number)) > 0.011)) fail("monthly-amounts");
  distribution(f.age, "fileF.age", count); sex(f.sex, "fileF.sex"); bool(f.ageUnknownPooled, "ageUnknownPooled");
  distribution(f.contacts, "contacts", count); distribution(f.monthsActive, "monthsActive", count);
  number(f.medianContacts, "medianContacts"); number(f.medianMonths, "medianMonths");
  const c = object(f.concentration, ["q1", "median", "q3", "top10", "top1", "gini", "top10WithoutMode09", "top1WithoutMode09"], "concentration");
  for (const k of Object.keys(c)) { if (["q1", "median", "q3"].includes(k)) number(c[k], k); else share(c[k], k); }
  const p = object(f.portfolioShares, ["single", "shared", "unmapped"], "portfolioShares"); for (const v of Object.values(p)) share(v, "portfolioShares");
  for (const v of array(f.singleCandidateReach, "singleCandidateReach")) { const r = object(v, ["id", "label", "share"], "reach"); text(r.id, "reach"); text(r.label, "reach"); share(r.share, "reach"); }
  for (const v of array(f.modes, "modes")) { const r = object(v, ["id", "label", "rowsShare", "amountShare"], "mode"); text(r.id, "mode"); text(r.label, "mode"); share(r.rowsShare, "mode"); share(r.amountShare, "mode"); }
  for (const v of array(f.bridges, "bridges")) {
    const keys = ["from", "to", "opening", "closing", "change", "continuingIncrease", "continuingDecrease", "entries", "exits", "mode09Change", "withoutMode09", "products", "top10Share"];
    const b = object(v, keys, "bridge"); const from = month(b.from, "bridge.from"), to = month(b.to, "bridge.to");
    if (monthOrdinal(to) - monthOrdinal(from) !== 1 || !months.some((r) => r.month === from) || !months.some((r) => r.month === to)) fail("nonadjacent-bridge");
    for (const k of keys.filter((k) => !["from", "to"].includes(k))) number(b[k], k, k === "products");
  }
}
function monthOrdinal(m: string): number { return Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1; }
function freeze<T>(v: T): T { if (v !== null && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function capability(v: unknown): v is CPeriodCapability { return typeof v === "string" && capSet.has(v); }

/** Validates serializable metadata only. Passing this check never authorizes a
 * dataset read: selectCPeriodDataset also requires the original server binding. */
export function validateCPeriodCatalog(value: unknown): value is CPeriodCatalog {
  try {
    const c = object(value, ["schema", "mode", "entries"], "catalog");
    if (c.schema !== "pillar-c-period-catalog-v1" || (c.mode !== "real" && c.mode !== "synthetic")) fail("schema");
    const seen = new Set<string>();
    for (const v of array(c.entries, "entries")) {
      const e = object(v, ["id", "sourceFamily", "unit", "label", "granularity", "windowFrom", "windowTo", "timeBasis", "populationBasis", "observedMonths", "certifiedComplete", "capabilities"], "entry");
      if (!isCScopedUnit(e.unit) || (e.sourceFamily !== "nsis-dpc" && e.sourceFamily !== "file-f") || (e.granularity !== "month" && e.granularity !== "year") || e.certifiedComplete !== false) fail("entry");
      text(e.label, "label"); const from = month(e.windowFrom, "from"), to = month(e.windowTo, "to");
      if (from > to || (e.granularity === "month" && from !== to) || (e.granularity === "year" && (from.slice(0, 4) !== to.slice(0, 4) || !from.endsWith("-01") || !to.endsWith("-12")))) fail("window");
      const expected = `${e.sourceFamily}.${e.unit}.${e.granularity}.${from}`;
      if (e.id !== expected || seen.has(expected)) fail("id"); seen.add(expected);
      const expectedTime = e.sourceFamily === "nsis-dpc" ? "reporting-month" : e.granularity === "year" ? "recorded-dispensing-year" : "recorded-dispensing-month";
      const expectedPopulation = e.sourceFamily === "file-f" ? "recorded-identifiers-within-unit" : e.unit === "aggregato" ? "sum-within-unit-eligible-recipients" : "eligible-recipients-within-unit";
      if (e.timeBasis !== expectedTime || e.populationBasis !== expectedPopulation || (e.sourceFamily === "nsis-dpc" && e.granularity !== "month") || (e.sourceFamily === "file-f" && e.unit === "aggregato")) fail("basis");
      const observed = array(e.observedMonths, "observedMonths"); let previous = "";
      if (!observed.length) fail("observedMonths");
      for (const v of observed) { const m = month(v, "observedMonths"); if (m < from || m > to || m <= previous) fail("observedMonths"); previous = m; }
      const caps = array(e.capabilities, "capabilities");
      if (!caps.length || new Set(caps).size !== caps.length || caps.some((v) => !capability(v))) fail("capabilities");
      const allowed = e.sourceFamily === "nsis-dpc"
        ? ["recipient-count", "recipient-age", "recipient-sex", "expenditure-distribution", "utilization-packs", "utilization-prescriptions", "utilization-products", "utilization-atc5", "portfolio-summary", "attribution-summary", "distribution-services", "product-unit-costs"]
        : e.granularity === "month" ? ["reported-amount", "identifier-count"]
          : ["identifier-count", "recipient-age", "recipient-sex", "expenditure-distribution", "portfolio-summary", "contact-distribution", "active-months-distribution", "monthly-series", "product-change-bridge"];
      if (caps.some((v) => !allowed.includes(v as string))) fail("source-capabilities");
      if (e.unit === "aggregato" && caps.includes("product-unit-costs")) fail("aggregate-capabilities");
    }
    return true;
  } catch { return false; }
}

/** Input MUST come from an already-authorized extension loader. This adapter
 * neither derives roles nor widens that view. Multiple File F holders are all
 * retained; it does not change what the frozen source parser currently admits. */
export function buildCPeriodCatalog(view: CExtensionView, options: { mode?: CPeriodMode } = {}): CPeriodCatalog {
  object(options, Object.hasOwn(options, "mode") ? ["mode"] : [], "options");
  const mode = options.mode ?? "real"; if (mode !== "real" && mode !== "synthetic") fail("mode");
  object(view, ["units", "drivers", "baskets", "fileFBasket", "findings"], "view");
  const entries: CPeriodEntry[] = [], payloads = new Map<string, CPeriodDataset>(), units = new Set<string>();
  const add = (e: CPeriodEntry, data: CPeriodDataset) => { entries.push(e); payloads.set(e.id, freeze(structuredClone(data))); };
  for (const candidate of array(view.units, "units")) {
    const u = object(candidate, ["key", "label", "data"], "unit");
    if (!isCScopedUnit(u.key) || units.has(u.key)) fail("duplicate-unit"); units.add(u.key); const unit = u.key;
    const label = text(u.label, "unit.label");
    const p = object(u.data, ["schema", "unit", "period", "channel", "january", "unitCosts", "fileF", "notes"], "packet");
    if (p.schema !== "pillar-c-extension-unit-v2" || p.unit !== unit || p.period !== "2026-01" || p.channel !== "DPC") fail("legacy-identity");
    january(p.january, unit === "aggregato");
    const notes = object(p.notes, ["fileFMode09"], "notes"); if (notes.fileFMode09 !== null) text(notes.fileFMode09, "notes");
    if (p.unitCosts !== null) {
      const costs = object(p.unitCosts, ["products"], "unitCosts"); if (unit === "aggregato") fail("aggregate-unitCosts");
      const aics = new Set<string>();
      for (const v of array(costs.products, "products")) { const r = object(v, ["aic", "name", "pack", "atc", "acquisition", "service", "combined"], "product"); const aic = text(r.aic, "aic"); if (!/^\d{9}$/.test(aic) || aics.has(aic)) fail("aic"); aics.add(aic); for (const k of ["name", "pack", "atc"]) text(r[k], k); for (const k of ["acquisition", "service", "combined"]) number(r[k], k); }
    }
    const dpcCaps: CPeriodCapability[] = ["recipient-count", "recipient-age", "recipient-sex", "expenditure-distribution", "utilization-packs", "utilization-prescriptions", "utilization-products", "utilization-atc5", "portfolio-summary", "attribution-summary", "distribution-services"];
    if (p.unitCosts !== null) dpcCaps.push("product-unit-costs");
    add({ id: `nsis-dpc.${unit}.month.2026-01`, sourceFamily: "nsis-dpc", unit, label, granularity: "month", windowFrom: "2026-01", windowTo: "2026-01", timeBasis: "reporting-month", populationBasis: unit === "aggregato" ? "sum-within-unit-eligible-recipients" : "eligible-recipients-within-unit", observedMonths: ["2026-01"], certifiedComplete: false, capabilities: dpcCaps }, { kind: "legacy-dpc", january: p.january as CExtJanuary, unitCosts: p.unitCosts as { products: CExtUnitCost[] } | null });
    if (p.fileF === null) continue;
    if (unit === "aggregato") fail("aggregate-fileF"); fileF(p.fileF); const f = p.fileF as CExtFileF;
    const observed = [...new Set([...f.months.map((r) => r.month), ...f.identifiersByMonth.map((r) => r.month)])].sort();
    const base = { sourceFamily: "file-f" as const, unit, label, populationBasis: "recorded-identifiers-within-unit" as const, certifiedComplete: false as const };
    add({ ...base, id: `file-f.${unit}.year.${f.year}-01`, granularity: "year", windowFrom: `${f.year}-01`, windowTo: `${f.year}-12`, timeBasis: "recorded-dispensing-year", observedMonths: observed, capabilities: ["identifier-count", "recipient-age", "recipient-sex", "expenditure-distribution", "portfolio-summary", "contact-distribution", "active-months-distribution", "monthly-series", "product-change-bridge"] }, { kind: "legacy-file-f-year", fileF: f });
    for (const m of observed) {
      const amount = f.months.find((r) => r.month === m), ids = f.identifiersByMonth.find((r) => r.month === m);
      const capabilities: CPeriodCapability[] = []; if (amount) capabilities.push("reported-amount"); if (ids) capabilities.push("identifier-count");
      add({ ...base, id: `file-f.${unit}.month.${m}`, granularity: "month", windowFrom: m, windowTo: m, timeBasis: "recorded-dispensing-month", observedMonths: [m], capabilities }, { kind: "legacy-file-f-month", month: m, reportedAmount: amount?.amount ?? null, mode09Amount: amount?.mode09 ?? null, withoutMode09Amount: amount?.withoutMode09 ?? null, identifiers: ids?.count ?? null });
    }
  }
  const catalog: CPeriodCatalog = freeze({ schema: "pillar-c-period-catalog-v1", mode, entries });
  if (!validateCPeriodCatalog(catalog)) fail("built-catalog"); datasets.set(catalog, payloads); return catalog;
}

/** Returns a new metadata-only object suitable for a client component. It is
 * intentionally NOT a valid server selection handle. */
export function publicCPeriodCatalog(catalog: CPeriodCatalog): CPeriodCatalog {
  if (!validateCPeriodCatalog(catalog) || !datasets.has(catalog)) fail("unbound-catalog");
  return freeze(structuredClone(catalog));
}

export function selectCPeriodDataset(catalog: CPeriodCatalog, selection: CPeriodSelection | unknown): CPeriodSelectionResult {
  if (!validateCPeriodCatalog(catalog) || !datasets.has(catalog)) return { status: "invalid_selection" };
  let s: Obj;
  try {
    s = object(selection, ["datasetId", "sourceFamily", "unit", "windowFrom", "windowTo", "capability"], "selection");
    if (!isCScopedUnit(s.unit) || (s.sourceFamily !== "nsis-dpc" && s.sourceFamily !== "file-f") || !capability(s.capability)) fail("selection");
    text(s.datasetId, "datasetId"); const from = month(s.windowFrom, "windowFrom"), to = month(s.windowTo, "windowTo"); if (from > to) fail("window");
  } catch { return { status: "invalid_selection" }; }
  const entry = catalog.entries.find((e) => e.id === s.datasetId);
  if (!entry) return { status: "unavailable_period" };
  if (entry.sourceFamily !== s.sourceFamily || entry.unit !== s.unit || entry.windowFrom !== s.windowFrom || entry.windowTo !== s.windowTo) return { status: "invalid_selection" };
  if (!entry.capabilities.includes(s.capability as CPeriodCapability)) return { status: "unsupported_capability" };
  const data = datasets.get(catalog)?.get(entry.id); if (!data) return { status: "invalid_selection" };
  return { status: "ready", entry, data: structuredClone(data) };
}
