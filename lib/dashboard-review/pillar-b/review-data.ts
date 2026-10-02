// Shaping for the Pillar B review page.
//
// Every function here is PURE: RPC rows in, view model out. That is what makes
// each plotted value reconcilable against the frozen workbook without a browser
// — the harness calls these same functions on the same rows the page does.
//
// THREE THINGS THIS MODULE REFUSES TO PRODUCE, because the data does not support
// them and the page must not imply them:
//   - a package or quantity total of any kind
//   - an uptake figure detached from its withheld counterpart
//   - a saving, an opportunity, or any recoverable-money figure
// A fourth is enforced upstream: 2026 is not an offered year.

import { formatEur, formatNumber, formatPercent } from "@/lib/dashboard-review/format";
import type {
  FunnelStage, MoleculeSpendRow, SpendRow, UptakeWithWithheld,
} from "./rpc";

/**
 * The years this page may report.
 *
 * 2026 is absent deliberately and permanently for this release: five months
 * observed (January–May) and ZERO comparable-eligible rows. It cannot be a
 * reporting year and cannot be a comparison baseline. Declared here, in the pure
 * module, so a harness can assert it without constructing a database client.
 */
export const PILLAR_B_YEARS = [2024, 2025] as const;
export type PillarBYear = (typeof PILLAR_B_YEARS)[number];

export const CHANNEL_LABELS: Record<string, string> = {
  CO: "Consumi ospedalieri",
  DD: "Distribuzione diretta",
  DPC: "Distribuzione per conto",
};

export function channelLabel(code: string): string {
  return CHANNEL_LABELS[code] ?? code;
}

function sumSpend(rows: ReadonlyArray<{ spend_eur: number | null }>): number {
  let total = 0;
  for (const row of rows) total += row.spend_eur ?? 0;
  return total;
}

// ----------------------------------------------------------------- trends

export interface TrendRow {
  key: string;
  label: string;
  spend2024: number;
  spend2025: number;
  /** (2025 − 2024) / |2024|, or null when 2024 is zero: a change from nothing has no rate. */
  change: number | null;
  changeEur: number;
  rows2024: number;
  rows2025: number;
  /** Rows whose quantity basis is not `packages` — carried so coverage can be stated. */
  negativeRows: number;
}

function trend(
  keyed2024: Map<string, { spend: number; rows: number; negative: number }>,
  keyed2025: Map<string, { spend: number; rows: number; negative: number }>,
  label: (key: string) => string,
): TrendRow[] {
  const keys = new Set([...keyed2024.keys(), ...keyed2025.keys()]);
  return [...keys]
    .map((key) => {
      const a = keyed2024.get(key) ?? { spend: 0, rows: 0, negative: 0 };
      const b = keyed2025.get(key) ?? { spend: 0, rows: 0, negative: 0 };
      return {
        key,
        label: label(key),
        spend2024: a.spend,
        spend2025: b.spend,
        changeEur: b.spend - a.spend,
        // A percentage change off a zero base is not large, it is undefined.
        // Dividing by |2024| so a negative base does not flip the sign of the
        // rate relative to the euro movement shown beside it.
        change: a.spend === 0 ? null : (b.spend - a.spend) / Math.abs(a.spend),
        rows2024: a.rows,
        rows2025: b.rows,
        negativeRows: a.negative + b.negative,
      };
    })
    .sort((x, y) => y.spend2025 - x.spend2025);
}

function keyMolecules(rows: ReadonlyArray<MoleculeSpendRow>) {
  const map = new Map<string, { spend: number; rows: number; negative: number }>();
  for (const row of rows) {
    const cur = map.get(row.active_substance) ?? { spend: 0, rows: 0, negative: 0 };
    cur.spend += row.spend_eur ?? 0;
    cur.rows += row.rows_n;
    cur.negative += row.negative_rows;
    map.set(row.active_substance, cur);
  }
  return map;
}

function keyChannels(rows: ReadonlyArray<SpendRow>) {
  const map = new Map<string, { spend: number; rows: number; negative: number }>();
  for (const row of rows) {
    const cur = map.get(row.channel) ?? { spend: 0, rows: 0, negative: 0 };
    cur.spend += row.spend_eur ?? 0;
    cur.rows += row.rows_observed;
    cur.negative += row.negative_rows;
    map.set(row.channel, cur);
  }
  return map;
}

export function moleculeTrend(
  rows2024: ReadonlyArray<MoleculeSpendRow>,
  rows2025: ReadonlyArray<MoleculeSpendRow>,
): TrendRow[] {
  return trend(keyMolecules(rows2024), keyMolecules(rows2025), (k) => k);
}

export function channelTrend(
  rows2024: ReadonlyArray<SpendRow>,
  rows2025: ReadonlyArray<SpendRow>,
): TrendRow[] {
  return trend(keyChannels(rows2024), keyChannels(rows2025), channelLabel);
}

// ----------------------------------------------------- spend concentration

export interface ConcentrationRow {
  rank: number;
  label: string;
  spend_eur: number;
  /** Share of the net total. May exceed 100% — see `negativeMolecules`. */
  share: number;
  cumulativeShare: number;
}

export interface Concentration {
  rows: ConcentrationRow[];
  totalEur: number;
  /**
   * Molecules whose net spend for the year is NEGATIVE — credit notes and
   * returns exceeding purchases. They are part of the total, which is why a
   * cumulative share can pass 100% before returning to it. Surfaced rather than
   * clamped: clamping would make the table add up only by hiding a real figure.
   */
  negativeMolecules: number;
  /** Share held by the largest five, over the same net total; null when total is 0. */
  topFiveShare: number | null;
  moleculeCount: number;
}

/**
 * Spending concentration by molecule.
 *
 * The denominator is the NET total — the same number the trend view shows — not
 * the sum of positive molecules. Using the positive sum would make every share
 * look smaller and would not reconcile against the workbook total. Negative
 * molecules are counted and reported instead.
 */
export function concentration(rows: ReadonlyArray<MoleculeSpendRow>): Concentration {
  const byMolecule = keyMolecules(rows);
  const totalEur = [...byMolecule.values()].reduce((s, v) => s + v.spend, 0);
  const ordered = [...byMolecule.entries()]
    .map(([label, v]) => ({ label, spend_eur: v.spend }))
    .sort((a, b) => b.spend_eur - a.spend_eur);

  let running = 0;
  const out: ConcentrationRow[] = ordered.map((row, i) => {
    running += row.spend_eur;
    return {
      rank: i + 1,
      label: row.label,
      spend_eur: row.spend_eur,
      share: totalEur === 0 ? 0 : row.spend_eur / totalEur,
      cumulativeShare: totalEur === 0 ? 0 : running / totalEur,
    };
  });

  return {
    rows: out,
    totalEur,
    negativeMolecules: ordered.filter((r) => r.spend_eur < 0).length,
    topFiveShare: totalEur === 0
      ? null
      : ordered.slice(0, 5).reduce((s, r) => s + r.spend_eur, 0) / totalEur,
    moleculeCount: ordered.length,
  };
}

// ------------------------------------------------- volume-uptake coverage

/**
 * The coverage of the volume-uptake measure from its two published sums.
 *
 * THE IDENTITY. `pillar_b_uptake_scope` is every analytical perimeter row for
 * the year — the rows the measure CONSUMED plus the rows it WITHHELD. On the
 * live 2025 ledger: used €7.469.067,17 + withheld €28.747.938,98 = scope
 * €36.217.006,15, to the cent. So the withheld share is withheld ÷ scope, and
 * the used spend is scope − withheld.
 *
 * The first version of this computation divided by (scope + withheld) and
 * handed the whole scope to the chart as "used": the live card then read
 * "Utilizzata 54,8 % · €76.415.744" where the truth is 17,4 % · €13.267.183.
 * The measure's coverage was overstated three-fold. This helper is the single
 * place the share is formed, so that cannot recur by composing the sums twice.
 */
export function uptakeCoverage(
  scopeSpendEur: number | null, withheldSpendEur: number,
): { usedSpendEur: number | null; withheldShare: number | null } {
  if (scopeSpendEur === null) return { usedSpendEur: null, withheldShare: null };
  return {
    usedSpendEur: scopeSpendEur - withheldSpendEur,
    // A share of nothing is not 0 %. Credit notes make a negative scope
    // possible in principle; the chart clamps for layout and prints the value.
    withheldShare: scopeSpendEur === 0 ? null : withheldSpendEur / scopeSpendEur,
  };
}

// --------------------------------------------------------- coverage notices

export interface CoverageNotice {
  /** Short label for the badge. */
  label: string;
  /** The sentence shown to the reader. Italian: this is user-facing copy. */
  detail: string;
  tone: "warning" | "neutral";
}

/**
 * Every partial-coverage statement the page must make, derived from the data
 * rather than written into the JSX.
 *
 * Writing these in the components is how a caveat goes stale: the figure changes
 * and the sentence beside it does not. Each of these is computed from the same
 * rows the figure is.
 */
export function coverageNotices(
  spend: ReadonlyArray<SpendRow>,
  uptake: UptakeWithWithheld,
): CoverageNotice[] {
  const notices: CoverageNotice[] = [];

  const basisRows =
    spend.reduce((s, r) =>
      s + r.rows_basis_packages + r.rows_basis_units + r.rows_basis_mixed + r.rows_basis_unknown, 0);
  const unresolvedBasis = spend.reduce((s, r) => s + r.rows_basis_mixed + r.rows_basis_unknown, 0);
  if (unresolvedBasis > 0 && basisRows > 0) {
    notices.push({
      label: "Base quantità",
      tone: "warning",
      detail:
        `La base della quantità (confezioni o unità) non è risolta su ` +
        `${fmtPct(unresolvedBasis / basisRows)} dei record. Per questo nessun ` +
        `totale di confezioni è pubblicato: una somma fra basi diverse non ha unità.`,
    });
  }

  if (uptake.withheldShare !== null && uptake.withheldShare > 0) {
    // NAME THE BASE. "della spesa ammissibile" read as the release's
    // comparable-eligible spend, against which the withheld share is 7,88%.
    // The figure here has a different and much smaller denominator — the uptake
    // measure's own perimeter, used + trattenuta, for the reporting year alone —
    // against which it is far larger. Both are true; only one qualifies the
    // uptake figure beside it, and the sentence has to say which.
    notices.push({
      label: "Uptake parziale",
      tone: "warning",
      detail:
        `L'uptake è calcolato escludendo ${fmtPct(uptake.withheldShare)} della spesa ` +
        `nel perimetro della misura — cioè del totale «utilizzata + trattenuta» ` +
        `dell'anno di riferimento, non della spesa complessiva né di quella ` +
        `comparabile dell'intera release. In valore: ${fmtEur(uptake.withheldSpendEur)} su ` +
        `${formatNumber(uptake.withheldRows, 0)} record, trattenuti perché la base ` +
        `della quantità non è risolta. La percentuale di uptake NON si riferisce ` +
        `all'intera popolazione.`,
    });
  }

  const negatives = spend.reduce((s, r) => s + r.negative_rows, 0);
  if (negatives > 0) {
    notices.push({
      label: "Rettifiche negative",
      tone: "neutral",
      detail:
        `${formatNumber(negatives, 0)} record hanno costo negativo (note di ` +
        `credito e resi). Sono inclusi nei totali, non rimossi: per questo una quota ` +
        `cumulata può superare il 100% prima di tornarvi.`,
    });
  }

  return notices;
}

// Both delegate to the shared formatters, which pin useGrouping through
// itNumberFormat. Writing `toLocaleString("it-IT", ...)` here instead leaves
// minimumGroupingDigits at 2, so a four-digit value renders as "2026" on one
// side and "2.026" on the other and React reports a hydration mismatch. The
// drift guard in tests/it-number.test.mjs caught exactly that in this file.
const fmtPct = (value: number): string => formatPercent(value);
const fmtEur = (value: number): string => formatEur(value);

// ------------------------------------------------------------- funnel view

export interface FunnelRow extends FunnelStage {
  /** Rows at this stage as a share of stage 1; null when stage 1 has none. */
  shareOfObserved: number | null;
  /** Rows lost relative to the previous stage. */
  droppedRows: number;
}

/**
 * The evidence funnel, with each stage's loss made explicit.
 *
 * The RPC returns absolute counts per stage. A reader comparing "261.153" at the
 * top to a smaller number four rows down has to do the subtraction themselves,
 * and that is exactly the step at which an exclusion becomes invisible.
 */
export function funnelRows(stages: ReadonlyArray<FunnelStage>): FunnelRow[] {
  const ordered = [...stages].sort((a, b) => a.step - b.step);
  const observed = ordered[0]?.rows_n ?? 0;
  return ordered.map((stage, i) => ({
    ...stage,
    shareOfObserved: observed === 0 ? null : stage.rows_n / observed,
    droppedRows: i === 0 ? 0 : (ordered[i - 1].rows_n - stage.rows_n),
  }));
}

export { sumSpend };

// ------------------------------------------------ narrowing (page helpers)

/**
 * Narrow rows the caller already holds to one Azienda and a set of channels.
 * An empty channel list means every channel. Moved here from the page so the
 * headline totals, which decide between a figure and "nessun record", can be
 * tested.
 */
export function narrowRows<T extends { asl_code: string; channel: string }>(
  rows: ReadonlyArray<T>, channels: ReadonlyArray<string>, aslCode: string | null,
): T[] {
  return rows.filter((r) =>
    (aslCode === null || r.asl_code === aslCode)
    && (channels.length === 0 || channels.includes(r.channel)));
}

/**
 * Molecule rows as spend rows: under a molecule filter the spend totals and
 * the channel trend come from the molecule rows, which group by (substance,
 * Azienda, channel) over the same release rows and carry the same measures.
 * Both sum to the same ledger (evidence harness b39).
 */
export function spendLike(rows: ReadonlyArray<MoleculeSpendRow>): SpendRow[] {
  return rows.map((r) => ({
    asl_code: r.asl_code, channel: r.channel, rows_observed: r.rows_n, spend_eur: r.spend_eur,
    rows_basis_packages: r.rows_basis_packages, rows_basis_units: r.rows_basis_units,
    rows_basis_mixed: r.rows_basis_mixed, rows_basis_unknown: r.rows_basis_unknown,
    comparable_rows: r.comparable_rows, comparable_spend_eur: r.comparable_spend_eur,
    negative_rows: r.negative_rows,
  }));
}
