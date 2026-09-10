// Shared guard for the `next` parameter on the auth redirect routes.
//
// `next` arrives from a confirmation email link, so it is attacker-influenced:
// only ever redirect within this site. Passing it to redirect() unchecked turns
// a legitimate-looking confirmation URL into an open redirect.
//
// Three conditions, and all three are load-bearing:
//   - must start with "/"        — rejects "https://evil.example"
//   - must not start with "//"   — rejects a protocol-relative URL
//   - must not start with "/\"   — browsers normalise a backslash to a forward
//                                  slash in the authority position, so
//                                  "/\evil.example" is fetched as
//                                  "//evil.example". A check looking only for a
//                                  second forward slash lets this through; it is
//                                  the standard bypass.
//
// This lives here rather than in each route because the two copies it replaces
// were maintained separately, and a fix applied to one did not reach the other.
export function safeNext(value: string | null, fallback: string): string {
  return value !== null &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
    ? value
    : fallback;
}
