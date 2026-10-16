import "server-only";
import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { parseCWorkbookIndex, parseCWorkbookSection, type CWorkbookIndex, type CWorkbookSectionId, type CWorkbookSection } from "@/lib/dashboard-review/pillar-c/workbook";
import { C_WORKBOOK_STORAGE } from "@/lib/dashboard-review/pillar-c/workbook-storage";
import { createServerCache } from "@/lib/dashboard-review/pillar-b/server-cache";

type Failed = { state: "forbidden" | "invalid" | "not_configured" };
type Config = { root?: string };
// Only pinned immutable artifacts are shared. Membership/reviewer checks still
// run before every read, including a cache hit. Custom/local test readers bypass it.
const artifacts = createServerCache({ ttlMs: 10 * 60_000, max: 16 });
export type CWorkbookRead = (name: string, hash: string, root?: string) => Promise<Uint8Array | null>;

/** Service-only transport. Neither bytes nor private sections reach ordinary members. */
export const readCWorkbookArtifact: CWorkbookRead = async (name, hash, localRoot) => {
  if (!/^(index|[a-z]+)$/.test(name) || !/^[a-f0-9]{64}$/.test(hash)) return null;
  if (localRoot) {
    if (!path.isAbsolute(localRoot)) return null;
    const [root, checkout] = await Promise.all([realpath(localRoot), realpath(process.cwd())]);
    const relative = path.relative(checkout, root);
    if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) return null;
    const file = await realpath(path.join(root, `${name}.json`));
    if (path.dirname(file) !== root || (await stat(file)).size > 5_000_000) return null;
    return new Uint8Array(await readFile(file));
  }
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key) return null;
  const response = await fetch(`${origin}/storage/v1/object/authenticated/${C_WORKBOOK_STORAGE.bucket}/${C_WORKBOOK_STORAGE.prefix}/${name}-${hash}.json`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok || Number(response.headers.get("content-length") ?? 0) > 5_000_000 || !response.body) return null;
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 5_000_000) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
};
async function read(name: string, hash: string, config: Config, reader: CWorkbookRead) {
  const load = async () => {
    const bytes = await reader(name, hash, config.root);
    if (!bytes || bytes.byteLength < 2 || bytes.byteLength > 5_000_000 || createHash("sha256").update(bytes).digest("hex") !== hash) throw new Error("C_WORKBOOK_INTEGRITY");
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  };
  return reader === readCWorkbookArtifact && !config.root
    ? artifacts.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}|${name}|${hash}`, load)
    : load();
}
export async function loadCWorkbookIndex(approved: boolean, reviewer: boolean,
  config: Config = { root: process.env.PILLAR_C_WORKBOOK_ROOT }, reader: CWorkbookRead = readCWorkbookArtifact,
): Promise<{ state: "ready"; index: CWorkbookIndex } | Failed> {
  if (!approved || !reviewer) return { state: "forbidden" };
  try { return { state: "ready", index: parseCWorkbookIndex(await read("index", C_WORKBOOK_STORAGE.index, config, reader)) }; }
  catch { return { state: "invalid" }; }
}
export async function loadCWorkbookSection(section: CWorkbookSectionId, approved: boolean, reviewer: boolean,
  config: Config = { root: process.env.PILLAR_C_WORKBOOK_ROOT }, reader: CWorkbookRead = readCWorkbookArtifact,
): Promise<{ state: "ready"; section: CWorkbookSection } | Failed> {
  if (!approved || !reviewer) return { state: "forbidden" };
  const index = await loadCWorkbookIndex(approved, reviewer, config, reader);
  if (index.state !== "ready") return index;
  const source = index.index.sections[section]; if (!source) return { state: "invalid" };
  try { return { state: "ready", section: parseCWorkbookSection(await read(section, source.sha256, config, reader), section, index.index) }; }
  catch { return { state: "invalid" }; }
}
