import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"), "/dashboard-review/spend");

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
