import type { AntibioticIndicatorSet } from '../dashboard-review/types';

export interface CategoryTotals {
  cost: number;
  ddd: number;
  bedDays: number;
  population: number;
}

export function daysInYear(year: number): number {
  if (!Number.isInteger(year) || year < 1) throw new Error('Invalid reporting year');
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
}

export function indicatorsFromTotals(t: CategoryTotals | undefined, year: number): AntibioticIndicatorSet | null {
  if (!t) return null;
  const days = daysInYear(year);
  return {
    dddPer100BedDays: t.bedDays > 0 ? t.ddd / t.bedDays * 100 : null,
    costPerBedDay: t.bedDays > 0 ? t.cost / t.bedDays : null,
    costPerDdd: t.ddd > 0 ? t.cost / t.ddd : null,
    dddPer1000ResidentsDay: t.population > 0 ? t.ddd / (t.population / 1000) / days : null,
    costPerCapita: t.population > 0 ? t.cost / t.population : null,
  };
}
