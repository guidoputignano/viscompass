import type {
  CanonicalFact,
  Objective,
  Organization,
  UploadRecord,
} from "./types";

// Demonstration fixtures only — org codes, names, and every figure below
// are fictional. canonical_fact has no real rows yet; this is what the
// column shapes look like once it does.

export const MOCK_ORGS: Organization[] = [
  { org_code: "ASL01", org_name: "ASL 1 — Area Nord", org_type: "asl", region_code: "REG_TEST" },
  { org_code: "ASL02", org_name: "ASL 2 — Area Centro", org_type: "asl", region_code: "REG_TEST" },
  { org_code: "ASL03", org_name: "ASL 3 — Area Sud", org_type: "asl", region_code: "REG_TEST" },
  { org_code: "REG_TEST", org_name: "Regione Test", org_type: "regione", region_code: "REG_TEST" },
];

const CH_DIRETTA = "Distribuzione diretta";
const CH_CONTO = "Distribuzione per conto";
const CH_CONV = "Convenzionata";

type Row = Omit<CanonicalFact, "id" | "created_at">;

function row(r: Row): Row {
  return r;
}

// Molecule reference: real INN/ATC, used only as realistic demo labels.
const MOLECULES: Array<{
  active_substance: string;
  brand_originator: string;
  brand_biosimilar: string | null;
  atc1: string;
  atc4: string;
  atc5: string;
  origCostPerMg: number;
  bioCostPerMg: number;
}> = [
  { active_substance: "Trastuzumab", brand_originator: "Herceptin", brand_biosimilar: "Trastuzumab Sandoz", atc1: "L", atc4: "L01FD", atc5: "L01FD01", origCostPerMg: 4.9, bioCostPerMg: 3.1 },
  { active_substance: "Rituximab", brand_originator: "MabThera", brand_biosimilar: "Truxima", atc1: "L", atc4: "L01FA", atc5: "L01FA01", origCostPerMg: 3.4, bioCostPerMg: 2.0 },
  { active_substance: "Bevacizumab", brand_originator: "Avastin", brand_biosimilar: "Zirabev", atc1: "L", atc4: "L01FG", atc5: "L01FG01", origCostPerMg: 2.6, bioCostPerMg: 1.5 },
  { active_substance: "Adalimumab", brand_originator: "Humira", brand_biosimilar: "Amgevita", atc1: "L", atc4: "L04AB", atc5: "L04AB04", origCostPerMg: 8.2, bioCostPerMg: 4.4 },
  { active_substance: "Ustekinumab", brand_originator: "Stelara", brand_biosimilar: "Wezlana", atc1: "L", atc4: "L04AC", atc5: "L04AC05", origCostPerMg: 22.0, bioCostPerMg: 15.8 },
  { active_substance: "Pembrolizumab", brand_originator: "Keytruda", brand_biosimilar: null, atc1: "L", atc4: "L01FF", atc5: "L01FF02", origCostPerMg: 46.5, bioCostPerMg: 46.5 },
  { active_substance: "Piperacillina/Tazobactam", brand_originator: "Tazocin", brand_biosimilar: null, atc1: "J", atc4: "J01CR", atc5: "J01CR05", origCostPerMg: 0.02, bioCostPerMg: 0.02 },
];

const ASLS: Array<{ asl_code: string; region_code: string; region_name: string }> = [
  { asl_code: "ASL01", region_code: "REG_TEST", region_name: "Regione Test" },
  { asl_code: "ASL02", region_code: "REG_TEST", region_name: "Regione Test" },
  { asl_code: "ASL03", region_code: "REG_TEST", region_name: "Regione Test" },
];

// Per-ASL, per-molecule spend and biosimilar-share pattern — hand-set so
// each module has something meaningful to aggregate/compare, not a flat
// uniform grid.
const SPEND_PLAN: Array<{
  aslIndex: number;
  moleculeIndex: number;
  channel: string;
  originatorSpend: number;
  biosimilarSpend: number;
}> = [
  { aslIndex: 0, moleculeIndex: 0, channel: CH_DIRETTA, originatorSpend: 210_000, biosimilarSpend: 480_000 },
  { aslIndex: 1, moleculeIndex: 0, channel: CH_DIRETTA, originatorSpend: 610_000, biosimilarSpend: 90_000 },
  { aslIndex: 2, moleculeIndex: 0, channel: CH_CONTO, originatorSpend: 140_000, biosimilarSpend: 300_000 },

  { aslIndex: 0, moleculeIndex: 1, channel: CH_DIRETTA, originatorSpend: 95_000, biosimilarSpend: 260_000 },
  { aslIndex: 1, moleculeIndex: 1, channel: CH_DIRETTA, originatorSpend: 310_000, biosimilarSpend: 40_000 },
  { aslIndex: 2, moleculeIndex: 1, channel: CH_CONTO, originatorSpend: 70_000, biosimilarSpend: 190_000 },

  { aslIndex: 0, moleculeIndex: 2, channel: CH_DIRETTA, originatorSpend: 60_000, biosimilarSpend: 150_000 },
  { aslIndex: 1, moleculeIndex: 2, channel: CH_DIRETTA, originatorSpend: 180_000, biosimilarSpend: 35_000 },
  { aslIndex: 2, moleculeIndex: 2, channel: CH_CONTO, originatorSpend: 40_000, biosimilarSpend: 120_000 },

  { aslIndex: 0, moleculeIndex: 3, channel: CH_CONV, originatorSpend: 130_000, biosimilarSpend: 210_000 },
  { aslIndex: 1, moleculeIndex: 3, channel: CH_CONV, originatorSpend: 380_000, biosimilarSpend: 60_000 },
  { aslIndex: 2, moleculeIndex: 3, channel: CH_CONV, originatorSpend: 90_000, biosimilarSpend: 175_000 },

  { aslIndex: 0, moleculeIndex: 4, channel: CH_DIRETTA, originatorSpend: 520_000, biosimilarSpend: 40_000 },
  { aslIndex: 1, moleculeIndex: 4, channel: CH_DIRETTA, originatorSpend: 610_000, biosimilarSpend: 0 },
  { aslIndex: 2, moleculeIndex: 4, channel: CH_DIRETTA, originatorSpend: 450_000, biosimilarSpend: 55_000 },

  { aslIndex: 0, moleculeIndex: 5, channel: CH_DIRETTA, originatorSpend: 890_000, biosimilarSpend: 0 },
  { aslIndex: 1, moleculeIndex: 5, channel: CH_DIRETTA, originatorSpend: 760_000, biosimilarSpend: 0 },
  { aslIndex: 2, moleculeIndex: 5, channel: CH_DIRETTA, originatorSpend: 640_000, biosimilarSpend: 0 },

  { aslIndex: 0, moleculeIndex: 6, channel: CH_CONV, originatorSpend: 145_000, biosimilarSpend: 0 },
  { aslIndex: 1, moleculeIndex: 6, channel: CH_CONV, originatorSpend: 168_000, biosimilarSpend: 0 },
  { aslIndex: 2, moleculeIndex: 6, channel: CH_CONV, originatorSpend: 121_000, biosimilarSpend: 0 },
];

function buildRow(
  aslIdx: number,
  molIdx: number,
  channel: string,
  spend: number,
  isBiosimilar: boolean,
  seq: number,
): Row {
  const asl = ASLS[aslIdx];
  const mol = MOLECULES[molIdx];
  const costPerMg = isBiosimilar ? mol.bioCostPerMg : mol.origCostPerMg;
  const totalContentMg = Math.round(spend / costPerMg);
  return row({
    source_record_id: `MOCK-${asl.asl_code}-${mol.atc5}-${isBiosimilar ? "BIO" : "ORIG"}-${seq}`,
    source_version_id: "mock-v1",
    year: 2026,
    month: ((seq * 3) % 12) + 1,
    region_code: asl.region_code,
    region_name: asl.region_name,
    asl_code: asl.asl_code,
    channel,
    aic: `0${(300000000 + seq * 137 + molIdx * 91).toString().slice(0, 8)}`,
    atc1: mol.atc1,
    atc2: mol.atc1 + "01",
    atc3: mol.atc4.slice(0, 4),
    atc4: mol.atc4,
    atc5: mol.atc5,
    product_description_raw: `${isBiosimilar ? mol.brand_biosimilar : mol.brand_originator}*FL`,
    brand_name: isBiosimilar ? mol.brand_biosimilar : mol.brand_originator,
    active_substance: mol.active_substance,
    quantity_packs: Math.max(1, Math.round(spend / (costPerMg * 150))),
    total_cost_eur: spend,
    biosimilar_flag: isBiosimilar,
    originator_flag: !isBiosimilar,
    units_per_pack: 1,
    strength_value_mg: 150,
    volume_per_unit_ml: 15,
    ddd_value_mg: 150,
    unit_cost_eur: costPerMg * 150,
    total_content_mg: totalContentMg,
    ddds_per_pack: 1,
    cost_per_mg: costPerMg,
    cost_per_ddd: costPerMg * 150,
    mapping_confidence: "Validated",
    quality_status: "ok",
  });
}

const rows: Row[] = [];
let seq = 0;
for (const plan of SPEND_PLAN) {
  if (plan.originatorSpend > 0) {
    rows.push(
      buildRow(plan.aslIndex, plan.moleculeIndex, plan.channel, plan.originatorSpend, false, seq++),
    );
  }
  if (plan.biosimilarSpend > 0) {
    rows.push(
      buildRow(plan.aslIndex, plan.moleculeIndex, plan.channel, plan.biosimilarSpend, true, seq++),
    );
  }
}

export const MOCK_CANONICAL_FACTS: CanonicalFact[] = rows.map((r, i) => ({
  ...r,
  id: i + 1,
  created_at: "2026-08-01T00:00:00Z",
}));

export const MOCK_OBJECTIVES: Objective[] = [
  {
    id: 1,
    region_code: "REG_TEST",
    metric: "Penetrazione biosimilare — Trastuzumab",
    atc_scope: "L01FD01",
    target_value: 0.75,
    period_start: "2026-01-01",
    period_end: "2026-12-31",
    created_by: null,
    created_at: "2026-01-05T00:00:00Z",
  },
  {
    id: 2,
    region_code: "REG_TEST",
    metric: "Spesa acquisti diretti su FSN",
    atc_scope: null,
    target_value: 0.10,
    period_start: "2026-01-01",
    period_end: "2026-12-31",
    created_by: null,
    created_at: "2026-01-05T00:00:00Z",
  },
  {
    id: 3,
    region_code: "REG_TEST",
    metric: "Giorni di copertura scorte critiche",
    atc_scope: null,
    target_value: 60,
    period_start: "2026-04-01",
    period_end: "2026-09-30",
    created_by: null,
    created_at: "2026-03-20T00:00:00Z",
  },
];

export const MOCK_UPLOADS: UploadRecord[] = [
  {
    id: 1,
    org_code: "ASL01",
    uploaded_by: "00000000-0000-0000-0000-000000000001",
    file_name: "consumi_2026_06.csv",
    storage_path: "asl01/consumi_2026_06.csv",
    period_covered_start: "2026-06-01",
    period_covered_end: "2026-06-30",
    status: "reconciled",
    reconciliation_summary: { righe: 4821, scarti: 3 },
    uploaded_at: "2026-07-03T09:12:00Z",
    reconciled_at: "2026-07-04T11:00:00Z",
  },
  {
    id: 2,
    org_code: "ASL01",
    uploaded_by: "00000000-0000-0000-0000-000000000001",
    file_name: "consumi_2026_07.csv",
    storage_path: "asl01/consumi_2026_07.csv",
    period_covered_start: "2026-07-01",
    period_covered_end: "2026-07-31",
    status: "processing",
    reconciliation_summary: null,
    uploaded_at: "2026-08-02T08:40:00Z",
    reconciled_at: null,
  },
  {
    id: 3,
    org_code: "ASL01",
    uploaded_by: "00000000-0000-0000-0000-000000000002",
    file_name: "consumi_2026_05.csv",
    storage_path: "asl01/consumi_2026_05.csv",
    period_covered_start: "2026-05-01",
    period_covered_end: "2026-05-31",
    status: "discrepancy_found",
    reconciliation_summary: { righe: 4655, scarti: 128, nota: "Scarto oltre soglia su ASL01" },
    uploaded_at: "2026-06-02T10:15:00Z",
    reconciled_at: null,
  },
];
