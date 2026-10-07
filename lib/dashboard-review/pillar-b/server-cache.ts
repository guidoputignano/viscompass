// A small in-process cache for the Pillar B page's FILTER-INDEPENDENT reads.
//
// WHY. Measured on 7 October 2026 in the production database, as the
// reviewer: of the ~6.6 s of statements one page render runs, ~5.4 s are
// reads whose result does not depend on any filter — the reviewer directory
// (0.7 s), molecule spend 2024 and 2025 (1.2 + 1.4 s) and spend 2024 and
// 2025 (1.1 + 1.1 s) — plus the funnel and uptake, which depend on the year
// alone. Every filter click recomputed them, and a click took 8.4 s live. The
// release they read is frozen, so the same scope reads the same rows until a
// release is activated (the release id AND its activation time are part of
// every key, so re-activating the same id also starts afresh).
//
// WHAT MAKES IT SAFE TO SHARE. A key names exactly whose rows it holds:
//   - "reviewer:service-role" — the allow-listed reviewers, whose reads all go
//     through the service-role client and see the whole release identically;
//   - "rls:<user id>:<org type>:<org code>:<region code>" — anyone else, whose
//     reads run under their own session and RLS. The RLS policy selects rows
//     by the membership's org code and region code, so both are in the key;
//     no two users share an entry, and a change of membership is a new key.
// A scope that cannot be identified (no session subject) is not cached at
// all. The cache lives in this server process only: nothing is written to a
// shared or persistent store, and nothing reaches the browser that the page
// did not already send.
//
// WHAT IS NEVER KEPT. A rejected load is evicted as soon as it rejects, so a
// timeout is retried on the next request instead of being served for ten
// minutes. A load that has neither resolved nor rejected after a minute is
// not joined any more: the next request starts its own. A caller can refuse
// a resolved value (`keep`): the page uses it to drop rows read while the
// active release was being switched. Concurrent requests for the same key
// share one in-flight load.
//
// WHAT CAN BE STALE, FOR AT MOST TEN MINUTES. A correction made in place to
// the rows of the active release, without re-activating it; a change to the
// RLS policy itself; a change to an organisation's directory entry (names and
// codes in the reviewer directory). A change of membership, of an
// organisation's region code for its members, or an activation is seen at once.

import "server-only";

export interface ServerCache {
  get<T>(key: string, load: () => Promise<T>, options?: { keep?: (value: T) => boolean | Promise<boolean> }): Promise<T>;
  size(): number;
  clear(): void;
}

export function createServerCache({ ttlMs, max, inflightMs = 60_000, now = () => Date.now() }: {
  ttlMs: number;
  /** Oldest-used entries beyond this count are evicted. */
  max: number;
  /** A load still pending after this long is not joined; the next request starts its own. */
  inflightMs?: number;
  now?: () => number;
}): ServerCache {
  const store = new Map<string, { at: number; value: Promise<unknown>; settled: boolean }>();
  const drop = (key: string, value: Promise<unknown>) => {
    if (store.get(key)?.value === value) store.delete(key);
  };
  return {
    get<T>(key: string, load: () => Promise<T>, options?: { keep?: (value: T) => boolean | Promise<boolean> }): Promise<T> {
      const t = now();
      const hit = store.get(key);
      if (hit && t - hit.at < ttlMs && (hit.settled || t - hit.at < inflightMs)) {
        // Least-recently-used order: a hit moves to the end.
        store.delete(key);
        store.set(key, hit);
        return hit.value as Promise<T>;
      }
      if (hit) store.delete(key);
      const value = load();
      const entry = { at: t, value: value as Promise<unknown>, settled: false };
      store.set(key, entry);
      value.then(
        async (resolved) => {
          entry.settled = true;
          if (!options?.keep) return;
          let keep = false;
          try {
            keep = await options.keep(resolved);
          } catch {
            keep = false;
          }
          if (!keep) drop(key, value);
        },
        () => {
          entry.settled = true;
          drop(key, value);
        },
      );
      while (store.size > max) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
      return value;
    },
    size: () => store.size,
    clear: () => store.clear(),
  };
}

/** One per server process. Ten minutes; a reviewer scope holds about a dozen entries. */
export const pillarBServerCache = createServerCache({ ttlMs: 10 * 60_000, max: 64 });

/**
 * The cache identity of a viewer's reads, or null when it cannot be
 * established — in which case nothing is cached for that request.
 */
export function pillarBCacheScope(input: {
  /** True only when the reads go through the service-role client (reviewer widening succeeded). */
  serviceRole: boolean;
  /** The session subject (auth user id), for reads under RLS. */
  subject: string | null | undefined;
  org: { org_type: string; org_code: string; region_code?: string | null } | null;
}): string | null {
  if (input.serviceRole) return "reviewer:service-role";
  if (!input.subject || !input.org) return null;
  return `rls:${input.subject}:${input.org.org_type}:${input.org.org_code}:${input.org.region_code ?? "-"}`;
}

export function pillarBCacheKey(scope: string, releaseId: string, ...parts: Array<string | number | null>): string {
  return [scope, releaseId, ...parts.map((p) => (p === null ? "-" : String(p)))].join("|");
}
