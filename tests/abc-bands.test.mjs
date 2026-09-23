import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
// Import the shipped module directly, as the other analytics tests do. Type-level
// defects are covered separately by `tsc --noEmit`; AGENTS.md forbids running a
// type-stripped copy of the source as a substitute for either.
import { assignAbcBands, bandOf, ABC_THRESHOLDS } from '../lib/analytics/abc-bands.ts';

test('the banding rule is the private workbook rule, and is stated as such', () => {
  // Prodotti!O6 =IF(ISNUMBER(N6),IF(N6<0.8,"A",IF(N6<0.95,"B","C")),"") where N6
  // is the PRECEDING cumulative share.
  assert.equal(ABC_THRESHOLDS.a, 0.8);
  assert.equal(ABC_THRESHOLDS.b, 0.95);
  assert.equal(bandOf(0), 'A');
  assert.equal(bandOf(0.7999), 'A');
  assert.equal(bandOf(0.8), 'B');
  assert.equal(bandOf(0.9499), 'B');
  assert.equal(bandOf(0.95), 'C');

  const source = fs.readFileSync(fileURLToPath(new URL('../lib/analytics/abc-bands.ts', import.meta.url)), 'utf8');
  assert.equal(/cum\s*<=\s*0\.8/.test(source), false, 'the inclusive-share rule must not come back');
});

test('the crossing item stays in the lower band', () => {
  // 79% then 21%: the second item carries the running total past 80%, but every
  // item ranked ahead of it summed to 0.79, so it belongs to band A. Under the
  // previous inclusive rule its cumulative share was 1.0 and it was banded C.
  const banded = assignAbcBands([{ k: 'first', v: 79 }, { k: 'second', v: 21 }], (i) => i.v, (i) => i.k);
  assert.deepEqual(banded.map((b) => b.band), ['A', 'A']);
  assert.ok(Math.abs(banded[1].precedingShare - 0.79) < 1e-12);
  assert.ok(Math.abs(banded[1].cumulativeShare - 1) < 1e-12);
});

test('bands, shares and ordering behave', () => {
  const items = [
    { k: 'a', v: 50 }, { k: 'b', v: 30 }, { k: 'c', v: 15 }, { k: 'd', v: 4 }, { k: 'e', v: 1 },
  ];
  const banded = assignAbcBands(items, (i) => i.v, (i) => i.k);
  assert.deepEqual(banded.map((b) => b.k), ['a', 'b', 'c', 'd', 'e']);
  // preceding shares: 0, .50, .80, .95, .99
  assert.deepEqual(banded.map((b) => b.band), ['A', 'A', 'B', 'C', 'C']);
  assert.ok(Math.abs(banded.reduce((s, b) => s + b.share, 0) - 1) < 1e-12);
  assert.ok(Math.abs(banded.at(-1).cumulativeShare - 1) < 1e-12);
  for (let i = 1; i < banded.length; i++) {
    assert.ok(banded[i].precedingShare >= banded[i - 1].precedingShare, 'preceding share is monotonic');
  }
});

test('ties order deterministically and non-positive values are excluded', () => {
  const forward = assignAbcBands([{ k: 'z', v: 10 }, { k: 'a', v: 10 }], (i) => i.v, (i) => i.k);
  const reverse = assignAbcBands([{ k: 'a', v: 10 }, { k: 'z', v: 10 }], (i) => i.v, (i) => i.k);
  assert.deepEqual(forward.map((b) => b.k), ['a', 'z']);
  assert.deepEqual(forward.map((b) => b.k), reverse.map((b) => b.k));

  // A zero or negative value is not a small item: it is excluded from the
  // ranking rather than banded C, so it never dilutes another item's share.
  const filtered = assignAbcBands([{ k: 'a', v: 5 }, { k: 'b', v: 0 }, { k: 'c', v: -3 }], (i) => i.v, (i) => i.k);
  assert.deepEqual(filtered.map((b) => b.k), ['a']);
  assert.deepEqual(assignAbcBands([{ k: 'a', v: 0 }], (i) => i.v, (i) => i.k), []);
});
