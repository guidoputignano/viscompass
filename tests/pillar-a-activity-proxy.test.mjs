import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  A2_SELECTOR_DESCRIPTION_VERBATIM,
  PUBLIC_ACTIVITY_PROXY_COMPOSITIONS,
  PUBLIC_ACTIVITY_PROXY_LABEL,
  compareTrustedActivityWithProxy,
  isReservedExactDenominatorLabel,
  normalizeRegionName,
  parseItalianNumber,
  resolveRegionCode,
  summarizeCalibrationEvidence,
} from "../lib/analytics/pillar-a-activity-proxy.ts";

const REGISTRY = [
  { code: "010", name: "PIEMONTE" },
  { code: "020", name: "VALLE D'AOSTA" },
  { code: "041", name: "PROV. AUTON. BOLZANO" },
  { code: "042", name: "PROV. AUTON. TRENTO" },
  { code: "080", name: "EMILIA ROMAGNA" },
  { code: "130", name: "ABRUZZO" },
];

test("Italian numerics parse and suppression never becomes zero", () => {
  assert.deepEqual(parseItalianNumber("1.271"), { status: "value", value: 1271 });
  assert.deepEqual(parseItalianNumber("5,81"), { status: "value", value: 5.81 });
  assert.deepEqual(parseItalianNumber("1.271,50"), { status: "value", value: 1271.5 });
  assert.deepEqual(parseItalianNumber(910332), { status: "value", value: 910332 });
  assert.deepEqual(parseItalianNumber("***"), { status: "suppressed", raw: "***" });
  assert.deepEqual(parseItalianNumber("-"), { status: "blank", raw: "-" });
  assert.deepEqual(parseItalianNumber(""), { status: "blank", raw: "" });
  assert.deepEqual(parseItalianNumber(null), { status: "blank", raw: "" });
  assert.equal(parseItalianNumber("n.d.").status, "invalid");
  assert.equal(parseItalianNumber(Number.NaN).status, "invalid");
});

test("region names resolve through the registry, including autonomous-province aliases", () => {
  assert.equal(normalizeRegionName("P.A. Bolzano"), "PROVAUTONBOLZANO");
  assert.equal(normalizeRegionName("PA DI TRENTO"), "PROVAUTONTRENTO");
  assert.equal(normalizeRegionName("Valle d'Aosta"), "VALLEDAOSTA");
  assert.deepEqual(resolveRegionCode("Abruzzo", REGISTRY), {
    status: "matched",
    code: "130",
    registryName: "ABRUZZO",
  });
  assert.equal(resolveRegionCode("P.A. Bolzano", REGISTRY).code, "041");
  assert.equal(resolveRegionCode("Emilia Romagna", REGISTRY).code, "080");
  assert.equal(resolveRegionCode("Trentino Alto Adige", REGISTRY).status, "unmatched");
  assert.equal(
    resolveRegionCode("Abruzzo", [...REGISTRY, { code: "999", name: "Abruzzo" }]).status,
    "ambiguous",
  );
});

test("the proxy vocabulary never presents itself as A2", () => {
  assert.notEqual(PUBLIC_ACTIVITY_PROXY_LABEL.toLowerCase(), "a2");
  assert.ok(isReservedExactDenominatorLabel("A2"));
  assert.ok(isReservedExactDenominatorLabel(" a2_activity "));
  assert.ok(!isReservedExactDenominatorLabel(PUBLIC_ACTIVITY_PROXY_LABEL));
  assert.equal(A2_SELECTOR_DESCRIPTION_VERBATIM, 'DEGENZA + ACCESSI - ESCLUDI ONERE "4" E DRG 391');
  for (const definition of PUBLIC_ACTIVITY_PROXY_COMPOSITIONS) {
    assert.ok(!isReservedExactDenominatorLabel(definition.id), definition.id);
    assert.ok(definition.components.length > 0);
    assert.match(definition.drg391Handling, /^(excluded_by_source_definition|not_excluded|not_determinable_from_source)$/);
    assert.match(definition.onere4Handling, /^(excluded_by_source_definition|not_excluded|not_determinable_from_source)$/);
  }
  const ids = PUBLIC_ACTIVITY_PROXY_COMPOSITIONS.map((definition) => definition.id);
  assert.equal(new Set(ids).size, ids.length);
});

const trustedRegional2024 = {
  label: "workbook_a2_activity",
  year: 2024,
  grain: "region",
  regionCode: "130",
  aziendaCode: null,
  value: 963_045,
};

test("same-year same-grain comparison forms a ratio without adjusting either side", () => {
  const result = compareTrustedActivityWithProxy({
    trusted: trustedRegional2024,
    proxy: {
      label: PUBLIC_ACTIVITY_PROXY_LABEL,
      composition: "sdo_region_acute_ro_days_plus_dh_accesses",
      year: 2024,
      grain: "region",
      regionCode: "130",
      aziendaCode: null,
      value: 1_022_331,
    },
  });
  assert.equal(result.status, "available");
  assert.equal(result.value.trustedValue, 963_045);
  assert.equal(result.value.proxyValue, 1_022_331);
  assert.ok(Math.abs(result.value.trustedOverProxy - 963_045 / 1_022_331) < 1e-12);
  assert.equal(result.value.proxyMinusTrusted, 59_286);
  assert.ok(Math.abs(result.value.proxyRelativeDifference - 59_286 / 963_045) < 1e-12);
});

test("year, grain, region and Azienda mismatches are unavailable, never interpolated", () => {
  const proxy = {
    label: PUBLIC_ACTIVITY_PROXY_LABEL,
    composition: "hsp_azienda_public_ordinary_days",
    year: 2022,
    grain: "azienda",
    regionCode: "130",
    aziendaCode: "201",
    value: 211_038,
  };
  const trustedAzienda2023 = {
    label: "workbook_a2_activity",
    year: 2023,
    grain: "azienda",
    regionCode: "130",
    aziendaCode: "201",
    value: 237_235,
  };
  assert.equal(
    compareTrustedActivityWithProxy({ trusted: trustedAzienda2023, proxy }).code,
    "year_mismatch",
  );
  assert.equal(
    compareTrustedActivityWithProxy({ trusted: trustedRegional2024, proxy: { ...proxy, year: 2024 } }).code,
    "grain_mismatch",
  );
  assert.equal(
    compareTrustedActivityWithProxy({
      trusted: { ...trustedAzienda2023, year: 2022 },
      proxy: { ...proxy, aziendaCode: "202" },
    }).code,
    "azienda_mismatch",
  );
  assert.equal(
    compareTrustedActivityWithProxy({
      trusted: { ...trustedAzienda2023, year: 2022, regionCode: "010" },
      proxy,
    }).code,
    "region_mismatch",
  );
  assert.equal(
    compareTrustedActivityWithProxy({
      trusted: trustedRegional2024,
      proxy: { ...proxy, year: 2024, grain: "region", aziendaCode: "201" },
    }).code,
    "grain_mismatch",
  );
  assert.equal(
    compareTrustedActivityWithProxy({ trusted: trustedRegional2024, proxy: { ...proxy, year: 2024, grain: "region", aziendaCode: null, value: null } }).code,
    "missing_input",
  );
  assert.equal(
    compareTrustedActivityWithProxy({ trusted: trustedRegional2024, proxy: { ...proxy, year: 2024, grain: "region", aziendaCode: null, value: 0 } }).code,
    "non_positive_proxy",
  );
  assert.equal(
    compareTrustedActivityWithProxy({ trusted: trustedRegional2024, proxy: { ...proxy, label: "A2", year: 2024, grain: "region", aziendaCode: null } }).code,
    "reserved_label",
  );
  assert.equal(
    compareTrustedActivityWithProxy({
      trusted: { ...trustedAzienda2023, year: 2022, grain: "facility" },
      proxy: { ...proxy, grain: "facility" },
    }).code,
    "grain_below_azienda",
    "facility-grain values are never compared, even when every key matches",
  );
});

test("a single regional observation cannot authorize a national correction factor", () => {
  const comparison = compareTrustedActivityWithProxy({
    trusted: trustedRegional2024,
    proxy: {
      label: PUBLIC_ACTIVITY_PROXY_LABEL,
      composition: "sdo_region_acute_ro_days_plus_dh_accesses",
      year: 2024,
      grain: "region",
      regionCode: "130",
      aziendaCode: null,
      value: 1_022_331,
    },
  });
  const summary = summarizeCalibrationEvidence(
    "sdo_region_acute_ro_days_plus_dh_accesses",
    [comparison.value],
    null,
  );
  assert.equal(summary.observations, 1);
  assert.equal(summary.distinctAziende, 0, "regional rows never count as Azienda evidence");
  assert.equal(summary.distinctYears, 1);
  assert.equal(summary.generalization.status, "blocked");

  const withPolicy = summarizeCalibrationEvidence(
    "sdo_region_acute_ro_days_plus_dh_accesses",
    [comparison.value],
    { minimumDistinctAziende: 8, minimumDistinctYears: 2 },
  );
  assert.equal(withPolicy.generalization.status, "blocked");
  assert.deepEqual(
    summarizeCalibrationEvidence("other_composition", [comparison.value], null).observations,
    0,
  );
});

test("degenerate or empty policies never permit generalization, a valid one can", () => {
  for (const policy of [
    { minimumDistinctAziende: 0, minimumDistinctYears: 0 },
    { minimumDistinctAziende: Number.NaN, minimumDistinctYears: 1 },
    { minimumDistinctAziende: -1, minimumDistinctYears: 1 },
    { minimumDistinctAziende: 1.5, minimumDistinctYears: 1 },
  ]) {
    assert.equal(
      summarizeCalibrationEvidence("x", [], policy).generalization.status,
      "blocked",
      JSON.stringify(policy),
    );
  }
  assert.equal(
    summarizeCalibrationEvidence("x", [], { minimumDistinctAziende: 1, minimumDistinctYears: 1 })
      .generalization.status,
    "blocked",
    "no evidence is never sufficient",
  );

  // Synthetic unit-test values; the composition id is not one the builder emits.
  const aziendaComparison = compareTrustedActivityWithProxy({
    trusted: {
      label: "workbook_a2_activity",
      year: 2022,
      grain: "azienda",
      regionCode: "130",
      aziendaCode: "201",
      value: 100,
    },
    proxy: {
      label: PUBLIC_ACTIVITY_PROXY_LABEL,
      composition: "unit_test_only_composition",
      year: 2022,
      grain: "azienda",
      regionCode: "130",
      aziendaCode: "201",
      value: 80,
    },
  });
  assert.equal(aziendaComparison.status, "available");
  const permitted = summarizeCalibrationEvidence(
    "unit_test_only_composition",
    [aziendaComparison.value],
    { minimumDistinctAziende: 1, minimumDistinctYears: 1 },
  );
  assert.equal(permitted.distinctAziende, 1);
  assert.equal(permitted.generalization.status, "permitted");
  assert.equal(
    summarizeCalibrationEvidence("unit_test_only_composition", [aziendaComparison.value], {
      minimumDistinctAziende: 2,
      minimumDistinctYears: 1,
    }).generalization.status,
    "blocked",
  );
});

const root = path.resolve(import.meta.dirname, "..");
const trustedExtractPath = path.join(root, "tmp/pillar_a_inputs.json");

test(
  "trusted workbook extract keeps the A2 selector and the regional sum identity",
  { skip: !existsSync(trustedExtractPath) && "tmp/pillar_a_inputs.json not present" },
  () => {
    const extract = JSON.parse(readFileSync(trustedExtractPath, "utf8"));
    assert.equal(extract.selector.activity, "A2");
    assert.equal(extract.selector.description, A2_SELECTOR_DESCRIPTION_VERBATIM);
    const totals = extract.records.filter((record) => record.aware === "Total");
    const years = [...new Set(totals.map((record) => record.year))];
    assert.deepEqual(years, [2023, 2024, 2025]);
    for (const year of years) {
      const regional = totals.find((record) => record.year === year && record.azienda === "130");
      const aziende = totals.filter((record) => record.year === year && ["201", "202", "203", "204"].includes(record.azienda));
      assert.equal(aziende.length, 4);
      const sum = aziende.reduce((total, record) => total + record.activity_a2, 0);
      assert.ok(Math.abs(sum - regional.activity_a2) < 1e-6, `${year}: ${sum} vs ${regional.activity_a2}`);
    }
  },
);

const componentsPath = path.join(root, "data/derived/pillar_a/public_activity_proxy_components.csv");
const calibrationPath = path.join(root, "data/derived/pillar_a/a2_public_proxy_calibration.csv");

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows[0];
  return rows.slice(1).map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""])));
}

test(
  "generated proxy table keeps proxy and exact A2 visibly separate",
  { skip: !existsSync(componentsPath) && "derived proxy table not built" },
  () => {
    const rows = parseCsv(readFileSync(componentsPath, "utf8"));
    assert.ok(rows.length > 1000);
    for (const row of rows) {
      assert.equal(row.proxy_label, PUBLIC_ACTIVITY_PROXY_LABEL);
      assert.ok(!isReservedExactDenominatorLabel(row.activity_component), row.activity_component);
      assert.ok(row.source_sha256.length === 64, "every row carries its source hash");
      if (row.suppression_flag === "true") {
        assert.equal(row.value, "", "suppressed values stay null");
        assert.equal(row.proxy_status, "suppressed");
      }
      if (row.value === "") assert.notEqual(row.null_reason, "", "null values carry a reason");
      if (row.grain === "azienda" || row.grain === "facility") {
        assert.ok(row.region_code !== "", "facility and Azienda rows are keyed by region");
      }
    }
    const abruzzoAzienda = rows.filter(
      (row) =>
        row.source_id === "hospital_structure_activity_2022" &&
        row.grain === "azienda" &&
        row.region_code === "130" &&
        row.activity_component === "ordinary_regime_days",
    );
    assert.deepEqual(
      abruzzoAzienda.map((row) => row.azienda_code).sort(),
      ["201", "202", "203", "204"],
    );
    for (const aziendaRow of abruzzoAzienda) {
      assert.notEqual(aziendaRow.value, "", "Abruzzo Azienda totals are observed, not null");
      const facilityRows = rows.filter(
        (row) =>
          row.source_id === "hospital_structure_activity_2022" &&
          row.grain === "facility" &&
          row.region_code === "130" &&
          row.azienda_code === aziendaRow.azienda_code &&
          row.activity_component === "ordinary_regime_days",
      );
      assert.ok(facilityRows.length > 0);
      for (const row of facilityRows) {
        assert.notEqual(row.value, "", `${row.facility_code}: facility value must not be null`);
      }
      const facilitySum = facilityRows.reduce((total, row) => total + Number(row.value), 0);
      assert.equal(Number(aziendaRow.value), facilitySum);
      assert.equal(aziendaRow.organization_code, `130${aziendaRow.azienda_code}`);
    }
    const otherRegions201 = rows.filter(
      (row) => row.grain === "azienda" && row.azienda_code === "201" && row.region_code !== "130",
    );
    assert.ok(otherRegions201.length > 0, "Azienda code 201 exists outside Abruzzo, so region is part of the key");

    const niguarda = rows.find(
      (row) =>
        row.source_id === "hospital_structure_activity_2022" &&
        row.grain === "facility" &&
        row.facility_code === "030701" &&
        row.activity_component === "ordinary_regime_days",
    );
    assert.ok(niguarda, "Lombardy ASST facility present");
    assert.equal(niguarda.azienda_code, "701", "an ASST is its own Azienda, not its ATS");
    assert.equal(niguarda.territorial_asl_code, "321", "the ATS is kept as territorial ASL");
    assert.equal(
      niguarda.azienda_attribution_basis,
      "owning_azienda_ao_aou_irccs_registry_2022_over_codice_asl",
    );
    assert.ok(
      !rows.some((row) => row.grain === "azienda" && row.region_code === "030" && /^32\d$/.test(row.azienda_code) && row.source_id === "hospital_structure_activity_2022"),
      "no ATS is emitted as an Azienda from the HSP file",
    );

    const datoErrato = rows.filter((row) => row.source_locator.includes("flag=DATO_ERRATO"));
    assert.ok(datoErrato.length > 0, "Ministry DATO ERRATO sentinel rows are kept visible");
    for (const row of datoErrato) {
      assert.equal(row.value, "");
      assert.equal(row.null_reason, "source_row_flagged_dato_errato");
      assert.equal(row.proxy_status, "unavailable");
      assert.equal(row.suppression_flag, "false");
    }
    const locators = new Map();
    for (const row of rows) {
      const key = `${row.source_id}|${row.source_locator}|${row.activity_component}|${row.dimension}`;
      locators.set(key, (locators.get(key) ?? 0) + 1);
    }
    const duplicates = [...locators.entries()].filter(([, count]) => count > 1);
    assert.deepEqual(duplicates, [], "every row is uniquely addressable by source locator");
    assert.ok(
      !rows.some((row) => row.facility_name.includes('""') || (row.azienda_name ?? "").includes('""')),
      "doubled CSV quotes are unescaped in names",
    );
  },
);

test(
  "calibration output only forms ratios for overlapping year and grain",
  { skip: !existsSync(calibrationPath) && "derived calibration table not built" },
  () => {
    const rows = parseCsv(readFileSync(calibrationPath, "utf8"));
    for (const row of rows) {
      if (row.comparison_status === "compared_same_year_same_grain") {
        assert.equal(row.trusted_year, row.proxy_year);
        assert.equal(row.trusted_grain, row.composition_grain);
        assert.notEqual(row.trusted_over_proxy, "");
      } else {
        assert.equal(row.trusted_over_proxy, "", `${row.comparison_status} must not carry a ratio`);
      }
    }
    const compared = rows.filter((row) => row.comparison_status === "compared_same_year_same_grain");
    const regionCompositions = PUBLIC_ACTIVITY_PROXY_COMPOSITIONS.filter((definition) => definition.grain === "region")
      .map((definition) => definition.id)
      .sort();
    assert.equal(
      compared.length,
      regionCompositions.length,
      "every region-grain composition is compared against the 2024 regional A2 case",
    );
    assert.deepEqual(compared.map((row) => row.composition).sort(), regionCompositions);
    for (const row of compared) {
      assert.equal(row.trusted_grain, "region");
      assert.equal(row.trusted_year, "2024");
      assert.equal(row.region_code, "130");
      assert.ok(
        Math.abs(Number(row.trusted_over_proxy) - Number(row.trusted_a2_value) / Number(row.proxy_value)) < 1e-9,
        `${row.composition}: trusted_over_proxy must equal trusted_a2_value / proxy_value`,
      );
    }
    const aziendaRows = rows.filter((row) => row.trusted_grain === "azienda" && row.composition === "hsp_azienda_public_ordinary_days");
    assert.ok(aziendaRows.length > 0);
    assert.ok(aziendaRows.every((row) => row.comparison_status === "year_mismatch"));
  },
);
