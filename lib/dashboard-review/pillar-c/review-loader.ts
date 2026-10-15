import "server-only";
import { createHash } from "node:crypto";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { parseCReviewPacket, type CReviewPacket } from "@/lib/dashboard-review/pillar-c/review";

export type CReviewLoad = { state: "ready"; packet: CReviewPacket } | { state: "not_configured" | "forbidden" | "invalid" };
/** Reviewer gate protects file inspection; it does NOT replace DB RLS for a
 * future accepted Azienda release. Never share/cache this result across roles. */
export async function loadCReviewPacket(approved: boolean, projectReviewer: boolean,
  config = { file: process.env.PILLAR_C_REVIEW_PACKET_PATH, sha: process.env.PILLAR_C_REVIEW_PACKET_SHA256 },
): Promise<CReviewLoad> {
  if (!approved || !projectReviewer) return { state: "forbidden" };
  if (!config.file && !config.sha) return { state: "not_configured" };
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
