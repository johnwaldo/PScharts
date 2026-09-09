const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ACCURACY_TREND_TICKS,
  ACCURACY_TREND_WARP_POINTS,
  isValidWarpMap,
  warpPct,
} = require('../extension/dashboard-charts.js');

test('Accuracy Trend warp maps documented anchors exactly', () => {
  const expected = [[0, 0], [5, 0.30], [10, 0.45], [20, 0.62], [40, 0.84], [50, 0.90], [100, 1]];
  assert.deepEqual(ACCURACY_TREND_WARP_POINTS.map(point => [point.real, point.visual]), expected);
  expected.forEach(([raw, visual]) => assert.equal(warpPct(raw, ACCURACY_TREND_WARP_POINTS), visual));
  assert.deepEqual(ACCURACY_TREND_TICKS, [0, 1, 2, 5, 10, 20, 40, 50, 100]);
});

test('Accuracy Trend warp interpolates monotonically and preserves endpoints', () => {
  assert.equal(warpPct(2.5, ACCURACY_TREND_WARP_POINTS), 0.15);
  assert.equal(warpPct(30, ACCURACY_TREND_WARP_POINTS), 0.73);
  let prior = -1;
  for (let raw = 0; raw <= 100; raw++) {
    const visual = warpPct(raw, ACCURACY_TREND_WARP_POINTS);
    assert.ok(visual >= prior, `${raw}% must not move down the visual scale`);
    prior = visual;
  }
  assert.equal(warpPct(0, ACCURACY_TREND_WARP_POINTS), 0);
  assert.equal(warpPct(100, ACCURACY_TREND_WARP_POINTS), 1);
});

test('custom warps require complete strictly increasing raw and visual anchors', () => {
  assert.equal(isValidWarpMap(ACCURACY_TREND_WARP_POINTS, 0, 100), true);
  assert.equal(isValidWarpMap([{ real: 0, visual: 0 }, { real: 100, visual: 0.5 }], 0, 100), false);
  assert.equal(isValidWarpMap([{ real: 0, visual: 0 }, { real: 5, visual: 0.3 }, { real: 4, visual: 1 }], 0, 4), false);
});
