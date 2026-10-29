// DDD-per-pack corrections for a private Pillar A release.
//
// The release takes each pack's DDD per pack (DDD_AIC) from the source workbook. A
// correction replaces one pack's value with the one derived independently from the
// pack's contents and the WHO DDD, and only when the source still holds the exact
// value the correction was written against: a correction never applies to data it
// was not checked on. Every correction must find its pack, and nothing else
// changes. Aggregates are then re-summed from the corrected products by the
// staging script, so the release stays one reconciled whole.
//
// The corrections themselves are private (they name packs of the release) and live
// beside the staging data. This module holds the rule only. Import-free, so
// tests/private-pillar-ddd-corrections.test.mjs can load it directly.

export type DddCorrection = {
  aic: string;
  /** The source DDD_AIC this correction was checked against. */
  from: number;
  /** The independently derived DDD per pack that replaces it. */
  to: number;
  reason: string;
  evidence: string;
};

type Pack = { aic: string; DDD_AIC: number };

const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export function assertDddCorrections(corrections: readonly DddCorrection[]): void {
  const seen = new Set<string>();
  for (const c of corrections) {
    if (!/^[0-9]{9}$/.test(c.aic)) throw new Error("correction: AIC must be nine digits");
    if (seen.has(c.aic)) throw new Error(`correction: AIC ${c.aic} listed twice`);
    seen.add(c.aic);
    if (!positive(c.from) || !positive(c.to)) throw new Error(`correction ${c.aic}: values must be positive and finite`);
    if (c.from === c.to) throw new Error(`correction ${c.aic}: changes nothing`);
    if (!c.reason?.trim() || !c.evidence?.trim()) throw new Error(`correction ${c.aic}: reason and evidence are required`);
  }
}

/** The products with each correction applied, and how many rows each correction changed. */
export function applyDddCorrections<P extends Pack>(
  products: readonly P[],
  corrections: readonly DddCorrection[],
): { products: P[]; rowsChanged: Record<string, number> } {
  assertDddCorrections(corrections);
  const byAic = new Map(corrections.map((c) => [c.aic, c]));
  const rowsChanged: Record<string, number> = Object.fromEntries(corrections.map((c) => [c.aic, 0]));
  const out = products.map((p) => {
    const c = byAic.get(p.aic);
    if (!c) return p;
    if (Math.abs(p.DDD_AIC - c.from) > 1e-9) {
      throw new Error(`correction ${c.aic}: the source holds ${p.DDD_AIC}, not the ${c.from} it was checked against`);
    }
    rowsChanged[c.aic] += 1;
    return { ...p, DDD_AIC: c.to };
  });
  for (const [aic, n] of Object.entries(rowsChanged)) {
    if (n === 0) throw new Error(`correction ${aic}: no pack of the release has this AIC`);
  }
  return { products: out, rowsChanged };
}
