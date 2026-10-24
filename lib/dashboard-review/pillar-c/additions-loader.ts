import "server-only";
import { createHash } from "node:crypto";
import { C_ADDITIONS_MAX_BYTES, C_ADDITIONS_STORAGE } from "@/lib/dashboard-review/pillar-c/additions-storage";
import { C_ADD_ORDER } from "@/lib/dashboard-review/pillar-c/additions";
import { C_EXT_UNIT_LABELS } from "@/lib/dashboard-review/pillar-c/extension";
import { cAdditionsComplementCheck, parseCAdditionsFull, parseCAdditionsUnit, type CAdditionsLoad } from "@/lib/dashboard-review/pillar-c/additions-parse";
import { cScopedKeyAllowed, type PillarCScopedAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { pcsLog, readCScopedObject, readCScopedRegionalObject, type CScopedStorageClient } from "@/lib/dashboard-review/pillar-c/scoped-transport";
import { C_SCOPED_AGGREGATE, C_SCOPED_UNITS, type CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

/**
 * Loaders of the Pillar C additions (build add-v1: P8-03 residence, P10-04 narrowing by area, P10-05 File F fields),
 * read like the extension (extension-loader.ts). Fail closed: any missing object, refused read, size or hash mismatch,
 * parse, guard or consistency failure gives «unavailable», and each panel then says so without a value. No cache: every
 * request reads again, and nothing one user was entitled to is served to another.
 *   - reviewer: the full object from the private review bucket, by the service role, only after the reviewer gate;
 *   - Regione (regional analytical parity): the same bytes from the regional folder, under its own session;
 *   - Azienda (O1): its own unit object and the aggregate's, under its own session; never another unit.
 */
export type { CAdditionsLoad };
export type CAdditionsRemote = () => Promise<{ state: "ready"; bytes: Uint8Array } | { state: "not_configured" | "invalid" }>;

/** Service-role read of the reviewer object, called only after the reviewer gate. */
async function readReviewerObject(): Promise<{ state: "ready"; bytes: Uint8Array } | { state: "not_configured" | "invalid" }> {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key) return { state: "not_configured" };
  const pin = C_ADDITIONS_STORAGE.reviewer;
  try {
    const response = await fetch(`${origin}/storage/v1/object/authenticated/${pin.bucket}/${pin.object}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok || !response.body || Number(response.headers.get("content-length") ?? 0) > C_ADDITIONS_MAX_BYTES) return { state: "invalid" };
    // Counted while streaming: a response without Content-Length is still cut at the cap.
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > C_ADDITIONS_MAX_BYTES) { await reader.cancel(); return { state: "invalid" }; } chunks.push(value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { state: "ready", bytes };
  } catch { return { state: "invalid" }; }
}

const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;

/** Reviewer: the aggregate and ASL 1-4 under the reviewed labels. */
export async function loadCAdditionsReviewer(approved: boolean, projectReviewer: boolean, remote: CAdditionsRemote = readReviewerObject): Promise<CAdditionsLoad> {
  if (!approved || !projectReviewer) return { state: "forbidden" };
  const read = await remote();
  if (read.state === "not_configured") return { state: "not_configured" };
  if (read.state !== "ready") return { state: "unavailable" };
  const pin = C_ADDITIONS_STORAGE.reviewer;
  if (read.bytes.byteLength !== pin.bytes || createHash("sha256").update(read.bytes).digest("hex") !== pin.sha256) return { state: "unavailable" };
  try {
    const entries = parseCAdditionsFull(decode(read.bytes));
    return { state: "ready", view: { units: entries.map((entry) => ({ key: entry.unit, label: C_EXT_UNIT_LABELS[entry.unit], entry })) } };
  } catch { return { state: "unavailable" }; }
}

/** Azienda or Regione, read under the request's session (Storage RLS), labelled as the audience names them. */
export async function loadCAdditionsScoped(audience: PillarCScopedAudience, db: CScopedStorageClient, labels: (unit: CScopedUnit) => string | null): Promise<CAdditionsLoad> {
  const units = [...audience.units] as CScopedUnit[];
  if (!units.every((u) => cScopedKeyAllowed(audience, u) && (C_SCOPED_UNITS as readonly string[]).includes(u))) return { state: "forbidden" };
  if (audience.kind === "regione") return loadCAdditionsRegional(units, db, labels);
  // An Azienda: exactly its own unit, then the aggregate (O1). Anything else is not this audience.
  if (units.length !== 2 || units[0] !== audience.unit || units[1] !== C_SCOPED_AGGREGATE) return { state: "forbidden" };
  try {
    const out = await Promise.all(units.map(async (unit) => {
      const pin = C_ADDITIONS_STORAGE.scoped[unit];
      const read = await readCScopedObject(db, unit, pin.name, { sha256: pin.sha256, maxBytes: C_ADDITIONS_MAX_BYTES, bytes: pin.bytes, root: C_ADDITIONS_STORAGE.root });
      if (read.state !== "ready") throw new Error(read.state === "absent" ? "PCS-ABSENT" : "PCS-TRANSPORT");
      const label = labels(unit);
      if (!label) throw new Error("PCS-MISMATCH");
      return { key: unit, label, entry: parseCAdditionsUnit(decode(read.bytes), unit, units) };
    }));
    cAdditionsComplementCheck(out[0].entry, out[1].entry);
    return { state: "ready", view: { units: out } };
  } catch (error) {
    pcsLog(error instanceof Error && error.message === "PCS-ABSENT" ? "PCS-ABSENT" : "PCS-GUARD");
    return { state: "unavailable" };
  }
}

/** The Regione (regional analytical parity): the reviewer's full object, the same bytes, from the regional folder. */
async function loadCAdditionsRegional(units: CScopedUnit[], db: CScopedStorageClient, labels: (unit: CScopedUnit) => string | null): Promise<CAdditionsLoad> {
  // Exactly the Regione's units, in its order (the aggregate, then ASL 1-4).
  if (units.length !== C_ADD_ORDER.length || units.some((u, i) => u !== C_ADD_ORDER[i])) return { state: "forbidden" };
  const pin = C_ADDITIONS_STORAGE.regional;
  try {
    const read = await readCScopedRegionalObject(db, pin.name, { sha256: pin.sha256, maxBytes: C_ADDITIONS_MAX_BYTES, bytes: pin.bytes, root: C_ADDITIONS_STORAGE.root });
    if (read.state !== "ready") throw new Error(read.state === "absent" ? "PCS-ABSENT" : "PCS-TRANSPORT");
    const entries = parseCAdditionsFull(decode(read.bytes));
    const shown = C_ADD_ORDER.map((key) => {
      const label = labels(key), entry = entries.find((e) => e.unit === key);
      if (!label || !entry) throw new Error("PCS-MISMATCH");
      return { key, label, entry };
    });
    return { state: "ready", view: { units: shown } };
  } catch (error) {
    pcsLog(error instanceof Error && error.message === "PCS-ABSENT" ? "PCS-ABSENT" : "PCS-GUARD");
    return { state: "unavailable" };
  }
}
