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
/** notes: interpretive sentences written in the private build (the public code states methods, never a private finding). */
export type CExtUnitPacket = { schema: "pillar-c-extension-unit-v1"; unit: CScopedUnit; period: "2026-01"; channel: "DPC"; january: CExtJanuary; fileF: CExtFileF | null; notes: { fileFMode09: string | null } };
export type CExtDrivers = {
  supportProducts: number; referencePer1000: number;
  units: { unit: CScopedUnit; per1000: number; difference: number; reach: number; intensity: number; mix: number; acquisition: number; service: number; reachPer1000: number; packsPerRecipient: number; coverage: number }[];
};
export type CExtBaskets = { products: number; units: { unit: CScopedUnit; acquisition: number; service: number; combined: number }[] };
/** Point 18: findings to action, versioned with the data; each names its source and scope, never a person. Reviewer only. */
export type CExtFinding = { id: string; title: string; scope: string; source: string; detail: string; action: string };
export type CExtFindings = { version: "ext-v1"; rows: CExtFinding[] };
/** What a workspace receives: the units of its audience in display order, with their labels, and the reviewer-only blocks. */
export type CExtensionView = { units: { key: CScopedUnit; label: string; data: CExtUnitPacket }[]; drivers: CExtDrivers | null; baskets: CExtBaskets | null; findings: CExtFindings | null };

/** Reviewer labels of the units: the reviewed pseudonyms, never a province or place name. */
export const C_EXT_UNIT_LABELS: Readonly<Record<CScopedUnit, string>> = { aggregato: "Aggregato delle quattro Aziende", "asl-1": "ASL 1", "asl-2": "ASL 2", "asl-3": "ASL 3", "asl-4": "ASL 4" };
export const C_EXT_SOURCE = {
  january: "Flussi NSIS DPC delle quattro ASL, gennaio 2026 · destinatari ammissibili distinti entro ciascuna ASL",
  fileF: "File F 2025 di una sola Azienda · righe di dettaglio valide · importo riportato, non spesa netta",
} as const;
