// CSP violation reports (XC-X3.2): what /api/csp-report keeps of a report, and how many it keeps.
//
// Browsers send the violations of the policy in next.config.ts to its report-uri, in one of two shapes:
//   application/csp-report    {"csp-report": {"document-uri", "effective-directive", "blocked-uri", ...}}
//   application/reports+json  [{"type": "csp-violation", "body": {"documentURL", "effectiveDirective", ...}}]
// Only the policy fields are kept. Every URL loses its query string and fragment, because a page address can
// carry filters. Strings are cut short. No cookie, header, IP address or account is read or logged.
//
// A report proves nothing by itself: anyone can POST anything here. The log is a lead to check against the live
// site, never evidence.
//
// Import-free, so tests/csp-report.test.mjs can load it directly.

export const CSP_REPORT_MAX_BYTES = 16_384;
export const CSP_REPORTS_PER_MINUTE = 60;
const MAX_REPORTS_PER_BODY = 20;
const MAX_TEXT = 200;

export interface CspViolation {
  document: string;
  directive: string;
  blocked: string;
  source: string;
  line: number | null;
  column: number | null;
  disposition: string;
}

/** A URL without its query string or fragment; a keyword such as "inline" or "eval" passes through. */
function bareUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, MAX_TEXT);
  } catch {
    return value.replace(/[?#][\s\S]*$/, "").slice(0, MAX_TEXT);
  }
}

const token = (value: unknown): string =>
  typeof value === "string" ? value.replace(/[^A-Za-z0-9 :'_-]/g, "").slice(0, 80) : "";

const position = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;

type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function violation(fields: Fields, legacy: boolean): CspViolation {
  const get = (modern: string, old: string) => fields[legacy ? old : modern];
  return {
    document: bareUrl(get("documentURL", "document-uri")),
    // The legacy shape names the directive twice; the effective one is the one that applied.
    directive: token(get("effectiveDirective", "effective-directive") ?? (legacy ? fields["violated-directive"] : undefined)),
    blocked: bareUrl(get("blockedURL", "blocked-uri")),
    source: bareUrl(get("sourceFile", "source-file")),
    line: position(get("lineNumber", "line-number")),
    column: position(get("columnNumber", "column-number")),
    disposition: token(get("disposition", "disposition")),
  };
}

/** The violations in a report body, in either shape. Anything else yields none. */
export function parseCspReports(text: string): CspViolation[] {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload
      .slice(0, MAX_REPORTS_PER_BODY)
      .filter((entry): entry is Fields => isObject(entry) && entry.type === "csp-violation" && isObject(entry.body))
      .map((entry) => violation(entry.body as Fields, false));
  }
  if (isObject(payload) && isObject(payload["csp-report"])) {
    return [violation(payload["csp-report"], true)];
  }
  return [];
}

/** At most `limit` reports per window, per server instance. Over the limit, reports are dropped, not queued. */
export function createRateLimiter(limit: number, windowMs: number): (now: number) => boolean {
  let windowStart = Number.NEGATIVE_INFINITY;
  let count = 0;
  return (now) => {
    if (now - windowStart >= windowMs) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    return count <= limit;
  };
}
