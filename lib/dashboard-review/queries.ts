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
import type {
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
