import "server-only";
import { createHash } from "node:crypto";
import { C_EXTENSION_MAX_BYTES, C_EXTENSION_STORAGE } from "@/lib/dashboard-review/pillar-c/extension-storage";
import { C_EXT_UNIT_LABELS, type CExtensionView } from "@/lib/dashboard-review/pillar-c/extension";
import { cExtComplementCheck, parseCExtensionReviewer, parseCExtensionUnit } from "@/lib/dashboard-review/pillar-c/extension-parse";
import { cScopedKeyAllowed, type PillarCScopedAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { pcsLog, readCScopedObject, type CScopedStorageClient } from "@/lib/dashboard-review/pillar-c/scoped-transport";
import { C_SCOPED_UNITS, type CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

/**
 * Loaders of the Pillar C extension (January 2026 DPC, File F 2025). Fail closed: any missing object, refused read,
 * size or hash mismatch, parse or guard failure gives «unavailable», and the section then says so without a value.
 * No cache: every request reads again, and nothing one user was entitled to is served to another.
 */
export type CExtensionLoad = { state: "ready"; view: CExtensionView } | { state: "unavailable" | "not_configured" | "forbidden" };

export type CExtensionRemote = () => Promise<{ state: "ready"; bytes: Uint8Array } | { state: "not_configured" | "invalid" }>;

/** Service-role read of the reviewer object, called only after the reviewer gate. */
async function readReviewerObject(): Promise<{ state: "ready"; bytes: Uint8Array } | { state: "not_configured" | "invalid" }> {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key) return { state: "not_configured" };
  const pin = C_EXTENSION_STORAGE.reviewer;
  try {
    const response = await fetch(`${origin}/storage/v1/object/authenticated/${pin.bucket}/${pin.object}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok || !response.body || Number(response.headers.get("content-length") ?? 0) > C_EXTENSION_MAX_BYTES) return { state: "invalid" };
    // Counted while streaming: a response without Content-Length is still cut at the cap.
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > C_EXTENSION_MAX_BYTES) { await reader.cancel(); return { state: "invalid" }; } chunks.push(value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { state: "ready", bytes };
  } catch { return { state: "invalid" }; }
}

const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;

/** Reviewer: the aggregate and ASL 1-4, plus the per-resident drivers and basket indices, January and File F (owner decision O1: reviewer-only). */
export async function loadCExtensionReviewer(approved: boolean, projectReviewer: boolean, remote: CExtensionRemote = readReviewerObject): Promise<CExtensionLoad> {
  if (!approved || !projectReviewer) return { state: "forbidden" };
  const read = await remote();
  if (read.state === "not_configured") return { state: "not_configured" };
  if (read.state !== "ready") return { state: "unavailable" };
  const pin = C_EXTENSION_STORAGE.reviewer;
  if (read.bytes.byteLength !== pin.bytes || createHash("sha256").update(read.bytes).digest("hex") !== pin.sha256) return { state: "unavailable" };
  try {
    const p = parseCExtensionReviewer(decode(read.bytes));
    const order: CScopedUnit[] = ["aggregato", "asl-1", "asl-2", "asl-3", "asl-4"];
    const units = order.map((key) => ({ key, label: C_EXT_UNIT_LABELS[key], data: p.units.find((u) => u.unit === key)! }));
    return { state: "ready", view: { units, drivers: p.drivers, baskets: p.baskets, fileFBasket: p.fileFBasket, findings: p.findings } };
  } catch { return { state: "unavailable" }; }
}

/** Azienda or Regione: the audience's own units, each read under the request's session (Storage RLS), labelled as the
 * audience names them. No reviewer-only block. */
export async function loadCExtensionScoped(audience: PillarCScopedAudience, db: CScopedStorageClient, labels: (unit: CScopedUnit) => string | null): Promise<CExtensionLoad> {
  const units = [...audience.units] as CScopedUnit[];
  if (!units.every((u) => cScopedKeyAllowed(audience, u) && (C_SCOPED_UNITS as readonly string[]).includes(u))) return { state: "forbidden" };
  try {
    const out = await Promise.all(units.map(async (unit) => {
      const pin = C_EXTENSION_STORAGE.scoped[unit];
      const read = await readCScopedObject(db, unit, pin.name, { sha256: pin.sha256, maxBytes: C_EXTENSION_MAX_BYTES, bytes: pin.bytes, root: C_EXTENSION_STORAGE.root });
      if (read.state !== "ready") throw new Error(read.state === "absent" ? "PCS-ABSENT" : "PCS-TRANSPORT");
      const label = labels(unit);
      if (!label) throw new Error("PCS-MISMATCH");
      return { key: unit, label, data: parseCExtensionUnit(decode(read.bytes), unit, units) };
    }));
    cExtComplementCheck(out.map((u) => u.data));
    // Owner decision D2 covers an Azienda's own per-pack costs: a list reaches the browser only for the Azienda's own
    // unit, so the Regione (and any audience kind added later) receives none. Allow-list, fail closed (review L5).
    // (Storage RLS still admits the Regione to each ASL object; that is a policy question.)
    const shown = out.map((u) => (audience.kind === "azienda" && u.key === audience.unit ? u : { ...u, data: { ...u.data, unitCosts: null } }));
    return { state: "ready", view: { units: shown, drivers: null, baskets: null, fileFBasket: null, findings: null } };
  } catch (error) {
    pcsLog(error instanceof Error && error.message === "PCS-ABSENT" ? "PCS-ABSENT" : "PCS-GUARD");
    return { state: "unavailable" };
  }
}
