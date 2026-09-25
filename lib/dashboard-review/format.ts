import {itNumberFormat} from "@/lib/format/it-number";
// Every formatter here goes through itNumberFormat, which pins useGrouping.
// The reasoning lives in lib/format/it-number.ts; in short, Italian
// minimumGroupingDigits = 2 makes four-digit grouping ICU-dependent, so an
// unpinned formatter renders differently on the server and in the browser and
// React reports a hydration mismatch.
const eurFormatter = itNumberFormat({
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEur(value: number): string {
  return eurFormatter.format(value);
}

export function formatEurPrecise(value: number, decimals = 2): string {
  return itNumberFormat({
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number): string {
  return itNumberFormat({
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
}

export function formatNumber(value: number, decimals = 1): string {
  return itNumberFormat({
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
