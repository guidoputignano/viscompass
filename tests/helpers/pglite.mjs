// The SQL test engine of every real-PostgreSQL suite (Codex review B26-01, 26 Oct 2026): PGlite 0.5.8 (PostgreSQL 18.3),
// the same tarball as the pinned Pillar B harness (package-lock integrity sha512-n9tsbUOh…). Found, in this order:
//   1. the application's exact devDependency, installed by `npm ci` from the lockfile (CI and fresh checkouts);
//   2. the external pinned harness outside the checkout (outputs/pillar-b), for checkouts whose node_modules predate it.
// Either way the version must be 0.5.8, or the suite fails. These suites run synthetic users against the public
// migrations and shims, so CI always runs them: with process.env.CI set, a missing engine is an error, never a skip.
// Only a local checkout without either copy skips, and says why.
import { readFileSync } from "node:fs";

export const PGLITE_VERSION = "0.5.8";
const CANDIDATES = [
  ["devDependency", new URL("../../node_modules/@electric-sql/pglite/", import.meta.url)],
  ["external pinned harness", new URL("../../../outputs/pillar-b/node_modules/@electric-sql/pglite/", import.meta.url)],
];

let engine = null, source = null;
for (const [name, dir] of CANDIDATES) {
  let version;
  try { version = JSON.parse(readFileSync(new URL("package.json", dir), "utf8")).version; } catch { continue; }
  if (version !== PGLITE_VERSION) throw new Error(`PGlite ${version} found as the ${name}; the SQL suites are pinned to ${PGLITE_VERSION}`);
  ({ PGlite: engine } = await import(new URL("dist/index.js", dir).href));
  source = name;
  break;
}
if (!engine && process.env.CI) throw new Error("PGlite test engine missing in CI: `npm ci` must install the @electric-sql/pglite devDependency; the SQL suites never skip in CI");

export const PGlite = engine;
export const PGLITE_SOURCE = source;
/** The `skip` value of a real-PostgreSQL test: false whenever the engine is present, which CI requires. */
export const PGLITE_SKIP = engine ? false : "Pinned external PGlite harness unavailable";
