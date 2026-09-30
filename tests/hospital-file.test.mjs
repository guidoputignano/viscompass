import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

import {
  HOSPITAL_HEADER_ROWS,
  HOSPITAL_MONTH_TOKENS,
  HOSPITAL_SHEET_NAME,
  validateHospitalRows,
  validateHospitalWorkbook,
} from "../lib/uploads/hospital-file.ts";

const fullMonths = HOSPITAL_MONTH_TOKENS.join("\n");
const validMetadata = {
  sheetName: HOSPITAL_SHEET_NAME,
  visibleSheetNames: [HOSPITAL_SHEET_NAME],
  columnCount: 34,
};

function hospitalRow(overrides = {}) {
  const row = Array(34).fill(null);
  Object.assign(row, {
    0: 2025,
    1: "130",
    2: "ABRUZZO",
    3: "130201",
    4: "AVEZZANO-SULMONA-L'AQUILA",
    5: 2039,
    6: "AUREOMICINA",
    7: "002039055",
    8: fullMonths,
    9: fullMonths,
    10: 8627,
    11: "Example Pharma",
    12: 2,
    13: 20,
    14: 3,
    15: 30,
    16: 5,
    17: 50,
    18: 10,
    19: 10,
    20: 100,
    21: 12,
    22: 12,
    23: 11,
    24: 120,
    25: 110,
    26: "X",
    27: "X",
    28: 2,
    29: 0.2,
    30: 2,
    31: 0.2,
    32: 20,
    33: 0.2,
  }, overrides);
  return row;
}

function workbookRows(...dataRows) {
  return [
    HOSPITAL_HEADER_ROWS[0].slice(),
    HOSPITAL_HEADER_ROWS[1].slice(),
    ...dataRows,
  ];
}

function issue(report, code) {
  return report.issues.find((candidate) => candidate.code === code);
}

test("accepts a clean gold-v1 matrix and returns deterministic scope summary", () => {
  const report = validateHospitalRows(
    workbookRows(hospitalRow()),
    validMetadata,
    { orgType: "regione", orgCode: "regione-abruzzo", regionCode: "130" },
  );

  assert.equal(report.status, "accepted");
  assert.equal(report.formatVersion, "DIR_OSP_TRA_003AS/v1");
  assert.equal(report.sheetName, HOSPITAL_SHEET_NAME);
  assert.deepEqual(report.summary, {
    rowCount: 1,
    years: [2025],
    regionCodes: ["130"],
    aslCodes: ["130201"],
    fullMonthRows: 1,
    coverageStart: "2025-01-01",
    coverageEnd: "2025-12-31",
  });
  assert.deepEqual(report.issues, []);
});

test("rejects sheet, column, and exact two-row header drift", () => {
  const rows = workbookRows(hospitalRow());
  rows[0][0] = "ANNO";
  rows[2][34] = "unexpected";
  const report = validateHospitalRows(rows, {
    sheetName: "Wrong sheet",
    visibleSheetNames: ["Wrong sheet", HOSPITAL_SHEET_NAME],
    columnCount: 35,
  });

  assert.equal(report.status, "rejected");
  assert.ok(issue(report, "visible_sheet_contract"));
  assert.ok(issue(report, "sheet_name_mismatch"));
  assert.ok(issue(report, "column_count_mismatch"));
  assert.equal(issue(report, "header_mismatch").count, 1);
});

test("rejects formulas in selected rows or workbook metadata", () => {
  const row = hospitalRow({ 12: { formula: "1+1", result: 2 } });
  const report = validateHospitalRows(workbookRows(row), {
    ...validMetadata,
    formulaCells: [
      { sheetName: "hidden audit", row: 1, column: 1, formula: "NOW()" },
    ],
  });

  assert.equal(report.status, "rejected");
  assert.equal(issue(report, "formula_not_allowed").count, 2);
});

test("rejects missing identifiers, impossible months, and tenant scope mismatches", () => {
  const row = hospitalRow({
    7: null,
    9: `${HOSPITAL_MONTH_TOKENS[0]}\n13-Tredicesimo`,
  });
  const report = validateHospitalRows(
    workbookRows(row),
    validMetadata,
    { orgType: "asl", orgCode: "130999", regionCode: "130" },
  );

  assert.equal(report.status, "rejected");
  assert.equal(issue(report, "missing_core_identifier").count, 1);
  assert.equal(issue(report, "invalid_month_token").count, 1);
  assert.equal(issue(report, "tenant_scope_mismatch").count, 1);
});

test("rejects available months outside the observed period", () => {
  const row = hospitalRow({
    8: HOSPITAL_MONTH_TOKENS[0],
    9: `${HOSPITAL_MONTH_TOKENS[0]}\n${HOSPITAL_MONTH_TOKENS[1]}`,
  });
  const report = validateHospitalRows(workbookRows(row), validMetadata);

  assert.equal(report.status, "rejected");
  assert.equal(issue(report, "month_coverage_inconsistent").count, 1);
});

test("derives the covered period from available months without claiming a full year", () => {
  const firstQuarter = HOSPITAL_MONTH_TOKENS.slice(0, 3).join("\n");
  const report = validateHospitalRows(
    workbookRows(hospitalRow({ 8: firstQuarter, 9: firstQuarter })),
    validMetadata,
  );

  assert.equal(report.status, "accepted_with_warnings");
  assert.equal(report.summary.coverageStart, "2025-01-01");
  assert.equal(report.summary.coverageEnd, "2025-03-31");
});

test("rejects text and missing values in numeric contract columns", () => {
  const report = validateHospitalRows(
    workbookRows(hospitalRow({ 12: "NOT A NUMBER", 20: null })),
    validMetadata,
  );

  assert.equal(report.status, "rejected");
  assert.equal(issue(report, "invalid_numeric_value").count, 1);
  assert.equal(issue(report, "required_numeric_value_missing").count, 1);
});

test("rejects spreadsheet errors in additive source measures", () => {
  const report = validateHospitalRows(
    workbookRows(hospitalRow({ 12: "#DIV/0!" })),
    validMetadata,
  );

  assert.equal(report.status, "rejected");
  assert.equal(issue(report, "invalid_numeric_value").count, 1);
  assert.equal(issue(report, "division_by_zero").count, 1);
});

test("hard-rejects confirmed a, c, and i arithmetic mismatches", () => {
  const row = hospitalRow({ 18: 11, 20: 101, 28: 3 });
  const report = validateHospitalRows(workbookRows(row), validMetadata);

  assert.equal(report.status, "rejected");
  assert.equal(issue(report, "additive_math_mismatch").count, 3);
});

test("applies the confirmed EUR 0.01 tolerance to the channel-cost total", () => {
  const withinTolerance = validateHospitalRows(
    workbookRows(hospitalRow({ 20: 100.01 })),
    validMetadata,
  );
  assert.equal(issue(withinTolerance, "additive_math_mismatch"), undefined);

  const outsideTolerance = validateHospitalRows(
    workbookRows(hospitalRow({ 20: 100.011 })),
    validMetadata,
  );
  assert.equal(outsideTolerance.status, "rejected");
  assert.equal(issue(outsideTolerance, "additive_math_mismatch").count, 1);
});

test("treats blank trace quantity V as zero for i=V-S", () => {
  const row = hospitalRow({ 21: null, 28: -10, 29: -1 });
  const report = validateHospitalRows(workbookRows(row), validMetadata);

  assert.equal(report.status, "accepted");
  assert.equal(issue(report, "additive_math_mismatch"), undefined);
});

test("aggregates warnings accurately and caps examples", () => {
  const warningRow = hospitalRow({
    3: "ND",
    4: "ASL non significativa",
    9: HOSPITAL_MONTH_TOKENS.slice(0, 3).join("\n"),
    12: -2,
    18: 6,
    19: 100 / 6,
    21: 12,
    22: 1_000_001,
    23: 11,
    28: 6,
    29: 1,
    30: 1_000_001 - 100 / 6,
    31: "#DIV/0",
  });
  const report = validateHospitalRows(
    workbookRows(...Array.from({ length: 8 }, () => warningRow.slice())),
    validMetadata,
  );

  assert.equal(report.status, "accepted_with_warnings");
  assert.equal(issue(report, "nd_asl").count, 8);
  assert.equal(issue(report, "partial_month_coverage").count, 8);
  assert.equal(issue(report, "division_by_zero").count, 8);
  assert.equal(issue(report, "negative_source_measure").count, 8);
  assert.equal(issue(report, "extreme_price").count, 8);
  assert.equal(issue(report, "duplicate_base_key").count, 7);
  for (const warning of report.issues) {
    assert.ok(warning.examples.length <= 5);
  }
});

test("checks m, o, and ratios only when their operands are numeric", () => {
  const mismatched = hospitalRow({
    29: 9,
    30: 99,
    31: 8,
    32: 98,
    33: 7,
  });
  const mismatchReport = validateHospitalRows(workbookRows(mismatched), validMetadata);
  assert.equal(mismatchReport.status, "accepted_with_warnings");
  assert.equal(issue(mismatchReport, "derived_math_mismatch").count, 2);
  assert.equal(issue(mismatchReport, "derived_ratio_mismatch").count, 3);

  const nonNumericRatios = hospitalRow({ 29: "#DIV/0", 31: "#DIV/0", 33: null });
  const skippedReport = validateHospitalRows(workbookRows(nonNumericRatios), validMetadata);
  assert.equal(issue(skippedReport, "derived_ratio_mismatch"), undefined);
  assert.equal(issue(skippedReport, "division_by_zero").count, 2);
});

test("XLSX parsing pads numeric AIC values and preserves the nine-digit key", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(HOSPITAL_SHEET_NAME);
  for (const row of workbookRows(hospitalRow(), hospitalRow())) sheet.addRow(row);
  sheet.getCell("H4").value = 2_039_055;
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const report = await validateHospitalWorkbook(buffer);
  assert.equal(report.status, "accepted_with_warnings");
  assert.equal(issue(report, "invalid_aic_code"), undefined);
  const duplicate = issue(report, "duplicate_base_key");
  assert.equal(duplicate.count, 1);
  assert.match(duplicate.examples[0].value, /002039055/);
});

test("XLSX parsing rejects formulas even on hidden worksheets", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(HOSPITAL_SHEET_NAME);
  for (const row of workbookRows(hospitalRow())) sheet.addRow(row);
  const hidden = workbook.addWorksheet("hidden audit");
  hidden.state = "hidden";
  hidden.getCell("A1").value = { formula: "NOW()", result: 0 };
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const report = await validateHospitalWorkbook(buffer);
  assert.equal(report.status, "rejected");
  assert.equal(issue(report, "visible_sheet_contract"), undefined);
  assert.equal(issue(report, "formula_not_allowed").count, 1);
});

test("XLSX parsing validates rows after an intentional blank line", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(HOSPITAL_SHEET_NAME);
  for (const row of workbookRows()) sheet.addRow(row);
  sheet.addRow([]);
  sheet.addRow(hospitalRow({ 3: "130999" }));
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const report = await validateHospitalWorkbook(buffer, {
    orgType: "asl",
    orgCode: "130201",
    regionCode: "130",
  });
  assert.equal(report.status, "rejected");
  assert.equal(issue(report, "tenant_scope_mismatch").count, 1);
  assert.equal(issue(report, "tenant_scope_mismatch").examples[0].row, 4);
});

test("XLSX archive preflight rejects false central-directory output sizes", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(HOSPITAL_SHEET_NAME);
  for (const row of workbookRows(hospitalRow())) sheet.addRow(row);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const centralSignature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const centralOffset = buffer.indexOf(centralSignature);
  assert.ok(centralOffset >= 0);
  buffer.writeUInt32LE(1, centralOffset + 24);

  const report = await validateHospitalWorkbook(buffer);
  assert.equal(report.status, "rejected");
  assert.equal(issue(report, "invalid_xlsx_container").count, 1);
});

test("XLSX archive preflight rejects embedded executable members", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(HOSPITAL_SHEET_NAME);
  for (const row of workbookRows(hospitalRow())) sheet.addRow(row);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const originalName = Buffer.from("[Content_Types].xml");
  const unsafeName = "xl/embeddings/x.exe";
  assert.equal(Buffer.byteLength(unsafeName), originalName.byteLength);
  let replacementCount = 0;
  let searchOffset = 0;
  while (true) {
    const match = buffer.indexOf(originalName, searchOffset);
    if (match < 0) break;
    buffer.write(unsafeName, match, "utf8");
    replacementCount += 1;
    searchOffset = match + originalName.byteLength;
  }
  assert.equal(replacementCount, 2);

  const report = await validateHospitalWorkbook(buffer);
  assert.equal(report.status, "rejected");
  assert.equal(issue(report, "unsafe_xlsx_archive").count, 1);
});

test("XLSX archive preflight rejects external relationships", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(HOSPITAL_SHEET_NAME);
  for (const row of workbookRows(hospitalRow())) sheet.addRow(row);
  const hidden = workbook.addWorksheet("hidden link");
  hidden.state = "hidden";
  hidden.getCell("A1").value = {
    text: "external",
    hyperlink: "https://example.com/workbook",
  };
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const report = await validateHospitalWorkbook(buffer);
  assert.equal(report.status, "rejected");
  assert.equal(issue(report, "unsafe_xlsx_archive").count, 1);
});

test("invalid binary input returns a bounded rejection report", async () => {
  const report = await validateHospitalWorkbook(Buffer.from("not an xlsx"));
  assert.equal(report.status, "rejected");
  assert.equal(report.sheetName, null);
  assert.equal(report.summary.rowCount, 0);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].code, "invalid_xlsx_container");
});

test("a pathological month cell is rejected on sight, not processed", () => {
  // The duplicate scan used `duplicate.includes(token)` inside the loop over
  // tokens -- a linear scan of a list that grows with every distinct duplicate,
  // so the whole pass was quadratic in the number of tokens in ONE cell. An
  // uploaded file controls that cell entirely, so a few hundred kilobytes of
  // newline-separated values blocked the Node event loop for minutes and took
  // the server with it, before any validation could reject the file.
  //
  // This asserts the time bound, not only the rejection. A quadratic
  // implementation cannot pass it, and a timing assertion is the only thing that
  // catches the regression coming back.
  const hostile = Array.from({ length: 40_000 }, (_, i) => `2025-${i}`).join("\n");
  const started = process.hrtime.bigint();
  const report = validateHospitalRows(
    workbookRows(hospitalRow({ 9: hostile })),
    validMetadata,
    { orgType: "asl", orgCode: "130201", regionCode: "130" },
  );
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  assert.ok(
    elapsedMs < 2_000,
    `month-token parsing took ${elapsedMs.toFixed(0)}ms; the quadratic scan is back`,
  );
  assert.equal(report.status, "rejected");
  assert.ok(
    issue(report, "invalid_month_token"),
    "the oversized cell must be reported, not silently dropped",
  );
});

test("a month cell within the cap is still parsed normally", () => {
  // The cap must not swallow legitimate input: twelve real tokens with one
  // repeated still validate and the duplicate is still reported.
  const withDuplicate = [...HOSPITAL_MONTH_TOKENS, HOSPITAL_MONTH_TOKENS[0]].join("\n");
  const report = validateHospitalRows(
    workbookRows(hospitalRow({ 9: withDuplicate })),
    validMetadata,
    { orgType: "asl", orgCode: "130201", regionCode: "130" },
  );
  assert.ok(
    issue(report, "duplicate_month_token"),
    "the duplicate must still be reported",
  );
});
