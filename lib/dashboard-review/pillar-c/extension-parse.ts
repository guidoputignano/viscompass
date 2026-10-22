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
import type { CExtBaskets, CExtDist, CExtDrivers, CExtFindings, CExtUnitPacket } from "@/lib/dashboard-review/pillar-c/extension";

const fail = (reason: string): never => { throw new Error(`PCE_${reason}`); };

function checkDist(d: CExtDist, where: string, total?: number) {
  if (d.status === "withheld") { if (d.total !== null || d.cells.length) fail(`WITHHELD_${where}`); return; }
  if (d.total === null || d.cells.reduce((a, c) => a + c.count, 0) !== d.total) fail(`SUM_${where}`);
  if (total !== undefined && d.total !== total) fail(`TOTAL_${where}`);
}

function checkUnit(p: CExtUnitPacket) {
  const j = p.january, aggregate = p.unit === "aggregato";
  if (j.recipientsAreSum !== aggregate) fail("SUM_FLAG");
  for (const [name, d] of [["age", j.age], ["cost", j.cost.bins], ["packs", j.use.packs.bins], ["prescriptions", j.use.prescriptions.bins], ["products", j.use.distinctAICs.bins], ["ingredients", j.ingredients]] as const) checkDist(d, name, j.recipients);
  // The aggregate is a sum of four Aziende: quantiles, concentration, intervals and pharmacy statistics are not additive.
  const perAsl = [j.cost.quartiles, j.cost.top10, j.cost.top20, j.cost.gini, j.use.packs.quartiles, j.use.prescriptions.quartiles, j.use.distinctAICs.quartiles,
    j.attribution.agreementLines, j.attribution.sharedRecipientsNarrowed, j.services.under10Packs, j.services.under10Service, j.services.pharmacies, j.services.pharmacyTop10,
    j.services.intervalQ1, j.services.intervalMedian, j.services.intervalQ3, j.services.within7, j.services.sameDay];
  if (aggregate ? perAsl.some((v) => v !== null) : perAsl.some((v) => v === null)) fail("ADDITIVITY");
  if (p.fileF && p.unit !== "asl-3") fail("FILEF_UNIT");
  if ((p.notes.fileFMode09 === null) !== (p.fileF === null)) fail("NOTES");
  if (p.fileF) {
    const f = p.fileF;
    checkDist(f.age, "fileF_age", f.identifiers); checkDist(f.contacts, "fileF_contacts", f.identifiers); checkDist(f.monthsActive, "fileF_months", f.identifiers);
    if (f.months.some((m) => Math.abs(m.amount - m.mode09 - m.withoutMode09) > 0.011)) fail("FILEF_MODE09");
  }
}

/** One scoped object of `unit`, guarded for the audience's units. Throws on any defect. */
export function parseCExtensionUnit(raw: unknown, unit: CScopedUnit, audienceUnits: readonly CScopedUnit[]): CExtUnitPacket {
  const p = guardCScopedPayload<CExtUnitPacket>("extension", raw, audienceUnits);
  if (p.unit !== unit) fail("UNIT");
  checkUnit(p);
  return p;
}

/** The reviewer object: the five units and the reviewer-only blocks (per-resident drivers, basket indices). */
export function parseCExtensionReviewer(raw: unknown): { units: CExtUnitPacket[]; drivers: CExtDrivers; baskets: CExtBaskets; findings: CExtFindings } {
  const p = guardCScopedPayload<{ units: CExtUnitPacket[]; drivers: CExtDrivers; baskets: CExtBaskets; findings: CExtFindings }>("extensionReviewer", raw, C_SCOPED_UNITS);
  const keys = p.units.map((u) => u.unit);
  if (keys.length !== C_SCOPED_UNITS.length || new Set(keys).size !== keys.length || !keys.every(isCScopedUnit)) fail("UNITS");
  p.units.forEach(checkUnit);
  cExtComplementCheck(p.units);
  if (p.drivers.units.some((u) => u.unit === "aggregato") || p.baskets.units.some((u) => u.unit === "aggregato")) fail("REVIEWER_UNITS");
  const ids = p.findings.rows.map((f) => f.id);
  if (!ids.every((id) => /^F[0-9]{2}$/.test(id)) || new Set(ids).size !== ids.length) fail("FINDINGS");
  return { units: p.units, drivers: p.drivers, baskets: p.baskets, findings: p.findings };
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
