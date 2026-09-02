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

export interface SpendTrendPoint {
  key: string;
  label: string;
  spend_eur: number;
}

export interface SpendAtcSummary {
  code: string;
  label: string;
  spend_eur: number;
  share: number;
}

export interface SpendDashboardData {
  flows: SankeyData;
  latest_year: number | null;
  total_spend_eur: number;
  total_packs: number;
  cost_per_pack_eur: number | null;
  record_count: number;
  source_version_count: number;
  geography_count: number;
  latest_loaded_at: string | null;
  normalized_record_count: number;
  normalization_eligible_count: number;
  normalization_coverage: number | null;
  unresolved_record_count: number;
  trend_granularity: "month" | "year";
  trend: SpendTrendPoint[];
  atc_breakdown: SpendAtcSummary[];
  previous_year: number | null;
  spend_yoy: number | null;
  packs_yoy: number | null;
  biosimilar_penetration: number | null;
  biosimilar_penetration_basis: "mg" | "packs" | "spend" | null;
  biosimilar_opportunity_eur: number;
  active_review_count: number;
  review_items: ReviewSignal[];
  top_molecules: MoleculeSignal[];
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
  biosimilar_penetration: number | null;
  penetration_basis: "mg" | "packs" | "spend";
  normalized_volume_mg: number | null;
  normalization_coverage: number | null;
  evidence_status: "ready" | "partial" | "unresolved";
  latest_year: number;
}

export type ReviewSeverity = "high" | "medium" | "info";

export interface ReviewSignal {
  id: string;
  kind: "biosimilar" | "quality" | "objective" | "upload";
  title: string;
  context: string;
  value_label: string;
  href: string;
  severity: ReviewSeverity;
}

export interface MoleculeSignal {
  active_substance: string;
  atc_code: string | null;
  spend_eur: number;
  spend_yoy: number | null;
  biosimilar_penetration: number | null;
  opportunity_eur: number;
}

export interface BenchmarkRow {
  org_code: string;
  org_name: string;
  spend_eur: number;
  packs: number;
  spend_yoy: number | null;
  cost_per_pack_eur: number | null;
  biosimilar_penetration: number | null;
  normalization_coverage: number | null;
  spend_index: number | null;
  is_current_org: boolean;
}

export interface BenchmarkData {
  latest_year: number | null;
  rows: BenchmarkRow[];
  peer_count: number;
  median_spend_eur: number | null;
  median_cost_per_pack_eur: number | null;
  median_biosimilar_penetration: number | null;
  benchmark_available: boolean;
  limitation: string | null;
}

export type ExplorerLevel = "asl" | "atc1" | "atc2" | "atc3" | "atc4" | "atc5" | "molecule" | "aic";

export interface ExplorerFilters {
  asl?: string;
  atc1?: string;
  atc2?: string;
  atc3?: string;
  atc4?: string;
  atc5?: string;
  molecule?: string;
}

export interface ExplorerBreadcrumb {
  label: string;
  href: string;
}

export interface ExplorerNode {
  key: string;
  code: string;
  label: string;
  href: string | null;
  spend_eur: number;
  spend_share: number;
  packs: number;
  spend_yoy: number | null;
  biosimilar_penetration: number | null;
  normalization_coverage: number | null;
  record_count: number;
}

export interface ExplorerData {
  latest_year: number | null;
  level: ExplorerLevel;
  level_label: string;
  breadcrumbs: ExplorerBreadcrumb[];
  nodes: ExplorerNode[];
  total_spend_eur: number;
  total_packs: number;
  filters: ExplorerFilters;
}

export interface LineageSource {
  source_version_id: string;
  latest_loaded_at: string | null;
  first_year: number | null;
  latest_year: number | null;
  record_count: number;
  spend_eur: number;
  geography_count: number;
  normalized_coverage: number | null;
  unresolved_count: number;
}

export interface LineageData {
  sources: LineageSource[];
  total_records: number;
  latest_loaded_at: string | null;
  unresolved_records: number;
  normalization_coverage: number | null;
}

export interface ReviewWorkspaceData {
  latest_year: number | null;
  signals: ReviewSignal[];
  objectives: Objective[];
  discrepancy_uploads: UploadRecord[];
  high_priority_count: number;
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
  population: number | null;
  unit_name: string | null;
  period_status: "complete" | "provisional" | null;
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
  accessDdd: number;
  watchDdd: number;
  reserveDdd: number;
  unclassifiedDdd: number;
  hasNegativeGap: boolean;
}

export interface AntibioticIndicatorSet {
  dddPer100BedDays: number | null;
  costPerBedDay: number | null;
  costPerDdd: number | null;
  dddPer1000ResidentsDay: number | null;
  costPerCapita: number | null;
}

export interface AntibioticAnnualRow extends AntibioticIndicatorSet {
  year: number;
  costEur: number;
  dddCount: number;
  bedDays: number;
  population: number;
  costYoy: number | null;
  dddYoy: number | null;
}

export interface AntibioticUnitRow extends AntibioticIndicatorSet {
  orgCode: string;
  unitCode: string;
  unitName: string;
  costEur: number;
  dddCount: number;
  bedDays: number;
}

export interface AntibioticStewardshipData {
  mode: "real" | "synthetic";
  sourceLabel: string;
  awareByYear: AwareYearRow[];
  annual: AntibioticAnnualRow[];
  units: AntibioticUnitRow[];
  latestYear: number | null;
  orgIndicators: AntibioticIndicatorSet | null;
  // null when no peer org's data is visible to compute a benchmark from —
  // always the case for an asl-type caller today, since RLS only ever
  // hands them their own org's rows. Not a bug: no benchmark is fabricated
  // when there's nothing real to compare against.
  regionalAverage: (AntibioticIndicatorSet & { peerOrgCount: number }) | null;
}
