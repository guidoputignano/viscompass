import type { NextConfig } from "next";

// B19 / auth-routes and production-readiness. The application served no security
// headers at all. These are deliberately conservative: each one is either
// unconditionally safe for this app or scoped so it cannot break a working page.
//
// The CSP is enforced since 29 October 2026 (XC-X3.1). It ran Report-Only first;
// a live sweep of every page under the reviewer session and of the public pages,
// with sections opened and selectors changed, logged no violation of this exact
// policy. Violations are now blocked and reported to /api/csp-report (XC-X3.2).
//
// What it still allows, and why: 'unsafe-inline' for scripts. With
// cacheComponents every route is partially prerendered, and the prerendered
// shell carries Next's inline bootstrap scripts, written at build time with no
// request and so no nonce (node_modules/next/dist/docs/01-app/02-guides/
// content-security-policy.md: "PPR is incompatible with nonce-based CSP").
// Everything else an injected script would need is closed: no script from
// another origin, no eval or new Function (no 'unsafe-eval'), no fetch, XHR,
// WebSocket or image to any origin but this one and Supabase, no plugin, no
// <base>, no form posting elsewhere, no framing. With the session cookie
// HttpOnly (lib/supabase/cookie-options.ts) the session is not readable either.
const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// React's development build evaluates strings to rebuild server error stacks;
// production never does, and the production policy does not allow it.
const DEV_EVAL = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV_EVAL}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Supabase over HTTPS and its realtime WebSocket (wss: for https:, ws: for a
  // local http: project). Without the variable, no source but this site.
  `connect-src 'self'${SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN} ${SUPABASE_ORIGIN.replace(/^http/, "ws")}` : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Relative, so every deployment reports to itself. report-uri, not report-to:
  // it is the one form every browser still sends.
  "report-uri /api/csp-report",
].join("; ");

const SECURITY_HEADERS = [
  // Non-public hospital data: never let an intermediary downgrade to plaintext.
  // Two years, subdomains included. Not preloaded — that is a one-way door and
  // belongs to whoever owns the domain, not to this config.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Auth tokens travel in URLs on the recovery and confirm routes; keep them out
  // of any cross-origin Referer.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // AGENTS.md is hand-maintained: it is this project's working agreement and is
  // paired with CLAUDE.md. next dev appends a generated block to it on every
  // start, which edits a reviewed document without review and pushes the two
  // files further apart. The Next guidance is still readable in
  // node_modules/next/dist/docs/ for anyone who wants it.
  agentRules: false,
  // No file tracing for compiled data: nothing reads it from disk any more. The
  // bulk-export route was removed rather than gated, so the compiled series is
  // never delivered whole to anyone, signed in or not.
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
