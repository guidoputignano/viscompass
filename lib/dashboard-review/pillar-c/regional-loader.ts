import "server-only";
import { C_REGIONAL_MAX_BYTES, C_REGIONAL_STORAGE } from "@/lib/dashboard-review/pillar-c/regional-storage";
import { parseCRegionalPvm } from "@/lib/dashboard-review/pillar-c/portfolio-pvm";
import { C_NSIS_CODE, C_PLACE_NAME, C_PROVINCE_TOKEN } from "@/lib/dashboard-review/pillar-c/payload-guard";
import { pcsLog, readCScopedRegionalObject, type CScopedStorageClient } from "@/lib/dashboard-review/pillar-c/scoped-transport";
import type { PillarCScopedAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { C_WORKBOOK_HASH, type CWorkbookSection } from "@/lib/dashboard-review/pillar-c/workbook";
import { parseCRegionalReview, type CScopedRegionalReview } from "@/lib/dashboard-review/pillar-c/scoped-review";

/** The Regione's price/quantity/mix source (regional analytical parity, owner clarification of 23 Oct 2026): one
 * region-wide object, read under the request's own session from the regional folder, pinned by size and hash, checked
 * by the section parser the reviewer uses and screened for place names, province keys and NSIS codes. Fails closed:
 * any refusal or defect is «unavailable», and the panel then says so without a value. An Azienda never reads it. */
export type CRegionalPvmLoad = { state: "ready"; section: CWorkbookSection } | { state: "unavailable" | "forbidden" };

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out));
  return out;
}

export async function loadCRegionalPvm(audience: PillarCScopedAudience, db: CScopedStorageClient): Promise<CRegionalPvmLoad> {
  if (audience.kind !== "regione") return { state: "forbidden" };
  const pin = C_REGIONAL_STORAGE.pvm;
  try {
    const read = await readCScopedRegionalObject(db, pin.name, { sha256: pin.sha256, maxBytes: C_REGIONAL_MAX_BYTES, bytes: pin.bytes, root: C_REGIONAL_STORAGE.root });
    if (read.state !== "ready") throw new Error(read.state === "absent" ? "PCS-ABSENT" : "PCS-TRANSPORT");
    const section = parseCRegionalPvm(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(read.bytes)), C_REGIONAL_STORAGE.costiSha256);
    if (strings(section).some((s) => C_PLACE_NAME.test(s) || C_NSIS_CODE.test(s) || C_PROVINCE_TOKEN.test(s))) throw new Error("PCS-GUARD");
    return { state: "ready", section };
  } catch (error) {
    pcsLog(error instanceof Error && error.message === "PCS-ABSENT" ? "PCS-ABSENT" : "PCS-GUARD");
    return { state: "unavailable" };
  }
}

/** The Regione's modelled budgets and provenance (owner decision of 24 Oct 2026), read like the price/quantity/mix
 * object: its own session, the regional folder, the pinned size and hash, the closed parser, the same screen. */
export type CRegionalReviewLoad = { state: "ready"; review: CScopedRegionalReview } | { state: "unavailable" | "forbidden" };
export async function loadCRegionalReview(audience: PillarCScopedAudience, db: CScopedStorageClient): Promise<CRegionalReviewLoad> {
  if (audience.kind !== "regione") return { state: "forbidden" };
  const pin = C_REGIONAL_STORAGE.review;
  try {
    const read = await readCScopedRegionalObject(db, pin.name, { sha256: pin.sha256, maxBytes: C_REGIONAL_MAX_BYTES, bytes: pin.bytes, root: C_REGIONAL_STORAGE.root });
    if (read.state !== "ready") throw new Error(read.state === "absent" ? "PCS-ABSENT" : "PCS-TRANSPORT");
    const review = parseCRegionalReview(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(read.bytes)), C_WORKBOOK_HASH);
    if (strings(review).some((s) => C_PLACE_NAME.test(s) || C_NSIS_CODE.test(s) || C_PROVINCE_TOKEN.test(s))) throw new Error("PCS-GUARD");
    return { state: "ready", review };
  } catch (error) {
    pcsLog(error instanceof Error && error.message === "PCS-ABSENT" ? "PCS-ABSENT" : "PCS-GUARD");
    return { state: "unavailable" };
  }
}
