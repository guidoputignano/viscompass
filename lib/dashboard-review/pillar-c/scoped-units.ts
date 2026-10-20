/** Pillar C organisation-scoped delivery (recommendation 5): the entitlement units.
 *
 * Pure and browser-safe: names only, no figure, no hash and no province key.
 * Each Azienda's files are pseudonymised once, in the private builder, under the
 * reviewed order of REVIEWED_PSEUDONYMS (lib/analytics/org-pseudonym.ts):
 * organisation 201 is unit `asl-1` ... 204 is `asl-4`. The aggregate of the four
 * Aziende is unit `aggregato`. The unit is also the key every scoped payload,
 * URL and export carries: a scoped view never names an Azienda by a province key.
 * The database decides which units a session may read
 * (public.pillar_c_scoped_units(), migration 20261020120000); these constants
 * only mirror that mapping so the server can check that the answer is coherent. */
export const C_SCOPED_ASL_UNITS = ["asl-1", "asl-2", "asl-3", "asl-4"] as const;
export const C_SCOPED_AGGREGATE = "aggregato" as const;
export const C_SCOPED_UNITS = [...C_SCOPED_ASL_UNITS, C_SCOPED_AGGREGATE] as const;
export type CScopedAslUnit = typeof C_SCOPED_ASL_UNITS[number];
export type CScopedUnit = typeof C_SCOPED_UNITS[number];

/** The only region whose organisations have units (owner decisions O1 and O3 are for this region only). */
export const C_SCOPED_REGION_CODE = "130";
/** The regione-type organisation of that region. */
export const C_SCOPED_REGIONE_CODE = "130";
export const C_SCOPED_ASL_CODES = ["201", "202", "203", "204"] as const;
export type CScopedAslCode = typeof C_SCOPED_ASL_CODES[number];
/** Same order as the migration's CASE and as REVIEWED_PSEUDONYMS; tests pin all three together. */
export const C_SCOPED_UNIT_OF_CODE: Readonly<Record<CScopedAslCode, CScopedAslUnit>> = { "201": "asl-1", "202": "asl-2", "203": "asl-3", "204": "asl-4" };

export function isCScopedUnit(value: unknown): value is CScopedUnit {
  return typeof value === "string" && (C_SCOPED_UNITS as readonly string[]).includes(value);
}
export function isCScopedAslCode(value: unknown): value is CScopedAslCode {
  return typeof value === "string" && (C_SCOPED_ASL_CODES as readonly string[]).includes(value);
}
