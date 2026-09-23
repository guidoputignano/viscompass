import { NextResponse } from "next/server";
import { getAtc4Slice, ATC4_CHANNELS, ATC4_REGIONS } from "@/lib/pillar-a/server-data";

// Only the families the public observatory publishes. An arbitrary prefix is
// rejected rather than passed through, so this cannot be used to enumerate ATC
// groups outside the released perimeter.
const PREFIXES: Record<string, string> = { antibiotics: "J01", antifungals: "J02A" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const region = params.get("region") ?? "";
  const channel = params.get("channel") ?? "";
  const prefix = PREFIXES[params.get("group") ?? ""];

  if (!prefix || !ATC4_REGIONS.includes(region) || !ATC4_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "unknown territory, channel or family" }, { status: 400 });
  }

  const slice = getAtc4Slice(region, channel, prefix);
  if (!slice) return NextResponse.json({ error: "unknown territory or channel" }, { status: 400 });

  return NextResponse.json(slice, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
