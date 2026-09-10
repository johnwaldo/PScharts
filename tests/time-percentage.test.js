const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

function timePct(stage) {
  if (stage.is_classifier === true) return null;
  const time = Number(stage.time), fastest = Number(stage.fastest_combined_time);
  if (!Number.isFinite(time) || time <= 0 || !Number.isFinite(fastest) || fastest <= 0) return null;
  return Math.min((fastest / time) * 100, 100);
}

function matchTimePct(stages) {
  const values = stages.map(timePct).filter(value => value != null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

test('Time % follows raw-time direction and caps values above 100', () => {
  assert.equal(timePct({ time: 20, fastest_combined_time: 10 }), 50);
  assert.equal(timePct({ time: 8, fastest_combined_time: 10 }), 100);
});

test('Time % excludes classifiers and invalid or missing times', () => {
  assert.equal(timePct({ is_classifier: true, time: 20, fastest_combined_time: 10 }), null);
  assert.equal(timePct({ time: 0, fastest_combined_time: 10 }), null);
  assert.equal(timePct({ time: 20 }), null);
});

test('match Time % averages usable stages and is unavailable with none', () => {
  assert.equal(matchTimePct([
    { time: 20, fastest_combined_time: 10 },
    { is_classifier: true, time: 10, fastest_combined_time: 5 },
    { time: 10, fastest_combined_time: 10 },
  ]), 75);
  assert.equal(matchTimePct([{ time: 0, fastest_combined_time: 10 }]), null);
});

test('Score Over Time defaults to independently visible performance series', () => {
  const html = fs.readFileSync('extension/dashboard.html', 'utf8');
  const script = fs.readFileSync('extension/dashboard.js', 'utf8');

  assert.match(html, /Division performance/);
  assert.match(html, /Adjusted %<\/span>/);
  assert.match(html, /Time % <small>\(experimental\)<\/small>/);
  assert.doesNotMatch(html, /Adjusted % Only|Time % Only/);
  assert.match(script, /let showDivisionPct\s*=\s*true/);
  assert.match(script, /let showAdjustedPct\s*=\s*true/);
  assert.match(script, /let showTimePct\s*=\s*true/);
  assert.match(script, /if \(showAdjustedPct\) \{/);
  assert.match(script, /if \(showTimePct\) \{/);
  assert.match(script, /selectedSeries\.push\(adjustedSeries\)/);
  assert.match(script, /selectedSeries\.push\(timeSeries\)/);
  assert.doesNotMatch(script, /adjustedOnly/);
});
