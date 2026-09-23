// Server-side access to the compiled Pillar A public evidence.
//
// The compiled files live in `data/public-compiled/`, NOT in `public/`, so Next
// never serves them as static assets. Every byte that reaches a browser passes
// through a route handler in `app/api/pillar-a/`, which lets us decide per
// request how much to release and to whom.
//
// This does not make delivered values unextractable: anything rendered can be
// read back out of the page. What it does is stop the entire compiled dataset
// being retrievable as one file from a permanent, guessable URL, and it keeps
// internal provenance out of every response.
import "server-only";
import annual from "@/data/public-compiled/pillar-a.json";
import atc4 from "@/data/public-compiled/pillar-a-atc4.json";
import osmed from "@/data/public-compiled/pillar-a-osmed.json";
import {slicePublicSeries} from './series-slice';

// Keys that describe how VIS produced a figure rather than the figure itself.
// They are stripped on load and asserted absent, so a regenerated input cannot
// reintroduce them by being copied into `data/public-compiled/` unsanitised.
const INTERNAL_KEYS = new Set([
  "sources",
  "checks",
  "sourceFile",
  "source_file",
  "sha256",
  "source_sha256",
  "source_cells",
  "sourcePath",
  "manifest",
]);

const SHA256 = /^[a-f0-9]{64}$/i;
const INTERNAL_PATH = /(^|[\\/])data[\\/]raw[\\/]|^[A-Za-z]:[\\/]/;

function strip<T>(value: T): T {
  if (Array.isArray(value)) return value.map(strip) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (INTERNAL_KEYS.has(key)) continue;
      out[key] = strip(inner);
    }
    return out as unknown as T;
  }
  return value;
}

// Fail loudly rather than publishing something we did not intend to. This runs
// once per server process, at module load, so a bad input breaks the build's
// first render instead of leaking quietly at runtime.
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

const publicSeries = strip(annual);
const publicOsmed = strip(osmed);
assertClean("pillar-a.json", publicSeries);
assertClean("pillar-a-osmed.json", publicOsmed);

export function getPublicSeries(region:string,group:string,channel:string) {
  return slicePublicSeries(publicSeries,region,group,channel);
}

export function getPublicOsmed() {
  return publicOsmed;
}

type Atc4Slice = {
  years: number[];
  region: string;
  channel: string;
  codes: { code: string; label: string }[];
  // [yearIdx, codeIdx, spendEur, packs]
  rows: [number, number, number, number][];
};

// The ATC4 breakdown is released one territory-and-channel slice at a time —
// roughly 310 rows instead of the full 10,570 — because that is all the panel
// ever displays at once. Iterating the selectors can still reassemble it; the
// point is that the compiled table is not handed over in a single request.
export function getAtc4Slice(region: string, channel: string, prefix: string): Atc4Slice | null {
  const regionIdx = atc4.regions.indexOf(region);
  const channelIdx = atc4.channels.indexOf(channel);
  if (regionIdx < 0 || channelIdx < 0) return null;

  const keep = new Map<number, number>(); // source code index -> slice code index
  const codes: { code: string; label: string }[] = [];
  const rows: [number, number, number, number][] = [];

  for (const [yearIdx, r, ch, codeIdx, spend, packs] of atc4.rows as number[][]) {
    if (r !== regionIdx || ch !== channelIdx) continue;
    const code = atc4.codes[codeIdx];
    if (!code.startsWith(prefix)) continue;
    let sliceIdx = keep.get(codeIdx);
    if (sliceIdx === undefined) {
      sliceIdx = codes.length;
      keep.set(codeIdx, sliceIdx);
      codes.push({ code, label: (atc4.labels as Record<string, string>)[code] ?? "" });
    }
    rows.push([yearIdx, sliceIdx, spend, packs]);
  }

  return { years: atc4.years, region, channel, codes, rows };
}

export const ATC4_REGIONS: string[] = atc4.regions;
export const ATC4_CHANNELS: string[] = atc4.channels;
