// useGrouping is pinned on every formatter below. Italian sets
// minimumGroupingDigits = 2, so under the default "auto" a four-digit number
// keeps its separator on one ICU version and drops it on another ("8.744 €" vs
// "8744 €"). Server and browser then disagree and React reports a hydration
// mismatch. Pinning it makes the output identical everywhere.
const eurFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  useGrouping: true,
});

export function formatEur(value: number): string {
  return eurFormatter.format(value);
}

export function formatEurPrecise(value: number, decimals = 2): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "percent",
    maximumFractionDigits: 1,
    useGrouping: true,
  }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
}

export function formatNumber(value: number, decimals = 1): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(value);
}
