import type { CookieOptions } from "@supabase/ssr";

// Session cookies last at most seven days. The Supabase default of 400 days keeps
// a stolen session usable long after the user believes it ended.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * The options every Supabase auth cookie is written with, on every server path
 * (lib/supabase/proxy.ts and lib/supabase/server.ts). Whatever @supabase/ssr asks
 * for is hardened rather than trusted:
 *
 * - HttpOnly, always (XC-X3.3). @supabase/ssr passes httpOnly: false explicitly,
 *   because its browser client reads the session from document.cookie; so the
 *   earlier `options?.httpOnly ?? true` never applied and any script on the page
 *   could read the session. The browser no longer touches the session at all:
 *   sign-in, sign-out, password changes and upload tickets are server actions
 *   (app/auth/actions.ts, lib/dashboard-review/actions.ts).
 * - Secure in production. Without it a single plaintext request leaks the
 *   session. Skipped only on localhost, where there is no TLS to require.
 * - SameSite=Lax unless the library asks for something stricter or explicit.
 * - At most seven days. A deletion (maxAge 0) stays a deletion.
 */
export function hardenedCookieOptions(options: CookieOptions | undefined, production: boolean): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: production,
    sameSite: options?.sameSite ?? "lax",
    maxAge: Math.min(options?.maxAge ?? SESSION_MAX_AGE_SECONDS, SESSION_MAX_AGE_SECONDS),
  };
}
