import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBiosimilarRows,
  commonPenetrationBasis,
  costPerMg,
  firstLocalDispensing,
  isLocallySubstitutable,
  measurableFacts,
  normalizationCoverage,
  normalizedVolumeMg,
  penetration,
  penetrationOn,
  spendOf,
} from "../lib/dashboard-review/biosimilar.ts";

// A fact carries thirty-odd columns and this module reads eight of them. The
// helper fills the rest so each fixture row states only what the test is about.
let nextId = 1;
function fact(overrides) {
  return {
    id: nextId++,
    source_record_id: `r${nextId}`,
    source_version_id: "v1",
    year: 2025,
    month: 1,
    region_code: "13",
    region_name: "Abruzzo",
    asl_code: "201",
    channel: "DD",
    aic: String(900000 + nextId),
    atc1: "L",
    atc2: "L04",
    atc3: "L04A",
    atc4: "L04AB",
    atc5: "L04AB04",
    product_description_raw: null,
    brand_name: null,
    active_substance: "ALFAMAB",
    quantity_packs: 1,
    total_cost_eur: 0,
    biosimilar_flag: false,
    originator_flag: true,
    units_per_pack: null,
    strength_value_mg: null,
    volume_per_unit_ml: null,
    ddd_value_mg: null,
    unit_cost_eur: null,
    total_content_mg: null,
    ddds_per_pack: null,
    cost_per_mg: 1,
    cost_per_ddd: null,
    mapping_confidence: "Validated",
    quality_status: "ok",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const orig = (o) => fact({ biosimilar_flag: false, originator_flag: true, ...o });
const bio = (o) => fact({ biosimilar_flag: true, originator_flag: false, ...o });

const FACTS = [
  // ALFAMAB — the biosimilar opened in DECEMBER 2024, so the whole of 2025 is
  // inside the window. Establishes that first dispensing is read across years.
  orig({ active_substance: "ALFAMAB", year: 2024, month: 11, quantity_packs: 10, total_content_mg: 100, total_cost_eur: 10_000 }),
  bio({ active_substance: "ALFAMAB", year: 2024, month: 12, quantity_packs: 1, total_content_mg: 100, total_cost_eur: 600 }),
  orig({ active_substance: "ALFAMAB", month: 1, quantity_packs: 5, total_content_mg: 100, total_cost_eur: 5_000 }),
  orig({ active_substance: "ALFAMAB", month: 2, quantity_packs: 5, total_content_mg: 100, total_cost_eur: 4_500 }),
  bio({ active_substance: "ALFAMAB", month: 1, quantity_packs: 4, total_content_mg: 100, total_cost_eur: 2_400 }),
  bio({ active_substance: "ALFAMAB", month: 3, quantity_packs: 6, total_content_mg: 100, total_cost_eur: 3_000 }),

  // BETAMAB — the biosimilar opened in JULY 2025. Most of the originator spend
  // is before it and must not count. The two penetration denominators diverge.
  orig({ active_substance: "BETAMAB", month: 1, quantity_packs: 10, total_content_mg: 50, total_cost_eur: 5_000 }),
  orig({ active_substance: "BETAMAB", month: 2, quantity_packs: 10, total_content_mg: 50, total_cost_eur: 5_000 }),
  bio({ active_substance: "BETAMAB", month: 7, quantity_packs: 5, total_content_mg: 50, total_cost_eur: 1_000 }),
  orig({ active_substance: "BETAMAB", month: 8, quantity_packs: 4, total_content_mg: 50, total_cost_eur: 2_000 }),
  bio({ active_substance: "BETAMAB", month: 9, quantity_packs: 5, total_content_mg: 50, total_cost_eur: 1_000 }),

  // GAMMAMAB — the biosimilar costs MORE per mg.
  orig({ active_substance: "GAMMAMAB", month: 1, quantity_packs: 10, total_content_mg: 10, total_cost_eur: 500 }),
  bio({ active_substance: "GAMMAMAB", month: 1, quantity_packs: 10, total_content_mg: 10, total_cost_eur: 800 }),

  // EPSILONMAB — the originator carries no strength, so its mg are unknown.
  orig({ active_substance: "EPSILONMAB", month: 1, quantity_packs: 10, total_content_mg: null, total_cost_eur: 5_000, cost_per_mg: null }),
  bio({ active_substance: "EPSILONMAB", month: 1, quantity_packs: 5, total_content_mg: 10, total_cost_eur: 200, cost_per_mg: 4 }),

  // ZETAMAB — the biosimilar fact has NO month. Treated as December, so the
  // window opens after the June originator fact rather than before it.
  bio({ active_substance: "ZETAMAB", month: null, quantity_packs: 1, total_content_mg: 10, total_cost_eur: 100 }),
  orig({ active_substance: "ZETAMAB", month: 6, quantity_packs: 10, total_content_mg: 10, total_cost_eur: 1_000 }),

  // ETAMAB — the ORIGINATOR fact has no month. Treated as January, so it falls
  // before the June window and is excluded. Conservative in the other direction.
  bio({ active_substance: "ETAMAB", month: 6, quantity_packs: 5, total_content_mg: 10, total_cost_eur: 200 }),
  orig({ active_substance: "ETAMAB", month: null, quantity_packs: 10, total_content_mg: 10, total_cost_eur: 1_000 }),

  // DELTAMAB — originator only, no biosimilar anywhere.
  orig({ active_substance: "DELTAMAB", month: 1, quantity_packs: 10, total_content_mg: 10, total_cost_eur: 900 }),
];

const OPTIONS = { classifyArea: () => ({ label: "Test", status: "supported_by_atc" }) };
const ROWS = buildBiosimilarRows(FACTS, 2025, OPTIONS);
const byName = (name) => ROWS.find((row) => row.active_substance === name);

const close = (actual, expected, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) < tol,
    `expected ${expected}, got ${actual} (tolerance ${tol})`,
  );

// --- the window -------------------------------------------------------------

test("first local dispensing is read across every year, not just the reported one", () => {
  const opened = firstLocalDispensing(FACTS);
  // December 2024, from a fact outside the reported year.
  assert.equal(opened.get("ALFAMAB"), 2024 * 12 + 12);
  assert.equal(opened.get("BETAMAB"), 2025 * 12 + 7);
  // A molecule with no biosimilar anywhere never opens a window.
  assert.equal(opened.get("DELTAMAB"), undefined);
});

test("a month-less fact spans its whole year, on both sides of the comparison", () => {
  const opened = firstLocalDispensing(FACTS);
  // ZETAMAB's only biosimilar fact carries no month, so it could have been
  // dispensed as early as January. The window opens there, not in December.
  assert.equal(opened.get("ZETAMAB"), 2025 * 12 + 1);
  const june = FACTS.find((f) => f.active_substance === "ZETAMAB" && f.month === 6);
  assert.equal(isLocallySubstitutable(june, opened), true);

  // And a month-less fact is tested by the LATEST month it could occupy, so it is
  // not excluded from a window that opened earlier in the same year.
  const monthless = FACTS.find((f) => f.active_substance === "ETAMAB" && f.month === null);
  assert.equal(opened.get("ETAMAB"), 2025 * 12 + 6);
  assert.equal(isLocallySubstitutable(monthless, opened), true);
});

test("a month-less biosimilar row cannot be dropped from its own window, which would cherry-pick the price", () => {
  // The rule this replaced read a missing month as December when opening the
  // window and as January when testing membership. A month-less biosimilar row
  // was therefore excluded from the window it had helped open — and dropping an
  // EXPENSIVE biosimilar row lowers the measured biosimilar cost per mg, which
  // RAISES the differential and the headroom. An upper bound must not drift that way.
  const facts = [
    orig({ active_substance: "OMEGAMAB", month: 3, quantity_packs: 100, total_content_mg: 100, total_cost_eur: 100_000 }),
    bio({ active_substance: "OMEGAMAB", month: 2, quantity_packs: 100, total_content_mg: 100, total_cost_eur: 50_000 }),
    bio({ active_substance: "OMEGAMAB", month: null, quantity_packs: 100, total_content_mg: 100, total_cost_eur: 90_000 }),
  ];
  const [row] = buildBiosimilarRows(facts, 2025, OPTIONS);
  // Both biosimilar rows count: (50.000 + 90.000) / 20.000 mg = 7,00/mg, blended.
  close(row.biosimilar_cost_per_mg, 7);
  close(row.originator_cost_per_mg, 10);
  close(row.substitution_headroom_eur, 100_000 * (1 - 7 / 10));
  close(row.substitution_headroom_eur, 30_000, 1e-6);
  // The discarded rule saw only the cheap row (5,00/mg) and returned 50.000.
  assert.ok(row.substitution_headroom_eur < 50_000);
});

test("year-granularity data still opens a window instead of collapsing to zero", () => {
  // A tenant whose extract carries no month column at all. Under the previous
  // rule the opening registered at December and every same-year fact was retested
  // at January, so the window excluded everything — including the fact that
  // opened it — and the whole comparison silently reported zero.
  const annual = [
    orig({ active_substance: "ANNUALMAB", month: null, quantity_packs: 100, total_content_mg: 100, total_cost_eur: 100_000 }),
    bio({ active_substance: "ANNUALMAB", month: null, quantity_packs: 100, total_content_mg: 100, total_cost_eur: 60_000 }),
  ];
  const [row] = buildBiosimilarRows(annual, 2025, OPTIONS);
  close(row.substitutable_originator_spend_eur, 100_000);
  close(row.headroom_base_eur, 100_000);
  close(row.originator_cost_per_mg, 10);
  close(row.biosimilar_cost_per_mg, 6);
  close(row.substitution_headroom_eur, 40_000);
  assert.equal(row.evidence_status, "ready");
});

test("an out-of-range month is treated as absent, never trusted arithmetically", () => {
  // month 0 would alias December of the PREVIOUS year through year*12 + 0 and
  // open the window a year early.
  const opened = firstLocalDispensing([
    bio({ active_substance: "BADMONTH", month: 0, quantity_packs: 1, total_content_mg: 10, total_cost_eur: 100 }),
  ]);
  assert.equal(opened.get("BADMONTH"), 2025 * 12 + 1);
  assert.ok(opened.get("BADMONTH") > 2024 * 12 + 12);

  for (const bad of [13, -1, 1.5, NaN]) {
    const m = firstLocalDispensing([
      bio({ active_substance: "X", month: bad, quantity_packs: 1, total_content_mg: 10, total_cost_eur: 100 }),
    ]);
    assert.equal(m.get("X"), 2025 * 12 + 1, `month ${bad} should be read as absent`);
  }
});

test("a credit note cannot make the funnel run backwards", () => {
  // Negative total_cost_eur is real in this data. It reduces originator spend but
  // is excluded from the measurable set (which requires positive spend), so
  // without a floor the measurable base could exceed the window, the window could
  // exceed the molecule's own spend, and comparable_share could pass 1.
  const withCredit = [
    bio({ active_substance: "SIGMAMAB", month: 1, quantity_packs: 100, total_content_mg: 100, total_cost_eur: 40_000 }),
    orig({ active_substance: "SIGMAMAB", month: 2, quantity_packs: 100, total_content_mg: 100, total_cost_eur: 100_000 }),
    orig({ active_substance: "SIGMAMAB", month: 5, quantity_packs: null, total_content_mg: null, total_cost_eur: -80_000 }),
  ];
  const [row] = buildBiosimilarRows(withCredit, 2025, OPTIONS);
  close(row.originator_spend_eur, 20_000);
  assert.ok(row.headroom_base_eur <= row.substitutable_originator_spend_eur);
  assert.ok(row.substitutable_originator_spend_eur <= Math.max(0, row.originator_spend_eur));
  assert.ok(row.substitution_headroom_eur <= row.headroom_base_eur);
  assert.ok(row.comparable_share === null || (row.comparable_share >= 0 && row.comparable_share <= 1));
});

test("a molecule whose net originator spend is negative claims no headroom", () => {
  const netNegative = [
    bio({ active_substance: "NEGMAB", month: 1, quantity_packs: 10, total_content_mg: 100, total_cost_eur: 4_000 }),
    orig({ active_substance: "NEGMAB", month: 2, quantity_packs: 10, total_content_mg: 100, total_cost_eur: 10_000 }),
    orig({ active_substance: "NEGMAB", month: 3, quantity_packs: null, total_content_mg: null, total_cost_eur: -30_000 }),
  ];
  const [row] = buildBiosimilarRows(netNegative, 2025, OPTIONS);
  assert.ok(row.originator_spend_eur < 0);
  assert.equal(row.substitutable_originator_spend_eur, 0);
  assert.equal(row.headroom_base_eur, 0);
  assert.equal(row.substitution_headroom_eur, 0);
});

test("the originator rate is measured on the window, so a post-entry price cut is not backdated", () => {
  // The originator was dear before the biosimilar arrived and cheap after. Only
  // the in-window price may set the differential; using the whole year's blended
  // price would overstate the originator rate and inflate the headroom.
  const priceCut = [
    orig({ active_substance: "CUTMAB", month: 1, quantity_packs: 100, total_content_mg: 100, total_cost_eur: 200_000 }),
    bio({ active_substance: "CUTMAB", month: 7, quantity_packs: 100, total_content_mg: 100, total_cost_eur: 40_000 }),
    orig({ active_substance: "CUTMAB", month: 8, quantity_packs: 100, total_content_mg: 100, total_cost_eur: 60_000 }),
  ];
  const [row] = buildBiosimilarRows(priceCut, 2025, OPTIONS);
  close(row.originator_cost_per_mg, 6); // the in-window month 8 price, not 13,00 blended
  close(row.biosimilar_cost_per_mg, 4);
  close(row.headroom_base_eur, 60_000);
  close(row.substitution_headroom_eur, 60_000 * (1 - 4 / 6));
  close(row.substitution_headroom_eur, 20_000, 1e-6);
});

test("the window penetration carries its own basis, which need not match the all-months one", () => {
  // The unnormalised originator row sits OUTSIDE the window, so all months are
  // mg-incomplete while the window is mg-complete. Publishing both figures under
  // one basis label mislabelled the second.
  const split = [
    orig({ active_substance: "SPLITMAB", month: 1, quantity_packs: 10, total_content_mg: null, total_cost_eur: 5_000 }),
    bio({ active_substance: "SPLITMAB", month: 6, quantity_packs: 10, total_content_mg: 100, total_cost_eur: 2_000 }),
    orig({ active_substance: "SPLITMAB", month: 7, quantity_packs: 10, total_content_mg: 100, total_cost_eur: 6_000 }),
  ];
  const [row] = buildBiosimilarRows(split, 2025, OPTIONS);
  assert.equal(row.penetration_basis, "packs");
  assert.equal(row.penetration_locally_substitutable_basis, "mg");
  assert.notEqual(row.penetration_basis, row.penetration_locally_substitutable_basis);
});

test("the cross-year window is exercised THROUGH buildBiosimilarRows, not only by a direct call", () => {
  // The regression this guards already shipped once: passing a year-filtered set
  // hides every earlier year's first dispensing. Testing firstLocalDispensing
  // directly cannot catch it, because the bug is in what the caller passes.
  // GAPMAB makes it visible: its biosimilar was dispensed in 2024 and again only
  // in NOVEMBER 2025, so a year-filtered call opens the window in November and
  // discards ten months of originator spend.
  const gap = [
    bio({ active_substance: "GAPMAB", year: 2024, month: 3, quantity_packs: 10, total_content_mg: 100, total_cost_eur: 4_000 }),
    orig({ active_substance: "GAPMAB", month: 2, quantity_packs: 10, total_content_mg: 100, total_cost_eur: 10_000 }),
    bio({ active_substance: "GAPMAB", month: 11, quantity_packs: 10, total_content_mg: 100, total_cost_eur: 4_000 }),
  ];
  const [whole] = buildBiosimilarRows(gap, 2025, OPTIONS);
  const [filtered] = buildBiosimilarRows(gap.filter((f) => f.year === 2025), 2025, OPTIONS);
  close(whole.substitutable_originator_spend_eur, 10_000);
  close(filtered.substitutable_originator_spend_eur, 0);
  assert.ok(whole.substitution_headroom_eur > filtered.substitution_headroom_eur);
});

test("a biosimilar row with no packs and no spend does not open a window", () => {
  // Deleting this guard left the previous suite entirely green.
  const empty = [
    bio({ active_substance: "GHOSTMAB", month: 1, quantity_packs: 0, total_content_mg: null, total_cost_eur: 0 }),
    bio({ active_substance: "GHOSTMAB", month: 9, quantity_packs: 10, total_content_mg: 100, total_cost_eur: 3_000 }),
    orig({ active_substance: "GHOSTMAB", month: 5, quantity_packs: 10, total_content_mg: 100, total_cost_eur: 9_000 }),
  ];
  const opened = firstLocalDispensing(empty);
  assert.equal(opened.get("GHOSTMAB"), 2025 * 12 + 9, "the empty January row must not open the window");
  const [row] = buildBiosimilarRows(empty, 2025, OPTIONS);
  close(row.substitutable_originator_spend_eur, 0, 1e-9);
});

test("spend before the window is excluded from the base", () => {
  const beta = byName("BETAMAB");
  // 12.000 of originator spend, of which only the August 2.000 is inside.
  close(beta.originator_spend_eur, 12_000);
  close(beta.substitutable_originator_spend_eur, 2_000);
});

// --- cost per mg ------------------------------------------------------------

test("cost per mg takes numerator and denominator over the same rows", () => {
  const mixed = [
    orig({ quantity_packs: 10, total_content_mg: 10, total_cost_eur: 1_000 }), // 100 mg
    orig({ quantity_packs: 10, total_content_mg: null, total_cost_eur: 9_000 }), // no mg
  ];
  // Dividing total spend by normalised volume would give 10.000 / 100 = 100/mg,
  // inflated tenfold by the row that contributed no mg. Only the measured row counts.
  close(costPerMg(mixed), 10);
  assert.equal(measurableFacts(mixed).length, 1);
  close(normalizedVolumeMg(mixed), 100);
  close(spendOf(mixed), 10_000);
});

test("cost per mg is null, never imputed, when no row carries volume", () => {
  assert.equal(costPerMg([orig({ total_content_mg: null, total_cost_eur: 500, cost_per_mg: 7 })]), null);
  assert.equal(costPerMg([]), null);
});

// --- penetration ------------------------------------------------------------

test("penetration uses mg only when every compared row carries mg", () => {
  const alfa = byName("ALFAMAB");
  assert.equal(alfa.penetration_basis, "mg");
  close(alfa.biosimilar_penetration, 1_000 / 2_000);
});

test("an incomplete mg denominator falls back to packs instead of reading near-100%", () => {
  const eps = byName("EPSILONMAB");
  // On mg alone the originator has no volume, so the biosimilar would be the
  // whole denominator and penetration would read 100%. It is 5 of 15 packs.
  assert.equal(eps.penetration_basis, "packs");
  close(eps.biosimilar_penetration, 5 / 15);
});

test("a row with neither packs nor spend cannot veto a basis it could never satisfy", () => {
  const withEmpty = [
    orig({ quantity_packs: 10, total_content_mg: 10, total_cost_eur: 1_000 }),
    bio({ quantity_packs: 10, total_content_mg: 10, total_cost_eur: 400 }),
    bio({ quantity_packs: 0, total_content_mg: null, total_cost_eur: 0 }),
  ];
  const result = penetration(withEmpty);
  assert.equal(result.basis, "mg");
  close(result.value, 100 / 200);
});

test("the two penetration denominators are both reported and do diverge", () => {
  const beta = byName("BETAMAB");
  close(beta.biosimilar_penetration, 500 / 1_700);
  close(beta.penetration_locally_substitutable, 500 / 700);
  assert.ok(beta.penetration_locally_substitutable > beta.biosimilar_penetration);
});

test("penetration over an empty window is null, not zero", () => {
  // No window can open at all: the molecule's only biosimilar row records no
  // packs and no spend, so nothing was ever dispensed to switch to. Both sides of
  // the window are empty and the share is unknown rather than zero — zero would
  // assert the biosimilar was available and unused.
  const noWindow = [
    bio({ active_substance: "VOIDMAB", month: 4, quantity_packs: 0, total_content_mg: null, total_cost_eur: 0 }),
    orig({ active_substance: "VOIDMAB", month: 5, quantity_packs: 10, total_content_mg: 100, total_cost_eur: 9_000 }),
  ];
  const [row] = buildBiosimilarRows(noWindow, 2025, OPTIONS);
  assert.equal(row.penetration_locally_substitutable, null);
  assert.equal(row.penetration_locally_substitutable_basis, null);
  assert.equal(row.substitution_headroom_eur, 0);

  // ZETAMAB's month-less biosimilar now spans the year, so its window covers
  // everything and the two denominators coincide rather than one being null.
  const zeta = byName("ZETAMAB");
  close(zeta.biosimilar_penetration, 10 / 110);
  close(zeta.penetration_locally_substitutable, 10 / 110);
});

// --- the headroom -----------------------------------------------------------

test("headroom applies the differential to the measurable part of the window", () => {
  const alfa = byName("ALFAMAB");
  close(alfa.originator_cost_per_mg, 9.5);
  close(alfa.biosimilar_cost_per_mg, 5.4);
  close(alfa.headroom_base_eur, 9_500);
  close(alfa.substitution_headroom_eur, 9_500 * (1 - 5.4 / 9.5));
  close(alfa.substitution_headroom_eur, 4_100, 1e-6);
});

test("the base narrows twice, and the funnel is monotone", () => {
  for (const row of ROWS) {
    assert.ok(
      row.substitution_headroom_eur <= row.headroom_base_eur + 1e-9,
      `${row.active_substance}: headroom exceeds its own base`,
    );
    assert.ok(
      row.headroom_base_eur <= row.substitutable_originator_spend_eur + 1e-9,
      `${row.active_substance}: measurable base exceeds the window`,
    );
    assert.ok(
      row.substitutable_originator_spend_eur <= row.originator_spend_eur + 1e-9,
      `${row.active_substance}: window exceeds total originator spend`,
    );
  }
});

test("headroom is computed on the window, not on all of the molecule's spend", () => {
  const beta = byName("BETAMAB");
  close(beta.originator_cost_per_mg, 10);
  close(beta.biosimilar_cost_per_mg, 4);
  close(beta.substitution_headroom_eur, 2_000 * 0.6);
  // The discarded formula would have used all 12.000 and returned 7.200 — 6x.
  assert.ok(beta.substitution_headroom_eur < 12_000 * 0.6);
});

test("a dearer biosimilar yields zero headroom, never a negative one", () => {
  const gamma = byName("GAMMAMAB");
  close(gamma.originator_cost_per_mg, 5);
  close(gamma.biosimilar_cost_per_mg, 8);
  assert.equal(gamma.substitution_headroom_eur, 0);
  // The differential IS measurable — it simply does not favour substitution.
  assert.equal(gamma.evidence_status, "ready");
});

test("no measurable differential yields no headroom and says so", () => {
  const eps = byName("EPSILONMAB");
  assert.equal(eps.originator_cost_per_mg, null);
  assert.equal(eps.substitution_headroom_eur, 0);
  assert.equal(eps.headroom_base_eur, 0);
  assert.equal(eps.evidence_status, "partial");
  assert.match(eps.headroom_basis, /no measurable differential/);
});

test("every row declares itself an upper bound", () => {
  assert.ok(ROWS.length > 0);
  for (const row of ROWS) {
    assert.equal(row.headroom_is_upper_bound, true);
    assert.ok(row.headroom_basis.length > 0);
  }
});

// --- shape ------------------------------------------------------------------

test("a molecule with no biosimilar is not a comparison and is omitted", () => {
  assert.equal(byName("DELTAMAB"), undefined);
});

test("rows are ordered by headroom, largest first", () => {
  assert.equal(ROWS[0].active_substance, "ALFAMAB");
  assert.equal(ROWS[1].active_substance, "BETAMAB");
  for (let i = 1; i < ROWS.length; i += 1) {
    assert.ok(ROWS[i - 1].substitution_headroom_eur >= ROWS[i].substitution_headroom_eur);
  }
});

test("comparable share reports how much cleared BOTH gates", () => {
  const beta = byName("BETAMAB");
  close(beta.comparable_share, 2_000 / 12_000);
  const eps = byName("EPSILONMAB");
  close(eps.comparable_share, 0);
});

test("normalization coverage is a row-count share of rows that carry spend", () => {
  const eps = byName("EPSILONMAB");
  // Two spending rows, one of which has a normalised per-unit cost.
  close(eps.normalization_coverage, 0.5);
  assert.equal(normalizationCoverage([]), null);
  assert.equal(normalizationCoverage([orig({ total_cost_eur: 0 })]), null);
});

test("a cohort shares one basis, so one ASL's data gap moves the whole column", () => {
  // Two ASLs with IDENTICAL physical dispensing. B has one extra biosimilar row
  // whose strength is missing. Choosing a basis per ASL put A on mg and B on
  // packs and set the two percentages side by side as though commensurable — an
  // apparent gap produced by a data gap, not by prescribing.
  const aslA = [
    orig({ quantity_packs: 1_000, total_content_mg: 10, total_cost_eur: 100_000 }),
    bio({ quantity_packs: 100, total_content_mg: 500, total_cost_eur: 40_000 }),
  ];
  const aslB = [
    ...aslA.map((f) => ({ ...f })),
    bio({ quantity_packs: 20, total_content_mg: null, total_cost_eur: 4_000 }),
  ];
  assert.equal(penetration(aslA).basis, "mg");
  assert.equal(penetration(aslB).basis, "packs");

  const cohort = commonPenetrationBasis([aslA, aslB]);
  assert.equal(cohort, "packs", "the finest basis complete for EVERY group");

  const a = penetrationOn(aslA, cohort);
  const b = penetrationOn(aslB, cohort);
  close(a, 100 / 1_100);
  close(b, 120 / 1_120);
  // On one basis the two are close, as identical dispensing should be. Per-group
  // bases put them 8x apart.
  assert.ok(Math.abs(a - b) < 0.02);
  const perGroup = [penetration(aslA).value, penetration(aslB).value];
  assert.ok(perGroup[0] / perGroup[1] > 5, "per-group bases really do diverge wildly");
});

test("a cohort of one, and an empty cohort, still behave", () => {
  const solo = [orig({ quantity_packs: 10, total_content_mg: 100, total_cost_eur: 1_000 }),
                bio({ quantity_packs: 10, total_content_mg: 100, total_cost_eur: 400 })];
  assert.equal(commonPenetrationBasis([solo]), "mg");
  assert.equal(commonPenetrationBasis([]), null);
  assert.equal(commonPenetrationBasis([[], []]), null);
  // A group with no usable measure never silently becomes zero.
  assert.equal(penetrationOn([], "mg"), null);
});

test("no year to report means no rows, not an empty-shaped row", () => {
  assert.deepEqual(buildBiosimilarRows(FACTS, null, OPTIONS), []);
  assert.deepEqual(buildBiosimilarRows(FACTS, 1999, OPTIONS), []);
});
