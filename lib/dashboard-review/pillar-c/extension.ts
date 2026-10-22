/** Pillar C extension (points 15-16): January 2026 DPC of the four Aziende and File F 2025 of ASL 3.
 *
 * Pure and browser-safe: types, the unit labels and the parsers. The parsers run on the server only (extension-loader.ts);
 * the components receive the parsed view. Every packet goes through the closed-schema guard first
 * (payload-guard.ts, kinds «extension» and «extensionReviewer»), which also refuses any person or identifier count
 * between 1 and 4. On top of the shape, the parser checks what a schema cannot: File F only in unit asl-3, each released
 * distribution adding up to its total, the aggregate carrying only additive values, one packet per unit. */
import { guardCScopedPayload } from "@/lib/dashboard-review/pillar-c/payload-guard";
import { C_SCOPED_UNITS, isCScopedUnit, type CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

export type CExtCell = { id: string; label: string; count: number; share: number };
export type CExtDist = { status: "released" | "withheld"; total: number | null; cells: CExtCell[] };
export type CExtQuartiles = { q1: number; median: number; q3: number } | null;
export type CExtSex = { female: number; male: number; unknownLeftOut: boolean };
export type CExtUse = { quartiles: CExtQuartiles; bins: CExtDist };
export type CExtJanuary = {
  recipients: number; recipientsAreSum: boolean; age: CExtDist; sex: CExtSex;
  cost: { quartiles: CExtQuartiles; bins: CExtDist; top10: number | null; top20: number | null; gini: number | null };
  use: { packs: CExtUse; prescriptions: CExtUse; distinctAICs: CExtUse };
  ingredients: CExtDist; portfolioStatus: CExtCell[]; singleCandidateReach: CExtCell[];
  attribution: { single: number; narrowed: number; indicative: number; notInformative: number; agreementLines: number | null; sharedRecipientsNarrowed: number | null };
  services: {
    serviceShare: number; servicePerPack: number; under10Packs: number | null; under10Service: number | null; pharmacies: number | null; pharmacyTop10: number | null;
    intervalQ1: number | null; intervalMedian: number | null; intervalQ3: number | null; within7: number | null; sameDay: number | null;
  };
};
export type CExtFileF = {
  year: 2025; identifiers: number; identifiersByMonth: { month: string; count: number }[]; age: CExtDist; sex: CExtSex;
  concentration: { q1: number; median: number; q3: number; top10: number; top1: number; gini: number; top10WithoutMode09: number; top1WithoutMode09: number };
  contacts: CExtDist; monthsActive: CExtDist; medianContacts: number; medianMonths: number;
  portfolioShares: { single: number; shared: number; unmapped: number };
  singleCandidateReach: { id: string; label: string; share: number }[];
  months: { month: string; amount: number; mode09: number; withoutMode09: number }[];
  modes: { id: string; label: string; rowsShare: number; amountShare: number }[];
  basket: { quarter: string; index: number; coverage: number }[]; basketProducts: number;
};
export type CExtUnitPacket = { schema: "pillar-c-extension-unit-v1"; unit: CScopedUnit; period: "2026-01"; channel: "DPC"; january: CExtJanuary; fileF: CExtFileF | null };
export type CExtDrivers = {
  supportProducts: number; referencePer1000: number;
  units: { unit: CScopedUnit; per1000: number; difference: number; reach: number; intensity: number; mix: number; acquisition: number; service: number; reachPer1000: number; packsPerRecipient: number; coverage: number }[];
};
export type CExtBaskets = { products: number; units: { unit: CScopedUnit; acquisition: number; service: number; combined: number }[] };
/** What a workspace receives: the units of its audience in display order, with their labels, and the reviewer-only blocks. */
export type CExtensionView = { units: { key: CScopedUnit; label: string; data: CExtUnitPacket }[]; drivers: CExtDrivers | null; baskets: CExtBaskets | null };

/** Reviewer labels of the units: the reviewed pseudonyms, never a province or place name. */
export const C_EXT_UNIT_LABELS: Readonly<Record<CScopedUnit, string>> = { aggregato: "Aggregato delle quattro Aziende", "asl-1": "ASL 1", "asl-2": "ASL 2", "asl-3": "ASL 3", "asl-4": "ASL 4" };
export const C_EXT_SOURCE = {
  january: "Flussi NSIS DPC delle quattro ASL, gennaio 2026 · destinatari ammissibili distinti entro ciascuna ASL",
  fileF: "File F 2025 della sola ASL 3 · righe di dettaglio valide · importo riportato, non spesa netta",
} as const;

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
export function parseCExtensionReviewer(raw: unknown): { units: CExtUnitPacket[]; drivers: CExtDrivers; baskets: CExtBaskets } {
  const p = guardCScopedPayload<{ units: CExtUnitPacket[]; drivers: CExtDrivers; baskets: CExtBaskets }>("extensionReviewer", raw, C_SCOPED_UNITS);
  const keys = p.units.map((u) => u.unit);
  if (keys.length !== C_SCOPED_UNITS.length || new Set(keys).size !== keys.length || !keys.every(isCScopedUnit)) fail("UNITS");
  p.units.forEach(checkUnit);
  if (p.drivers.units.some((u) => u.unit === "aggregato") || p.baskets.units.some((u) => u.unit === "aggregato")) fail("REVIEWER_UNITS");
  return { units: p.units, drivers: p.drivers, baskets: p.baskets };
}
