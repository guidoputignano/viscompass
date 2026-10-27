import "server-only";
import { createHash } from "node:crypto";
import { C_UNDER10_MAX_BYTES, C_UNDER10_STORAGE } from "@/lib/dashboard-review/pillar-c/under10-storage";
import { C_U10_UNITS, type CU10Unit } from "@/lib/dashboard-review/pillar-c/under10";
import { C_EXT_UNIT_LABELS } from "@/lib/dashboard-review/pillar-c/extension";
import { parseCUnder10, type CUnder10Load } from "@/lib/dashboard-review/pillar-c/under10-parse";
import { cScopedKeyAllowed, type PillarCScopedAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { pcsLog, readCScopedObject, readCScopedRegionalObject, type CScopedStorageClient } from "@/lib/dashboard-review/pillar-c/scoped-transport";
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

/**
 * Loaders of the under-€10 DPC medicine list (build u10-v1), read like the additions (additions-loader.ts). Fail closed:
 * a missing object, refused read, size or hash mismatch or parse failure gives «unavailable», and the panel then says so
 * without a value. No cache.
 *   - reviewer: the four-ASL object from the private review bucket, by the service role, only after the reviewer gate;
 *   - Regione: the same bytes from the regional folder, under its own session;
 *   - Azienda: its own ASL's object, under its own session; never another unit, and no aggregate list.
 */
export type { CUnder10Load };
export type CUnder10Remote = () => Promise<{ state: "ready"; bytes: Uint8Array } | { state: "not_configured" | "invalid" }>;

/** Service-role read of the reviewer object, called only after the reviewer gate. */
async function readReviewerObject(): Promise<{ state: "ready"; bytes: Uint8Array } | { state: "not_configured" | "invalid" }> {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key) return { state: "not_configured" };
  const pin = C_UNDER10_STORAGE.reviewer;
  try {
    const response = await fetch(`${origin}/storage/v1/object/authenticated/${pin.bucket}/${pin.object}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok || !response.body || Number(response.headers.get("content-length") ?? 0) > C_UNDER10_MAX_BYTES) return { state: "invalid" };
    // Counted while streaming: a response without Content-Length is still cut at the cap.
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > C_UNDER10_MAX_BYTES) { await reader.cancel(); return { state: "invalid" }; } chunks.push(value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { state: "ready", bytes };
  } catch { return { state: "invalid" }; }
}

const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;

/** Reviewer: ASL 1-4 under the reviewed labels. */
export async function loadCUnder10Reviewer(approved: boolean, projectReviewer: boolean, remote: CUnder10Remote = readReviewerObject): Promise<CUnder10Load> {
  if (!approved || !projectReviewer) return { state: "forbidden" };
  const read = await remote();
  if (read.state === "not_configured") return { state: "not_configured" };
  if (read.state !== "ready") return { state: "unavailable" };
  const pin = C_UNDER10_STORAGE.reviewer;
  if (read.bytes.byteLength !== pin.bytes || createHash("sha256").update(read.bytes).digest("hex") !== pin.sha256) return { state: "unavailable" };
  try {
    const entries = parseCUnder10(decode(read.bytes), C_U10_UNITS);
    return { state: "ready", view: { units: entries.map((entry) => ({ key: entry.unit, label: C_EXT_UNIT_LABELS[entry.unit], entry })) } };
  } catch { return { state: "unavailable" }; }
}

/** Azienda or Regione, read under the request's session (Storage RLS), labelled as the audience names them. */
export async function loadCUnder10Scoped(audience: PillarCScopedAudience, db: CScopedStorageClient, labels: (unit: CScopedUnit) => string | null): Promise<CUnder10Load> {
  const units = [...audience.units] as CScopedUnit[];
  if (!units.every((u) => cScopedKeyAllowed(audience, u))) return { state: "forbidden" };
  try {
    if (audience.kind === "regione") {
      // Exactly the Regione's four ASLs, in order, from the regional folder.
      const asl = units.filter((u): u is CU10Unit => (C_U10_UNITS as readonly string[]).includes(u));
      if (asl.length !== C_U10_UNITS.length || asl.some((u, i) => u !== C_U10_UNITS[i])) return { state: "forbidden" };
      const pin = C_UNDER10_STORAGE.regional;
      const read = await readCScopedRegionalObject(db, pin.name, { sha256: pin.sha256, maxBytes: C_UNDER10_MAX_BYTES, bytes: pin.bytes, root: C_UNDER10_STORAGE.root });
      if (read.state !== "ready") throw new Error(read.state === "absent" ? "PCS-ABSENT" : "PCS-TRANSPORT");
      return { state: "ready", view: { units: parseCUnder10(decode(read.bytes), C_U10_UNITS).map((entry) => ({ key: entry.unit, label: labels(entry.unit) ?? fail(), entry })) } };
    }
    // An Azienda: its own ASL only.
    const own = audience.unit;
    if (!own || !(C_U10_UNITS as readonly string[]).includes(own) || !units.includes(own)) return { state: "forbidden" };
    const unit = own as CU10Unit, pin = C_UNDER10_STORAGE.scoped[unit];
    const read = await readCScopedObject(db, unit, pin.name, { sha256: pin.sha256, maxBytes: C_UNDER10_MAX_BYTES, bytes: pin.bytes, root: C_UNDER10_STORAGE.root });
    if (read.state !== "ready") throw new Error(read.state === "absent" ? "PCS-ABSENT" : "PCS-TRANSPORT");
    const [entry] = parseCUnder10(decode(read.bytes), [unit]);
    return { state: "ready", view: { units: [{ key: unit, label: labels(unit) ?? fail(), entry }] } };
  } catch (error) {
    pcsLog(error instanceof Error && error.message === "PCS-ABSENT" ? "PCS-ABSENT" : "PCS-GUARD");
    return { state: "unavailable" };
  }
}
const fail = (): never => { throw new Error("PCS-MISMATCH"); };
