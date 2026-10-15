import "server-only";

// An immutable, private review artifact, not a canonical fact import. The bucket
// has no anonymous/authenticated download grant. Its server-side service read
// is called ONLY after approved project-reviewer authorization in review-loader.
export const C_REVIEW_STORAGE = {
  bucket: "pillar-c-review",
  object: "r4/bd79c75e983a30ca95dd5a5a44c15685d4968efc74168b7ad33e1fa9cda6d4ea.json",
  sha256: "bd79c75e983a30ca95dd5a5a44c15685d4968efc74168b7ad33e1fa9cda6d4ea",
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
