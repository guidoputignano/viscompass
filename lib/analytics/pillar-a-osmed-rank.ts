// Territorial position on the PNCAR indicator.
//
// This ranks TERRITORIES against each other and nothing else. It is not a
// hospital or Azienda ranking and cannot become one: the denominator behind
// every rate here is regional hospital activity, for which no per-structure
// version exists in any source the project holds.
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
