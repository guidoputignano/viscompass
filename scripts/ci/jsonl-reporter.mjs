// node --test reporter for CI (Codex review B26-02, 26 Oct 2026): one JSON line per test with the identity the report
// needs to judge a skip exactly: the test file (relative to the working directory, forward slashes), its name, its
// nesting and its outcome. TAP carries no file, so two tests of the same name in different files could not be told
// apart. Suites are omitted: only tests carry an outcome. A file that fails to load arrives as a failed test named
// after the file.
// Usage: node --test --test-reporter=./scripts/ci/jsonl-reporter.mjs --test-reporter-destination=<file>
import path from "node:path";

const rel = (file) => (file ? path.relative(process.cwd(), file).split(path.sep).join("/") : null);
const text = (v) => (typeof v === "string" ? v : "");

export default async function* jsonlReporter(source) {
  for await (const event of source) {
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    const d = event.data;
    if (d.details?.type === "suite") continue;
    const status = d.todo !== undefined && d.todo !== false ? "todo" : d.skip !== undefined && d.skip !== false ? "skip" : event.type === "test:pass" ? "pass" : "fail";
    yield `${JSON.stringify({
      file: rel(d.file), name: d.name, nesting: d.nesting, status,
      ok: event.type === "test:pass",
      reason: status === "skip" ? text(d.skip) : status === "todo" ? text(d.todo) : "",
    })}\n`;
  }
}
