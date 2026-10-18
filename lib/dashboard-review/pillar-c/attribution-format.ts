import { itNumber } from "@/lib/format/it-number";

/** One scale per axis, not a millions label on a small-euro selection. */
export function cAttrAxis(value: number, maximum: number): string {
  const scale = Math.abs(maximum) >= 1_000_000 ? 1_000_000 : Math.abs(maximum) >= 1_000 ? 1_000 : 1;
  return `${itNumber(value / scale, { maximumFractionDigits: 2 })} ${scale === 1_000_000 ? "M€" : scale === 1_000 ? "k€" : "€"}`;
}

export function cAttrPercent(value: number | null): string {
  if (value === null) return "Non calcolabile";
  if (value > 0 && value * 100 < 0.01) return "<0,01%";
  return `${itNumber(value * 100, { maximumFractionDigits: 2 })}%`;
}

export const cAttrEntries = (count: number) => `${itNumber(count)} ${count === 1 ? "voce prodotto" : "voci prodotto"}`;
