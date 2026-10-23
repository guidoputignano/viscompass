import "server-only";
/** Server-only parsers of the Pillar C extension objects (extension.ts holds the browser-safe types).
 *
 * Every packet goes through the closed-schema guard first (payload-guard.ts, kinds «extension» and
 * «extensionReviewer»), which also refuses any person or identifier count between 1 and 4. On top of the shape, the
 * parser checks what a schema cannot: File F only in unit asl-3, each released distribution adding up to its total,
 * the aggregate carrying only additive values, one packet per unit, and, across the units one audience receives, no
 * small cell recoverable by subtraction (cExtComplementCheck). */
import { guardCScopedPayload } from "@/lib/dashboard-review/pillar-c/payload-guard";
import { C_SCOPED_ASL_UNITS, C_SCOPED_UNITS, isCScopedUnit, type CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";
import type { CExtBaskets, CExtDist, CExtDrivers, CExtFileFBasket, CExtFindings, CExtUnitPacket } from "@/lib/dashboard-review/pillar-c/extension";

const fail = (reason: string): never => { throw new Error(`PCE_${reason}`); };
// File F is the 2025 file (the guard pins year 2025): its months and quarters come from a closed vocabulary.
const FILEF_MONTH = /^2025-(0[1-9]|1[0-2])$/;
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

function checkDist(d: CExtDist, where: string, total?: number) {
  if (d.status === "withheld") { if (d.total !== null || d.cells.length) fail(`WITHHELD_${where}`); return; }
  if (d.total === null || d.cells.reduce((a, c) => a + c.count, 0) !== d.total) fail(`SUM_${where}`);
  // Shares are rounded to three decimals: each must be its count over the total within half a unit (Codex review, 22 Oct 2026).
  const n = d.total;
  if (d.cells.some((c) => Math.abs(c.share - (n ? c.count / n : 0)) > 0.0005 + 1e-9)) fail(`SHARE_${where}`);
  if (total !== undefined && d.total !== total) fail(`TOTAL_${where}`);
}

function checkUnit(p: CExtUnitPacket) {
  const j = p.january, aggregate = p.unit === "aggregato";
  if (j.recipientsAreSum !== aggregate) fail("SUM_FLAG");
  for (const [name, d] of [["age", j.age], ["cost", j.cost.bins], ["packs", j.use.packs.bins], ["prescriptions", j.use.prescriptions.bins], ["products", j.use.distinctAICs.bins], ["ingredients", j.ingredients]] as const) checkDist(d, name, j.recipients);
  // The aggregate is a sum of four Aziende: quantiles, concentration, intervals and pharmacy statistics are not additive.
  const perAsl = [j.cost.quartiles, j.cost.top10, j.cost.top20, j.cost.gini, j.cost.lorenz, j.use.packs.quartiles, j.use.prescriptions.quartiles, j.use.distinctAICs.quartiles,
    j.attribution.agreementLines, j.attribution.sharedRecipientsNarrowed, j.services.under10Packs, j.services.under10Service, j.services.pharmacies, j.services.pharmacyTop10,
    j.services.intervalQ1, j.services.intervalMedian, j.services.intervalQ3, j.services.within7, j.services.sameDay,
    j.services.pharmacyFeeQ1, j.services.pharmacyFeeMedian, j.services.pharmacyFeeQ3, p.unitCosts];
  if (aggregate ? perAsl.some((v) => v !== null) : perAsl.some((v) => v === null)) fail("ADDITIVITY");
  // Lorenz: eleven points from 0 to 1 that never fall; quartiles of the pharmacy fee in order.
  const l = j.cost.lorenz;
  if (l && (l.length !== 11 || l[0] !== 0 || l[10] !== 1 || l.some((v, i) => i > 0 && v < l[i - 1]))) fail("LORENZ");
  const fee = [j.services.pharmacyFeeQ1, j.services.pharmacyFeeMedian, j.services.pharmacyFeeQ3];
  if (fee[0] !== null && (fee[0] < 0 || fee[0] > fee[1]! || fee[1]! > fee[2]!)) fail("PHARMACY_FEE");
  // Per-pack components (D2): one row per AIC, none negative, the total the sum of its two parts within rounding.
  if (p.unitCosts) {
    const rows = p.unitCosts.products, aics = rows.map((r) => r.aic);
    if (!rows.length || new Set(aics).size !== aics.length || aics.some((a) => !/^[0-9]{9}$/.test(a))) fail("UNIT_COSTS");
    if (rows.some((r) => r.acquisition < 0 || r.service < 0 || Math.abs(r.combined - r.acquisition - r.service) > 0.011)) fail("UNIT_COSTS_SUM");
  }
  // Recipient groups shown as «n (x %)»: each share is its count over the recipients, within half a unit of rounding.
  for (const [name, list] of [["portfolioStatus", j.portfolioStatus], ["singleCandidateReach", j.singleCandidateReach]] as const)
    if (list.some((c) => Math.abs(c.share - (j.recipients ? c.count / j.recipients : 0)) > 0.0005 + 1e-9)) fail(`SHARE_${name}`);
  if (p.fileF && p.unit !== "asl-3") fail("FILEF_UNIT");
  if ((p.notes.fileFMode09 === null) !== (p.fileF === null)) fail("NOTES");
  if (p.fileF) {
    const f = p.fileF;
    checkDist(f.age, "fileF_age", f.identifiers); checkDist(f.contacts, "fileF_contacts", f.identifiers); checkDist(f.monthsActive, "fileF_months", f.identifiers);
    if (f.months.some((m) => Math.abs(m.amount - m.mode09 - m.withoutMode09) > 0.011)) fail("FILEF_MODE09");
    // Calendar months of the packet's year, once each, in order: a duplicated month would be drawn and summed twice,
    // and a lexically ordered string such as «0000-00» is not a month (R20-09). A month the source did not report is
    // absent, never zero-filled.
    for (const months of [f.months.map((m) => m.month), f.identifiersByMonth.map((m) => m.month)])
      if (!months.length || months.some((m, i) => !FILEF_MONTH.test(m) || (i > 0 && m <= months[i - 1]))) fail("FILEF_MONTHS");
    // Bridges (D1): between calendar-adjacent months of the series, in order, each ending on the months' amounts; the four
    // components add up to the change and so do the mode-09 split, within rounding (each value is rounded to the cent).
    const amount = new Map(f.months.map((m) => [m.month, m.amount]));
    f.bridges.forEach((b, i) => {
      const next = `2025-${String(Number(b.from.slice(5, 7)) + 1).padStart(2, "0")}`;
      if (!FILEF_MONTH.test(b.from) || b.to !== next || (i > 0 && b.from <= f.bridges[i - 1].from) || !amount.has(b.from) || !amount.has(b.to)) fail("FILEF_BRIDGE_MONTHS");
      if (Math.abs(b.opening - amount.get(b.from)!) > 0.011 || Math.abs(b.closing - amount.get(b.to)!) > 0.011 || Math.abs(b.closing - b.opening - b.change) > 0.021) fail("FILEF_BRIDGE_ENDS");
      if (Math.abs(b.continuingIncrease + b.continuingDecrease + b.entries + b.exits - b.change) > 0.041 || Math.abs(b.mode09Change + b.withoutMode09 - b.change) > 0.021) fail("FILEF_BRIDGE_SUM");
      if (b.continuingIncrease < 0 || b.continuingDecrease > 0) fail("FILEF_BRIDGE_SIGN");
    });
  }
}

/** One scoped object of `unit`, guarded for the audience's units. Throws on any defect. */
export function parseCExtensionUnit(raw: unknown, unit: CScopedUnit, audienceUnits: readonly CScopedUnit[]): CExtUnitPacket {
  const p = guardCScopedPayload<CExtUnitPacket>("extension", raw, audienceUnits);
  if (p.unit !== unit) fail("UNIT");
  checkUnit(p);
  return p;
}

/** The reviewer object: the five units and the reviewer-only blocks (per-resident drivers, basket indices, File F quarterly index). */
type CExtReviewerPacket = { units: CExtUnitPacket[]; drivers: CExtDrivers; baskets: CExtBaskets; fileFBasket: CExtFileFBasket; findings: CExtFindings };
export function parseCExtensionReviewer(raw: unknown): CExtReviewerPacket {
  const p = guardCScopedPayload<CExtReviewerPacket>("extensionReviewer", raw, C_SCOPED_UNITS);
  const keys = p.units.map((u) => u.unit);
  if (keys.length !== C_SCOPED_UNITS.length || new Set(keys).size !== keys.length || !keys.every(isCScopedUnit)) fail("UNITS");
  p.units.forEach(checkUnit);
  cExtComplementCheck(p.units);
  // Drivers and basket indices: each of the four ASLs exactly once, never the aggregate, never an empty set.
  const four = (units: readonly { unit: string }[]) => units.length === C_SCOPED_ASL_UNITS.length && C_SCOPED_ASL_UNITS.every((k) => units.filter((u) => u.unit === k).length === 1);
  if (!four(p.drivers.units) || !four(p.baskets.units)) fail("REVIEWER_UNITS");
  if (p.fileFBasket.unit !== "asl-3" || !p.units.some((u) => u.unit === "asl-3" && u.fileF)) fail("FILEF_BASKET_UNIT");
  // Quarters of the year, at least one, each once, in calendar order (R20-09).
  const quarters = p.fileFBasket.quarters.map((q) => QUARTERS.indexOf(q.quarter));
  if (!quarters.length || quarters.some((q, i) => q < 0 || (i > 0 && q <= quarters[i - 1]))) fail("FILEF_BASKET_QUARTERS");
  const ids = p.findings.rows.map((f) => f.id);
  if (!ids.every((id) => /^F[0-9]{2}$/.test(id)) || new Set(ids).size !== ids.length) fail("FINDINGS");
  return { units: p.units, drivers: p.drivers, baskets: p.baskets, fileFBasket: p.fileFBasket, findings: p.findings };
}

const DISTS: readonly ((p: CExtUnitPacket) => CExtDist)[] = [(p) => p.january.age, (p) => p.january.cost.bins, (p) => p.january.use.packs.bins,
  (p) => p.january.use.prescriptions.bins, (p) => p.january.use.distinctAICs.bins, (p) => p.january.ingredients];

/** The units one audience receives, together. The aggregate minus the visible ASLs is what the audience can derive for
 * the others: per class it must be 0 or at least 5, and a class withheld for a visible ASL must not be recoverable
 * from the aggregate and the remaining ASLs. Counts of the portfolio groups follow the same rule. */
export function cExtComplementCheck(packets: readonly CExtUnitPacket[]) {
  const aggregate = packets.find((p) => p.unit === "aggregato");
  const asl = packets.filter((p) => (C_SCOPED_ASL_UNITS as readonly string[]).includes(p.unit));
  if (!aggregate || asl.length === 0) return;
  const all = asl.length === C_SCOPED_ASL_UNITS.length;
  const small = (n: number) => n !== 0 && n < 5;
  for (const pick of DISTS) {
    const a = pick(aggregate), parts = asl.map(pick);
    if (a.status !== "released") continue;
    if (parts.some((d) => d.status !== "released")) { if (all || parts.filter((d) => d.status !== "released").length === 1) fail("COMPLEMENT_WITHHELD"); continue; }
    a.cells.forEach((cell, k) => {
      const rest = cell.count - parts.reduce((sum, d) => sum + (d.cells[k]?.count ?? NaN), 0);
      if (!Number.isFinite(rest) || rest < 0 || small(rest) || parts.some((d) => d.cells[k]?.id !== cell.id)) fail("COMPLEMENT");
    });
  }
  for (const key of ["portfolioStatus", "singleCandidateReach"] as const) {
    aggregate.january[key].forEach((cell, k) => {
      const rest = cell.count - asl.reduce((sum, p) => sum + (p.january[key][k]?.id === cell.id ? p.january[key][k].count : NaN), 0);
      if (!Number.isFinite(rest) || rest < 0 || small(rest)) fail("COMPLEMENT");
    });
  }
  const recipients = aggregate.january.recipients - asl.reduce((sum, p) => sum + p.january.recipients, 0);
  if (recipients < 0 || small(recipients)) fail("COMPLEMENT");
}
