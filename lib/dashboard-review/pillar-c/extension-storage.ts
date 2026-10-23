import "server-only";
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

/**
 * Pillar C extension objects (points 15-16): January 2026 DPC and File F 2025, built privately (build ext-v2,
 * outputs/pillar-c/extension-release-20261022/PINS_V2.json). Hashes and sizes only: no figure. ext-v2 (23 Oct 2026,
 * owner decisions D1-D3 and D7) adds the File F month-to-month bridges, each Azienda's own per-pack costs, the Lorenz
 * deciles and the pharmacy fee quartiles, and pools the File F unknown age into 85+. The ext-v1 objects stay in storage.
 *
 *   - scoped: one object per unit in bucket pillar-c-scoped under its own root v9 (v9/<unit>/estensione-<sha>.json), so
 *     the rec5 root v1 keeps exactly its manifest. The storage.objects policy of migration 20261020120000 admits every
 *     v-root, so each read goes through the request's own session and Storage RLS decides it, as for the rec5 objects.
 *   - reviewer: one object in the private review bucket, read only by the reviewer gate (service role), as the R5 packet.
 */
export const C_EXTENSION_STORAGE = {
  build: "ext-v2",
  root: "v9",
  scoped: {
    "asl-1": { name: "estensione-f1f5c1734f5107e8d11dc00153d4660ce15319195a7239f3e93c2930308f9120.json", sha256: "f1f5c1734f5107e8d11dc00153d4660ce15319195a7239f3e93c2930308f9120", bytes: 56337 },
    "asl-2": { name: "estensione-146df3703f9ec951e993c606109e47d9d29c4117940569bb78e25254e81f26e2.json", sha256: "146df3703f9ec951e993c606109e47d9d29c4117940569bb78e25254e81f26e2", bytes: 56321 },
    "asl-3": { name: "estensione-7b1c2e7b7c217d774dcc4e4b5d1875921bf09d89419611503420bcd1bbe360b2.json", sha256: "7b1c2e7b7c217d774dcc4e4b5d1875921bf09d89419611503420bcd1bbe360b2", bytes: 63673 },
    "asl-4": { name: "estensione-2eb474f724f97e92be791dd74dce3d62d5b18fae80d2a060dcb8db019fef677e.json", sha256: "2eb474f724f97e92be791dd74dce3d62d5b18fae80d2a060dcb8db019fef677e", bytes: 56278 },
    aggregato: { name: "estensione-5818863bc804c49dde30df118df5c5286fa98e2218a9f1b6a30c7ae30ff39646.json", sha256: "5818863bc804c49dde30df118df5c5286fa98e2218a9f1b6a30c7ae30ff39646", bytes: 4496 },
  } satisfies Record<CScopedUnit, { name: string; sha256: string; bytes: number }>,
  reviewer: {
    bucket: "pillar-c-review",
    object: "ext1/42975256e1fd403a8bea5d628042b862381aadcf5467b925a3ecbd31014c4cbc.json",
    sha256: "42975256e1fd403a8bea5d628042b862381aadcf5467b925a3ecbd31014c4cbc",
    bytes: 242086,
  },
  /** Point 18 cases bind to the release of the findings, not to the reviewer object's bytes: findings ext-v1 were first
   * published in reviewer object 59ad3da7… and are unchanged since (SHA-256 of their compact JSON). New text needs a new
   * version, which starts new cases; build_packets.py refuses changed text under the same version. */
  findings: {
    version: "ext-v1",
    sha256: "bc3228cb77a2bdb8e965035a1395d93507654e5e5e9c1436fd2fa312ef7e5e06",
    snapshot: "59ad3da74072ac52476492639aca142352d75746162455ee8ed6a873eb9cfa54",
  },
} as const;
/** Largest object read: the reviewer object carries the four Aziende's per-pack lists (about a quarter of this cap). */
export const C_EXTENSION_MAX_BYTES = 1_000_000;
