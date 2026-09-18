#!/usr/bin/env node
/**
 * Builds the auditable public inpatient-activity proxy table for Pillar A and
 * places it next to the trusted A2 values from the antibiotic workbook.
 *
 * Usage (Node >= 22.18 or 23.6, for unflagged TypeScript type stripping; run from any directory):
 *   node scripts/build_pillar_a_activity_proxy.mjs
 *
 * Outputs (data/derived/pillar_a/):
 *   public_activity_proxy_components.csv      long-format component table
 *   public_activity_proxy_manifest.json       source hashes, counts, warnings
 *   a2_public_proxy_calibration.csv           trusted A2 vs proxy, per case
 *   a2_public_proxy_calibration_summary.json  per-composition evidence summary
 *
 * Nothing here is A2. Suppressed cells stay null. No value is imputed.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

import {
  A2_SELECTOR_DESCRIPTION_VERBATIM,
  PUBLIC_ACTIVITY_PROXY_COMPOSITIONS,
  PUBLIC_ACTIVITY_PROXY_LABEL,
  compareTrustedActivityWithProxy,
  isReservedExactDenominatorLabel,
  parseItalianNumber,
  resolveRegionCode,
  summarizeCalibrationEvidence,
} from "../lib/analytics/pillar-a-activity-proxy.ts";

const SCRIPT_VERSION = "2026-09-18.1";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MINISTRY = "data/raw/denominators/ministry";
const OUT_DIR = path.join(ROOT, "data/derived/pillar_a");

const SOURCES = {
  hsp2022: {
    id: "hospital_structure_activity_2022",
    file: `${MINISTRY}/hospital_structure_activity_2022.csv`,
    encoding: "latin1",
    quotedLines: false,
    year: 2022,
    official:
      "https://www.dati.salute.gov.it/it/dataset/dati-di-struttura-e-di-attivita-dei-reparti-presenti-ciascuna-struttura-di-ricovero/",
  },
  beds2023: {
    id: "beds_2023",
    file: `${MINISTRY}/beds_2023.csv`,
    encoding: "latin1",
    quotedLines: false,
    year: 2023,
    official: "https://www.dati.salute.gov.it/it/dataset/posti-letto-struttura-ospedaliera-2023/",
  },
  dischargeTypes2022: {
    id: "discharges_by_institute_2022",
    file: `${MINISTRY}/discharges_by_institute.csv`,
    encoding: "utf8",
    quotedLines: true,
    year: 2022,
    official:
      "https://www.dati.salute.gov.it/it/dataset/dimissioni-ospedaliere-istituto-e-tipologia-di-dimissione/",
  },
  sdoAgeSex2022: {
    id: "sdo_discharges_age_sex_2022",
    file: `${MINISTRY}/sdo_discharges_age_sex_2022.csv`,
    encoding: "utf8",
    quotedLines: true,
    year: 2022,
    official: "https://www.dati.salute.gov.it/",
  },
  aslActivity2022: {
    id: "asl_structures_activity_2022",
    file: `${MINISTRY}/asl_structures_activity.csv`,
    encoding: "latin1",
    quotedLines: false,
    year: 2022,
    official: "https://www.dati.salute.gov.it/it/dataset/strutture-e-attivita-asl/",
  },
  aslRegistry: {
    id: "asl_registry_2010_2026",
    file: `${MINISTRY}/asl_registry_2010_2026.csv`,
    encoding: "latin1",
    quotedLines: false,
    year: null,
    official: "https://www.dati.salute.gov.it/",
  },
  aoRegistry: {
    id: "ao_aou_irccs_registry_2010_2022",
    file: `${MINISTRY}/ao_aou_irccs_registry_2010_2022.csv`,
    encoding: "latin1",
    quotedLines: false,
    year: null,
    official:
      "https://www.dati.salute.gov.it/it/dataset/aziende-ospedaliere-aziende-ospedaliere-universitarie-e-irccs-pubblici-anche-costituiti/",
  },
  sdoCap2: {
    id: "sdo_report_2024_cap2",
    file: `${MINISTRY}/sdo_reports/2024/Cap2_2024.xlsx`,
    year: 2024,
    official:
      "https://www.salute.gov.it/new/it/tema/assistenza-ospedaliera/rapporti-annuali-sui-ricoveri-ospedalieri/",
  },
  sdoCap6: {
    id: "sdo_report_2024_cap6",
    file: `${MINISTRY}/sdo_reports/2024/Cap6_2024.xlsx`,
    year: 2024,
    official:
      "https://www.salute.gov.it/new/it/tema/assistenza-ospedaliera/rapporti-annuali-sui-ricoveri-ospedalieri/",
  },
  sdoCap8: {
    id: "sdo_report_2024_cap8",
    file: `${MINISTRY}/sdo_reports/2024/Cap8_2024.xlsx`,
    year: 2024,
    official:
      "https://www.salute.gov.it/new/it/tema/assistenza-ospedaliera/rapporti-annuali-sui-ricoveri-ospedalieri/",
  },
  trusted: {
    id: "pillar_a_inputs_workbook_extract",
    file: "tmp/pillar_a_inputs.json",
    year: null,
    official: "Dati_Analisi_v02 (1).xlsm (SHA-256 3DCF691A…12B7B, see docs/PILLAR_A_SOURCE_AUDIT.md)",
  },
};

/**
 * Region attribution of the trusted workbook cases. The workbook extract does
 * not carry a region code; the attribution is verified at runtime against the
 * ASL registry and the regional sum identity before any comparison is made.
 */
const TRUSTED_CASE_REGION = {
  regionCode: "130",
  regionalTotalAziendaCode: "130",
  aziendaCodes: ["201", "202", "203", "204"],
  evidence:
    "docs/PILLAR_A_WORKBOOK_RECONCILIATION.md names the actual side Abruzzo; asl_registry_2010_2026.csv lists 201-204 under region 130; the workbook row 130 equals the sum of 201-204 in every year.",
};

const COLUMNS = [
  "proxy_label",
  "source_id",
  "source_file",
  "source_sha256",
  "source_year",
  "source_locator",
  "grain",
  "region_code",
  "region_name",
  "azienda_code",
  "organization_code",
  "azienda_name",
  "azienda_attribution_basis",
  "territorial_asl_code",
  "facility_code",
  "source_entity_code",
  "facility_name",
  "facility_type_code",
  "facility_type",
  "institute_scope",
  "activity_type",
  "regime",
  "activity_component",
  "dimension",
  "value",
  "unit",
  "suppression_flag",
  "null_reason",
  "proxy_status",
  "confidence_status",
  "notes",
];

const warnings = [];
const rows = [];
const hashes = new Map();

function warn(message) {
  warnings.push(message);
  console.warn(`WARN ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

async function sha256(relative) {
  if (hashes.has(relative)) return hashes.get(relative);
  const digest = createHash("sha256")
    .update(await readFile(path.join(ROOT, relative)))
    .digest("hex");
  hashes.set(relative, digest);
  return digest;
}

function clean(value) {
  return value === undefined || value === null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function parseDelimited(text, quotedLines) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines.map((line) => {
    let body = line;
    if (quotedLines) {
      if (body.startsWith('"') && body.endsWith('"')) body = body.slice(1, -1);
      body = body.replace(/""/g, '"');
    }
    return body.split(";").map((field) => {
      const trimmed = field.trim();
      const unquoted =
        trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
          ? trimmed.slice(1, -1)
          : trimmed;
      return unquoted.replace(/""/g, '"').trim();
    });
  });
}

async function readCsv(source) {
  const text = await readFile(path.join(ROOT, source.file), source.encoding);
  const table = parseDelimited(text, source.quotedLines);
  const header = table[0];
  return {
    header,
    records: table
      .slice(1)
      .filter((fields) => fields.some((field) => field !== ""))
      .map((fields) => {
        const record = {};
        header.forEach((name, index) => {
          record[name] = fields[index] ?? "";
        });
        return record;
      }),
  };
}

function emit(partial) {
  if (isReservedExactDenominatorLabel(partial.activity_component ?? "")) {
    fail(`activity_component "${partial.activity_component}" would misrepresent a proxy as A2.`);
  }
  const row = {
    proxy_label: PUBLIC_ACTIVITY_PROXY_LABEL,
    source_id: null,
    source_file: null,
    source_sha256: null,
    source_year: null,
    source_locator: null,
    grain: null,
    region_code: null,
    region_name: null,
    azienda_code: null,
    organization_code: null,
    azienda_name: null,
    azienda_attribution_basis: null,
    territorial_asl_code: null,
    facility_code: null,
    source_entity_code: null,
    facility_name: null,
    facility_type_code: null,
    facility_type: null,
    institute_scope: null,
    activity_type: null,
    regime: null,
    activity_component: null,
    dimension: null,
    value: null,
    unit: null,
    suppression_flag: false,
    null_reason: null,
    proxy_status: null,
    confidence_status: null,
    notes: null,
    ...partial,
  };
  if (row.region_code && row.azienda_code && !row.organization_code) {
    row.organization_code = `${row.region_code}${row.azienda_code}`;
  }
  if (row.value === null && !row.null_reason) row.null_reason = "no_value_in_source";
  rows.push(row);
  return row;
}

function applyParsed(parsed, target) {
  if (parsed.status === "value") {
    target.value = parsed.value;
    return target;
  }
  target.value = null;
  if (parsed.status === "suppressed") {
    target.suppression_flag = true;
    target.null_reason = "suppressed_by_source_privacy_rule";
    target.proxy_status = "suppressed";
    target.confidence_status = "SUPPRESSED";
  } else if (parsed.status === "blank") {
    target.null_reason = parsed.raw === "-" ? "dash_in_source" : "blank_in_source";
    target.proxy_status = "unavailable";
    target.confidence_status = "UNAVAILABLE";
  } else {
    target.null_reason = `unparseable_value:${parsed.raw}`;
    target.proxy_status = "unavailable";
    target.confidence_status = "UNAVAILABLE";
    warn(`Unparseable value "${parsed.raw}" (${target.source_id} ${target.source_locator}).`);
  }
  return target;
}

function csvField(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "boolean" ? String(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(columns, records) {
  const lines = [columns.join(",")];
  for (const record of records) lines.push(columns.map((column) => csvField(record[column])).join(","));
  return `${lines.join("\n")}\n`;
}

function cellText(cell) {
  const value = cell?.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (value.richText) return clean(value.richText.map((part) => part.text).join(""));
    if ("result" in value) return clean(value.result);
    return clean(JSON.stringify(value));
  }
  return clean(value);
}

function cellNumber(cell) {
  const value = cell?.value;
  if (typeof value === "object" && value !== null && "result" in value) return parseItalianNumber(value.result);
  return parseItalianNumber(value);
}

// ---------------------------------------------------------------------------
// Registries
// ---------------------------------------------------------------------------

async function loadRegistries() {
  const asl = await readCsv(SOURCES.aslRegistry);
  const regionRegistry = [];
  const regionNames = new Map();
  const aslByYear = new Map(); // `${year}|${region}|${azienda}` -> name
  for (const record of asl.records) {
    const code = record["CODICE REGIONE"];
    const name = clean(record["DENOMINAZIONE REGIONE"]);
    if (code && name && !regionNames.has(code)) {
      regionNames.set(code, name);
      regionRegistry.push({ code, name });
    }
    aslByYear.set(
      `${record.ANNO}|${code}|${record["CODICE AZIENDA"]}`,
      clean(record["DENOMINAZIONE AZIENDA"]),
    );
  }
  const ao = await readCsv(SOURCES.aoRegistry);
  const aoByFacility = new Map(); // facility code -> { azienda, name, year }
  for (const record of ao.records) {
    if (record.Anno !== "2022") continue;
    aoByFacility.set(record["Codice struttura"], {
      azienda: record["Codice Azienda"],
      name: clean(record["Denominazione struttura"]),
    });
  }
  return { regionRegistry, regionNames, aslByYear, aoByFacility };
}

// ---------------------------------------------------------------------------
// Ministry CSV sources
// ---------------------------------------------------------------------------

const HSP_COMPONENTS = [
  ["giornate_degenza", "ordinary_regime_days", "days", "ordinary", "observed_activity"],
  ["num_dimessi", "discharges", "discharges", "ordinary", "observed_activity"],
  ["giornate_disponibili", "available_bed_days", "bed_days", "ordinary", "capacity"],
  ["posti_letto_degenza_ordinaria", "beds_ordinary", "beds", "ordinary", "capacity"],
  ["posti_letto_day_hospital", "beds_day_hospital", "beds", "day", "capacity"],
  ["posti_letto_day_surgery", "beds_day_surgery", "beds", "day", "capacity"],
  ["posti_letto_utilizzati", "beds_used", "beds", "ordinary", "capacity"],
];

function newCellIssues() {
  return { suppressed: 0, blank: 0, invalid: 0 };
}

function recordCellIssue(issues, parsed) {
  if (parsed.status === "suppressed") issues.suppressed += 1;
  else if (parsed.status === "blank") issues.blank += 1;
  else issues.invalid += 1;
}

function addCellIssues(target, source) {
  target.suppressed += source.suppressed;
  target.blank += source.blank;
  target.invalid += source.invalid;
}

function aggregateState(issues, sum, kind) {
  const bad = issues.suppressed + issues.blank + issues.invalid;
  if (bad === 0) {
    return {
      value: sum,
      suppression_flag: false,
      null_reason: null,
      proxy_status: kind === "capacity" ? "capacity_not_activity" : "derived_aggregate",
      confidence_status: "DERIVED",
    };
  }
  return {
    value: null,
    suppression_flag: issues.suppressed > 0,
    null_reason: `cells_suppressed=${issues.suppressed};cells_blank=${issues.blank};cells_invalid=${issues.invalid}`,
    proxy_status: issues.suppressed > 0 ? "suppressed" : "unavailable",
    confidence_status: issues.suppressed > 0 ? "SUPPRESSED" : "UNAVAILABLE",
  };
}

// Lombardy's ASSTs are coded tipo 1 under their ATS in the HSP file but are
// Aziende in the AO/AOU/IRCCS registry, so the registry wins over codice_asl.
function attributeHspFacility(record, registries) {
  const tipo = record.codice_tipo_struttura;
  const owner = registries.aoByFacility.get(record.codice_struttura);
  if (owner) {
    return {
      azienda: owner.azienda,
      name: owner.name,
      basis:
        tipo === "1" || tipo === "8"
          ? "owning_azienda_ao_aou_irccs_registry_2022_over_codice_asl"
          : "owning_azienda_ao_aou_irccs_registry_2022",
    };
  }
  if (tipo === "1" || tipo === "8") {
    return {
      azienda: record.codice_asl,
      name: clean(record.asl),
      basis: "asl_presidio_codice_asl",
    };
  }
  if (tipo === "0" || tipo === "2" || tipo === "3") {
    return { azienda: null, name: null, basis: "private_or_unlisted_not_an_azienda" };
  }
  return { azienda: null, name: null, basis: "classified_or_research_institute_not_an_azienda" };
}

async function loadHospitalStructureActivity(registries) {
  const source = SOURCES.hsp2022;
  const digest = await sha256(source.file);
  const { records } = await readCsv(source);
  const facilities = new Map();
  let wardRows = 0;
  for (const record of records) {
    if (record.anno !== "2022") {
      warn(`${source.id}: unexpected anno "${record.anno}" skipped.`);
      continue;
    }
    wardRows += 1;
    const key = record.codice_struttura;
    if (!facilities.has(key)) {
      facilities.set(key, {
        region: record.codice_regione,
        regionName: clean(record.regione),
        asl: record.codice_asl,
        aslName: clean(record.asl),
        code: key,
        name: clean(record.struttura),
        typeCode: record.codice_tipo_struttura,
        type: clean(record.tipo_struttura),
        wardRows: 0,
        sums: Object.fromEntries(HSP_COMPONENTS.map(([column]) => [column, 0])),
        issues: Object.fromEntries(HSP_COMPONENTS.map(([column]) => [column, newCellIssues()])),
        attribution: attributeHspFacility(record, registries),
      });
    }
    const facility = facilities.get(key);
    facility.wardRows += 1;
    for (const [column] of HSP_COMPONENTS) {
      const parsed = parseItalianNumber(record[column]);
      if (parsed.status === "value") facility.sums[column] += parsed.value;
      else recordCellIssue(facility.issues[column], parsed);
    }
  }

  const aziende = new Map();
  for (const facility of facilities.values()) {
    const base = {
      source_id: source.id,
      source_file: source.file,
      source_sha256: digest,
      source_year: source.year,
      source_locator: `codice_struttura=${facility.code};ward_rows=${facility.wardRows}`,
      grain: "facility",
      region_code: facility.region,
      region_name: facility.regionName,
      azienda_code: facility.attribution.azienda,
      azienda_name: facility.attribution.name,
      azienda_attribution_basis: facility.attribution.basis,
      territorial_asl_code: facility.asl,
      facility_code: facility.code,
      source_entity_code: facility.code,
      facility_name: facility.name,
      facility_type_code: facility.typeCode,
      facility_type: facility.type,
      institute_scope: "public_and_equiparati_presidi_only",
    };
    for (const [column, component, unit, regime, kind] of HSP_COMPONENTS) {
      emit({
        ...base,
        activity_type: "all_disciplines",
        regime,
        activity_component: component,
        unit,
        ...aggregateState(facility.issues[column], facility.sums[column], kind),
        notes: "Sum over ward (disciplina) rows of the facility; wards themselves are below the approved granularity and are not emitted. num_dimessi is ordinary-regime: giornate_degenza / num_dimessi reproduces degenza_media_ordinaria on every ward row.",
      });
    }
    if (facility.attribution.azienda) {
      const key = `${facility.region}|${facility.attribution.azienda}`;
      if (!aziende.has(key)) {
        aziende.set(key, {
          region: facility.region,
          regionName: facility.regionName,
          azienda: facility.attribution.azienda,
          name: facility.attribution.name,
          bases: new Set(),
          facilities: 0,
          sums: Object.fromEntries(HSP_COMPONENTS.map(([column]) => [column, 0])),
          issues: Object.fromEntries(HSP_COMPONENTS.map(([column]) => [column, newCellIssues()])),
        });
      }
      const azienda = aziende.get(key);
      azienda.facilities += 1;
      azienda.bases.add(facility.attribution.basis);
      for (const [column] of HSP_COMPONENTS) {
        azienda.sums[column] += facility.sums[column];
        addCellIssues(azienda.issues[column], facility.issues[column]);
      }
    }
  }

  const aziendaOrdinaryDays = new Map(); // `${region}|${azienda}` -> value
  for (const azienda of aziende.values()) {
    for (const [column, component, unit, regime, kind] of HSP_COMPONENTS) {
      const state = aggregateState(azienda.issues[column], azienda.sums[column], kind);
      emit({
        source_id: source.id,
        source_file: source.file,
        source_sha256: digest,
        source_year: source.year,
        source_locator: `codice_regione=${azienda.region};codice_asl_or_azienda=${azienda.azienda};facilities=${azienda.facilities}`,
        grain: "azienda",
        region_code: azienda.region,
        region_name: azienda.regionName,
        azienda_code: azienda.azienda,
        azienda_name: azienda.name,
        azienda_attribution_basis: `sum_over_attributed_facilities:${[...azienda.bases].join("+")}`,
        institute_scope: "public_and_equiparati_presidi_only",
        activity_type: "all_disciplines",
        regime,
        activity_component: component,
        unit,
        ...state,
        notes: "Azienda total of public/equiparati presidi attributed to this Azienda. Private accredited facilities are absent from this source.",
      });
      if (component === "ordinary_regime_days" && state.value !== null) {
        aziendaOrdinaryDays.set(`${azienda.region}|${azienda.azienda}`, azienda.sums[column]);
      }
    }
  }

  return {
    wardRows,
    facilities,
    aziende: aziende.size,
    aziendaOrdinaryDays,
    unattributedFacilities: [...facilities.values()].filter((f) => !f.attribution.azienda).length,
    registryOverCodiceAsl: [...facilities.values()].filter((f) =>
      f.attribution.basis.endsWith("_over_codice_asl"),
    ).length,
  };
}

const BEDS_COMPONENTS = [
  ["Posti letto degenza ordinaria", "beds_ordinary", "ordinary"],
  ["Posti letto degenza a pagamento", "beds_paying", "ordinary"],
  ["Posti letto Day Hospital", "beds_day_hospital", "day"],
  ["Posti letto Day Surgery", "beds_day_surgery", "day"],
  ["Totale posti letto", "beds_total", "ordinary_and_day"],
];

async function loadBeds(registries) {
  const source = SOURCES.beds2023;
  const digest = await sha256(source.file);
  const { records } = await readCsv(source);
  const facilityIndex = new Map();
  const aziendaTotals = new Map();
  for (const record of records) {
    if (record.Anno !== "2023") {
      warn(`${source.id}: unexpected Anno "${record.Anno}" skipped.`);
      continue;
    }
    const tipoAzienda = record["Tipo Azienda"];
    const basis =
      tipoAzienda === "1"
        ? "territorial_asl_per_source_codice_azienda"
        : tipoAzienda === "2"
          ? "owning_azienda_per_source_codice_azienda"
          : `unknown_tipo_azienda_${tipoAzienda}`;
    const facilityCode = record["Codice struttura"];
    if (!facilityIndex.has(facilityCode)) {
      facilityIndex.set(facilityCode, {
        region: record["Codice Regione"],
        azienda: record["Codice Azienda"],
        basis,
        name: clean(record["Denominazione struttura"]),
        typeCode: record["Codice tipo struttura"],
        type: clean(record["Descrizione tipo struttura"]),
      });
    }
    const aziendaName =
      registries.aslByYear.get(`2023|${record["Codice Regione"]}|${record["Codice Azienda"]}`) ?? null;
    for (const [column, component, regime] of BEDS_COMPONENTS) {
      const parsed = parseItalianNumber(record[column]);
      const row = emit(
        applyParsed(parsed, {
          source_id: source.id,
          source_file: source.file,
          source_sha256: digest,
          source_year: source.year,
          source_locator: `codice_struttura=${facilityCode};tipo_disciplina=${record["Tipo di Disciplina"]}`,
          grain: "facility",
          region_code: record["Codice Regione"],
          region_name: registries.regionNames.get(record["Codice Regione"]) ?? clean(record["Descrizione Regione"]),
          azienda_code: record["Codice Azienda"],
          azienda_name: aziendaName,
          azienda_attribution_basis: basis,
          territorial_asl_code: tipoAzienda === "1" ? record["Codice Azienda"] : null,
          facility_code: facilityCode,
          source_entity_code: facilityCode,
          facility_name: clean(record["Denominazione struttura"]),
          facility_type_code: record["Codice tipo struttura"],
          facility_type: clean(record["Descrizione tipo struttura"]),
          institute_scope: "public_and_private_accredited",
          activity_type: clean(record["Tipo di Disciplina"]).toLowerCase(),
          regime,
          activity_component: component,
          dimension: `discipline_type=${clean(record["Tipo di Disciplina"])}`,
          unit: "beds",
          proxy_status: "capacity_not_activity",
          confidence_status: "VERIFIED-SOURCE",
          notes: "Bed capacity is not activity and is never a substitute for DEGENZA or ACCESSI.",
        }),
      );
      if (component === "beds_total") {
        const key = `${record["Codice Regione"]}|${record["Codice Azienda"]}`;
        const entry = aziendaTotals.get(key) ?? {
          region: record["Codice Regione"],
          azienda: record["Codice Azienda"],
          name: aziendaName,
          basis,
          total: 0,
          nullCells: 0,
          suppressedCells: 0,
          facilities: new Set(),
        };
        if (row.value === null) {
          entry.nullCells += 1;
          if (row.suppression_flag) entry.suppressedCells += 1;
        } else {
          entry.total += row.value;
        }
        entry.facilities.add(facilityCode);
        aziendaTotals.set(key, entry);
      }
    }
  }
  for (const entry of aziendaTotals.values()) {
    emit({
      source_id: source.id,
      source_file: source.file,
      source_sha256: digest,
      source_year: source.year,
      source_locator: `codice_regione=${entry.region};codice_azienda=${entry.azienda};facilities=${entry.facilities.size}`,
      grain: "azienda",
      region_code: entry.region,
      region_name: registries.regionNames.get(entry.region) ?? null,
      azienda_code: entry.azienda,
      azienda_name: entry.name,
      azienda_attribution_basis: entry.basis,
      institute_scope: "public_and_private_accredited",
      activity_type: "all_discipline_types",
      regime: "ordinary_and_day",
      activity_component: "beds_total",
      value: entry.nullCells > 0 ? null : entry.total,
      unit: "beds",
      suppression_flag: entry.suppressedCells > 0,
      null_reason:
        entry.nullCells > 0
          ? `facility_cells_null=${entry.nullCells};facility_cells_suppressed=${entry.suppressedCells}`
          : null,
      proxy_status:
        entry.suppressedCells > 0
          ? "suppressed"
          : entry.nullCells > 0
            ? "unavailable"
            : "capacity_not_activity",
      confidence_status:
        entry.suppressedCells > 0 ? "SUPPRESSED" : entry.nullCells > 0 ? "UNAVAILABLE" : "DERIVED",
      notes: "Sum of Totale posti letto over facilities carrying this Codice Azienda (private accredited facilities are attributed to their territorial ASL by the source).",
    });
  }
  return { facilityIndex, records: records.length };
}

// The Ministry repeats an institute code with the name "DATO ERRATO" to flag
// an erroneous record; such rows are kept visible but never carry a value.
function isDatoErrato(record) {
  return clean(record["Denominazione Istituto"]).toUpperCase() === "DATO ERRATO";
}

function withDatoErrato(flagged, row) {
  if (!flagged) return row;
  row.value = null;
  row.suppression_flag = false;
  row.null_reason = "source_row_flagged_dato_errato";
  row.proxy_status = "unavailable";
  row.confidence_status = "UNAVAILABLE";
  return row;
}

function attributeEightDigitInstitute(code, hsp, beds) {
  const facilityCode = code.slice(0, 6);
  const fromHsp = hsp.facilities.get(facilityCode);
  if (fromHsp) {
    return {
      facilityCode,
      region: fromHsp.region,
      regionName: fromHsp.regionName,
      azienda: fromHsp.attribution.azienda,
      aziendaName: fromHsp.attribution.name,
      basis: `${fromHsp.attribution.basis}_via_hsp_2022`,
      territorialAsl: fromHsp.asl,
      typeCode: fromHsp.typeCode,
      type: fromHsp.type,
    };
  }
  const fromBeds = beds.facilityIndex.get(facilityCode);
  if (fromBeds) {
    return {
      facilityCode,
      region: fromBeds.region,
      regionName: null,
      azienda: fromBeds.azienda,
      aziendaName: null,
      basis: `${fromBeds.basis}_via_beds_2023`,
      territorialAsl: fromBeds.basis.startsWith("territorial") ? fromBeds.azienda : null,
      typeCode: fromBeds.typeCode,
      type: fromBeds.type,
    };
  }
  return {
    facilityCode,
    region: code.slice(0, 3),
    regionName: null,
    azienda: null,
    aziendaName: null,
    basis: "facility_not_in_staged_registries",
    territorialAsl: null,
    typeCode: null,
    type: null,
  };
}

async function loadDischargeTypes(hsp, beds, registries) {
  const source = SOURCES.dischargeTypes2022;
  const digest = await sha256(source.file);
  const { records } = await readCsv(source);
  const components = [
    ["Num decessi", "discharges_deceased"],
    ["Num dimissioni a domicilio", "discharges_home"],
    ["Num dimissioni verso altra struttura", "discharges_transferred"],
  ];
  let suppressed = 0;
  let datoErrato = 0;
  for (const record of records) {
    const code = record["Codice Istituto"];
    const attribution = attributeEightDigitInstitute(code, hsp, beds);
    const flagged = isDatoErrato(record);
    if (flagged) datoErrato += 1;
    for (const [column, component] of components) {
      const parsed = parseItalianNumber(record[column]);
      if (parsed.status === "suppressed" && !flagged) suppressed += 1;
      emit(
        withDatoErrato(flagged, applyParsed(parsed, {
          source_id: source.id,
          source_file: source.file,
          source_sha256: digest,
          source_year: Number(record["Anno di dimissione"]) || source.year,
          source_locator: `codice_istituto=${code}${flagged ? ";flag=DATO_ERRATO" : ""}`,
          grain: "facility",
          region_code: attribution.region,
          region_name: registries.regionNames.get(attribution.region) ?? attribution.regionName,
          azienda_code: attribution.azienda,
          azienda_name: attribution.aziendaName,
          azienda_attribution_basis: attribution.basis,
          territorial_asl_code: attribution.territorialAsl,
          facility_code: attribution.facilityCode,
          source_entity_code: code,
          facility_name: clean(record["Denominazione Istituto"]),
          facility_type_code: attribution.typeCode,
          facility_type: attribution.type,
          institute_scope: "all_sdo_reporting_institutes",
          activity_type: "all_activity_types",
          regime: "not_stated",
          activity_component: component,
          dimension: `discharge_type=${column}`,
          unit: "discharges",
          proxy_status: "observed_public",
          confidence_status: "VERIFIED-SOURCE",
          notes: "Eight-digit institute code; the first six digits are the HSP facility code, the last two the sub-institute.",
        })),
      );
    }
  }
  return { records: records.length, suppressed, datoErrato };
}

async function loadSdoAgeSex(hsp, beds, registries) {
  const source = SOURCES.sdoAgeSex2022;
  const digest = await sha256(source.file);
  const { header, records } = await readCsv(source);
  const ageColumns = header.filter((name) => name.startsWith("Cl_et"));
  let suppressedCells = 0;
  let datoErrato = 0;
  for (const record of records) {
    const code = record["Codice Istituto"];
    const attribution = attributeEightDigitInstitute(code, hsp, beds);
    const flagged = isDatoErrato(record);
    if (flagged) datoErrato += 1;
    let total = 0;
    let suppressed = 0;
    let invalid = 0;
    for (const column of ageColumns) {
      const parsed = parseItalianNumber(record[column]);
      if (parsed.status === "value") total += parsed.value;
      else if (parsed.status === "suppressed") suppressed += 1;
      else invalid += 1;
    }
    if (!flagged) suppressedCells += suppressed;
    const unavailable = suppressed > 0 || invalid > 0;
    emit(withDatoErrato(flagged, {
      source_id: source.id,
      source_file: source.file,
      source_sha256: digest,
      source_year: Number(record["Anno di dimissione"]) || source.year,
      source_locator: `codice_istituto=${code};sesso=${record["Descrizione Sesso"]}${flagged ? ";flag=DATO_ERRATO" : ""}`,
      grain: "facility",
      region_code: attribution.region,
      region_name: registries.regionNames.get(attribution.region) ?? attribution.regionName,
      azienda_code: attribution.azienda,
      azienda_name: attribution.aziendaName,
      azienda_attribution_basis: attribution.basis,
      territorial_asl_code: attribution.territorialAsl,
      facility_code: attribution.facilityCode,
      source_entity_code: code,
      facility_name: clean(record["Denominazione Istituto"]),
      facility_type_code: attribution.typeCode,
      facility_type: attribution.type,
      institute_scope: "all_sdo_reporting_institutes",
      activity_type: "all_activity_types",
      regime: "not_stated",
      activity_component: "discharges",
      dimension: `sex=${record["Descrizione Sesso"]};age_classes=${ageColumns.length}`,
      value: unavailable ? null : total,
      unit: "discharges",
      suppression_flag: suppressed > 0,
      null_reason: unavailable
        ? `age_cells_suppressed=${suppressed};age_cells_invalid=${invalid}`
        : null,
      proxy_status: suppressed > 0 ? "suppressed" : invalid > 0 ? "unavailable" : "derived_aggregate",
      confidence_status: suppressed > 0 ? "SUPPRESSED" : invalid > 0 ? "UNAVAILABLE" : "DERIVED",
      notes: "Sum over age classes; left null whenever any age cell is suppressed (***) because a partial sum would understate the true count.",
    }));
  }
  return { records: records.length, suppressedCells, datoErrato };
}

async function loadAslActivity(registries) {
  const source = SOURCES.aslActivity2022;
  const digest = await sha256(source.file);
  const { records } = await readCsv(source);
  for (const record of records) {
    const region = record["Codice Regione"];
    const azienda = record["Codice Azienda Sanitaria Locale"];
    emit(
      applyParsed(parseItalianNumber(record["Totale Residenti"]), {
        source_id: source.id,
        source_file: source.file,
        source_sha256: digest,
        source_year: Number(record["Anno di Riferimento"]) || source.year,
        source_locator: `codice_regione=${region};codice_asl=${azienda}`,
        grain: "azienda",
        region_code: region,
        region_name: registries.regionNames.get(region) ?? clean(record["Regione"]),
        azienda_code: azienda,
        azienda_name: clean(record["Denominazione ASL"]),
        azienda_attribution_basis: "asl_per_source",
        territorial_asl_code: azienda,
        institute_scope: "not_applicable_population",
        activity_type: "population_context",
        regime: "not_applicable",
        activity_component: "residents_total",
        unit: "persons",
        proxy_status: "observed_public",
        confidence_status: "VERIFIED-SOURCE",
        notes: "Resident population of the ASL territory; context only, not an inpatient activity measure and not the workbook's weighted population.",
      }),
    );
  }
  return { records: records.length };
}

// ---------------------------------------------------------------------------
// SDO 2024 report workbooks
// ---------------------------------------------------------------------------

function regionRowsOf(worksheet, firstDataRow) {
  const out = [];
  for (let r = firstDataRow; r <= worksheet.rowCount; r += 1) {
    const name = cellText(worksheet.getRow(r).getCell(1));
    if (!name) continue;
    if (/^(fonte|la voce|nota|\(|sono stati)/i.test(name)) break;
    out.push({ rowNumber: r, name, isNational: /^italia$/i.test(name) });
    if (/^italia$/i.test(name)) break;
  }
  return out;
}

function regionRowsChecked(source, worksheet, firstDataRow, registries) {
  const rows = regionRowsOf(worksheet, firstDataRow);
  const seen = new Set();
  for (const row of rows) {
    if (row.isNational) continue;
    const resolved = resolveRegionCode(row.name, registries.regionRegistry);
    if (resolved.status === "matched") seen.add(resolved.code);
  }
  for (const entry of registries.regionRegistry) {
    if (!seen.has(entry.code)) {
      warn(
        `${source.id} ${worksheet.name}: region ${entry.code} (${entry.name}) has no row in this table; nothing is emitted for it.`,
      );
    }
  }
  return rows;
}

function sdoBase(source, digest, worksheet, regionRow, registries) {
  const isNational = regionRow.isNational;
  let regionCode = null;
  let regionName = regionRow.name;
  if (!isNational) {
    const resolved = resolveRegionCode(regionRow.name, registries.regionRegistry);
    if (resolved.status === "matched") {
      regionCode = resolved.code;
      regionName = resolved.registryName;
    } else {
      warn(`${source.id} ${worksheet.name}: region "${regionRow.name}" ${resolved.status}; kept without code.`);
    }
  }
  return {
    source_id: source.id,
    source_file: source.file,
    source_sha256: digest,
    source_year: source.year,
    grain: isNational ? "national" : "region",
    region_code: regionCode,
    region_name: isNational ? "ITALIA" : regionName,
    institute_scope: "all_sdo_reporting_institutes",
    proxy_status: "observed_public",
    confidence_status: "VERIFIED-SOURCE",
  };
}

function emitSdoCell(base, worksheet, rowNumber, column, fields) {
  const cell = worksheet.getRow(rowNumber).getCell(column);
  const locator = `${worksheet.name}!${cell.address}`;
  return emit(applyParsed(cellNumber(cell), { ...base, source_locator: locator, ...fields }));
}

const T216_COLUMNS = [
  [2, "acute", "ordinary", "acute_ordinary_regime_days", "days"],
  [4, "acute", "day", "acute_day_regime_accesses", "accesses"],
  [6, "acute", "ordinary_and_day", "acute_days_plus_accesses", "days_plus_accesses"],
  [8, "rehabilitation", "ordinary", "rehab_ordinary_regime_days", "days"],
  [10, "rehabilitation", "day", "rehab_day_regime_accesses", "accesses"],
  [12, "rehabilitation", "ordinary_and_day", "rehab_days_plus_accesses", "days_plus_accesses"],
  [14, "long_term", "ordinary_and_day", "long_term_days", "days"],
];

const T215_COLUMNS = [
  [2, "acute", "ordinary", "acute_ordinary_regime_discharges"],
  [4, "acute", "day", "acute_day_regime_discharges"],
  [6, "acute", "ordinary_and_day", "acute_discharges"],
  [8, "rehabilitation", "ordinary", "rehab_ordinary_regime_discharges"],
  [10, "rehabilitation", "day", "rehab_day_regime_discharges"],
  [12, "rehabilitation", "ordinary_and_day", "rehab_discharges"],
  [14, "long_term", "ordinary_and_day", "long_term_discharges"],
];

async function loadSdoCap2(registries) {
  const source = SOURCES.sdoCap2;
  const digest = await sha256(source.file);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(ROOT, source.file));
  const regionValues = new Map(); // regionCode -> { component -> value }

  const t216 = workbook.getWorksheet("Tavola 2.1.6");
  if (!t216) fail("Tavola 2.1.6 not found in Cap2_2024.xlsx");
  for (const regionRow of regionRowsChecked(source, t216, 7, registries)) {
    const base = sdoBase(source, digest, t216, regionRow, registries);
    const row = t216.getRow(regionRow.rowNumber);
    const b = cellNumber(row.getCell(2));
    const c = cellNumber(row.getCell(3));
    const f = cellNumber(row.getCell(6));
    let headerCheck = "header_check=not_evaluated";
    if (b.status === "value" && c.status === "value" && f.status === "value" && f.value !== 0) {
      const gap = Math.abs((b.value / f.value) * 100 - c.value);
      headerCheck = gap < 1e-6 ? "header_check=passed" : `header_check=failed_gap_${gap}`;
      if (gap >= 1e-6) warn(`Tavola 2.1.6 row ${regionRow.rowNumber}: % column does not equal B/F.`);
    }
    for (const [column, activityType, regime, component, unit] of T216_COLUMNS) {
      const emitted = emitSdoCell(base, t216, regionRow.rowNumber, column, {
        activity_type: activityType,
        regime,
        activity_component: component,
        unit,
        notes: `Row 5 labels columns C/E/G/I/K/M as "Accessi"/"%" inconsistently; column semantics fixed by position and verified numerically (${headerCheck}). Nido (DRG 391) is a separate activity line in this report, so acute figures exclude healthy newborns. Lungodegenza combines ordinary and day regime per source footnote.`,
      });
      if (base.region_code && emitted.value !== null) {
        const bucket = regionValues.get(base.region_code) ?? {};
        bucket[component] = emitted.value;
        regionValues.set(base.region_code, bucket);
      }
    }
  }

  const t215 = workbook.getWorksheet("Tavola 2.1.5");
  if (!t215) fail("Tavola 2.1.5 not found in Cap2_2024.xlsx");
  for (const regionRow of regionRowsChecked(source, t215, 7, registries)) {
    const base = sdoBase(source, digest, t215, regionRow, registries);
    for (const [column, activityType, regime, component] of T215_COLUMNS) {
      emitSdoCell(base, t215, regionRow.rowNumber, column, {
        activity_type: activityType,
        regime,
        activity_component: component,
        unit: "discharges",
        notes: "Nido (DRG 391) is a separate activity line in this report, so acute figures exclude healthy newborns.",
      });
    }
  }

  for (const [sheetName, regime] of [
    ["Tavola 2.2.1", "ordinary"],
    ["Tavola 2.2.2", "day"],
  ]) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) fail(`${sheetName} not found in Cap2_2024.xlsx`);
    const labels = [];
    for (let column = 2; column <= 22; column += 2) labels.push([column, cellText(sheet.getRow(3).getCell(column))]);
    labels.push([24, "Totale"]);
    for (const regionRow of regionRowsChecked(source, sheet, 6, registries)) {
      const base = sdoBase(source, digest, sheet, regionRow, registries);
      for (const [column, label] of labels) {
        emitSdoCell(base, sheet, regionRow.rowNumber, column, {
          institute_scope: "institutes_censused_in_nsis_registry",
          activity_type: "acute",
          regime,
          activity_component: "acute_discharges_by_institute_type",
          dimension: `institute_type=${label}`,
          unit: "discharges",
          notes: "A dash in the source means no institute of that type; it is recorded as null, not zero. Institute-type tables exclude records from institutes not censused in the NSIS facility registry (Tavola 2.1.2 footnote), so their ITALIA totals equal Tavola 2.1.2 and are lower than Tavola 2.1.5/2.1.6.",
        });
      }
    }
  }

  const t212 = workbook.getWorksheet("Tavola 2.1.2");
  if (!t212) fail("Tavola 2.1.2 not found in Cap2_2024.xlsx");
  const t212Rows = [
    [6, "acute", "ordinary", "days"],
    [7, "acute", "day", "accesses"],
    [8, "rehabilitation", "ordinary", "days"],
    [9, "rehabilitation", "day", "accesses"],
    [10, "long_term", "ordinary_and_day", "days"],
    [11, "nido_healthy_newborns_drg_391", "ordinary", "days"],
    [13, "total_including_nido", "all", "days_plus_accesses"],
  ];
  for (const [rowNumber, activityType, regime, volumeUnit] of t212Rows) {
    const label = cellText(t212.getRow(rowNumber).getCell(1));
    for (const [column, scope, measure] of [
      [2, "public_institutes_censused_in_nsis_registry", "discharges"],
      [3, "private_institutes_censused_in_nsis_registry", "discharges"],
      [4, "institutes_censused_in_nsis_registry", "discharges"],
      [5, "public_institutes_censused_in_nsis_registry", "volume"],
      [6, "private_institutes_censused_in_nsis_registry", "volume"],
      [7, "institutes_censused_in_nsis_registry", "volume"],
    ]) {
      emitSdoCell(
        {
          source_id: source.id,
          source_file: source.file,
          source_sha256: digest,
          source_year: source.year,
          grain: "national",
          region_name: "ITALIA",
          institute_scope: scope,
          proxy_status: "observed_public",
          confidence_status: "VERIFIED-SOURCE",
        },
        t212,
        rowNumber,
        column,
        {
          activity_type: activityType,
          regime,
          activity_component: measure === "discharges" ? "discharges" : `days_or_accesses`,
          dimension: `source_row_label=${label}`,
          unit: measure === "discharges" ? "discharges" : volumeUnit,
          notes: "Footnotes: 'Nido' comprises healthy-newborn discharges (DRG 391) in ordinary regime; 'Lungodegenza' combines ordinary and day regime; records from institutes not censused in the NSIS facility registry are excluded, so totals are lower than Tavola 2.1.5/2.1.6.",
        },
      );
    }
  }

  const t211 = workbook.getWorksheet("Tavola 2.1.1");
  if (!t211) fail("Tavola 2.1.1 not found in Cap2_2024.xlsx");
  for (let column = 2; column <= 11; column += 1) {
    const year = cellNumber(t211.getRow(3).getCell(column));
    if (year.status !== "value") continue;
    for (const [rowNumber, component, unit] of [
      [5, "total_discharges_including_nido", "discharges"],
      [6, "total_days_provided_including_nido", "days_plus_accesses"],
    ]) {
      emitSdoCell(
        {
          source_id: source.id,
          source_file: source.file,
          source_sha256: digest,
          source_year: year.value,
          grain: "national",
          region_name: "ITALIA",
          institute_scope: "all_sdo_reporting_institutes",
          proxy_status: "observed_public",
          confidence_status: "VERIFIED-SOURCE",
        },
        t211,
        rowNumber,
        column,
        {
          activity_type: "all_activity_types",
          regime: "all",
          activity_component: component,
          unit,
          notes: "Footnote (1): total hospital admissions including Nido. National trend only; no regional breakdown in this table.",
        },
      );
    }
  }

  return { regionValues };
}

async function loadSdoCap6(registries) {
  const source = SOURCES.sdoCap6;
  const digest = await sha256(source.file);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(ROOT, source.file));
  const onereLabels = [];
  for (const [sheetName, activityType, regime] of [
    ["Tavola 6.22", "acute", "ordinary"],
    ["Tavola 6.23", "acute", "day"],
    ["Tavola 6.24", "rehabilitation", "ordinary"],
    ["Tavola 6.25", "rehabilitation", "day"],
    ["Tavola 6.26", "long_term", "ordinary_and_day"],
  ]) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      warn(`${sheetName} not found in Cap6_2024.xlsx; onere breakdown skipped for ${activityType}/${regime}.`);
      continue;
    }
    const positions = [];
    for (let column = 2; column <= 20; column += 2) {
      const label = cellText(sheet.getRow(3).getCell(column));
      positions.push([column, column / 2, label]);
      if (sheetName === "Tavola 6.22") onereLabels.push({ position: column / 2, label });
    }
    for (const regionRow of regionRowsChecked(source, sheet, 6, registries)) {
      const base = sdoBase(source, digest, sheet, regionRow, registries);
      for (const [column, position, label] of positions) {
        emitSdoCell(base, sheet, regionRow.rowNumber, column, {
          institute_scope: "public_and_private_accredited",
          activity_type: activityType,
          regime,
          activity_component: "discharges_by_onere_della_degenza",
          dimension: `onere_position=${position};label=${label}`,
          unit: "discharges",
          confidence_status: "INFERRED",
          notes: "Position is the column order of the Ministry table, not a verified SDO onere code. Mapping position to the workbook's ONERE \"4\" requires confirmation against the SDO record layout (DM 380/2000 and updates). Footnote: public and private accredited institutes.",
        });
      }
      emitSdoCell(base, sheet, regionRow.rowNumber, 22, {
        institute_scope: "public_and_private_accredited",
        activity_type: activityType,
        regime,
        activity_component: "discharges_all_onere",
        dimension: "onere_position=all",
        unit: "discharges",
        notes: "TOTALE column of the onere table.",
      });
    }
  }
  return { onereLabels };
}

async function loadSdoCap8(registries) {
  const source = SOURCES.sdoCap8;
  const digest = await sha256(source.file);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(ROOT, source.file));
  const totals = new Map(); // regionCode -> { discharges, days }
  for (const sheet of workbook.worksheets) {
    if (!/^Tavola 8\.1/.test(sheet.name)) continue;
    const title = cellText(sheet.getRow(3).getCell(1));
    const segments = title.split(" - ").map((s) => s.trim());
    const regionSegment = segments.find((s) => /^(REGIONE |PA DI |P\.A\. )/i.test(s));
    if (!regionSegment) {
      warn(`${sheet.name}: could not find a region segment in title "${title}".`);
      continue;
    }
    const regionName = regionSegment.replace(/^REGIONE /i, "");
    const resolved = resolveRegionCode(regionName, registries.regionRegistry);
    if (resolved.status !== "matched") {
      warn(`${sheet.name}: region "${regionName}" ${resolved.status}.`);
      continue;
    }
    const base = {
      source_id: source.id,
      source_file: source.file,
      source_sha256: digest,
      source_year: source.year,
      grain: "region",
      region_code: resolved.code,
      region_name: resolved.registryName,
      institute_scope: "all_sdo_reporting_institutes",
      activity_type: "acute",
      regime: "ordinary",
      proxy_status: "observed_public",
      confidence_status: "VERIFIED-SOURCE",
    };
    let generalRow = null;
    let mdc15Row = null;
    let drg391Found = false;
    for (let r = 6; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const code = cellText(row.getCell(1));
      const label = cellText(row.getCell(3));
      if (code === "391" || /neonato normale/i.test(label)) drg391Found = true;
      if (/^TOTALE GENERALE$/i.test(label)) generalRow = r;
      else if (/^TOTALE MDC 15/i.test(label)) mdc15Row = r;
    }
    if (drg391Found) {
      fail(
        `${sheet.name}: a DRG 391 row is present, so the acute figures no longer exclude healthy newborns by source definition and every region composition's drg391Handling would be wrong.`,
      );
    }
    if (generalRow === null) {
      warn(`${sheet.name}: TOTALE GENERALE row not found.`);
    } else {
      const totalNotes =
        "TOTALE GENERALE of the per-DRG table (DRG 24 grouper). The sheet was scanned for a DRG 391 row before emission; none is present, consistent with Nido being reported separately.";
      const d = emitSdoCell(base, sheet, generalRow, 4, {
        activity_component: "acute_ordinary_regime_discharges",
        dimension: `drg_scope=all_drg_listed;nido_drg_391_row_present=${drg391Found}`,
        unit: "discharges",
        notes: totalNotes,
      });
      const g = emitSdoCell(base, sheet, generalRow, 5, {
        activity_component: "acute_ordinary_regime_days",
        dimension: `drg_scope=all_drg_listed;nido_drg_391_row_present=${drg391Found}`,
        unit: "days",
        notes: totalNotes,
      });
      totals.set(resolved.code, { discharges: d.value, days: g.value });
    }
    if (mdc15Row !== null) {
      const mdcNotes = "MDC 15 total; healthy newborns (DRG 391) are not listed in this table.";
      emitSdoCell(base, sheet, mdc15Row, 4, {
        activity_component: "acute_ordinary_regime_discharges",
        dimension: `mdc=15_neonatal_period;drg_391_listed=${drg391Found}`,
        unit: "discharges",
        notes: mdcNotes,
      });
      emitSdoCell(base, sheet, mdc15Row, 5, {
        activity_component: "acute_ordinary_regime_days",
        dimension: `mdc=15_neonatal_period;drg_391_listed=${drg391Found}`,
        unit: "days",
        notes: mdcNotes,
      });
    }
  }
  return { totals };
}

// ---------------------------------------------------------------------------
// Compositions and calibration
// ---------------------------------------------------------------------------

function emitRegionalCompositions(regionValues, registries, digest) {
  const compositionValues = new Map(); // `${composition}|${region}` -> value
  for (const definition of PUBLIC_ACTIVITY_PROXY_COMPOSITIONS) {
    if (definition.grain !== "region") continue;
    for (const [regionCode, bucket] of regionValues) {
      const missing = definition.components.filter((component) => bucket[component] === undefined);
      const value = missing.length
        ? null
        : definition.components.reduce((total, component) => total + bucket[component], 0);
      emit({
        source_id: SOURCES.sdoCap2.id,
        source_file: SOURCES.sdoCap2.file,
        source_sha256: digest,
        source_year: SOURCES.sdoCap2.year,
        source_locator: `Tavola 2.1.6 codice_regione=${regionCode} components: ${definition.components.join("+")}`,
        grain: "region",
        region_code: regionCode,
        region_name: registries.regionNames.get(regionCode) ?? null,
        institute_scope: definition.instituteScope,
        activity_type: "composition",
        regime: "as_defined",
        activity_component: definition.id,
        dimension: `drg391=${definition.drg391Handling};onere4=${definition.onere4Handling}`,
        value,
        unit: definition.components.some((component) => component.endsWith("_accesses"))
          ? "days_plus_accesses"
          : "days",
        null_reason: missing.length ? `missing_components=${missing.join("+")}` : null,
        proxy_status: missing.length ? "unavailable" : "derived_aggregate",
        confidence_status: missing.length ? "UNAVAILABLE" : "PROXY-CANDIDATE",
        notes: definition.description,
      });
      if (value !== null) compositionValues.set(`${definition.id}|${regionCode}`, value);
    }
  }
  return compositionValues;
}

async function loadTrustedCases(registries) {
  const source = SOURCES.trusted;
  const raw = JSON.parse(await readFile(path.join(ROOT, source.file), "utf8"));
  if (raw.selector?.activity !== "A2" || raw.selector?.description !== A2_SELECTOR_DESCRIPTION_VERBATIM) {
    fail(
      `Trusted extract selector differs from the recorded A2 selector. Found: ${JSON.stringify(raw.selector)}`,
    );
  }
  const totals = raw.records.filter((record) => record.aware === "Total");
  const byYear = new Map();
  for (const record of totals) {
    const list = byYear.get(record.year) ?? [];
    list.push(record);
    byYear.set(record.year, list);
  }
  const cases = [];
  for (const [year, list] of byYear) {
    const regional = list.find((r) => r.azienda === TRUSTED_CASE_REGION.regionalTotalAziendaCode);
    const aziende = list.filter((r) => TRUSTED_CASE_REGION.aziendaCodes.includes(r.azienda));
    if (!regional || aziende.length !== TRUSTED_CASE_REGION.aziendaCodes.length) {
      fail(`Trusted extract year ${year} does not contain the expected regional row and four Aziende.`);
    }
    const sum = aziende.reduce((total, r) => total + r.activity_a2, 0);
    if (Math.abs(sum - regional.activity_a2) > 1e-6) {
      fail(`Trusted extract year ${year}: sum of Aziende ${sum} != regional ${regional.activity_a2}.`);
    }
    for (const record of aziende) {
      const registryName = registries.aslByYear.get(
        `${year}|${TRUSTED_CASE_REGION.regionCode}|${record.azienda}`,
      );
      if (!registryName) {
        fail(`ASL registry has no (${year}, ${TRUSTED_CASE_REGION.regionCode}, ${record.azienda}) row.`);
      }
      cases.push({
        year,
        grain: "azienda",
        regionCode: TRUSTED_CASE_REGION.regionCode,
        aziendaCode: record.azienda,
        aziendaName: registryName,
        value: record.activity_a2,
        sourceCell: record.source_cells.activity_a2,
      });
    }
    cases.push({
      year,
      grain: "region",
      regionCode: TRUSTED_CASE_REGION.regionCode,
      aziendaCode: null,
      aziendaName: "Regional total (sum of 201-204, verified)",
      value: regional.activity_a2,
      sourceCell: regional.source_cells.activity_a2,
    });
  }
  return { cases, sourceDescription: raw.source, sha256: await sha256(source.file) };
}

function buildCalibration(trusted, compositionValues, hsp, bedsAziendaTotals) {
  const calibrationRows = [];
  const compared = [];
  for (const trustedCase of trusted.cases) {
    const trustedRef = {
      label: "workbook_a2_activity",
      year: trustedCase.year,
      grain: trustedCase.grain,
      regionCode: trustedCase.regionCode,
      aziendaCode: trustedCase.aziendaCode,
      value: trustedCase.value,
    };
    for (const definition of PUBLIC_ACTIVITY_PROXY_COMPOSITIONS) {
      let proxyValue = null;
      let proxyYear = null;
      if (definition.grain === "region" && trustedCase.grain === "region") {
        proxyValue = compositionValues.get(`${definition.id}|${trustedCase.regionCode}`) ?? null;
        proxyYear = SOURCES.sdoCap2.year;
      } else if (definition.grain === "azienda" && trustedCase.grain === "azienda") {
        proxyValue =
          hsp.aziendaOrdinaryDays.get(`${trustedCase.regionCode}|${trustedCase.aziendaCode}`) ?? null;
        proxyYear = SOURCES.hsp2022.year;
      }
      const baseRow = {
        trusted_year: trustedCase.year,
        trusted_grain: trustedCase.grain,
        region_code: trustedCase.regionCode,
        azienda_code: trustedCase.aziendaCode,
        organization_code: trustedCase.aziendaCode
          ? `${trustedCase.regionCode}${trustedCase.aziendaCode}`
          : null,
        azienda_name: trustedCase.aziendaName,
        trusted_a2_value: trustedCase.value,
        trusted_source_cell: trustedCase.sourceCell,
        proxy_label: PUBLIC_ACTIVITY_PROXY_LABEL,
        composition: definition.id,
        composition_source: definition.sourceId,
        composition_grain: definition.grain,
        institute_scope: definition.instituteScope,
        drg391_handling: definition.drg391Handling,
        onere4_handling: definition.onere4Handling,
        proxy_year: proxyYear,
        proxy_value: proxyValue,
        comparison_status: null,
        trusted_over_proxy: null,
        proxy_minus_trusted: null,
        proxy_relative_difference: null,
        note: null,
      };
      if (definition.grain !== trustedCase.grain) {
        calibrationRows.push({
          ...baseRow,
          proxy_year: null,
          comparison_status: "grain_not_applicable",
          note: `Composition is defined at ${definition.grain} grain; trusted case is ${trustedCase.grain} grain.`,
        });
        continue;
      }
      if (proxyValue === null) {
        calibrationRows.push({
          ...baseRow,
          comparison_status: "no_public_observation",
          note: "No public value exists for this composition, region and Azienda.",
        });
        continue;
      }
      const result = compareTrustedActivityWithProxy({
        trusted: trustedRef,
        proxy: {
          label: PUBLIC_ACTIVITY_PROXY_LABEL,
          composition: definition.id,
          year: proxyYear,
          grain: definition.grain,
          regionCode: trustedCase.regionCode,
          aziendaCode: trustedCase.aziendaCode,
          value: proxyValue,
        },
      });
      if (result.status === "available") {
        compared.push(result.value);
        calibrationRows.push({
          ...baseRow,
          comparison_status: "compared_same_year_same_grain",
          trusted_over_proxy: result.value.trustedOverProxy,
          proxy_minus_trusted: result.value.proxyMinusTrusted,
          proxy_relative_difference: result.value.proxyRelativeDifference,
          note: "Single-region observation; see summary before drawing any conclusion.",
        });
      } else {
        calibrationRows.push({
          ...baseRow,
          comparison_status: result.code,
          note: `${result.message} Values are shown side by side for orientation only; no ratio is formed.`,
        });
      }
    }
    if (trustedCase.grain === "azienda") {
      const beds = bedsAziendaTotals.get(`${trustedCase.regionCode}|${trustedCase.aziendaCode}`) ?? null;
      calibrationRows.push({
        trusted_year: trustedCase.year,
        trusted_grain: trustedCase.grain,
        region_code: trustedCase.regionCode,
        azienda_code: trustedCase.aziendaCode,
        organization_code: `${trustedCase.regionCode}${trustedCase.aziendaCode}`,
        azienda_name: trustedCase.aziendaName,
        trusted_a2_value: trustedCase.value,
        trusted_source_cell: trustedCase.sourceCell,
        proxy_label: PUBLIC_ACTIVITY_PROXY_LABEL,
        composition: "beds_2023_total_context",
        composition_source: SOURCES.beds2023.id,
        composition_grain: "azienda",
        institute_scope: "public_and_private_accredited",
        drg391_handling: "not_applicable",
        onere4_handling: "not_applicable",
        proxy_year: SOURCES.beds2023.year,
        proxy_value: beds,
        comparison_status: "capacity_not_activity_not_compared",
        trusted_over_proxy: null,
        proxy_minus_trusted: null,
        proxy_relative_difference: null,
        note: "Bed capacity attributed to the Azienda by the source (includes private accredited beds); shown for context, never compared with activity.",
      });
    }
  }
  const summaries = PUBLIC_ACTIVITY_PROXY_COMPOSITIONS.map((definition) =>
    summarizeCalibrationEvidence(definition.id, compared, null),
  );
  return { calibrationRows, compared, summaries };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const registries = await loadRegistries();
  const hsp = await loadHospitalStructureActivity(registries);
  const beds = await loadBeds(registries);
  const dischargeTypes = await loadDischargeTypes(hsp, beds, registries);
  const ageSex = await loadSdoAgeSex(hsp, beds, registries);
  const aslActivity = await loadAslActivity(registries);
  const cap2 = await loadSdoCap2(registries);
  const cap6 = await loadSdoCap6(registries);
  const cap8 = await loadSdoCap8(registries);

  for (const [regionCode, bucket] of cap2.regionValues) {
    const cap8Total = cap8.totals.get(regionCode);
    if (!cap8Total) continue;
    const t216Days = bucket.acute_ordinary_regime_days;
    if (t216Days !== undefined && cap8Total.days !== null && cap8Total.days !== t216Days) {
      warn(
        `Region ${regionCode}: Tavola 2.1.6 acute ordinary days ${t216Days} differ from Cap8 TOTALE GENERALE ${cap8Total.days}.`,
      );
    }
  }

  const compositionValues = emitRegionalCompositions(
    cap2.regionValues,
    registries,
    await sha256(SOURCES.sdoCap2.file),
  );

  const bedsAziendaTotals = new Map();
  for (const row of rows) {
    if (row.source_id === SOURCES.beds2023.id && row.grain === "azienda" && row.value !== null) {
      bedsAziendaTotals.set(`${row.region_code}|${row.azienda_code}`, row.value);
    }
  }

  const trusted = await loadTrustedCases(registries);
  const calibration = buildCalibration(trusted, compositionValues, hsp, bedsAziendaTotals);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "public_activity_proxy_components.csv"), toCsv(COLUMNS, rows), "utf8");

  const calibrationColumns = Object.keys(calibration.calibrationRows[0] ?? {});
  await writeFile(
    path.join(OUT_DIR, "a2_public_proxy_calibration.csv"),
    toCsv(calibrationColumns, calibration.calibrationRows),
    "utf8",
  );

  const countBy = (selector) => {
    const counts = {};
    for (const row of rows) {
      const key = selector(row);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  };

  const manifest = {
    generatedAt: new Date().toISOString(),
    scriptVersion: SCRIPT_VERSION,
    nodeVersion: process.version,
    proxyLabel: PUBLIC_ACTIVITY_PROXY_LABEL,
    a2SelectorVerbatim: A2_SELECTOR_DESCRIPTION_VERBATIM,
    a2SelectorPolicy:
      "The public proxy is never labelled A2. Exact A2 requires Azienda-supplied DEGENZA, ACCESSI, ONERE and DRG fields.",
    trustedCaseRegion: TRUSTED_CASE_REGION,
    trustedExtract: {
      file: SOURCES.trusted.file,
      sha256: trusted.sha256,
      workbook: trusted.sourceDescription,
      cases: trusted.cases.length,
    },
    sources: await Promise.all(
      Object.values(SOURCES).map(async (source) => ({
        id: source.id,
        file: source.file,
        year: source.year,
        sha256: await sha256(source.file),
        official: source.official,
      })),
    ),
    counts: {
      componentRows: rows.length,
      bySource: countBy((row) => row.source_id),
      byGrain: countBy((row) => row.grain),
      byProxyStatus: countBy((row) => row.proxy_status),
      byConfidence: countBy((row) => row.confidence_status),
      suppressedRows: rows.filter((row) => row.suppression_flag).length,
      nullValueRows: rows.filter((row) => row.value === null).length,
      hospitalStructureWardRows: hsp.wardRows,
      hospitalStructureFacilities: hsp.facilities.size,
      hospitalStructureAziende: hsp.aziende,
      hospitalStructureUnattributedFacilities: hsp.unattributedFacilities,
      hospitalStructureFacilitiesAttributedByRegistryOverCodiceAsl: hsp.registryOverCodiceAsl,
      bedsRecords: beds.records,
      dischargeTypeRecords: dischargeTypes.records,
      dischargeTypeSuppressedCells: dischargeTypes.suppressed,
      dischargeTypeDatoErratoRows: dischargeTypes.datoErrato,
      sdoAgeSexRecords: ageSex.records,
      sdoAgeSexSuppressedCells: ageSex.suppressedCells,
      sdoAgeSexDatoErratoRows: ageSex.datoErrato,
      aslActivityRecords: aslActivity.records,
      regionsWithSdo2024Compositions: cap2.regionValues.size,
    },
    onereColumnLabelsTavola622: cap6.onereLabels,
    calibration: {
      comparedObservations: calibration.compared.length,
      summaries: calibration.summaries,
    },
    warnings,
  };
  await writeFile(
    path.join(OUT_DIR, "public_activity_proxy_manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(OUT_DIR, "a2_public_proxy_calibration_summary.json"),
    `${JSON.stringify(
      {
        generatedAt: manifest.generatedAt,
        proxyLabel: PUBLIC_ACTIVITY_PROXY_LABEL,
        comparedObservations: calibration.compared.map((row) => ({
          year: row.year,
          grain: row.grain,
          regionCode: row.regionCode,
          aziendaCode: row.aziendaCode,
          composition: row.composition,
          trustedValue: row.trustedValue,
          proxyValue: row.proxyValue,
          trustedOverProxy: row.trustedOverProxy,
          proxyRelativeDifference: row.proxyRelativeDifference,
        })),
        summaries: calibration.summaries,
        generalizationPolicy: "not_yet_approved",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Component rows: ${rows.length} (suppressed ${manifest.counts.suppressedRows}, null ${manifest.counts.nullValueRows})`);
  console.log(`Calibration rows: ${calibration.calibrationRows.length}; compared same-year same-grain: ${calibration.compared.length}`);
  for (const row of calibration.compared) {
    console.log(
      `  ${row.year} ${row.grain} ${row.regionCode}${row.aziendaCode ? "/" + row.aziendaCode : ""} ${row.composition}: trusted ${row.trustedValue} vs proxy ${row.proxyValue} -> trusted/proxy ${row.trustedOverProxy.toFixed(4)}`,
    );
  }
  for (const summary of calibration.summaries) {
    console.log(`  ${summary.composition}: n=${summary.observations}, generalization ${summary.generalization.status}`);
  }
  if (warnings.length) console.log(`Warnings: ${warnings.length} (see manifest)`);
  console.log(`Outputs written to ${path.relative(ROOT, OUT_DIR)}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
