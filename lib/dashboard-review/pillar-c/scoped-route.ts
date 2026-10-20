import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { C_ATTR_CHANNELS, C_ATTR_PERIODS, type CAttrChannel, type CAttrPeriod } from "@/lib/dashboard-review/pillar-c/attribution";
import { cScopedKeyAllowed, type PillarCScopedAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { loadCScopedAttrView, loadCScopedPortfolioView, type CScopedAttrLoad, type CScopedPortfolioLoad } from "@/lib/dashboard-review/pillar-c/scoped-loader";
import type { CScopedAttrView, CScopedPortfolioView } from "@/lib/dashboard-review/pillar-c/scoped-review";
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";
import { pcsLog } from "@/lib/dashboard-review/pillar-c/scoped-transport";

/** The same three headers as every Pillar C API response. Membership reads cookies: nothing is shareable. */
export const C_SCOPED_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff" } as const;

type Kind = "attribution" | "portfolio";
export type CScopedParams = { ok: true; period: CAttrPeriod; org: CScopedUnit; channel: CAttrChannel; portfolio: string | null } | { ok: false; status: 400 | 403; error: "invalid_scope" | "forbidden_scope" };

/**
 * Query parameters of a scoped audience. Stricter than the reviewer's (which keeps its first-value semantics):
 *   - period, org, channel (and portfolio) must each appear exactly once, or 400 invalid_scope;
 *   - period and channel come from the closed lists, portfolio matches ^[A-Z0-9]{2,12}$, or 400 invalid_scope;
 *   - org must be one of the audience's own keys, by exact string match (no trimming, case folding or list
 *     splitting), or 403 forbidden_scope. A peer's key, a province key, the reviewer key «Regione» or an empty
 *     value never reaches a loader.
 */
export function cScopedParams(params: URLSearchParams, audience: PillarCScopedAudience, kind: Kind): CScopedParams {
  const names = kind === "portfolio" ? ["period", "org", "channel", "portfolio"] : ["period", "org", "channel"];
  if (names.some((name) => params.getAll(name).length !== 1)) return { ok: false, status: 400, error: "invalid_scope" };
  const period = params.get("period"), org = params.get("org"), channel = params.get("channel"), portfolio = kind === "portfolio" ? params.get("portfolio") : null;
  if (!C_ATTR_PERIODS.includes(period as CAttrPeriod) || !C_ATTR_CHANNELS.includes(channel as CAttrChannel) || (kind === "portfolio" && !/^[A-Z0-9]{2,12}$/.test(portfolio ?? ""))) return { ok: false, status: 400, error: "invalid_scope" };
  if (!cScopedKeyAllowed(audience, org)) return { ok: false, status: 403, error: "forbidden_scope" };
  return { ok: true, period: period as CAttrPeriod, org, channel: channel as CAttrChannel, portfolio };
}

function reply(body: unknown, status: number, started?: number) {
  const headers: Record<string, string> = { ...C_SCOPED_HEADERS };
  // Durations only: no unit, key, size or identifier.
  if (started !== undefined) headers["Server-Timing"] = `pcs;dur=${Math.max(0, performance.now() - started).toFixed(1)}`;
  return NextResponse.json(body, { status, headers });
}

/** GET handler body for an enabled Azienda or Regione audience. The caller derived the audience server-side. */
export async function cScopedGET(request: NextRequest, audience: PillarCScopedAudience, kind: Kind) {
  const scope = cScopedParams(request.nextUrl.searchParams, audience, kind);
  if (!scope.ok) return reply({ error: scope.error }, scope.status);
  const started = performance.now();
  const db = await createClient();
  const result: CScopedAttrLoad | CScopedPortfolioLoad = kind === "portfolio"
    ? await loadCScopedPortfolioView(audience, db, scope.period, scope.org, scope.channel, scope.portfolio as string)
    : await loadCScopedAttrView(audience, db, scope.period, scope.org, scope.channel);
  if (result.state === "denied") return reply({ error: "forbidden_scope" }, 403);
  if (result.state === "invalid") return reply({ error: "invalid_scope" }, 400);
  if (result.state !== "ready") return reply({ error: "unavailable" }, 503, started);
  const view = result.view;
  const comparisonOrg = kind === "portfolio" ? (view as CScopedPortfolioView).comparison?.scope.org : (view as CScopedAttrView).comparison?.org;
  // The served scope must be the requested one, in both periods.
  if (view.scope.org !== scope.org || view.scope.period !== scope.period || view.scope.channel !== scope.channel || (comparisonOrg !== undefined && comparisonOrg !== scope.org)) {
    pcsLog("PCS-MISMATCH", scope.org);
    return reply({ error: "unavailable" }, 503, started);
  }
  return reply(view, 200, started);
}
