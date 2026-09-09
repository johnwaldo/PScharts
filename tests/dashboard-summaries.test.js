const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'dashboard-summaries.js'), 'utf8');
const context = vm.createContext({
  Number, Math, String, Map, document: { getElementById: () => null },
  escHtml: value => String(value), leastSquaresRegression: () => null,
});
vm.runInContext(`${source};
  globalThis.performanceClassForTest = performanceClass;
  globalThis.classBadgeForTest = _classBadge;
  globalThis.placementTilesForTest = _placementTiles;
  globalThis.nonClassifierTilesForTest = _nonClassifierTiles;
`, context);

test('performance classes include every boundary and decimal value', () => {
  const classify = context.performanceClassForTest;
  assert.equal(classify(39.999).code, 'D');
  assert.equal(classify(40).code, 'C');
  assert.equal(classify(60).code, 'B');
  assert.equal(classify(75).code, 'A');
  assert.equal(classify(76.5).code, 'A');
  assert.equal(classify(85).code, 'M');
  assert.equal(classify(95).code, 'GM');
});

test('performance classes handle finite outliers and reject missing values', () => {
  const classify = context.performanceClassForTest;
  assert.equal(classify(-1).code, 'D');
  assert.equal(classify(101).code, 'GM');
  assert.equal(classify(null), null);
  assert.equal(classify(NaN), null);
  assert.equal(classify(Infinity), null);
});

test('performance badges distinguish unofficial equivalents from official classes', () => {
  const equivalent = context.classBadgeForTest(76.5);
  assert.match(equivalent, /aria-label="Approximately A Class, unofficial match-performance equivalent"/);
  assert.match(equivalent, /performance-badge__approx[^>]*>≈</);
  assert.match(equivalent, /performance-badge__code[^>]*>A</);
  assert.match(equivalent, /performance-badge__class[^>]*>Class</);

  const official = context.classBadgeForTest(96, 'classifier');
  assert.match(official, /aria-label="GM Class, official classifier percentage"/);
  assert.doesNotMatch(official, />≈</);
});

test('placement summaries add best and worst context without class badges', () => {
  const html = context.placementTilesForTest([
    { div_place: 1, div_total: 10 },
    { div_place: 5, div_total: 10 },
    { div_place: 2, div_total: 10 },
    { div_place: 4, div_total: 10 },
  ]).join('');

  assert.match(html, /Best placement/);
  assert.match(html, /90\.0%/);
  assert.match(html, /Worst placement/);
  assert.match(html, /50\.0%/);
  assert.doesNotMatch(html, /performance-badge/);
});

test('non-classifier summaries add badged finite best and worst values', () => {
  const html = context.nonClassifierTilesForTest([
    { y: 39 }, { y: 61 }, { y: 76 }, { y: 86 }, { y: NaN },
  ]).join('');

  assert.match(html, /Best stage performance/);
  assert.match(html, /86\.0%/);
  assert.match(html, /Worst stage performance/);
  assert.match(html, /39\.0%/);
  assert.match(html, /Approximately M Class, unofficial match-performance equivalent/);
  assert.match(html, /Approximately D Class, unofficial match-performance equivalent/);
});

test('missing placement and non-classifier values remain unavailable rather than zero', () => {
  const placement = context.placementTilesForTest([]).join('');
  const nonClassifier = context.nonClassifierTilesForTest([{ y: NaN }]).join('');
  assert.doesNotMatch(placement, />0\.0%</);
  assert.doesNotMatch(nonClassifier, />0\.0%</);
  assert.match(placement, /Not enough data/);
  assert.match(nonClassifier, /Not enough data/);
});
