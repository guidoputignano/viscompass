import type {
  AntibioticAnnualRow,
  AntibioticIndicatorSet,
  AntibioticStewardshipData,
  AntibioticUnitRow,
  AwareYearRow,
} from "./types";

// Deterministic demonstration data. The shape and plausible ranges follow the
// supplied 2023-2025 AWaRe workbook, but every value and label below is
// synthetic. These rows must never be inserted into the production fact table.
const AWARE: AwareYearRow[] = [
  { year: 2023, access: 520_000, watch: 2_540_000, reserve: 4_020_000, unclassified: 0, accessDdd: 198_000, watchDdd: 432_000, reserveDdd: 76_000, unclassifiedDdd: 0, hasNegativeGap: false },
  { year: 2024, access: 604_000, watch: 2_320_000, reserve: 3_786_000, unclassified: 0, accessDdd: 219_000, watchDdd: 456_000, reserveDdd: 76_000, unclassifiedDdd: 0, hasNegativeGap: false },
  { year: 2025, access: 590_000, watch: 2_115_000, reserve: 3_445_000, unclassified: 0, accessDdd: 224_000, watchDdd: 493_000, reserveDdd: 66_000, unclassifiedDdd: 0, hasNegativeGap: false },
];

const ANNUAL_INPUT = [
  { year: 2023, costEur: 7_080_000, dddCount: 706_000, bedDays: 910_000, population: 1_187_000 },
  { year: 2024, costEur: 6_710_000, dddCount: 751_000, bedDays: 922_000, population: 1_176_000 },
  { year: 2025, costEur: 6_150_000, dddCount: 783_000, bedDays: 912_000, population: 1_162_000 },
] as const;

function indicators(input: { costEur: number; dddCount: number; bedDays: number; population: number }): AntibioticIndicatorSet {
  return {
    dddPer100BedDays: input.bedDays > 0 ? (input.dddCount / input.bedDays) * 100 : null,
    costPerBedDay: input.bedDays > 0 ? input.costEur / input.bedDays : null,
    costPerDdd: input.dddCount > 0 ? input.costEur / input.dddCount : null,
    dddPer1000ResidentsDay: input.population > 0 ? input.dddCount / (input.population / 1000) / 365 : null,
    costPerCapita: input.population > 0 ? input.costEur / input.population : null,
  };
}

const ANNUAL: AntibioticAnnualRow[] = ANNUAL_INPUT.map((row, index) => {
  const previous = ANNUAL_INPUT[index - 1];
  return {
    ...row,
    ...indicators(row),
    costYoy: previous ? row.costEur / previous.costEur - 1 : null,
    dddYoy: previous ? row.dddCount / previous.dddCount - 1 : null,
  };
});

const UNIT_INPUT = [
  ["AM", "Area medica", 1_245_000, 176_000, 187_000],
  ["AC", "Area chirurgica", 538_000, 49_000, 72_000],
  ["EM", "Ematologia", 1_480_000, 27_500, 31_000],
  ["TI", "Terapia intensiva", 720_000, 13_800, 12_600],
  ["PA", "Presidio A", 640_000, 76_000, 60_000],
  ["PB", "Presidio B", 505_000, 62_500, 56_000],
  ["AU", "Altre unità", 1_022_000, 119_000, 493_400],
] as const;

const UNITS: AntibioticUnitRow[] = UNIT_INPUT.map(([unitCode, unitName, costEur, dddCount, bedDays]) => ({
  orgCode: "DEMO",
  unitCode,
  unitName,
  costEur,
  dddCount,
  bedDays,
  ...indicators({ costEur, dddCount, bedDays, population: 0 }),
}));

export function getSyntheticAntibioticStewardship(): AntibioticStewardshipData {
  const latest = ANNUAL.at(-1)!;
  return {
    mode: "synthetic",
    sourceLabel: "Scenario dimostrativo · valori sintetici ispirati alla struttura AWaRe 2023–2025",
    awareByYear: AWARE,
    annual: ANNUAL,
    units: UNITS,
    latestYear: latest.year,
    orgIndicators: {
      dddPer100BedDays: latest.dddPer100BedDays,
      costPerBedDay: latest.costPerBedDay,
      costPerDdd: latest.costPerDdd,
      dddPer1000ResidentsDay: latest.dddPer1000ResidentsDay,
      costPerCapita: latest.costPerCapita,
    },
    regionalAverage: {
      dddPer100BedDays: 83.2,
      costPerBedDay: 7.04,
      costPerDdd: 8.47,
      dddPer1000ResidentsDay: 1.78,
      costPerCapita: 5.42,
      peerOrgCount: 4,
    },
  };
}
