import "server-only";
import { C_ATTR_CHANNELS, C_ATTR_PERIODS, parseCAttrPacket, type CAttrChannel, type CAttrOrg, type CAttrPeriod } from "@/lib/dashboard-review/pillar-c/attribution";
import { cPortfolioOtherPeriod, cPortfolioView, parseCPortfolioPacket, type CPortfolioPacket } from "@/lib/dashboard-review/pillar-c/portfolio";
import { cScopedKeyAllowed, type PillarCScopedAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { CScopedGuardError, guardCScopedPayload } from "@/lib/dashboard-review/pillar-c/payload-guard";
import { C_SCOPED_LIMITS, C_SCOPED_STORAGE } from "@/lib/dashboard-review/pillar-c/scoped-storage";
import { pcsLog, readCScopedObject, type CScopedStorageClient, type PCSCode } from "@/lib/dashboard-review/pillar-c/scoped-transport";
import { mergeCScopedReview, parseCScopedIndex, parseCScopedReviewFile, type CScopedAttrView, type CScopedClientReview, type CScopedIndex, type CScopedPortfolioView } from "@/lib/dashboard-review/pillar-c/scoped-review";
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

/**
 * Loaders of Pillar C organisation-scoped delivery. Every object is read with the session client the caller
 * passes in (the request's own), so Storage RLS decides each read. No cache of any kind: two identical
 * requests make two reads, and nothing one user was entitled to can be served to another.
 *
 *   - denied: the key is outside the audience. Decided before any read; the route answers 403.
 *   - invalid: a malformed argument. Decided before any read; the route answers 400.
 *   - unavailable: an ENTITLED unit whose object is missing or refused by Storage (PCS-ABSENT), a transport
 *     failure, an integrity, parse or consistency failure, or a guard refusal. Never shown as «not entitled».
 */
export type CScopedFailure = { state: "denied" } | { state: "invalid" } | { state: "unavailable"; code: PCSCode; unit: CScopedUnit | null };
export type CScopedReviewLoad = { state: "ready"; packet: CScopedClientReview } | CScopedFailure;
export type CScopedAttrLoad = { state: "ready"; view: CScopedAttrView } | CScopedFailure;
export type CScopedPortfolioLoad = { state: "ready"; view: CScopedPortfolioView } | CScopedFailure;

class CScopedLoadError extends Error {
  readonly code: PCSCode; readonly unit: CScopedUnit | null;
  constructor(code: PCSCode, unit: CScopedUnit | null) { super(code); this.code = code; this.unit = unit; }
}
const PORTFOLIO_ID = /^[A-Z0-9]{2,12}$/;

async function readJson(db: CScopedStorageClient, unit: CScopedUnit, name: string, sha256: string, maxBytes: number, bytes?: number): Promise<unknown> {
  const read = await readCScopedObject(db, unit, name, { sha256, maxBytes, bytes });
  if (read.state !== "ready") throw new CScopedLoadError(read.state === "absent" ? "PCS-ABSENT" : read.state === "invalid" ? "PCS-INTEGRITY" : "PCS-TRANSPORT", unit);
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(read.bytes)) as unknown; }
  catch { throw new CScopedLoadError("PCS-PARSE", unit); }
}
function parsed<T>(unit: CScopedUnit, parse: () => T): T {
  try { return parse(); }
  catch (error) { if (error instanceof CScopedLoadError) throw error; throw new CScopedLoadError(error instanceof CScopedGuardError ? "PCS-GUARD" : "PCS-PARSE", unit); }
}
async function readIndex(db: CScopedStorageClient, unit: CScopedUnit): Promise<CScopedIndex> {
  const pin = C_SCOPED_STORAGE.index[unit];
  const raw = await readJson(db, unit, `index-${pin}.json`, pin, C_SCOPED_LIMITS.index);
  return parsed(unit, () => parseCScopedIndex(raw, { unit, root: C_SCOPED_STORAGE.root, build: C_SCOPED_STORAGE.build, source: C_SCOPED_STORAGE.source }));
}
async function failClosed<T>(load: () => Promise<T>): Promise<T | CScopedFailure> {
  try { return await load(); }
  catch (error) {
    const code: PCSCode = error instanceof CScopedLoadError ? error.code : error instanceof CScopedGuardError ? "PCS-GUARD" : "PCS-PARSE";
    const unit = error instanceof CScopedLoadError ? error.unit : null;
    pcsLog(code, unit ?? undefined);
    return { state: "unavailable", code, unit };
  }
}
/** Each shard must be the scope its index entry names: the same period, unit and channel. */
function sameScope(raw: unknown, period: CAttrPeriod, unit: CScopedUnit, channel: CAttrChannel) {
  const s = raw as Record<string, unknown> | null;
  if (!s || typeof s !== "object" || s.period !== period || s.org !== unit || s.channel !== channel) throw new CScopedLoadError("PCS-MISMATCH", unit);
}

/** The review rows of every unit of the audience, merged into the explicit-rows client packet. */
export async function loadCScopedReview(audience: PillarCScopedAudience, db: CScopedStorageClient): Promise<CScopedReviewLoad> {
  const units = [...audience.units] as CScopedUnit[];
  if (!units.every((u) => cScopedKeyAllowed(audience, u))) return { state: "denied" };
  return failClosed(async () => {
    const indexes = await Promise.all(units.map((unit) => readIndex(db, unit)));
    const files = await Promise.all(indexes.map(async (index) => {
      const raw = await readJson(db, index.unit, index.review.name, index.review.sha256, C_SCOPED_LIMITS.review, index.review.bytes);
      return parsed(index.unit, () => parseCScopedReviewFile(raw, index.unit));
    }));
    const packet = parsed(units.length === 5 ? "aggregato" : units[0], () => mergeCScopedReview(units, files));
    return { state: "ready" as const, packet: parsed(units[0], () => guardCScopedPayload<CScopedClientReview>("review", packet, units)) };
  });
}

/** Attribution uncertainty of one unit and scope, with its matched period, as the reviewer view is built. */
export async function loadCScopedAttrView(audience: PillarCScopedAudience, db: CScopedStorageClient, period: CAttrPeriod, key: string, channel: CAttrChannel): Promise<CScopedAttrLoad> {
  if (!C_ATTR_PERIODS.includes(period) || !C_ATTR_CHANNELS.includes(channel)) return { state: "invalid" };
  // The key is checked against the audience BEFORE any read: a peer, a province key or an unknown value never reaches Storage.
  if (!cScopedKeyAllowed(audience, key)) return { state: "denied" };
  const unit = key;
  return failClosed(async () => {
    const index = await readIndex(db, unit);
    const periods = [period, cPortfolioOtherPeriod(period)] as const;
    const shards = await Promise.all(periods.map(async (p) => {
      const ref = index.attribution.scopes[`${p}|${unit}|${channel}`];
      if (!ref) throw new CScopedLoadError("PCS-PARSE", unit);
      const raw = await readJson(db, unit, ref.name, ref.sha256, C_SCOPED_LIMITS.attribution, ref.bytes);
      sameScope(raw, p, unit, channel);
      return raw;
    }));
    const meta = index.attribution;
    const packet = parsed(unit, () => parseCAttrPacket({ sourceSha256: meta.sourceSha256, classificationSha256: meta.classificationSha256, mappingVersion: meta.mappingVersion, precision: meta.precision, portfolios: meta.portfolios, schema: "pillar-c-attribution-v1", scopes: shards }, [unit]));
    const scope = packet.scopes.find((s) => s.period === periods[0] && s.org === unit && s.channel === channel);
    const comparison = packet.scopes.find((s) => s.period === periods[1] && s.org === unit && s.channel === channel);
    if (!scope || !comparison) throw new CScopedLoadError("PCS-MISMATCH", unit);
    const view = { schema: "pillar-c-attribution-view-v1", sourceSha256: packet.sourceSha256, classificationSha256: packet.classificationSha256, mappingVersion: packet.mappingVersion, sourceSnapshot: C_SCOPED_STORAGE.index[unit], portfolios: packet.portfolios, scope, comparison };
    return { state: "ready" as const, view: parsed(unit, () => guardCScopedPayload<CScopedAttrView>("attribution", view, audience.units)) };
  });
}

/** Portfolio dossier of one unit and scope, with its matched period, as the reviewer view is built. */
export async function loadCScopedPortfolioView(audience: PillarCScopedAudience, db: CScopedStorageClient, period: CAttrPeriod, key: string, channel: CAttrChannel, portfolio: string): Promise<CScopedPortfolioLoad> {
  if (!C_ATTR_PERIODS.includes(period) || !C_ATTR_CHANNELS.includes(channel) || typeof portfolio !== "string" || !PORTFOLIO_ID.test(portfolio)) return { state: "invalid" };
  if (!cScopedKeyAllowed(audience, key)) return { state: "denied" };
  const unit = key;
  return failClosed(async () => {
    const index = await readIndex(db, unit);
    if (!index.portfolio.portfolios.some((p) => p.id === portfolio)) throw new CScopedLoadError("PCS-MISMATCH", unit);
    const periods = [period, cPortfolioOtherPeriod(period)] as const;
    const shards = await Promise.all(periods.map(async (p) => {
      const ref = index.portfolio.scopes[`${p}|${unit}|${channel}`];
      if (!ref) throw new CScopedLoadError("PCS-PARSE", unit);
      const raw = await readJson(db, unit, ref.name, ref.sha256, C_SCOPED_LIMITS.portfolio, ref.bytes);
      sameScope(raw, p, unit, channel);
      return raw;
    }));
    const meta = index.portfolio;
    const packet = parsed(unit, () => parseCPortfolioPacket({ schema: "pillar-c-portfolio-v1", precision: meta.precision, sourceSha256: meta.sourceSha256, classificationSha256: meta.classificationSha256, mappingVersion: meta.mappingVersion, portfolios: meta.portfolios, scopes: shards }, [unit]));
    // The reviewer view builder, unchanged; it only matches scopes by the key it is given (here the unit key).
    const view = parsed(unit, () => cPortfolioView(packet as unknown as CPortfolioPacket, period, unit as unknown as CAttrOrg, channel, portfolio, C_SCOPED_STORAGE.index[unit]));
    if ((view.scope.org as string) !== unit || (view.comparison && (view.comparison.scope.org as string) !== unit)) throw new CScopedLoadError("PCS-MISMATCH", unit);
    return { state: "ready" as const, view: parsed(unit, () => guardCScopedPayload<CScopedPortfolioView>("portfolio", view, audience.units)) };
  });
}
