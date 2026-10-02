// Server-side access to the public Pillar B evidence: AIFA's EV/SC focus
// tables, compiled by scripts/build_pillar_b_public_aifa_ev_sc.py.
//
// Same posture as lib/pillar-a/server-data.ts: the compiled file lives in
// `data/public-compiled/`, not in `public/`, so Next never serves it as a
// static asset; what reaches the browser is what the page renders. This asset
// is small (nine tables of 22 rows) and every figure is on the page, so there
// is no slicing route: the page passes the rows it draws as props.
//
// NOTHING PRIVATE CAN ENTER HERE. This module imports no Supabase client, no
// private Pillar B module and nothing derived from the confidential workbook.
// The asset is checked at module load for internal provenance (digest-shaped
// values, internal keys, filesystem paths) and for its own invariants: a bad
// regeneration breaks the first render instead of leaking quietly.
import "server-only";
import asset from "@/data/public-compiled/pillar-b-aifa-ev-sc-2025.json";
import { ITALY, MEASURES, MOLECULES, type EvScAsset } from "./ev-sc-view";

const INTERNAL_KEYS = new Set(["sources", "checks", "sourceFile", "source_file", "sha256", "source_sha256", "source_cells", "sourcePath", "manifest", "method"]);
const SHA256 = /^[a-f0-9]{64}$/i;
const INTERNAL_PATH = /(^|[\\/])data[\\/]raw[\\/]|^[A-Za-z]:[\\/]/;

function assertClean(label: string, payload: unknown): void {
  const walk = (node: unknown, path: string): void => {
    if (typeof node === "string") {
      if (SHA256.test(node)) throw new Error(`${label}: digest-shaped value at ${path}`);
      if (INTERNAL_PATH.test(node)) throw new Error(`${label}: internal path at ${path}`);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, inner] of Object.entries(node as Record<string, unknown>)) {
        if (INTERNAL_KEYS.has(key)) throw new Error(`${label}: internal key "${key}" at ${path}`);
        walk(inner, `${path}.${key}`);
      }
    }
  };
  walk(payload, label);
}

function assertShape(label: string, a: EvScAsset): void {
  const territories = new Set(a.territories.map((t) => t.code));
  if (!territories.has(ITALY)) throw new Error(`${label}: Italia missing`);
  if (a.rows.length !== MOLECULES.length * MEASURES.length * territories.size) {
    throw new Error(`${label}: expected ${MOLECULES.length * MEASURES.length * territories.size} rows, found ${a.rows.length}`);
  }
  for (const r of a.rows) {
    if (!territories.has(r.territory)) throw new Error(`${label}: unknown territory ${r.territory}`);
    const sum = r.originator_ev + r.biosimilar_ev + r.originator_sc + r.biosimilar_sc;
    if (Math.abs(sum - 100) > 0.02) throw new Error(`${label}: row ${r.molecule}/${r.measure}/${r.territory} sums to ${sum}`);
    for (const v of [r.originator_ev, r.biosimilar_ev, r.originator_sc, r.biosimilar_sc]) {
      if (!(v >= 0 && v <= 100)) throw new Error(`${label}: value out of range in ${r.molecule}/${r.measure}/${r.territory}`);
    }
  }
}

const publicEvSc = asset as EvScAsset;
assertClean("pillar-b-aifa-ev-sc-2025.json", publicEvSc);
assertShape("pillar-b-aifa-ev-sc-2025.json", publicEvSc);

export function getPublicEvSc(): EvScAsset {
  return publicEvSc;
}
