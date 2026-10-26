import { isCScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";
import type { CPeriodMode, CPeriodSourceFamily } from "@/lib/dashboard-review/pillar-c/period-contract";

/** A readiness gate, not a model or publication decision. There is deliberately
 * no registered DPC/File F method or borrowed AIFA threshold in this module.
 * Inputs belong to the private pipeline; only the result is presentation-safe.
 * Hashes must be independently bound to the actual history/evidence upstream:
 * matching asserted strings here does not authenticate an uploaded receipt.
 * This gate is retrospective chronological readiness only: observedAt bounds
 * final-cutoff availability, not the vintages available at every rolling origin.
 * registeredAt is a recorded method date, NOT a claim of preregistration.
 * Real-time vintage validation and forecast publication remain out of scope. */
export type CPeriodForecastIdentity = Readonly<{
  sourceFamily: CPeriodSourceFamily;
  unit: CScopedUnit;
  mode: CPeriodMode;
  amountBasis: string;
}>;
export type CPeriodForecastPoint = CPeriodForecastIdentity & Readonly<{
  month: string;
  value: number | null;
  observedAt: string;
}>;
export type CPeriodForecastMethod = Readonly<{
  id: string;
  methodologySha256: string;
  registeredAt: string;
  sourceFamily: CPeriodSourceFamily;
  amountBasis: string;
  target: "monthly-reported-expenditure";
  minTrainingMonths: number;
  minOrigins: number;
  maxHorizon: number;
}>;
export type CPeriodForecastCheck = Readonly<{
  status: "pending" | "passed" | "failed";
  evidenceSha256: string | null;
}>;
export type CPeriodForecastValidation = Readonly<{
  methodologySha256: string;
  historySha256: string;
  cutoffMonth: string;
  checkedAt: string;
  chronologicalTrainingOnly: boolean;
  origins: number;
  evaluatedHorizon: number;
  baseline: CPeriodForecastCheck;
  backtest: CPeriodForecastCheck;
  uncertainty: CPeriodForecastCheck;
}>;
export type CPeriodForecastRequest = CPeriodForecastIdentity & Readonly<{
  target: "monthly-reported-expenditure";
  historyFrom: string;
  cutoffMonth: string;
  asOfDate: string;
  horizon: number;
  historySha256: string;
  history: readonly CPeriodForecastPoint[];
  method: CPeriodForecastMethod | null;
  validation: CPeriodForecastValidation | null;
}>;
export type CPeriodForecastBlockReason = "invalid_history" | "insufficient_history" | "missing_months" |
  "synthetic_only" | "method_not_registered" | "validation_pending" | "not_admitted";
type Summary = Readonly<{
  observedMonths: number;
  expectedMonths: number;
  missingMonths: number;
  requiredMonths: number | null;
}>;
export type CPeriodForecastReadiness = Summary & (
  | Readonly<{ status: "blocked"; reason: CPeriodForecastBlockReason }>
  | Readonly<{ status: "eligible_for_candidate_review" }>
);

type Obj = Record<string, unknown>;
const monthPattern = /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/;
const hashPattern = /^[a-f0-9]{64}$/;
const tokenPattern = /^[a-z0-9][a-z0-9_.-]{0,119}$/;
const identityKeys = ["sourceFamily", "unit", "mode", "amountBasis"];
function record(value: unknown, keys: readonly string[]): value is Obj {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && own.every((key) => typeof key === "string" && keys.includes(key)) &&
    keys.every((key) => { const d = Object.getOwnPropertyDescriptor(value, key); return !!d && "value" in d && d.enumerable; });
}
function denseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 1200 || Reflect.ownKeys(value).length !== value.length + 1) return false;
  return Array.from({ length: value.length }, (_, i) => Object.getOwnPropertyDescriptor(value, `${i}`))
    .every((d) => !!d && "value" in d && d.enumerable);
}
function month(value: unknown): value is string { return typeof value === "string" && monthPattern.test(value); }
function hash(value: unknown): value is string { return typeof value === "string" && hashPattern.test(value); }
function positive(value: unknown, max: number): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= max; }
function ordinal(value: string): number { return Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1; }
function date(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?:19|20|21)\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function monthEnd(value: string): string {
  return new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0)).toISOString().slice(0, 10);
}
function identity(o: Obj): boolean {
  return (o.sourceFamily === "nsis-dpc" || o.sourceFamily === "file-f") && isCScopedUnit(o.unit) &&
    (o.mode === "real" || o.mode === "synthetic") && typeof o.amountBasis === "string" && tokenPattern.test(o.amountBasis);
}
function method(value: unknown): value is CPeriodForecastMethod {
  return record(value, ["id", "methodologySha256", "registeredAt", "sourceFamily", "amountBasis", "target", "minTrainingMonths", "minOrigins", "maxHorizon"]) &&
    typeof value.id === "string" && tokenPattern.test(value.id) && hash(value.methodologySha256) && date(value.registeredAt) &&
    (value.sourceFamily === "nsis-dpc" || value.sourceFamily === "file-f") && typeof value.amountBasis === "string" && tokenPattern.test(value.amountBasis) &&
    value.target === "monthly-reported-expenditure" && positive(value.minTrainingMonths, 600) && positive(value.minOrigins, 240) && positive(value.maxHorizon, 24);
}
function check(value: unknown): value is CPeriodForecastCheck {
  return record(value, ["status", "evidenceSha256"]) && ["pending", "passed", "failed"].includes(value.status as string) &&
    (value.status === "pending" ? value.evidenceSha256 === null : hash(value.evidenceSha256));
}
function validation(value: unknown): value is CPeriodForecastValidation {
  return record(value, ["methodologySha256", "historySha256", "cutoffMonth", "checkedAt", "chronologicalTrainingOnly", "origins", "evaluatedHorizon", "baseline", "backtest", "uncertainty"]) &&
    hash(value.methodologySha256) && hash(value.historySha256) && month(value.cutoffMonth) && date(value.checkedAt) && typeof value.chronologicalTrainingOnly === "boolean" &&
    typeof value.origins === "number" && Number.isSafeInteger(value.origins) && value.origins >= 0 && value.origins <= 240 &&
    typeof value.evaluatedHorizon === "number" && Number.isSafeInteger(value.evaluatedHorizon) && value.evaluatedHorizon >= 0 && value.evaluatedHorizon <= 24 &&
    check(value.baseline) && check(value.backtest) && check(value.uncertainty);
}

/** Deterministic and non-mutating. History must contain exactly one selected
 * organizational/source/basis series and no post-cutoff values. Explicit nulls
 * and absent months both block; a finite zero is an observed amount. Even the
 * success state still requires candidate review and is never publishable. */
export function evaluatePeriodForecastReadiness(input: unknown): CPeriodForecastReadiness {
  let summary: Summary = { observedMonths: 0, expectedMonths: 0, missingMonths: 0, requiredMonths: null };
  const blocked = (reason: CPeriodForecastBlockReason): CPeriodForecastReadiness => ({ status: "blocked", reason, ...summary });
  if (!record(input, [...identityKeys, "target", "historyFrom", "cutoffMonth", "asOfDate", "horizon", "historySha256", "history", "method", "validation"]) ||
    !identity(input) || input.target !== "monthly-reported-expenditure" || !month(input.historyFrom) || !month(input.cutoffMonth) ||
    !date(input.asOfDate) || !positive(input.horizon, 24) || !hash(input.historySha256) || !denseArray(input.history)) return blocked("invalid_history");
  const start = ordinal(input.historyFrom), end = ordinal(input.cutoffMonth), expected = end - start + 1;
  if (expected < 1 || expected > 1200 || monthEnd(input.cutoffMonth) > input.asOfDate) return blocked("invalid_history");
  summary = { ...summary, expectedMonths: expected };
  const seen = new Set<string>();
  let observed = 0;
  for (const point of input.history) {
    if (!record(point, [...identityKeys, "month", "value", "observedAt"]) || !identity(point) ||
      identityKeys.some((key) => point[key] !== input[key]) || !month(point.month) || !date(point.observedAt) ||
      (point.value !== null && (typeof point.value !== "number" || !Number.isFinite(point.value))) ||
      ordinal(point.month) < start || ordinal(point.month) > end || seen.has(point.month) ||
      point.observedAt > input.asOfDate || point.observedAt < monthEnd(point.month)) return blocked("invalid_history");
    seen.add(point.month);
    if (point.value !== null) observed++;
  }
  summary = { ...summary, observedMonths: observed, missingMonths: expected - observed };
  if (input.mode === "synthetic") return blocked("synthetic_only");
  if (!observed) return blocked("insufficient_history");
  if (summary.missingMonths) return blocked("missing_months");
  if (input.method === null) return blocked("method_not_registered");
  if (!method(input.method)) return blocked("method_not_registered");
  const registered = input.method;
  if (registered.sourceFamily !== input.sourceFamily || registered.amountBasis !== input.amountBasis || registered.target !== input.target || registered.registeredAt > input.asOfDate) return blocked("method_not_registered");
  if (input.horizon > registered.maxHorizon) return blocked("not_admitted");
  // Rolling origins must each have an untouched full requested horizon.
  const required = registered.minTrainingMonths + registered.minOrigins - 1 + input.horizon;
  summary = { ...summary, requiredMonths: required };
  if (observed < required) return blocked("insufficient_history");
  if (input.validation === null) return blocked("validation_pending");
  if (!validation(input.validation)) return blocked("not_admitted");
  const receipt = input.validation;
  if (receipt.methodologySha256 !== registered.methodologySha256 || receipt.historySha256 !== input.historySha256 ||
    receipt.cutoffMonth !== input.cutoffMonth || receipt.checkedAt > input.asOfDate || receipt.checkedAt < registered.registeredAt ||
    receipt.checkedAt < monthEnd(input.cutoffMonth) || input.history.some((p) => (p as Obj).observedAt as string > receipt.checkedAt)) return blocked("not_admitted");
  const checks = [receipt.baseline, receipt.backtest, receipt.uncertainty];
  if (checks.some((c) => c.status === "failed") || !receipt.chronologicalTrainingOnly) return blocked("not_admitted");
  if (checks.some((c) => c.status === "pending")) return blocked("validation_pending");
  if (receipt.origins < registered.minOrigins || receipt.evaluatedHorizon < input.horizon ||
    receipt.evaluatedHorizon > registered.maxHorizon || registered.minTrainingMonths + receipt.origins - 1 + receipt.evaluatedHorizon > observed) return blocked("not_admitted");
  return { status: "eligible_for_candidate_review", ...summary };
}
