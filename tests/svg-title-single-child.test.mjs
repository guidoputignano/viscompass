import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// An SVG <title> must hold exactly ONE text child. React 19 treats <title>
// specially, and a title built from several JSX pieces ({a} {b}: {c}) renders
// differently on the server and in the browser: hydration error #418, which
// the live Pillar B page showed on 2 October 2026 (components/private-
// deviation-plot.tsx documents the same rule). Plain text, or one {…}
// expression such as a template string, is the only safe form.
const root = fileURLToPath(new URL("..", import.meta.url));

/** True when `body` is plain text or exactly one {…} expression. */
export function isSingleChild(body) {
  const b = body.trim();
  if (!b.includes("{")) return true;
  if (!b.startsWith("{") || !b.endsWith("}")) return false;
  let depth = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] === "{") depth++;
    else if (b[i] === "}") { depth--; if (depth === 0 && i !== b.length - 1) return false; }
  }
  return depth === 0;
}

test("the checker itself: one expression or plain text passes, adjacent pieces fail", () => {
  assert.equal(isSingleChild("Totale"), true);
  assert.equal(isSingleChild("{`${a} ${b}: ${c}`}"), true);
  assert.equal(isSingleChild("{label(x)}"), true);
  assert.equal(isSingleChild("{a} {b}: {c}"), false);
  assert.equal(isSingleChild("{a}: euro"), false);
  assert.equal(isSingleChild("mese {m}"), false);
});

test("every <title> in a component has a single text child", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (!["node_modules", ".next"].includes(entry.name)) walk(rel); continue; }
      if (!entry.name.endsWith(".tsx")) continue;
      // Comments are not markup: drop block comments (including {/* */} in JSX)
      // and line comments before looking for <title>.
      const text = fs.readFileSync(path.join(root, rel), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
      for (const m of text.matchAll(/<title>([\s\S]*?)<\/title>/g)) {
        if (!isSingleChild(m[1])) offenders.push(`${rel}: <title>${m[1].trim().slice(0, 80)}</title>`);
      }
    }
  };
  for (const d of ["app", "components"]) walk(d);
  assert.deepEqual(offenders, []);
});
