// Private product-grain views: per-product ABC and the ATC5 molecule series.
//
// Bands are computed here rather than stored, and always within one
// (org_code, year) group. That matters for RLS: a regione viewer and an ASL
// viewer must see the same band for the same product. Banding across whatever
// the caller happens to be allowed to see would make a product's class depend on
// who is looking, which is not a property of the product.
import { assignAbcBands, type AbcBand } from "./abc-bands.ts";

export type PrivateProductFact = {
  release_id: string;
  org_code: string;
  year: number;
  /** 9-digit zero-padded string. Never a number: all 238 keys start with '0'. */
  aic: string;
  atc5: string;
  aware_category: "A" | "W" | "R";
  product_name: string;
  qmr: number;
  ddd_aic: number;
  cf: number;
  cn: number;
  cmr: number;
  ddd: number;
  source_hash: string;
};

export type ProductAbcRow = {
  org_code: string;
  year: number;
  aic: string;
  atc5: string;
  aware_category: "A" | "W" | "R";
  product_name: string;
  cf: number;
  ddd: number;
  share: number;
  precedingShare: number;
  cumulativeShare: number;
  band: AbcBand;
  rank: number;
};

const isFinitePositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Reject a row rather than band a product on a value we cannot trust. */
export function assertProductFacts(facts: readonly PrivateProductFact[]): void {
  for (const f of facts) {
    const at = `${f.org_code}/${f.year}/${f.aic}`;
    if (!/^\d{9}$/.test(f.aic)) throw new Error(`${at}: AIC must be 9 digits, zero-padded`);
    if (!/^[A-Z]\d{2}[A-Z]{2}\d{2}$/.test(f.atc5)) throw new Error(`${at}: malformed ATC5 ${f.atc5}`);
    if (!["A", "W", "R"].includes(f.aware_category)) throw new Error(`${at}: ${f.aware_category} is not an AWaRe class`);
    for (const field of ["cf", "cn", "cmr", "ddd", "qmr", "ddd_aic"] as const) {
      if (!isFinitePositive(f[field])) throw new Error(`${at}: ${field} is not a finite positive number`);
    }
    if (Math.abs(f.ddd - f.qmr * f.ddd_aic) > 1e-6) throw new Error(`${at}: ddd is not qmr x ddd_aic`);
  }
  const keys = new Set(facts.map((f) => `${f.release_id}|${f.org_code}|${f.year}|${f.aic}`));
  if (keys.size !== facts.length) throw new Error("duplicate (release, org, year, aic) rows");
}

/**
 * ABC by spend within each (org, year). Uses the shared preceding-cumulative
 * rule, so a product lands in the same band here, in the public ATC4 view and in
 * the workbook.
 */
export function productAbc(facts: readonly PrivateProductFact[]): ProductAbcRow[] {
  assertProductFacts(facts);
  const groups = new Map<string, PrivateProductFact[]>();
  for (const f of facts) {
    const key = `${f.org_code}|${f.year}`;
    const list = groups.get(key);
    if (list) list.push(f);
    else groups.set(key, [f]);
  }

  const out: ProductAbcRow[] = [];
  for (const [, group] of groups) {
    // AIC ascending is the documented tie-break; the source data happens to
    // contain no tied CF, so this is what keeps the order deterministic if a
    // later release does.
    const banded = assignAbcBands(group, (f) => f.cf, (f) => f.aic);
    banded.forEach((row, i) => {
      out.push({
        org_code: row.org_code,
        year: row.year,
        aic: row.aic,
        atc5: row.atc5,
        aware_category: row.aware_category,
        product_name: row.product_name,
        cf: row.cf,
        ddd: row.ddd,
        share: row.share,
        precedingShare: row.precedingShare,
        cumulativeShare: row.cumulativeShare,
        band: row.band,
        rank: i + 1,
      });
    });
  }
  return out.sort((a, b) => a.org_code.localeCompare(b.org_code) || a.year - b.year || a.rank - b.rank);
}

export type Atc5Point = {
  org_code: string;
  atc5: string;
  year: number;
  cf: number;
  ddd: number;
  /** Products contributing in this year. */
  products: number;
};

export type Atc5Series = {
  org_code: string;
  atc5: string;
  /** One entry per year in `years`; null where the molecule has no rows. */
  points: (Atc5Point | null)[];
  years: number[];
  /** True when the molecule is absent from at least one year in the window. */
  partial: boolean;
};

/**
 * Molecule-level time series per organization.
 *
 * A year in which a molecule has no rows is `null`, not zero. In this dataset
 * between 9 and 13 molecules per organization are missing from at least one
 * year, so collapsing absence to zero would draw a decline that the source does
 * not report. `partial` marks those series so a caller can label them.
 *
 * No AWaRe class is attached: ATC5 does not determine it. J01XX01 fosfomicina is
 * Watch as oral packs and Reserve as IV packs, so a molecule-level AWaRe label
 * would be wrong for one of them.
 */
export function atc5Series(facts: readonly PrivateProductFact[]): Atc5Series[] {
  assertProductFacts(facts);
  const years = [...new Set(facts.map((f) => f.year))].sort((a, b) => a - b);
  const byKey = new Map<string, Map<number, Atc5Point>>();

  for (const f of facts) {
    const key = `${f.org_code}|${f.atc5}`;
    let byYear = byKey.get(key);
    if (!byYear) byKey.set(key, (byYear = new Map()));
    const point = byYear.get(f.year);
    if (point) {
      point.cf += f.cf;
      point.ddd += f.ddd;
      point.products += 1;
    } else {
      byYear.set(f.year, { org_code: f.org_code, atc5: f.atc5, year: f.year, cf: f.cf, ddd: f.ddd, products: 1 });
    }
  }

  return [...byKey.entries()]
    .map(([key, byYear]) => {
      const [org_code, atc5] = key.split("|");
      const points = years.map((y) => byYear.get(y) ?? null);
      return { org_code, atc5, years, points, partial: points.some((p) => p === null) };
    })
    .sort((a, b) => a.org_code.localeCompare(b.org_code) || a.atc5.localeCompare(b.atc5));
}

/**
 * Reconcile product rows against the aggregate table they must sum to.
 *
 * The aggregate carries a regional 'T' row for an organization with no product
 * rows of its own; that absence is real and must not be filled with a zero, so
 * an organization missing from the product set is reported rather than counted
 * as reconciling.
 */
export function reconcileProductsToAggregate(
  facts: readonly PrivateProductFact[],
  aggregate: readonly { org_code: string; year: number; aware_category: string; cf: number; cmr: number; ddd: number }[],
  tolerance = 0.01,
): { ok: boolean; checked: number; problems: string[] } {
  const problems: string[] = [];
  const productOrgs = new Set(facts.map((f) => f.org_code));
  let checked = 0;

  for (const total of aggregate.filter((a) => a.aware_category === "T")) {
    if (!productOrgs.has(total.org_code)) {
      problems.push(`${total.org_code}/${total.year}: aggregate present but no product rows — absent, not zero`);
      continue;
    }
    const rows = facts.filter((f) => f.org_code === total.org_code && f.year === total.year);
    checked++;
    for (const field of ["cf", "cmr", "ddd"] as const) {
      const sum = rows.reduce((s, r) => s + r[field], 0);
      const want = total[field];
      if (Math.abs(sum - want) > tolerance) {
        problems.push(`${total.org_code}/${total.year} ${field}: products ${sum} vs aggregate ${want}`);
      }
    }
  }
  return { ok: problems.length === 0, checked, problems };
}
