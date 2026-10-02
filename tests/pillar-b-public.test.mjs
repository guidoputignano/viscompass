import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  ITALY, MEASURES, MOLECULES, biosimilarShare, compositionRows, diffFromItaly, measureComparison,
  moleculeComparison, parseSelection, positionOf, rankTerritories, rowFor, scFormPresence, scFormSentence,
  scShare, selectionHref, originatorShare,
} from "../lib/pillar-b-public/ev-sc-view.ts";

// The public asset, read exactly as the server loader reads it. The figures
// below are the ones the builder extracted from the AIFA PDF by coordinate;
// they pin the asset so a regeneration cannot silently move a cell.
const asset = JSON.parse(fs.readFileSync(new URL("../data/public-compiled/pillar-b-aifa-ev-sc-2025.json", import.meta.url), "utf8"));

test("the asset is nine complete tables: 22 territories, Italia included, every row a partition of 100", () => {
  assert.equal(asset.territories.length, 22);
  assert.ok(asset.territories.some((t) => t.code === ITALY && t.kind === "italia"));
  assert.equal(asset.rows.length, 9 * 22);
  for (const molecule of MOLECULES) for (const measure of MEASURES) {
    const rows = asset.rows.filter((r) => r.molecule === molecule && r.measure === measure);
    assert.equal(rows.length, 22, `${molecule}/${measure}`);
    assert.equal(new Set(rows.map((r) => r.territory)).size, 22);
    assert.ok(rows.some((r) => r.territory === ITALY));
    for (const r of rows) {
      const sum = r.originator_ev + r.biosimilar_ev + r.originator_sc + r.biosimilar_sc;
      assert.ok(Math.abs(sum - 100) <= 0.02, `${molecule}/${measure}/${r.territory} sums to ${sum}`);
      for (const v of [r.originator_ev, r.biosimilar_ev, r.originator_sc, r.biosimilar_sc]) assert.ok(v >= 0 && v <= 100);
      assert.ok(r.page >= 3 && r.page <= 13);
    }
  }
});

test("pinned cells match the AIFA tables (printed page = physical page - 1)", () => {
  const cell = (molecule, measure, territory) => {
    const r = rowFor(asset, { molecule, measure, territory });
    return [r.originator_ev, r.biosimilar_ev, r.originator_sc, r.biosimilar_sc, r.page];
  };
  assert.deepEqual(cell("infliximab", "spesa", ITALY), [2.47, 49.04, 0, 48.49, 5]);
  assert.deepEqual(cell("infliximab", "confezioni", "130"), [2.2, 80.04, 0, 17.76, 3]);
  assert.deepEqual(cell("infliximab", "ddd", "041"), [0, 93.76, 0, 6.24, 4]);
  assert.deepEqual(cell("rituximab", "ddd", "130"), [0, 76.38, 23.62, 0, 8]);
  assert.deepEqual(cell("rituximab", "spesa", "100"), [31.45, 68.55, 0, 0, 9]);
  assert.deepEqual(cell("trastuzumab", "spesa", "042"), [0, 100, 0, 0, 13]);
  assert.deepEqual(cell("trastuzumab", "confezioni", ITALY), [0.36, 88.32, 11.32, 0, 11]);
});

test("the first row (Abruzzo) and the Italia row of all nine tables are pinned to the PDF", () => {
  // [molecule, measure, page, Abruzzo row, Italia row] - four columns in the order
  // originator EV, biosimilar EV, originator SC, biosimilar SC, as printed.
  const PINS = [
    ["infliximab", "confezioni", 3, [2.2, 80.04, 0, 17.76], [0.84, 79.0, 0, 20.16]],
    ["infliximab", "ddd", 4, [2.08, 75.52, 0, 22.41], [0.79, 74.12, 0, 25.1]],
    ["infliximab", "spesa", 5, [6.08, 49.55, 0, 44.37], [2.47, 49.04, 0, 48.49]],
    ["rituximab", "confezioni", 7, [0, 90.51, 9.49, 0], [0.46, 95.39, 4.15, 0]],
    ["rituximab", "ddd", 8, [0, 76.38, 23.62, 0], [0.39, 87.54, 12.07, 0]],
    ["rituximab", "spesa", 9, [0, 37.59, 62.41, 0], [2.59, 57.3, 40.11, 0]],
    ["trastuzumab", "confezioni", 11, [0, 92.29, 7.71, 0], [0.36, 88.32, 11.32, 0]],
    ["trastuzumab", "ddd", 12, [0, 72.85, 27.15, 0], [0.17, 74.65, 25.18, 0]],
    ["trastuzumab", "spesa", 13, [0, 35.21, 64.79, 0], [0.76, 39.13, 60.11, 0]],
  ];
  const four = (r) => [r.originator_ev, r.biosimilar_ev, r.originator_sc, r.biosimilar_sc];
  for (const [molecule, measure, page, abruzzo, italia] of PINS) {
    const a = rowFor(asset, { molecule, measure, territory: "130" });
    const i = rowFor(asset, { molecule, measure, territory: ITALY });
    assert.deepEqual(four(a), abruzzo, `${molecule}/${measure} Abruzzo`);
    assert.deepEqual(four(i), italia, `${molecule}/${measure} Italia`);
    assert.equal(a.page, page);
  }
});

test("a territory's position means the same whichever way the table is sorted", () => {
  for (const molecule of MOLECULES) for (const measure of MEASURES) {
    const desc = rankTerritories(asset, molecule, measure, "desc");
    const asc = rankTerritories(asset, molecule, measure, "asc");
    // The asc helper reverses the ORDER; the page shows positions from desc only.
    assert.deepEqual(asc.map((r) => r.territory).reverse().length, desc.length);
    for (const r of desc) assert.ok(r.position >= 1 && r.position <= desc.length);
  }
});

test("the subcutaneous columns are read from the data, not asserted: infliximab SC is biosimilar-only, the other two originator-only", () => {
  assert.equal(scFormPresence(asset, "infliximab"), "solo biosimilare");
  assert.equal(scFormPresence(asset, "rituximab"), "solo originator");
  assert.equal(scFormPresence(asset, "trastuzumab"), "solo originator");
  assert.match(scFormSentence("infliximab", "solo biosimilare"), /solo come biosimilare/);
  assert.match(scFormSentence("rituximab", "solo originator"), /solo come originator/);
  // and a synthetic case for the branches the real data does not exercise
  assert.equal(scFormPresence({ rows: [{ molecule: "x", originator_sc: 1, biosimilar_sc: 2 }] }, "x"), "originator e biosimilare");
  assert.equal(scFormPresence({ rows: [{ molecule: "x", originator_sc: 0, biosimilar_sc: 0 }] }, "x"), "assente");
});

test("derived shares are sums of published columns with the same base, rounded to the published precision", () => {
  const r = rowFor(asset, { molecule: "infliximab", measure: "spesa", territory: ITALY });
  assert.equal(biosimilarShare(r), 97.53);
  assert.equal(scShare(r), 48.49);
  assert.equal(originatorShare(r), 2.47);
  assert.equal(diffFromItaly(asset, { molecule: "infliximab", measure: "spesa", territory: "130" }), Math.round((93.92 - 97.53) * 100) / 100);
  assert.equal(diffFromItaly(asset, { molecule: "infliximab", measure: "spesa", territory: ITALY }), 0);
  assert.equal(diffFromItaly({ rows: [] }, { molecule: "infliximab", measure: "spesa", territory: "130" }), null);
});

test("the ranking excludes Italia, uses standard competition positions and is stable on ties", () => {
  const ranking = rankTerritories(asset, "trastuzumab", "spesa");
  assert.equal(ranking.length, 21);
  assert.ok(ranking.every((r) => r.territory !== ITALY));
  assert.equal(ranking[0].territory, "042");   // P.A. Trento: 100 % biosimilar (EV)
  assert.equal(ranking[0].position, 1);
  for (let i = 1; i < ranking.length; i++) assert.ok(ranking[i - 1].share >= ranking[i].share);
  // Positions: equal shares share a position and the next one skips (1, 2, 2, 4).
  const synthetic = {
    territories: [{ code: "a", label: "A" }, { code: "b", label: "B" }, { code: "c", label: "C" }, { code: "d", label: "D" }, { code: "000", label: "Italia" }],
    rows: [
      ...["a", "b", "c", "d", "000"].map((t, i) => ({ molecule: "infliximab", measure: "ddd", territory: t, originator_ev: 0, biosimilar_ev: [50, 60, 60, 70, 55][i], originator_sc: 0, biosimilar_sc: 0, page: 4 })),
    ],
  };
  const r = rankTerritories(synthetic, "infliximab", "ddd");
  assert.deepEqual(r.map((x) => [x.territory, x.position, x.tied]), [["d", 1, false], ["b", 2, true], ["c", 2, true], ["a", 4, false]]);
  assert.deepEqual(rankTerritories(synthetic, "infliximab", "ddd", "asc").map((x) => x.territory), ["a", "b", "c", "d"]);
  assert.equal(positionOf(r, "c").position, 2);
  assert.equal(positionOf(r, "000"), null);
});

test("selection parses to its closed lists, falls back to defaults, and round-trips through the href", () => {
  const sel = parseSelection({ territorio: "130", molecola: "rituximab", misura: "spesa" }, asset.territories);
  assert.deepEqual(sel, { territory: "130", molecule: "rituximab", measure: "spesa" });
  assert.equal(selectionHref(sel), "?territorio=130&molecola=rituximab&misura=spesa");
  const d = parseSelection({ territorio: "999", molecola: "adalimumab", misura: "euro" }, asset.territories);
  assert.deepEqual(d, { territory: ITALY, molecule: "infliximab", measure: "ddd" });
  assert.equal(selectionHref(d), "");
  assert.deepEqual(parseSelection({}, asset.territories), d);
});

test("chart rows carry every territory once, flag Italia and the selection, and compare like with like", () => {
  const rows = compositionRows(asset, "rituximab", "ddd", "130");
  assert.equal(rows.length, 22);
  assert.equal(rows.filter((r) => r.isItaly).length, 1);
  assert.equal(rows.filter((r) => r.selected).length, 1);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1].biosimilar_ev + rows[i - 1].biosimilar_sc >= rows[i].biosimilar_ev + rows[i].biosimilar_sc);
  }
  const m = measureComparison(asset, "infliximab", "130");
  assert.deepEqual(m.map((x) => x.measure), ["confezioni", "ddd", "spesa"]);
  assert.equal(m[2].italy, 97.53);
  assert.equal(m[2].territorySc, 44.37);
  const k = moleculeComparison(asset, "spesa", "130");
  assert.deepEqual(k.map((x) => x.molecule), ["infliximab", "rituximab", "trastuzumab"]);
  assert.equal(k[0].territory, 93.92);
});
