// Shared guard for the `next` parameter on the auth redirect routes and the sign-in form.
//
// `next` arrives from a confirmation email link or from a redirect the proxy built, so it is attacker-influenced:
// only ever redirect within this site. Passing it to redirect() unchecked turns a legitimate-looking URL into an
// open redirect.
//
// The checks, all load-bearing:
//   - must start with "/"        — rejects "https://evil.example"
//   - must not start with "//"   — rejects a protocol-relative URL
//   - no backslash anywhere      — browsers normalise "\" to "/", so "/\evil.example" is fetched as
//                                  "//evil.example" (the standard bypass)
//   - no control character       — browsers strip tab and newline, so "/\t/evil.example" becomes "//evil.example"
//   - no encoded slash or backslash right after the first "/" ("/%2F…", "/%5C…"), which a decoding hop could turn
//     into either of the above
//   - and, after all that, it must still resolve to this site when parsed as a URL; the normalised path, query and
//     fragment are returned, never the raw text.
//
// This lives here rather than in each route because the copies it replaced were maintained separately, and a fix
// applied to one did not reach the other.
const BASE = "https://vis-next.invalid";
const MAX = 2048;

export function safeNext(value: string | null, fallback: string): string {
  if (value === null || value.length === 0 || value.length > MAX) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value) || /^\/%(2f|5c)/i.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : fallback;
}

/** Where a signed-in user lands when nothing better is known. */
export const LOGIN_DEFAULT_NEXT = "/dashboard-review/spend";

/** A sign-in destination: a safe same-site page, never an auth or API route (no loop, no JSON response). */
export function loginNext(value: string | null | undefined): string {
  const next = safeNext(value ?? null, LOGIN_DEFAULT_NEXT);
  return /^\/(auth|api)(\/|\?|#|$)/.test(next) ? LOGIN_DEFAULT_NEXT : next;
}

/** The sign-in URL for an unauthenticated request (R20-05): the requested page and its query come back as `next`,
 * for GET page requests only; anything unsafe or too long is dropped rather than carried. The fragment never reaches
 * the server, but browsers keep it across this redirect, and the sign-in form re-attaches a well-formed one. */
export function loginRedirectSearch(pathname: string, search: string, method: string): string {
  if (method !== "GET" || pathname.startsWith("/api/")) return "";
  const next = loginNext(`${pathname}${search}`);
  return next !== LOGIN_DEFAULT_NEXT ? `?next=${encodeURIComponent(next)}` : "";
}

/** The final client-side destination after sign-in: the validated `next`, plus the anchor the browser kept, when the
 * target has none of its own and the anchor is a plain section id. */
export function loginDestination(next: string, hash: string): string {
  return !next.includes("#") && /^#[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(hash) ? `${next}${hash}` : next;
}
