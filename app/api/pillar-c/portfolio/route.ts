import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getViewerIdentity } from "@/lib/auth/viewer";
import { getAdminEmail } from "@/lib/auth/admin";
import { C_ATTR_CHANNELS, C_ATTR_ORGS, C_ATTR_PERIODS, type CAttrChannel, type CAttrOrg, type CAttrPeriod } from "@/lib/dashboard-review/pillar-c/attribution";
import { loadCPortfolioView } from "@/lib/dashboard-review/pillar-c/portfolio-loader";
import { resolvePillarCMemberAudience } from "@/lib/dashboard-review/pillar-c/audience";
import { isPillarCScopedAudience } from "@/lib/dashboard-review/pillar-c/audience-rules";
import { cScopedGET } from "@/lib/dashboard-review/pillar-c/scoped-route";
import { cPortfolioWithIngredients, loadCIngredientsReviewer } from "@/lib/dashboard-review/pillar-c/ingredients-loader";

const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
export async function GET(request: NextRequest) {
  const [org, viewer, admin] = await Promise.all([getCurrentOrg(), getViewerIdentity(), getAdminEmail()]);
  if (!org || !(viewer?.isReviewer || admin)) {
    // Not a reviewer. The audience is derived from the session, never from the query. An enabled Azienda or
    // Regione member is served its own units only, read under its own session (Storage RLS); anyone else gets 403.
    const audience = org ? await resolvePillarCMemberAudience(org) : null;
    if (isPillarCScopedAudience(audience)) return cScopedGET(request, audience, "portfolio");
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  const params = request.nextUrl.searchParams, period = params.get("period"), organization = params.get("org"), channel = params.get("channel"), portfolio = params.get("portfolio");
  if (!C_ATTR_PERIODS.includes(period as CAttrPeriod) || !C_ATTR_ORGS.includes(organization as CAttrOrg) || !C_ATTR_CHANNELS.includes(channel as CAttrChannel) || !portfolio || !/^[A-Z0-9]{2,12}$/.test(portfolio)) return NextResponse.json({ error: "invalid_scope" }, { status: 400, headers });
  // G2-23: the active ingredients of the view's own products, joined here; unreadable ingredients leave the view intact.
  const [result, ingredients] = await Promise.all([loadCPortfolioView(true, true, period as CAttrPeriod, organization as CAttrOrg, channel as CAttrChannel, portfolio), loadCIngredientsReviewer(true, true)]);
  return result.state === "ready" ? NextResponse.json(cPortfolioWithIngredients(result.view, ingredients), { headers }) : NextResponse.json({ error: "unavailable" }, { status: 503, headers });
}
