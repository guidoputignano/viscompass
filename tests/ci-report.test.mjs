// The CI test report (Codex review B26-02, 26 Oct 2026), exercised as CI runs it: the reporter writes JSON lines, the
// report reads them with an allowlist and decides the exit code. Synthetic test names and reasons only.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const REPORT = path.join(root, "scripts/ci/report-tests.mjs");
const REPORTER = pathToFileURL(path.join(root, "scripts/ci/jsonl-reporter.mjs")).href;
const dir = mkdtempSync(path.join(tmpdir(), "vis-ci-report-"));
const ALLOW = path.join(dir, "allow.json");
writeFileSync(ALLOW, JSON.stringify({ skips: [{ file: "tests/private.test.mjs", name: "private comparison", reason: "private-staging/facts.json not present" }] }));

let n = 0;
function report(lines) {
  const file = path.join(dir, `run-${++n}.jsonl`);
  writeFileSync(file, lines.map((l) => JSON.stringify({ nesting: 0, ok: true, reason: "", ...l })).join("\n") + (lines.length ? "\n" : ""));
  const r = spawnSync(process.execPath, [REPORT, file, ALLOW], { encoding: "utf8", env: { ...process.env, GITHUB_STEP_SUMMARY: "" } });
  return { code: r.status, out: r.stdout };
}
const pass = { file: "tests/a.test.mjs", name: "a check", status: "pass" };
const privateSkip = { file: "tests/private.test.mjs", name: "private comparison", status: "skip", reason: "private-staging/facts.json not present" };

test("B26-02: a skip whose reason merely sounds private, but is not on the allowlist, fails", () => {
  const r = report([pass, { file: "tests/auth.test.mjs", name: "required authorization check", status: "skip", reason: "Authorization checks not present" }]);
  assert.equal(r.code, 1);
  assert.match(r.out, /1 skip\(s\) not on the allowlist/);
  assert.match(r.out, /tests\/auth\.test\.mjs › required authorization check: «Authorization checks not present»/);
});

test("B26-02: a failing TODO fails, and so does a passing one; both are counted", () => {
  const failing = report([pass, { file: "tests/auth.test.mjs", name: "required authorization check", status: "todo", ok: false, reason: "fix regression" }]);
  assert.equal(failing.code, 1);
  assert.match(failing.out, /TODO 1/);
  assert.match(failing.out, /required authorization check \(failing\): «fix regression»/);
  const passing = report([pass, { file: "tests/a.test.mjs", name: "later", status: "todo", ok: true, reason: "later" }]);
  assert.equal(passing.code, 1);
  assert.match(passing.out, /\(passing\)/);
});

test("B26-02: only the exact allowlisted skip passes: same file, same name, same reason, at most as often as listed", () => {
  assert.equal(report([pass, privateSkip]).code, 0, "the legitimate private-input skip");
  assert.equal(report([pass, { ...privateSkip, name: "another test" }]).code, 1, "same reason, other test");
  assert.equal(report([pass, { ...privateSkip, file: "tests/other.test.mjs" }]).code, 1, "same test name, other file");
  assert.equal(report([pass, { ...privateSkip, reason: "private-staging/other.json not present" }]).code, 1, "same test, other reason");
  assert.equal(report([pass, privateSkip, privateSkip]).code, 1, "listed once, skipped twice");
});

test("B26-02: a failure fails, a clean run passes, an empty run fails", () => {
  assert.equal(report([pass, { file: "tests/a.test.mjs", name: "broken", status: "fail", ok: false }]).code, 1);
  assert.equal(report([pass]).code, 0);
  assert.equal(report([]).code, 1);
});

test("B26-02: the reporter records file, name, outcome and reason for every test, and omits suites", () => {
  const fixture = path.join(dir, "sample.test.mjs");
  writeFileSync(fixture, [
    "import test, { describe } from 'node:test';",
    "test('plain pass', () => {});",
    "test('private skip', { skip: 'private thing not present' }, () => {});",
    "test('pending todo', { todo: 'fix regression' }, () => { throw new Error('x'); });",
    "describe('a suite', () => { test('inner pass', () => {}); });",
  ].join("\n"));
  const out = path.join(dir, "fixture.jsonl");
  // A child of the test runner inherits NODE_TEST_CONTEXT and would report to the parent instead of the reporter.
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "NODE_TEST_CONTEXT" && k !== "NODE_OPTIONS"));
  spawnSync(process.execPath, ["--test", `--test-reporter=${REPORTER}`, `--test-reporter-destination=${out}`, "sample.test.mjs"], { cwd: dir, encoding: "utf8", env: childEnv });
  const rows = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(rows.map((r) => [r.file, r.name, r.status, r.reason]), [
    ["sample.test.mjs", "plain pass", "pass", ""],
    ["sample.test.mjs", "private skip", "skip", "private thing not present"],
    ["sample.test.mjs", "pending todo", "todo", "fix regression"],
    ["sample.test.mjs", "inner pass", "pass", ""],
  ]);
});
