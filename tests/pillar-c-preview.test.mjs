import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREVIEW_FILTERS, PILLAR_C_PREVIEW_MODE, PORTFOLIOS,
  WORKBOOK_SECTIONS, buildPreview, canSeePillarCPreview,
  parsePreviewFilters, previewSearch,
} from "../lib/dashboard-review/pillar-c/preview.ts";

const filters = (patch = {}) => ({ ...DEFAULT_PREVIEW_FILTERS, ...patch });
const total = (rows, field) => rows.reduce((sum, row) => sum + row[field], 0);
const portfolioIds = ["all", ...PORTFOLIOS.map((p) => p.id)];

test("preview URL values use closed lists with complete, safe defaults", () => {
  assert.deepEqual(parsePreviewFilters(new URLSearchParams()), DEFAULT_PREVIEW_FILTERS);
  assert.deepEqual(parsePreviewFilters(new URLSearchParams({
    pc_anno: "2024", pc_canale: "DD", pc_portafoglio: "oncologia",
    pc_composizione: "share", pc_andamento: "cumulative", pc_budget: "deviation",
  })), filters({ year: "2024", channel: "DD", portfolio: "oncologia", composition: "share", trend: "cumulative", budget: "deviation" }));
  for (const invalid of ["", "real", "2026", "ALL", "<script>", "../admin"]) {
    const params = new URLSearchParams();
    for (const key of ["pc_anno", "pc_canale", "pc_portafoglio", "pc_composizione", "pc_andamento", "pc_budget"]) params.set(key, invalid);
    assert.deepEqual(parsePreviewFilters(params), DEFAULT_PREVIEW_FILTERS, invalid);
  }
  for (const portfolio of PORTFOLIOS) {
    assert.equal(parsePreviewFilters(new URLSearchParams({ pc_portafoglio: portfolio.id })).portfolio, portfolio.id);
  }
});

test("changing a global scope preserves panel choices and unrelated URL parameters", () => {
  const search = "?pc_anno=2024&pc_canale=DD&pc_composizione=share&pc_andamento=cumulative&pc_budget=deviation&other=one&other=two";
  const changed = new URLSearchParams(previewSearch(search, { channel: "DPC", portfolio: "neurologia" }));
  assert.deepEqual(parsePreviewFilters(changed), filters({ year: "2024", channel: "DPC", portfolio: "neurologia", composition: "share", trend: "cumulative", budget: "deviation" }));
  assert.deepEqual(changed.getAll("other"), ["one", "two"]);
  const localChanged = new URLSearchParams(previewSearch(changed.toString(), { composition: "amount" }));
  assert.equal(localChanged.has("pc_composizione"), false);
  assert.equal(localChanged.get("pc_portafoglio"), "neurologia");
  assert.equal(localChanged.get("pc_andamento"), "cumulative");
});

test("reset clears only preview choices, and returning to defaults produces a clean URL", () => {
  assert.equal(previewSearch("?pc_anno=2024&pc_canale=CO&pc_budget=deviation", {}, true), "");
  assert.equal(previewSearch("?pc_anno=2024&pc_canale=CO&other=keep", { year: "2024" }, true), "?other=keep");
  assert.equal(previewSearch("?pc_anno=2024", { year: "2025" }), "");
  assert.equal(previewSearch("?pc_anno=unknown&pc_andamento=bad&other=keep", {}), "?other=keep");
});

test("every supported combination survives URL serialization without mutating defaults", () => {
  const initial = structuredClone(DEFAULT_PREVIEW_FILTERS);
  for (const year of ["2024", "2025"]) for (const channel of ["all", "DD", "DPC", "CO"]) for (const portfolio of portfolioIds) {
    const expected = filters({ year, channel, portfolio, composition: "share", trend: "cumulative", budget: "deviation" });
    assert.deepEqual(parsePreviewFilters(new URLSearchParams(previewSearch("", expected))), expected);
  }
  assert.deepEqual(DEFAULT_PREVIEW_FILTERS, initial);
});

test("preview eligibility requires approval even for allowlisted reviewer/admin identities", () => {
  const cases = [
    [false, false, false, false], [false, false, true, false],
    [false, true, false, false], [false, true, true, false],
    [true, false, false, false], [true, false, true, true],
    [true, true, false, true], [true, true, true, true],
  ];
  for (const [approved, reviewer, admin, expected] of cases) assert.equal(canSeePillarCPreview(approved, reviewer, admin), expected);
});

test("fixture headlines and a narrowed example reconcile independently to explicit invented inputs", () => {
  const all = buildPreview(filters());
  assert.equal(PILLAR_C_PREVIEW_MODE, "synthetic");
  assert.equal(all.mode, "synthetic");
  assert.equal(all.previous, 8_750_000);
  assert.equal(all.current, 9_600_000);
  assert.equal(all.change, 850_000);
  assert.equal(all.amount, 9_600_000);
  assert.equal(buildPreview(filters({ year: "2024" })).amount, 8_750_000);
  const narrow = buildPreview(filters({ year: "2024", channel: "DPC", portfolio: "oncologia" }));
  assert.equal(narrow.mode, "synthetic");
  assert.equal(narrow.amount, 570_000);
  assert.equal(narrow.current, 684_000);
  assert.equal(narrow.change, 114_000);
  assert.equal(narrow.portfolios.length, 1);
  assert.equal(narrow.portfolios[0].budget, 660_000);
  assert.equal(narrow.portfolios[0].deviation, 24_000);
  assert.deepEqual(narrow.attribution.map((r) => [r.id, r.value]), [["S2", 421_800], ["S3", 108_300], ["S4", 28_500], ["S5", 11_400]]);
});

test("channels partition amounts, prior/current years, budgets and changes for every portfolio", () => {
  for (const year of ["2024", "2025"]) for (const portfolio of portfolioIds) {
    const all = buildPreview(filters({ year, portfolio }));
    const channels = ["DD", "DPC", "CO"].map((channel) => buildPreview(filters({ year, portfolio, channel })));
    for (const field of ["amount", "previous", "current", "change"]) assert.equal(total(channels, field), all[field], `${portfolio}/${year}/${field}`);
    assert.equal(channels.reduce((sum, c) => sum + total(c.portfolios, "budget"), 0), total(all.portfolios, "budget"));
    assert.equal(channels.reduce((sum, c) => sum + total(c.portfolios, "deviation"), 0), total(all.portfolios, "deviation"));
  }
});

test("monthly and cumulative views reconcile both years across every filter scope", () => {
  for (const year of ["2024", "2025"]) for (const channel of ["all", "DD", "DPC", "CO"]) for (const portfolio of portfolioIds) {
    const monthly = buildPreview(filters({ year, channel, portfolio }));
    const cumulative = buildPreview(filters({ year, channel, portfolio, trend: "cumulative" }));
    assert.equal(monthly.months.length, 12);
    assert.deepEqual(monthly.months.map((r) => r.month), ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]);
    for (const field of ["previous", "current"]) {
      assert.equal(total(monthly.months, field), monthly[field]);
      let running = 0;
      monthly.months.forEach((row, i) => {
        assert.equal(Number.isSafeInteger(row[field]), true);
        assert.ok(row[field] > 0);
        running += row[field];
        assert.equal(cumulative.months[i][field], running);
      });
      assert.equal(cumulative.months.at(-1)[field], monthly[field]);
    }
    assert.equal(monthly.mode, "synthetic");
    assert.equal(cumulative.mode, "synthetic");
  }
  const monthly = buildPreview(filters({ portfolio: "oncologia" }));
  assert.deepEqual(monthly.months.map((r) => r.current), [307_800, 273_600, 307_800, 273_600, 307_800, 273_600, 307_800, 205_200, 273_600, 307_800, 273_600, 307_800]);
});

test("every attribution slice remains explicit and exhausts the selected synthetic amount", () => {
  for (const year of ["2024", "2025"]) for (const channel of ["all", "DD", "DPC", "CO"]) for (const portfolio of portfolioIds) {
    const model = buildPreview(filters({ year, channel, portfolio }));
    assert.deepEqual(model.attribution.map((a) => a.id), ["S2", "S3", "S4", "S5"]);
    assert.equal(total(model.attribution, "value"), model.amount);
    for (const slice of model.attribution) {
      assert.ok(slice.value > 0, `${portfolio}/${year}/${channel}/${slice.id}`);
      assert.equal(Number.isSafeInteger(slice.value), true);
    }
    assert.equal(model.attribution.find((a) => a.id === "S3").value, model.shared);
    assert.equal(model.sharedShare, model.shared / model.amount);
    assert.equal(total(model.portfolios, "amount"), model.amount);
    assert.equal(total(model.portfolios, "change"), model.change);
  }
});

test("ranking follows the selected-year amount, and model construction never edits fixtures", () => {
  const before = structuredClone(PORTFOLIOS);
  for (const year of ["2024", "2025"]) {
    const model = buildPreview(filters({ year }));
    assert.equal(model.portfolios.length, 6);
    assert.equal(new Set(model.portfolios.map((p) => p.id)).size, 6);
    assert.deepEqual(model.portfolios.map((p) => p.id), ["oncologia", "immunologia", "cardiometabolico", "neurologia", "antinfettivi", "altri"]);
    model.portfolios.forEach((p, index) => {
      assert.equal(p.amount, year === "2024" ? p.previous : p.current);
      if (index > 0) assert.ok(model.portfolios[index - 1].amount >= p.amount);
    });
    // Editing a returned object must not mutate the shared fixture or the next render.
    model.portfolios[0].amount = -1;
    assert.ok(buildPreview(filters({ year })).portfolios[0].amount > 0);
  }
  assert.deepEqual(PORTFOLIOS, before);
});

test("presentation toggles do not alter amounts, and comparison periods remain explicit in the model", () => {
  const scope = { channel: "CO", portfolio: "immunologia" };
  const current = buildPreview(filters(scope));
  assert.deepEqual(buildPreview(filters({ ...scope, composition: "share", budget: "deviation" })), current);
  const prior = buildPreview(filters({ ...scope, year: "2024" }));
  assert.notEqual(prior.amount, current.amount);
  assert.equal(prior.amount, current.previous);
  assert.equal(current.amount, current.current);
  assert.deepEqual(prior.months, current.months);
  assert.equal(prior.change, current.change);
  assert.equal(prior.portfolios[0].budget, current.portfolios[0].budget);
  assert.equal(prior.portfolios[0].deviation, current.portfolios[0].deviation);
});

test("six objective-led sections cover all 24 workbook sheets exactly once", () => {
  assert.equal(WORKBOOK_SECTIONS.length, 6);
  assert.deepEqual(WORKBOOK_SECTIONS.map((s) => s.id), ["portafogli", "attribuzione", "variazioni", "budget", "priorita", "fonti"]);
  assert.deepEqual(WORKBOOK_SECTIONS.map((s) => s.number), ["01", "02", "03", "04", "05", "06"]);
  const sheets = WORKBOOK_SECTIONS.flatMap((section) => section.sheets.split(" · ").flatMap((token) => {
    const match = /^(\d{2})(?:–(\d{2}))?$/.exec(token);
    assert.ok(match, `Invalid workbook sheet range: ${token}`);
    const first = Number(match[1]), last = Number(match[2] ?? match[1]);
    assert.ok(last >= first);
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }));
  assert.equal(sheets.length, 24);
  assert.deepEqual(sheets.sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => i));
});
