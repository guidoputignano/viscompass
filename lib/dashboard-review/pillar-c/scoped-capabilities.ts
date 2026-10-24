/** Pillar C: what each organisation-scoped audience may do on the page. Pure and browser-safe (no label, no key, no
 * figure), so the server guard, the server audience and the client check read the same constant.
 *
 *   - Azienda: nothing beyond its own unit and the aggregate (owner decision O1).
 *   - Regione (regional analytical parity, owner clarification of 23 Oct 2026; owner decision of 24 Oct 2026 for the
 *     modelled budgets and the lineage): the reviewer's price/quantity/mix decomposition, the modelled budgets (O4
 *     lifted for the Regione) and the reviewer's lineage and receipts, each read from its own regional objects. The
 *     other region-wide analyses (per-pack lists of the four ASLs, per-resident drivers, basket indices, File F
 *     quarterly index, findings) come with its extension object.
 *   - Never for a scoped audience: the shared evidence queue (reviewer workflow) and the workbook route. */
export const C_SCOPED_CAPABILITY_KEYS = ["workbook", "insights", "evidence", "pvm", "lineage", "syntheticBudgets"] as const;
export type CScopedCapabilities = Record<typeof C_SCOPED_CAPABILITY_KEYS[number], boolean>;
const NONE: CScopedCapabilities = { workbook: false, insights: false, evidence: false, pvm: false, lineage: false, syntheticBudgets: false };
export const C_SCOPED_CAPABILITIES: Readonly<Record<"azienda" | "regione", Readonly<CScopedCapabilities>>> = {
  azienda: { ...NONE },
  regione: { ...NONE, pvm: true, lineage: true, syntheticBudgets: true },
};
