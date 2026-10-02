// Pure helpers for the public Pillar B page (/pillar-b): selection, derived
// shares and the territorial ranking over AIFA's EV/SC focus tables.
//
// EVERY FIGURE HERE IS A SUM OR A DIFFERENCE OF PUBLISHED PERCENTAGES WITH THE
// SAME BASE. The four columns of one row partition the molecule's
// direct-purchase total in that territory, so biosimilar_ev + biosimilar_sc is
// the biosimilar share of that same total, and a difference between two
// territories is a difference in percentage points. No ratio with a new base
// is formed: an "EV-only biosimilar share" would need biosimilar_ev /
// (originator_ev + biosimilar_ev), a base the source does not publish, and is
// deliberately not shown.
//
// The source publishes percentages only. There are no volumes, no euros, no
// totals; nothing here sums across molecules, measures or territories.

export type MoleculeId = "infliximab" | "rituximab" | "trastuzumab";
export type MeasureId = "confezioni" | "ddd" | "spesa";
export type ComponentId = "biosimilar_ev" | "biosimilar_sc" | "originator_ev" | "originator_sc";

export const MOLECULES: ReadonlyArray<MoleculeId> = ["infliximab", "rituximab", "trastuzumab"];
export const MEASURES: ReadonlyArray<MeasureId> = ["confezioni", "ddd", "spesa"];
export const COMPONENTS: ReadonlyArray<ComponentId> = ["biosimilar_ev", "biosimilar_sc", "originator_ev", "originator_sc"];
export const ITALY = "000";

export interface EvScRow {
  molecule: MoleculeId;
  measure: MeasureId;
  /** Territory code, as /pillar-a names it ("000" = Italia). */
  territory: string;
  originator_ev: number;
  biosimilar_ev: number;
  originator_sc: number;
  biosimilar_sc: number;
  /** Physical page of the source PDF (printed page + 1). */
  page: number;
}

export interface Territory {
  code: string;
  label: string;
  kind: "regione" | "provincia autonoma" | "italia";
  source_label: string;
}

export interface EvScAsset {
  version: string;
  source: {
    publisher: string;
    title: string;
    edition: string;
    channel: string;
    period: { from: string; to: string };
    url: string;
    unit: string;
  };
  molecules: { id: MoleculeId; label: string }[];
  measures: { id: MeasureId; label: string; note: string }[];
  territories: Territory[];
  rows: EvScRow[];
}

export const MOLECULE_LABELS: Record<MoleculeId, string> = {
  infliximab: "Infliximab", rituximab: "Rituximab", trastuzumab: "Trastuzumab",
};
export const MEASURE_LABELS: Record<MeasureId, string> = {
  confezioni: "Confezioni", ddd: "DDD", spesa: "Spesa",
};
export const MEASURE_SENTENCE: Record<MeasureId, string> = {
  confezioni: "delle confezioni tracciate",
  ddd: "delle DDD",
  spesa: "della spesa",
};
export const COMPONENT_LABELS: Record<ComponentId, string> = {
  biosimilar_ev: "biosimilare · EV",
  biosimilar_sc: "biosimilare · SC",
  originator_ev: "originator · EV",
  originator_sc: "originator · SC",
};

// ------------------------------------------------------------- selection

export interface Selection { territory: string; molecule: MoleculeId; measure: MeasureId }

export const SELECTION_KEYS = { territory: "territorio", molecule: "molecola", measure: "misura" } as const;
export const SELECTION_DEFAULTS: Selection = { territory: ITALY, molecule: "infliximab", measure: "ddd" };

type Params = Record<string, string | string[] | undefined>;
const one = (params: Params, key: string): string | null => {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === "" ? null : s;
};

/** Parse a selection from URL parameters; anything unknown falls back to the default. */
export function parseSelection(params: Params, territories: ReadonlyArray<Pick<Territory, "code">>): Selection {
  const t = one(params, SELECTION_KEYS.territory);
  const m = one(params, SELECTION_KEYS.molecule);
  const u = one(params, SELECTION_KEYS.measure);
  return {
    territory: t !== null && territories.some((x) => x.code === t) ? t : SELECTION_DEFAULTS.territory,
    molecule: (MOLECULES as ReadonlyArray<string>).includes(m ?? "") ? (m as MoleculeId) : SELECTION_DEFAULTS.molecule,
    measure: (MEASURES as ReadonlyArray<string>).includes(u ?? "") ? (u as MeasureId) : SELECTION_DEFAULTS.measure,
  };
}

/** The query string for a selection; defaults are omitted so a link carries no noise. */
export function selectionHref(sel: Selection): string {
  const q = new URLSearchParams();
  if (sel.territory !== SELECTION_DEFAULTS.territory) q.set(SELECTION_KEYS.territory, sel.territory);
  if (sel.molecule !== SELECTION_DEFAULTS.molecule) q.set(SELECTION_KEYS.molecule, sel.molecule);
  if (sel.measure !== SELECTION_DEFAULTS.measure) q.set(SELECTION_KEYS.measure, sel.measure);
  const s = q.toString();
  return s === "" ? "" : `?${s}`;
}

// ---------------------------------------------------------------- lookups

export function territoryLabel(asset: Pick<EvScAsset, "territories">, code: string): string {
  return asset.territories.find((t) => t.code === code)?.label ?? code;
}

/** Short forms for narrow screens; the full name is the accessible one. */
const SHORT_LABELS: Record<string, string> = {
  "020": "V. d'Aosta", "041": "P.A. Bolzano", "042": "P.A. Trento", "060": "Friuli V.G.", "080": "Emilia-R.",
};
export function territoryShortLabel(asset: Pick<EvScAsset, "territories">, code: string): string {
  return SHORT_LABELS[code] ?? territoryLabel(asset, code);
}

export function rowFor(asset: Pick<EvScAsset, "rows">, sel: Selection): EvScRow | null {
  return asset.rows.find((r) => r.molecule === sel.molecule && r.measure === sel.measure && r.territory === sel.territory) ?? null;
}

export function rowsFor(asset: Pick<EvScAsset, "rows">, molecule: MoleculeId, measure: MeasureId): EvScRow[] {
  return asset.rows.filter((r) => r.molecule === molecule && r.measure === measure);
}

// --------------------------------------------------------- derived shares

/** Biosimilar share of the molecule's total, all forms: a sum of two published columns. */
export function biosimilarShare(r: EvScRow): number {
  return round2(r.biosimilar_ev + r.biosimilar_sc);
}

/** Share of the subcutaneous form, originator and biosimilar together. */
export function scShare(r: EvScRow): number {
  return round2(r.originator_sc + r.biosimilar_sc);
}

export function originatorShare(r: EvScRow): number {
  return round2(r.originator_ev + r.originator_sc);
}

/** Difference in percentage points from Italia for the same molecule and measure; null when either row is missing. */
export function diffFromItaly(asset: Pick<EvScAsset, "rows">, sel: Selection): number | null {
  if (sel.territory === ITALY) return 0;
  const row = rowFor(asset, sel);
  const italy = rowFor(asset, { ...sel, territory: ITALY });
  if (!row || !italy) return null;
  return round2(biosimilarShare(row) - biosimilarShare(italy));
}

/**
 * A three-molecule territorial profile for ONE selected measure. Each cell is
 * its own molecule's biosimilar share minus that molecule's Italia share; the
 * three values are never added or treated as a common volume denominator.
 */
export function territoryDeviationRows(
  asset: Pick<EvScAsset, "rows" | "territories">,
  measure: MeasureId,
  focus: MoleculeId,
  selected: string,
) {
  return asset.territories
    .filter((t) => t.code !== ITALY)
    .map((t) => {
      const differences = Object.fromEntries(MOLECULES.map((molecule) => [
        molecule, diffFromItaly(asset, { territory: t.code, molecule, measure }),
      ])) as Record<MoleculeId, number | null>;
      return {
        territory: t.code, label: t.label, selected: t.code === selected,
        differences, focusDifference: differences[focus],
      };
    })
    .sort((a, b) => (b.focusDifference ?? -Infinity) - (a.focusDifference ?? -Infinity)
      || a.label.localeCompare(b.label, "it"));
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- ranking

export interface RankedTerritory {
  territory: string;
  label: string;
  share: number;
  /** Standard competition ranking: equal shares share a position, the next one skips. */
  position: number;
  tied: boolean;
  row: EvScRow;
}

/**
 * Territories ranked by biosimilar share (all forms) for one molecule and
 * measure, Italia excluded (it is the reference, not a competitor). Ties are
 * decided on the published two-decimal figures, never on a rounded display
 * value; the label breaks the order among tied rows so it is stable.
 */
export function rankTerritories(
  asset: Pick<EvScAsset, "rows" | "territories">, molecule: MoleculeId, measure: MeasureId, order: "desc" | "asc" = "desc",
): RankedTerritory[] {
  const rows = rowsFor(asset, molecule, measure).filter((r) => r.territory !== ITALY);
  const sorted = rows
    .map((row) => ({ row, share: biosimilarShare(row), label: territoryLabel(asset, row.territory) }))
    .sort((a, b) => (order === "desc" ? b.share - a.share : a.share - b.share) || a.label.localeCompare(b.label, "it"));
  const out: RankedTerritory[] = [];
  sorted.forEach((s, i) => {
    const samePrev = i > 0 && sorted[i - 1].share === s.share;
    const position = samePrev ? out[i - 1].position : i + 1;
    out.push({ territory: s.row.territory, label: s.label, share: s.share, position, tied: false, row: s.row });
  });
  for (const r of out) r.tied = out.some((o) => o !== r && o.share === r.share);
  return out;
}

export function positionOf(ranking: ReadonlyArray<RankedTerritory>, territory: string): RankedTerritory | null {
  return ranking.find((r) => r.territory === territory) ?? null;
}

// --------------------------------------------------------------- SC form

/**
 * What the subcutaneous columns hold for a molecule, read from the data and
 * said in those terms. Not a pharmacological claim: a statement about which
 * columns the source leaves at 0.00 % in every territory.
 */
export type ScFormPresence = "solo biosimilare" | "solo originator" | "originator e biosimilare" | "assente";

export function scFormPresence(asset: Pick<EvScAsset, "rows">, molecule: MoleculeId): ScFormPresence {
  const rows = asset.rows.filter((r) => r.molecule === molecule);
  const anyOrig = rows.some((r) => r.originator_sc > 0);
  const anyBio = rows.some((r) => r.biosimilar_sc > 0);
  if (anyOrig && anyBio) return "originator e biosimilare";
  if (anyBio) return "solo biosimilare";
  if (anyOrig) return "solo originator";
  return "assente";
}

export function scFormSentence(molecule: MoleculeId, presence: ScFormPresence): string {
  const name = MOLECULE_LABELS[molecule];
  switch (presence) {
    case "solo biosimilare":
      return `Nel dato AIFA la forma sottocutanea di ${name} compare solo come biosimilare: la colonna «originator · SC» è 0,00 % in ogni territorio.`;
    case "solo originator":
      return `Nel dato AIFA la forma sottocutanea di ${name} compare solo come originator: la colonna «biosimilare · SC» è 0,00 % in ogni territorio.`;
    case "originator e biosimilare":
      return `Nel dato AIFA la forma sottocutanea di ${name} compare sia come originator sia come biosimilare.`;
    case "assente":
      return `Nel dato AIFA ${name} non compare in forma sottocutanea.`;
  }
}

// -------------------------------------------------------- chart helpers

export interface CompositionRow {
  territory: string;
  label: string;
  shortLabel: string;
  biosimilar_ev: number;
  biosimilar_sc: number;
  originator_ev: number;
  originator_sc: number;
  isItaly: boolean;
  selected: boolean;
}

/** One row per territory, Italia included, sorted by biosimilar share for the stacked chart. */
export function compositionRows(
  asset: Pick<EvScAsset, "rows" | "territories">, molecule: MoleculeId, measure: MeasureId, selected: string,
): CompositionRow[] {
  return rowsFor(asset, molecule, measure)
    .map((r) => ({
      territory: r.territory, label: territoryLabel(asset, r.territory), shortLabel: territoryShortLabel(asset, r.territory),
      biosimilar_ev: r.biosimilar_ev, biosimilar_sc: r.biosimilar_sc,
      originator_ev: r.originator_ev, originator_sc: r.originator_sc,
      isItaly: r.territory === ITALY, selected: r.territory === selected,
    }))
    .sort((a, b) => (b.biosimilar_ev + b.biosimilar_sc) - (a.biosimilar_ev + a.biosimilar_sc) || a.label.localeCompare(b.label, "it"));
}

/** The selected territory and Italia across the three measures, one molecule. */
export function measureComparison(asset: Pick<EvScAsset, "rows" | "territories">, molecule: MoleculeId, territory: string) {
  return MEASURES.map((measure) => {
    const here = rowFor(asset, { territory, molecule, measure });
    const italy = rowFor(asset, { territory: ITALY, molecule, measure });
    return {
      measure, label: MEASURE_LABELS[measure],
      territory: here ? biosimilarShare(here) : null,
      italy: italy ? biosimilarShare(italy) : null,
      territorySc: here ? scShare(here) : null,
      italySc: italy ? scShare(italy) : null,
    };
  });
}

/** The selected territory and Italia across the three molecules, one measure. */
export function moleculeComparison(asset: Pick<EvScAsset, "rows" | "territories">, measure: MeasureId, territory: string) {
  return MOLECULES.map((molecule) => {
    const here = rowFor(asset, { territory, molecule, measure });
    const italy = rowFor(asset, { territory: ITALY, molecule, measure });
    return {
      molecule, label: MOLECULE_LABELS[molecule],
      territory: here ? biosimilarShare(here) : null,
      italy: italy ? biosimilarShare(italy) : null,
    };
  });
}
