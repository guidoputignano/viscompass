// Typed data-access layer for the dashboard-review modules.
//
// Every function queries Supabase directly and applies no org/asl
// filtering of its own — visibility is enforced entirely by the RLS
// policies in supabase_schema.sql. A plain `select *` already returns
// exactly the rows the caller's approved membership(s) allow, nothing
// more, so there is nothing here to keep in sync with the policies.
//
// Only ever called from Server Components. searchMolecules and
// submitFeatureRequest are called from Client Components instead, and
// live in ./actions.ts as Server Actions — see that file for why they
// can't just be exported from here too.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import type {
  AntibioticConsumptionFact,
  AntibioticIndicatorSet,
  AntibioticStewardshipData,
  AwareCategory,
  AwareYearRow,
  BiosimilarComparisonRow,
  BenchmarkData,
  BenchmarkRow,
  CanonicalFact,
  ExplorerData,
  ExplorerFilters,
  ExplorerLevel,
  ExplorerNode,
  LineageData,
  LineageSource,
  MoleculeSignal,
  Objective,
  ObjectiveRank,
  Organization,
  ReviewSignal,
  ReviewWorkspaceData,
  SankeyData,
  SpendDashboardData,
  UploadRecord,
} from "./types";

const PAGE_SIZE = 1000;

// Supabase/PostgREST caps a response at the configured API page size (1,000
// in this project). The previous implementation silently analysed only that
// first page. Fetch every RLS-visible page so totals remain reconcilable to
// the source. React cache keeps repeated reads inside one server render from
// refetching the same tenant-scoped dataset.
const selectCanonicalFacts = cache(async (): Promise<CanonicalFact[]> => {
  const supabase = await createClient();
  const first = await supabase
    .from("canonical_fact")
    .select("*", { count: "exact" })
    .range(0, PAGE_SIZE - 1);
  const { data, error, count } = first;
  if (error) throw new Error(`canonical_fact query failed: ${error.message}`);
  const facts = [...((data ?? []) as CanonicalFact[])];
  const total = count ?? facts.length;

  for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE * 8) {
    const offsets = Array.from(
      { length: Math.min(8, Math.ceil((total - start) / PAGE_SIZE)) },
      (_, index) => start + index * PAGE_SIZE,
    );
    const pages = await Promise.all(
      offsets.map((offset) =>
        supabase
          .from("canonical_fact")
          .select("*")
          .range(offset, Math.min(offset + PAGE_SIZE - 1, total - 1)),
      ),
    );
    for (const page of pages) {
      if (page.error) throw new Error(`canonical_fact query failed: ${page.error.message}`);
      facts.push(...((page.data ?? []) as CanonicalFact[]));
    }
  }

  return facts;
});

const ATC1_NAMES: Record<string, string> = {
  A: "Apparato gastrointestinale e metabolismo",
  B: "Sangue e organi emopoietici",
  C: "Sistema cardiovascolare",
  D: "Dermatologici",
  G: "Sistema genito-urinario e ormoni sessuali",
  H: "Preparati ormonali sistemici",
  J: "Antimicrobici per uso sistemico",
  L: "Antineoplastici e immunomodulatori",
  M: "Sistema muscolo-scheletrico",
  N: "Sistema nervoso",
  P: "Antiparassitari, insetticidi e repellenti",
  R: "Sistema respiratorio",
  S: "Organi di senso",
  V: "Vari",
};

const EXPLORER_LEVEL_LABEL: Record<ExplorerLevel, string> = {
  asl: "Azienda sanitaria",
  atc1: "ATC livello 1",
  atc2: "ATC livello 2",
  atc3: "ATC livello 3",
  atc4: "ATC livello 4",
  atc5: "ATC livello 5",
  molecule: "Molecola",
  aic: "Confezione AIC",
};

function ratio(change: number, baseline: number): number | null {
  return baseline !== 0 ? (change - baseline) / baseline : null;
}

function isUnresolved(fact: CanonicalFact): boolean {
  return (
    fact.mapping_confidence === "Unresolved" ||
    fact.quality_status?.toLowerCase().includes("unresolved") === true
  );
}

function normalizationCoverage(facts: CanonicalFact[]): number | null {
  const eligible = facts.filter((fact) => (fact.total_cost_eur ?? 0) > 0);
  if (eligible.length === 0) return null;
  const normalized = eligible.filter(
    (fact) => fact.cost_per_mg !== null || fact.cost_per_ddd !== null,
  );
  return normalized.length / eligible.length;
}

function normalizedVolumeMg(facts: CanonicalFact[]): number {
  return facts.reduce((sum, fact) => {
    if ((fact.total_content_mg ?? 0) <= 0 || (fact.quantity_packs ?? 0) <= 0) return sum;
    return sum + fact.total_content_mg! * fact.quantity_packs!;
  }, 0);
}

function biosimilarPenetration(facts: CanonicalFact[]): {
  value: number | null;
  basis: "mg" | "packs" | "spend" | null;
} {
  const relevant = facts.filter(
    (fact) => fact.biosimilar_flag !== null || fact.originator_flag === true,
  );
  if (relevant.length === 0) return { value: null, basis: null };

  const totalMg = normalizedVolumeMg(relevant);
  const bioMg = normalizedVolumeMg(relevant.filter((fact) => fact.biosimilar_flag === true));
  if (totalMg > 0) return { value: bioMg / totalMg, basis: "mg" };

  const totalPacks = relevant.reduce((sum, fact) => sum + (fact.quantity_packs ?? 0), 0);
  const bioPacks = relevant
    .filter((fact) => fact.biosimilar_flag === true)
    .reduce((sum, fact) => sum + (fact.quantity_packs ?? 0), 0);
  if (totalPacks > 0) return { value: bioPacks / totalPacks, basis: "packs" };

  const totalSpend = relevant.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
  const bioSpend = relevant
    .filter((fact) => fact.biosimilar_flag === true)
    .reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
  return totalSpend > 0
    ? { value: bioSpend / totalSpend, basis: "spend" }
    : { value: null, basis: null };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function spendFlowsFromFacts(facts: CanonicalFact[]): SankeyData {
  const channels = Array.from(new Set(facts.map((f) => f.channel ?? "Non specificato")));
  const categories = Array.from(
    new Set(facts.map((f) => ATC1_NAMES[f.atc1 ?? ""] ?? f.atc1 ?? "Altro")),
  );
  const kinds = ["Originator", "Biosimilare"];

  const nodeNames = [...channels, ...categories, ...kinds];
  const nodeIndex = new Map(nodeNames.map((n, i) => [n, i]));

  const linkMap = new Map<string, number>();
  const addLink = (source: string, target: string, value: number) => {
    if (value <= 0) return;
    const key = `${source}|${target}`;
    linkMap.set(key, (linkMap.get(key) ?? 0) + value);
  };

  for (const f of facts) {
    const channel = f.channel ?? "Non specificato";
    const category = ATC1_NAMES[f.atc1 ?? ""] ?? f.atc1 ?? "Altro";
    const kind = f.biosimilar_flag ? "Biosimilare" : "Originator";
    const value = f.total_cost_eur ?? 0;
    addLink(channel, category, value);
    addLink(category, kind, value);
  }

  const links = Array.from(linkMap.entries()).map(([key, value]) => {
    const [source, target] = key.split("|");
    return { source: nodeIndex.get(source)!, target: nodeIndex.get(target)!, value };
  });

  return { nodes: nodeNames.map((name) => ({ name })), links };
}

export async function getSpendFlows(): Promise<SankeyData> {
  return spendFlowsFromFacts(await selectCanonicalFacts());
}

export async function getSpendDashboardData(): Promise<SpendDashboardData> {
  const [facts, uploads, objectives] = await Promise.all([
    selectCanonicalFacts(),
    getUploads(),
    getObjectives(),
  ]);
  const years = facts.map((f) => f.year).filter(Number.isFinite);
  const latestYear = years.length > 0 ? Math.max(...years) : null;
  const previousYear = latestYear === null
    ? null
    : [...new Set(years)].filter((year) => year < latestYear).sort((a, b) => b - a)[0] ?? null;
  const currentFacts = latestYear === null ? [] : facts.filter((f) => f.year === latestYear);
  const previousFacts = previousYear === null ? [] : facts.filter((f) => f.year === previousYear);

  const totalSpendEur = currentFacts.reduce((sum, f) => sum + (f.total_cost_eur ?? 0), 0);
  const totalPacks = currentFacts.reduce((sum, f) => sum + (f.quantity_packs ?? 0), 0);
  const previousSpendEur = previousFacts.reduce((sum, f) => sum + (f.total_cost_eur ?? 0), 0);
  const previousPacks = previousFacts.reduce((sum, f) => sum + (f.quantity_packs ?? 0), 0);
  const normalizationEligible = currentFacts.filter((f) => (f.total_cost_eur ?? 0) > 0);
  const normalizedRecordCount = normalizationEligible.filter(
    (f) => f.cost_per_mg !== null || f.cost_per_ddd !== null,
  ).length;
  const unresolvedRecordCount = currentFacts.filter(
    (f) =>
      isUnresolved(f),
  ).length;

  const atcTotals = new Map<string, number>();
  for (const fact of currentFacts) {
    const code = fact.atc1 ?? "Altro";
    atcTotals.set(code, (atcTotals.get(code) ?? 0) + (fact.total_cost_eur ?? 0));
  }
  const atcBreakdown = Array.from(atcTotals.entries())
    .map(([code, spend]) => ({
      code,
      label: ATC1_NAMES[code] ?? "Categoria non classificata",
      spend_eur: spend,
      share: totalSpendEur > 0 ? spend / totalSpendEur : 0,
    }))
    .sort((a, b) => b.spend_eur - a.spend_eur)
    .slice(0, 6);

  const hasMonthlyFacts = currentFacts.some(
    (f) => f.month !== null && f.month >= 1 && f.month <= 12,
  );
  const monthLabels = [
    "Gen",
    "Feb",
    "Mar",
    "Apr",
    "Mag",
    "Giu",
    "Lug",
    "Ago",
    "Set",
    "Ott",
    "Nov",
    "Dic",
  ];

  let trend: SpendDashboardData["trend"];
  let trendGranularity: SpendDashboardData["trend_granularity"];
  if (hasMonthlyFacts) {
    const monthlyTotals = new Map<number, number>();
    for (const fact of currentFacts) {
      if (fact.month === null || fact.month < 1 || fact.month > 12) continue;
      monthlyTotals.set(
        fact.month,
        (monthlyTotals.get(fact.month) ?? 0) + (fact.total_cost_eur ?? 0),
      );
    }
    trend = Array.from(monthlyTotals.entries())
      .sort(([a], [b]) => a - b)
      .map(([month, spend]) => ({
        key: `${latestYear}-${String(month).padStart(2, "0")}`,
        label: monthLabels[month - 1],
        spend_eur: spend,
      }));
    trendGranularity = "month";
  } else {
    const annualTotals = new Map<number, number>();
    for (const fact of facts) {
      annualTotals.set(fact.year, (annualTotals.get(fact.year) ?? 0) + (fact.total_cost_eur ?? 0));
    }
    trend = Array.from(annualTotals.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, spend]) => ({ key: String(year), label: String(year), spend_eur: spend }));
    trendGranularity = "year";
  }

  const sourceVersionCount = new Set(currentFacts.map((f) => f.source_version_id)).size;
  const geographyCount = new Set(
    currentFacts.map((f) => f.asl_code ?? f.region_code).filter((value): value is string => !!value),
  ).size;
  const loadedTimes = currentFacts
    .map((f) => Date.parse(f.created_at))
    .filter((value) => Number.isFinite(value));

  const currentBio = buildBiosimilarRows(currentFacts, latestYear);
  const overallPenetration = biosimilarPenetration(currentFacts);
  const biosimilarOpportunity = currentBio.reduce(
    (sum, row) => sum + row.potential_savings_eur,
    0,
  );

  const previousMoleculeSpend = new Map<string, number>();
  for (const fact of previousFacts) {
    if (!fact.active_substance) continue;
    previousMoleculeSpend.set(
      fact.active_substance,
      (previousMoleculeSpend.get(fact.active_substance) ?? 0) + (fact.total_cost_eur ?? 0),
    );
  }
  const currentMoleculeFacts = new Map<string, CanonicalFact[]>();
  for (const fact of currentFacts) {
    if (!fact.active_substance) continue;
    const group = currentMoleculeFacts.get(fact.active_substance) ?? [];
    group.push(fact);
    currentMoleculeFacts.set(fact.active_substance, group);
  }
  const opportunityByMolecule = new Map(
    currentBio.map((row) => [row.active_substance, row.potential_savings_eur]),
  );
  const topMolecules: MoleculeSignal[] = Array.from(currentMoleculeFacts.entries())
    .map(([activeSubstance, group]) => {
      const spend = group.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
      const previousSpend = previousMoleculeSpend.get(activeSubstance) ?? 0;
      return {
        active_substance: activeSubstance,
        atc_code: group.find((fact) => fact.atc5)?.atc5 ?? group[0]?.atc4 ?? null,
        spend_eur: spend,
        spend_yoy: ratio(spend, previousSpend),
        biosimilar_penetration: biosimilarPenetration(group).value,
        opportunity_eur: opportunityByMolecule.get(activeSubstance) ?? 0,
      };
    })
    .sort((a, b) => b.spend_eur - a.spend_eur)
    .slice(0, 8);

  const reviewSignals = buildReviewSignals({
    biosimilarRows: currentBio,
    unresolvedRecordCount,
    currentRecordCount: currentFacts.length,
    uploads,
    objectives: objectives.filter(
      (objective) => latestYear === null || new Date(objective.period_end).getUTCFullYear() >= latestYear,
    ),
  });

  return {
    flows: spendFlowsFromFacts(currentFacts),
    latest_year: latestYear,
    total_spend_eur: totalSpendEur,
    total_packs: totalPacks,
    cost_per_pack_eur: totalPacks > 0 ? totalSpendEur / totalPacks : null,
    record_count: currentFacts.length,
    source_version_count: sourceVersionCount,
    geography_count: geographyCount,
    latest_loaded_at:
      loadedTimes.length > 0 ? new Date(Math.max(...loadedTimes)).toISOString() : null,
    normalized_record_count: normalizedRecordCount,
    normalization_eligible_count: normalizationEligible.length,
    normalization_coverage:
      normalizationEligible.length > 0
        ? normalizedRecordCount / normalizationEligible.length
        : null,
    unresolved_record_count: unresolvedRecordCount,
    trend_granularity: trendGranularity,
    trend,
    atc_breakdown: atcBreakdown,
    previous_year: previousYear,
    spend_yoy: ratio(totalSpendEur, previousSpendEur),
    packs_yoy: ratio(totalPacks, previousPacks),
    biosimilar_penetration: overallPenetration.value,
    biosimilar_penetration_basis: overallPenetration.basis,
    biosimilar_opportunity_eur: biosimilarOpportunity,
    active_review_count: reviewSignals.length,
    review_items: reviewSignals.slice(0, 6),
    top_molecules: topMolecules,
  };
}

function costPerMg(facts: CanonicalFact[]): number | null {
  const volume = normalizedVolumeMg(facts);
  const spend = facts.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
  if (volume > 0 && spend > 0) return spend / volume;

  const rows = facts.filter((fact) => (fact.cost_per_mg ?? 0) > 0);
  const weight = rows.reduce((sum, fact) => sum + Math.max(fact.quantity_packs ?? 1, 1), 0);
  if (weight === 0) return null;
  return rows.reduce(
    (sum, fact) => sum + fact.cost_per_mg! * Math.max(fact.quantity_packs ?? 1, 1),
    0,
  ) / weight;
}

function buildBiosimilarRows(
  facts: CanonicalFact[],
  latestYear: number | null,
): BiosimilarComparisonRow[] {
  if (latestYear === null) return [];

  const byMolecule = new Map<string, CanonicalFact[]>();
  for (const f of facts) {
    if (!f.active_substance) continue;
    const list = byMolecule.get(f.active_substance) ?? [];
    list.push(f);
    byMolecule.set(f.active_substance, list);
  }

  const out: BiosimilarComparisonRow[] = [];
  for (const [activeSubstance, group] of byMolecule) {
    const orig = group.filter((f) => f.originator_flag === true || f.biosimilar_flag === false);
    const bio = group.filter((f) => f.biosimilar_flag);

    if (bio.length === 0) continue;

    const origSpend = orig.reduce((sum, f) => sum + (f.total_cost_eur ?? 0), 0);
    const bioSpend = bio.reduce((sum, f) => sum + (f.total_cost_eur ?? 0), 0);
    const origCostPerMg = costPerMg(orig);
    const bioCostPerMg = costPerMg(bio);

    const totalSpend = origSpend + bioSpend;
    const originatorShare = totalSpend > 0 ? origSpend / totalSpend : 0;
    const penetration = biosimilarPenetration(group);
    const coverage = normalizationCoverage(group);
    const totalVolume = normalizedVolumeMg(group);

    const potentialSavings =
      origCostPerMg !== null && bioCostPerMg !== null && origCostPerMg > bioCostPerMg
        ? origSpend * (1 - bioCostPerMg / origCostPerMg)
        : 0;

    out.push({
      active_substance: activeSubstance,
      atc4: group[0]?.atc4 ?? null,
      originator_cost_per_mg: origCostPerMg,
      biosimilar_cost_per_mg: bioCostPerMg,
      originator_spend_eur: origSpend,
      biosimilar_spend_eur: bioSpend,
      originator_share: originatorShare,
      potential_savings_eur: potentialSavings,
      biosimilar_penetration: penetration.value,
      penetration_basis: penetration.basis ?? "spend",
      normalized_volume_mg: totalVolume > 0 ? totalVolume : null,
      normalization_coverage: coverage,
      evidence_status:
        origCostPerMg !== null && bioCostPerMg !== null
          ? coverage !== null && coverage >= 0.8
            ? "ready"
            : "partial"
          : "unresolved",
      latest_year: latestYear,
    });
  }

  return out.sort((a, b) => b.potential_savings_eur - a.potential_savings_eur);
}

export async function getBiosimilarComparison(): Promise<BiosimilarComparisonRow[]> {
  const facts = await selectCanonicalFacts();
  const years = facts.map((fact) => fact.year).filter(Number.isFinite);
  const latestYear = years.length > 0 ? Math.max(...years) : null;
  return buildBiosimilarRows(
    latestYear === null ? [] : facts.filter((fact) => fact.year === latestYear),
    latestYear,
  );
}

function compactEur(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function buildReviewSignals({
  biosimilarRows,
  unresolvedRecordCount,
  currentRecordCount,
  uploads,
  objectives,
}: {
  biosimilarRows: BiosimilarComparisonRow[];
  unresolvedRecordCount: number;
  currentRecordCount: number;
  uploads: UploadRecord[];
  objectives: Objective[];
}): ReviewSignal[] {
  const signals: ReviewSignal[] = biosimilarRows
    .filter((row) => row.potential_savings_eur > 0)
    .slice(0, 5)
    .map((row) => ({
      id: `bio-${row.active_substance}`,
      kind: "biosimilar" as const,
      title: row.active_substance,
      context: `Confronto originator/biosimilare su base ${row.penetration_basis}.`,
      value_label: `${compactEur(row.potential_savings_eur)} opportunità`,
      href: "/dashboard-review/biosimilar-to-euros",
      severity: row.potential_savings_eur >= 100000 ? "high" as const : "medium" as const,
    }));

  if (unresolvedRecordCount > 0) {
    signals.push({
      id: "quality-unresolved",
      kind: "quality",
      title: "Normalizzazione da completare",
      context: `${unresolvedRecordCount} record non sono ancora idonei a un confronto €/mg o €/DDD.`,
      value_label: currentRecordCount > 0
        ? `${Math.round((unresolvedRecordCount / currentRecordCount) * 100)}% dei record`
        : `${unresolvedRecordCount} record`,
      href: "/dashboard-review/dati",
      severity: "high",
    });
  }

  const discrepancies = uploads.filter((upload) => upload.status === "discrepancy_found");
  if (discrepancies.length > 0) {
    signals.push({
      id: "upload-discrepancies",
      kind: "upload",
      title: "Scarti di riconciliazione",
      context: "Uno o più caricamenti richiedono una verifica prima della pubblicazione.",
      value_label: `${discrepancies.length} file`,
      href: "/dashboard-review/dati",
      severity: "high",
    });
  }

  for (const objective of objectives.slice(0, 3)) {
    signals.push({
      id: `objective-${objective.id}`,
      kind: "objective",
      title: objective.metric,
      context: `Periodo ${objective.period_start} – ${objective.period_end}`,
      value_label: `Target ${objective.target_value}`,
      href: "/dashboard-review/obiettivi",
      severity: "info",
    });
  }

  const priority = { high: 0, medium: 1, info: 2 } as const;
  return signals.sort((a, b) => priority[a.severity] - priority[b.severity]);
}

export async function getObjectives(): Promise<Objective[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("objectives")
    .select("*")
    .order("period_start", { ascending: false });
  if (error) throw new Error(`objectives query failed: ${error.message}`);
  return (data ?? []) as Objective[];
}

// Calls the my_objective_rank(p_metric) SECURITY DEFINER function (see
// supabase_schema.sql, section 6). It derives the caller's own org from
// auth.uid() server-side and returns only the caller's own row — never
// another org's identity or value. null means no ranking is available for
// this metric (no approved ASL membership, or no confirmed formula for an
// objective without an atc_scope), which the UI must show distinctly from
// an actual last-place rank.
export async function getObjectiveRank(metric: string): Promise<ObjectiveRank | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_objective_rank", { p_metric: metric });
  if (error) {
    console.error("my_objective_rank failed:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ObjectiveRank | undefined) ?? null;
}

export async function getUploads(): Promise<UploadRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("uploads")
    .select("*")
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(`uploads query failed: ${error.message}`);
  return (data ?? []) as UploadRecord[];
}

export async function getBenchmarkData(): Promise<BenchmarkData> {
  const [facts, org] = await Promise.all([selectCanonicalFacts(), getCurrentOrg()]);
  const years = facts.map((fact) => fact.year).filter(Number.isFinite);
  const latestYear = years.length > 0 ? Math.max(...years) : null;
  if (!org || latestYear === null) {
    return {
      latest_year: latestYear,
      rows: [],
      peer_count: 0,
      median_spend_eur: null,
      median_cost_per_pack_eur: null,
      median_biosimilar_penetration: null,
      benchmark_available: false,
      limitation: "Nessun perimetro territoriale disponibile.",
    };
  }

  const supabase = await createClient();
  let orgQuery = supabase
    .from("organizations")
    .select("org_code, org_name, org_type, region_code")
    .eq("org_type", "asl");
  if (org.region_code) orgQuery = orgQuery.eq("region_code", org.region_code);
  const { data: organizationRows } = await orgQuery;
  const orgNames = new Map(
    ((organizationRows ?? []) as Organization[]).map((item) => [item.org_code, item.org_name]),
  );

  const previousYear = [...new Set(years)]
    .filter((year) => year < latestYear)
    .sort((a, b) => b - a)[0] ?? null;
  const current = facts.filter((fact) => fact.year === latestYear && fact.asl_code);
  const previous = previousYear === null
    ? []
    : facts.filter((fact) => fact.year === previousYear && fact.asl_code);
  const byOrg = new Map<string, CanonicalFact[]>();
  const previousSpend = new Map<string, number>();
  for (const fact of current) {
    const code = fact.asl_code!;
    const group = byOrg.get(code) ?? [];
    group.push(fact);
    byOrg.set(code, group);
  }
  for (const fact of previous) {
    const code = fact.asl_code!;
    previousSpend.set(code, (previousSpend.get(code) ?? 0) + (fact.total_cost_eur ?? 0));
  }

  const baseRows = Array.from(byOrg.entries()).map(([code, group]) => {
    const spend = group.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
    const packs = group.reduce((sum, fact) => sum + (fact.quantity_packs ?? 0), 0);
    return {
      org_code: code,
      org_name: orgNames.get(code) ?? code,
      spend_eur: spend,
      packs,
      spend_yoy: ratio(spend, previousSpend.get(code) ?? 0),
      cost_per_pack_eur: packs > 0 ? spend / packs : null,
      biosimilar_penetration: biosimilarPenetration(group).value,
      normalization_coverage: normalizationCoverage(group),
      is_current_org: org.org_code === code,
    };
  });
  const medianSpend = median(baseRows.map((row) => row.spend_eur));
  const rows: BenchmarkRow[] = baseRows
    .map((row) => ({
      ...row,
      spend_index: medianSpend && medianSpend > 0 ? (row.spend_eur / medianSpend) * 100 : null,
    }))
    .sort((a, b) => b.spend_eur - a.spend_eur);
  const benchmarkAvailable = rows.length > 1;

  return {
    latest_year: latestYear,
    rows,
    peer_count: org.org_type === "asl" ? Math.max(rows.length - 1, 0) : rows.length,
    median_spend_eur: medianSpend,
    median_cost_per_pack_eur: median(
      rows.map((row) => row.cost_per_pack_eur).filter((value): value is number => value !== null),
    ),
    median_biosimilar_penetration: median(
      rows
        .map((row) => row.biosimilar_penetration)
        .filter((value): value is number => value !== null),
    ),
    benchmark_available: benchmarkAvailable,
    limitation: benchmarkAvailable
      ? null
      : org.org_type === "asl"
        ? "La policy RLS dell’ASL espone solo i dati della propria azienda. Il confronto identificabile è disponibile esclusivamente alla Regione."
        : "Servono almeno due ASL con dati nello stesso periodo per costruire il benchmark.",
  };
}

const UNCLASSIFIED = "__unclassified__";

function filterExplorerFacts(facts: CanonicalFact[], filters: ExplorerFilters): CanonicalFact[] {
  const matches = (actual: string | null, expected: string | undefined) =>
    !expected || (actual ?? UNCLASSIFIED) === expected;
  return facts.filter(
    (fact) =>
      matches(fact.asl_code, filters.asl) &&
      matches(fact.atc1, filters.atc1) &&
      matches(fact.atc2, filters.atc2) &&
      matches(fact.atc3, filters.atc3) &&
      matches(fact.atc4, filters.atc4) &&
      matches(fact.atc5, filters.atc5) &&
      matches(fact.active_substance, filters.molecule),
  );
}

function explorerValue(fact: CanonicalFact, level: ExplorerLevel): string {
  if (level === "asl") return fact.asl_code ?? UNCLASSIFIED;
  if (level === "molecule") return fact.active_substance ?? UNCLASSIFIED;
  if (level === "aic") return fact.aic ?? UNCLASSIFIED;
  return fact[level] ?? UNCLASSIFIED;
}

function explorerLabel(
  code: string,
  level: ExplorerLevel,
  facts: CanonicalFact[],
  orgNames: Map<string, string>,
): string {
  if (code === UNCLASSIFIED) return "Non classificato";
  if (level === "asl") return orgNames.get(code) ?? code;
  if (level === "atc1") return ATC1_NAMES[code] ?? code;
  if (level === "aic") {
    const match = facts.find((fact) => fact.aic === code);
    return match?.brand_name ?? match?.product_description_raw ?? code;
  }
  return code;
}

function explorerHref(filters: ExplorerFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/dashboard-review/ricerca?${query}` : "/dashboard-review/ricerca";
}

export async function getExplorerData(filters: ExplorerFilters): Promise<ExplorerData> {
  const [facts, org] = await Promise.all([selectCanonicalFacts(), getCurrentOrg()]);
  const years = facts.map((fact) => fact.year).filter(Number.isFinite);
  const latestYear = years.length > 0 ? Math.max(...years) : null;
  const levels: ExplorerLevel[] = org?.org_type === "regione"
    ? ["asl", "atc1", "atc2", "atc3", "atc4", "atc5", "molecule", "aic"]
    : ["atc1", "atc2", "atc3", "atc4", "atc5", "molecule", "aic"];
  const filterOrder: Array<[ExplorerLevel, keyof ExplorerFilters]> = [
    ["asl", "asl"],
    ["atc1", "atc1"],
    ["atc2", "atc2"],
    ["atc3", "atc3"],
    ["atc4", "atc4"],
    ["atc5", "atc5"],
    ["molecule", "molecule"],
  ];
  const level = levels.find((candidate) => {
    const filterKey = filterOrder.find(([item]) => item === candidate)?.[1];
    return candidate === "aic" || (filterKey ? !filters[filterKey] : false);
  }) ?? "aic";

  const supabase = await createClient();
  let orgQuery = supabase
    .from("organizations")
    .select("org_code, org_name, org_type, region_code")
    .eq("org_type", "asl");
  if (org?.region_code) orgQuery = orgQuery.eq("region_code", org.region_code);
  const { data: organizationRows } = await orgQuery;
  const orgNames = new Map(
    ((organizationRows ?? []) as Organization[]).map((item) => [item.org_code, item.org_name]),
  );

  const previousYear = latestYear === null
    ? null
    : [...new Set(years)].filter((year) => year < latestYear).sort((a, b) => b - a)[0] ?? null;
  const currentBase = filterExplorerFacts(
    latestYear === null ? [] : facts.filter((fact) => fact.year === latestYear),
    filters,
  );
  const previousBase = filterExplorerFacts(
    previousYear === null ? [] : facts.filter((fact) => fact.year === previousYear),
    filters,
  );
  const totalSpend = currentBase.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
  const currentGroups = new Map<string, CanonicalFact[]>();
  const previousSpend = new Map<string, number>();
  for (const fact of currentBase) {
    const key = explorerValue(fact, level);
    const group = currentGroups.get(key) ?? [];
    group.push(fact);
    currentGroups.set(key, group);
  }
  for (const fact of previousBase) {
    const key = explorerValue(fact, level);
    previousSpend.set(key, (previousSpend.get(key) ?? 0) + (fact.total_cost_eur ?? 0));
  }
  const filterKey = filterOrder.find(([candidate]) => candidate === level)?.[1];
  const nodes: ExplorerNode[] = Array.from(currentGroups.entries())
    .map(([key, group]) => {
      const spend = group.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0);
      const packs = group.reduce((sum, fact) => sum + (fact.quantity_packs ?? 0), 0);
      const nextFilters = filterKey ? { ...filters, [filterKey]: key } : filters;
      return {
        key,
        code: key === UNCLASSIFIED ? "—" : key,
        label: explorerLabel(key, level, group, orgNames),
        href: level === "aic" ? null : explorerHref(nextFilters),
        spend_eur: spend,
        spend_share: totalSpend > 0 ? spend / totalSpend : 0,
        packs,
        spend_yoy: ratio(spend, previousSpend.get(key) ?? 0),
        biosimilar_penetration: biosimilarPenetration(group).value,
        normalization_coverage: normalizationCoverage(group),
        record_count: group.length,
      };
    })
    .sort((a, b) => b.spend_eur - a.spend_eur);

  const breadcrumbs = [{ label: org?.org_name ?? "Perimetro", href: "/dashboard-review/ricerca" }];
  const accumulated: ExplorerFilters = {};
  for (const [candidate, key] of filterOrder) {
    const value = filters[key];
    if (!value || !levels.includes(candidate)) continue;
    accumulated[key] = value;
    breadcrumbs.push({
      label: explorerLabel(value, candidate, currentBase, orgNames),
      href: explorerHref(accumulated),
    });
  }

  return {
    latest_year: latestYear,
    level,
    level_label: EXPLORER_LEVEL_LABEL[level],
    breadcrumbs,
    nodes,
    total_spend_eur: totalSpend,
    total_packs: currentBase.reduce((sum, fact) => sum + (fact.quantity_packs ?? 0), 0),
    filters,
  };
}

export async function getLineageData(): Promise<LineageData> {
  const facts = await selectCanonicalFacts();
  const bySource = new Map<string, CanonicalFact[]>();
  for (const fact of facts) {
    const group = bySource.get(fact.source_version_id) ?? [];
    group.push(fact);
    bySource.set(fact.source_version_id, group);
  }
  const sources: LineageSource[] = Array.from(bySource.entries())
    .map(([sourceVersionId, group]) => {
      const timestamps = group
        .map((fact) => Date.parse(fact.created_at))
        .filter(Number.isFinite);
      const years = group.map((fact) => fact.year).filter(Number.isFinite);
      return {
        source_version_id: sourceVersionId,
        latest_loaded_at: timestamps.length > 0
          ? new Date(Math.max(...timestamps)).toISOString()
          : null,
        first_year: years.length > 0 ? Math.min(...years) : null,
        latest_year: years.length > 0 ? Math.max(...years) : null,
        record_count: group.length,
        spend_eur: group.reduce((sum, fact) => sum + (fact.total_cost_eur ?? 0), 0),
        geography_count: new Set(
          group.map((fact) => fact.asl_code ?? fact.region_code).filter(Boolean),
        ).size,
        normalized_coverage: normalizationCoverage(group),
        unresolved_count: group.filter(isUnresolved).length,
      };
    })
    .sort((a, b) => (b.latest_loaded_at ?? "").localeCompare(a.latest_loaded_at ?? ""));
  const allTimestamps = facts.map((fact) => Date.parse(fact.created_at)).filter(Number.isFinite);

  return {
    sources,
    total_records: facts.length,
    latest_loaded_at: allTimestamps.length > 0
      ? new Date(Math.max(...allTimestamps)).toISOString()
      : null,
    unresolved_records: facts.filter(isUnresolved).length,
    normalization_coverage: normalizationCoverage(facts),
  };
}

export async function getReviewWorkspaceData(): Promise<ReviewWorkspaceData> {
  const [facts, objectives, uploads] = await Promise.all([
    selectCanonicalFacts(),
    getObjectives(),
    getUploads(),
  ]);
  const years = facts.map((fact) => fact.year).filter(Number.isFinite);
  const latestYear = years.length > 0 ? Math.max(...years) : null;
  const current = latestYear === null ? [] : facts.filter((fact) => fact.year === latestYear);
  const signals = buildReviewSignals({
    biosimilarRows: buildBiosimilarRows(current, latestYear),
    unresolvedRecordCount: current.filter(isUnresolved).length,
    currentRecordCount: current.length,
    uploads,
    objectives: objectives.filter(
      (objective) => latestYear === null || new Date(objective.period_end).getUTCFullYear() >= latestYear,
    ),
  });
  return {
    latest_year: latestYear,
    signals,
    objectives,
    discrepancy_uploads: uploads.filter((upload) => upload.status === "discrepancy_found"),
    high_priority_count: signals.filter((signal) => signal.severity === "high").length,
  };
}

interface CategoryTotals {
  cost: number;
  ddd: number;
  bedDays: number;
}

function indicatorsFromTotals(t: CategoryTotals | undefined): AntibioticIndicatorSet | null {
  if (!t) return null;
  return {
    dddPer100BedDays: t.bedDays > 0 ? (t.ddd / t.bedDays) * 100 : null,
    costPerBedDay: t.bedDays > 0 ? t.cost / t.bedDays : null,
    costPerDdd: t.ddd > 0 ? t.cost / t.ddd : null,
  };
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

// Reads antibiotic_consumption_fact directly — no mock layer, RLS is the
// only enforcement, same as every other query in this file. ASL-level
// rows only (unit_code is null): department-level data isn't loaded yet,
// so nothing here should imply it exists.
export async function getAntibioticStewardship(): Promise<AntibioticStewardshipData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("antibiotic_consumption_fact")
    .select("*")
    .is("unit_code", null)
    .gte("year", 2023)
    .lte("year", 2025);
  if (error) throw new Error(`antibiotic_consumption_fact query failed: ${error.message}`);
  const rows = (data ?? []) as AntibioticConsumptionFact[];

  const org = await getCurrentOrg();
  const empty: AntibioticStewardshipData = {
    awareByYear: [],
    latestYear: null,
    orgIndicators: null,
    regionalAverage: null,
  };
  if (!org || rows.length === 0) return empty;

  const isRegione = org.org_type === "regione";
  // An asl-type caller's RLS-scoped query only ever returns their own
  // org's rows anyway. A regione-type caller has no antibiotic row of its
  // own (data is uploaded per ASL) — RLS already hands them every ASL in
  // their region, so "their view" is the pooled total across those ASLs,
  // the same org.region_code join pattern the RLS policy itself uses.
  const ownRows = isRegione ? rows : rows.filter((r) => r.org_code === org.org_code);

  const yearGroups = new Map<number, Map<AwareCategory, number>>();
  for (const r of ownRows) {
    const catMap = yearGroups.get(r.year) ?? new Map<AwareCategory, number>();
    catMap.set(r.aware_category, (catMap.get(r.aware_category) ?? 0) + (r.cost_eur ?? 0));
    yearGroups.set(r.year, catMap);
  }

  const awareByYear: AwareYearRow[] = Array.from(yearGroups.entries())
    .map(([year, cats]) => {
      const access = cats.get("A") ?? 0;
      const watch = cats.get("W") ?? 0;
      const reserve = cats.get("R") ?? 0;
      const total = cats.get("T");
      // No "T" row for this year means there's nothing to check the
      // breakdown against — show A/W/R as given rather than guessing at a
      // gap that can't actually be computed.
      const gap = total !== undefined ? total - (access + watch + reserve) : 0;
      return {
        year,
        access,
        watch,
        reserve,
        unclassified: Math.max(gap, 0),
        hasNegativeGap: gap < 0,
      };
    })
    .sort((a, b) => a.year - b.year);

  // Org-level indicators come from the latest year's "T" (total) row —
  // DDD/100 bed-days, spend/bed-day and spend/DDD are overall stewardship
  // indicators, not per-AWaRe-category figures.
  const ownTotalsByYear = new Map<number, CategoryTotals>();
  for (const r of ownRows) {
    if (r.aware_category !== "T") continue;
    const cur = ownTotalsByYear.get(r.year) ?? { cost: 0, ddd: 0, bedDays: 0 };
    cur.cost += r.cost_eur ?? 0;
    cur.ddd += r.ddd_count ?? 0;
    cur.bedDays += r.bed_days ?? 0;
    ownTotalsByYear.set(r.year, cur);
  }
  const latestYear = ownTotalsByYear.size > 0 ? Math.max(...ownTotalsByYear.keys()) : null;
  const orgIndicators = latestYear !== null ? indicatorsFromTotals(ownTotalsByYear.get(latestYear)) : null;

  // Regional average: the mean of each OTHER org's own indicator for the
  // same year (not a pooled ratio-of-sums) — for an asl-type caller,
  // peerRows is always empty, since RLS never hands them another org's
  // rows, so no benchmark is fabricated from data that isn't there.
  let regionalAverage: AntibioticStewardshipData["regionalAverage"] = null;
  if (latestYear !== null) {
    const peerRows = isRegione ? rows : rows.filter((r) => r.org_code !== org.org_code);
    const totalsByOrg = new Map<string, CategoryTotals>();
    for (const r of peerRows) {
      if (r.aware_category !== "T" || r.year !== latestYear) continue;
      totalsByOrg.set(r.org_code, {
        cost: r.cost_eur ?? 0,
        ddd: r.ddd_count ?? 0,
        bedDays: r.bed_days ?? 0,
      });
    }
    const perOrg = Array.from(totalsByOrg.values())
      .map(indicatorsFromTotals)
      .filter((i): i is AntibioticIndicatorSet => i !== null);

    if (perOrg.length > 0) {
      regionalAverage = {
        dddPer100BedDays: average(perOrg.map((i) => i.dddPer100BedDays).filter((v): v is number => v !== null)),
        costPerBedDay: average(perOrg.map((i) => i.costPerBedDay).filter((v): v is number => v !== null)),
        costPerDdd: average(perOrg.map((i) => i.costPerDdd).filter((v): v is number => v !== null)),
        peerOrgCount: perOrg.length,
      };
    }
  }

  return { awareByYear, latestYear, orgIndicators, regionalAverage };
}
