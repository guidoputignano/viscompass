// CI test report (production closure, 26 Oct 2026; Codex review B26-02). Reads the JSON lines of
// scripts/ci/jsonl-reporter.mjs and:
//   - prints the counts and every skipped test with its file and reason, also to the GitHub job summary when there is one;
//   - fails when a test failed, when the run reported nothing, when any test is marked TODO (passing or failing: a
//     required verification has no pending items), or when a skip is not on the allowlist.
// The allowlist (scripts/ci/allowed-skips.json) names each accepted skip exactly: test file, test name and reason. Each
// is a test that needs a private input the public repository deliberately lacks (the private evidence repository,
// private staging files, private runbooks, tables derived from private extracts). The SQL engine is not among them: CI
// installs it, and its absence fails (tests/helpers/pglite.mjs). Skips are reported as skipped, never as passed.
// Not named test-*.mjs: node --test would discover it as a test file.
// Usage: node scripts/ci/report-tests.mjs <jsonl-file> [allowlist-json]
import { appendFileSync, readFileSync } from "node:fs";

const [file, allowFile = new URL("./allowed-skips.json", import.meta.url)] = process.argv.slice(2);
if (!file) { console.error("usage: node scripts/ci/report-tests.mjs <jsonl-file> [allowlist-json]"); process.exit(2); }

const key = (r) => JSON.stringify([r.file, r.name, r.reason]);
const results = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const allowed = new Map();
for (const a of JSON.parse(readFileSync(allowFile, "utf8")).skips) allowed.set(key(a), (allowed.get(key(a)) ?? 0) + 1);

const passed = results.filter((r) => r.status === "pass"), failed = results.filter((r) => r.status === "fail");
const todo = results.filter((r) => r.status === "todo"), skipped = results.filter((r) => r.status === "skip");
const unexplained = [];
const used = new Map();
for (const r of skipped) {
  const k = key(r), n = (used.get(k) ?? 0) + 1;
  used.set(k, n);
  if (n > (allowed.get(k) ?? 0)) unexplained.push(r);
}
const byReason = new Map();
for (const r of skipped) byReason.set(r.reason || "(no reason)", [...(byReason.get(r.reason || "(no reason)") ?? []), r]);
const where = (r) => `${r.file ?? "(no file)"} › ${r.name}`;

const out = [
  "## Test report",
  "",
  `Results: ${results.length} · passed ${passed.length} · failed ${failed.length} · TODO ${todo.length} · skipped ${skipped.length}`,
  "",
  "Skipped tests need private inputs that the public repository and CI deliberately do not hold; each is on the exact allowlist (scripts/ci/allowed-skips.json). They are not passes.",
  "",
  ...[...byReason].flatMap(([reason, rs]) => [`- **${reason}** (${rs.length})`, ...rs.map((r) => `  - ${where(r)}`)]),
  ...(unexplained.length ? ["", `**${unexplained.length} skip(s) not on the allowlist:**`, ...unexplained.map((r) => `- ${where(r)}: «${r.reason || "no reason"}»`)] : []),
  ...(todo.length ? ["", `**${todo.length} TODO test(s), not accepted in required verification:**`, ...todo.map((r) => `- ${where(r)} (${r.ok ? "passing" : "failing"}): «${r.reason}»`)] : []),
  ...(failed.length ? ["", `**Failed (${failed.length}):**`, ...failed.map((r) => `- ${where(r)}`)] : []),
].join("\n");
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${out}\n`);
if (results.length === 0 || failed.length || todo.length || unexplained.length) process.exit(1);
