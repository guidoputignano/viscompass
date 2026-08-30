// Typed data-access layer for the dashboard-review modules.
//
// canonical_fact has no real rows yet, so every function below returns
// mock data shaped exactly like the real schema (see types.ts) and reads
// from the fixtures in mock-data.ts, filtered by `scope` the same way the
// real RLS policies would scope a live query. When canonical_fact is
// populated, each function body becomes a Supabase query returning this
// same shape — callers (the page/components) do not need to change.

import { MOCK_CANONICAL_FACTS, MOCK_OBJECTIVES, MOCK_ORGS, MOCK_UPLOADS } from "./mock-data";
import type {
  BiosimilarComparisonRow,
  CanonicalFact,
  FeatureRequestSubmission,
  Objective,
  Organization,
  SankeyData,
  Scope,
  UploadRecord,
} from "./types";

const DEFAULT_ORG_CODE = "ASL01";

export function listScopeOptions(): Organization[] {
  return MOCK_ORGS;
}

// Mirrors how a real session resolves to a scope: look up the org the
// caller is asking to view as. Falls back to a default org rather than
// throwing, since this is a review surface with no real session yet.
export async function resolveScope(orgCode?: string): Promise<Scope> {
  const org =
    MOCK_ORGS.find((o) => o.org_code === orgCode) ??
    MOCK_ORGS.find((o) => o.org_code === DEFAULT_ORG_CODE)!;
  return { org_code: org.org_code, org_type: org.org_type, region_code: org.region_code };
}

// Same predicate the canonical_fact RLS policy encodes: an ASL-scoped
// caller sees only its own asl_code; a regione-scoped caller sees every
// ASL's rows sharing its region_code.
function factsInScope(scope: Scope): CanonicalFact[] {
  return MOCK_CANONICAL_FACTS.filter((f) =>
    scope.org_type === "asl"
      ? f.asl_code === scope.org_code
      : f.region_code === scope.region_code,
  );
}

export async function getSpendFlows(scope: Scope): Promise<SankeyData> {
  const facts = factsInScope(scope);

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

export async function searchMolecules(query: string, scope: Scope): Promise<CanonicalFact[]> {
  const facts = factsInScope(scope);
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return facts.filter((f) =>
    [f.active_substance, f.brand_name, f.aic, f.atc4, f.atc5]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(q)),
  );
}

export async function getBiosimilarComparison(scope: Scope): Promise<BiosimilarComparisonRow[]> {
  const facts = factsInScope(scope);

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

export async function getObjectives(scope: Scope): Promise<Objective[]> {
  return MOCK_OBJECTIVES.filter((o) => o.region_code === scope.region_code);
}

export async function getUploads(scope: Scope): Promise<UploadRecord[]> {
  // Deliberately a strict org_code match, no region-wide expansion — this
  // mirrors the real uploads RLS policy exactly (verified: a regione-scoped
  // caller does NOT automatically see ASL-level uploads, unlike
  // canonical_fact/objectives).
  return MOCK_UPLOADS.filter((u) => u.org_code === scope.org_code);
}

// Mock submit — logs and returns success, matching the shape a real insert
// would return. status/response/responded_by/responded_at are never set
// here: they either default ('pending') or must stay null on insert per
// the feature_requests RLS policy.
export async function submitFeatureRequest(
  payload: FeatureRequestSubmission,
): Promise<{ ok: true }> {
  await new Promise((r) => setTimeout(r, 300));
  console.log("[mock] feature_requests insert (not persisted):", payload);
  return { ok: true };
}
