import "server-only";
import { createHash } from "node:crypto";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { parseCReviewPacket, type CReviewPacket } from "@/lib/dashboard-review/pillar-c/review";
import { readCReviewStoragePacket, type CStoredReview } from "@/lib/dashboard-review/pillar-c/review-storage";

export type CReviewLoad = { state: "ready"; packet: CReviewPacket } | { state: "not_configured" | "forbidden" | "invalid" };
/** Reviewer gate protects file inspection; it does NOT replace DB RLS for a
 * future accepted Azienda release. Never share/cache this result across roles. */
export async function loadCReviewPacket(approved: boolean, projectReviewer: boolean,
  config = { file: process.env.PILLAR_C_REVIEW_PACKET_PATH, sha: process.env.PILLAR_C_REVIEW_PACKET_SHA256 },
  remote: () => Promise<CStoredReview> = readCReviewStoragePacket,
): Promise<CReviewLoad> {
  if (!approved || !projectReviewer) return { state: "forbidden" };
  if (!config.file && !config.sha) {
    try {
      const stored = await remote();
      if (stored.state !== "ready") return { state: stored.state };
      if (stored.bytes.byteLength < 2 || stored.bytes.byteLength > 5_000_000 || !/^[a-f0-9]{64}$/.test(stored.sha) || createHash("sha256").update(stored.bytes).digest("hex") !== stored.sha) return { state: "invalid" };
      return { state: "ready", packet: parseCReviewPacket(JSON.parse(Buffer.from(stored.bytes).toString("utf8"))) };
    } catch { return { state: "invalid" }; }
  }
  if (!config.file || !config.sha || !path.isAbsolute(config.file) || !/^[a-f0-9]{64}$/.test(config.sha)) return { state: "invalid" };
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const [file, root] = await Promise.all([realpath(config.file), realpath(process.cwd())]);
    const relative = path.relative(root, file);
    // Even an ignored artifact inside the public checkout is prohibited.
    if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) return { state: "invalid" };
    handle = await open(file, "r");
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 2 || stat.size > 5_000_000) return { state: "invalid" };
    const bytes = await handle.readFile();
    if (bytes.byteLength > 5_000_000 || createHash("sha256").update(bytes).digest("hex") !== config.sha) return { state: "invalid" };
    return { state: "ready", packet: parseCReviewPacket(JSON.parse(bytes.toString("utf8"))) };
  } catch {
    // Never render a path, confidential body, secret or stack trace.
    return { state: "invalid" };
  } finally { await handle?.close().catch(() => undefined); }
}
