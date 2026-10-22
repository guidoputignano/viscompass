import "server-only";
import { createHash } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";
import { C_SCOPED_STORAGE } from "@/lib/dashboard-review/pillar-c/scoped-storage";
import { isCScopedUnit, type CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

/**
 * Session-only Storage transport for Pillar C organisation-scoped delivery.
 *
 * The caller passes the REQUEST'S OWN session client (lib/supabase/server createClient()). This module
 * never creates a client, never reads a service-role key and keeps nothing between calls: every read is
 * a fresh Storage request under the user's JWT, so the storage.objects policy decides each one. The
 * bytes are accepted only when their size and SHA-256 equal the pinned reference.
 */
export type CScopedStorageClient = Pick<Awaited<ReturnType<typeof createClient>>, "storage">;
/** absent: Storage answered 4xx (missing object or row-level security refusal, which Storage reports the same way).
 * unavailable: 5xx, timeout or network. invalid: size, cap or hash mismatch. */
export type CScopedRead = { state: "ready"; bytes: Uint8Array } | { state: "absent" | "unavailable" | "invalid" };

/** Stable log codes. Only the code and the unit are ever logged: never data, identifiers, paths or user ids. */
export type PCSCode = "PCS-UNITS" | "PCS-ABSENT" | "PCS-TRANSPORT" | "PCS-INTEGRITY" | "PCS-PARSE" | "PCS-MISMATCH" | "PCS-GUARD";
export function pcsLog(code: PCSCode, unit?: CScopedUnit): void {
  console.warn(`[pillar-c-scoped] ${code}${unit && isCScopedUnit(unit) ? ` unit=${unit}` : ""}`);
}

/** The storage.objects policy's name pattern (migration 20261020120000), verbatim. */
export const C_SCOPED_POLICY_NAME = /^v[1-9][0-9]{0,2}\/(asl-[1-4]|aggregato)\/[A-Za-z0-9]+(-[A-Za-z0-9]+)*-[0-9a-f]{64}[.]json$/;
const FILE_NAME = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*-([0-9a-f]{64})\.json$/;

/** Builds an object path from a pinned root (the rec5 root by default), a validated unit and a pinned file name, or null. */
export function cScopedObjectPath(unit: CScopedUnit, name: string, sha256: string, root: string = C_SCOPED_STORAGE.root): string | null {
  if (!isCScopedUnit(unit) || typeof name !== "string" || typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256) || typeof root !== "string" || !/^v[1-9][0-9]{0,2}$/.test(root)) return null;
  const match = FILE_NAME.exec(name);
  if (!match || match[1] !== sha256) return null;
  const path = `${root}/${unit}/${name}`;
  return C_SCOPED_POLICY_NAME.test(path) ? path : null;
}

export async function readCScopedObject(db: CScopedStorageClient, unit: CScopedUnit, name: string,
  expected: { sha256: string; maxBytes: number; bytes?: number; root?: string }, timeoutMs = 12_000): Promise<CScopedRead> {
  const path = cScopedObjectPath(unit, name, expected.sha256, expected.root);
  if (!path || !Number.isSafeInteger(expected.maxBytes) || expected.maxBytes < 2) return { state: "invalid" };
  if (expected.bytes !== undefined && (!Number.isSafeInteger(expected.bytes) || expected.bytes < 2 || expected.bytes > expected.maxBytes)) return { state: "invalid" };
  let blob: Blob;
  try {
    const { data, error } = await db.storage.from(C_SCOPED_STORAGE.bucket).download(path, {}, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (error || !data) {
      const status = typeof (error as { status?: unknown } | null)?.status === "number" ? (error as { status: number }).status : 0;
      return { state: status >= 400 && status < 500 ? "absent" : "unavailable" };
    }
    blob = data;
  } catch { return { state: "unavailable" }; }
  try {
    if (blob.size < 2 || blob.size > expected.maxBytes || (expected.bytes !== undefined && blob.size !== expected.bytes)) return { state: "invalid" };
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.byteLength !== blob.size || createHash("sha256").update(bytes).digest("hex") !== expected.sha256) return { state: "invalid" };
    return { state: "ready", bytes };
  } catch { return { state: "unavailable" }; }
}
