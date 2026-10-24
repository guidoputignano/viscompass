import "server-only";
/** Server-only parsers of the Pillar C additions objects (build add-v1; additions.ts holds the browser-safe types).
 *
 * Every object is screened for place names, province keys and NSIS Azienda codes, then rebuilt by the closed-schema guard
 * (payload-guard.ts, kinds «additionsUnit» and «additions»), which refuses any unknown or missing key, any count between
 * 1 and 4 and any share outside [0, 1]. On top of the shape, the parser checks what a schema cannot, as the delivery
 * disclosure review of 24 Oct 2026 requires (P8-H5, P10-H2):
 *   - P8-03: the four residence categories add up to the eligible recipients, each share is its count over them, the
 *     sum flag is set on the aggregate alone;
 *   - P10-04: the eligible recipients equal P8-03's; the hidden marker never on the aggregate and never alone on a line
 *     of the table (a row, or a column of the full table: each hidden cell has another hidden cell beside it in both);
 *     no row or column whose total minus its visible cells is 1 to 4; visible areas never above their row total; the
 *     shares coherent with each other;
 *   - P10-05: the File F fields on asl-3 alone, each group of categories partitioning the same rows, both shares exact
 *     to their rounding;
 *   - an Azienda's pair (own unit and aggregate): the aggregate minus its own figures is 0 or at least 5 wherever its own
 *     figure is visible.
 * Any failure throws a PILLAR_C_ADDITIONS_ error; the loaders turn it into «unavailable», never a partial table. */
import { CScopedGuardError, C_NSIS_CODE, C_PLACE_NAME, C_PROVINCE_TOKEN, guardCScopedPayload } from "@/lib/dashboard-review/pillar-c/payload-guard";
import { C_SCOPED_AGGREGATE, C_SCOPED_UNITS, type CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";
import {
  C_ADD_AREAS, C_ADD_CLASSES, C_ADD_FILEF_CATEGORIES, C_ADD_FILEF_GROUPS, C_ADD_FILEF_UNIT, C_ADD_ORDER, C_ADD_RESIDENCE, cAddIsHidden,
  type CAddAreaCell, type CAddEntry, type CAddFileF, type CAddFullObject, type CAddNarrowing, type CAddResidence, type CAddUnitObject, type CAdditionsView,
} from "@/lib/dashboard-review/pillar-c/additions";
import type { CExtensionView } from "@/lib/dashboard-review/pillar-c/extension";

export class CAdditionsError extends Error {
  constructor(reason: string) { super(`PILLAR_C_ADDITIONS_${reason}`); }
}
const fail = (reason: string): never => { throw new CAdditionsError(reason); };

/** The loaders' answer: ready with the audience's units, or a state without any value. */
export type CAdditionsLoad = { state: "ready"; view: CAdditionsView } | { state: "unavailable" | "not_configured" | "forbidden" };

/** A reported amount: a decimal string with exactly two decimals (no exponent, no grouping). */
const AMOUNT = /^-?(?:0|[1-9][0-9]{0,14})\.[0-9]{2}$/;
/** Half a unit of the last decimal, plus a float margin: P8-03 shares have three decimals, P10 shares four. */
const HALF3 = 0.0005 + 1e-9, HALF4 = 0.00005 + 1e-9;
const small = (n: number) => n !== 0 && n < 5;
const sum = (values: readonly number[]) => values.reduce((a, v) => a + v, 0);

/** Every string value, before the shape is read: no place name, Region, province key or NSIS Azienda code. An amount
 * is a number written as text, so the NSIS pattern (six digits) is not applied to it. */
function screen(value: unknown) {
  if (typeof value === "string") {
    if (C_PLACE_NAME.test(value)) fail("PLACE");
    if (C_PROVINCE_TOKEN.test(value)) fail("PROVINCE");
    if (!AMOUNT.test(value) && C_NSIS_CODE.test(value)) fail("NSIS");
  } else if (Array.isArray(value)) value.forEach(screen);
  else if (value && typeof value === "object") Object.values(value).forEach(screen);
}

function guarded<T>(kind: "additions" | "additionsUnit", raw: unknown, units: readonly CScopedUnit[]): T {
  screen(raw);
  try { return guardCScopedPayload<T>(kind, raw, units); }
  catch (error) { if (error instanceof CScopedGuardError) return fail(`GUARD ${error.message}`); throw error; }
}

function checkResidence(r: CAddResidence, unit: CScopedUnit) {
  if (r.recipientsAreSum !== (unit === C_SCOPED_AGGREGATE)) fail("RESIDENCE_SUM_FLAG");
  const cells = C_ADD_RESIDENCE.map((k) => r[k]);
  if (sum(cells.map((c) => c.count)) !== r.eligible) fail("RESIDENCE_PARTITION");
  if (cells.some((c) => Math.abs(c.share - (r.eligible ? c.count / r.eligible : 0)) > HALF3)) fail("RESIDENCE_SHARE");
}

function checkNarrowing(n: CAddNarrowing, unit: CScopedUnit, eligible: number) {
  const aggregate = unit === C_SCOPED_AGGREGATE;
  if (n.recipientsAreSum !== aggregate) fail("NARROWING_SUM_FLAG");
  // The same eligible cohort as P8-03 (and as the extension's January recipients, checked against it on the page).
  if (n.eligibleRecipients !== eligible) fail("NARROWING_ELIGIBLE");
  const total = n.narrowed.total, cells = C_ADD_AREAS.map((a) => n.narrowed.byArea[a]);
  const shown = cells.filter((c): c is CAddAreaCell => !cAddIsHidden(c)), hidden = cells.length - shown.length;
  if (total.recipients > n.eligibleRecipients) fail("NARROWING_TOTAL");
  // One screened table for every audience: the aggregate is never hidden, and no row holds exactly one hidden cell.
  if (aggregate && hidden > 0) fail("NARROWING_AGGREGATE_HIDDEN");
  if (hidden === 1) fail("NARROWING_ROW_SINGLE_HIDDEN");
  if (shown.some((c) => c.recipients > total.recipients)) fail("NARROWING_AREA_ABOVE_TOTAL");
  // An area's share of the eligible spend is its share of the narrowed spend times the narrowed share (each rounded).
  if (shown.some((c) => Math.abs(c.shareOfEligibleSpend - c.shareOfNarrowedSpend * total.shareOfEligibleSpend) > 3 * HALF4)) fail("NARROWING_AREA_SHARE");
  if (hidden > 0) {
    // A recipient with lines in several areas counts in each, so a row's visible counts can exceed its total; but the
    // total minus the visible counts must never read as a small hidden group.
    const rest = total.recipients - sum(shown.map((c) => c.recipients));
    if (rest >= 1 && rest <= 4) fail("NARROWING_ROW_REMAINDER");
  } else if (total.recipients > 0) {
    // Each narrowed line has one area: in a fully visible row the area shares add up to the narrowed spend.
    if (Math.abs(sum(shown.map((c) => c.shareOfNarrowedSpend)) - 1) > 6 * HALF4) fail("NARROWING_AREA_SUM");
    if (Math.abs(sum(shown.map((c) => c.shareOfEligibleSpend)) - total.shareOfEligibleSpend) > 7 * HALF4) fail("NARROWING_AREA_SUM");
  }
  // Each line has one exemption class: the classes partition the eligible spend.
  const classes = C_ADD_CLASSES.map((k) => n.lineClasses[k]);
  if (classes.some((c) => c.recipients > n.eligibleRecipients)) fail("LINE_CLASS_ABOVE_ELIGIBLE");
  if (n.eligibleRecipients > 0 && Math.abs(sum(classes.map((c) => c.shareOfEligibleSpend)) - 1) > 6 * HALF4) fail("LINE_CLASS_SUM");
}

/** Integer cents of a reported amount. */
function cents(amount: string): number {
  if (!AMOUNT.test(amount)) return fail("FILEF_AMOUNT");
  const negative = amount.startsWith("-"), [whole, decimals] = amount.replace("-", "").split(".");
  const value = Number(whole) * 100 + Number(decimals);
  return negative ? -value : value;
}

function checkFileF(f: CAddFileF | null, unit: CScopedUnit) {
  // Delivered for the one Azienda whose File F 2025 was screened, and for no other unit.
  if ((f !== null) !== (unit === C_ADD_FILEF_UNIT)) fail("FILEF_UNIT");
  if (!f) return;
  if (f.scope.organisationUnit !== unit) fail("FILEF_SCOPE");
  const c = f.categories, all = c.all, allCents = cents(all.amountEUR);
  if (all.rows === 0 || all.rowShare !== 1 || all.amountShare !== 1 || allCents <= 0) fail("FILEF_ALL");
  for (const k of C_ADD_FILEF_CATEGORIES) {
    const cell = c[k], amount = cents(cell.amountEUR);
    if (cell.rows > all.rows) fail("FILEF_ROWS");
    // Both shares are rounded half up to four decimals from exact rows and from the cent amounts.
    if (Math.abs(cell.rowShare - cell.rows / all.rows) > HALF4) fail("FILEF_ROW_SHARE");
    if (Math.abs(cell.amountShare - amount / allCents) > HALF4) fail("FILEF_AMOUNT_SHARE");
  }
  for (const group of C_ADD_FILEF_GROUPS) {
    if (sum(group.map((k) => c[k].rows)) !== all.rows) fail("FILEF_PARTITION_ROWS");
    // Each amount is rounded to the cent on its own: the group may differ from the total by one cent per category.
    if (Math.abs(sum(group.map((k) => cents(c[k].amountEUR))) - allCents) > group.length) fail("FILEF_PARTITION_AMOUNT");
  }
}

function checkEntry(e: CAddEntry) {
  checkResidence(e.residence, e.unit);
  checkNarrowing(e.narrowing, e.unit, e.residence.eligible);
  checkFileF(e.fileFFields, e.unit);
}

/** The full table (the five units of the reviewer and the Regione): the aggregate is the sum of the four ASLs (one
 * person per ASL), and no column holds exactly one hidden cell or a hidden group of fewer than 5 recipients. */
function checkFullTable(entries: readonly CAddEntry[]) {
  const [aggregate, ...asl] = entries;
  const adds = (pick: (e: CAddEntry) => number) => pick(aggregate) === sum(asl.map(pick));
  if (!adds((e) => e.residence.eligible) || !C_ADD_RESIDENCE.every((k) => adds((e) => e.residence[k].count))) fail("RESIDENCE_AGGREGATE");
  if (!adds((e) => e.narrowing.eligibleRecipients) || !adds((e) => e.narrowing.narrowed.total.recipients) || !C_ADD_CLASSES.every((k) => adds((e) => e.narrowing.lineClasses[k].recipients))) fail("NARROWING_AGGREGATE");
  for (const area of C_ADD_AREAS) {
    const column = asl.map((e) => e.narrowing.narrowed.byArea[area]), top = aggregate.narrowing.narrowed.byArea[area];
    if (cAddIsHidden(top)) return fail("NARROWING_AGGREGATE_HIDDEN");
    const shown = column.filter((c): c is CAddAreaCell => !cAddIsHidden(c)), hidden = column.length - shown.length;
    const rest = top.recipients - sum(shown.map((c) => c.recipients));
    if (hidden === 0 && rest !== 0) fail("NARROWING_COLUMN_SUM");
    if (hidden === 1) fail("NARROWING_COLUMN_SINGLE_HIDDEN");
    if (hidden > 1 && rest < 5) fail("NARROWING_COLUMN_REMAINDER");
  }
}

/** One unit object of `unit`, guarded for the audience's units. Returns its entry; throws on any defect. */
export function parseCAdditionsUnit(raw: unknown, unit: CScopedUnit, audienceUnits: readonly CScopedUnit[]): CAddEntry {
  const p = guarded<CAddUnitObject>("additionsUnit", raw, audienceUnits);
  if (p.unit !== unit) fail("UNIT");
  const entry: CAddEntry = { unit: p.unit, residence: p.residence, narrowing: p.narrowing, fileFFields: p.fileFFields };
  checkEntry(entry);
  return entry;
}

/** The full object (reviewer and Regione, the same bytes): the five units in display order. Throws on any defect. */
export function parseCAdditionsFull(raw: unknown): CAddEntry[] {
  const p = guarded<CAddFullObject>("additions", raw, C_SCOPED_UNITS);
  if (p.units.length !== C_ADD_ORDER.length || p.units.some((u, i) => u.unit !== C_ADD_ORDER[i])) fail("UNITS");
  p.units.forEach(checkEntry);
  checkFullTable(p.units);
  return p.units;
}

/** An Azienda's pair: its own unit and the aggregate. What it can derive for the other three Aziende combined (the
 * aggregate minus its own figures, accepted by O1) is 0 or at least 5 wherever its own figure is visible; the
 * aggregate itself carries no hidden cell. */
export function cAdditionsComplementCheck(own: CAddEntry, aggregate: CAddEntry) {
  if (own.unit === C_SCOPED_AGGREGATE || aggregate.unit !== C_SCOPED_AGGREGATE) fail("PAIR");
  const rest = (a: number, o: number) => { const r = a - o; if (r < 0 || small(r)) fail("COMPLEMENT"); };
  rest(aggregate.residence.eligible, own.residence.eligible);
  for (const k of C_ADD_RESIDENCE) rest(aggregate.residence[k].count, own.residence[k].count);
  rest(aggregate.narrowing.eligibleRecipients, own.narrowing.eligibleRecipients);
  rest(aggregate.narrowing.narrowed.total.recipients, own.narrowing.narrowed.total.recipients);
  for (const area of C_ADD_AREAS) {
    const o = own.narrowing.narrowed.byArea[area], g = aggregate.narrowing.narrowed.byArea[area];
    if (cAddIsHidden(g)) fail("NARROWING_AGGREGATE_HIDDEN");
    else if (!cAddIsHidden(o)) rest(g.recipients, o.recipients);
  }
  for (const k of C_ADD_CLASSES) rest(aggregate.narrowing.lineClasses[k].recipients, own.narrowing.lineClasses[k].recipients);
}

/** P8-H5: each unit's eligible recipients are the extension's January recipients of the same unit, with the same sum
 * flag. The check needs both: additions read without a readable extension are «unavailable», never shown unchecked. */
export function cAdditionsWithExtension(additions: CAdditionsLoad, extension: { state: "ready"; view: CExtensionView } | { state: string }): CAdditionsLoad {
  if (additions.state !== "ready") return additions;
  const ext = extension.state === "ready" && "view" in extension ? extension.view : null;
  if (!ext) return { state: "unavailable" };
  const same = additions.view.units.every((u) => {
    const e = ext.units.find((x) => x.key === u.key);
    return !!e && e.data.unit === u.key && e.data.january.recipients === u.entry.residence.eligible && e.data.january.recipientsAreSum === u.entry.residence.recipientsAreSum;
  });
  return same ? additions : { state: "unavailable" };
}
