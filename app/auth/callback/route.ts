import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// Only ever redirect within this site. Rejecting "//" alone is not enough:
// browsers normalise a backslash to a forward slash in the authority position,
// so "/\evil.example" is fetched as "//evil.example" — a protocol-relative URL
// pointing off-site — and passes a check that looks only for a second forward
// slash. Same guard as app/auth/confirm/route.ts.
function safeNext(value: string | null): string {
  const ok =
    value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
  return ok ? value! : "/dashboard-review/spend";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, request.nextUrl.origin));
    }

    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(error.message)}`, request.nextUrl.origin),
    );
  }

  return NextResponse.redirect(
    new URL("/auth/error?error=Missing%20confirmation%20code", request.nextUrl.origin),
  );
}
