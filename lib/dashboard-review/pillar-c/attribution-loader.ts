import "server-only";
import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createServerCache } from "@/lib/dashboard-review/pillar-b/server-cache";
import { C_ATTR_STORAGE } from "@/lib/dashboard-review/pillar-c/attribution-storage";
import { C_ATTR_CHANNELS, C_ATTR_ORGS, C_ATTR_PERIODS, cAttrScope, parseCAttrPacket, type CAttrChannel, type CAttrOrg, type CAttrPacket, type CAttrPeriod, type CAttrPortfolio, type CAttrScope } from "@/lib/dashboard-review/pillar-c/attribution";

/** sourceSnapshot is the immutable shard index (C_ATTR_STORAGE.index) that exports bind to. */
export type CAttrView = { schema: "pillar-c-attribution-view-v1"; sourceSha256: string; classificationSha256: string; mappingVersion: string; sourceSnapshot: string; portfolios: CAttrPortfolio[]; scope: CAttrScope; comparison: CAttrScope | null };
type Config = { root?: string };
type Ref = { name: string; sha256: string; bytes: number };
type Index = Omit<CAttrPacket, "schema" | "scopes"> & { schema: "pillar-c-attribution-index-v1"; scopes: Record<string, Ref> };
const cache = createServerCache({ ttlMs: 10 * 60_000, max: 32 });
export type CAttrRead = (name: string, hash: string, root?: string) => Promise<Uint8Array | null>;
export const readCAttrArtifact: CAttrRead = async (name, hash, root) => {
  if (!/^(index|(?:FY202[45]|JM202[56])-(?:Regione|AQ|CH|PE|TE)-(?:Tutti|CO|DD|DPC))$/.test(name) || !/^[a-f0-9]{64}$/.test(hash)) return null;
  if (root) {
    if (!path.isAbsolute(root)) return null;
    const [directory, checkout] = await Promise.all([realpath(root), realpath(process.cwd())]);
    const rel = path.relative(checkout, directory);
    if (!rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)) return null;
    const file = await realpath(path.join(directory, `${name}.json`));
    if (path.dirname(file) !== directory || (await stat(file)).size > 1_000_000) return null;
    return new Uint8Array(await readFile(file));
  }
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key) return null;
  const response = await fetch(`${origin}/storage/v1/object/authenticated/${C_ATTR_STORAGE.bucket}/${C_ATTR_STORAGE.prefix}/${name}-${hash}.json`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length") ?? 0) > 1_000_000) return null;
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  for (;;) { const {done,value} = await reader.read(); if(done)break; length += value.length; if(length>1_000_000){await reader.cancel();return null;}chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;} return bytes;
};
async function artifact(name: string, hash: string, config: Config, reader: CAttrRead) {
  const read = async () => {
    const bytes = await reader(name,hash,config.root);
    if (!bytes || bytes.length < 2 || bytes.length > 1_000_000 || createHash("sha256").update(bytes).digest("hex") !== hash) throw Error("C_ATTR_INTEGRITY");
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  };
  return reader === readCAttrArtifact && !config.root ? cache.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}|${name}|${hash}`,read) : read();
}
export async function loadCAttrView(approved: boolean, reviewer: boolean, period: CAttrPeriod, org: CAttrOrg, channel: CAttrChannel,
  config: Config = { root: process.env.PILLAR_C_ATTRIBUTION_ROOT }, reader: CAttrRead = readCAttrArtifact,
): Promise<{state:"ready";view:CAttrView}|{state:"forbidden"|"invalid"}> {
  // These checks precede every artifact/cache access, not only a cache miss.
  if (!approved || !reviewer) return {state:"forbidden"};
  if (!C_ATTR_PERIODS.includes(period) || !C_ATTR_ORGS.includes(org) || !C_ATTR_CHANNELS.includes(channel)) return {state:"invalid"};
  try {
    const raw = await artifact("index",C_ATTR_STORAGE.index,config,reader);
    if (!raw || typeof raw !== "object") throw Error("C_ATTR_INDEX");
    const index = raw as Index;
    if (index.schema !== "pillar-c-attribution-index-v1" || Object.keys(index).length !== 7 || !index.scopes || Array.isArray(index.scopes) || Object.keys(index.scopes).length > 80) throw Error("C_ATTR_INDEX");
    const other: CAttrPeriod = period === "FY2024" ? "FY2025" : period === "FY2025" ? "FY2024" : period === "JM2025" ? "JM2026" : "JM2025";
    const periods = [period, other];
    const scopes = await Promise.all(periods.map(async p => {
      const ref = index.scopes[`${p}|${org}|${channel}`];
      if (!ref || ref.name !== `${p}-${org}-${channel}` || !Number.isSafeInteger(ref.bytes) || ref.bytes < 2 || ref.bytes > 1_000_000) throw Error("C_ATTR_SCOPE");
      return artifact(ref.name,ref.sha256,config,reader);
    }));
    const meta = {sourceSha256:index.sourceSha256,classificationSha256:index.classificationSha256,mappingVersion:index.mappingVersion,precision:index.precision,portfolios:index.portfolios};
    const packet = parseCAttrPacket({...meta,schema:"pillar-c-attribution-v1",scopes});
    const selected = cAttrScope(packet,period,org,channel), comparison = cAttrScope(packet,other,org,channel);
    if (!selected || !comparison) throw Error("C_ATTR_SCOPE");
    return {state:"ready",view:{schema:"pillar-c-attribution-view-v1",sourceSha256:packet.sourceSha256,classificationSha256:packet.classificationSha256,mappingVersion:packet.mappingVersion,sourceSnapshot:C_ATTR_STORAGE.index,portfolios:packet.portfolios,scope:selected,comparison}};
  } catch { return {state:"invalid"}; }
}
