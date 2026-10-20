import "server-only";
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

/**
 * Pillar C organisation-scoped delivery: the private bucket and the pinned index of each unit.
 * Hashes only, copied from the private build receipt PINS.json (build rec5-scoped-v1); no figure,
 * no row count and no province key. Every other object (the unit's review file and its 32
 * attribution and portfolio shards) is pinned transitively by name, SHA-256 and size in that index.
 *
 * Reads go through the request's own session client, so Storage RLS decides every one of them
 * (public.pillar_c_scoped_units(), migration 20261020120000). There is no service-role path and no
 * cache for these objects. A new release, a re-key or an offboarding means a new build root (v2, …),
 * new objects and new pins here; the objects of the old root are then deleted.
 */
export const C_SCOPED_STORAGE = {
  bucket: "pillar-c-scoped",
  root: "v1",
  build: "rec5-scoped-v1",
  /** The reviewer pins each scoped index declares as its source: the R5 review packet and the two shard indexes. */
  source: {
    review: "fd09373fafeb5ef2c9acd1788504bac2c911c7d33a828b956e584f4b820d93df",
    attribution: "39d1a9c8a8aa9546d97c31c26941a7d0f93cd85a9256e6c043da5ecc852bad16",
    portfolio: "a015ef094b8ca66e3332b8de9578370cc31ea337a9c1f25f97a2692486c7f0cc",
  },
  index: {
    "asl-1": "b51f50eed889c0318f2f1d98fbb3a138106548b4328a14e081d32a1035ced685",
    "asl-2": "9e8bac8a8d2d91642c2d09798d80eeadcdaa0567345dcbd785f1f0367033b6dd",
    "asl-3": "627408e82e22c74a7654a0ce6d7e711f9bb815ff216ddb59dd818a8e15f4c092",
    "asl-4": "90e8a2cf8754d9fc84ae3325bed23ebfeabd220f300139d0ce08504d6f615ccc",
    "aggregato": "7e53fbcee056f147b0a97e48799e9947f63416af157835888cd3bc2a3705c3ae",
  } satisfies Record<CScopedUnit, string>,
} as const;

/** Byte caps per object kind. The bucket itself refuses objects above 5 MiB. */
export const C_SCOPED_LIMITS = { index: 65_536, review: 1_000_000, attribution: 1_000_000, portfolio: 5_000_000 } as const;
