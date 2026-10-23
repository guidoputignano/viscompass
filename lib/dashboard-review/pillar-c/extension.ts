/** Pillar C extension (points 15-16): January 2026 DPC of the four Aziende and File F 2025 of ASL 3.
 *
 * Browser-safe: types, the unit labels and the source lines only. The parsers are server-only (extension-parse.ts), so
 * the guard's vocabulary (place names, codes, reviewer-only keys) never reaches a client bundle. */
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

export type CExtCell = { id: string; label: string; count: number; share: number };
export type CExtDist = { status: "released" | "withheld"; total: number | null; cells: CExtCell[] };
export type CExtQuartiles = { q1: number; median: number; q3: number } | null;
export type CExtSex = { female: number; male: number; unknownLeftOut: boolean };
export type CExtUse = { quartiles: CExtQuartiles; bins: CExtDist };
export type CExtJanuary = {
  recipients: number; recipientsAreSum: boolean; age: CExtDist; sex: CExtSex;
  /** lorenz: the cumulative cost share of the recipients with the lowest cost, at 0, 10, …, 100 % of recipients (per ASL only). */
  cost: { quartiles: CExtQuartiles; bins: CExtDist; top10: number | null; top20: number | null; gini: number | null; lorenz: number[] | null };
  use: { packs: CExtUse; prescriptions: CExtUse; distinctAICs: CExtUse };
  ingredients: CExtDist; portfolioStatus: CExtCell[]; singleCandidateReach: CExtCell[];
  attribution: { single: number; narrowed: number; indicative: number; notInformative: number; agreementLines: number | null; sharedRecipientsNarrowed: number | null };
  services: {
    serviceShare: number; servicePerPack: number; under10Packs: number | null; under10Service: number | null; pharmacies: number | null; pharmacyTop10: number | null;
    intervalQ1: number | null; intervalMedian: number | null; intervalQ3: number | null; within7: number | null; sameDay: number | null;
    /** The service fee per pack across the unit's pharmacies (per ASL only). */
    pharmacyFeeQ1: number | null; pharmacyFeeMedian: number | null; pharmacyFeeQ3: number | null;
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
  /** Adjacent-month bridges of the reported amount (owner decision D1, 23 Oct 2026): four product components that add up
   * to the change, the mode-09 rows' change and the change without them, products with a change and the share of the
   * gross change carried by the ten largest. */
  bridges: CExtFileFBridge[];
};
export type CExtFileFBridge = {
  from: string; to: string; opening: number; closing: number; change: number;
  continuingIncrease: number; continuingDecrease: number; entries: number; exits: number;
  mode09Change: number; withoutMode09: number; products: number; top10Share: number;
};
/** One product's acquisition and service component per recorded pack in the unit's January 2026 DPC (owner decision D2). */
export type CExtUnitCost = { aic: string; name: string; pack: string; atc: string; acquisition: number; service: number; combined: number };
/** notes: interpretive sentences written in the private build (the public code states methods, never a private finding). */
/** unitCosts: the unit's own per-pack components on the products present in all four ASLs (null for the aggregate, and
 * removed by the server for the Regione audience, whose page does not show them). */
export type CExtUnitPacket = {
  schema: "pillar-c-extension-unit-v2"; unit: CScopedUnit; period: "2026-01"; channel: "DPC"; january: CExtJanuary;
  unitCosts: { products: CExtUnitCost[] } | null; fileF: CExtFileF | null; notes: { fileFMode09: string | null };
};
export type CExtDrivers = {
  supportProducts: number; referencePer1000: number;
  units: { unit: CScopedUnit; per1000: number; difference: number; reach: number; intensity: number; mix: number; acquisition: number; service: number; reachPer1000: number; packsPerRecipient: number; coverage: number }[];
};
export type CExtBaskets = { products: number; units: { unit: CScopedUnit; acquisition: number; service: number; combined: number }[] };
/** File F quarterly unit-amount index on the products present and clean in all four quarters (annual reference = 100). Reviewer only. */
export type CExtFileFBasket = { unit: CScopedUnit; products: number; quarters: { quarter: string; index: number; coverage: number }[] };
/** Point 18: findings to action, versioned with the data; each names its source and scope, never a person. Reviewer only. */
export type CExtFinding = { id: string; title: string; scope: string; source: string; detail: string; action: string };
export type CExtFindings = { version: "ext-v1"; rows: CExtFinding[] };
/** What a workspace receives: the units of its audience in display order, with their labels, and the reviewer-only blocks. */
export type CExtensionView = { units: { key: CScopedUnit; label: string; data: CExtUnitPacket }[]; drivers: CExtDrivers | null; baskets: CExtBaskets | null; fileFBasket: CExtFileFBasket | null; findings: CExtFindings | null };

/** The sentence on treated persons under «La domanda di gestione». Persons are counted only in the extension's sources
 * (January DPC; File F 2025 for one Azienda), not in the spending series the page explains: a change over time is still
 * not attributed to more patients. Without the extension nothing counts persons; an extension that could not be read
 * is «not available», never «not counted». */
export function cDecisionPeopleLine(view: CExtensionView | null, unavailable = false): string {
  if (!view && unavailable) return "I dati su destinatari e utilizzo non sono disponibili in questo momento: non possiamo attribuire la variazione a un aumento dei pazienti.";
  if (!view) return "I dati disponibili non contano le persone trattate: non possiamo attribuire la variazione a un aumento dei pazienti.";
  const fileF = view.units.some((u) => u.data.fileF);
  return `Le persone trattate sono contate solo nella DPC di gennaio 2026${fileF ? " e, per un’Azienda, nel File F 2025" : ""}: fonti e periodi diversi dalla serie della spesa, quindi non possiamo attribuire la variazione a un aumento dei pazienti.`;
}

/** Reviewer labels of the units: the reviewed pseudonyms, never a province or place name. */
export const C_EXT_UNIT_LABELS: Readonly<Record<CScopedUnit, string>> = { aggregato: "Aggregato delle quattro Aziende", "asl-1": "ASL 1", "asl-2": "ASL 2", "asl-3": "ASL 3", "asl-4": "ASL 4" };
export const C_EXT_SOURCE = {
  january: "Flussi NSIS DPC delle quattro ASL, gennaio 2026 · destinatari ammissibili distinti entro ciascuna ASL",
  fileF: "File F 2025 di una sola Azienda · righe di dettaglio valide · importo riportato, non spesa netta",
} as const;
