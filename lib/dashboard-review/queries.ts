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

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import type {
  AntibioticConsumptionFact,
  AntibioticIndicatorSet,
  AntibioticStewardshipData,
  AwareCategory,
  AwareYearRow,
  BiosimilarComparisonRow,
  CanonicalFact,
  Objective,
  ObjectiveRank,
  SankeyData,
  UploadRecord,
} from "./types";

async function selectCanonicalFacts(): Promise<CanonicalFact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("canonical_fact").select("*");
  if (error) throw new Error(`canonical_fact query failed: ${error.message}`);
  return (data ?? []) as CanonicalFact[];
}

export async function getSpendFlows(): Promise<SankeyData> {
  const facts = await selectCanonicalFacts();

  const channels = Array.from(new Set(facts.map((f) => f.channel ?? "Non specificato")));
  const atc1Names: Record<string, string> = { L: "Antineoplastici e immunomodulatori", J: "Antimicrobici generali" };
  const categories = Array.from(new Set(facts.map((f) => atc1Names[f.atc1 ?? ""] ?? f.atc1 ?? "Altro")));
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
    const category = atc1Names[f.atc1 ?? ""] ?? f.atc1 ?? "Altro";
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

export async function getBiosimilarComparison(): Promise<BiosimilarComparisonRow[]> {
  const facts = await selectCanonicalFacts();

  const byMolecule = new Map<string, CanonicalFact[]>();
  for (const f of facts) {
    if (!f.active_substance) continue;
    const list = byMolecule.get(f.active_substance) ?? [];
    list.push(f);
    byMolecule.set(f.active_substance, list);
  }

  const out: BiosimilarComparisonRow[] = [];
  for (const [activeSubstance, group] of byMolecule) {
    const orig = group.filter((f) => !f.biosimilar_flag);
    const bio = group.filter((f) => f.biosimilar_flag);

    const origSpend = orig.reduce((sum, f) => sum + (f.total_cost_eur ?? 0), 0);
    const bioSpend = bio.reduce((sum, f) => sum + (f.total_cost_eur ?? 0), 0);
    const origCostPerMg = orig[0]?.cost_per_mg ?? null;
    const bioCostPerMg = bio[0]?.cost_per_mg ?? null;

    const totalSpend = origSpend + bioSpend;
    const originatorShare = totalSpend > 0 ? origSpend / totalSpend : 0;

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
    });
  }

  return out.sort((a, b) => b.potential_savings_eur - a.potential_savings_eur);
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
