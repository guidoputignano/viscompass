import "server-only";
import { createHash } from "node:crypto";
import { parseCForecast, type CForecast } from "@/lib/dashboard-review/pillar-c/review";
import { C_REVIEW_STORAGE, readCReviewStoragePacket, type CStoredReview } from "@/lib/dashboard-review/pillar-c/review-storage";

/** Owner-authorized 16 October release: independently public regional source
 * only, for approved signed-in members. This is NOT an institutional data gate.
 * Transport reuses the immutable hash-pinned server artifact. Projection occurs
 * on the server before serialization: private rows/lineage never leave here. */
export type CRegionalForecast = { forecast: CForecast };
export type CRegionalForecastLoad = { state: "ready"; data: CRegionalForecast } | { state: "forbidden" | "invalid" | "not_configured" };

/** Explicit projection, not object spread and not the private review parser. */
export function projectCRegionalForecast(input: unknown): CRegionalForecast {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("PILLAR_C_FORECAST_OBJECT");
  const source = input as Record<string, unknown>;
  if (source.schema !== "pillar-c-review-v2" || source.state !== "review_only") throw new Error("PILLAR_C_FORECAST_SOURCE");
  return { forecast: parseCForecast(source.forecast) };
}

/** Raw-byte validation remains mandatory and the caller cannot supply a pin. */
export async function loadCRegionalForecast(approved: boolean, remote: () => Promise<CStoredReview> = readCReviewStoragePacket): Promise<CRegionalForecastLoad> {
  if (!approved) return { state: "forbidden" };
  try {
    const stored = await remote();
    if (stored.state !== "ready") return { state: stored.state };
    if (stored.sha !== C_REVIEW_STORAGE.sha256 || stored.bytes.byteLength < 2 || stored.bytes.byteLength > 5_000_000 || createHash("sha256").update(stored.bytes).digest("hex") !== C_REVIEW_STORAGE.sha256) return { state: "invalid" };
    return { state: "ready", data: projectCRegionalForecast(JSON.parse(Buffer.from(stored.bytes).toString("utf8"))) };
  } catch { return { state: "invalid" }; }
}
