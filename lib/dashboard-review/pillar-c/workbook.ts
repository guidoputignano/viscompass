/** Exact, review-only workbook snapshots. No client-side business aggregation. */
import { itNumberFormat } from "@/lib/format/it-number";

export const C_WORKBOOK_SECTIONS = [
  ["spesa", "Spesa", "Importi e copertura"],
  ["composizione", "Composizione", "ATC e portafogli"],
  ["attribuzione", "Attribuzione", "Copertura e incertezza"],
  ["cambiamento", "Variazioni", "Prodotti e contributi"],
  ["costi", "Prezzo, volume e mix", "Supporto e scomposizioni"],
  ["confronti", "Confronti", "Indici e comparabilità"],
  ["attivita", "Attività e contesto", "Fonti pubbliche e territori"],
  ["pianificazione", "Budget", "Atti, ipotesi e allocazioni"],
  ["numerosita", "Numerosità", "Scenari CO"],
  ["tendenze", "Andamenti", "Tendenze e ammissione"],
  ["previsione", "Previsione", "Modelli e scenari"],
  ["sensibilita", "Sensibilità", "Ipotesi alternative"],
  ["priorita", "Priorità", "Domande di revisione"],
  ["evidenza", "Evidenza", "Fonti e tracciabilità"],
] as const;
export type CWorkbookSectionId = typeof C_WORKBOOK_SECTIONS[number][0];
export const C_WORKBOOK_HASH = "f8fe8b13f10eab51194b057f52dd11a599d28d827ce92438b1043837c60894bb";
export type CWorkbookCell = string | [string, number] | null;
export type CWorkbookOutput = {
  id: string; title: string; section: CWorkbookSectionId; tier: string; qualifier: string; grain: string;
  ranges: string[]; availability: "snapshot" | "withheld"; reason: string | null; sourceState: string;
};
export type CWorkbookTable = {
  sheet: string; range: string; startColumn: number; columns: string[]; headerRow: number;
  rows: CWorkbookCell[][]; sourceRows: number[]; notes: [number, string[]][]; numericColumns: number[];
};
export type CWorkbookIndex = {
  schema: "pillar-c-workbook-index-v1"; workbookSha256: typeof C_WORKBOOK_HASH; outputs: CWorkbookOutput[];
  sections: Partial<Record<CWorkbookSectionId, { sha256: string; bytes: number; outputs: number }>>;
};
export type CWorkbookSection = {
  schema: "pillar-c-workbook-section-v1"; workbookSha256: typeof C_WORKBOOK_HASH; section: CWorkbookSectionId;
  formats: Record<string, string>; outputs: (CWorkbookOutput & { tables: CWorkbookTable[] })[];
};
const HASH = /^[a-f0-9]{64}$/;
const DECIMAL = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const RANGE = /^[A-Z]+\d+:[A-Z]+\d+$/;
export const isCWorkbookSection = (v: unknown): v is CWorkbookSectionId => C_WORKBOOK_SECTIONS.some(([id]) => v === id);
function check(ok: unknown): asserts ok { if (!ok) throw new Error("PILLAR_C_WORKBOOK_INVALID"); }
function object(v: unknown): Record<string, unknown> { check(v && typeof v === "object" && !Array.isArray(v)); return v as Record<string, unknown>; }
function exact(o: Record<string, unknown>, keys: string[]) { check(Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k))); }
function string(v: unknown, max = 8_000): asserts v is string { check(typeof v === "string" && v.length <= max && !/[\u0000-\u0008]/.test(v)); }
function integer(v: unknown, min = 0, max = 100_000): asserts v is number { check(Number.isInteger(v) && Number(v) >= min && Number(v) <= max); }
function strings(v: unknown, max: number) { check(Array.isArray(v) && v.length <= max); v.forEach(x => string(x)); return v as string[]; }
function parseMeta(v: unknown, table = false): CWorkbookOutput {
  const o = object(v);
  exact(o, ["id", "title", "section", "tier", "qualifier", "grain", "ranges", "availability", "reason", "sourceState", ...(table ? ["tables"] : [])]);
  for (const k of ["id", "title", "tier", "qualifier", "grain", "sourceState"]) string(o[k]);
  check(/^[A-Za-z0-9/-]+$/.test(o.id as string)); check(isCWorkbookSection(o.section));
  const ranges = strings(o.ranges, 8); check(ranges.length > 0 && ranges.every(r => /^[A-Za-z0-9_]+![A-Z]+\d+:[A-Z]+\d+$/.test(r)));
  check(o.availability === "snapshot" || o.availability === "withheld");
  check(o.reason === null || typeof o.reason === "string");
  if (o.availability === "withheld") check(typeof o.reason === "string" && o.reason.length > 0);
  return o as CWorkbookOutput;
}
export function parseCWorkbookIndex(value: unknown): CWorkbookIndex {
  const p = object(value); exact(p, ["schema", "workbookSha256", "outputs", "sections"]);
  check(p.schema === "pillar-c-workbook-index-v1" && p.workbookSha256 === C_WORKBOOK_HASH);
  check(Array.isArray(p.outputs) && p.outputs.length > 0 && p.outputs.length <= 160);
  const outputs = p.outputs.map(x => parseMeta(x)); check(new Set(outputs.map(o => o.id)).size === outputs.length);
  const sections = object(p.sections);
  for (const [id, v] of Object.entries(sections)) {
    check(isCWorkbookSection(id)); const s = object(v); exact(s, ["sha256", "bytes", "outputs"]);
    check(typeof s.sha256 === "string" && HASH.test(s.sha256)); integer(s.bytes, 2, 5_000_000); integer(s.outputs, 1, 160);
    check(outputs.filter(o => o.section === id).length === s.outputs);
  }
  check(outputs.every(o => Object.hasOwn(sections, o.section)));
  return p as CWorkbookIndex;
}
export function parseCWorkbookSection(value: unknown, expected: CWorkbookSectionId, index: CWorkbookIndex): CWorkbookSection {
  const p = object(value); exact(p, ["schema", "workbookSha256", "section", "formats", "outputs"]);
  check(p.schema === "pillar-c-workbook-section-v1" && p.workbookSha256 === C_WORKBOOK_HASH && p.section === expected);
  const formats = object(p.formats); check(Object.keys(formats).length < 300);
  for (const [k, v] of Object.entries(formats)) { check(/^\d+$/.test(k)); string(v, 500); }
  check(Array.isArray(p.outputs)); const definitions = index.outputs.filter(o => o.section === expected);
  check(p.outputs.length === definitions.length);
  const seen = new Set<string>();
  for (const v of p.outputs) {
    const meta = parseMeta(v, true), o = object(v), def = definitions.find(d => d.id === meta.id);
    check(def && !seen.has(meta.id)); seen.add(meta.id);
    for (const k of Object.keys(def)) check(JSON.stringify(o[k]) === JSON.stringify(def[k as keyof CWorkbookOutput]));
    check(Array.isArray(o.tables) && o.tables.length <= 8);
    if (meta.availability === "withheld") check(o.tables.length === 0);
    else check(o.tables.length > 0);
    for (const raw of o.tables) {
      const t = object(raw); exact(t, ["sheet", "range", "startColumn", "columns", "headerRow", "rows", "sourceRows", "notes", "numericColumns"]);
      string(t.sheet, 64); string(t.range, 64); check(RANGE.test(t.range)); check(meta.ranges.includes(`${t.sheet}!${t.range}`));
      integer(t.startColumn, 1, 100); integer(t.headerRow, 1); const cols = strings(t.columns, 100); check(cols.length > 0);
      check(Array.isArray(t.rows) && t.rows.length <= 12_000 && Array.isArray(t.sourceRows) && t.sourceRows.length === t.rows.length);
      let prior = Number(t.headerRow);
      for (const r of t.sourceRows) { integer(r, prior + 1); prior = r; }
      for (const row of t.rows) {
        check(Array.isArray(row) && row.length === cols.length);
        for (const c of row) {
          if (c === null) continue;
          if (typeof c === "string") { string(c); continue; }
          check(Array.isArray(c) && c.length === 2); string(c[0], 128); check(DECIMAL.test(c[0]) && Number.isFinite(Number(c[0])));
          integer(c[1], 0, 1_000); check(Object.hasOwn(formats, String(c[1])));
        }
      }
      check(Array.isArray(t.numericColumns) && new Set(t.numericColumns).size === t.numericColumns.length);
      for (const c of t.numericColumns) integer(c, 0, cols.length - 1);
      check(Array.isArray(t.notes) && t.notes.length <= 5);
      for (const note of t.notes) { check(Array.isArray(note) && note.length === 2); integer(note[0], 1, Number(t.headerRow)); strings(note[1], 100); }
    }
  }
  return p as CWorkbookSection;
}
export function cWorkbookRaw(cell: CWorkbookCell): string { return cell === null ? "" : typeof cell === "string" ? cell : cell[0]; }
export function cWorkbookNumber(cell: CWorkbookCell): number | null { return Array.isArray(cell) ? Number(cell[0]) : null; }
/** Decimal rounding without a binary float hop, including exponent notation. */
export function cWorkbookDecimal(raw: string, places: number, percent = false): string {
  if (!DECIMAL.test(raw) || places < 0 || places > 10) return "Non disponibile";
  const [mantissa, exponent = "0"] = raw.toLowerCase().split("e"), negative = mantissa.startsWith("-");
  const [whole, fraction = ""] = mantissa.replace(/^-/, "").split(".");
  const shift = Number(exponent) + places + (percent ? 2 : 0) - fraction.length;
  if (Math.abs(shift) > 350) return "Non disponibile";
  let magnitude = BigInt(whole + fraction);
  if (shift >= 0) magnitude *= BigInt(10) ** BigInt(shift);
  else { const divisor = BigInt(10) ** BigInt(-shift); magnitude = (magnitude + divisor / BigInt(2)) / divisor; }
  const unit = BigInt(10) ** BigInt(places), integerPart = itNumberFormat().format(magnitude / unit);
  return `${negative && magnitude !== BigInt(0) ? "-" : ""}${integerPart}${places ? "," + (magnitude % unit).toString().padStart(places, "0") : ""}`;
}
export function cWorkbookLabel(cell: CWorkbookCell, formats: Record<string, string>, heading = ""): string {
  if (cell === null) return "—";
  if (typeof cell === "string") return cell;
  const [raw, id] = cell, fmt = formats[id] ?? "General", stripped = fmt.replace(/"[^"]*"/g, "");
  // Years and identifier columns are labels, not grouped quantities.
  if (/^(?:anno|year|codice|id|chiave)(?:$|\s| ·)/i.test(heading) && /^\d+$/.test(raw)) return raw;
  if (/[dy]/i.test(stripped) && !/[Ee][+-]0/.test(stripped) && !stripped.includes("General")) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86_400_000);
    if (Number.isFinite(date.getTime())) return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC" }).format(date);
  }
  if (/E[+-]0/i.test(stripped)) return Number(raw).toExponential(2).replace(".", ",");
  const decimals = stripped.split(";")[0].match(/\.([0#]+)/)?.[1].length ?? (fmt === "General" ? Math.min(4, raw.split(".")[1]?.length ?? 0) : 0);
  const suffix = fmt.includes("€") ? " €" : fmt.includes("%") ? " %" : fmt.includes('" pp"') ? " pp" : "";
  return cWorkbookDecimal(raw, Math.min(decimals, 10), stripped.includes("%")) + suffix;
}
export function cWorkbookRows(table: CWorkbookTable, query: string, facets: Record<number, string>, sortColumn: number | null, direction: "asc" | "desc") {
  const tokens = query.trim().toLocaleLowerCase("it").split(/\s+/).filter(Boolean);
  let rows = table.rows.map((cells, i) => ({ cells, sourceRow: table.sourceRows[i] })).filter(({ cells }) =>
    tokens.every(t => cells.some(c => cWorkbookRaw(c).toLocaleLowerCase("it").includes(t))) &&
    Object.entries(facets).every(([c, v]) => !v || cWorkbookRaw(cells[Number(c)]) === v));
  if (sortColumn !== null && table.columns[sortColumn] !== undefined) rows = rows.sort((a, b) => {
    const x = cWorkbookNumber(a.cells[sortColumn]), y = cWorkbookNumber(b.cells[sortColumn]);
    if (x === null && y !== null) return 1; if (x !== null && y === null) return -1;
    const diff = x !== null && y !== null ? x - y : cWorkbookRaw(a.cells[sortColumn]).localeCompare(cWorkbookRaw(b.cells[sortColumn]), "it", { numeric: true });
    return (direction === "asc" ? diff : -diff) || a.sourceRow - b.sourceRow;
  });
  return rows;
}

function columnFormat(table: CWorkbookTable, column: number, formats: Record<string, string>) {
  const cell = table.rows.find(r => Array.isArray(r[column]))?.[column];
  return Array.isArray(cell) ? formats[cell[1]] ?? "General" : "General";
}
function columnUnit(table: CWorkbookTable, column: number, formats: Record<string, string>) {
  const fmt = columnFormat(table, column, formats), unquoted = fmt.replace(/"[^"]*"/g, "");
  return fmt.includes("€") ? "eur" : unquoted.includes("%") ? "percent-ratio" : fmt.includes("%") ? "percent-literal" : fmt.includes('" pp"') ? "pp" : "number";
}
/** Only overlay columns with the same raw scale/unit; never rescale one silently. */
export function cWorkbookComparableColumns(table: CWorkbookTable, column: number, formats: Record<string, string>) {
  return table.numericColumns.filter(c => c !== column && columnUnit(table, c, formats) === columnUnit(table, column, formats));
}
export function cWorkbookLabelColumn(table: CWorkbookTable): number {
  const preferred = table.columns.findIndex((h, c) => !table.numericColumns.includes(c) && /^(?:descrizione|categoria|portafoglio|classe|disciplina|dipartimento|causa|unità|mese|anno|serie|area|azienda|ambito|atc2)(?:\s|$|\/)/i.test(h) && !/crit\.|quota|spesa|numero|costo|codice|€|righe/i.test(h));
  return preferred >= 0 ? preferred : Math.max(0, table.columns.findIndex((_, c) => !table.numericColumns.includes(c)));
}
export function cWorkbookAxisLabel(value: number, table: CWorkbookTable, column: number, formats: Record<string, string>) {
  const cell = table.rows.find(r => Array.isArray(r[column]))?.[column];
  if (Array.isArray(cell) && /percent|pp/.test(columnUnit(table, column, formats))) return cWorkbookLabel([String(value), cell[1]], formats);
  return new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
export function cWorkbookPlotRows(table: CWorkbookTable, rows: ReturnType<typeof cWorkbookRows>, formats: Record<string, string>,
  metric: number, label: number, xMetric: number, view: "bar" | "line" | "scatter", comparison = -1) {
  if (!table.numericColumns.includes(metric)) return [];
  return rows.flatMap(({ cells, sourceRow }) => {
    const value = cWorkbookNumber(cells[metric]), x = xMetric < 0 ? null : cWorkbookNumber(cells[xMetric]), other = comparison < 0 ? null : cWorkbookNumber(cells[comparison]);
    if ((view !== "line" && value === null && other === null) || (view === "scatter" && (x === null || value === null))) return [];
    return [{ name: cWorkbookLabel(cells[label], formats, table.columns[label]) || `Riga ${sourceRow}`, value, other, x,
      exact: cWorkbookLabel(cells[metric], formats, table.columns[metric]),
      otherExact: comparison < 0 ? "" : cWorkbookLabel(cells[comparison], formats, table.columns[comparison]),
      xExact: xMetric < 0 ? "" : cWorkbookLabel(cells[xMetric], formats, table.columns[xMetric]), sourceRow }];
  });
}
