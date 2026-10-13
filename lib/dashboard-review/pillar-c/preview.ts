/**
 * UI fixtures only. No source workbook, patient, organization or production
 * fact is represented here. Accepted workbook outputs need a separate,
 * server-side adapter and release contract before a real mode can be added.
 */
export const PILLAR_C_PREVIEW_MODE = "synthetic" as const;
export const PILLAR_C_PREVIEW_VERSION = "ui-preview-20261013";

export const PORTFOLIOS = [
  { id: "oncologia", label: "Oncologia", previous: 2_850_000, current: 3_420_000, budget: 3_300_000, color: "var(--viz-1)", shared: 0.19 },
  { id: "immunologia", label: "Immunologia", previous: 1_980_000, current: 2_160_000, budget: 2_240_000, color: "var(--viz-2)", shared: 0.42 },
  { id: "cardiometabolico", label: "Cardiometabolico", previous: 1_450_000, current: 1_380_000, budget: 1_420_000, color: "var(--viz-3)", shared: 0.12 },
  { id: "neurologia", label: "Neurologia", previous: 960_000, current: 1_130_000, budget: 1_060_000, color: "var(--viz-4)", shared: 0.28 },
  { id: "antinfettivi", label: "Antinfettivi", previous: 870_000, current: 790_000, budget: 820_000, color: "var(--viz-5)", shared: 0.35 },
  { id: "altri", label: "Altri portafogli", previous: 640_000, current: 720_000, budget: 760_000, color: "var(--viz-6)", shared: 0.22 },
] as const;

export type PreviewYear = "2024" | "2025";
export type PreviewChannel = "all" | "DD" | "DPC" | "CO";
export type PreviewPortfolio = "all" | typeof PORTFOLIOS[number]["id"];
export type PreviewFilters = {
  year: PreviewYear;
  channel: PreviewChannel;
  portfolio: PreviewPortfolio;
  composition: "amount" | "share";
  trend: "monthly" | "cumulative";
  budget: "amount" | "deviation";
};

export const DEFAULT_PREVIEW_FILTERS: PreviewFilters = {
  year: "2025", channel: "all", portfolio: "all",
  composition: "amount", trend: "monthly", budget: "amount",
};
const PARAMS: Record<keyof PreviewFilters, string> = {
  year: "pc_anno", channel: "pc_canale", portfolio: "pc_portafoglio",
  composition: "pc_composizione", trend: "pc_andamento", budget: "pc_budget",
};

export function parsePreviewFilters(params: URLSearchParams): PreviewFilters {
  const pick = <K extends keyof PreviewFilters>(key: K, allowed: readonly PreviewFilters[K][]): PreviewFilters[K] => {
    const value = params.get(PARAMS[key]);
    return allowed.includes(value as PreviewFilters[K]) ? value as PreviewFilters[K] : DEFAULT_PREVIEW_FILTERS[key];
  };
  return {
    year: pick("year", ["2024", "2025"]), channel: pick("channel", ["all", "DD", "DPC", "CO"]),
    portfolio: pick("portfolio", ["all", ...PORTFOLIOS.map((p) => p.id)]),
    composition: pick("composition", ["amount", "share"]),
    trend: pick("trend", ["monthly", "cumulative"]), budget: pick("budget", ["amount", "deviation"]),
  };
}

export function previewSearch(search: string, patch: Partial<PreviewFilters>, reset = false): string {
  const params = new URLSearchParams(search);
  const filters = reset ? DEFAULT_PREVIEW_FILTERS : { ...parsePreviewFilters(params), ...patch };
  for (const [key, param] of Object.entries(PARAMS) as [keyof PreviewFilters, string][]) {
    if (filters[key] === DEFAULT_PREVIEW_FILTERS[key]) params.delete(param);
    else params.set(param, filters[key]);
  }
  return params.size ? `?${params.toString()}` : "";
}

// Exact integer partitions of deliberately invented annual amounts.
const MONTH_WEIGHTS = [9, 8, 9, 8, 9, 8, 9, 6, 8, 9, 8, 9];
const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
function monthly(total: number): number[] {
  const values = MONTH_WEIGHTS.map((weight) => Math.floor(total * weight / 100));
  values[11] += total - values.reduce((sum, n) => sum + n, 0);
  return values;
}
function channelAmount(total: number, channel: PreviewChannel): number {
  const dd = Math.floor(total * 0.45), dpc = Math.floor(total * 0.2);
  return channel === "all" ? total : channel === "DD" ? dd : channel === "DPC" ? dpc : total - dd - dpc;
}

export function buildPreview(filters: PreviewFilters) {
  const portfolios = PORTFOLIOS.filter((p) => filters.portfolio === "all" || p.id === filters.portfolio).map((p) => {
    const previous = channelAmount(p.previous, filters.channel), current = channelAmount(p.current, filters.channel);
    const budget = channelAmount(p.budget, filters.channel);
    return { ...p, previous, current, budget, amount: filters.year === "2025" ? current : previous,
      change: current - previous, deviation: current - budget };
  });
  const sum = (field: "amount" | "previous" | "current" | "budget") => portfolios.reduce((total, p) => total + p[field], 0);
  const amount = sum("amount"), previous = sum("previous"), current = sum("current");
  const shared = portfolios.reduce((total, p) => total + Math.round(p.amount * p.shared), 0);
  const insufficient = Math.round(amount * 0.05), unmapped = Math.round(amount * 0.02);
  const unique = amount - shared - insufficient - unmapped;
  const previousMonths = monthly(previous), currentMonths = monthly(current);
  let previousRunning = 0, currentRunning = 0;
  const months = MONTHS.map((month, i) => {
    previousRunning += previousMonths[i]; currentRunning += currentMonths[i];
    return { month, previous: filters.trend === "monthly" ? previousMonths[i] : previousRunning,
      current: filters.trend === "monthly" ? currentMonths[i] : currentRunning };
  });
  return {
    mode: PILLAR_C_PREVIEW_MODE,
    amount, previous, current, change: current - previous, shared,
    sharedShare: amount > 0 ? shared / amount : null,
    portfolios: [...portfolios].sort((a, b) => b.amount - a.amount), months,
    attribution: [
      { id: "S2", label: "Proxy di portafoglio unico", value: unique, color: "var(--viz-1)" },
      { id: "S3", label: "Condivisa tra portafogli", value: shared, color: "var(--viz-2)" },
      { id: "S4", label: "Evidenza insufficiente", value: insufficient, color: "var(--viz-4)" },
      { id: "S5", label: "Identificativo da risolvere", value: unmapped, color: "var(--viz-6)" },
    ],
  };
}

export type PreviewModel = ReturnType<typeof buildPreview>;

export const WORKBOOK_SECTIONS = [
  { id: "portafogli", number: "01", label: "Portafogli", question: "Dove si concentra la spesa?", sheets: "08 · 09 · 17", gate: "PC-09 · PC-11 · PC-17" },
  { id: "attribuzione", number: "02", label: "Attribuzione", question: "Quanto è sostenuto dall’evidenza?", sheets: "05 · 06 · 07 · 19", gate: "PC-05 · PC-10 · PC-19" },
  { id: "variazioni", number: "03", label: "Variazioni", question: "Che cosa spiega il cambiamento?", sheets: "10 · 11 · 12", gate: "PC-12 · PC-13" },
  { id: "budget", number: "04", label: "Budget", question: "Come si confrontano spesa e obiettivi?", sheets: "13 · 14 · 15 · 16 · 18", gate: "PC-14 · PC-15 · PC-16 · PC-18" },
  { id: "priorita", number: "05", label: "Priorità", question: "Quale verifica viene prima?", sheets: "20", gate: "PC-20" },
  { id: "fonti", number: "06", label: "Fonti e metodo", question: "Da quale evidenza nasce il risultato?", sheets: "00–04 · 21–23", gate: "PC-01 · PC-02 · PC-21 · PC-22" },
] as const;

/** UI publication eligibility only; this grants no database access. */
export function canSeePillarCPreview(approved: boolean, reviewer: boolean, admin: boolean): boolean {
  return approved && (reviewer || admin);
}
