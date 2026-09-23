import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname: the checkout directory contains a space and
// pathname leaves it percent-encoded.
const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const SHA256 = /[a-f0-9]{64}/;
const INTERNAL_PATH = /(^|[\\/])data[\\/]raw[\\/]/;
const INTERNAL_KEYS = ['sources', 'checks', 'sourceFile', 'source_file', 'sha256', 'source_sha256', 'source_cells'];

test('no compiled Pillar A data is served as a static asset', () => {
  const publicDir = path.join(root, 'public');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/pillar-a.*\.(json|csv)$/i.test(entry.name)) offenders.push(path.relative(root, full));
    }
  };
  if (fs.existsSync(publicDir)) walk(publicDir);
  assert.deepEqual(offenders, [], 'compiled Pillar A data must live outside public/, behind a route handler');
});

test('every compiled public artifact is free of internal provenance', () => {
  const dir = path.join(root, 'data/public-compiled');
  const files = fs.readdirSync(dir);
  assert.ok(files.length > 0);
  for (const name of files) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    assert.equal(SHA256.test(text), false, `${name} still carries a digest-shaped value`);
    assert.equal(INTERNAL_PATH.test(text), false, `${name} still carries an internal filesystem path`);
    if (name.endsWith('.json')) {
      const seen = new Set();
      const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (node && typeof node === 'object') {
          for (const [key, value] of Object.entries(node)) { seen.add(key); walk(value); }
        }
      };
      walk(JSON.parse(text));
      for (const key of INTERNAL_KEYS) assert.equal(seen.has(key), false, `${name} still carries the "${key}" key`);
    }
  }
});

test('the middleware allowlist releases only the approved public observatory', () => {
  const proxy = read('lib/supabase/proxy.ts');
  const block = proxy.slice(proxy.indexOf('PUBLIC_PATHS'), proxy.indexOf('includes(request.nextUrl.pathname)'));
  for (const allowed of ['/pillar-a', '/api/pillar-a/series', '/api/pillar-a/osmed', '/api/pillar-a/atc4']) {
    assert.ok(block.includes(`"${allowed}"`), `${allowed} should be public`);
  }
  // Bulk export must never be allowlisted: it is gated on approved membership.
  assert.equal(block.includes('/api/pillar-a/export'), false, 'the export route must not bypass the session check');
  // The old static asset paths must not come back.
  assert.equal(proxy.includes('/data/pillar-a'), false, 'static data paths should no longer exist');
});

test('missing Supabase configuration fails closed rather than open', () => {
  const proxy = read('lib/supabase/proxy.ts');
  const guard = proxy.slice(proxy.indexOf('if (!hasEnvVars)'), proxy.indexOf('createServerClient('));
  assert.ok(guard.includes('503'), 'an unconfigured environment must refuse, not serve');
  assert.equal(/if \(!hasEnvVars\) \{\s*return supabaseResponse;/.test(proxy), false, 'the fail-open branch is back');
});

test('bulk export requires an approved membership, not merely a session', () => {
  const route = read('app/api/pillar-a/export/route.ts');
  assert.ok(route.includes('getCurrentOrg'), 'export must derive an approved membership');
  assert.ok(route.includes('hasEnvVars'), 'export must fail closed without auth configuration');
  assert.ok(route.includes('403'), 'a session without approved membership must be refused');
  // cacheComponents rejects segment config, so the no-cache guarantee rests on
  // the cookie read making the route dynamic plus no-store on every response.
  assert.equal(route.includes('"use cache"'), false, 'an authorized route must not opt into caching');
  const responses = route.match(/NextResponse[\s\S]*?\)/g) ?? [];
  assert.ok(responses.length >= 3);
  assert.equal(
    (route.match(/no-store/g) ?? []).length >= 3,
    true,
    'every response from the export route must carry no-store',
  );
});

test('the ATC4 route releases one slice, not the compiled table', () => {
  const route = read('app/api/pillar-a/atc4/route.ts');
  assert.ok(route.includes('region') && route.includes('channel'), 'the slice is keyed by territory and channel');
  assert.ok(route.includes('400'), 'an unknown territory, channel or family is rejected');
  const client = read('components/pillar-a-atc4.tsx');
  assert.ok(client.includes('/api/pillar-a/atc4?'), 'the client must request a slice');
});
