import "server-only";
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

/**
 * Pillar C extension objects (points 15-16): January 2026 DPC and File F 2025, built privately (build ext-v1,
 * outputs/pillar-c/extension-release-20261022/PINS.json). Hashes and sizes only: no figure.
 *
 *   - scoped: one object per unit under the existing scoped root (v1/<unit>/estensione-<sha>.json in bucket
 *     pillar-c-scoped). The storage.objects policy of migration 20261020120000 admits the name pattern, so every read
 *     goes through the request's own session and Storage RLS decides it, exactly as for the rec5 objects.
 *   - reviewer: one object in the private review bucket, read only by the reviewer gate (service role), as the R5 packet.
 */
export const C_EXTENSION_STORAGE = {
  build: "ext-v1",
  scoped: {
    "asl-1": { name: "estensione-8da3a9b9c34d0f5c77d728db949e9fd6bf01e908ddceb314002612d05f8ab64a.json", sha256: "8da3a9b9c34d0f5c77d728db949e9fd6bf01e908ddceb314002612d05f8ab64a", bytes: 4490 },
    "asl-2": { name: "estensione-1a832dca5e6db62b0e0ec276803699505a9627374b6007100f450daa4aacb818.json", sha256: "1a832dca5e6db62b0e0ec276803699505a9627374b6007100f450daa4aacb818", bytes: 4492 },
    "asl-3": { name: "estensione-d9789a0e61fd2068e8294a582e22e30ffc5cce477d3a951789a54db56110c1fa.json", sha256: "d9789a0e61fd2068e8294a582e22e30ffc5cce477d3a951789a54db56110c1fa", bytes: 9006 },
    "asl-4": { name: "estensione-7c9b9d4a76394e5c734b4d70a0d1ac28a5abaa079877fe7f5013cb2e8810ac0c.json", sha256: "7c9b9d4a76394e5c734b4d70a0d1ac28a5abaa079877fe7f5013cb2e8810ac0c", bytes: 4491 },
    aggregato: { name: "estensione-c81948a7c2a72bdd2e94f3fc24864a8324bcd54747125fc71caffa8edb8993d9.json", sha256: "c81948a7c2a72bdd2e94f3fc24864a8324bcd54747125fc71caffa8edb8993d9", bytes: 4398 },
  } satisfies Record<CScopedUnit, { name: string; sha256: string; bytes: number }>,
  reviewer: {
    bucket: "pillar-c-review",
    object: "ext1/59ad3da74072ac52476492639aca142352d75746162455ee8ed6a873eb9cfa54.json",
    sha256: "59ad3da74072ac52476492639aca142352d75746162455ee8ed6a873eb9cfa54",
    bytes: 31605,
  },
} as const;
export const C_EXTENSION_MAX_BYTES = 200_000;
