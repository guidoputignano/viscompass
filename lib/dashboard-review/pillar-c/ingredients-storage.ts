import "server-only";

/**
 * The active ingredients by exact AIC (joint feedback 2, G2-23; build ing-v1), built privately
 * (outputs/pillar-c/feedback-joint-2-20261027/claude-implementation/ingredients-delivery/PINS_INGREDIENTS.json) from
 * official AIFA lists. Names, hashes and sizes only: no label, no product.
 *
 *   - scoped: one object in the aggregate folder of bucket pillar-c-scoped (v9/aggregato/principi-<sha>.json), read under
 *     the request's own session (Storage RLS). Every scoped audience holds the aggregate, whose portfolio views already
 *     list every product of the four ASLs.
 *   - reviewer: the same bytes in the private review bucket, read only by the reviewer gate (service role).
 */
export const C_INGREDIENTS_STORAGE = {
  build: "ing-v1",
  root: "v9",
  scoped: { unit: "aggregato", name: "principi-c8ffbbde9924e36017e22050e179df1c117cf24c14408fc37e1a3cdb68a94a98.json", sha256: "c8ffbbde9924e36017e22050e179df1c117cf24c14408fc37e1a3cdb68a94a98", bytes: 208510 },
  reviewer: {
    bucket: "pillar-c-review",
    object: "ing1/c8ffbbde9924e36017e22050e179df1c117cf24c14408fc37e1a3cdb68a94a98.json",
    sha256: "c8ffbbde9924e36017e22050e179df1c117cf24c14408fc37e1a3cdb68a94a98",
    bytes: 208510,
  },
} as const;
/** Largest object read (about two hundred kilobytes). */
export const C_INGREDIENTS_MAX_BYTES = 524_288;
