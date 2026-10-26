import "server-only";
import { createHash } from "node:crypto";
import { C_PERIOD_AGE_IDS, C_PERIOD_USE_IDS } from "@/lib/dashboard-review/pillar-c/period-summary";
import type { CPeriodSummary } from "@/lib/dashboard-review/pillar-c/period-summary";
import { C_SCOPED_ASL_UNITS } from "@/lib/dashboard-review/pillar-c/scoped-units";

/** These pins must come from an independently accepted SERVER release manifest,
 * after session-bound authorization. Never construct them from a posted packet,
 * query string or browser catalogue. Hash matching authenticates bytes only;
 * neither this parser nor an asserted receipt grants access or publication. */
export type CPeriodSummaryPin = Readonly<{
  sha256: string; bytes: number;
  numericalVerificationSha256: string; disclosureReviewSha256: string;
  id: string; version: number; unit: CPeriodSummary["unit"];
  sourceFamily: CPeriodSummary["sourceFamily"]; mode: CPeriodSummary["mode"];
  from: string; to: string; timeBasis: CPeriodSummary["window"]["timeBasis"];
}>;

type Obj = Record<string, unknown>;
function fail(): never { throw new Error("C_PERIOD_SUMMARY_INVALID"); }
function obj(value: unknown, fields: readonly string[]): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const o = value as Obj, keys = Reflect.ownKeys(o);
  if (keys.length !== fields.length || keys.some(k => typeof k !== "string" || !fields.includes(k))) fail();
  for (const key of fields) {
    const d = Object.getOwnPropertyDescriptor(o, key);
    if (!d || !("value" in d) || !d.enumerable) fail();
  }
  return o;
}
function finite(value: unknown): number { if (typeof value !== "number" || !Number.isFinite(value)) fail(); return value; }
function count(value: unknown): number { const n=finite(value); if (!Number.isSafeInteger(n) || n < 0) fail(); return n; }
function safeCount(value: unknown): number { const n=count(value); if (n > 0 && n < 5) fail(); return n; }
function share(value: unknown): number { const n=finite(value); if (n < 0 || n > 1) fail(); return n; }
const hash = (s: unknown): s is string => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
const token = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9][a-z0-9_.-]{0,119}$/.test(s);
const isMonth = (s: unknown): s is string => typeof s === "string" && /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(s);
const ordinal = (s: string) => Number(s.slice(0,4))*12+Number(s.slice(5))-1;
const missingReasons = ["disclosure", "missing-source", "uncertified-empty", "unsupported", "missing-cost", "signed-cost", "no-recipients"];
function absent(value: unknown): boolean {
  if (!value || typeof value !== "object" || !["withheld", "unavailable"].includes((value as Obj).status as string)) return false;
  const o=obj(value,["status","reason"]);
  if (!missingReasons.includes(o.reason as string) || (o.status === "withheld") !== (o.reason === "disclosure")) fail();
  return true;
}
function distribution(value: unknown, ids: readonly string[], denominator: number | null): void {
  if (absent(value)) return;
  const o=obj(value,["status","total","cells"]);
  if (o.status !== "released" || denominator === null || safeCount(o.total) !== denominator || !Array.isArray(o.cells) || o.cells.length !== ids.length) fail();
  let total=0;
  o.cells.forEach((value,i) => {
    const c=obj(value,["id","count","share"]);
    if (c.id !== ids[i]) fail();
    const n=safeCount(c.count), s=share(c.share);
    total+=n;
    // Counts are supplied, never reconstructed from a rounded percentage.
    if (Math.abs(s-(denominator ? n/denominator : 0)) > 1e-10) fail();
  });
  if (total !== denominator) fail();
}
function quartiles(value: unknown, denominator: number | null): void {
  if (absent(value)) return;
  const o=obj(value,["status","n","q1","median","q3"]);
  if (o.status !== "released" || denominator === null || denominator < 5 || safeCount(o.n) !== denominator) fail();
  if (finite(o.q1) > finite(o.median) || finite(o.median) > finite(o.q3)) fail();
}
function concentration(value: unknown, denominator: number | null): void {
  if (absent(value)) return;
  const o=obj(value,["status","n","gini","lorenz"]);
  if (o.status !== "released" || denominator === null || denominator < 50 || count(o.n) !== denominator) fail();
  share(o.gini);
  if (!Array.isArray(o.lorenz) || o.lorenz.length !== 11 || o.lorenz[0] !== 0 || o.lorenz[10] !== 1) fail();
  let last=0, slope=0;
  o.lorenz.forEach((value,i) => {
    const s=share(value);
    if (s > i/10+1e-10 || s < last-1e-10 || (i && s-last < slope-1e-10)) fail();
    if (i) slope=s-last;
    last=s;
  });
}

/** Pure parsing of already-authorized bytes. This module performs no network
 * read, caches nothing, accepts no audience/email/client-role and has no caller
 * that activates or publishes it. No legacy guards or pins are changed. */
export function parseCPeriodSummary(raw: Uint8Array, expected: CPeriodSummaryPin, options: { allowSynthetic?: boolean } = {}): CPeriodSummary {
  const pin=obj(expected,["sha256","bytes","numericalVerificationSha256","disclosureReviewSha256","id","version","unit","sourceFamily","mode","from","to","timeBasis"]);
  if (!hash(pin.sha256) || !hash(pin.numericalVerificationSha256) || !hash(pin.disclosureReviewSha256) || !token(pin.id) ||
      !Number.isSafeInteger(pin.version) || (pin.version as number) < 1 || !(C_SCOPED_ASL_UNITS as readonly unknown[]).includes(pin.unit) ||
      !["nsis-dpc","file-f"].includes(pin.sourceFamily as string) || !["real","synthetic"].includes(pin.mode as string) ||
      (pin.mode === "synthetic" && options.allowSynthetic !== true) || !isMonth(pin.from) || !isMonth(pin.to) || pin.from > pin.to ||
      pin.timeBasis !== (pin.sourceFamily === "nsis-dpc" ? "reporting-month" : "recorded-dispensing-month") ||
      !Number.isSafeInteger(pin.bytes) || (pin.bytes as number) < 1 || (pin.bytes as number) > 200_000) fail();
  if (!(raw instanceof Uint8Array) || raw.byteLength !== pin.bytes || createHash("sha256").update(raw).digest("hex") !== pin.sha256) fail();
  let parsed: unknown;
  try { parsed=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw)); } catch { fail(); }
  const o=obj(parsed,["schema","id","version","unit","sourceFamily","mode","window","populationBasis","release","recipients","age","use","cost"]);
  if (o.schema !== "pillar-c-period-summary-v1" || ["id","version","unit","sourceFamily","mode"].some(k=>o[k] !== pin[k])) fail();
  const proof=obj(o.release,["numericalVerificationSha256","disclosureReviewSha256"]);
  if (proof.numericalVerificationSha256 !== pin.numericalVerificationSha256 || proof.disclosureReviewSha256 !== pin.disclosureReviewSha256) fail();
  const w=obj(o.window,["from","to","timeBasis","ageReferenceYear","certifiedComplete","months"]);
  if (["from","to","timeBasis"].some(k=>w[k] !== pin[k]) || typeof w.certifiedComplete !== "boolean" ||
      !Number.isSafeInteger(w.ageReferenceYear) || (w.ageReferenceYear as number) < Number((pin.from as string).slice(0,4)) ||
      (w.ageReferenceYear as number) > Number((pin.to as string).slice(0,4))) fail();
  const from=ordinal(pin.from as string), to=ordinal(pin.to as string), n=to-from+1;
  if (n > 1200 || !Array.isArray(w.months) || w.months.length !== n) fail();
  let missing=false, empty=false, allCertifiedZero=true;
  w.months.forEach((value,i)=>{
    const c=obj(value,["month","status"]);
    if (!isMonth(c.month) || ordinal(c.month) !== from+i || !["records","certified-zero","missing","uncertified-empty"].includes(c.status as string)) fail();
    missing ||= c.status === "missing";
    empty ||= c.status === "uncertified-empty";
    allCertifiedZero &&= c.status === "certified-zero";
  });
  if (w.certifiedComplete && (missing || empty)) fail();
  if (o.populationBasis !== (o.sourceFamily === "nsis-dpc" ? "eligible-recipients-within-unit" : "recorded-identifiers-within-unit")) fail();
  let denominator: number | null=null;
  if (!absent(o.recipients)) {
    const c=obj(o.recipients,["status","value"]);
    if (c.status !== "released") fail();
    denominator=safeCount(c.value);
  }
  if (missing || empty) {
    // A selected-period result cannot masquerade as the full window when source
    // months are absent or merely empty. It remains discoverable but unavailable.
    const required=missing ? "missing-source" : "uncertified-empty";
    if ((o.recipients as Obj).status !== "unavailable" || (o.recipients as Obj).reason !== required) fail();
  }
  if (allCertifiedZero && denominator !== 0) fail();
  distribution(o.age,C_PERIOD_AGE_IDS,denominator);
  const use=obj(o.use,["packs","products","contacts"]);
  for (const k of ["packs","products","contacts"]) distribution(use[k],C_PERIOD_USE_IDS,denominator);
  const cost=obj(o.cost,["quartiles","concentration"]);
  quartiles(cost.quartiles,denominator); concentration(cost.concentration,denominator);
  // Proofs stay server-side; the client receives aggregates and explicit states.
  const {release: _release, ...summary}=o;
  void _release;
  return structuredClone(summary) as CPeriodSummary;
}
