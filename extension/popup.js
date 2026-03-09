// popup.js

// ── DOM refs ──────────────────────────────────────────────────────────────────
const memberInput = document.getElementById('memberInput');
const fetchBtn    = document.getElementById('fetchBtn');
const statusEl    = document.getElementById('status');
const statsEl     = document.getElementById('stats');
const tabsEl      = document.getElementById('tabs');
const noDataEl    = document.getElementById('noData');
const debugLogEl  = document.getElementById('debugLog');

// ── Persist member number ─────────────────────────────────────────────────────
chrome.storage.local.get('memberNumber', ({ memberNumber }) => {
  if (memberNumber) memberInput.value = memberNumber;
});

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ── Fetch button ──────────────────────────────────────────────────────────────
fetchBtn.addEventListener('click', async () => {
  const memberNumber = memberInput.value.trim().toUpperCase();
  if (!memberNumber) { setStatus('Please enter a member number.', 'error'); return; }

  chrome.storage.local.set({ memberNumber });
  setStatus('Opening PractiScore tab…', '', true);
  fetchBtn.disabled = true;
  tabsEl.classList.remove('visible');
  statsEl.classList.remove('visible');
  noDataEl.style.display = 'none';
  debugLogEl.style.display = 'none';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'fetchScores',
      memberNumber,
    });

    if (!response.ok) throw new Error(response.error || 'Unknown error');

    const { results, log, debugUrl } = response.data;

    // Show debug log
    if (log && log.length) {
      debugLogEl.textContent = log.join('\n') + `\nPage: ${debugUrl}`;
      debugLogEl.style.display = 'block';
    }

    // Always show raw data for debugging
    document.getElementById('rawJson').textContent = JSON.stringify(results, null, 2);

    if (!results || results.length === 0) {
      noDataEl.style.display = 'block';
      setStatus('No score data found.', 'error');
      return;
    }

    renderAll(results);
    setStatus(`Loaded ${results.length} match result${results.length !== 1 ? 's' : ''}.`, 'success');

  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
    debugLogEl.textContent = err.stack || err.message;
    debugLogEl.style.display = 'block';
  } finally {
    fetchBtn.disabled = false;
  }
});

// ── Render everything ─────────────────────────────────────────────────────────
function renderAll(results) {
  // Sort by date where possible
  results.sort((a, b) => {
    const da = parseDate(a.date), db = parseDate(b.date);
    if (da && db) return da - db;
    return 0;
  });

  const pctData   = results.filter(r => r.overall_pct != null);
  const placeData = results.filter(r => r.place != null);

  // Stats
  if (pctData.length > 0) {
    const avg  = pctData.reduce((s, r) => s + r.overall_pct, 0) / pctData.length;
    const best = Math.max(...pctData.map(r => r.overall_pct));
    const divs = [...new Set(results.map(r => r.division).filter(Boolean))];

    document.getElementById('statMatches').textContent = results.length;
    document.getElementById('statAvg').textContent     = avg.toFixed(1) + '%';
    document.getElementById('statBest').textContent    = best.toFixed(1) + '%';
    document.getElementById('statDiv').textContent     = divs[0] || '—';

    statsEl.classList.add('visible');
  }

  tabsEl.classList.add('visible');

  // Charts
  drawLineChart(
    document.getElementById('chartTime'),
    pctData.map((r, i) => ({ x: i, y: r.overall_pct, label: r.match_name || `Match ${i+1}`, date: r.date })),
    { yLabel: 'Score %', yMin: 0, yMax: 100, color: '#4a9eff', trend: true }
  );

  drawHistogram(
    document.getElementById('chartDist'),
    pctData.map(r => r.overall_pct),
    { xLabel: 'Score %', yLabel: 'Matches', bins: 10, xMin: 0, xMax: 100, color: '#4a9eff' }
  );

  if (placeData.length > 0) {
    drawLineChart(
      document.getElementById('chartPlace'),
      placeData.map((r, i) => ({ x: i, y: r.place, label: r.match_name || `Match ${i+1}`, date: r.date })),
      { yLabel: 'Place', invertY: true, color: '#4caf50' }
    );
  } else {
    drawMessage(document.getElementById('chartPlace'), 'No placement data available.');
  }
}

// ── Status helper ─────────────────────────────────────────────────────────────
function setStatus(msg, type = '', loading = false) {
  statusEl.className = type;
  statusEl.innerHTML = loading
    ? `<div class="spinner"></div>${msg}`
    : msg;
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

// ═════════════════════════════════════════════════════════════════════════════
// Chart primitives (Canvas 2D — no external libs)
// ═════════════════════════════════════════════════════════════════════════════

const PAD = { top: 24, right: 16, bottom: 44, left: 48 };
const GRID_COLOR  = '#1e2130';
const AXIS_COLOR  = '#2a2d3a';
const TEXT_COLOR  = '#666';
const FONT        = '10px system-ui, sans-serif';

function chartArea(canvas) {
  return {
    x0: PAD.left,
    y0: PAD.top,
    w:  canvas.width  - PAD.left - PAD.right,
    h:  canvas.height - PAD.top  - PAD.bottom,
  };
}

function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── Line chart ────────────────────────────────────────────────────────────────
function drawLineChart(canvas, points, opts = {}) {
  if (!points.length) { drawMessage(canvas, 'No data.'); return; }

  const ctx  = canvas.getContext('2d');
  const area = chartArea(canvas);
  clearCanvas(ctx, canvas);

  const {
    yLabel = '', yMin, yMax,
    invertY = false,
    color = '#4a9eff',
    trend = false,
  } = opts;

  const xs = points.map((_, i) => i);
  const ys = points.map(p => p.y);
  const rawMin = yMin != null ? yMin : Math.min(...ys);
  const rawMax = yMax != null ? yMax : Math.max(...ys);
  const yRange = rawMax - rawMin || 1;

  const toCanvasX = i => area.x0 + (i / Math.max(xs.length - 1, 1)) * area.w;
  const toCanvasY = v => {
    const norm = (v - rawMin) / yRange;
    return invertY
      ? area.y0 + norm * area.h
      : area.y0 + (1 - norm) * area.h;
  };

  // Grid lines
  const yTicks = 5;
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let i = 0; i <= yTicks; i++) {
    const v   = rawMin + (yRange * i / yTicks);
    const cy  = toCanvasY(v);
    ctx.beginPath();
    ctx.moveTo(area.x0, cy);
    ctx.lineTo(area.x0 + area.w, cy);
    ctx.stroke();

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = FONT;
    ctx.textAlign = 'right';
    ctx.fillText(invertY ? (rawMax - v + rawMin).toFixed(0) : v.toFixed(0),
                 area.x0 - 5, cy + 3);
  }

  // Axes
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(area.x0, area.y0);
  ctx.lineTo(area.x0, area.y0 + area.h);
  ctx.lineTo(area.x0 + area.w, area.y0 + area.h);
  ctx.stroke();

  // Y label
  ctx.save();
  ctx.translate(10, area.y0 + area.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  // Trend line
  if (trend && points.length >= 3) {
    const n  = points.length;
    const sx = xs.reduce((a, v) => a + v, 0);
    const sy = ys.reduce((a, v) => a + v, 0);
    const sxy = xs.reduce((a, v, i) => a + v * ys[i], 0);
    const sx2 = xs.reduce((a, v) => a + v * v, 0);
    const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    const inter = (sy - slope * sx) / n;

    ctx.strokeStyle = 'rgba(255,152,0,0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(toCanvasX(0),      toCanvasY(inter));
    ctx.lineTo(toCanvasX(n - 1),  toCanvasY(slope * (n - 1) + inter));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const cx = toCanvasX(i), cy = toCanvasY(p.y);
    i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
  });
  ctx.stroke();

  // Points + hover tooltip area map (stored on canvas for later)
  const hitMap = [];
  points.forEach((p, i) => {
    const cx = toCanvasX(i), cy = toCanvasY(p.y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    hitMap.push({ cx, cy, label: p.label, value: p.y, date: p.date });
  });

  // X-axis labels (every Nth to avoid crowding)
  const step = Math.ceil(points.length / 8);
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = FONT;
  ctx.textAlign = 'center';
  points.forEach((p, i) => {
    if (i % step !== 0 && i !== points.length - 1) return;
    const cx = toCanvasX(i);
    const lbl = p.date ? p.date.split('/').slice(0, 2).join('/') : `#${i+1}`;
    ctx.fillText(lbl, cx, area.y0 + area.h + 14);
  });

  // Tooltip on mousemove
  canvas._hitMap = hitMap;
  canvas._area   = area;
  if (!canvas._tooltipBound) {
    canvas._tooltipBound = true;
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width  / rect.width);
      const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
      const hit = (canvas._hitMap || []).find(h => Math.hypot(h.cx - mx, h.cy - my) < 12);
      canvas.title = hit ? `${hit.label}\n${hit.value.toFixed(2)}%${hit.date ? '\n' + hit.date : ''}` : '';
    });
  }
}

// ── Histogram ─────────────────────────────────────────────────────────────────
function drawHistogram(canvas, values, opts = {}) {
  if (!values.length) { drawMessage(canvas, 'No data.'); return; }

  const ctx  = canvas.getContext('2d');
  const area = chartArea(canvas);
  clearCanvas(ctx, canvas);

  const { xLabel = '', yLabel = '', bins = 10, xMin = 0, xMax = 100, color = '#4a9eff' } = opts;

  const binWidth = (xMax - xMin) / bins;
  const counts   = Array(bins).fill(0);
  values.forEach(v => {
    const bi = Math.min(Math.floor((v - xMin) / binWidth), bins - 1);
    if (bi >= 0) counts[bi]++;
  });
  const maxCount = Math.max(...counts, 1);

  const toCanvasX = v => area.x0 + ((v - xMin) / (xMax - xMin)) * area.w;
  const toCanvasY = c => area.y0 + area.h - (c / maxCount) * area.h;
  const barW      = (area.w / bins) - 2;

  // Grid
  const yTicks = 4;
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let i = 0; i <= yTicks; i++) {
    const c  = (maxCount * i / yTicks);
    const cy = toCanvasY(c);
    ctx.beginPath();
    ctx.moveTo(area.x0, cy);
    ctx.lineTo(area.x0 + area.w, cy);
    ctx.stroke();
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = FONT;
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(c), area.x0 - 5, cy + 3);
  }

  // Axes
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(area.x0, area.y0);
  ctx.lineTo(area.x0, area.y0 + area.h);
  ctx.lineTo(area.x0 + area.w, area.y0 + area.h);
  ctx.stroke();

  // Bars
  counts.forEach((c, bi) => {
    const bx = toCanvasX(xMin + bi * binWidth) + 1;
    const by = toCanvasY(c);
    const bh = area.y0 + area.h - by;
    ctx.fillStyle = color + 'cc';
    ctx.fillRect(bx, by, barW, bh);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, bh);
  });

  // Mean line
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const mx   = toCanvasX(mean);
  ctx.strokeStyle = '#ff9800';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(mx, area.y0);
  ctx.lineTo(mx, area.y0 + area.h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ff9800';
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.fillText(`avg ${mean.toFixed(1)}%`, mx, area.y0 - 6);

  // X ticks
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = FONT;
  ctx.textAlign = 'center';
  for (let i = 0; i <= bins; i += 2) {
    const v = xMin + i * binWidth;
    ctx.fillText(v.toFixed(0) + '%', toCanvasX(v), area.y0 + area.h + 14);
  }

  // Labels
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.fillText(xLabel, area.x0 + area.w / 2, area.y0 + area.h + 30);
}

// ── Empty state ───────────────────────────────────────────────────────────────
function drawMessage(canvas, msg) {
  const ctx = canvas.getContext('2d');
  clearCanvas(ctx, canvas);
  ctx.fillStyle = '#444';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
}
