/** Frozen real-unit estimates for the admitted continuing subset of a portfolio. */
import { cAttrAtoms, cAttrDecimal } from "./attribution.ts";
import type { CPortfolioView } from "./portfolio.ts";
import { C_WORKBOOK_HASH, parseCWorkbookSection, type CWorkbookCell, type CWorkbookIndex, type CWorkbookOutput, type CWorkbookSection } from "./workbook.ts";

const SOURCE = "ff084e85af09c38df52445019af479397ea8313df79c736c4098c60f7edb8eac";
const CLASSIFICATION = "e2b3c5900036eec54fc01134d32d0f19bd9341db790916ced99b5152f9ad50aa";
const SHEET = "12A_ML4_Price_Vol_Mix", RANGE = "A209:L234";
const COLUMNS = ["Portafoglio", "Nome", "Esito", "Copertura t0", "Copertura t1", "Δ ammesso (€)",
  "Quantità · Shapley (€)", "Mix · Shapley (€)", "Mix · LMDI (€)", "Costo unitario · Shapley (€)", "Livello", "Stato di verifica"];
// Consistency guard for the four cached monetary doubles. This is stricter than
// the original PC-08 T1 floor (EUR 0.001), and never quantizes any source value.
export const C_PORTFOLIO_PVM_SUM_TOLERANCE = "0.000001";
const HALF = cAttrAtoms("0.5"), HEADLINE = cAttrAtoms("0.8"), ONE = cAttrAtoms("1");

type Subset = {
  workbookSha256: typeof C_WORKBOOK_HASH;
  outputId: "ML-4-PORT-REAL"; sheet: typeof SHEET; range: typeof RANGE; sourceRow: number;
  scope: { org: "Regione"; channel: "Tutti"; comparison: "K1"; from: "FY2024"; to: "FY2025"; portfolioId: string };
  coverage: { earlier: string; later: string; denominator: "absolute-continuing-spend" };
  grain: "AIC × Azienda × canale";
  unitBasis: "estimated-ledger-aifa-convention"; mappingStatus: "draft";
  level: string; verification: "V2_IN_ATTESA";
};
export type CPortfolioPvm =
  | { status: "unsupported"; reason: "scope" }
  | { status: "unavailable"; reason: "source" | "shape" | "missing" | "consistency" }
  | (Subset & { status: "insufficient"; admittedChange: null; effects: null })
  | (Subset & { status: "ready"; support: "partial" | "sufficient-subset"; admittedChange: string;
      effects: { quantity: string; mix: string; unitCost: string };
      rounding: { rawResidual: string; displayResidual: string } });

function numeric(cell: CWorkbookCell): { raw: string; atoms: bigint } | null {
  if (!Array.isArray(cell) || cell.length !== 2 || typeof cell[0] !== "string" || !Number.isFinite(Number(cell[0]))) return null;
  return { raw: cell[0], atoms: cAttrAtoms(cell[0]) };
}
function suppressed(cell: CWorkbookCell) { return cell === null || cell === "—" || cell === "n.a."; }
function roundedCent(value: bigint) {
  const sign = value < BigInt(0) ? -BigInt(1) : BigInt(1), magnitude = value * sign, cent = cAttrAtoms("0.01");
  return ((magnitude + cent / BigInt(2)) / cent) * cent * sign;
}

/** A view adapter only: never decomposes the dossier's product bridge or imputes units. The workbook output covers the
 * aggregate of the four Aziende: the reviewer names it «Regione», a scoped Regione view «aggregato» (`aggregateKey`). */
export function cPortfolioPvm(section: CWorkbookSection, view: CPortfolioView, aggregateKey = "Regione"): CPortfolioPvm {
  if (view.scope.org !== aggregateKey || view.scope.channel !== "Tutti" || !["FY2024", "FY2025"].includes(view.scope.period)) return { status: "unsupported", reason: "scope" };
  try {
    if (section.schema !== "pillar-c-workbook-section-v1" || section.workbookSha256 !== C_WORKBOOK_HASH || section.section !== "costi"
      || view.sourceSha256 !== SOURCE || view.classificationSha256 !== CLASSIFICATION || view.mappingVersion !== "v0.1-2026-10-12"
      || view.mappingStatus !== "draft" || view.attributionBasis !== "atc-portfolio-proxy"
      || view.changeSemantic !== "later-minus-earlier" || view.changePeriods.from !== "FY2024" || view.changePeriods.to !== "FY2025") return { status: "unavailable", reason: "source" };
    const outputs = section.outputs.filter(o => o.id === "ML-4-PORT-REAL");
    if (outputs.length !== 1) return { status: "unavailable", reason: "missing" };
    const output = outputs[0];
    if (output.section !== "costi" || output.availability !== "snapshot" || output.tier !== "Solo descrittivo"
      || output.ranges.length !== 1 || output.ranges[0] !== `${SHEET}!${RANGE}` || output.tables.length !== 1) return { status: "unavailable", reason: "shape" };
    const table = output.tables[0];
    if (table.sheet !== SHEET || table.range !== RANGE || table.headerRow !== 209 || table.startColumn !== 1
      || table.columns.length !== COLUMNS.length || table.columns.some((c, i) => c !== COLUMNS[i]) || table.sourceRows.length !== table.rows.length
      || table.rows.some((r, i) => r.length !== COLUMNS.length || !Number.isInteger(table.sourceRows[i]) || table.sourceRows[i] < 210 || table.sourceRows[i] > 234)) return { status: "unavailable", reason: "shape" };
    const matches = table.rows.flatMap((row, i) => row[0] === view.dossier.id ? [{ row, sourceRow: table.sourceRows[i] }] : []);
    if (matches.length !== 1) return { status: "unavailable", reason: "missing" };
    const { row, sourceRow } = matches[0];
    if (row[1] !== view.dossier.label || typeof row[2] !== "string" || typeof row[10] !== "string" || row[11] !== "V2_IN_ATTESA") return { status: "unavailable", reason: "shape" };
    const earlier = numeric(row[3]), later = numeric(row[4]);
    if (!earlier || !later || [earlier, later].some(c => c.atoms < BigInt(0) || c.atoms > ONE)) return { status: "unavailable", reason: "shape" };
    const subset: Subset = { workbookSha256: C_WORKBOOK_HASH, outputId: "ML-4-PORT-REAL", sheet: SHEET, range: RANGE, sourceRow,
      scope: { org: "Regione", channel: "Tutti", comparison: "K1", from: "FY2024", to: "FY2025", portfolioId: view.dossier.id },
      coverage: { earlier: earlier.raw, later: later.raw, denominator: "absolute-continuing-spend" }, grain: "AIC × Azienda × canale",
      unitBasis: "estimated-ledger-aifa-convention", mappingStatus: "draft", level: row[10], verification: row[11] };
    const minimum = earlier.atoms < later.atoms ? earlier.atoms : later.atoms;
    if (minimum < HALF) {
      if (row[2] !== "non ammesso (supporto < 50 %, PC-08 §11.1)" || row[10] !== "Solo descrittivo" || ![6, 7, 8, 9].every(i => suppressed(row[i]))) return { status: "unavailable", reason: "consistency" };
      return { ...subset, status: "insufficient", admittedChange: null, effects: null };
    }
    const partial = minimum < HEADLINE;
    if (row[2] !== (partial ? "parziale (50–80 %)" : "ammesso (≥ 80 %)")
      || row[10] !== (partial ? "Solo descrittivo" : "Ledger privato — V2 in attesa")) return { status: "unavailable", reason: "consistency" };
    const delta = numeric(row[5]), quantity = numeric(row[6]), mix = numeric(row[7]), mixLmdi = numeric(row[8]), unitCost = numeric(row[9]);
    if (!delta || !quantity || !mix || !mixLmdi || !unitCost) return { status: "unavailable", reason: "shape" };
    const rawResidual = quantity.atoms + mix.atoms + unitCost.atoms - delta.atoms;
    if ((rawResidual < BigInt(0) ? -rawResidual : rawResidual) > cAttrAtoms(C_PORTFOLIO_PVM_SUM_TOLERANCE)) return { status: "unavailable", reason: "consistency" };
    return { ...subset, status: "ready", support: partial ? "partial" : "sufficient-subset", admittedChange: delta.raw,
      effects: { quantity: quantity.raw, mix: mix.raw, unitCost: unitCost.raw },
      rounding: { rawResidual: cAttrDecimal(rawResidual), displayResidual: cAttrDecimal(roundedCent(quantity.atoms) + roundedCent(mix.atoms) + roundedCent(unitCost.atoms) - roundedCent(delta.atoms)) } };
  } catch { return { status: "unavailable", reason: "shape" }; }
}

/** The Regione's price/quantity/mix source (regional analytical parity, 23 Oct 2026): the reviewer's ML-4-PORT-REAL
 * output, verbatim, with the cell formats it uses, read from the regional folder under the Regione's own session. It is checked by the same section
 * parser the reviewer's fetch uses and returned as a one-output «costi» section, so cPortfolioPvm reads it unchanged. */
export function parseCRegionalPvm(value: unknown, costiSha256: string): CWorkbookSection {
  const fail = () => { throw new Error("PILLAR_C_REGIONAL_PVM"); };
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const p = value as Record<string, unknown>;
  if (Object.keys(p).length !== 5 || p.schema !== "pillar-c-regional-pvm-v1" || p.workbookSha256 !== C_WORKBOOK_HASH || p.costiSha256 !== costiSha256
    || !/^[a-f0-9]{64}$/.test(costiSha256) || !p.formats || typeof p.formats !== "object" || !p.output || typeof p.output !== "object" || Array.isArray(p.output)) fail();
  const meta = Object.fromEntries(Object.entries(p.output as Record<string, unknown>).filter(([k]) => k !== "tables")) as unknown as CWorkbookOutput;
  if (meta.id !== "ML-4-PORT-REAL" || meta.section !== "costi") fail();
  const index: CWorkbookIndex = { schema: "pillar-c-workbook-index-v1", workbookSha256: C_WORKBOOK_HASH, outputs: [meta], sections: { costi: { sha256: costiSha256, bytes: 2, outputs: 1 } } };
  // The cell formats of the section, limited to those the output's cells use (the parser requires each to be present).
  return parseCWorkbookSection({ schema: "pillar-c-workbook-section-v1", workbookSha256: C_WORKBOOK_HASH, section: "costi", formats: p.formats, outputs: [p.output] }, "costi", index);
}
