import "server-only";
import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createServerCache } from "@/lib/dashboard-review/pillar-b/server-cache";
import { C_ATTR_CHANNELS, C_ATTR_ORGS, C_ATTR_PERIODS, type CAttrChannel, type CAttrOrg, type CAttrPeriod } from "@/lib/dashboard-review/pillar-c/attribution";
import { cPortfolioOtherPeriod, cPortfolioView, parseCPortfolioPacket, type CPortfolioPacket, type CPortfolioView } from "@/lib/dashboard-review/pillar-c/portfolio";
import { C_PORTFOLIO_STORAGE } from "@/lib/dashboard-review/pillar-c/portfolio-storage";

type Config = { root?: string };
type Ref = { name: string; sha256: string; bytes: number };
type Index = Omit<CPortfolioPacket, "schema" | "scopes"> & { schema: "pillar-c-portfolio-index-v1"; scopes: Record<string, Ref> };
const LIMIT = 5_000_000;
const cache = createServerCache({ ttlMs: 10 * 60_000, max: 24 });
export type CPortfolioRead = (name: string, hash: string, root?: string) => Promise<Uint8Array | null>;
export const readCPortfolioArtifact: CPortfolioRead = async (name, hash, root) => {
  if (!/^(index|(?:FY202[45]|JM202[56])-(?:Regione|AQ|CH|PE|TE)-(?:Tutti|CO|DD|DPC))$/.test(name) || !/^[a-f0-9]{64}$/.test(hash)) return null;
  if (root) {
    if (!path.isAbsolute(root)) return null;
    const [directory, checkout] = await Promise.all([realpath(root), realpath(process.cwd())]);
    const rel = path.relative(checkout, directory); if (!rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)) return null;
    const file = await realpath(path.join(directory, `${name}.json`));
    if (path.dirname(file) !== directory || (await stat(file)).size > LIMIT) return null;
    return new Uint8Array(await readFile(file));
  }
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key) return null;
  const response = await fetch(`${origin}/storage/v1/object/authenticated/${C_PORTFOLIO_STORAGE.bucket}/${C_PORTFOLIO_STORAGE.prefix}/${name}-${hash}.json`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length") ?? 0) > LIMIT) return null;
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > LIMIT) { await reader.cancel(); return null; } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return bytes;
};
async function artifact(name: string, hash: string, config: Config, reader: CPortfolioRead, bytesExpected?: number) {
  const read = async () => {
    const bytes = await reader(name, hash, config.root);
    if (!bytes || bytes.length < 2 || bytes.length > LIMIT || (bytesExpected !== undefined && bytes.length !== bytesExpected) || createHash("sha256").update(bytes).digest("hex") !== hash) throw Error("C_PORTFOLIO_INTEGRITY");
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  };
  return reader === readCPortfolioArtifact && !config.root ? cache.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}|${name}|${hash}`, read) : read();
}
export async function loadCPortfolioView(approved: boolean, reviewer: boolean, period: CAttrPeriod, org: CAttrOrg, channel: CAttrChannel, portfolio: string,
  config: Config = { root: process.env.PILLAR_C_PORTFOLIO_ROOT }, reader: CPortfolioRead = readCPortfolioArtifact,
): Promise<{ state: "ready"; view: CPortfolioView } | { state: "forbidden" | "invalid" }> {
  // Authorization is deliberately ahead of transport and every cache access.
  if (!approved || !reviewer) return { state: "forbidden" };
  if (!C_ATTR_PERIODS.includes(period) || !C_ATTR_ORGS.includes(org) || !C_ATTR_CHANNELS.includes(channel) || !/^[A-Z0-9]{2,12}$/.test(portfolio)) return { state: "invalid" };
  try {
    const raw = await artifact("index", C_PORTFOLIO_STORAGE.index, config, reader);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("C_PORTFOLIO_INDEX");
    const index = raw as Index;
    if (index.schema !== "pillar-c-portfolio-index-v1" || Object.keys(index).length !== 7 || !index.scopes || Array.isArray(index.scopes) || Object.keys(index.scopes).length !== 80 || !Array.isArray(index.portfolios) || !index.portfolios.some(p => p.id === portfolio)) throw Error("C_PORTFOLIO_INDEX");
    const scopes = await Promise.all([period, cPortfolioOtherPeriod(period)].map(async p => {
      const ref = index.scopes[`${p}|${org}|${channel}`];
      if (!ref || ref.name !== `${p}-${org}-${channel}` || !/^[a-f0-9]{64}$/.test(ref.sha256) || !Number.isSafeInteger(ref.bytes) || ref.bytes < 2 || ref.bytes > LIMIT || Object.keys(ref).length !== 3) throw Error("C_PORTFOLIO_SCOPE");
      return artifact(ref.name, ref.sha256, config, reader, ref.bytes);
    }));
    const packet = parseCPortfolioPacket({ schema: "pillar-c-portfolio-v1", precision: index.precision, sourceSha256: index.sourceSha256, classificationSha256: index.classificationSha256, mappingVersion: index.mappingVersion, portfolios: index.portfolios, scopes });
    return { state: "ready", view: cPortfolioView(packet, period, org, channel, portfolio, C_PORTFOLIO_STORAGE.index) };
  } catch { return { state: "invalid" }; }
}
