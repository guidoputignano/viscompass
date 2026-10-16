import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { getViewerIdentity } from "@/lib/auth/viewer";
import { getAdminEmail } from "@/lib/auth/admin";
import { loadCWorkbookSection } from "@/lib/dashboard-review/pillar-c/workbook-loader";
import { isCWorkbookSection } from "@/lib/dashboard-review/pillar-c/workbook";

// Membership reads cookies on every request; no cross-user cache is permitted.
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
export async function GET(request: NextRequest) {
  const [org, viewer, admin] = await Promise.all([getCurrentOrg(), getViewerIdentity(), getAdminEmail()]);
  if (!org || !(viewer?.isReviewer || admin)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const section = request.nextUrl.searchParams.get("section");
  if (!isCWorkbookSection(section)) return NextResponse.json({ error: "invalid_section" }, { status: 400, headers });
  const result = await loadCWorkbookSection(section, true, true);
  if (result.state !== "ready") return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  return NextResponse.json(result.section, { headers });
}
