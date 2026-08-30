const eurFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
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
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
}
