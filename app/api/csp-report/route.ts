import {
  CSP_REPORT_MAX_BYTES,
  CSP_REPORTS_PER_MINUTE,
  createRateLimiter,
  parseCspReports,
} from "@/lib/security/csp-report";

// The report-uri of the Content-Security-Policy in next.config.ts (XC-X3.2). Each violation becomes one line in the
// server log, «csp-violation {…}», with the fields lib/security/csp-report.ts keeps. Public (lib/supabase/public-paths.ts):
// a browser sends reports without the session. It always answers 204 and never echoes what it received.

const allow = createRateLimiter(CSP_REPORTS_PER_MINUTE, 60_000);
const ACCEPTED = /^application\/(csp-report|reports\+json|json)\b/i;

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/** The body up to `max` bytes; a longer body is refused rather than read in full. */
async function readCapped(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function POST(request: Request) {
  if (!ACCEPTED.test(request.headers.get("content-type") ?? "")) return noContent();
  if (!allow(Date.now())) return noContent();
  const text = await readCapped(request, CSP_REPORT_MAX_BYTES);
  if (!text) return noContent();
  for (const violation of parseCspReports(text)) console.warn(`csp-violation ${JSON.stringify(violation)}`);
  return noContent();
}
