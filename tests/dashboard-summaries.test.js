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
vm.runInContext(`${source}; globalThis.performanceClassForTest = performanceClass;`, context);

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
