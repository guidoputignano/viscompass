import "server-only";
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

/**
 * Pillar C additions (build add-v1, owner decision D24-4 of 24 Oct 2026): P8-03 residence, P10-04 narrowing by area
 * (attempt 2) and P10-05 File F attribution fields, built privately
 * (outputs/pillar-c/additions-20261024/PINS_ADDITIONS.json). Names, hashes and sizes only: no figure, no source pin.
 *
 *   - scoped: one object per unit in bucket pillar-c-scoped, under the extension's root v9 (v9/<unit>/aggiunte-<sha>.json),
 *     read with the request's own session so that Storage RLS decides every read. An Azienda reads its own unit and the
 *     aggregate.
 *   - regional: the full object (the five units) in the regional folder v9/regione/, which the storage policy admits only
 *     to an enabled member of the Regione; the same bytes as the reviewer object (a test pins the two together).
 *   - reviewer: the full object in the private review bucket, read only by the reviewer gate (service role).
 */
export const C_ADDITIONS_STORAGE = {
  build: "add-v1",
  root: "v9",
  scoped: {
    "asl-1": { name: "aggiunte-e1b6698afb5c4a907483eef9262439856957d4f57c0428c00c9c49faaa36fe7f.json", sha256: "e1b6698afb5c4a907483eef9262439856957d4f57c0428c00c9c49faaa36fe7f", bytes: 1245 },
    "asl-2": { name: "aggiunte-7e53e47020d3848f1b04cd9ecdd346e988443bf670ea519f92566aeadcf4a1ec.json", sha256: "7e53e47020d3848f1b04cd9ecdd346e988443bf670ea519f92566aeadcf4a1ec", bytes: 1440 },
    "asl-3": { name: "aggiunte-24aba3a63276f138e08b4cceb3f4813d4d8b85c13dafad6e50c12720bb92f666.json", sha256: "24aba3a63276f138e08b4cceb3f4813d4d8b85c13dafad6e50c12720bb92f666", bytes: 3054 },
    "asl-4": { name: "aggiunte-40dc817ae92de62a11d9ba294ff9d82ea45e48cbcf1b8391d5291bcf0ff3fea1.json", sha256: "40dc817ae92de62a11d9ba294ff9d82ea45e48cbcf1b8391d5291bcf0ff3fea1", bytes: 1246 },
    aggregato: { name: "aggiunte-e3ae1502b81633082680b4b1d8570b6613b19d5a81260084db6fef2009d20131.json", sha256: "e3ae1502b81633082680b4b1d8570b6613b19d5a81260084db6fef2009d20131", bytes: 1451 },
  } satisfies Record<CScopedUnit, { name: string; sha256: string; bytes: number }>,
  regional: { name: "aggiunte-a8c26bedb097ce387f36627b506cf55078d0391c3310ab0ef04d4ac0d088a79d.json", sha256: "a8c26bedb097ce387f36627b506cf55078d0391c3310ab0ef04d4ac0d088a79d", bytes: 8223 },
  reviewer: {
    bucket: "pillar-c-review",
    object: "add1/a8c26bedb097ce387f36627b506cf55078d0391c3310ab0ef04d4ac0d088a79d.json",
    sha256: "a8c26bedb097ce387f36627b506cf55078d0391c3310ab0ef04d4ac0d088a79d",
    bytes: 8223,
  },
} as const;
/** Largest object read (the full object is a few kilobytes). */
export const C_ADDITIONS_MAX_BYTES = 65_536;
