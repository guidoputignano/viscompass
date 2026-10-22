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
    "asl-1": { name: "estensione-b5ae7a802abd3bf8160fd25dba995aa3bc0d9624c2984926d14dbe1616ec929a.json", sha256: "b5ae7a802abd3bf8160fd25dba995aa3bc0d9624c2984926d14dbe1616ec929a", bytes: 4461 },
    "asl-2": { name: "estensione-9c7212ecb2ef5681a1f4d0552147b42c176660907f5fa2078dcfcd3160e2d158.json", sha256: "9c7212ecb2ef5681a1f4d0552147b42c176660907f5fa2078dcfcd3160e2d158", bytes: 4463 },
    "asl-3": { name: "estensione-2db6607ae60f8266d2ad734075824e43bc1d0ae3ea4beaa3d93baaa8acb66d18.json", sha256: "2db6607ae60f8266d2ad734075824e43bc1d0ae3ea4beaa3d93baaa8acb66d18", bytes: 8693 },
    "asl-4": { name: "estensione-b7b21d37e839ceec42d652e918d9067d4160225d6c3677a1aec7d01d01e3c7de.json", sha256: "b7b21d37e839ceec42d652e918d9067d4160225d6c3677a1aec7d01d01e3c7de", bytes: 4462 },
    aggregato: { name: "estensione-3c0a2ed51f4690171c5c885a73d4cd8b1c6ec2a8a6003240a4d36afd05c3681e.json", sha256: "3c0a2ed51f4690171c5c885a73d4cd8b1c6ec2a8a6003240a4d36afd05c3681e", bytes: 4369 },
  } satisfies Record<CScopedUnit, { name: string; sha256: string; bytes: number }>,
  reviewer: {
    bucket: "pillar-c-review",
    object: "ext1/efb19a4c65ae7e59b1e35121af4c55229b439c962c826be3c8ba537e3eff8736.json",
    sha256: "efb19a4c65ae7e59b1e35121af4c55229b439c962c826be3c8ba537e3eff8736",
    bytes: 27703,
  },
} as const;
export const C_EXTENSION_MAX_BYTES = 200_000;
