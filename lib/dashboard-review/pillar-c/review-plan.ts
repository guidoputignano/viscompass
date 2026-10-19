/** A local, exportable review worksheet; never a shared assignment or approval. */
import { C_ATTR_CHANNELS, C_ATTR_ORGS, C_ATTR_PERIODS, cAttrAtoms, type CAttrChannel, type CAttrOrg, type CAttrPeriod } from "@/lib/dashboard-review/pillar-c/attribution";

export const C_REVIEW_TYPES = ["attribution", "product-change", "identifier", "budget-evidence"] as const;
export const C_REVIEW_STATES = ["draft", "assigned", "in_review", "resolved"] as const;
export type CReviewType = typeof C_REVIEW_TYPES[number];
export type CReviewState = typeof C_REVIEW_STATES[number];
export type CPortfolioReviewContext = {
  period: CAttrPeriod; org: CAttrOrg; channel: CAttrChannel;
  portfolioId: string; portfolioLabel: string;
  sourceSha256: string; classificationSha256: string; mappingVersion: string;
  sourceSnapshot?: string;
  fixedNet?: string; sharedAbs?: string;
};
export type CReviewInput = {
  type: CReviewType; title: string; role: string; owner: string; dueDate: string;
  evidence: string; outcome: string; state: CReviewState;
};
export type CReviewTask = CReviewInput & {
  id: string; contextKey: string; createdAt: string; updatedAt: string; resolvedAt: string | null;
};
export type CReviewPlan = {
  schema: "pillar-c-review-plan-v1";
  mode: "local-export-only";
  context: CPortfolioReviewContext;
  exportedAt: string;
  tasks: CReviewTask[];
};
export class CReviewValidationError extends Error {
  readonly code: "context" | "input" | "assignment" | "resolution" | "transition" | "task";
  constructor(code: CReviewValidationError["code"]) { super(code); this.code = code; }
}
const fail = (code: CReviewValidationError["code"]): never => { throw new CReviewValidationError(code); };
const hash = /^[a-f0-9]{64}$/;
const id = /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;
const token = (value: unknown, pattern: RegExp) => typeof value === "string" && pattern.test(value);
const clean = (value: unknown, max: number) => typeof value === "string" && value.length <= max && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
function contextCheck(context: CPortfolioReviewContext) {
  if (!context || !C_ATTR_PERIODS.includes(context.period) || !C_ATTR_ORGS.includes(context.org) || !C_ATTR_CHANNELS.includes(context.channel)
    || !token(context.portfolioId, id) || !clean(context.portfolioLabel, 240) || !context.portfolioLabel.trim()
    || !token(context.sourceSha256, hash) || !token(context.classificationSha256, hash)
    || !clean(context.mappingVersion, 96) || !context.mappingVersion.trim()
    || (context.sourceSnapshot !== undefined && !token(context.sourceSnapshot, hash))) fail("context");
  for (const field of ["fixedNet", "sharedAbs"] as const) {
    const raw = context[field];
    if (raw !== undefined) {
      try { if (typeof raw !== "string" || (field === "sharedAbs" && cAttrAtoms(raw) < BigInt(0))) fail("context"); else cAttrAtoms(raw); }
      catch { fail("context"); }
    }
  }
}
/** Includes immutable input identities: plans never follow a scope or source change. */
export function cReviewContextKey(context: CPortfolioReviewContext): string {
  contextCheck(context);
  return [context.period, context.org, context.channel, context.portfolioId, context.sourceSha256, context.classificationSha256, context.mappingVersion, context.sourceSnapshot ?? ""].map(encodeURIComponent).join("|");
}
function iso(value: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(new Date(value).valueOf()) || new Date(value).toISOString() !== value) fail("input");
  return value;
}
function date(value: string) {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function inputCheck(input: CReviewInput): CReviewInput {
  if (!input || !C_REVIEW_TYPES.includes(input.type) || !C_REVIEW_STATES.includes(input.state)
    || !clean(input.title, 240) || !input.title.trim() || !clean(input.role, 120) || !clean(input.owner, 160)
    || !clean(input.evidence, 1600) || !clean(input.outcome, 1600) || typeof input.dueDate !== "string" || !date(input.dueDate)) fail("input");
  const out: CReviewInput = { type: input.type, state: input.state, title: input.title.trim(), role: input.role.trim(), owner: input.owner.trim(), dueDate: input.dueDate, evidence: input.evidence.trim(), outcome: input.outcome.trim() };
  if (out.state !== "draft" && (!out.role || !out.owner || !out.dueDate)) fail("assignment");
  if (out.state === "resolved" && (!out.evidence || !out.outcome)) fail("resolution");
  return out;
}
const transitions: Record<CReviewState, readonly CReviewState[]> = {
  draft: ["draft", "assigned"], assigned: ["draft", "assigned", "in_review"],
  in_review: ["assigned", "in_review", "resolved"], resolved: ["resolved", "in_review"],
};
export function cCreateReviewTask(context: CPortfolioReviewContext, input: CReviewInput, clock: { id: string; now: string }): CReviewTask {
  const contextKey = cReviewContextKey(context), checked = inputCheck(input);
  if (!token(clock.id, id)) fail("task");
  if (checked.state !== "draft") fail("transition");
  const now = iso(clock.now);
  return { ...checked, id: clock.id, contextKey, createdAt: now, updatedAt: now, resolvedAt: null };
}
export function cUpdateReviewTask(context: CPortfolioReviewContext, task: CReviewTask, next: CReviewInput, now: string): CReviewTask {
  if (!task || task.contextKey !== cReviewContextKey(context) || !token(task.id, id) || !C_REVIEW_STATES.includes(task.state)) fail("task");
  const checked = inputCheck(next), updatedAt = iso(now);
  if (updatedAt < iso(task.createdAt) || updatedAt < iso(task.updatedAt)) fail("input");
  if (!transitions[task.state].includes(checked.state)) fail("transition");
  // A closed review cannot be rewritten as though the new evidence had closed it.
  if (task.state === "resolved" && checked.state === "resolved" && Object.keys(checked).some(key => checked[key as keyof CReviewInput] !== task[key as keyof CReviewInput])) fail("transition");
  if (task.state === "resolved" && checked.state === "resolved") return { ...task };
  return { ...task, ...checked, updatedAt, resolvedAt: checked.state === "resolved" ? task.resolvedAt ?? updatedAt : null };
}
/** Explicit fields only; no caller-supplied patient/attachment payload is exported. */
export function cReviewPlan(context: CPortfolioReviewContext, tasks: readonly CReviewTask[], now: string): CReviewPlan {
  const key = cReviewContextKey(context), seen = new Set<string>(), exportedAt = iso(now);
  const safeTasks = tasks.map(task => {
    if (task.contextKey !== key || !token(task.id, id) || seen.has(task.id)) fail("task");
    seen.add(task.id);
    const checked = inputCheck(task);
    const createdAt = iso(task.createdAt), updatedAt = iso(task.updatedAt);
    if (updatedAt < createdAt || updatedAt > exportedAt || (task.state === "resolved" ? !task.resolvedAt || iso(task.resolvedAt) !== updatedAt : task.resolvedAt !== null)) fail("task");
    return { ...checked, id: task.id, contextKey: key, createdAt, updatedAt, resolvedAt: task.resolvedAt };
  });
  const safeContext: CPortfolioReviewContext = {
    period: context.period, org: context.org, channel: context.channel, portfolioId: context.portfolioId,
    portfolioLabel: context.portfolioLabel, sourceSha256: context.sourceSha256,
    classificationSha256: context.classificationSha256, mappingVersion: context.mappingVersion,
    ...(context.sourceSnapshot === undefined ? {} : { sourceSnapshot: context.sourceSnapshot }),
    ...(context.fixedNet === undefined ? {} : { fixedNet: context.fixedNet }),
    ...(context.sharedAbs === undefined ? {} : { sharedAbs: context.sharedAbs }),
  };
  return { schema: "pillar-c-review-plan-v1", mode: "local-export-only", context: safeContext, exportedAt, tasks: safeTasks };
}
export function cReviewJson(plan: CReviewPlan): string { return JSON.stringify(cReviewPlan(plan.context, plan.tasks, plan.exportedAt), null, 2); }
/** Quoted CSV alone does not stop spreadsheet formulas. Neutralise every cell. */
export function cReviewCsv(plan: CReviewPlan): string {
  const checked = cReviewPlan(plan.context, plan.tasks, plan.exportedAt), c = checked.context;
  const cell = (value: string) => `"${(/^[\s\u0000-\u001F\u007F\uFEFF]*[=+\-@]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
  const header = ["id", "period", "org", "channel", "portfolio_id", "portfolio", "type", "title", "role", "owner", "due_date", "state", "evidence_reference", "outcome", "source_sha256", "classification_sha256", "mapping_version", "source_snapshot", "fixed_net_eur", "shared_absolute_eur", "created_at", "updated_at", "resolved_at"];
  const rows = checked.tasks.map(t => [t.id, c.period, c.org, c.channel, c.portfolioId, c.portfolioLabel, t.type, t.title, t.role, t.owner, t.dueDate, t.state, t.evidence, t.outcome, c.sourceSha256, c.classificationSha256, c.mappingVersion, c.sourceSnapshot ?? "", c.fixedNet ?? "", c.sharedAbs ?? "", t.createdAt, t.updatedAt, t.resolvedAt ?? ""]);
  return "\uFEFF" + [header, ...rows].map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
