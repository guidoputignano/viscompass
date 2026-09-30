import ExcelJS from "exceljs";
import { createInflateRaw } from "node:zlib";

export const MAX_HOSPITAL_FILE_BYTES = 25 * 1024 * 1024;
export const HOSPITAL_FORMAT_VERSION = "DIR_OSP_TRA_003AS/v1" as const;
export const HOSPITAL_SHEET_NAME = "DIR_OSP_TRA_003AS" as const;

export const HOSPITAL_CHANNEL_COLUMNS = {
  DD: { quantity: 12, cost: 13 },
  DPC: { quantity: 14, cost: 15 },
  CO: { quantity: 16, cost: 17 },
  sourceTotal: { quantity: 18, price: 19, cost: 20 },
} as const;

const EXPECTED_COLUMN_COUNT = 34;
const MAX_HOSPITAL_DATA_ROWS = 200_000;
const MAX_XLSX_ARCHIVE_ENTRIES = 2_048;
const MAX_XLSX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
const MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES = 192 * 1024 * 1024;
const MAX_XLSX_COMPRESSION_RATIO = 500;
const MAX_ISSUE_EXAMPLES = 5;
const MAX_EXAMPLE_VALUE_LENGTH = 160;
const EXTREME_PRICE_EUR = 1_000_000;

export const HOSPITAL_MONTH_TOKENS = [
  "01-Gennaio",
  "02-Febbraio",
  "03-Marzo",
  "04-Aprile",
  "05-Maggio",
  "06-Giugno",
  "07-Luglio",
  "08-Agosto",
  "09-Settembre",
  "10-Ottobre",
  "11-Novembre",
  "12-Dicembre",
] as const;

export const HOSPITAL_HEADER_ROWS: readonly (readonly (string | null)[])[] = [
  [
    "Anno",
    null,
    null,
    "Cod. ASL",
    "Des. ASL",
    null,
    "Des. farmaco",
    "Cod. AIC",
    "Cod. mese",
    null,
    "Cod. ditta",
    "Ragione sociale ditta",
    "DISTRIBUZIONE DIRETTA",
    "DISTRIBUZIONE DIRETTA",
    "DISTRIBUZIONE PER CONTO",
    "DISTRIBUZIONE PER CONTO",
    "CONSUMI OSPEDALIERI",
    "CONSUMI OSPEDALIERI",
    "DISTRIBUZIONE DIRETTA+ DISTRIBUZIONE PER CONTO+CONSUMI OSPEDALIERI",
    "DISTRIBUZIONE DIRETTA+ DISTRIBUZIONE PER CONTO+CONSUMI OSPEDALIERI",
    "DISTRIBUZIONE DIRETTA+ DISTRIBUZIONE PER CONTO+CONSUMI OSPEDALIERI",
    "TRACCIABILITA",
    "TRACCIABILITA",
    "TRACCIABILITA",
    "TRACCIABILITA",
    "TRACCIABILITA",
    "Dati presenti  su flussi regionali",
    "Dati presenti su Traccia",
    "Scostamenti tra flussi regionali e Traccia",
    "Scostamenti tra flussi regionali e Traccia",
    "Scostamenti tra flussi regionali e Traccia",
    "Scostamenti tra flussi regionali e Traccia",
    "Scostamenti tra flussi regionali e Traccia",
    "Scostamenti tra flussi regionali e Traccia",
  ],
  [
    "Anno",
    "Codice Regione",
    "Regione",
    "Codice Azienda Sanitaria",
    "Azienda Sanitaria",
    "Codice Farmaco",
    "Denominazione Farmaco",
    "Codice AIC confezione",
    "Periodo Osservato",
    "Mesi disponibili",
    "Codice SIS Azienda Farmaceutica",
    "Azienda Farmaceutica",
    "Quantità Distribuzione Diretta",
    "Costo di Acquisto Distribuzione Diretta",
    "Quantità Distribuzione per Conto",
    "Costo di Acquisto Distribuzione per Conto",
    "Quantità Consumi Ospedalieri",
    "Costo di Acquisto Consumi Ospedalieri",
    "Quantità (Distribuzione Diretta+Consumi Ospedalieri)(a)",
    "Prezzo (b=c/a)",
    "Costo SellOut (Distribuzione Diretta+ Consumi Ospedalieri)(c)",
    "Quantità (Traccia) (d)",
    "Prezzo medio aziendale (e)",
    "Prezzo medio regionale (f)",
    "Costo aziendale rilevato (g)",
    "Costo aziendale stimato (h)",
    "Dati presenti  su flussi regionali",
    "Dati presenti su Traccia",
    "Quantità\nconfronto traccia vs DD+DPC+CO (i=d-a)\n",
    "Scostamento percentuale delle quantità (l=i/a)",
    "Prezzo\nconfronto Traccia vs DD+DPC+CO (m=(e se disponibile oppure f)-b)\n",
    "Scostamento percentuale confronto prezzo (n=m/b)",
    "Costo\nconfronto Traccia vs DD+DPC+CO (o= (g se disponibile oppure h) - c)",
    "Scostamento percentuale confronto costo (p=o/c)",
  ],
] as const;

export type HospitalValidationStatus =
  | "accepted"
  | "accepted_with_warnings"
  | "rejected";

export type HospitalIssueSeverity = "error" | "warning";

export interface HospitalValidationScope {
  orgType: "asl" | "regione";
  orgCode: string;
  regionCode?: string | null;
}

export interface HospitalValidationIssueExample {
  row?: number;
  column?: string;
  value?: string;
}

export interface HospitalValidationIssue {
  severity: HospitalIssueSeverity;
  code: string;
  message: string;
  count: number;
  examples: HospitalValidationIssueExample[];
}

export interface HospitalValidationSummary {
  rowCount: number;
  years: number[];
  regionCodes: string[];
  aslCodes: string[];
  fullMonthRows: number;
  coverageStart: string | null;
  coverageEnd: string | null;
}

export interface HospitalValidationReport {
  status: HospitalValidationStatus;
  formatVersion: typeof HOSPITAL_FORMAT_VERSION;
  sheetName: string | null;
  summary: HospitalValidationSummary;
  issues: HospitalValidationIssue[];
}

export interface HospitalFormulaCell {
  sheetName?: string;
  row: number;
  column: number;
  formula?: string;
}

/**
 * Workbook-level facts supplied by the XLSX parser. For pure tests, omitted
 * fields default to the one-sheet gold-v1 contract and the row matrix itself.
 */
export interface HospitalRowsMetadata {
  sheetName?: string | null;
  visibleSheetNames?: readonly string[];
  columnCount?: number;
  formulaCells?: readonly HospitalFormulaCell[];
  sourceRowCount?: number;
  sourceRowExtent?: number;
}

type IssueAccumulator = {
  severity: HospitalIssueSeverity;
  code: string;
  message: string;
  count: number;
  examples: HospitalValidationIssueExample[];
};

const MONTH_TOKEN_SET = new Set<string>(HOSPITAL_MONTH_TOKENS);

// Bounds on ONE month cell. Twelve tokens of seven characters is the legitimate
// maximum; these leave two orders of magnitude of slack and still refuse the
// pathological input outright instead of trying to process it.
const MAX_MONTH_CELL_CHARS = 4_096;
const MAX_MONTH_TOKENS = 256;
const IDENTIFIER_COLUMNS = new Set([1, 3, 5, 7, 10]);
const SOURCE_MEASURE_COLUMNS = [12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25] as const;
const PRICE_COLUMNS = [19, 22, 23] as const;
const NUMERIC_COLUMNS = [
  12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
  28, 29, 30, 31, 32, 33,
] as const;
const REQUIRED_NUMERIC_COLUMNS = new Set<number>([18, 20, 28]);
const DERIVED_ERROR_COLUMNS = new Set<number>([19, 29, 30, 31, 32, 33]);

const CORE_IDENTIFIERS = [
  [0, "year"],
  [1, "region code"],
  [3, "ASL code"],
  [5, "drug code"],
  [7, "AIC code"],
  [8, "observed period"],
  [10, "pharmaceutical company code"],
] as const;

function emptySummary(): HospitalValidationSummary {
  return {
    rowCount: 0,
    years: [],
    regionCodes: [],
    aslCodes: [],
    fullMonthRows: 0,
    coverageStart: null,
    coverageEnd: null,
  };
}

function rejectedReport(
  code: string,
  message: string,
  value?: string,
): HospitalValidationReport {
  return {
    status: "rejected",
    formatVersion: HOSPITAL_FORMAT_VERSION,
    sheetName: null,
    summary: emptySummary(),
    issues: [
      {
        severity: "error",
        code,
        message,
        count: 1,
        examples: value ? [{ value: clipExampleValue(value) }] : [],
      },
    ],
  };
}

function clipExampleValue(value: unknown): string {
  let text: string;
  if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === "string") {
    text = value;
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  if (text === undefined) text = String(value);
  text = text.replace(/\r\n?/g, "\n");
  return text.length > MAX_EXAMPLE_VALUE_LENGTH
    ? `${text.slice(0, MAX_EXAMPLE_VALUE_LENGTH - 1)}…`
    : text;
}

function columnLetter(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function formulaFrom(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || value instanceof Date) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.formula === "string") return record.formula;
  if (typeof record.sharedFormula === "string") return record.sharedFormula;
  return undefined;
}

function primitiveValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const record = value as Record<string, unknown>;
  if ("result" in record && ("formula" in record || "sharedFormula" in record)) {
    return primitiveValue(record.result);
  }
  if (typeof record.error === "string") return record.error;
  if (Array.isArray(record.richText)) {
    return record.richText
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : "",
      )
      .join("");
  }
  if (typeof record.text === "string") return record.text;
  return value;
}

function isBlank(value: unknown): boolean {
  const primitive = primitiveValue(value);
  return (
    primitive === null ||
    primitive === undefined ||
    (typeof primitive === "string" && primitive.trim() === "")
  );
}

function normalizedHeaderValue(value: unknown): string | null | unknown {
  const primitive = primitiveValue(value);
  if (primitive === null || primitive === undefined || primitive === "") return null;
  return typeof primitive === "string" ? primitive.replace(/\r\n?/g, "\n") : primitive;
}

function identifier(value: unknown): string | null {
  const primitive = primitiveValue(value);
  if (primitive === null || primitive === undefined) return null;
  if (typeof primitive === "string") {
    const result = primitive.trim();
    return result || null;
  }
  if (typeof primitive === "number" && Number.isFinite(primitive)) return String(primitive);
  if (typeof primitive === "bigint") return primitive.toString();
  return null;
}

function numeric(value: unknown): number | null {
  const primitive = primitiveValue(value);
  return typeof primitive === "number" && Number.isFinite(primitive) ? primitive : null;
}

function blankOrNumeric(value: unknown): boolean {
  return isBlank(value) || numeric(value) !== null;
}

function nearlyEqual(actual: number, expected: number): boolean {
  const tolerance = 1e-7 + 1e-9 * Math.max(Math.abs(actual), Math.abs(expected));
  return Math.abs(actual - expected) <= tolerance;
}

function equalWithinOneCent(actual: number, expected: number): boolean {
  // The confirmed upload rule is an absolute EUR 0.01 threshold.
  return Math.abs(actual - expected) <= 0.01 + 1e-9;
}

function aicIdentifier(value: unknown): string | null {
  const raw = identifier(value);
  if (raw && /^\d{1,9}$/.test(raw)) return raw.padStart(9, "0");
  return raw;
}

function isDivisionByZero(value: unknown): boolean {
  const primitive = primitiveValue(value);
  return typeof primitive === "string" && /^#DIV\/0!?$/i.test(primitive.trim());
}

function isOtherSpreadsheetError(value: unknown): boolean {
  const primitive = primitiveValue(value);
  return (
    typeof primitive === "string" &&
    /^#(?:NULL!|VALUE!|REF!|NAME\?|NUM!|N\/A|GETTING_DATA)$/i.test(primitive.trim())
  );
}

function parseMonthTokens(value: unknown): {
  tokens: string[];
  invalid: string[];
  duplicate: string[];
} {
  if (isBlank(value)) return { tokens: [], invalid: [], duplicate: [] };
  const primitive = primitiveValue(value);
  if (typeof primitive !== "string") {
    return { tokens: [], invalid: [clipExampleValue(primitive)], duplicate: [] };
  }
  // A legitimate cell holds at most the twelve month tokens. Anything wildly
  // beyond that is malformed or hostile, and is rejected on sight rather than
  // parsed — bounding the work before it starts is cheaper than surviving it.
  if (primitive.length > MAX_MONTH_CELL_CHARS) {
    return {
      tokens: [],
      invalid: [`cella troppo lunga (${primitive.length} caratteri)`],
      duplicate: [],
    };
  }
  const tokens = primitive
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length > MAX_MONTH_TOKENS) {
    return {
      tokens: [],
      invalid: [`troppi valori nella cella (${tokens.length})`],
      duplicate: [],
    };
  }
  const invalid = tokens.filter((token) => !MONTH_TOKEN_SET.has(token));
  const seen = new Set<string>();
  // Set membership, not `duplicate.includes(token)`. That was a linear scan of a
  // list that grows with every distinct duplicate, so the loop was quadratic in
  // the number of tokens in ONE cell. A cell holding many thousands of distinct
  // newline-separated values — which an uploaded file controls entirely — blocked
  // the Node event loop for minutes, taking the whole server with it, before any
  // validation had a chance to reject the file.
  const duplicateSet = new Set<string>();
  const duplicate: string[] = [];
  for (const token of tokens) {
    if (seen.has(token) && !duplicateSet.has(token)) {
      duplicateSet.add(token);
      duplicate.push(token);
    }
    seen.add(token);
  }
  return { tokens, invalid, duplicate };
}

function isCompleteMonthSet(tokens: readonly string[]): boolean {
  return (
    tokens.length === HOSPITAL_MONTH_TOKENS.length &&
    HOSPITAL_MONTH_TOKENS.every((token) => tokens.includes(token))
  );
}

function earlierIsoDate(current: string | null, candidate: string): string {
  return current === null || candidate < current ? candidate : current;
}

function laterIsoDate(current: string | null, candidate: string): string {
  return current === null || candidate > current ? candidate : current;
}

function inferredColumnCount(rows: readonly (readonly unknown[])[]): number {
  let maximum = 0;
  for (const row of rows) {
    for (let column = row.length - 1; column >= 0; column -= 1) {
      if (!isBlank(row[column])) {
        maximum = Math.max(maximum, column + 1);
        break;
      }
    }
  }
  return maximum;
}

function normalizedCode(value: string | null | undefined): string | null {
  const result = value?.trim();
  return result || null;
}

/**
 * Validates a matrix containing the two header rows followed by data rows.
 * It does not mutate or normalize the caller's rows.
 */
export function validateHospitalRows(
  rows: readonly (readonly unknown[])[],
  metadata: HospitalRowsMetadata = {},
  scope?: HospitalValidationScope,
): HospitalValidationReport {
  const accumulators = new Map<string, IssueAccumulator>();
  const addIssue = (
    severity: HospitalIssueSeverity,
    code: string,
    message: string,
    example?: HospitalValidationIssueExample,
  ) => {
    const key = `${severity}:${code}`;
    let issue = accumulators.get(key);
    if (!issue) {
      issue = { severity, code, message, count: 0, examples: [] };
      accumulators.set(key, issue);
    }
    issue.count += 1;
    if (example && issue.examples.length < MAX_ISSUE_EXAMPLES) {
      issue.examples.push({
        ...example,
        value: example.value === undefined ? undefined : clipExampleValue(example.value),
      });
    }
  };

  const sheetName = metadata.sheetName ?? HOSPITAL_SHEET_NAME;
  const visibleSheetNames = metadata.visibleSheetNames ?? [sheetName];
  if (
    visibleSheetNames.length !== 1 ||
    visibleSheetNames[0] !== HOSPITAL_SHEET_NAME
  ) {
    addIssue(
      "error",
      "visible_sheet_contract",
      `Serve un solo foglio visibile chiamato ${HOSPITAL_SHEET_NAME}.`,
      { value: visibleSheetNames.join(", ") || "none" },
    );
  }
  if (sheetName !== HOSPITAL_SHEET_NAME) {
    addIssue(
      "error",
      "sheet_name_mismatch",
      `Il foglio dati deve chiamarsi ${HOSPITAL_SHEET_NAME}.`,
      { value: sheetName ?? "none" },
    );
  }

  const observedColumnCount = Math.max(
    metadata.columnCount ?? 0,
    inferredColumnCount(rows),
  );
  if (observedColumnCount !== EXPECTED_COLUMN_COUNT) {
    addIssue(
      "error",
      "column_count_mismatch",
      `Il foglio ${HOSPITAL_FORMAT_VERSION} deve contenere esattamente ${EXPECTED_COLUMN_COUNT} colonne.`,
      { value: String(observedColumnCount) },
    );
  }

  for (let headerRow = 0; headerRow < HOSPITAL_HEADER_ROWS.length; headerRow += 1) {
    const actual = rows[headerRow] ?? [];
    const expected = HOSPITAL_HEADER_ROWS[headerRow];
    for (let column = 0; column < EXPECTED_COLUMN_COUNT; column += 1) {
      const actualValue = normalizedHeaderValue(actual[column]);
      const expectedValue = expected[column];
      if (actualValue !== expectedValue) {
        addIssue(
          "error",
          "header_mismatch",
          "Le due righe di intestazione gold-v1 non corrispondono al tracciato verificato.",
          {
            row: headerRow + 1,
            column: columnLetter(column),
            value: `${clipExampleValue(actualValue)} (expected ${clipExampleValue(expectedValue)})`,
          },
        );
      }
    }
  }

  const formulaLocations = new Set<string>();
  const recordFormula = (formulaCell: HospitalFormulaCell) => {
    const formulaSheet = formulaCell.sheetName ?? sheetName ?? "";
    const key = `${formulaSheet}:${formulaCell.row}:${formulaCell.column}`;
    if (formulaLocations.has(key)) return;
    formulaLocations.add(key);
    addIssue(
      "error",
      "formula_not_allowed",
      "Il file sorgente non può contenere celle con formule.",
      {
        row: formulaCell.row,
        column: columnLetter(Math.max(0, formulaCell.column - 1)),
        value: `${formulaSheet}:=${formulaCell.formula ?? "formula"}`,
      },
    );
  };
  for (const formulaCell of metadata.formulaCells ?? []) recordFormula(formulaCell);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let column = 0; column < rows[rowIndex].length; column += 1) {
      const formula = formulaFrom(rows[rowIndex][column]);
      if (formula !== undefined) {
        recordFormula({
          sheetName: sheetName ?? undefined,
          row: rowIndex + 1,
          column: column + 1,
          formula,
        });
      }
    }
  }

  const dataRowsWithIndex = rows
    .slice(HOSPITAL_HEADER_ROWS.length)
    .map((row, index) => ({ row, rowNumber: index + HOSPITAL_HEADER_ROWS.length + 1 }))
    .filter(({ row }) => !row.every(isBlank));
  const sourceRowCount = metadata.sourceRowCount ?? dataRowsWithIndex.length;
  const sourceRowExtent = metadata.sourceRowExtent ?? Math.max(
    0,
    rows.length - HOSPITAL_HEADER_ROWS.length,
  );
  if (
    sourceRowCount > MAX_HOSPITAL_DATA_ROWS ||
    sourceRowExtent > MAX_HOSPITAL_DATA_ROWS
  ) {
    addIssue(
      "error",
      "row_limit_exceeded",
      `Il file supera il limite di sicurezza di ${MAX_HOSPITAL_DATA_ROWS.toLocaleString("it-IT")} righe.`,
      { value: `${sourceRowCount} righe dati; estensione ${sourceRowExtent}` },
    );
  }
  if (sourceRowCount === 0) {
    addIssue("error", "data_rows_missing", "Il file non contiene righe di dati ospedalieri.");
  }

  const years = new Set<number>();
  const regionCodes = new Set<string>();
  const aslCodes = new Set<string>();
  const duplicateKeys = new Map<string, number>();
  let fullMonthRows = 0;
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;

  const scopeOrgCode = normalizedCode(scope?.orgCode);
  const scopeRegionCode = normalizedCode(scope?.regionCode);
  if (scope && !scopeOrgCode) {
    addIssue(
      "error",
      "scope_configuration_invalid",
      "Il perimetro autorizzato non contiene un codice organizzazione.",
    );
  }
  if (scope?.orgType === "regione" && !scopeRegionCode) {
    addIssue(
      "error",
      "scope_configuration_invalid",
      "Il perimetro regionale non contiene un codice regione.",
    );
  }

  for (const { row, rowNumber } of dataRowsWithIndex.slice(0, MAX_HOSPITAL_DATA_ROWS)) {
    for (const [column, label] of CORE_IDENTIFIERS) {
      if (identifier(row[column]) === null) {
        addIssue(
          "error",
          "missing_core_identifier",
          "Ogni riga deve contenere tutti gli identificativi sorgente obbligatori.",
          { row: rowNumber, column: columnLetter(column), value: label },
        );
      }
    }

    const yearIdentifier = identifier(row[0]);
    const year = yearIdentifier === null ? NaN : Number(yearIdentifier);
    if (yearIdentifier !== null) {
      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        addIssue(
          "error",
          "invalid_year",
          "L'anno deve essere espresso con quattro cifre.",
          { row: rowNumber, column: "A", value: yearIdentifier },
        );
      } else {
        years.add(year);
      }
    }

    const regionCode = identifier(row[1]);
    const aslCode = identifier(row[3]);
    const aicCode = aicIdentifier(row[7]);
    if (regionCode) regionCodes.add(regionCode);
    if (aslCode) aslCodes.add(aslCode);
    if (aicCode && !/^\d{9}$/.test(aicCode)) {
      addIssue(
        "error",
        "invalid_aic_code",
        "Il codice AIC deve avere nove cifre, inclusi gli zeri iniziali.",
        { row: rowNumber, column: "H", value: aicCode },
      );
    }

    if (scope && scopeOrgCode) {
      let mismatchColumn: string | null = null;
      let actualScopeValue: string | null = null;
      let expectedScopeValue: string | null = null;
      if (scope.orgType === "asl" && aslCode !== scopeOrgCode) {
        mismatchColumn = "D";
        actualScopeValue = aslCode;
        expectedScopeValue = scopeOrgCode;
      } else if (scopeRegionCode && regionCode !== scopeRegionCode) {
        mismatchColumn = "B";
        actualScopeValue = regionCode;
        expectedScopeValue = scopeRegionCode;
      }
      if (mismatchColumn) {
        addIssue(
          "error",
          "tenant_scope_mismatch",
          "La riga non appartiene al perimetro autorizzato.",
          {
            row: rowNumber,
            column: mismatchColumn,
            value: `${actualScopeValue ?? "blank"} (expected ${expectedScopeValue})`,
          },
        );
      }
    }

    if (aslCode?.toUpperCase() === "ND") {
      addIssue(
        "warning",
        "nd_asl",
        "Le righe assegnate alla ASL non specifica ND richiedono verifica.",
        { row: rowNumber, column: "D", value: aslCode },
      );
    }

    const observedMonths = parseMonthTokens(row[8]);
    const availableMonths = parseMonthTokens(row[9]);
    for (const [column, parsed] of [
      [8, observedMonths],
      [9, availableMonths],
    ] as const) {
      for (const invalidToken of parsed.invalid) {
        addIssue(
          "error",
          "invalid_month_token",
          "Le celle dei mesi contengono un valore non previsto dal tracciato.",
          { row: rowNumber, column: columnLetter(column), value: invalidToken },
        );
      }
      for (const duplicateToken of parsed.duplicate) {
        addIssue(
          "error",
          "duplicate_month_token",
          "Lo stesso mese compare più volte nella cella.",
          { row: rowNumber, column: columnLetter(column), value: duplicateToken },
        );
      }
    }
    const observedSet = new Set(observedMonths.tokens);
    for (const token of new Set(availableMonths.tokens)) {
      if (MONTH_TOKEN_SET.has(token) && !observedSet.has(token)) {
        addIssue(
          "error",
          "month_coverage_inconsistent",
          "I mesi disponibili devono rientrare nel periodo osservato.",
          { row: rowNumber, column: "J", value: token },
        );
      }
    }
    if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
      for (const token of new Set(availableMonths.tokens)) {
        const monthIndex = HOSPITAL_MONTH_TOKENS.indexOf(
          token as (typeof HOSPITAL_MONTH_TOKENS)[number],
        );
        if (monthIndex < 0) continue;
        const month = String(monthIndex + 1).padStart(2, "0");
        const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
        const start = `${year}-${month}-01`;
        const end = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
        coverageStart = earlierIsoDate(coverageStart, start);
        coverageEnd = laterIsoDate(coverageEnd, end);
      }
    }
    if (
      availableMonths.invalid.length === 0 &&
      availableMonths.duplicate.length === 0 &&
      isCompleteMonthSet(availableMonths.tokens)
    ) {
      fullMonthRows += 1;
    } else {
      addIssue(
        "warning",
        "partial_month_coverage",
        "La riga non contiene tutti i dodici mesi disponibili.",
        {
          row: rowNumber,
          column: "J",
          value: `${new Set(availableMonths.tokens.filter((token) => MONTH_TOKEN_SET.has(token))).size}/12`,
        },
      );
    }

    for (let column = 0; column < Math.min(row.length, EXPECTED_COLUMN_COUNT); column += 1) {
      if (isDivisionByZero(row[column])) {
        addIssue(
          "warning",
          "division_by_zero",
          "Il sorgente contiene #DIV/0 e il valore non è confrontabile numericamente.",
          { row: rowNumber, column: columnLetter(column), value: primitiveValue(row[column]) as string },
        );
      } else if (isOtherSpreadsheetError(row[column])) {
        addIssue(
          "warning",
          "spreadsheet_error",
          "Il sorgente contiene un errore di calcolo da verificare.",
          { row: rowNumber, column: columnLetter(column), value: primitiveValue(row[column]) as string },
        );
      }
    }

    for (const column of NUMERIC_COLUMNS) {
      const value = row[column];
      const parsed = numeric(value);
      if (REQUIRED_NUMERIC_COLUMNS.has(column) && parsed === null) {
        addIssue(
          "error",
          "required_numeric_value_missing",
          "Un totale o una differenza obbligatoria deve contenere un numero.",
          {
            row: rowNumber,
            column: columnLetter(column),
            value: isBlank(value) ? "blank" : clipExampleValue(primitiveValue(value)),
          },
        );
      } else if (
        parsed === null &&
        !isBlank(value) &&
        !(
          DERIVED_ERROR_COLUMNS.has(column) &&
          (isDivisionByZero(value) || isOtherSpreadsheetError(value))
        )
      ) {
        addIssue(
          "error",
          "invalid_numeric_value",
          "Una colonna quantitativa o economica contiene un valore non numerico.",
          {
            row: rowNumber,
            column: columnLetter(column),
            value: clipExampleValue(primitiveValue(value)),
          },
        );
      }
    }

    for (const column of SOURCE_MEASURE_COLUMNS) {
      const value = numeric(row[column]);
      if (value !== null && value < 0) {
        addIssue(
          "warning",
          "negative_source_measure",
          "Una quantità, un costo o una misura di tracciabilità è negativa.",
          { row: rowNumber, column: columnLetter(column), value: String(value) },
        );
      }
    }
    for (const column of PRICE_COLUMNS) {
      const value = numeric(row[column]);
      if (value !== null && Math.abs(value) > EXTREME_PRICE_EUR) {
        addIssue(
          "warning",
          "extreme_price",
          `Un prezzo unitario supera in valore assoluto EUR ${EXTREME_PRICE_EUR.toLocaleString("it-IT")}.`,
          { row: rowNumber, column: columnLetter(column), value: String(value) },
        );
      }
    }

    const additiveChecks = [
      { output: 18, inputs: [12, 14, 16], symbol: "a=M+O+Q", money: false },
      { output: 20, inputs: [13, 15, 17], symbol: "c=N+P+R", money: true },
    ] as const;
    for (const check of additiveChecks) {
      const actual = numeric(row[check.output]);
      if (actual !== null && check.inputs.every((column) => blankOrNumeric(row[column]))) {
        const expected = check.inputs.reduce(
          (sum, column) => sum + (numeric(row[column]) ?? 0),
          0,
        );
        const reconciles = check.money
          ? equalWithinOneCent(actual, expected)
          : nearlyEqual(actual, expected);
        if (!reconciles) {
          addIssue(
            "error",
            "additive_math_mismatch",
            "Un totale additivo sorgente non quadra.",
            {
              row: rowNumber,
              column: columnLetter(check.output),
              value: `${check.symbol}: ${actual} (expected ${expected})`,
            },
          );
        }
      }
    }
    const quantityDifference = numeric(row[28]);
    const sellOutQuantity = numeric(row[18]);
    if (
      quantityDifference !== null &&
      sellOutQuantity !== null &&
      blankOrNumeric(row[21])
    ) {
      const expected = (numeric(row[21]) ?? 0) - sellOutQuantity;
      if (!nearlyEqual(quantityDifference, expected)) {
        addIssue(
          "error",
          "additive_math_mismatch",
          "La differenza di quantità non quadra trattando d vuoto come zero.",
          {
            row: rowNumber,
            column: "AC",
            value: `i=V-S: ${quantityDifference} (expected ${expected})`,
          },
        );
      }
    }

    const derivedDifferences = [
      { output: 30, preferred: 22, fallback: 23, base: 19, symbol: "m=coalesce(W,X)-T" },
      { output: 32, preferred: 24, fallback: 25, base: 20, symbol: "o=coalesce(Y,Z)-U" },
    ] as const;
    for (const check of derivedDifferences) {
      const actual = numeric(row[check.output]);
      const selected = numeric(row[check.preferred]) ?? numeric(row[check.fallback]);
      const base = numeric(row[check.base]);
      if (actual !== null && selected !== null && base !== null) {
        const expected = selected - base;
        const reconciles = check.output === 32
          ? equalWithinOneCent(actual, expected)
          : nearlyEqual(actual, expected);
        if (!reconciles) {
          addIssue(
            "warning",
            "derived_math_mismatch",
            "Una differenza derivata confrontabile non quadra.",
            {
              row: rowNumber,
              column: columnLetter(check.output),
              value: `${check.symbol}: ${actual} (expected ${expected})`,
            },
          );
        }
      }
    }

    const ratioChecks = [
      { output: 29, numerator: 28, denominator: 18, symbol: "l=AC/S" },
      { output: 31, numerator: 30, denominator: 19, symbol: "n=AE/T" },
      { output: 33, numerator: 32, denominator: 20, symbol: "p=AG/U" },
    ] as const;
    for (const check of ratioChecks) {
      const actual = numeric(row[check.output]);
      const numerator = numeric(row[check.numerator]);
      const denominator = numeric(row[check.denominator]);
      if (
        actual !== null &&
        numerator !== null &&
        denominator !== null &&
        denominator !== 0
      ) {
        const expected = numerator / denominator;
        if (!nearlyEqual(actual, expected)) {
          addIssue(
            "warning",
            "derived_ratio_mismatch",
            "Un rapporto numerico confrontabile non quadra.",
            {
              row: rowNumber,
              column: columnLetter(check.output),
              value: `${check.symbol}: ${actual} (expected ${expected})`,
            },
          );
        }
      }
    }

    const duplicateParts = [
      identifier(row[0]),
      identifier(row[1]),
      identifier(row[3]),
      aicIdentifier(row[7]),
      identifier(row[10]),
    ];
    if (duplicateParts.every((part): part is string => part !== null)) {
      const key = duplicateParts.join("|");
      const firstRow = duplicateKeys.get(key);
      if (firstRow !== undefined) {
        addIssue(
          "warning",
          "duplicate_base_key",
          "Più righe condividono la chiave base anno, regione, ASL, AIC e ditta.",
          { row: rowNumber, value: `${key} (first row ${firstRow})` },
        );
      } else {
        duplicateKeys.set(key, rowNumber);
      }
    }
  }

  const issues: HospitalValidationIssue[] = Array.from(accumulators.values()).map(
    (issue) => ({ ...issue, examples: [...issue.examples] }),
  );
  const status: HospitalValidationStatus = issues.some((issue) => issue.severity === "error")
    ? "rejected"
    : issues.some((issue) => issue.severity === "warning")
      ? "accepted_with_warnings"
      : "accepted";

  return {
    status,
    formatVersion: HOSPITAL_FORMAT_VERSION,
    sheetName,
    summary: {
      rowCount: sourceRowCount,
      years: Array.from(years).sort((a, b) => a - b),
      regionCodes: Array.from(regionCodes).sort((a, b) => a.localeCompare(b, "en")),
      aslCodes: Array.from(aslCodes).sort((a, b) => a.localeCompare(b, "en")),
      fullMonthRows,
      coverageStart,
      coverageEnd,
    },
    issues,
  };
}

function toNodeBuffer(buffer: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(buffer)) return buffer;
  if (buffer instanceof ArrayBuffer) return Buffer.from(buffer);
  return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

interface ArchivePreflightFailure {
  code: "invalid_xlsx_container" | "unsafe_xlsx_archive";
  message: string;
  value?: string;
}

interface ArchiveEntryPreflight {
  fileName: string;
  compressedSize: number;
  declaredUncompressedSize: number;
  compressionMethod: number;
  dataStart: number;
  dataEnd: number;
}

function countInflatedBytes(
  compressed: Buffer,
  maximumOutputBytes: number,
  scanExternalRelationship = false,
): Promise<
  | { ok: true; outputBytes: number; hasExternalRelationship: boolean }
  | { ok: false; limitExceeded: boolean }
> {
  return new Promise((resolve) => {
    const inflater = createInflateRaw();
    let outputBytes = 0;
    let relationshipTail = "";
    let hasExternalRelationship = false;
    let settled = false;
    const finish = (
      result:
        | { ok: true; outputBytes: number; hasExternalRelationship: boolean }
        | { ok: false; limitExceeded: boolean },
    ) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    inflater.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (scanExternalRelationship && !hasExternalRelationship) {
        const searchable = `${relationshipTail}${chunk.toString("utf8")}`;
        hasExternalRelationship = /targetmode\s*=\s*["']external["']/i.test(searchable);
        relationshipTail = searchable.slice(-96);
      }
      if (outputBytes > maximumOutputBytes) {
        finish({ ok: false, limitExceeded: true });
        inflater.destroy();
      }
    });
    inflater.on("error", () => finish({ ok: false, limitExceeded: false }));
    inflater.on("end", () => finish({ ok: true, outputBytes, hasExternalRelationship }));
    inflater.end(compressed);
  });
}

function unsafeArchiveMember(fileName: string): boolean {
  const normalized = fileName.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  const leaf = lower.split("/").pop() ?? "";
  return (
    normalized.includes("\0") ||
    normalized.startsWith("/") ||
    /^[a-z]:/i.test(normalized) ||
    normalized.split("/").includes("..") ||
    lower.startsWith("xl/embeddings/") ||
    lower.startsWith("xl/activex/") ||
    lower.startsWith("xl/externallinks/") ||
    lower.endsWith("/vbaproject.bin") ||
    /\.(?:exe|dll|com|scr|msi|msp|bat|cmd|ps1|vbs|vbe|js|jse|wsf|wsh|jar)$/i.test(leaf)
  );
}

/**
 * Reads only ZIP central-directory metadata. This bounds decompression work
 * before ExcelJS expands the XLSX archive into its in-memory workbook model.
 * ZIP64 is deliberately rejected because the accepted source workbook is far
 * below the ordinary ZIP limits and supporting it would weaken these bounds.
 */
async function preflightXlsxArchive(
  bytes: Buffer,
): Promise<ArchivePreflightFailure | null> {
  const endSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const minimumEndOffset = Math.max(0, bytes.byteLength - 65_557);
  let endOffset = -1;

  for (let offset = bytes.byteLength - 22; offset >= minimumEndOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== endSignature) continue;
    const commentLength = bytes.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === bytes.byteLength) {
      endOffset = offset;
      break;
    }
  }

  if (endOffset < 0) {
    return {
      code: "invalid_xlsx_container",
      message: "Il contenuto non presenta una directory ZIP XLSX valida.",
    };
  }

  const diskNumber = bytes.readUInt16LE(endOffset + 4);
  const centralDisk = bytes.readUInt16LE(endOffset + 6);
  const entriesOnDisk = bytes.readUInt16LE(endOffset + 8);
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0 ||
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    return {
      code: "unsafe_xlsx_archive",
      message: "L'archivio XLSX usa una struttura ZIP non ammessa.",
    };
  }
  if (entryCount > MAX_XLSX_ARCHIVE_ENTRIES) {
    return {
      code: "unsafe_xlsx_archive",
      message: "L'archivio XLSX contiene troppi elementi.",
      value: String(entryCount),
    };
  }

  const centralEnd = centralOffset + centralSize;
  if (
    !Number.isSafeInteger(centralEnd) ||
    centralOffset < 0 ||
    centralEnd > endOffset
  ) {
    return {
      code: "invalid_xlsx_container",
      message: "La directory ZIP del file XLSX non è valida.",
    };
  }

  let cursor = centralOffset;
  const entries: ArchiveEntryPreflight[] = [];
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (cursor + 46 > centralEnd || bytes.readUInt32LE(cursor) !== centralSignature) {
      return {
        code: "invalid_xlsx_container",
        message: "La directory ZIP del file XLSX è incompleta.",
      };
    }

    const flags = bytes.readUInt16LE(cursor + 8);
    const compressionMethod = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const fileNameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localHeaderOffset = bytes.readUInt32LE(cursor + 42);
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > centralEnd) {
      return {
        code: "invalid_xlsx_container",
        message: "Il nome di un elemento ZIP del file XLSX è incompleto.",
      };
    }
    const fileName = bytes.toString((flags & 0x800) !== 0 ? "utf8" : "latin1", fileNameStart, fileNameEnd);
    if (
      (flags & 0x1) !== 0 ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      (compressionMethod !== 0 && compressionMethod !== 8)
    ) {
      return {
        code: "unsafe_xlsx_archive",
        message: "L'archivio XLSX è cifrato o usa una compressione non ammessa.",
      };
    }
    if (unsafeArchiveMember(fileName)) {
      return {
        code: "unsafe_xlsx_archive",
        message: "Il file XLSX contiene collegamenti o contenuti attivi non ammessi.",
        value: fileName,
      };
    }

    if (
      localHeaderOffset + 30 > centralOffset ||
      bytes.readUInt32LE(localHeaderOffset) !== 0x04034b50
    ) {
      return {
        code: "invalid_xlsx_container",
        message: "Un elemento ZIP del file XLSX non ha un'intestazione valida.",
      };
    }
    const localFlags = bytes.readUInt16LE(localHeaderOffset + 6);
    const localCompressionMethod = bytes.readUInt16LE(localHeaderOffset + 8);
    const localNameLength = bytes.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (
      (localFlags & 0x1) !== 0 ||
      localCompressionMethod !== compressionMethod ||
      !Number.isSafeInteger(dataEnd) ||
      dataStart < 0 ||
      dataEnd > centralOffset
    ) {
      return {
        code: "invalid_xlsx_container",
        message: "Un elemento ZIP del file XLSX supera i limiti dell'archivio.",
      };
    }

    entries.push({
      fileName,
      compressedSize,
      declaredUncompressedSize: uncompressedSize,
      compressionMethod,
      dataStart,
      dataEnd,
    });

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  if (cursor !== centralEnd) {
    return {
      code: "invalid_xlsx_container",
      message: "La directory ZIP del file XLSX contiene dati inattesi.",
    };
  }

  const ranges = entries
    .filter((entry) => entry.dataEnd > entry.dataStart)
    .map((entry) => [entry.dataStart, entry.dataEnd] as const)
    .sort((left, right) => left[0] - right[0]);
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index][0] < ranges[index - 1][1]) {
      return {
        code: "invalid_xlsx_container",
        message: "Gli elementi ZIP del file XLSX si sovrappongono.",
      };
    }
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    const remainingTotal = MAX_XLSX_UNCOMPRESSED_BYTES - totalUncompressed;
    const entryLimit = Math.min(MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES, remainingTotal);
    if (entryLimit < 0) {
      return {
        code: "unsafe_xlsx_archive",
        message: "L'archivio XLSX supera i limiti di decompressione sicura.",
      };
    }

    let actualUncompressedSize: number;
    let hasExternalRelationship = false;
    if (entry.compressionMethod === 0) {
      actualUncompressedSize = entry.compressedSize;
      if (actualUncompressedSize > entryLimit) {
        return {
          code: "unsafe_xlsx_archive",
          message: "L'archivio XLSX supera i limiti di decompressione sicura.",
        };
      }
      if (entry.fileName.toLowerCase().endsWith(".rels")) {
        hasExternalRelationship = /targetmode\s*=\s*["']external["']/i.test(
          bytes.toString("utf8", entry.dataStart, entry.dataEnd),
        );
      }
    } else {
      const inflated = await countInflatedBytes(
        bytes.subarray(entry.dataStart, entry.dataEnd),
        entryLimit,
        entry.fileName.toLowerCase().endsWith(".rels"),
      );
      if (!inflated.ok) {
        return {
          code: inflated.limitExceeded ? "unsafe_xlsx_archive" : "invalid_xlsx_container",
          message: inflated.limitExceeded
            ? "L'archivio XLSX supera i limiti di decompressione sicura."
            : "Un elemento compresso del file XLSX non è valido.",
        };
      }
      actualUncompressedSize = inflated.outputBytes;
      hasExternalRelationship = inflated.hasExternalRelationship;
    }

    if (hasExternalRelationship) {
      return {
        code: "unsafe_xlsx_archive",
        message: "Il file XLSX contiene una relazione esterna non ammessa.",
        value: entry.fileName,
      };
    }

    totalUncompressed += actualUncompressedSize;
    const actualRatio = actualUncompressedSize / Math.max(1, entry.compressedSize);
    if (
      actualUncompressedSize !== entry.declaredUncompressedSize ||
      (actualUncompressedSize > 1024 * 1024 && actualRatio > MAX_XLSX_COMPRESSION_RATIO)
    ) {
      return {
        code: actualUncompressedSize !== entry.declaredUncompressedSize
          ? "invalid_xlsx_container"
          : "unsafe_xlsx_archive",
        message: actualUncompressedSize !== entry.declaredUncompressedSize
          ? "Le dimensioni dichiarate da un elemento XLSX non corrispondono ai dati."
          : "L'archivio XLSX supera il rapporto di compressione consentito.",
      };
    }
  }
  return null;
}

function workbookCellValue(
  cell: ExcelJS.Cell,
  rowNumber: number,
  columnIndex: number,
): unknown {
  const value = cell.value;
  if (
    rowNumber > HOSPITAL_HEADER_ROWS.length &&
    IDENTIFIER_COLUMNS.has(columnIndex) &&
    value !== null &&
    value !== undefined &&
    formulaFrom(value) === undefined
  ) {
    // cell.text applies an identifier's Excel number format. This is crucial
    // for AIC values stored numerically with a 000000000 display format.
    return cell.text;
  }
  return value;
}

export async function validateHospitalWorkbook(
  buffer: Buffer | Uint8Array | ArrayBuffer,
  scope?: HospitalValidationScope,
): Promise<HospitalValidationReport> {
  const bytes = toNodeBuffer(buffer);
  if (bytes.byteLength === 0) {
    return rejectedReport("empty_file", "Il file ospedaliero è vuoto.");
  }
  if (bytes.byteLength > MAX_HOSPITAL_FILE_BYTES) {
    return rejectedReport(
      "file_too_large",
      `Il file ospedaliero supera il limite di ${MAX_HOSPITAL_FILE_BYTES} byte.`,
      String(bytes.byteLength),
    );
  }
  if (
    bytes.byteLength < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    return rejectedReport("invalid_xlsx_container", "Il contenuto non è un file XLSX valido.");
  }

  const archiveFailure = await preflightXlsxArchive(bytes);
  if (archiveFailure) {
    return rejectedReport(
      archiveFailure.code,
      archiveFailure.message,
      archiveFailure.value,
    );
  }

  const workbook = new ExcelJS.Workbook();
  try {
    // ExcelJS 4's declaration pins an older Node Buffer shape. The runtime
    // accepts the current Buffer; this cast bridges only that type-version gap.
    await workbook.xlsx.load(
      bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch (error) {
    return rejectedReport(
      "workbook_unreadable",
      "Il file XLSX non può essere letto.",
      error instanceof Error ? error.message : "unknown parser error",
    );
  }

  const visibleWorksheets = workbook.worksheets.filter(
    (worksheet) => worksheet.state === "visible",
  );
  const selectedWorksheet =
    workbook.getWorksheet(HOSPITAL_SHEET_NAME) ??
    visibleWorksheets[0] ??
    workbook.worksheets[0];
  const formulaCells: HospitalFormulaCell[] = [];
  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        const formula = formulaFrom(cell.value);
        if (formula !== undefined) {
          formulaCells.push({
            sheetName: worksheet.name,
            row: rowNumber,
            column: columnNumber,
            formula,
          });
        }
      });
    });
  }

  if (!selectedWorksheet) {
    return validateHospitalRows([], {
      sheetName: null,
      visibleSheetNames: visibleWorksheets.map((worksheet) => worksheet.name),
      columnCount: 0,
      formulaCells,
      sourceRowCount: 0,
      sourceRowExtent: 0,
    }, scope);
  }

  const readRowCount = Math.min(
    selectedWorksheet.rowCount,
    MAX_HOSPITAL_DATA_ROWS + HOSPITAL_HEADER_ROWS.length + 1,
  );
  const rows: unknown[][] = [];
  for (let rowNumber = 1; rowNumber <= readRowCount; rowNumber += 1) {
    const row = selectedWorksheet.getRow(rowNumber);
    rows.push(
      Array.from({ length: EXPECTED_COLUMN_COUNT }, (_, columnIndex) =>
        workbookCellValue(row.getCell(columnIndex + 1), rowNumber, columnIndex),
      ),
    );
  }

  return validateHospitalRows(
    rows,
    {
      sheetName: selectedWorksheet.name,
      visibleSheetNames: visibleWorksheets.map((worksheet) => worksheet.name),
      columnCount: selectedWorksheet.actualColumnCount,
      formulaCells,
      sourceRowCount: Math.max(0, selectedWorksheet.actualRowCount - HOSPITAL_HEADER_ROWS.length),
      sourceRowExtent: Math.max(0, selectedWorksheet.rowCount - HOSPITAL_HEADER_ROWS.length),
    },
    scope,
  );
}
