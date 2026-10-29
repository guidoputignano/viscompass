import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
import { isPublicPath } from "./public-paths";
import { loginRedirectSearch } from "../auth/safe-next";
import { hardenedCookieOptions } from "./cookie-options";

export async function updateSession(request: NextRequest) {
  // The public observatories (/pillar-a, its three read routes, /pillar-b):
  // the list and its exact-match rule live in ./public-paths.ts, where they
  // are tested. Everything else needs a session.
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Fail closed. Without Supabase configuration no session can be established,
  // so everything outside the public observatory is refused rather than served
  // unauthenticated. Previously this returned the response unchanged, which
  // opened every dashboard route whenever the environment was incomplete.
  if (!hasEnvVars) {
    if (request.nextUrl.pathname === "/") return supabaseResponse;
    return new NextResponse("Service unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            // Harden whatever the library asks for rather than trusting it:
            // HttpOnly, Secure in production, at most seven days
            // (./cookie-options.ts, XC-X3.3).
            supabaseResponse.cookies.set(name, value, hardenedCookieOptions(options, process.env.NODE_ENV === "production")),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    // no user, potentially respond by redirecting the user to the login page
    // R20-05: the requested page (and its filters) comes back after sign-in, validated (lib/auth/safe-next.ts).
    const url = request.nextUrl.clone();
    url.search = loginRedirectSearch(request.nextUrl.pathname, request.nextUrl.search, request.method);
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
