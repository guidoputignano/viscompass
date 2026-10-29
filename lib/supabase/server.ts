import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hardenedCookieOptions } from "./cookie-options";

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // The same hardened options as the proxy: a session written by a
            // server action (sign-in, the email-link confirmation) is HttpOnly
            // from its first response (./cookie-options.ts, XC-X3.3).
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, hardenedCookieOptions(options, process.env.NODE_ENV === "production")),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  );
}
