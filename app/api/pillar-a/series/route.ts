import { NextResponse } from "next/server";
import { getPublicSeries } from "@/lib/pillar-a/server-data";

// The approved public observatory aggregate: the figures /pillar-a renders.
// Provenance detail is stripped in the loader, not here, so this route cannot
// serve an unsanitised payload even if the compiled input changes.
export async function GET(request:Request) {
  const params=new URL(request.url).searchParams;
  const data=getPublicSeries(params.get('region')??'',params.get('group')??'',params.get('channel')??'');
  if(!data)return NextResponse.json({error:'Invalid territory, family or channel'},{status:400});
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
