// CI test report (PR25-05 / production closure, 26 Oct 2026). Reads the TAP output of the node test run and:
//   - prints the counts and every skipped test with its reason, also to the GitHub job summary when there is one;
//   - fails when a test failed, when the run reported nothing, or when a test was skipped for any reason other than a
//     private input that is deliberately absent from the public repository and from CI (the private evidence repo,
//     the pinned external PGlite harness, private staging files, derived tables built from private extracts).
// The public repository never carries those inputs, so in CI these tests are reported as skipped, never as passed.
// Not named test-*.mjs: node --test would discover it as a test file.
// Usage: node scripts/ci/report-tests.mjs <tap-file>
import { appendFileSync, readFileSync } from "node:fs";

const PRIVATE_INPUT = [
  /^Pinned external PGlite harness unavailable$/,
  /^PGlite engine not available$/,
  /^Private SQL runbooks unavailable$/,
  /^.+ (is|are) not available locally$/,
  /^.+ not present$/,
  /^derived .+ not built$/,
];

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/ci/report-tests.mjs <tap-file>"); process.exit(2); }
const lines = readFileSync(file, "utf8").split(/\r?\n/);
const results = [];
for (const line of lines) {
  const m = /^\s*(not ok|ok) \d+ - (.*?)(?: # (SKIP|TODO)(?: (.*))?)?$/.exec(line);
  if (m) results.push({ ok: m[1] === "ok", name: m[2].replace(/\\#/g, "#"), directive: m[3] ?? null, reason: (m[4] ?? "").trim() });
}
const failed = results.filter((r) => !r.ok && r.directive !== "TODO");
const skipped = results.filter((r) => r.directive === "SKIP");
const unexplained = skipped.filter((r) => !PRIVATE_INPUT.some((re) => re.test(r.reason)));
const byReason = new Map();
for (const r of skipped) byReason.set(r.reason || "(no reason)", [...(byReason.get(r.reason || "(no reason)") ?? []), r.name]);

const out = [
  "## Test report",
  "",
  `Results: ${results.length} · passed ${results.filter((r) => r.ok && !r.directive).length} · failed ${failed.length} · skipped ${skipped.length}`,
  "",
  "Skipped tests need private inputs that the public repository and CI deliberately do not hold. They are not passes.",
  "",
  ...[...byReason].flatMap(([reason, names]) => [`- **${reason}** (${names.length})`, ...names.map((n) => `  - ${n}`)]),
  ...(unexplained.length ? ["", `**${unexplained.length} skip(s) without a recognised private-input reason:**`, ...unexplained.map((r) => `- ${r.name}: «${r.reason || "no reason"}»`)] : []),
  ...(failed.length ? ["", `**Failed (${failed.length}):**`, ...failed.map((r) => `- ${r.name}`)] : []),
].join("\n");
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${out}\n`);
if (results.length === 0 || failed.length || unexplained.length) process.exit(1);
