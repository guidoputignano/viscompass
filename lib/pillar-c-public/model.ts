/** Public-source result fields only. No private dashboard, auth or database imports. */
export type Numeric = number | null;
export type TrendRow = { year: number; abruzzo: number; italy: number; rest: number; abruzzoChange: Numeric; restChange: Numeric; abruzzoIndex: number; restIndex: number; partial: boolean; vintage: string };
export type RegionRow = { name: string; population: number; direct: Numeric; classA: Numeric; classH: Numeric; classC: Numeric; conventional: Numeric; missingDirect: number };
export type ActivityRow = { name: string; population: number; admissions: Numeric; rate: Numeric; stay: Numeric; occupancy: Numeric; prescriptions: Numeric; prescriptionCost: Numeric };
export type DiagnosisRow = { chapter: string; label: string; abruzzoAdmissions: Numeric; abruzzoShare: Numeric; abruzzoRate: Numeric; abruzzoStay: Numeric; italyAdmissions: Numeric; italyRate: Numeric; italyStay: Numeric };
export type ForecastMonth = { month: number; observed: Numeric; observedPartial: boolean; point: number; low80: number; high80: number; low95: number; high95: number };
export type ForecastSeries = { key: "TOT" | "A" | "H"; label: string; months: ForecastMonth[]; annual: { total: number; low80: number; high80: number; low95: number; high95: number } };
export type PublicCData = {
  schema: "public-pillar-c-v1"; version: string; region: "Abruzzo";
  references: { id: string; name: string; url: string; licence: string; licenceUrl: string | null }[];
  trend: TrendRow[]; regions: RegionRow[];
  reimbursement: { year: number; geography: string; shares: Record<string, Numeric>; total: number }[];
  atc: { code: string; label: string; abruzzo2024: Numeric; rest2024: Numeric; difference2024: Numeric; abruzzo2025: Numeric; rest2025: Numeric; difference2025: Numeric }[];
  activity: ActivityRow[]; diagnoses: DiagnosisRow[];
  forecast: { region: "Abruzzo"; year: 2026; observedYear: 2025; series: ForecastSeries[] };
};

export const C_PUBLIC_SECTIONS = [
  { id: "andamento", label: "Andamento" }, { id: "regioni", label: "Regioni" },
  { id: "composizione", label: "Composizione" }, { id: "contesto", label: "Contesto SSN" }, { id: "previsione", label: "Previsione" },
] as const;
export const C_PUBLIC_DEFAULTS = { trend: "index", regional: "direct", region: "ABRUZZO", composition: "classes", year: "2025", context: "activity", activity: "rate", diagnosis: "rate", series: "TOT", band: "80", view1: "chart", view2: "chart", view3: "chart", view4: "chart", view5: "chart" } as const;
export type PublicCSelection = { -readonly [K in keyof typeof C_PUBLIC_DEFAULTS]: string };
export function parsePublicCSelection(params: Pick<URLSearchParams, "get">, data: PublicCData): PublicCSelection {
  const allowed: Record<keyof PublicCSelection, readonly string[]> = {
    trend: ["index", "amount", "change"], regional: ["direct", "classA", "classH", "classC", "conventional"], region: regionalRows(data).map(r => r.name),
    composition: ["classes", "atc"], year: data.trend.map(r => String(r.year)),
    context: ["activity", "diagnoses"], activity: ["rate", "stay", "occupancy", "prescriptions", "prescriptionCost"], diagnosis: ["rate", "stay", "admissions"], series: ["TOT", "A", "H"], band: ["80", "95"],
    view1: ["chart", "table"], view2: ["chart", "table"], view3: ["chart", "table"], view4: ["chart", "table"], view5: ["chart", "table"],
  };
  const selection = Object.fromEntries(Object.entries(C_PUBLIC_DEFAULTS).map(([key, fallback]) => { const k = key as keyof PublicCSelection, value = params.get(k); return [k, value && allowed[k].includes(value) ? value : fallback]; })) as PublicCSelection;
  if (selection.composition === "atc" && !["2024", "2025"].includes(selection.year)) selection.year = "2025";
  return selection;
}
export function publicCSearch(selection: PublicCSelection): string {
  const p = new URLSearchParams();
  for (const key of Object.keys(C_PUBLIC_DEFAULTS) as (keyof PublicCSelection)[]) if (selection[key] !== C_PUBLIC_DEFAULTS[key]) p.set(key, selection[key]);
  return p.size ? `?${p}` : "";
}
export function territoryName(name: string): string {
  if (name.startsWith("Italia")) return name;
  if (name.toUpperCase() === "VALLE D'AOSTA") return "Valle d’Aosta";
  if (name.startsWith("PA ")) return "P.A. " + territoryName(name.slice(3));
  return name.toLocaleLowerCase("it").replace(/(^|[ -])\p{L}/gu, c => c.toLocaleUpperCase("it")).replace(/^P\.a\./, "P.A.");
}
export function regionalRows(data: PublicCData): RegionRow[] { return data.regions.filter(r => !r.name.startsWith("Italia")); }
export function forecastSeries(data: PublicCData, key: string): ForecastSeries { return data.forecast.series.find(s => s.key === key) ?? data.forecast.series[0]; }
