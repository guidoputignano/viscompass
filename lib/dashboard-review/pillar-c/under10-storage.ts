import "server-only";
import type { CU10Unit } from "@/lib/dashboard-review/pillar-c/under10";

/**
 * The under-€10 DPC medicine list (joint feedback 2, G2-16; build u10-v1), built privately
 * (outputs/pillar-c/feedback-joint-2-20261027/claude-implementation/under10-delivery/PINS_UNDER10.json). Names, hashes
 * and sizes only: no figure, no product.
 *
 *   - scoped: one object per ASL in bucket pillar-c-scoped, under the extension's root v9 (v9/<unit>/sotto10-<sha>.json),
 *     read with the request's own session so that Storage RLS decides every read. An Azienda reads its own ASL only.
 *   - regional: the four ASLs in the regional folder v9/regione/, which the storage policy admits only to an enabled member
 *     of the Regione; the same bytes as the reviewer object.
 *   - reviewer: the same object in the private review bucket, read only by the reviewer gate (service role).
 */
export const C_UNDER10_STORAGE = {
  build: "u10-v1",
  root: "v9",
  scoped: {
    "asl-1": { name: "sotto10-68b361a896746dfbccd12a811baec9686c74bc6a7b2959f9598c98aeec86368a.json", sha256: "68b361a896746dfbccd12a811baec9686c74bc6a7b2959f9598c98aeec86368a", bytes: 6783 },
    "asl-2": { name: "sotto10-937d280ed62ffad3f4128e28eddedf3b62be8f1d01cb938d6acbcbf9d909a3f6.json", sha256: "937d280ed62ffad3f4128e28eddedf3b62be8f1d01cb938d6acbcbf9d909a3f6", bytes: 7616 },
    "asl-3": { name: "sotto10-bf6103cf83bd9a07189cfaba1f73a387c171831b97df29a9f9a2271b5e376d2c.json", sha256: "bf6103cf83bd9a07189cfaba1f73a387c171831b97df29a9f9a2271b5e376d2c", bytes: 7214 },
    "asl-4": { name: "sotto10-693820e174cdac2b2419c160bbe08a2a8e8e41acff4fe17523deffa479035ab9.json", sha256: "693820e174cdac2b2419c160bbe08a2a8e8e41acff4fe17523deffa479035ab9", bytes: 7142 },
  } satisfies Record<CU10Unit, { name: string; sha256: string; bytes: number }>,
  regional: { name: "sotto10-0a23adf54911beca6cd44237c323759a4bfff76d5e1982142c7c55716dd2b813.json", sha256: "0a23adf54911beca6cd44237c323759a4bfff76d5e1982142c7c55716dd2b813", bytes: 28353 },
  reviewer: {
    bucket: "pillar-c-review",
    object: "u10/0a23adf54911beca6cd44237c323759a4bfff76d5e1982142c7c55716dd2b813.json",
    sha256: "0a23adf54911beca6cd44237c323759a4bfff76d5e1982142c7c55716dd2b813",
    bytes: 28353,
  },
} as const;
/** Largest object read (the four-ASL object is a few tens of kilobytes). */
export const C_UNDER10_MAX_BYTES = 262_144;
