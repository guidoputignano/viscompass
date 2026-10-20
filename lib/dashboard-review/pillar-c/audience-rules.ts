/** Pillar C audience decision (recommendation 5). Pure: no session, no I/O, no figure.
 *
 * Who decides what. The DATABASE decides which units a session may read:
 * public.pillar_c_scoped_units() and the storage.objects SELECT policy
 * (migration 20261020120000, owner decision O2). This module only:
 *   1. keeps the reviewer path exactly as before (approved membership plus
 *      REVIEWER_EMAILS/ADMIN_EMAILS: the documented application-level exception);
 *   2. refuses scoped delivery outside a Vercel production deployment;
 *   3. checks that the units the database returned are exactly the units the
 *      caller's organisation is entitled to (O1/O3), and otherwise fails closed
 *      to the public forecast. A coherent answer never widens anything: the
 *      Storage policy is consulted again on every object read.
 * The client never chooses a role, an organisation or a unit. */
import { orgDisplayName } from "@/lib/analytics/org-pseudonym";
import type { Organization } from "@/lib/dashboard-review/types";
import { C_ORGS } from "@/lib/dashboard-review/pillar-c/review";
import { C_ORG_LABELS } from "@/lib/dashboard-review/pillar-c/reviewer-labels";
import { C_PLANNING_LABELS } from "@/lib/dashboard-review/pillar-c/planning";
import {
  C_SCOPED_AGGREGATE, C_SCOPED_ASL_UNITS, C_SCOPED_REGION_CODE, C_SCOPED_REGIONE_CODE, C_SCOPED_UNITS, C_SCOPED_UNIT_OF_CODE,
  isCScopedAslCode, isCScopedUnit, type CScopedAslCode, type CScopedAslUnit, type CScopedUnit,
} from "@/lib/dashboard-review/pillar-c/scoped-units";

export type PillarCForecastOnlyReason =
  /** Not a Vercel production deployment: preview, development and local runs never read scoped data. */
  | "not_production"
  /** An organisation outside the five that O1/O3 cover (another region, another type, an unmapped code). */
  | "unmapped"
  /** The database gave no unit: rollout switch or allow-list row absent, or not exactly one approved membership. */
  | "not_enabled"
  /** The database answered with units that are not exactly this organisation's entitlement. */
  | "units_mismatch"
  /** The units function could not be called or answered malformed data (for example before the migration). */
  | "units_unavailable";

export type PillarCAziendaAudience = {
  kind: "azienda"; orgCode: CScopedAslCode; orgName: string; unit: CScopedAslUnit;
  /** Display and request order: own unit first (the default), then the aggregate. */
  units: readonly [CScopedAslUnit, typeof C_SCOPED_AGGREGATE];
};
export type PillarCRegioneAudience = {
  kind: "regione"; orgCode: typeof C_SCOPED_REGIONE_CODE;
  /** Display and request order: the aggregate (the default), then ASL 1–4 in fixed numeric order, never by value. */
  units: readonly [typeof C_SCOPED_AGGREGATE, ...CScopedAslUnit[]];
};
export type PillarCScopedAudience = PillarCAziendaAudience | PillarCRegioneAudience;
export type PillarCAudience = { kind: "reviewer" } | PillarCScopedAudience | { kind: "forecast_only"; reason: PillarCForecastOnlyReason };
export type PillarCScopedCandidate = { kind: "azienda"; orgCode: CScopedAslCode; orgName: string; unit: CScopedAslUnit } | { kind: "regione" };
export type PillarCAudienceGate = { decided: PillarCAudience | null } | { candidate: PillarCScopedCandidate };

/** The unit of an Azienda code, cross-checked against the reviewed pseudonym («ASL n» ⇔ `asl-n`). */
export function cScopedUnitOfCode(code: string): CScopedAslUnit | null {
  if (!isCScopedAslCode(code)) return null;
  const unit = C_SCOPED_UNIT_OF_CODE[code], label = orgDisplayName(code, null);
  return label === `ASL ${unit.slice(4)}` ? unit : null;
}

/** First step, before any database call. Reviewers never reach the units function. */
export function pillarCAudienceGate(input: { org: Organization | null; reviewer: boolean; admin: boolean; production: boolean }): PillarCAudienceGate {
  const { org } = input;
  // An approved membership is required even for an allow-listed reviewer (unchanged).
  if (!org) return { decided: null };
  if (input.reviewer || input.admin) return { decided: { kind: "reviewer" } };
  if (!input.production) return { decided: { kind: "forecast_only", reason: "not_production" } };
  if (org.region_code !== C_SCOPED_REGION_CODE) return { decided: { kind: "forecast_only", reason: "unmapped" } };
  if (org.org_type === "asl") {
    const unit = cScopedUnitOfCode(org.org_code);
    if (!unit || !isCScopedAslCode(org.org_code)) return { decided: { kind: "forecast_only", reason: "unmapped" } };
    // The viewer's own organisation is shown by its real name (O1); a blank name falls back to its code, never to a pseudonym.
    return { candidate: { kind: "azienda", orgCode: org.org_code, orgName: orgDisplayName(org.org_code, org.org_code, org.org_name), unit } };
  }
  if (org.org_type === "regione" && org.org_code === C_SCOPED_REGIONE_CODE) return { candidate: { kind: "regione" } };
  return { decided: { kind: "forecast_only", reason: "unmapped" } };
}

/** The units function answers a sorted, distinct text[]; anything else is treated as unavailable, never as an entitlement. */
export function parseCScopedUnits(value: unknown): CScopedUnit[] | null {
  if (!Array.isArray(value) || value.length > C_SCOPED_UNITS.length || !value.every(isCScopedUnit)) return null;
  return new Set(value).size === value.length ? [...value] : null;
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && b.every((u) => a.includes(u));

/** Second step: the units the database returned for this session. */
export function pillarCScopedAudience(candidate: PillarCScopedCandidate, rawUnits: unknown): PillarCAudience {
  const units = parseCScopedUnits(rawUnits);
  if (!units) return { kind: "forecast_only", reason: "units_unavailable" };
  if (units.length === 0) return { kind: "forecast_only", reason: "not_enabled" };
  if (candidate.kind === "azienda") {
    const expected = [candidate.unit, C_SCOPED_AGGREGATE] as const;
    return sameSet(units, expected) ? { kind: "azienda", orgCode: candidate.orgCode, orgName: candidate.orgName, unit: candidate.unit, units: expected } : { kind: "forecast_only", reason: "units_mismatch" };
  }
  const expected = [C_SCOPED_AGGREGATE, ...C_SCOPED_ASL_UNITS] as const;
  return sameSet(units, expected) ? { kind: "regione", orgCode: C_SCOPED_REGIONE_CODE, units: expected } : { kind: "forecast_only", reason: "units_mismatch" };
}

/** Both steps, for callers that already hold the units (tests, the page model). `units` is read only for a candidate. */
export function decidePillarCAudience(input: { org: Organization | null; reviewer: boolean; admin: boolean; production: boolean; units?: unknown }): PillarCAudience | null {
  const gate = pillarCAudienceGate(input);
  return "decided" in gate ? gate.decided : pillarCScopedAudience(gate.candidate, input.units);
}

/**
 * The line a forecast-only member reads above the public forecast, by reason (review finding UI-1). Each says only
 * what is true for that reason:
 *   - not_enabled, units_mismatch: an organisation the owner decisions cover, not (or not coherently) switched on;
 *   - units_unavailable: the units function failed or answered malformed data, which says nothing about whether the
 *     member is enabled: never «not active», and no promise that retrying helps, since the cause may be permanent
 *     (for example a deployment that reaches production before the migration; review finding F-COPY-1);
 *   - unmapped, not_production: no owner decision covers this organisation or this deployment, so nothing promises
 *     an activation.
 */
export const C_FORECAST_ONLY_NOTES = {
  notEnabled: "Le analisi di dettaglio di Pillar C per la tua organizzazione non sono ancora attive.",
  unavailable: "Le analisi di dettaglio non sono disponibili in questo momento.",
  notCovered: "Le analisi di dettaglio di Pillar C non sono attive per la tua organizzazione.",
} as const;
export function cForecastOnlyNote(reason: PillarCForecastOnlyReason): string {
  switch (reason) {
    case "not_enabled": case "units_mismatch": return C_FORECAST_ONLY_NOTES.notEnabled;
    case "units_unavailable": return C_FORECAST_ONLY_NOTES.unavailable;
    case "unmapped": case "not_production": return C_FORECAST_ONLY_NOTES.notCovered;
  }
}

export function isPillarCScopedAudience(audience: PillarCAudience | null): audience is PillarCScopedAudience {
  return audience?.kind === "azienda" || audience?.kind === "regione";
}
/** Exact string match only: no trimming, case folding or list splitting. */
export function cScopedKeyAllowed(audience: PillarCScopedAudience, key: unknown): key is CScopedUnit {
  return typeof key === "string" && (audience.units as readonly string[]).includes(key);
}

// ---------------------------------------------------------------------------
// What the client receives about its audience: strings only, never a unit the
// session cannot read, never a province key or another Azienda's name.

export const C_SCOPED_AGGREGATE_LABEL_AZIENDA = "Aggregato delle quattro Aziende";
export const C_SCOPED_AGGREGATE_LABEL_REGIONE = "Aggregato regionale";
export const C_SCOPED_EXPORT_LABEL_REGIONE = "Riservato alla Regione · dati delle quattro Aziende (ASL 1–4) e aggregato regionale";
export const cScopedExportLabelAzienda = (orgName: string) => `Riservato a ${orgName} · dati della propria Azienda e aggregato delle quattro Aziende`;

export type CClientAudienceOrg = { key: string; label: string };
export type CClientAudience = {
  schema: "pillar-c-client-audience-v1";
  kind: "reviewer" | "azienda" | "regione";
  /** How the review rows are read: the reviewer's aggregate is a sum of the four Aziende; scoped rows are explicit per key. */
  monthlyMode: "summed" | "explicit";
  /** The key of the four-Azienda aggregate: `Regione` for the reviewer, `aggregato` for scoped audiences. */
  aggregateKey: string;
  /** Every «Ambito» select offers exactly these options, in this order. */
  orgs: CClientAudienceOrg[];
  defaultOrg: string;
  /** «Azienda del budget» options: an Azienda sees only itself; the aggregate is never a budget scope. */
  budgetOrgs: CClientAudienceOrg[];
  capabilities: { workbook: boolean; insights: boolean; evidence: boolean; pvm: boolean; lineage: boolean; syntheticBudgets: boolean };
  /** The scope line of the page header, or null for the reviewer (unchanged copy). */
  scopeLine: string | null;
  /** The confidentiality label of exports and of the planning workspace. */
  exportLabel: string;
};

const ALL = { workbook: true, insights: true, evidence: true, pvm: true, lineage: true, syntheticBudgets: true } as const;
const NONE = { workbook: false, insights: false, evidence: false, pvm: false, lineage: false, syntheticBudgets: false } as const;

/** The reviewer audience: today's constants, unchanged. */
export const C_REVIEWER_CLIENT_AUDIENCE: CClientAudience = {
  schema: "pillar-c-client-audience-v1", kind: "reviewer", monthlyMode: "summed", aggregateKey: "Regione",
  orgs: C_ORGS.map((key) => ({ key, label: C_ORG_LABELS[key] })), defaultOrg: "Regione",
  budgetOrgs: C_ORGS.filter((key) => key !== "Regione").map((key) => ({ key, label: C_ORG_LABELS[key] })),
  capabilities: { ...ALL }, scopeLine: null, exportLabel: C_PLANNING_LABELS.section.confidentiality,
};

const aslLabel = (unit: CScopedAslUnit) => `ASL ${unit.slice(4)}`;

export function toClientAudience(audience: { kind: "reviewer" } | PillarCScopedAudience): CClientAudience {
  if (audience.kind === "reviewer") return structuredClone(C_REVIEWER_CLIENT_AUDIENCE);
  if (audience.kind === "azienda") {
    const own = { key: audience.unit, label: audience.orgName };
    return {
      schema: "pillar-c-client-audience-v1", kind: "azienda", monthlyMode: "explicit", aggregateKey: C_SCOPED_AGGREGATE,
      orgs: [own, { key: C_SCOPED_AGGREGATE, label: C_SCOPED_AGGREGATE_LABEL_AZIENDA }], defaultOrg: audience.unit,
      budgetOrgs: [{ ...own }], capabilities: { ...NONE },
      scopeLine: `${audience.orgName} e aggregato delle quattro Aziende · analisi in revisione`,
      exportLabel: cScopedExportLabelAzienda(audience.orgName),
    };
  }
  return {
    schema: "pillar-c-client-audience-v1", kind: "regione", monthlyMode: "explicit", aggregateKey: C_SCOPED_AGGREGATE,
    orgs: [{ key: C_SCOPED_AGGREGATE, label: C_SCOPED_AGGREGATE_LABEL_REGIONE }, ...C_SCOPED_ASL_UNITS.map((key) => ({ key, label: aslLabel(key) }))],
    defaultOrg: C_SCOPED_AGGREGATE,
    budgetOrgs: C_SCOPED_ASL_UNITS.map((key) => ({ key, label: aslLabel(key) })), capabilities: { ...NONE },
    scopeLine: "Aggregato regionale e ASL 1–4 · analisi in revisione", exportLabel: C_SCOPED_EXPORT_LABEL_REGIONE,
  };
}
