// The action loop for findings: what a case is, who may see it and which step
// each viewer may take. PURE, shared by the server and the workspace, so the
// buttons a viewer sees and the checks the server makes cannot drift apart.
//
// A case starts from one finding about ONE Azienda:
//   biosimilar — reference spend in the months after the first local biosimilar
//     of a substance (the Pillar B review queue, «not a saving»);
//   benchmark — the Azienda's unit-cost index against the cohort's price for
//     its own product mix, above 100.
// The reviewer or admin assigns it; an approved member of that Azienda owns
// it, records a decision and closes it with an outcome. Nothing here is a
// saving, a target or a prescribing instruction.

import type { ReviewQueueRow } from "@/lib/dashboard-review/pillar-b/review-queue";
import { itNumber } from "@/lib/format/it-number";

export type FindingKind = "biosimilar" | "benchmark";
export type FindingState = "open" | "assigned" | "in_review" | "decision_recorded" | "closed";
export type FindingDecision = "action_planned" | "no_action_justified" | "data_to_verify" | "already_addressed";
export type FindingAction = "assign" | "start" | "record_decision" | "close" | "reopen";

export const FINDING_KIND_LABELS: Record<FindingKind, string> = {
  biosimilar: "Biosimilari",
  benchmark: "Benchmark",
};
export const FINDING_STATE_LABELS: Record<FindingState, string> = {
  open: "Da assegnare",
  assigned: "Assegnato",
  in_review: "In esame",
  decision_recorded: "Decisione registrata",
  closed: "Chiuso",
};
export const FINDING_DECISIONS: ReadonlyArray<FindingDecision> = ["action_planned", "no_action_justified", "data_to_verify", "already_addressed"];
export const FINDING_DECISION_LABELS: Record<FindingDecision, string> = {
  action_planned: "Azione decisa",
  no_action_justified: "Nessuna azione, con motivazione",
  data_to_verify: "Dato da verificare",
  already_addressed: "Già affrontato",
};
export const FINDING_ACTION_LABELS: Record<FindingAction, string> = {
  assign: "Assegna",
  start: "Prendi in carico",
  record_decision: "Registra la decisione",
  close: "Chiudi con l’esito",
  reopen: "Riapri",
};

/** The frozen record of a finding, as the database stores it: strings only. */
export type BiosimilarSource = {
  kind: "biosimilar"; source_key: string; release: string; org_code: string; org_label: string; asl_code: string;
  subject: string; subject_label: string; cohort: "after_local_switch"; reference_eur: string; first_local: string;
  years: string; channels: "all";
};
export type BenchmarkSource = {
  kind: "benchmark"; source_key: string; release: string; org_code: string; org_label: string; asl_code: string;
  subject: "unit_cost_index"; subject_label: string; year: string; unit_cost_index: string; unit_cost_coverage: string;
};
export type FindingSource = BiosimilarSource | BenchmarkSource;

export interface FindingCase {
  id: string;
  kind: FindingKind;
  source: FindingSource;
  org_code: string;
  state: FindingState;
  revision: number;
  cycle_start_revision: number;
  owner_id: string | null;
  owner_org: string | null;
  due_date: string | null;
  decision: FindingDecision | null;
  decision_note: string | null;
  decision_revision: number | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export type FindingViewer =
  | { kind: "reviewer"; id: string }
  | { kind: "member"; id: string; orgs: ReadonlyArray<string> };

/** A member sees a case about their Azienda only once someone in that Azienda owns it.
 * A case a reviewer keeps for internal triage stays out of the Azienda's view. */
export function memberCanSee(c: Pick<FindingCase, "org_code" | "owner_org">, orgs: ReadonlyArray<string>): boolean {
  return c.owner_org !== null && c.owner_org === c.org_code && orgs.includes(c.org_code);
}

/** The steps this viewer may take on this case now. The database checks the transitions again. */
export function allowedActions(c: Pick<FindingCase, "state" | "owner_id" | "owner_org" | "org_code">, viewer: FindingViewer): FindingAction[] {
  if (viewer.kind === "reviewer") {
    switch (c.state) {
      case "open": return ["assign"];
      case "assigned": return ["assign", "start"];
      case "in_review": return ["assign", "record_decision"];
      case "decision_recorded": return ["record_decision", "close"];
      case "closed": return ["reopen"];
    }
  }
  const owns = c.owner_id === viewer.id && c.owner_org !== null && viewer.orgs.includes(c.owner_org) && memberCanSee(c, viewer.orgs);
  if (!owns) return [];
  switch (c.state) {
    case "assigned": return ["start"];
    case "in_review": return ["record_decision"];
    case "decision_recorded": return ["record_decision", "close"];
    default: return [];
  }
}

export interface FindingCandidate {
  kind: FindingKind;
  org_code: string;
  org_label: string;
  asl_code: string;
  subject: string;
  subject_label: string;
  /** The figure the finding rests on, as stored: "12345.67" euros, or "112.4" index points. */
  value: string;
  /** "2024-03" (first local biosimilar) or "0.870" (share of spend the index rests on). */
  detail: string;
}

/** At most this many substances per Azienda are offered: the largest, by euros. */
export const BIOSIMILAR_CANDIDATES_PER_AZIENDA = 5;

/** Substances whose biosimilar is already used locally, with reference spend after its first use. */
export function biosimilarCandidates(
  org: { orgCode: string; aslCode: string; label: string },
  afterLocalSwitch: ReadonlyArray<ReviewQueueRow>,
): FindingCandidate[] {
  return afterLocalSwitch
    .filter((r) => r.firstLocalLabel !== null && /^20\d{2}-(0[1-9]|1[0-2])$/.test(r.firstLocalLabel) && Number.isFinite(r.eur) && r.eur > 0)
    .slice(0, BIOSIMILAR_CANDIDATES_PER_AZIENDA)
    .map((r) => ({
      kind: "biosimilar" as const, org_code: org.orgCode, org_label: org.label, asl_code: org.aslCode,
      subject: r.substance, subject_label: r.substance, value: r.eur.toFixed(2), detail: r.firstLocalLabel!,
    }));
}

/** An index the cohort price can be compared with: above 100, resting on at least half the Azienda's spend. */
export const BENCHMARK_MIN_COVERAGE = 0.5;

export function benchmarkCandidate(
  org: { orgCode: string; aslCode: string; label: string },
  row: { unit_cost_index: number | null; unit_cost_coverage: number | null },
): FindingCandidate | null {
  const index = row.unit_cost_index, coverage = row.unit_cost_coverage;
  if (index === null || coverage === null || !Number.isFinite(index) || !Number.isFinite(coverage)) return null;
  if (index <= 100 || index >= 10000 || coverage < BENCHMARK_MIN_COVERAGE || coverage > 1) return null;
  return {
    kind: "benchmark", org_code: org.orgCode, org_label: org.label, asl_code: org.aslCode,
    subject: "unit_cost_index", subject_label: "Costo unitario per gli stessi prodotti",
    value: index.toFixed(1), detail: coverage.toFixed(3),
  };
}

/** One line describing the finding, with its figure, for the workspace. Never for an email. */
export function findingSummary(source: FindingSource): string {
  if (source.kind === "biosimilar") {
    const eur = itNumber(Number(source.reference_eur), { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
    return `${eur} di spesa di riferimento dal primo biosimilare locale (${source.first_local}), ${source.years.replace("-", "–")}, tutti i canali. Non è un risparmio.`;
  }
  const coverage = Math.round(Number(source.unit_cost_coverage) * 100);
  return `Indice ${itNumber(Number(source.unit_cost_index), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} nel ${source.year}: 100 è il prezzo del gruppo di Aziende per lo stesso mix di prodotti. Calcolato sul ${coverage}% della spesa.`;
}

/** The case's title without any figure: safe for an email subject or body. */
export function findingTitle(source: Pick<FindingSource, "kind" | "subject_label" | "org_label">): string {
  return `${FINDING_KIND_LABELS[source.kind]} · ${source.subject_label} · ${source.org_label}`;
}

/** A due date the owner can still meet: today or later, at most two years ahead. ISO yyyy-mm-dd. */
export function validDueDate(value: unknown, today: string): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== value) return false;
  const limit = new Date(`${today}T00:00:00Z`); limit.setUTCFullYear(limit.getUTCFullYear() + 2);
  return value >= today && d <= limit;
}
