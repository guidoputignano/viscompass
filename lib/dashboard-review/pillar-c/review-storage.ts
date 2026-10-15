import "server-only";

// An immutable, private review artifact, not a canonical fact import. The bucket
// has no anonymous/authenticated download grant. Its server-side service read
// is called only through gated server loaders: approved reviewers receive the
// private review packet; ordinary approved members receive only the closed
// public-source forecast projection in regional-forecast-loader. Never forward
// these transport bytes directly to an ordinary member or a public response.
// R5 (schema pillar-c-review-v2, with the regional forecast section). The R4
// object stays in the bucket untouched; this pin and the v2 parser ship together.
export const C_REVIEW_STORAGE = {
  bucket: "pillar-c-review",
  object: "r5/fd09373fafeb5ef2c9acd1788504bac2c911c7d33a828b956e584f4b820d93df.json",
  sha256: "fd09373fafeb5ef2c9acd1788504bac2c911c7d33a828b956e584f4b820d93df",
} as const;

export type CStoredReview = { state: "ready"; bytes: Uint8Array; sha: string } | { state: "not_configured" | "invalid" };

export async function readCReviewStoragePacket(): Promise<CStoredReview> {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key) return { state: "not_configured" };
  try {
    const response = await fetch(`${origin}/storage/v1/object/authenticated/${C_REVIEW_STORAGE.bucket}/${C_REVIEW_STORAGE.object}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok || Number(response.headers.get("content-length") ?? 0) > 5_000_000) return { state: "invalid" };
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength >= 2 && bytes.byteLength <= 5_000_000 ? { state: "ready", bytes, sha: C_REVIEW_STORAGE.sha256 } : { state: "invalid" };
  } catch { return { state: "invalid" }; }
}
