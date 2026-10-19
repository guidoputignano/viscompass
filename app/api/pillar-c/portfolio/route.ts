import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getViewerIdentity } from "@/lib/auth/viewer";
import { getAdminEmail } from "@/lib/auth/admin";
import { C_ATTR_CHANNELS, C_ATTR_ORGS, C_ATTR_PERIODS, type CAttrChannel, type CAttrOrg, type CAttrPeriod } from "@/lib/dashboard-review/pillar-c/attribution";
import { loadCPortfolioView } from "@/lib/dashboard-review/pillar-c/portfolio-loader";

const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
export async function GET(request: NextRequest) {
  const [org, viewer, admin] = await Promise.all([getCurrentOrg(), getViewerIdentity(), getAdminEmail()]);
  if (!org || !(viewer?.isReviewer || admin)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const params = request.nextUrl.searchParams, period = params.get("period"), organization = params.get("org"), channel = params.get("channel"), portfolio = params.get("portfolio");
  if (!C_ATTR_PERIODS.includes(period as CAttrPeriod) || !C_ATTR_ORGS.includes(organization as CAttrOrg) || !C_ATTR_CHANNELS.includes(channel as CAttrChannel) || !portfolio || !/^[A-Z0-9]{2,12}$/.test(portfolio)) return NextResponse.json({ error: "invalid_scope" }, { status: 400, headers });
  const result = await loadCPortfolioView(true, true, period as CAttrPeriod, organization as CAttrOrg, channel as CAttrChannel, portfolio);
  return result.state === "ready" ? NextResponse.json(result.view, { headers }) : NextResponse.json({ error: "unavailable" }, { status: 503, headers });
}
