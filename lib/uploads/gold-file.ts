// Parser for the DIR_OSP_TRA_003AS SellInSellOut extraction ("the gold file").
//
// Verified against the real 2025 extraction: one sheet `DIR_OSP_TRA_003AS`,
// 34 columns, TWO header rows, 13,116 data rows, ASL codes 130201-130204 plus
// ND (50 rows) and 130106 (1 row).
//
// THE TRAP THIS PARSER EXISTS TO AVOID.
//
// The two header rows disagree about what columns 19 and 21 contain. Row 1, the
// group header, reads:
//
//   DISTRIBUZIONE DIRETTA+ DISTRIBUZIONE PER CONTO+CONSUMI OSPEDALIERI
//
// Row 2 labels the same columns:
//
//   col 19  Quantita (Distribuzione Diretta+Consumi Ospedalieri)(a)
//   col 21  Costo SellOut (Distribuzione Diretta+ Consumi Ospedalieri)(c)
//
// Both row-2 labels omit Distribuzione per Conto. The group header is the
// correct one: tested on the real file, DD + DPC + CO matches the quantity
// total in 2,076/2,076 rows with non-zero DPC and the cost total in 2,047/2,047,
// while DD + CO matches in none. A parser that trusts the row-2 labels and
// recomputes from the component columns drops EUR 80,065,583 of DPC silently.
//
// So this parser reads the AGGREGATE columns 19 and 21 directly, and asserts
// that row 1 still names all three flows. If a future extraction really is
// DD + CO only, that assertion fires and the load aborts, rather than the
// figures quietly changing basis underneath the same column numbers.
//
// The other near-miss worth recording: months come from column 10
// ("Mesi disponibili"), not column 9 ("Periodo Osservato"). Column 9 lists the
// periods the extraction covers and reads 12 on every row; column 10 is the
// row's own coverage and yields 4,245 twelve-month rows out of 13,116, which is
// the documented figure. Using column 9 would report every row as complete.
import ExcelJS from "exceljs";
import type { UploadRow } from "@/lib/uploads/reconcile";

/** 1-indexed, matching the sheet. Named so a future shape change is greppable. */
const COL = {
  year: 1,
  regionCode: 2,
  aslCode: 4,
  aslName: 5,
  productName: 7,
  aic: 8,
  monthsAvailable: 10,
  manufacturer: 12,
  quantity: 19, // (a), DD + DPC + CO despite the row-2 label
  unitPrice: 20, // (b = c/a); #DIV/0 when a = 0
  cost: 21, // (c), same basis as (a)
} as const;

const EXPECTED_COLUMNS = 34;
const HEADER_ROWS = 2;

export type GoldFileMeta = {
  sheetName: string;
  totalRows: number;
  /** Distinct years seen. More than one is legal but worth surfacing. */
  years: number[];
  regionCodes: string[];
  /** Kept for provenance: the exact group header the basis assertion passed on. */
  basisHeader: string;
};

export type GoldFileParse = { rows: UploadRow[]; meta: GoldFileMeta };

const text = (v: ExcelJS.CellValue): string =>
  v === null || v === undefined ? "" : String(typeof v === "object" && "result" in v ? v.result ?? "" : v).trim();

/**
 * Numbers only. A blank cell is absent, never zero — `null` and `0` are
 * different facts and the reconciler treats them differently.
 *
 * An Excel error cell (#DIV/0! on the price column when quantity is zero) reads
 * as absent. A string where a number belongs aborts: silently coercing "1.234"
 * under an unknown decimal convention is exactly the class of error this file
 * punishes.
 */
function readNumber(cell: ExcelJS.Cell, column: number, sourceRow: number): number | null {
  const v = cell.value;
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "object") {
    if ("error" in v) return null; // #DIV/0! and friends: undefined, not zero
    if ("result" in v) {
      const r = (v as { result?: unknown }).result;
      if (r === null || r === undefined || r === "") return null;
      if (typeof r === "number") return r;
      if (typeof r === "object" && r !== null && "error" in (r as object)) return null;
    }
  }
  throw new Error(
    `Row ${sourceRow}, column ${column}: expected a number or an empty cell, found ${typeof v} ${JSON.stringify(v)?.slice(0, 60)}`,
  );
}

/** Throws with a message that names the column and what was actually there. */
function assertShape(ws: ExcelJS.Worksheet): string {
  if (ws.columnCount < EXPECTED_COLUMNS) {
    throw new Error(`Expected at least ${EXPECTED_COLUMNS} columns, found ${ws.columnCount}`);
  }
  if (ws.rowCount <= HEADER_ROWS) {
    throw new Error(`Expected data rows after ${HEADER_ROWS} header rows, found ${ws.rowCount} rows in total`);
  }

  const group = text(ws.getRow(1).getCell(COL.quantity).value).toUpperCase();
  // The load-bearing assertion. All three flows must be named, or the basis of
  // columns 19/21 is not what this parser assumes and nothing should be loaded.
  for (const flow of ["DIRETTA", "PER CONTO", "OSPEDALIERI"]) {
    if (!group.includes(flow)) {
      throw new Error(
        `Column ${COL.quantity} group header does not name "${flow}": found "${group}". ` +
          `This parser reads columns ${COL.quantity} and ${COL.cost} as DD + DPC + CO. ` +
          `If the extraction changed basis, the figures must not be loaded under the old assumption.`,
      );
    }
  }
  for (const c of [COL.unitPrice, COL.cost]) {
    const g = text(ws.getRow(1).getCell(c).value).toUpperCase();
    if (g !== group) throw new Error(`Column ${c} is not under the same group header as column ${COL.quantity}`);
  }

  const r2 = ws.getRow(2);
  const expectLabel = (c: number, needle: string) => {
    const label = text(r2.getCell(c).value);
    if (!label.toLowerCase().includes(needle.toLowerCase())) {
      throw new Error(`Column ${c}: expected a header containing "${needle}", found "${label}"`);
    }
  };
  expectLabel(COL.quantity, "(a)");
  expectLabel(COL.cost, "(c)");
  expectLabel(COL.aic, "AIC");
  expectLabel(COL.aslCode, "Azienda Sanitaria");
  expectLabel(COL.monthsAvailable, "Mesi");

  return group;
}

/** Column 10 holds one period per line; the count is the row's coverage. */
function countMonths(cell: ExcelJS.Cell): number | null {
  const raw = text(cell.value);
  if (!raw) return null;
  return raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).length;
}

export async function parseGoldFile(input: Buffer | ArrayBuffer): Promise<GoldFileParse> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(input as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The workbook contains no worksheets");

  const basisHeader = assertShape(ws);

  const rows: UploadRow[] = [];
  const years = new Set<number>();
  const regionCodes = new Set<string>();

  for (let i = HEADER_ROWS + 1; i <= ws.rowCount; i++) {
    const r = ws.getRow(i);
    // A wholly blank trailing row is skipped; a partially blank one is data.
    const aslCode = text(r.getCell(COL.aslCode).value);
    const aic = text(r.getCell(COL.aic).value);
    const quantity = readNumber(r.getCell(COL.quantity), COL.quantity, i);
    const cost = readNumber(r.getCell(COL.cost), COL.cost, i);
    if (!aslCode && !aic && quantity === null && cost === null) continue;

    const year = readNumber(r.getCell(COL.year), COL.year, i);
    if (year !== null) years.add(year);
    const region = text(r.getCell(COL.regionCode).value);
    if (region) regionCodes.add(region);

    rows.push({
      sourceRow: i,
      aslCode: aslCode || null,
      // Passed through as read. normaliseAic() in the reconciler decides whether
      // it is a usable key; padding or trimming here would turn a wrong key into
      // a plausible one.
      aic: aic || null,
      manufacturer: text(r.getCell(COL.manufacturer).value) || null,
      quantity,
      cost,
      months: countMonths(r.getCell(COL.monthsAvailable)),
    });
  }

  return {
    rows,
    meta: {
      sheetName: ws.name,
      totalRows: rows.length,
      years: [...years].sort((a, b) => a - b),
      regionCodes: [...regionCodes].sort(),
      basisHeader,
    },
  };
}
