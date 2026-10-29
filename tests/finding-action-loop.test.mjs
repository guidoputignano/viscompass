// The action loop for findings, above the database (whose own suite is finding-action-loop-sql.test.mjs):
//   - who sees a case and which step each viewer may take, from one pure rule the routes and the workspace share;
//   - which findings are offered, and their frozen values;
//   - the routes check the live viewer and that rule before any write, and a member never learns of a case they
//     may not see; the reminder job answers only Vercel Cron's secret;
//   - emails carry a title and a due date, never a figure.
// Synthetic values only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  allowedActions, benchmarkCandidate, biosimilarCandidates, findingSummary, findingTitle, memberCanSee, validDueDate,
  BIOSIMILAR_CANDIDATES_PER_AZIENDA, FINDING_DECISIONS, FINDING_DECISION_LABELS,
} from "../lib/dashboard-review/actions/model.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const handlers = (src) => Object.fromEntries(src.split(/^export async function /m).slice(1).map((s) => [s.slice(0, s.indexOf("(")), s]));
const before = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b); assert.ok(i >= 0, `${a} present`); assert.ok(j >= 0, `${b} present`); assert.ok(i < j, `${a} before ${b}`); };

const reviewer = { kind: "reviewer", id: "r" };
const member = { kind: "member", id: "m", orgs: ["A"] };
const colleague = { kind: "member", id: "m2", orgs: ["A"] };
const outsider = { kind: "member", id: "x", orgs: ["B"] };
const at = (state, extra = {}) => ({ state, org_code: "A", owner_id: state === "open" ? null : "m", owner_org: state === "open" ? null : "A", ...extra });

test("a member sees a case about their Azienda only once someone in it owns it; never an internal or another Azienda's case", () => {
  assert.equal(memberCanSee(at("assigned"), ["A"]), true);
  assert.equal(memberCanSee(at("open"), ["A"]), false, "an unassigned case stays with the reviewer");
  assert.equal(memberCanSee(at("in_review", { owner_id: "r", owner_org: "R" }), ["A"]), false, "internal triage stays internal");
  assert.equal(memberCanSee(at("assigned"), ["B"]), false);
  assert.equal(memberCanSee(at("assigned", { org_code: "B", owner_org: "A" }), ["A"]), false, "owned in A but about B");
});

test("the reviewer drives the whole lifecycle; the owner takes it from assignment to outcome; nobody else acts", () => {
  assert.deepEqual(["open", "assigned", "in_review", "decision_recorded", "closed"].map((s) => allowedActions(at(s), reviewer)),
    [["assign"], ["assign", "start"], ["assign", "record_decision"], ["record_decision", "close"], ["reopen"]]);
  assert.deepEqual(["open", "assigned", "in_review", "decision_recorded", "closed"].map((s) => allowedActions(at(s), member)),
    [[], ["start"], ["record_decision"], ["record_decision", "close"], []]);
  for (const s of ["assigned", "in_review", "decision_recorded"]) {
    assert.deepEqual(allowedActions(at(s), colleague), [], "a colleague reads, the owner acts");
    assert.deepEqual(allowedActions(at(s), outsider), []);
    assert.deepEqual(allowedActions(at(s, { owner_id: "m", owner_org: "R" }), member), [], "an owner id alone is not enough");
  }
  assert.ok(!allowedActions(at("closed"), member).includes("reopen"), "only the reviewer reopens");
});

test("biosimilar findings: a local first use, positive euros, at most five per Azienda, frozen to the cent", () => {
  const org = { orgCode: "A", aslCode: "999001", label: "Azienda sintetica" };
  const row = (substance, eur, first = "2024-03") => ({ substance, eur, firstLocalLabel: first, dateValidShare: null, locallyObservedShare: null });
  const rows = [row("S1", 9000.456), row("S2", 800), row("S3", 0), row("S4", -5), row("S5", 700, null), row("S6", 600, "2024-13"),
    row("S7", 500), row("S8", 400), row("S9", 300), row("S10", 200)];
  const out = biosimilarCandidates(org, rows);
  assert.equal(out.length, BIOSIMILAR_CANDIDATES_PER_AZIENDA);
  assert.deepEqual(out.map((c) => c.subject), ["S1", "S2", "S7", "S8", "S9"]);
  assert.deepEqual(out[0], { kind: "biosimilar", org_code: "A", org_label: "Azienda sintetica", asl_code: "999001", subject: "S1", subject_label: "S1", value: "9000.46", detail: "2024-03" });
});

test("benchmark findings: a unit-cost index above 100 on at least half the spend, and nothing that would reveal peers' euros", () => {
  const org = { orgCode: "A", aslCode: "999001", label: "Azienda sintetica" };
  assert.deepEqual(benchmarkCandidate(org, { unit_cost_index: 112.44, unit_cost_coverage: 0.8704 }),
    { kind: "benchmark", org_code: "A", org_label: "Azienda sintetica", asl_code: "999001", subject: "unit_cost_index", subject_label: "Costo unitario per gli stessi prodotti", value: "112.4", detail: "0.870" });
  for (const r of [{ unit_cost_index: 100, unit_cost_coverage: 0.9 }, { unit_cost_index: 98, unit_cost_coverage: 0.9 }, { unit_cost_index: 130, unit_cost_coverage: 0.49 },
    { unit_cost_index: null, unit_cost_coverage: 0.9 }, { unit_cost_index: 130, unit_cost_coverage: null }, { unit_cost_index: Number.NaN, unit_cost_coverage: 0.9 }])
    assert.equal(benchmarkCandidate(org, r), null);
  // The candidate carries only the index and its coverage: no spend, no median, no spend index.
  const server = read("lib/dashboard-review/actions/server.ts");
  assert.doesNotMatch(server, /spend_index|median_spend|spend_eur:/);
});

test("titles and emails carry no figure; the workspace summary says what the figure is not", () => {
  const bio = { kind: "biosimilar", subject_label: "SOSTANZA", org_label: "Azienda sintetica", reference_eur: "12345.67", first_local: "2024-03", years: "2024-2025" };
  const bench = { kind: "benchmark", subject_label: "Costo unitario per gli stessi prodotti", org_label: "Azienda sintetica", year: "2025", unit_cost_index: "112.4", unit_cost_coverage: "0.870" };
  assert.equal(findingTitle(bio), "Biosimilari · SOSTANZA · Azienda sintetica");
  assert.doesNotMatch(findingTitle(bench), /\d/);
  assert.match(findingSummary(bio), /Non è un risparmio\.$/);
  assert.match(findingSummary(bench), /100 è il prezzo del gruppo di Aziende per lo stesso mix di prodotti/);
  const email = read("lib/email/vis-email.ts");
  const findingEmails = email.slice(email.indexOf("export async function sendFindingAssignedEmail"));
  assert.doesNotMatch(findingEmails, /reference_eur|unit_cost|findingSummary|toLocaleString/);
  for (const fn of ["sendFindingAssignedEmail", "sendFindingOverdueEmail"]) {
    assert.match(findingEmails, new RegExp(`${fn}\\(email: string, title: string, dueDate: string, caseId: string\\)`));
  }
  assert.deepEqual(Object.keys(FINDING_DECISION_LABELS), [...FINDING_DECISIONS]);
});

test("due dates: a real calendar day, today or later, at most two years ahead", () => {
  assert.equal(validDueDate("2026-10-29", "2026-10-29"), true);
  assert.equal(validDueDate("2028-10-29", "2026-10-29"), true);
  for (const v of ["2026-10-28", "2028-10-30", "2026-02-30", "29/10/2026", "", null, 20261029]) assert.equal(validDueDate(v, "2026-10-29"), false, String(v));
});

test("the routes check the live viewer and the shared rule before any write; a member never learns of a hidden case", () => {
  const api = handlers(read("app/api/findings/route.ts"));
  for (const name of ["GET", "POST", "PATCH"]) assert.match(api[name], /const viewer = await findingViewer\(\)/, name);
  assert.match(api.POST, /viewer\.kind !== "reviewer"/, "only a reviewer or admin opens a case");
  before(api.POST, "cEvidenceSameOrigin(request)", 'rpc("finding_case_create"');
  before(api.POST, "findingSource(await findingCandidates(), body)", 'rpc("finding_case_create"');
  before(api.PATCH, "cEvidenceSameOrigin(request)", 'rpc("finding_case_mutate"');
  before(api.PATCH, "memberCanSee(current, viewer.orgs))) return reply({ error: \"not_found\" }, 404)", "allowedActions(current, viewer).includes(body.action)");
  before(api.PATCH, "allowedActions(current, viewer).includes(body.action)", 'rpc("finding_case_mutate"');
  before(api.PATCH, "findingOwners(current.org_code)", 'rpc("finding_case_mutate"');
  assert.match(api.PATCH, /payload = \{ owner_id: owner\.id, owner_org: owner\.org, due_date: payload\.due_date \}/, "the owner's organisation comes from the server, never the browser");
  assert.match(api.GET, /memberCanSee\(c, viewer\.orgs\)/);
  const detail = handlers(read("app/api/findings/[id]/route.ts"));
  assert.match(detail.GET, /viewer\.kind === "member" && !memberCanSee\(c, viewer\.orgs\)\)\) return json\(\{ error: "not_found" \}, 404\)/);
  assert.match(detail.GET, /viewer\.kind === "reviewer" \? findingOwners/);
});

test("the reminder job answers only CRON_SECRET, compares it in constant time, claims before it sends, and returns counts", () => {
  const src = read("app/api/findings/reminders/route.ts");
  assert.match(src, /timingSafeEqual/);
  assert.match(src, /if \(!secret \|\| secret\.length < 16\) return reply\(\{ error: "not_configured" \}, 503\)/);
  before(src, "authorized(request.headers.get(\"authorization\"), secret)", "createServiceRoleClient()");
  before(src, 'rpc("finding_reminder_claim"', "sendFindingOverdueEmail(");
  assert.match(src, /return reply\(\{ overdue: overdue\.data\?\.length \?\? 0, claimed, sent \}\)/);
  assert.deepEqual(JSON.parse(read("vercel.json")), { crons: [{ path: "/api/findings/reminders", schedule: "0 6 * * *" }] });
});

test("the page is a private module with its own title, and the navigation lists it under Governance", () => {
  assert.match(read("app/dashboard-review/azioni/page.tsx"), /title: "Azioni sui risultati \| VIS"/);
  assert.match(read("components/dashboard-review/nav.tsx"), /\{ href: "\/dashboard-review\/azioni", label: "Azioni sui risultati", icon: ClipboardCheck \}/);
  const ui = read("components/dashboard-review/actions/finding-workspace.tsx");
  assert.doesNotMatch(ui, /\bdemo\b|risparmi(?!o\.)|obiettivo di spesa/i);
  assert.match(ui, /role="status"/);
});
