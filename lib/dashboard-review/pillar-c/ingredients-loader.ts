import "server-only";
import { createHash } from "node:crypto";
import { C_INGREDIENTS_MAX_BYTES, C_INGREDIENTS_STORAGE } from "@/lib/dashboard-review/pillar-c/ingredients-storage";
import { C_NSIS_CODE, C_PLACE_NAME } from "@/lib/dashboard-review/pillar-c/payload-guard";
import { cScopedKeyAllowed, type PillarCScopedAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { pcsLog, readCScopedObject, type CScopedStorageClient } from "@/lib/dashboard-review/pillar-c/scoped-transport";
import { C_SCOPED_AGGREGATE } from "@/lib/dashboard-review/pillar-c/scoped-units";
import type { CIngredients } from "@/lib/dashboard-review/pillar-c/ingredients";
import type { CPortfolioView } from "@/lib/dashboard-review/pillar-c/portfolio";

/**
 * The active ingredients by exact AIC (joint feedback 2, G2-23; build ing-v1), read like the other pinned objects and
 * joined on the server into the portfolio view it serves (app/api/pillar-c/portfolio, scoped-route.ts). Fail closed: a
 * missing object, refused read, size or hash mismatch or parse failure gives «unavailable», and the dossier then says
 * the ingredient is not available, never a guessed name. No cache.
 *   - reviewer: the object in the private review bucket, by the service role, only after the reviewer gate;
 *   - Azienda and Regione: the same bytes from the aggregate folder, under their own session (both hold the aggregate).
 * The view receives only the labels of its own products (cIngredientsFor), never the whole list.
 */
export type CIngredientsLoad = { state: "ready"; labels: ReadonlyMap<string, string> } | { state: "unavailable" | "not_configured" | "forbidden" };
export type CIngredientsRemote = () => Promise<{ state: "ready"; bytes: Uint8Array } | { state: "not_configured" | "invalid" }>;

export class CIngredientsError extends Error {
  constructor(reason: string) { super(`PILLAR_C_INGREDIENTS_${reason}`); }
}
const fail = (reason: string): never => { throw new CIngredientsError(reason); };

/** The closed schema: four keys; entries by nine-digit AIC, each a printable label of at most 2,000 characters, screened
 * for place names and NSIS Azienda codes. */
export function parseCIngredients(raw: unknown): Map<string, string> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("SHAPE");
  const o = raw as Record<string, unknown>, keys = Object.keys(o);
  if (keys.length !== 4 || !["schema", "build", "source", "entries"].every((k) => Object.hasOwn(o, k))) fail("KEYS");
  if (o.schema !== "pillar-c-ingredients-v1" || o.build !== "ing-v1" || typeof o.source !== "string") fail("HEADER");
  if (typeof o.entries !== "object" || o.entries === null || Array.isArray(o.entries)) return fail("ENTRIES");
  const labels = new Map<string, string>();
  for (const [aic, label] of Object.entries(o.entries as Record<string, unknown>)) {
    if (!/^[0-9]{9}$/.test(aic)) fail("AIC");
    if (typeof label !== "string" || !label.trim() || label.length > 2000 || /[\u0000-\u001f\u007f<>]/.test(label)) fail("LABEL");
    if (C_PLACE_NAME.test(label as string) || C_NSIS_CODE.test(label as string)) fail("SCREEN");
    labels.set(aic, label as string);
  }
  if (!labels.size) fail("EMPTY");
  return labels;
}

/** Only the labels of the products the view shows: its product changes, its single-candidate and shared products. */
export function cIngredientsFor(view: Pick<CPortfolioView, "productChanges" | "dossier">, labels: ReadonlyMap<string, string>): CIngredients {
  const keys = new Set([...view.productChanges.map((r) => r.key), ...view.dossier.products.map((r) => r.key), ...view.dossier.sharedProducts.map((r) => r.key)]);
  return Object.fromEntries([...keys].sort().flatMap((key) => { const label = labels.get(key); return label === undefined ? [] : [[key, label]]; }));
}

/** The view as served: with the labels of its own products, or null when they could not be read. */
export function cPortfolioWithIngredients<V extends Pick<CPortfolioView, "productChanges" | "dossier">>(view: V, load: CIngredientsLoad): V & { ingredients: CIngredients | null } {
  return { ...view, ingredients: load.state === "ready" ? cIngredientsFor(view, load.labels) : null };
}

/** Service-role read of the reviewer object, called only after the reviewer gate. */
async function readReviewerObject(): Promise<{ state: "ready"; bytes: Uint8Array } | { state: "not_configured" | "invalid" }> {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key) return { state: "not_configured" };
  const pin = C_INGREDIENTS_STORAGE.reviewer;
  try {
    const response = await fetch(`${origin}/storage/v1/object/authenticated/${pin.bucket}/${pin.object}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok || !response.body || Number(response.headers.get("content-length") ?? 0) > C_INGREDIENTS_MAX_BYTES) return { state: "invalid" };
    // Counted while streaming: a response without Content-Length is still cut at the cap.
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > C_INGREDIENTS_MAX_BYTES) { await reader.cancel(); return { state: "invalid" }; } chunks.push(value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { state: "ready", bytes };
  } catch { return { state: "invalid" }; }
}

const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;

export async function loadCIngredientsReviewer(approved: boolean, projectReviewer: boolean, remote: CIngredientsRemote = readReviewerObject): Promise<CIngredientsLoad> {
  if (!approved || !projectReviewer) return { state: "forbidden" };
  const read = await remote();
  if (read.state === "not_configured") return { state: "not_configured" };
  if (read.state !== "ready") return { state: "unavailable" };
  const pin = C_INGREDIENTS_STORAGE.reviewer;
  if (read.bytes.byteLength !== pin.bytes || createHash("sha256").update(read.bytes).digest("hex") !== pin.sha256) return { state: "unavailable" };
  try { return { state: "ready", labels: parseCIngredients(decode(read.bytes)) }; } catch { return { state: "unavailable" }; }
}

/** Azienda or Regione: the aggregate folder's object, under the request's session. */
export async function loadCIngredientsScoped(audience: PillarCScopedAudience, db: CScopedStorageClient): Promise<CIngredientsLoad> {
  if (!cScopedKeyAllowed(audience, C_SCOPED_AGGREGATE)) return { state: "forbidden" };
  const pin = C_INGREDIENTS_STORAGE.scoped;
  try {
    const read = await readCScopedObject(db, C_SCOPED_AGGREGATE, pin.name, { sha256: pin.sha256, maxBytes: C_INGREDIENTS_MAX_BYTES, bytes: pin.bytes, root: C_INGREDIENTS_STORAGE.root });
    if (read.state !== "ready") throw new Error(read.state === "absent" ? "PCS-ABSENT" : "PCS-TRANSPORT");
    return { state: "ready", labels: parseCIngredients(decode(read.bytes)) };
  } catch (error) {
    pcsLog(error instanceof Error && error.message === "PCS-ABSENT" ? "PCS-ABSENT" : "PCS-GUARD");
    return { state: "unavailable" };
  }
}
