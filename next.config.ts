import type { NextConfig } from "next";

// B19 / auth-routes and production-readiness. The application served no security
// headers at all. These are deliberately conservative: each one is either
// unconditionally safe for this app or scoped so it cannot break a working page.
//
// The CSP is the exception and is set in Report-Only. This app relies on Next's
// inline bootstrap script and on Supabase over XHR/WebSocket; a blocking policy
// written without observing real traffic would break the dashboard on deploy.
// Report-Only collects the violations needed to write an enforcing policy, and
// the header should be switched to Content-Security-Policy once those are clean.
const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Next injects inline bootstrap and hydration scripts; 'unsafe-inline' is
  // required until a nonce-based policy is wired through the document.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} wss://${SUPABASE_ORIGIN.replace(/^https?:\/\//, "")}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
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
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
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
