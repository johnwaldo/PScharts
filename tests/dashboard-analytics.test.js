const assert = require('node:assert/strict');
const test = require('node:test');

function hitShares(hits) {
  const total = Object.values(hits).reduce((sum, value) => sum + value, 0);
  return total ? Object.fromEntries(Object.entries(hits).map(([key, value]) => [key, value / total * 100])) : null;
}

function latestEligible(records) {
  return records.filter(record => record.total > 0).sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
}

test('accuracy shares use valid reported-hit denominators and reject zero totals', () => {
  assert.deepEqual(hitShares({ a: 8, c: 1, m: 1 }), { a: 80, c: 10, m: 10 });
  assert.equal(hitShares({ a: 0, c: 0, m: 0 }), null);
});

test('Hit Zone retains the six newest eligible records after filtering', () => {
  const records = Array.from({ length: 8 }, (_, index) => ({ date: `2026-01-0${index + 1}`, total: index === 1 ? 0 : 10 }));
  assert.deepEqual(latestEligible(records).map(record => record.date), [
    '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
  ]);
});
