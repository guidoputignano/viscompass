import { NextResponse } from "next/server";
import { getPublicOsmed } from "@/lib/pillar-a/server-data";

// OSMED reference rates. The edition, table and printed page stay — they are
// the citation a reader needs — while the extract's filename and digest do not
// leave the repository.
export async function GET() {
  return NextResponse.json(getPublicOsmed(), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
