// Territorial position on the PNCAR indicator.
//
// This ranks TERRITORIES against each other and nothing else. It is not a
// hospital or Azienda ranking.
//
// It previously said no per-structure denominator "exists in any source the
// project holds". That was wrong, and wrong in the direction that stops anyone
// checking: data/raw/denominators/ministry/hospital_structure_activity_2022.csv
// carries giornate_degenza per structure with codice_asl, across 53 ASLs.
//
// It still cannot be used here, for reasons worth stating so the next reader
// does not re-litigate them:
//   * 2022 only. The consumption series runs 2023-2025, so there is no overlap.
//   * No accessi column. OSMED's denominator is ordinary-regime days PLUS day
//     hospital / day surgery; this file has DH/DS *beds*, not accesses.
//   * It does not reconcile to the regional SDO totals, and the perimeter
//     (which tipo_struttura count as OSMED's "ospedali pubblici") is unresolved.
// So the gap is a specific, closeable data gap rather than an absence.
export type OsmedRow = { region: string; rates: Record<string, number> };

export type TerritorialPosition = {
  /** Territories with both a baseline and an observed rate. Italy is excluded. */
  peers: number;
  /** 1 = lowest consumption intensity in the observed year. */
  levelRank: number;
  /** 1 = largest reduction between baseline and observed year. */
  changeRank: number;
  /** How many territories already sit below the plan's reduction threshold. */
  meetingThreshold: number;
};

const NATIONAL = "000";

export function territorialPosition(
  rows: readonly OsmedRow[],
  region: string,
  baselineYear: string,
  observedYear: string,
  reductionStrictlyGreaterThan: number,
): TerritorialPosition | null {
  if (region === NATIONAL) return null;

  // A territory joins the comparison only if it carries both years. A missing
  // rate is absent, never zero, so it must not be ranked as the lowest value.
  const peers = rows.filter(
    (r) =>
      r.region !== NATIONAL &&
      typeof r.rates[baselineYear] === "number" &&
      typeof r.rates[observedYear] === "number" &&
      r.rates[baselineYear] > 0,
  );
  if (!peers.some((r) => r.region === region)) return null;

  const byLevel = [...peers].sort(
    (a, b) => a.rates[observedYear] - b.rates[observedYear] || a.region.localeCompare(b.region),
  );
  const ratio = (r: OsmedRow) => r.rates[observedYear] / r.rates[baselineYear];
  const byChange = [...peers].sort((a, b) => ratio(a) - ratio(b) || a.region.localeCompare(b.region));

  return {
    peers: peers.length,
    levelRank: byLevel.findIndex((r) => r.region === region) + 1,
    changeRank: byChange.findIndex((r) => r.region === region) + 1,
    meetingThreshold: peers.filter((r) => ratio(r) < 1 - reductionStrictlyGreaterThan).length,
  };
}
