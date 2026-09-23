import { NextResponse } from "next/server";
import { getPublicSeries } from "@/lib/pillar-a/server-data";

// The approved public observatory aggregate: the figures /pillar-a renders.
// Provenance detail is stripped in the loader, not here, so this route cannot
// serve an unsanitised payload even if the compiled input changes.
export async function GET() {
  return NextResponse.json(getPublicSeries(), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
