import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth/get-current-org";
import { hasEnvVars } from "@/lib/utils";

// Bulk export of the compiled annual series. This is the file the reviewer
// asked to keep internal, so it is gated on an APPROVED membership rather than
// on being logged in: a self-registered account awaiting approval gets 403,
// exactly like a logged-out one.
//
// Never cached. Reading the session cookie in getCurrentOrg() already makes this
// route dynamic under cacheComponents, and every response carries no-store, so a
// response authorized for one caller can never be replayed to another. Segment
// config ("dynamic"/"revalidate") is rejected when cacheComponents is enabled.

const FILES: Record<string, { name: string; type: string }> = {
  series: { name: "pillar-a-annual.csv", type: "text/csv; charset=utf-8" },
  dictionary: { name: "pillar-a-annual-dictionary.csv", type: "text/csv; charset=utf-8" },
};

export async function GET(request: Request) {
  // Fail closed. Without Supabase configuration we cannot establish who is
  // calling, so we refuse rather than fall through to serving the file.
  if (!hasEnvVars) {
    return NextResponse.json(
      { error: "Autenticazione non configurata: esportazione non disponibile." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json(
      { error: "È richiesta un’appartenenza organizzativa approvata." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const requested = new URL(request.url).searchParams.get("file") ?? "series";
  const file = FILES[requested];
  if (!file) {
    return NextResponse.json({ error: "unknown file" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const body = readFileSync(path.join(process.cwd(), "data", "public-compiled", file.name));
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename="${file.name}"`,
      "Cache-Control": "no-store",
    },
  });
}
