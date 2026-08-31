// Types mirror supabase_schema.sql column-for-column. When canonical_fact
// has real rows, the query functions in queries.ts become real Supabase
// calls returning these exact same shapes — no component should need to
// change when that happens.

export type OrgType = "asl" | "regione";

export interface Organization {
  org_code: string;
  org_name: string;
  org_type: OrgType;
  region_code: string | null;
}

export type MappingConfidence =
  | "Authoritative"
  | "Validated"
  | "Candidate"
  | "Unresolved";

export interface CanonicalFact {
  id: number;
  source_record_id: string;
  source_version_id: string;
  year: number;
  month: number | null;
  region_code: string | null;
  region_name: string | null;
  asl_code: string | null;
  channel: string | null;
  aic: string | null;
  atc1: string | null;
  atc2: string | null;
  atc3: string | null;
  atc4: string | null;
  atc5: string | null;
  product_description_raw: string | null;
  brand_name: string | null;
  active_substance: string | null;
  quantity_packs: number | null;
  total_cost_eur: number | null;
  biosimilar_flag: boolean | null;
  originator_flag: boolean | null;
  units_per_pack: number | null;
  strength_value_mg: number | null;
  volume_per_unit_ml: number | null;
  ddd_value_mg: number | null;
  unit_cost_eur: number | null;
  total_content_mg: number | null;
  ddds_per_pack: number | null;
  cost_per_mg: number | null;
  cost_per_ddd: number | null;
  mapping_confidence: MappingConfidence | null;
  quality_status: string | null;
  created_at: string;
}

export interface Objective {
  id: number;
  region_code: string;
  metric: string;
  atc_scope: string | null;
  target_value: number;
  period_start: string;
  period_end: string;
  created_by: string | null;
  created_at: string;
}

export type UploadStatus =
  | "uploaded"
  | "processing"
  | "reconciled"
  | "discrepancy_found";

export interface UploadRecord {
  id: number;
  org_code: string;
  uploaded_by: string;
  file_name: string;
  storage_path: string;
  period_covered_start: string | null;
  period_covered_end: string | null;
  status: UploadStatus;
  reconciliation_summary: Record<string, unknown> | null;
  uploaded_at: string;
  reconciled_at: string | null;
}

// Only the columns the submission form actually collects. submitted_by
// and org_code both come from the authenticated session server-side, not
// from form input; status defaults to 'pending' and
// response/responded_by/responded_at must stay null on insert per the
// feature_requests RLS policy, so the form never touches them either.
export interface FeatureRequestSubmission {
  description: string;
  decision_impact: string | null;
  frequency: string | null;
}

export interface SankeyNode {
  name: string;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface BiosimilarComparisonRow {
  active_substance: string;
  atc4: string | null;
  originator_cost_per_mg: number | null;
  biosimilar_cost_per_mg: number | null;
  originator_spend_eur: number;
  biosimilar_spend_eur: number;
  originator_share: number; // 0-1, share of combined spend still on originator
  potential_savings_eur: number;
}

// Result of the my_objective_rank(p_metric) Postgres function: the
// caller's own position among the ASLs in its region, with no other org's
// identity or value ever included. null (not a zero-value row) means no
// ranking is available for this metric — either the caller has no
// approved ASL membership, or the objective has no confirmed formula
// (atc_scope is null) — the UI must tell these apart from "you're last."
export interface ObjectiveRank {
  my_org_code: string;
  my_value: number;
  my_rank: number;
  total_orgs: number;
  target_value: number;
}

export type AwareCategory = "A" | "W" | "R" | "T";

export interface AntibioticConsumptionFact {
  id: number;
  org_code: string;
  unit_code: string | null;
  aware_category: AwareCategory;
  year: number;
  cost_eur: number | null;
  ddd_count: number | null;
  bed_days: number | null;
  source_note: string | null;
  loaded_at: string;
}

// One year's AWaRe cost breakdown. unclassified is the gap between the
// declared total (aware_category 'T') and A+W+R summed, clamped to >= 0 —
// see hasNegativeGap for the opposite case (components exceed the total).
export interface AwareYearRow {
  year: number;
  access: number;
  watch: number;
  reserve: number;
  unclassified: number;
  hasNegativeGap: boolean;
}

export interface AntibioticIndicatorSet {
  dddPer100BedDays: number | null;
  costPerBedDay: number | null;
  costPerDdd: number | null;
}

export interface AntibioticStewardshipData {
  awareByYear: AwareYearRow[];
  latestYear: number | null;
  orgIndicators: AntibioticIndicatorSet | null;
  // null when no peer org's data is visible to compute a benchmark from —
  // always the case for an asl-type caller today, since RLS only ever
  // hands them their own org's rows. Not a bug: no benchmark is fabricated
  // when there's nothing real to compare against.
  regionalAverage: (AntibioticIndicatorSet & { peerOrgCount: number }) | null;
}
