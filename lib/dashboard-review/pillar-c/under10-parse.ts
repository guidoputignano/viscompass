import "server-only";
/** Server-only parser of the under-€10 DPC medicine list (build u10-v1; under10.ts holds the browser-safe types).
 *
 * A closed schema of its own: every key exact, every amount a non-negative safe integer (cents or packs), every AIC nine
 * digits, every text short and printable. Every string is screened for place names and NSIS Azienda codes; the province
 * screen applies to the unit keys only, since AIFA pack descriptions name packaging materials such as «PE». On top of the
 * shape, what a schema cannot check:
 *   - each row's unrounded average acquisition per pack is below the threshold (acquisition < 10 € × packs);
 *   - one row per AIC; rows by total service, highest first, then AIC;
 *   - the rows and the «others» row add up to the total, product by product, pack by pack and cent by cent;
 *   - the «others» row averages below the threshold too, and counts no more zero-acquisition products than it holds.
 * Any failure throws a PILLAR_C_UNDER10_ error; the loaders turn it into «unavailable», never a partial list. */
import { C_NSIS_CODE, C_PLACE_NAME, C_PROVINCE_TOKEN } from "@/lib/dashboard-review/pillar-c/payload-guard";
import { C_U10_UNITS, type CU10Entry, type CU10Object, type CU10Others, type CU10Row, type CU10Unit, type CU10View } from "@/lib/dashboard-review/pillar-c/under10";

export class CUnder10Error extends Error {
  constructor(reason: string) { super(`PILLAR_C_UNDER10_${reason}`); }
}
const fail = (reason: string): never => { throw new CUnder10Error(reason); };

/** The loaders' answer: ready with the audience's ASLs, or a state without any value. */
export type CUnder10Load = { state: "ready"; view: CU10View } | { state: "unavailable" | "not_configured" | "forbidden" };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function keys(v: unknown, want: readonly string[], where: string): Record<string, unknown> {
  if (!isObject(v)) return fail(`SHAPE ${where}`);
  const got = Object.keys(v);
  if (got.length !== want.length || want.some((k) => !Object.hasOwn(v, k))) fail(`KEYS ${where}`);
  return v;
}
const count = (v: unknown, where: string, min = 0): number => (Number.isSafeInteger(v) && (v as number) >= min ? v as number : fail(`NUMBER ${where}`));
/** Printable text of AIFA's lists: no control character, no markup, at most 200 characters, screened. */
function text(v: unknown, where: string): string {
  if (typeof v !== "string" || !v.trim() || v.length > 200 || /[\u0000-\u001f\u007f<>]/.test(v)) return fail(`TEXT ${where}`);
  if (C_PLACE_NAME.test(v)) fail(`PLACE ${where}`);
  if (C_NSIS_CODE.test(v)) fail(`NSIS ${where}`);
  return v;
}

const ROW = ["aic", "medicine", "pack", "ingredient", "packs", "acquisitionCents", "serviceCents"] as const;
const OTHERS = ["products", "packs", "acquisitionCents", "serviceCents", "zeroAcquisition"] as const;
const TOTAL = ["products", "packs", "acquisitionCents", "serviceCents"] as const;

function row(v: unknown, threshold: number, where: string): CU10Row {
  const r = keys(v, ROW, where);
  if (typeof r.aic !== "string" || !/^[0-9]{9}$/.test(r.aic)) fail(`AIC ${where}`);
  const out: CU10Row = { aic: r.aic as string, medicine: text(r.medicine, where), pack: text(r.pack, where), ingredient: text(r.ingredient, where),
    packs: count(r.packs, where, 1), acquisitionCents: count(r.acquisitionCents, where), serviceCents: count(r.serviceCents, where) };
  if (out.acquisitionCents >= threshold * out.packs) fail(`THRESHOLD ${where}`);
  return out;
}

function entry(v: unknown, threshold: number): CU10Entry {
  const e = keys(v, ["unit", "total", "rows", "others"], "unit");
  if (typeof e.unit !== "string" || !(C_U10_UNITS as readonly string[]).includes(e.unit) || C_PROVINCE_TOKEN.test(e.unit)) fail("UNIT");
  const unit = e.unit as CU10Unit;
  const t = keys(e.total, TOTAL, `${unit} total`);
  const total = { products: count(t.products, unit, 1), packs: count(t.packs, unit, 1), acquisitionCents: count(t.acquisitionCents, unit), serviceCents: count(t.serviceCents, unit) };
  if (!Array.isArray(e.rows)) return fail(`ROWS ${unit}`);
  const rows = (e.rows as unknown[]).map((r, i) => row(r, threshold, `${unit} row ${i}`));
  if (new Set(rows.map((r) => r.aic)).size !== rows.length) fail(`DUPLICATE ${unit}`);
  rows.forEach((r, i) => { const p = rows[i - 1]; if (p && (p.serviceCents < r.serviceCents || (p.serviceCents === r.serviceCents && p.aic > r.aic))) fail(`ORDER ${unit}`); });
  let others: CU10Others | null = null;
  if (e.others !== null) {
    const o = keys(e.others, OTHERS, `${unit} others`);
    others = { products: count(o.products, unit, 1), packs: count(o.packs, unit, 1), acquisitionCents: count(o.acquisitionCents, unit), serviceCents: count(o.serviceCents, unit), zeroAcquisition: count(o.zeroAcquisition, unit) };
    if (others.zeroAcquisition > others.products || others.packs < others.products || others.acquisitionCents >= threshold * others.packs) fail(`OTHERS ${unit}`);
  }
  const add = (k: "packs" | "acquisitionCents" | "serviceCents") => rows.reduce((a, r) => a + r[k], 0) + (others ? others[k] : 0);
  if (rows.length + (others?.products ?? 0) !== total.products || (["packs", "acquisitionCents", "serviceCents"] as const).some((k) => add(k) !== total[k])) fail(`TOTAL ${unit}`);
  return { unit, total, rows, others };
}

/** An object: one ASL (an Azienda's) or the four in order (the Regione's and the reviewer's). */
export function parseCUnder10(raw: unknown, units: readonly CU10Unit[]): CU10Entry[] {
  const o = keys(raw, ["schema", "build", "period", "channel", "thresholdCents", "minRecipients", "units"], "object");
  if (o.schema !== "pillar-c-under10-v1" || o.build !== "u10-v1" || o.period !== "2026-01" || o.channel !== "DPC" || o.thresholdCents !== 1000 || o.minRecipients !== 5) fail("HEADER");
  if (!Array.isArray(o.units) || o.units.length !== units.length) return fail("UNITS");
  const entries = (o.units as unknown[]).map((u) => entry(u, (o as CU10Object).thresholdCents));
  if (entries.some((e, i) => e.unit !== units[i])) fail("UNIT_ORDER");
  return entries;
}
