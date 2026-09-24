// Resolves the project's "@/" alias for `node --test`.
//
// tsconfig maps "@/*" to the project root, which is a bundler feature: Node
// cannot resolve it, so any module using it was untestable and the modules that
// needed tests had to avoid the alias entirely. That pushed orchestration code
// out of reach of the test runner, which is where the bugs are.
//
// This hook is test infrastructure only. It changes no production source and is
// registered from tests/_register-alias.mjs via the test script.
import {fileURLToPath, pathToFileURL} from 'node:url';
import {existsSync, statSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
// Mirrors what a bundler tries, most specific first. `.ts` precedes `.js` so a
// source file wins over a stale build artefact sitting beside it.
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'];

function locate(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  for (const ext of EXTENSIONS) {
    const candidate = path.join(base, 'index' + ext);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const found = locate(path.join(ROOT, specifier.slice(2)));
    if (!found) {
      throw new Error(
        `Cannot resolve "${specifier}" under ${ROOT}. The alias points at the project root; ` +
          `check the path, or that the file has one of ${EXTENSIONS.join(', ')}.`,
      );
    }
    return {url: pathToFileURL(found).href, shortCircuit: true};
  }
  return nextResolve(specifier, context);
}
