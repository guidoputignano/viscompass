// The observed gross cost per unit, per comparability stratum, for ONE Azienda
// (the panel #costo-per-strato of the review page).
//
// PURE: no database, no session, no "server-only". The page reads
// pillar_b_stratum_unit_cost (migration 20261018090000) through rpc.ts; every
// step after the read happens here and ends in strings, so the unit tests and
// the private harness drive exactly what a reader sees.
//
// THE OWNER DECISION (17 October 2026). For one Azienda at a time, the two
// observed gross values per unit of a comparability stratum (active substance,
// route, form, mass unit) may stand side by side, each beside its spend, its
// quantity and its record count. No ratio, no difference, no saving, and no
// colour or order that says which side is cheaper. Here that means:
//   - a value per unit is formed only inside one stratum and one side: spend ÷
//     quantity in the stratum's own unit, a constant multiple of the margin's
//     €/mg over the same records (costPerMg in biosimilar.ts);
//   - molecules are ordered by reference spend and strata by route, form and
//     unit, never by a value per unit or by either side's amount;
//   - no quantity is summed across strata or units;
//   - nothing per unit is printed for a year whose sums do not reconcile to the
//     cent: that year carries its reasons instead.
//
// NOT BiosimilarComparisonRow: its *_cost_per_mg fields are pooled across a
// molecule's shared strata (biosimilar.ts), the comparison this panel exists
// not to make.
//
// NO ORGANISATION CODE. The function returns none and this module reads none;
// the Azienda arrives as the label the viewer may see (a pseudonym except for a
// widened reviewer), and its code is used only to filter the facets rows in
// stratumFacetsReference, never returned.

import { formatEur, formatEurPrecise, formatEurSignificant, formatNumberUpTo, formatPercent } from "@/lib/dashboard-review/format";
import { COMPLETE_YEARS, RELEASE_COVERAGE } from "@/lib/dashboard-review/pillar-b/period";
import { monthKeyLabel } from "@/lib/dashboard-review/pillar-b/adoption";
import type { FacetAsl } from "./facets";

export const MASS_UNIT_LABEL = { MG: "mg", MCG: "mcg", G: "g" } as const;    // biosimilar.ts MG_PER_UNIT keys
export type MassUnit = keyof typeof MASS_UNIT_LABEL;
const MG_PER_UNIT: Record<MassUnit, number> = { MG: 1, MCG: 0.001, G: 1000 }; // biosimilar.ts MG_PER_UNIT
/** Below this many records a stratum side is flagged (never hidden): it may be one purchase's price. */
export const FEW_RECORDS = 3;
/** Mirrors selectReportingPeriod (release-scope.ts) on this release: the latest 12-month year. */
export const MARGIN_YEAR = Math.max(...Object.entries(RELEASE_COVERAGE)
  .filter(([, months]) => months === 12).map(([year]) => Number(year)));

export interface StratumSideRaw {
  spend_eur: number;
  /** In the stratum's own unit; never added to another stratum's. */
  quantity: number;
  mass_mg: number;
  rows_n: number;
  unit: string | null;
  unit_count: number;
  /** Spend by channel; '' = records with no channel. */
  channels: Record<string, number>;
}
export interface StratumRaw {
  stratum_id: string;
  shared: boolean;
  reference: StratumSideRaw | null;
  biosimilar: StratumSideRaw | null;
}
export interface StratumMoleculeRaw {
  active_substance: string;
  /** year*12+month of the first local biosimilar dispensing; null = none in the release. */
  opening_key: number | null;
  /** The opening comes from a record without a month (its January). */
  opening_from_undated: boolean;
  /** R = P + W, W ⊇ M ⊇ S (outside the window, in it, measurable, in a shared stratum). */
  reference: { r_eur: number; p_eur: number; w_eur: number; m_eur: number; s_eur: number; rows_n: number };
  biosimilar: { b_eur: number; p_eur: number; w_eur: number; m_eur: number; s_eur: number; rows_n: number };
  not_compared: { unresolved_eur: number; non_biosimilar_same_substance_eur: number; other_eur: number };
  strata: StratumRaw[];
}
export interface StratumYearRaw {
  year: number;
  /** Months 1–12 with at least one record of this Azienda, whatever the filters. */
  months_observed: number;
  reference_all_eur: number;
  reference_undated_eur: number;
  reference_no_substance_eur: number;
  reference_without_biosimilar_eur: number;
  legacy_mass_rows: number;
  molecules: StratumMoleculeRaw[];
}
export interface StratumUnitCostRaw {
  years: number[];
  channels: string[] | null;
  substance: string | null;
  byYear: StratumYearRaw[];
}
export interface StratumCostArgs {
  years: ReadonlyArray<number>;
  /** canonical_fact.asl_code of the ONE Azienda; the database refuses a null. */
  aslCode: string;
  /** null = every channel. */
  channels: ReadonlyArray<string> | null;
  substance: string | null;
}

/** What the page obtained: a read, or why there is none. */
export type StratumCostOutcome =
  | { kind: "pick-azienda" }
  | { kind: "not-deployed" }
  | { kind: "failed" }
  | { kind: "read"; raw: StratumUnitCostRaw };

// ------------------------------------------------------------------ parsing

function shape(): never {
  throw new Error("PBR-STRATUM-SHAPE");
}
type J = Record<string, unknown>;
const record = (v: unknown): J => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as J) : shape());
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : shape());
/**
 * rpc.ts `num`, strict: a numeric may arrive as a string (pg wire) but must be
 * present and finite. A missing amount is a broken answer here, not a null.
 */
function amount(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : shape();
}
function whole(v: unknown): number {
  const n = amount(v);
  return Number.isInteger(n) && n >= 0 ? n : shape();
}
const str = (v: unknown): string => (typeof v === "string" ? v : shape());
const bool = (v: unknown): boolean => (typeof v === "boolean" ? v : shape());
const sameList = <T,>(a: ReadonlyArray<T>, b: ReadonlyArray<T>) => a.length === b.length && a.every((x, i) => x === b[i]);

function parseSide(v: unknown): StratumSideRaw | null {
  if (v === null) return null;
  const s = record(v);
  return {
    spend_eur: amount(s.spend_eur),
    quantity: amount(s.quantity),
    mass_mg: amount(s.mass_mg),
    rows_n: whole(s.rows_n),
    unit: s.unit === null ? null : str(s.unit),
    unit_count: whole(s.unit_count),
    channels: Object.fromEntries(Object.entries(record(s.channels)).map(([k, x]) => [k, amount(x)])),
  };
}

function parseMolecule(v: unknown): StratumMoleculeRaw {
  const m = record(v);
  const ref = record(m.reference), bio = record(m.biosimilar), nc = record(m.not_compared);
  return {
    active_substance: str(m.active_substance),
    opening_key: m.opening_key === null ? null : whole(m.opening_key),
    opening_from_undated: bool(m.opening_from_undated),
    reference: {
      r_eur: amount(ref.r_eur), p_eur: amount(ref.p_eur), w_eur: amount(ref.w_eur),
      m_eur: amount(ref.m_eur), s_eur: amount(ref.s_eur), rows_n: whole(ref.rows_n),
    },
    biosimilar: {
      b_eur: amount(bio.b_eur), p_eur: amount(bio.p_eur), w_eur: amount(bio.w_eur),
      m_eur: amount(bio.m_eur), s_eur: amount(bio.s_eur), rows_n: whole(bio.rows_n),
    },
    not_compared: {
      unresolved_eur: amount(nc.unresolved_eur),
      non_biosimilar_same_substance_eur: amount(nc.non_biosimilar_same_substance_eur),
      other_eur: amount(nc.other_eur),
    },
    strata: list(m.strata).map((x) => {
      const s = record(x);
      return { stratum_id: str(s.stratum_id), shared: bool(s.shared), reference: parseSide(s.reference), biosimilar: parseSide(s.biosimilar) };
    }),
  };
}

function parseYear(v: unknown): StratumYearRaw {
  const y = record(v);
  return {
    year: whole(y.year),
    months_observed: whole(y.months_observed),
    reference_all_eur: amount(y.reference_all_eur),
    reference_undated_eur: amount(y.reference_undated_eur),
    reference_no_substance_eur: amount(y.reference_no_substance_eur),
    reference_without_biosimilar_eur: amount(y.reference_without_biosimilar_eur),
    legacy_mass_rows: whole(y.legacy_mass_rows),
    molecules: list(y.molecules).map(parseMolecule),
  };
}

/**
 * The function's one jsonb value, checked against the request it answers.
 * Strict: a missing or non-finite amount, a negative or fractional count, a
 * year that was not asked for (2026 never is), or a channel or molecule echo
 * that differs from the request throws "PBR-STRATUM-SHAPE"; the page then
 * shows that the read failed instead of figures for another selection.
 * Keys the contract does not name are ignored here (the migration test pins
 * the function's keys).
 */
export function parseStratumUnitCost(data: unknown, expected: StratumCostArgs): StratumUnitCostRaw {
  const j = record(data);
  const want = [...new Set(expected.years)].sort((a, b) => a - b);
  if (want.length === 0 || want.some((y) => !(COMPLETE_YEARS as ReadonlyArray<number>).includes(y))) shape();
  const years = list(j.years).map(whole);
  if (!sameList(years, want)) shape();
  const channels = j.channels === null ? null : list(j.channels).map(str);
  const askedChannels = expected.channels === null ? null : [...expected.channels];
  if ((channels === null) !== (askedChannels === null) || (channels && askedChannels && !sameList(channels, askedChannels))) shape();
  const substance = j.substance === null ? null : str(j.substance);
  if (substance !== expected.substance) shape();
  const byYear = list(j.by_year).map(parseYear);
  if (!sameList(byYear.map((y) => y.year).sort((a, b) => a - b), want)) shape();
  return { years, channels, substance, byYear };
}

// ------------------------------------------------------------ reconciliation

// Rounds to the cent and normalises -0 to 0, as bridge-b.ts does.
const round2 = (v: number): number => {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? 0 : r;
};
/** Equal to the cent: the difference rounds to zero (bridge-b.ts's test). */
const sameCents = (a: number, b: number): boolean => round2(a - b) === 0;
const sum = (xs: ReadonlyArray<number>): number => xs.reduce((s, x) => s + x, 0);

function massUnit(unit: string | null): MassUnit | null {
  return unit !== null && Object.prototype.hasOwnProperty.call(MASS_UNIT_LABEL, unit) ? (unit as MassUnit) : null;
}

/** Why a year does not reconcile, in the reader's words; no code, no function name. */
export const STRATUM_REASONS = {
  parts: "le parti della spesa del riferimento non tornano al totale",
  strata: "le spese degli strati non tornano alla parte misurabile",
  unit: "uno strato ha più unità o un'unità non di massa",
  facets: "la spesa del riferimento non coincide con quella letta per Azienda nel resto della pagina",
  mass: "alcuni record hanno una massa da una fonte diversa dalla quantità confrontabile",
  year: "i totali dell'anno non tornano",
} as const;
type ReasonKey = keyof typeof STRATUM_REASONS;

export interface StratumYearCheck {
  ok: boolean;
  /** In STRATUM_REASONS order, each at most once. */
  reasons: string[];
  /** Against the per-Azienda reference spend the page already reads; "unavailable" is not a failure. */
  crossCheck: "ok" | "unavailable" | "failed";
}

/**
 * Every identity the panel rests on, to the cent, before any value per unit
 * is printed.
 *   - per molecule: R = P + (W − M) + (M − S) + S, i.e. R = P + W (and the
 *     same on the biosimilar side); the strata's spend sums to M, the shared
 *     strata's to S, on each side;
 *   - per stratum side: one mass unit, at least one record, positive spend and
 *     quantity, mass = quantity × the unit's mg factor, channels summing to the
 *     spend; a stratum is shared exactly when both sides are present, with the
 *     same unit;
 *   - per year: Σ R + reference without a biosimilar + reference without a
 *     substance = all reference spend; no record whose mass would come from
 *     packs × content instead of the comparable quantity (the margin would
 *     count it, this function does not);
 *   - against an independent function: dated reference spend = the reference
 *     spend of the facets' Azienda rows for the same filters. That equality
 *     holds because release rows carry no side flags (sides = status); the
 *     private harness asserts it.
 */
export function reconcileYear(y: StratumYearRaw, facetsReference: number | null): StratumYearCheck {
  const found = new Set<ReasonKey>();
  if (y.legacy_mass_rows !== 0) found.add("mass");
  if (y.months_observed > 12) found.add("year");
  for (const m of y.molecules) {
    const ref = m.reference, bio = m.biosimilar;
    if (!sameCents(ref.r_eur, ref.p_eur + ref.w_eur)) found.add("parts");
    if (!sameCents(bio.b_eur, bio.p_eur + bio.w_eur)) found.add("year");
    const sides = [
      { pick: (s: StratumRaw) => s.reference, m: ref.m_eur, s: ref.s_eur },
      { pick: (s: StratumRaw) => s.biosimilar, m: bio.m_eur, s: bio.s_eur },
    ];
    for (const side of sides) {
      const all = sum(m.strata.map((s) => side.pick(s)?.spend_eur ?? 0));
      const shared = sum(m.strata.filter((s) => s.shared).map((s) => side.pick(s)?.spend_eur ?? 0));
      if (!sameCents(all, side.m) || !sameCents(shared, side.s)) found.add("strata");
    }
    if (new Set(m.strata.map((s) => s.stratum_id)).size !== m.strata.length) found.add("strata");
    for (const s of m.strata) {
      const both = s.reference !== null && s.biosimilar !== null;
      if (s.shared !== both || (s.reference === null && s.biosimilar === null)) found.add("strata");
      if (both && s.reference!.unit !== s.biosimilar!.unit) found.add("unit");
      for (const side of [s.reference, s.biosimilar]) {
        if (side === null) continue;
        const unit = massUnit(side.unit);
        if (side.unit_count !== 1 || unit === null) found.add("unit");
        if (side.rows_n < 1 || !(side.spend_eur > 0) || !(side.quantity > 0)) found.add("strata");
        if (unit !== null && Math.abs(side.mass_mg - side.quantity * MG_PER_UNIT[unit]) > 1e-9 * Math.max(1, Math.abs(side.mass_mg))) {
          found.add("mass");
        }
        if (!sameCents(sum(Object.values(side.channels)), side.spend_eur)) found.add("strata");
      }
    }
  }
  const moleculesR = sum(y.molecules.map((m) => m.reference.r_eur));
  if (!sameCents(moleculesR + y.reference_without_biosimilar_eur + y.reference_no_substance_eur, y.reference_all_eur)) {
    found.add("year");
  }
  let crossCheck: StratumYearCheck["crossCheck"] = "unavailable";
  if (facetsReference !== null) {
    crossCheck = sameCents(y.reference_all_eur - y.reference_undated_eur, facetsReference) ? "ok" : "failed";
    if (crossCheck === "failed") found.add("facets");
  }
  const reasons = (Object.keys(STRATUM_REASONS) as ReasonKey[]).filter((k) => found.has(k)).map((k) => STRATUM_REASONS[k]);
  return { ok: reasons.length === 0, reasons, crossCheck };
}

/**
 * Σ reference_eur per year over the facets' Azienda rows of ONE Azienda. The
 * code is a filter only: the result is keyed by year and carries no code.
 */
export function stratumFacetsReference(rows: ReadonlyArray<FacetAsl>, aslCode: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of rows) {
    if (r.asl_code !== aslCode) continue;
    out.set(r.year, (out.get(r.year) ?? 0) + (r.reference_eur ?? 0));
  }
  return out;
}

/**
 * The margin's base for one molecule, as a note only: min(S, max(0, W),
 * max(0, R)), which is biosimilar.ts's min(rawBase, substitutable spend) with
 * rawBase = S (shared measurable records have positive spend). `binds` when
 * the window's net spend, credit notes included, stops the base below S.
 */
export function marginBase(m: { r_eur: number; w_eur: number; s_eur: number }): { base: number; binds: boolean; cap: "window" | "year" | null } {
  const w = Math.max(0, m.w_eur), r = Math.max(0, m.r_eur);
  const base = Math.min(m.s_eur, w, r);
  const binds = round2(base) < round2(m.s_eur);
  // Which cap stops the base below S: the window's net reference spend W, or the
  // year's net reference spend R (below W only when credit notes before the
  // opening make P negative, R = P + W).
  return { base, binds, cap: !binds ? null : r < w ? "year" : "window" };
}

/** Euros to the cent, with float noise and -0 cleared, for lines that claim an exact sum. */
const eurCents = (v: number): string => formatEurPrecise(round2(v));

/**
 * Whether this year's selection is the margin's: all channels, the latest
 * 12-month year, and twelve observed months in this Azienda. The margin is
 * per molecule, so the molecule filter does not change the answer.
 */
export function selectionMatch(year: number, channels: ReadonlyArray<string>, monthsObserved: number): { matches: boolean; text: string } {
  if (year !== MARGIN_YEAR) {
    return { matches: false, text: `Anno diverso da quello del margine (${MARGIN_YEAR}): il confronto con il margine non si applica.` };
  }
  if (channels.length > 0) {
    return { matches: false, text: "Il margine conta tutti i canali: con un filtro per canale il confronto con il margine non si applica." };
  }
  if (monthsObserved !== 12) {
    const months = monthsObserved === 1 ? "1 mese osservato" : `${monthsObserved} mesi osservati`;
    return { matches: false, text: `In questa Azienda il ${MARGIN_YEAR} ha ${months}: la corrispondenza con il margine non è verificabile.` };
  }
  return { matches: true, text: `Coincide con la selezione del margine: tutti i canali, ${MARGIN_YEAR}.` };
}

// -------------------------------------------------------------------- labels

// The route vocabulary of the release's mass strata (printed by the private
// harness), agreed with "via". A stratum of products with more than one route
// carries them joined by "+"; each is read and the label says "o". A word not
// listed falls back to lower case, never to a guess.
const ROUTE_LABEL: Record<string, string> = {
  CUTANEO: "cutanea",
  ENDOARTERIOSO: "endoarteriosa",
  ENDOVENOSO: "endovenosa",
  EPIDURALE: "epidurale",
  GASTROENTERICO: "gastroenterica",
  INALATORIO: "inalatoria",
  INTRAMUSCOLARE: "intramuscolare",
  INTRATECALE: "intratecale",
  INTRAVITREALE: "intravitreale",
  OFTALMICO: "oftalmica",
  ORALE: "orale",
  OROMUCOSALE: "oromucosale",
  SOTTOCUTANEO: "sottocutanea",
  VAGINALE: "vaginale",
};
const routeLabel = (route: string): string => route.split("+").map((r) => r.trim()).filter((r) => r !== "")
  .map((r) => ROUTE_LABEL[r.toUpperCase()] ?? r.toLowerCase().replace(/_/g, " ")).join(" o ");

/**
 * Route, form and unit from a content-tier stratum id,
 * `content|molecule|route|form|unit|year`, and only that layout: exactly six
 * parts, the unit and the year agreeing with the record's. Any other layout
 * (a pack-tier id, or a later one with more parts) returns null and the panel
 * falls back to a neutral label rather than mislabel the stratum.
 */
export function parseStratumLabel(id: string, unit: string | null, year: number): { route: string; form: string; unit: MassUnit } | null {
  const parts = id.split("|");
  if (parts.length !== 6 || parts[0] !== "content") return null;
  const mass = massUnit(unit);
  if (mass === null || parts[4] !== mass || parts[5] !== String(year)) return null;
  const route = parts[2].trim(), form = parts[3].trim();
  if (route === "" || form === "") return null;
  return { route: routeLabel(route), form: form.toLowerCase(), unit: mass };
}

const stratumUnit = (s: StratumRaw): string | null => s.reference?.unit ?? s.biosimilar?.unit ?? null;
const byText = (a: string, b: string): number => a.localeCompare(b, "it");
const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Molecules by reference spend, largest first, then by name: never by a value per unit. */
export function orderMolecules(molecules: ReadonlyArray<StratumMoleculeRaw>): StratumMoleculeRaw[] {
  return [...molecules].sort((a, b) => b.reference.r_eur - a.reference.r_eur || byText(a.active_substance, b.active_substance));
}

/**
 * Strata by route, form and unit, then id; strata without a readable label
 * after them, by id, each labelled "Strato senza descrizione k" in that order.
 * Nothing about either side's amount enters the order.
 */
export function orderStrata(strata: ReadonlyArray<StratumRaw>, year: number): Array<{ stratum: StratumRaw; label: string }> {
  const parsed = strata.map((stratum) => ({ stratum, parsed: parseStratumLabel(stratum.stratum_id, stratumUnit(stratum), year) }));
  const labelled = parsed
    .filter((p) => p.parsed !== null)
    .sort((a, b) => byText(a.parsed!.route, b.parsed!.route) || byText(a.parsed!.form, b.parsed!.form)
      || byText(MASS_UNIT_LABEL[a.parsed!.unit], MASS_UNIT_LABEL[b.parsed!.unit]) || byCode(a.stratum.stratum_id, b.stratum.stratum_id))
    .map((p) => ({ stratum: p.stratum, label: `via ${p.parsed!.route} · ${p.parsed!.form} · ${MASS_UNIT_LABEL[p.parsed!.unit]}` }));
  const unlabelled = parsed
    .filter((p) => p.parsed === null)
    .sort((a, b) => byCode(a.stratum.stratum_id, b.stratum.stratum_id))
    .map((p, k) => ({ stratum: p.stratum, label: `Strato senza descrizione ${k + 1}` }));
  return [...labelled, ...unlabelled];
}

const CHANNEL_ORDER = ["CO", "DD", "DPC"];

/** "canali: CO 85% · DPC 15%": shares of one side's spend, never an amount. */
export function channelShares(channels: Record<string, number>): string {
  const total = sum(Object.values(channels));
  const rank = (c: string) => (CHANNEL_ORDER.includes(c) ? CHANNEL_ORDER.indexOf(c) : CHANNEL_ORDER.length);
  const parts = Object.entries(channels)
    .filter(([, eur]) => eur !== 0)
    .sort(([a], [b]) => rank(a) - rank(b) || byCode(a, b))
    .map(([c, eur]) => `${c === "" ? "canale non indicato" : c} ${total > 0 ? formatPercent(eur / total) : "—"}`);
  return `canali: ${parts.length > 0 ? parts.join(" · ") : "—"}`;
}

/** Months of `year` at or after the opening (biosimilar.ts isLocallySubstitutable). */
export function windowMonths(openingKey: number | null, year: number): number {
  if (openingKey === null) return 0;
  const first = year * 12 + 1, last = year * 12 + 12;
  if (openingKey <= first) return 12;
  if (openingKey > last) return 0;
  return last - openingKey + 1;
}

/** The opening as a reader sees it. A month after the block's year is never printed (no 2026). */
export function openingLabel(m: Pick<StratumMoleculeRaw, "opening_key" | "opening_from_undated">, year: number): string {
  if (m.opening_key === null) return "nessun biosimilare con spesa positiva qui";
  if (m.opening_key > year * 12 + 12) return `dopo il ${year}`;
  if (m.opening_from_undated) return `${Math.floor((m.opening_key - 1) / 12)} (mese non indicato: la finestra parte da gennaio)`;
  return monthKeyLabel(m.opening_key);
}

/** "0,1234 €/mg": four significant digits, in the stratum's own unit. */
export function formatUnitRate(eurPerUnit: number, unit: MassUnit): string {
  return `${formatEurSignificant(eurPerUnit)}/${MASS_UNIT_LABEL[unit]}`;
}

// --------------------------------------------------------------------- panel

export interface StratumSideView { spend: string; quantity: string; rate: string; records: string; fewRecords: boolean; channels: string }
export interface StratumRowView {
  label: string;
  /** The internal stratum id: reviewers only (PB-V5-06). */
  rawId: string | null;
  sides: "entrambi i lati" | "solo riferimento" | "solo biosimilare";
  reference: StratumSideView | null;
  biosimilar: StratumSideView | null;
}
export interface StratumMoleculeView {
  substance: string;
  openingLabel: string;
  windowLabel: string;
  funnelLine: string;
  clampNote: string | null;
  strata: StratumRowView[];
}
export interface StratumYearBlock {
  year: number;
  heading: string;
  reconciled: boolean;
  reasons: string[];
  selectionLine: string;
  selection: { matches: boolean; text: string };
  funnelLine: string | null;
  notComparedLine: string | null;
  withoutBiosimilarLine: string | null;
  crossCheckLine: string | null;
  emptyLine: string | null;
  /** [] when the year does not reconcile: no value per unit is shown then. */
  molecules: StratumMoleculeView[];
}
export type StratumCostPanel =
  | { kind: "notice"; summary: string; notice: string; linkToFilters: boolean }
  | {
      kind: "ready";
      summary: string;
      /** Open when any year does not reconcile: a failure does not hide behind a closed panel. */
      open: boolean;
      lead: string[];
      blocks: StratumYearBlock[];
      exclusions: Array<{ term: string; meaning: string }>;
      fewRecordsNote: string | null;
    };

export interface StratumCostContext {
  /** The Azienda as this viewer may name it; null only when none is resolved. */
  aziendaLabel: string | null;
  /** The page's channel filter; [] = every channel. */
  channels: ReadonlyArray<string>;
  substance: string | null;
  /** stratumFacetsReference of the page's own facets read; null when it has none. */
  facetsReference: Map<number, number> | null;
  /** Raw stratum ids, for a widened reviewer only. */
  showStratumIds: boolean;
}

const TITLE = "Costo lordo osservato per unità, nello stesso strato";

const NOTICES = {
  "pick-azienda": {
    suffix: "scegli un'Azienda",
    notice: "Il costo per unità si legge un'Azienda alla volta: scegli un'Azienda nel filtro in alto.",
    linkToFilters: true,
  },
  "not-deployed": {
    suffix: "non ancora disponibile",
    notice: "Costo per strato non disponibile finché la funzione del database che lo calcola non è pubblicata.",
    linkToFilters: false,
  },
  failed: {
    suffix: "non disponibile",
    notice: "La lettura del costo per strato non è riuscita in questo momento; il resto della pagina non ne dipende.",
    linkToFilters: false,
  },
} as const;

export const STRATUM_LEAD = [
  "Per ogni strato (principio attivo, via, forma, unità di massa): spesa e quantità di ciascun lato, nei mesi dal primo biosimilare con spesa positiva in questa Azienda, letto su tutte le vie, tutti i canali e tutto il periodo disponibile. Sono i dati da cui il Quadro esecutivo ricava il «Margine (limite superiore)»; qui il margine non è calcolato.",
  "Spesa rendicontata: IVA inclusa, al lordo di payback e note di credito di registro; non è un prezzo netto né di gara. Ogni strato somma le confezioni (AIC) e i canali dell'anno: non è una serie mensile per confezione. I due valori di uno strato sono affiancati come osservati, senza altri calcoli.",
  "Da verificare prima di ogni lettura: AIC e confezioni dello strato, esiti di gara, canale e mese.",
];

export const STRATUM_EXCLUSIONS: Array<{ term: string; meaning: string }> = [
  { term: "Prima del primo biosimilare", meaning: "la spesa del riferimento nei mesi precedenti; un record senza mese conta per tutto il suo anno" },
  { term: "Senza quantità di massa", meaning: "nella finestra, unità non di massa (UI, U, confezioni e altre), quantità assente o spesa non positiva" },
  { term: "Un solo lato", meaning: "il valore è mostrato, ma senza corrispettivo nello stesso strato" },
  { term: "Rettifiche", meaning: "le note di credito restano nella spesa e nella finestra, mai nel costo per unità" },
  { term: "Unità non di massa", meaning: "€/UI e €/U non sono mostrati in questa versione" },
  { term: "Stati non attribuiti", meaning: "stato non risolto e stessa sostanza non biosimilare non entrano in nessun lato" },
  { term: "Quantità", meaning: "solo come denominatore dentro uno strato, mai sommata fra strati o unità" },
  { term: "Anni", meaning: "2024 e 2025 soltanto, un blocco per anno, mai sommati" },
];

export const FEW_RECORDS_NOTE = `⚑ meno di ${FEW_RECORDS} record: il valore può coincidere con il prezzo di un singolo acquisto.`;

function sideView(side: StratumSideRaw): StratumSideView {
  const unit = massUnit(side.unit);
  return {
    spend: formatEur(side.spend_eur),
    quantity: `${formatNumberUpTo(side.quantity)} ${unit === null ? "" : MASS_UNIT_LABEL[unit]}`.trim(),
    // The rate exists only on a reconciled year, where every side has one mass
    // unit and a positive quantity; the dash is a guard, not a state.
    rate: unit === null || !(side.quantity > 0) ? "—" : formatUnitRate(side.spend_eur / side.quantity, unit),
    records: formatNumberUpTo(side.rows_n, 0),
    fewRecords: side.rows_n < FEW_RECORDS,
    channels: channelShares(side.channels),
  };
}

/** P, N = W − M, O = M − S, S of the reference side: the parts of R. */
function referenceParts(r: StratumMoleculeRaw["reference"]) {
  return { R: r.r_eur, P: r.p_eur, N: r.w_eur - r.m_eur, O: r.m_eur - r.s_eur, S: r.s_eur };
}

function moleculeView(m: StratumMoleculeRaw, year: number, selection: { matches: boolean }, showStratumIds: boolean): StratumMoleculeView {
  const p = referenceParts(m.reference);
  const clamp = marginBase(m.reference);
  return {
    substance: m.active_substance,
    openingLabel: `primo biosimilare con spesa positiva qui: ${openingLabel(m, year)}`,
    windowLabel: `finestra ${year}: ${windowMonths(m.opening_key, year)} mesi su 12`,
    funnelLine: `Riferimento ${eurCents(p.R)} = prima del primo biosimilare ${eurCents(p.P)} + senza quantità di massa ${eurCents(p.N)} + un solo lato ${eurCents(p.O)} + entrambi i lati ${eurCents(p.S)}`,
    clampNote: selection.matches && clamp.binds
      ? `Nel margine la base di questa molecola si ferma alla spesa netta del riferimento ${clamp.cap === "year" ? "nell'anno" : "nella finestra"}, rettifiche comprese: ${eurCents(clamp.base)} invece di ${eurCents(p.S)}.`
      : null,
    strata: orderStrata(m.strata, year).map(({ stratum, label }) => ({
      label,
      rawId: showStratumIds ? stratum.stratum_id : null,
      sides: stratum.reference && stratum.biosimilar ? "entrambi i lati" : stratum.reference ? "solo riferimento" : "solo biosimilare",
      reference: stratum.reference ? sideView(stratum.reference) : null,
      biosimilar: stratum.biosimilar ? sideView(stratum.biosimilar) : null,
    })),
  };
}

function yearBlock(y: StratumYearRaw, ctx: StratumCostContext, label: string): StratumYearBlock {
  // Facets loaded but no Azienda row for this year under the filters: its
  // reference spend there is 0, not unknown.
  const facets = ctx.facetsReference === null ? null : (ctx.facetsReference.get(y.year) ?? 0);
  const check = reconcileYear(y, facets);
  const selection = selectionMatch(y.year, ctx.channels, y.months_observed);
  const base = {
    year: y.year,
    heading: String(y.year),
    reconciled: check.ok,
    reasons: check.reasons,
    selectionLine: `Selezione: ${label} · ${y.year} · ${ctx.channels.length > 0 ? ctx.channels.join(" + ") : "tutti i canali"} · ${ctx.substance ?? "tutte le molecole"}`,
    selection,
  };
  if (!check.ok) {
    return { ...base, funnelLine: null, notComparedLine: null, withoutBiosimilarLine: null, crossCheckLine: null, emptyLine: null, molecules: [] };
  }
  const parts = y.molecules.map((m) => referenceParts(m.reference));
  const total = (k: "R" | "P" | "N" | "O" | "S") => sum(parts.map((p) => p[k]));
  const nc = {
    u: sum(y.molecules.map((m) => m.not_compared.unresolved_eur)),
    v: sum(y.molecules.map((m) => m.not_compared.non_biosimilar_same_substance_eur)),
    o: sum(y.molecules.map((m) => m.not_compared.other_eur)),
  };
  const anyShared = y.molecules.some((m) => m.strata.some((s) => s.shared));
  return {
    ...base,
    funnelLine: y.molecules.length === 0 ? null
      : `Spesa del riferimento ${y.year}, molecole con un biosimilare: ${eurCents(total("R"))} = prima del primo biosimilare qui ${eurCents(total("P"))} + nella finestra, senza quantità di massa confrontabile ${eurCents(total("N"))} + in strati con un solo lato ${eurCents(total("O"))} + in strati con entrambi i lati ${eurCents(total("S"))}. Somma verificata al centesimo.`,
    notComparedLine: [nc.u, nc.v, nc.o].every((x) => round2(x) === 0) ? null
      : `Non attribuiti a nessuno dei due lati: stato non risolto ${formatEur(nc.u)} · stessa sostanza, non biosimilare ${formatEur(nc.v)}${round2(nc.o) === 0 ? "" : ` · altro ${formatEur(nc.o)}`}.`,
    withoutBiosimilarLine: `Riferimento di molecole senza biosimilare in questa selezione: ${formatEur(y.reference_without_biosimilar_eur)}.`
      + (round2(y.reference_no_substance_eur) === 0 ? "" : ` Riferimento senza principio attivo: ${formatEur(y.reference_no_substance_eur)}.`),
    crossCheckLine: check.crossCheck === "ok"
      ? "La spesa del riferimento con mese indicato coincide al centesimo con quella letta per Azienda nel resto della pagina."
      : "Verifica con la spesa per Azienda del resto della pagina non disponibile.",
    emptyLine: y.molecules.length === 0 ? "Nessuna molecola con un biosimilare in questa selezione."
      : !anyShared ? "Nessuno strato con entrambi i lati misurabili in questa selezione."
        : null,
    molecules: orderMolecules(y.molecules).map((m) => moleculeView(m, y.year, selection, ctx.showStratumIds)),
  };
}

/**
 * The panel as strings. No organisation code, no 2026, no raw stratum id
 * unless `showStratumIds`, no rate on a year that does not reconcile. Years
 * are separate blocks, the latest first, never summed.
 */
export function stratumCostPanel(outcome: StratumCostOutcome, ctx: StratumCostContext): StratumCostPanel {
  if (outcome.kind !== "read") {
    const n = NOTICES[outcome.kind];
    return { kind: "notice", summary: `${TITLE} · ${n.suffix}`, notice: n.notice, linkToFilters: n.linkToFilters };
  }
  const label = ctx.aziendaLabel ?? "Azienda selezionata";
  const blocks = [...outcome.raw.byYear].sort((a, b) => b.year - a.year).map((y) => yearBlock(y, ctx, label));
  const allOk = blocks.every((b) => b.reconciled);
  const few = blocks.some((b) => b.molecules.some((m) => m.strata.some((s) => s.reference?.fewRecords || s.biosimilar?.fewRecords)));
  return {
    kind: "ready",
    summary: `${TITLE} · ${label} · ${[...outcome.raw.years].sort((a, b) => a - b).join(" e ")} · ${allOk ? "somme verificate" : "non riconciliato"}`,
    open: !allOk,
    lead: [...STRATUM_LEAD],
    blocks,
    exclusions: STRATUM_EXCLUSIONS.map((e) => ({ ...e })),
    fewRecordsNote: few ? FEW_RECORDS_NOTE : null,
  };
}
