/** Pillar C client audience (recommendation 5): how the interface reads the audience the server decided.
 * Pure and browser-safe: no session, no figure, no province key.
 *
 * The audience arrives already decided and guarded on the server (audience-rules.ts toClientAudience,
 * payload-guard.ts guardCClientAudience). This module never widens it:
 *   - a value that is not a complete audience is no audience, and the interface then renders nothing;
 *   - every organisation key a URL carries is matched exactly against the audience's own options; a value outside
 *     them falls back to the audience's default and is reported, so the page can say so.
 * The clamp keeps the reading honest only. The API checks every key again (scoped-route.ts) and Storage RLS
 * decides every read (owner decision O2). */
import type { CClientAudience, CClientAudienceOrg } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { C_ATTR_CHANNELS, C_ATTR_PERIODS, type CAttrChannel, type CAttrOrg, type CAttrPeriod } from "@/lib/dashboard-review/pillar-c/attribution";
import { cMoneyDifference, cReviewFilters, cReviewSearch, type CReviewFilters } from "@/lib/dashboard-review/pillar-c/review";
import { cPlanningFilters, type CPlanningOrg } from "@/lib/dashboard-review/pillar-c/planning";
import type { CScopedClientReview, CScopedReviewFilters } from "@/lib/dashboard-review/pillar-c/scoped-review";
import { C_SCOPED_AGGREGATE, isCScopedUnit, type CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";
import { C_SCOPED_CAPABILITIES } from "@/lib/dashboard-review/pillar-c/scoped-capabilities";

/** Copy of the organisation-scoped interface. Short, visible, and never a claim the data does not support. */
export const C_AUDIENCE_COPY = {
  tampered: "Il collegamento indicava un ambito non disponibile per il tuo profilo: è mostrato il tuo ambito.",
  pvm: "La scomposizione prezzo, quantità e mix resta nella revisione di progetto e non è inclusa in questa vista.",
  budgetNote: "Contiene allocazioni modellate: la spesa per area è ripartita con chiavi di attività, non osservata. La compatibilità del perimetro del budget pubblicato non è stabilita: le differenze non misurano sovra/sottospesa organizzativa.",
  budgetNone: "Per questa Azienda il pacchetto non contiene un atto di budget pubblicato: nessun confronto viene mostrato.",
  budgetEmpty: "Nessuna coppia disponibile per questo ambito nel pacchetto di revisione. Nessun valore viene sostituito con zero.",
  budgetSingle: "Il budget si legge per singola Azienda. Dipartimenti e discipline non vengono sommati tra loro.",
  budgetSource: "Budget pubblicato",
  /** The Regione's modelled budgets (owner decision of 24 Oct 2026): the note beside modelled rows, and the honest state
   * when its regional object cannot be read. */
  budgetModelledNote: "Contiene un budget modellato e allocazioni modellate: né il budget né la spesa per area sono osservati. Non è un atto approvato e le differenze non misurano sovra/sottospesa organizzativa.",
  budgetModelledUnavailable: "Il budget modellato non è disponibile in questo momento. Nessun valore viene sostituito.",
  provenanceUnavailable: "Le informazioni su fonti, versione e ricevute non sono disponibili in questo momento.",
  /** The CO count panel: a ratio to an estimated count, never a figure per patient (review finding UI-3). */
  countsTitle: "Spesa rapportata alla numerosità stimata · scenario",
  /** The same panel's scale caption, row unit and exact-table headers: every euro value is a ratio to the estimated
   * count, never «per persona» (review finding F-UI3-RES). The reviewer view keeps its own wording. */
  countsLabels: {
    scale: "€ per unità di numerosità stimata · scenario",
    unit: " per unità di numerosità stimata",
    headers: ["Portafoglio", "Numerosità base stimata", "Spesa CO attribuita tramite portafoglio", "€ per unità · numerosità ridotta del 25%", "€ per unità · numerosità di riferimento", "€ per unità · numerosità aumentata del 25%"],
  },
  countsNote: "Contiene stime: numerosità stimata dai dimessi (dati sintetici). L’intervallo varia la numerosità del 25% in meno e in più, senza probabilità né limite garantito. I raggruppamenti ATC restano in bozza, con revisione di dominio in attesa. Le popolazioni dei portafogli possono sovrapporsi e non si sommano. Il canale globale non modifica questa vista CO.",
  forbidden: "Questo ambito non è disponibile per la tua sessione: nessun valore viene mostrato.",
  forecastUnavailable: "La previsione non è disponibile in questo momento. Nessun valore viene sostituito.",
} as const;

const CAPABILITIES = ["workbook", "insights", "evidence", "pvm", "lineage", "syntheticBudgets"] as const;
const LOCAL_CHANNELS = ["CO", "DD", "DPC"] as const;
type LocalChannel = typeof LOCAL_CHANNELS[number];

function options(list: unknown): list is CClientAudienceOrg[] {
  if (!Array.isArray(list) || list.length === 0) return false;
  const valid = list.every((o) => o !== null && typeof o === "object" && typeof (o as CClientAudienceOrg).key === "string" && (o as CClientAudienceOrg).key.length > 0
    && typeof (o as CClientAudienceOrg).label === "string" && (o as CClientAudienceOrg).label.length > 0);
  return valid && new Set(list.map((o: CClientAudienceOrg) => o.key)).size === list.length;
}

/** A complete client audience, or null. A scoped audience holds only its own units, reads explicit rows and has exactly
 * its kind's capabilities (scoped-capabilities.ts); the reviewer audience sums the four Aziende. Anything else is no audience. */
export function cClientAudience(value: unknown): CClientAudience | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const a = value as Partial<CClientAudience>;
  if (a.schema !== "pillar-c-client-audience-v1" || (a.kind !== "reviewer" && a.kind !== "azienda" && a.kind !== "regione")) return null;
  if (!options(a.orgs) || !options(a.budgetOrgs)) return null;
  const orgs = a.orgs, budgetOrgs = a.budgetOrgs;
  if (typeof a.defaultOrg !== "string" || !orgs.some((o) => o.key === a.defaultOrg) || typeof a.aggregateKey !== "string" || !orgs.some((o) => o.key === a.aggregateKey)) return null;
  if (budgetOrgs.some((o) => o.key === a.aggregateKey)) return null;
  if (typeof a.exportLabel !== "string" || a.exportLabel.trim() === "" || !(a.scopeLine === null || (typeof a.scopeLine === "string" && a.scopeLine.trim() !== ""))) return null;
  const caps = a.capabilities as Record<string, unknown> | undefined;
  if (!caps || typeof caps !== "object" || !CAPABILITIES.every((k) => typeof caps[k] === "boolean")) return null;
  if (a.kind === "reviewer") return a.monthlyMode === "summed" ? a as CClientAudience : null;
  const units = [...orgs, ...budgetOrgs].every((o) => isCScopedUnit(o.key));
  const allowed = C_SCOPED_CAPABILITIES[a.kind];
  if (a.monthlyMode !== "explicit" || a.aggregateKey !== C_SCOPED_AGGREGATE || !units || a.scopeLine === null || CAPABILITIES.some((k) => caps[k] !== allowed[k])) return null;
  return a as CClientAudience;
}
export const isCScopedClientAudience = (audience: CClientAudience): boolean => audience.kind === "azienda" || audience.kind === "regione";

/** The label of one of the audience's keys, or null for a key the audience does not hold. Never a reviewer constant. */
export function cAudienceLabel(audience: CClientAudience, key: string): string | null {
  return audience.orgs.find((o) => o.key === key)?.label ?? audience.budgetOrgs.find((o) => o.key === key)?.label ?? null;
}
/** Exact string match only (no trimming, case folding or list splitting). A key outside `choices` falls back to
 * `fallback` and is reported as tampered; an absent key is not. */
export function cAudienceKey(raw: string | null, choices: readonly CClientAudienceOrg[], fallback: string): { key: string; tampered: boolean } {
  const allowed = raw !== null && choices.some((o) => o.key === raw);
  return { key: allowed ? raw as string : fallback, tampered: raw !== null && !allowed };
}
function unit(key: string): CScopedUnit {
  if (!isCScopedUnit(key)) throw new Error("PILLAR_C_AUDIENCE_KEY");
  return key;
}

/** The dossier (c_port_*) or attribution (c_attr_*) scope of one URL, for this audience. The defaults are today's
 * (FY2025, Tutti); the organisation defaults to the audience's own default key. */
export type CAudienceScope = { period: CAttrPeriod; org: string; channel: CAttrChannel; tampered: boolean };
export function cAudienceScope(audience: CClientAudience, params: URLSearchParams, prefix: "c_port" | "c_attr"): CAudienceScope {
  const period = params.get(`${prefix}_period`), channel = params.get(`${prefix}_channel`);
  const { key, tampered } = cAudienceKey(params.get(`${prefix}_org`), audience.orgs, audience.defaultOrg);
  return { period: C_ATTR_PERIODS.includes(period as CAttrPeriod) ? period as CAttrPeriod : "FY2025", org: key, channel: C_ATTR_CHANNELS.includes(channel as CAttrChannel) ? channel as CAttrChannel : "Tutti", tampered };
}

// ---------------------------------------------------------------- review sections of a scoped audience
/** The budget source an audience may read: the modelled budget only with the syntheticBudgets capability (the Regione,
 * owner decision of 24 Oct 2026); otherwise always the published act (owner decision O4, still the Azienda's rule). */
export function cScopedBudgetSource(audience: CClientAudience, requested: CReviewFilters["budget"] | undefined): CReviewFilters["budget"] {
  return audience.capabilities.syntheticBudgets && requested === "synthetic" ? "synthetic" : "published";
}
/** The review filters of a scoped audience: today's parser for every key but the organisation, which is clamped to the
 * audience, and the budget source, clamped by cScopedBudgetSource. */
export function cScopedReviewFilters(audience: CClientAudience, params: URLSearchParams): { filters: CScopedReviewFilters; tampered: boolean } {
  const { key, tampered } = cAudienceKey(params.get("c_org"), audience.orgs, audience.defaultOrg);
  const base = cReviewFilters(params);
  return { filters: { ...base, org: unit(key), budget: cScopedBudgetSource(audience, base.budget) }, tampered };
}
/** cReviewSearch for a scoped audience: c_org is written only when it differs from the audience's default. */
export function cScopedReviewSearch(audience: CClientAudience, search: string, patch: Partial<CScopedReviewFilters>, reset = false): string {
  const { org, ...rest } = patch;
  const filters = cScopedReviewFilters(audience, new URLSearchParams(search)).filters, current = filters.org;
  const budget = cScopedBudgetSource(audience, reset ? undefined : rest.budget ?? filters.budget);
  const params = new URLSearchParams(cReviewSearch(search, { ...(rest as Partial<CReviewFilters>), budget }, reset));
  const next = reset ? audience.defaultOrg : org ?? current;
  if (next === audience.defaultOrg) params.delete("c_org"); else params.set("c_org", next);
  return params.size ? `?${params}` : "";
}
/** The budget panel's own scope (c_budget_org, c_budget_channel), as cBudgetFilters does for the reviewer, but for the
 * audience's budget organisations only and for the budget source the audience may read. With no explicit budget key
 * the panel opens on the first published departmental act the packet carries. The aggregate is never a budget scope. */
export function cScopedBudgetFilters(audience: CClientAudience, packet: CScopedClientReview, params: URLSearchParams): { filters: CScopedReviewFilters; tampered: boolean } {
  const base = cScopedReviewFilters(audience, params).filters;
  const own = (org: string) => audience.budgetOrgs.some((o) => o.key === org);
  const explicit = [...params.keys()].some((k) => /^c_(?:budget|level|area)(?:_|$)/.test(k));
  const first = explicit ? undefined : packet.budgets.find((r) => own(r.org) && r.actual !== null && r.level === "Dipartimento") ?? packet.budgets.find((r) => own(r.org) && r.actual !== null);
  const opened: CScopedReviewFilters = first ? { ...base, org: first.org, channel: first.channel, budgetPeriod: first.period, level: first.level, area: "all" } : base;
  const { key, tampered } = cAudienceKey(params.get("c_budget_org"), audience.budgetOrgs, own(opened.org) ? opened.org : audience.budgetOrgs[0].key);
  const raw = params.get("c_budget_channel");
  const channel: LocalChannel = LOCAL_CHANNELS.includes(raw as LocalChannel) ? raw as LocalChannel : LOCAL_CHANNELS.includes(opened.channel as LocalChannel) ? opened.channel as LocalChannel : "CO";
  return { filters: { ...opened, org: unit(key), channel, budget: explicit ? base.budget : "published" }, tampered };
}
export function cScopedBudgetSearch(audience: CClientAudience, packet: CScopedClientReview, search: string, patch: Partial<CScopedReviewFilters>): string {
  const local = { ...cScopedBudgetFilters(audience, packet, new URLSearchParams(search)).filters, ...patch };
  const { org, channel, budgetPeriod, level, budgetOrder, area, budget } = local;
  const params = new URLSearchParams(cScopedReviewSearch(audience, search, { budgetPeriod, level, budgetOrder, area, budget }));
  params.set("c_budget_org", org); params.set("c_budget_channel", channel);
  return `?${params}`;
}
/** Whether an audience's budget organisation has any row of the given source in the packet at all (else an honest empty state). */
export const cScopedHasActs = (packet: CScopedClientReview, org: string, basis: CReviewFilters["budget"] = "published") => packet.budgets.some((r) => r.org === org && r.basis === basis);
/** The decision panel's two figures, read from the explicit rows of exactly the selected key (cDecisionAnswer for the reviewer). */
export function cScopedDecision(packet: CScopedClientReview, f: CScopedReviewFilters, scope: string) {
  const [p0, p1] = f.comparison === "K1" ? ["FY2024", "FY2025"] : ["JM2025", "JM2026"];
  const baseline = (period: string) => packet.baseline.find((r) => r.period === period && r.org === f.org && r.channel === f.channel);
  const left = baseline(p0), right = baseline(p1);
  const continuing = packet.bridges.find((r) => r.comparison === f.comparison && r.org === f.org && r.channel === f.channel && r.component === "B-C");
  return { change: left && right ? cMoneyDifference(right.net, left.net) : null, continuing: continuing?.value ?? null, scope, peopleObserved: false as const };
}
/** Which Azienda|period|channel has a published departmental act: keys only, never a budget row or amount. */
export const cScopedPublishedActs = (packet: CScopedClientReview): string[] => [...new Set(packet.budgets.filter((b) => b.basis === "published" && b.level === "Dipartimento").map((b) => `${b.org}|${b.period}|${b.channel}`))];

// ---------------------------------------------------------------- planning workspace
type ScopedPlanningOrg = Exclude<CPlanningOrg, CAttrOrg>;
/** Compile-time pin: the planning engine's scoped keys are exactly the scoped units. */
export const C_PLANNING_ORGS_ARE_UNITS: [ScopedPlanningOrg] extends [CScopedUnit] ? ([CScopedUnit] extends [ScopedPlanningOrg] ? true : never) : never = true;
/** The planning state for this audience: the reviewer's parser unchanged, or the same state with the dossier
 * organisation clamped to the scoped audience's keys. */
export function cAudiencePlanningFilters(audience: CClientAudience, search: string | URLSearchParams): ReturnType<typeof cPlanningFilters> {
  const parsed = cPlanningFilters(search);
  if (audience.kind === "reviewer") return parsed;
  const { key } = cAudienceKey(new URLSearchParams(search).get("c_port_org"), audience.orgs, audience.defaultOrg);
  return { state: { ...parsed.state, org: unit(key) }, invalid: parsed.invalid };
}
/** The vocabulary of the «Fuori da questa sezione» strip: the audience's budget organisations and its aggregate key. */
export const cAudienceActVocabulary = (audience: CClientAudience) => ({ orgs: audience.budgetOrgs.map((o) => o.key), aggregate: audience.aggregateKey });
