// ═══════════════════════════════════════════════════════════════════════
//  dashboard.js — "nly" style: smooth line/area charts, monthly balance hero
//  Contiene: renderDashboard(), renderDashCharts(), dashState,
//  drawLineChart(), drawDonutChart(), getChartColors().
// ═══════════════════════════════════════════════════════════════════════

// ── DASHBOARD STATE ───────────────────────────────────────────
let dashState = {
  month: null,
  chartMonth: null,
  calMonth: null,
  periodType: 'month',
  accounts: null,
  visibleSections: { resumen: true, categorias: true, calendario: true, cuentas: true },
  donutMode: 'expense',
  lineChartInstance: null,
  donutChartInstance: null,
  topMode: 'expense',
  hiddenCats: (() => {
    try {
      const saved = JSON.parse(localStorage.getItem('wallet_hidden_cats'));
      return {
        expenses: new Set(saved?.expenses || ['Ajuste de saldo']),
        income: new Set(saved?.income || ['Ajuste de saldo']),
      };
    } catch { return { expenses: new Set(['Ajuste de saldo']), income: new Set(['Ajuste de saldo']) }; }
  })(),
};

function dashGetPeriod() {
  if (dashState.periodType === 'month') {
    const p = state.period;
    if (p && p.type !== 'all') {
      const range = getPeriodRange();
      if (range.start) {
        const d = new Date(range.start + 'T00:00:00');
        return { year: d.getFullYear(), month: d.getMonth(), range };
      }
      if (range.end) {
        const d = new Date(range.end + 'T00:00:00');
        return { year: d.getFullYear(), month: d.getMonth(), range };
      }
    }
    if (dashState.month) return { ...dashState.month, range: null };
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), range: null };
  }
  if (dashState.periodType === '3m') {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 2);
    start.setDate(1);
    return { year: end.getFullYear(), month: end.getMonth(), range: { start: toDateStr(start), end: null }, rangeLabel: 'Últimos 3 meses' };
  }
  if (dashState.periodType === '6m') {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    start.setDate(1);
    return { year: end.getFullYear(), month: end.getMonth(), range: { start: toDateStr(start), end: null }, rangeLabel: 'Últimos 6 meses' };
  }
  return { year: null, month: null, range: { start: null, end: null }, rangeLabel: 'Histórico' };
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dashGetTxForPeriod() {
  const period = dashGetPeriod();
  const excludedAccIds = new Set(state.accounts.filter(a => a.excluded).map(a => a.id));
  let txs;
  if (period.range && (period.range.start || period.range.end)) {
    txs = state.transactions.filter(tx => {
      if (isTxExcluded(tx)) return false;
      if (tx.split_parent_id) return false;
      if (excludedAccIds.has(tx.account_id)) return false;
      if (period.range.start && tx.date < period.range.start) return false;
      if (period.range.end && tx.date > period.range.end) return false;
      return true;
    });
  } else if (period.year != null) {
    txs = state.transactions.filter(tx => {
      if (tx.split_parent_id) return false;
      if (excludedAccIds.has(tx.account_id)) return false;
      const d = new Date(tx.date + 'T00:00:00');
      return !isTxExcluded(tx) && d.getMonth() === period.month && d.getFullYear() === period.year;
    });
  } else {
    txs = state.transactions.filter(tx => {
      if (tx.split_parent_id) return false;
      if (excludedAccIds.has(tx.account_id)) return false;
      return !isTxExcluded(tx);
    });
  }
  if (dashState.accounts !== null) {
    const accSet = new Set(dashState.accounts);
    txs = txs.filter(tx => accSet.has(tx.account_id));
  }
  return txs;
}

// Get transactions for the PREVIOUS period (for comparison)
function dashGetPrevTxForPeriod() {
  const period = dashGetPeriod();
  const excludedAccIds = new Set(state.accounts.filter(a => a.excluded).map(a => a.id));
  if (period.range && period.range.start) {
    const start = new Date(period.range.start + 'T00:00:00');
    const end = period.range.end ? new Date(period.range.end + 'T00:00:00') : new Date();
    const durationMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return state.transactions.filter(tx => {
      if (isTxExcluded(tx) || tx.split_parent_id) return false;
      if (excludedAccIds.has(tx.account_id)) return false;
      if (tx.date < toDateStr(prevStart)) return false;
      if (tx.date > toDateStr(prevEnd)) return false;
      return true;
    });
  }
  if (period.year != null && period.month != null) {
    let pm = period.month - 1, py = period.year;
    if (pm < 0) { pm = 11; py--; }
    return state.transactions.filter(tx => {
      if (tx.split_parent_id) return false;
      if (excludedAccIds.has(tx.account_id)) return false;
      const d = new Date(tx.date + 'T00:00:00');
      return !isTxExcluded(tx) && d.getMonth() === pm && d.getFullYear() === py;
    });
  }
  return [];
}

function dashPrevMonth() {
  if (dashState.periodType !== 'month') return;
  const p = dashGetPeriod();
  let m = p.month - 1, y = p.year;
  if (m < 0) { m = 11; y--; }
  dashState.month = { year: y, month: m };
  renderDashboard();
}

function dashNextMonth() {
  if (dashState.periodType !== 'month') return;
  const p = dashGetPeriod();
  let m = p.month + 1, y = p.year;
  if (m > 11) { m = 0; y++; }
  dashState.month = { year: y, month: m };
  renderDashboard();
}

function dashCalPrevMonth() {
  const p = dashGetCalMonth();
  let m = p.month - 1, y = p.year;
  if (m < 0) { m = 11; y--; }
  dashState.calMonth = { year: y, month: m };
  renderCalendarHeatmap();
}

function dashCalNextMonth() {
  const p = dashGetCalMonth();
  let m = p.month + 1, y = p.year;
  if (m > 11) { m = 0; y++; }
  dashState.calMonth = { year: y, month: m };
  renderCalendarHeatmap();
}

function dashGetCalMonth() {
  if (dashState.calMonth) return dashState.calMonth;
  const p = dashGetPeriod();
  if (p.year != null) return { year: p.year, month: p.month };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function dashSetPeriod(type) {
  dashState.periodType = type;
  if (type !== 'month') dashState.month = null;
  dashState.calMonth = null;
  renderDashboard();
}

function dashTogglePeriodDropdown() {
  const dd = document.getElementById('dash-period-dropdown');
  if (dd) dd.classList.toggle('open');
}

function dashClosePeriodDropdown() {
  const dd = document.getElementById('dash-period-dropdown');
  if (dd) dd.classList.remove('open');
}

// ── Section menu builder ─────────────────────────────────────
function dashBuildSectionMenu() {
  const menu = document.getElementById('dash-section-menu');
  if (!menu) return;
  menu.innerHTML = '';
  const sections = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'categorias', label: 'Categorías' },
    { id: 'calendario', label: 'Calendario' },
    { id: 'cuentas', label: 'Cuentas' },
  ];
  sections.forEach(s => {
    const label = document.createElement('label');
    label.className = 'dash-section-item';
    label.dataset.section = s.id;
    label.innerHTML = `<input type="checkbox" ${dashState.visibleSections[s.id] !== false ? 'checked' : ''} onchange="dashToggleSection('${s.id}')"><span>${s.label}</span>`;
    menu.appendChild(label);
  });
}

function dashToggleSection(name) {
  const checkbox = document.querySelector(`.dash-section-item[data-section="${name}"] input[type="checkbox"]`);
  if (checkbox) dashState.visibleSections[name] = checkbox.checked;
  else dashState.visibleSections[name] = !dashState.visibleSections[name];
  const el = document.getElementById('dash-section-' + name);
  if (el) el.classList.toggle('dash-hidden', !dashState.visibleSections[name]);
  setTimeout(() => renderDashCharts(), 10);
}

function dashToggleDropdown() {
  const dd = document.querySelector('.dash-section-dropdown');
  if (dd) dd.classList.toggle('open');
}

function dashCloseDropdown() {
  const dd = document.querySelector('.dash-section-dropdown');
  if (dd) dd.classList.remove('open');
}

// ── ACCOUNT FILTER (dashboard) ──────────────────────────────
function dashToggleAccDropdown() {
  const dd = document.getElementById('dash-acc-filter');
  if (dd) dd.classList.toggle('open');
}

function dashCloseAccDropdown() {
  const dd = document.getElementById('dash-acc-filter');
  if (dd) dd.classList.remove('open');
}

function dashSyncAccountsFromSidebar() {
  dashState.accounts = null;
  dashState.chartMonth = null;
  dashBuildAccMenu();
  dashUpdateAccLabel();
}

function dashBuildAccMenu() {
  const menu = document.getElementById('dash-acc-menu');
  if (!menu) return;
  menu.innerHTML = '';
  const isAll = !dashState.accounts;
  const selSet = new Set(dashState.accounts || []);

  const allItem = document.createElement('label');
  allItem.className = 'dash-acc-item';
  allItem.innerHTML = `<input type="checkbox" ${isAll ? 'checked' : ''} onchange="dashToggleAllAccounts()"><span>Todas las cuentas</span>`;
  menu.appendChild(allItem);

  const sep = document.createElement('div');
  sep.className = 'dash-acc-separator';
  menu.appendChild(sep);

  state.accounts.forEach(acc => {
    const checked = isAll || selSet.has(acc.id);
    const item = document.createElement('label');
    item.className = 'dash-acc-item';
    item.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} onchange="dashToggleAccountFilter('${acc.id}')"><span>${acc.name}</span>`;
    menu.appendChild(item);
  });
}

function dashUpdateAccLabel() {
  const label = document.getElementById('dash-acc-label');
  if (!label) return;
  if (!dashState.accounts) {
    label.textContent = 'Todas las cuentas';
  } else if (dashState.accounts.length === 0) {
    label.textContent = 'Sin cuentas';
  } else if (dashState.accounts.length === 1) {
    const acc = state.accounts.find(a => a.id === dashState.accounts[0]);
    label.textContent = acc ? acc.name : '1 cuenta';
  } else {
    label.textContent = dashState.accounts.length + ' cuentas';
  }
}

function dashToggleAllAccounts() {
  dashState.accounts = dashState.accounts ? null : [];
  dashBuildAccMenu();
  dashUpdateAccLabel();
  renderDashboard();
}

function dashToggleAccountFilter(accId) {
  if (!dashState.accounts) {
    dashState.accounts = state.accounts.map(a => a.id).filter(id => id !== accId);
  } else {
    const idx = dashState.accounts.indexOf(accId);
    if (idx === -1) {
      dashState.accounts.push(accId);
    } else {
      dashState.accounts.splice(idx, 1);
    }
    if (dashState.accounts.length === state.accounts.length) {
      dashState.accounts = null;
    }
  }
  dashBuildAccMenu();
  dashUpdateAccLabel();
  renderDashboard();
}

function dashToggleAccountSidebar(accId) {
  if (!dashState.accounts || dashState.accounts.length === 0) {
    dashState.accounts = [accId];
  } else if (dashState.accounts.length === 1 && dashState.accounts[0] === accId) {
    dashState.accounts = null;
  } else {
    const idx = dashState.accounts.indexOf(accId);
    if (idx === -1) {
      dashState.accounts.push(accId);
    } else {
      if (dashState.accounts.length <= 1) return;
      dashState.accounts.splice(idx, 1);
    }
    if (dashState.accounts.length === state.accounts.length) {
      dashState.accounts = null;
    }
  }
  state.selectedAccounts = dashState.accounts ? [...dashState.accounts] : [];
  dashBuildAccMenu();
  dashUpdateAccLabel();
  renderAll();
}

function dashToggleTop() {
  dashState.topMode = dashState.topMode === 'expense' ? 'income' : 'expense';
  renderDashboard();
}

function dashToggleCat(catName, mode) {
  const key = mode === 'income' ? 'income' : 'expenses';
  if (!dashState.hiddenCats[key]) dashState.hiddenCats[key] = new Set();
  if (dashState.hiddenCats[key].has(catName)) dashState.hiddenCats[key].delete(catName);
  else dashState.hiddenCats[key].add(catName);
  localStorage.setItem('wallet_hidden_cats', JSON.stringify({
    expenses: [...(dashState.hiddenCats.expenses || [])],
    income: [...(dashState.hiddenCats.income || [])],
  }));
  renderDashboard();
}

// ── Chart helpers (pure canvas, no dependencies) ──────────────

function destroyChart(instance) {
  if (instance && typeof instance.destroy === 'function') instance.destroy();
}

function getChartColors(n) {
  const palette = [
    '#e6b800','#8b5cf6','#e11d48','#22c55e','#3b82f6',
    '#f97316','#06b6d4','#a855f7','#14b8a6','#ef4444',
    '#6366f1','#84cc16','#f43f5e','#0ea5e9','#d946ef',
    '#10b981','#f59e0b','#6b7280','#be185d','#0891b2',
  ];
  return Array.from({ length: n }, (_, i) => palette[i % palette.length]);
}

function drawLineChart(canvas, labels, incomeData, expenseData, savingsData) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width, H = rect.height;
  const padL = 56, padR = 16, padT = 16, padB = 34;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = labels.length;
  if (n === 0) return;

  const isDark = document.documentElement.classList.contains('theme-dark');
  const textColor = isDark ? '#a1a1aa' : '#71717a';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const zeroLineColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)';
  const incomeColor = '#22c55e';
  const expenseColor = '#ef4444';
  const savingsColor = '#0284c7';
  const hoverBandColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  const allVals = [...incomeData, ...expenseData, ...(savingsData || [])];
  const dataMax = Math.max(...allVals.filter(v => v >= 0), 0);
  const dataMin = Math.min(...allVals.filter(v => v < 0), 0);
  const hasNegative = dataMin < 0;
  const yMax = dataMax > 0 ? dataMax * 1.12 : 100;
  const yMin = hasNegative ? dataMin * 1.12 : 0;
  const yRange = yMax - yMin;

  ctx.clearRect(0, 0, W, H);

  function valToY(val) {
    return padT + chartH - ((val - yMin) / yRange) * chartH;
  }
  function idxToX(i) {
    return padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  }

  const baselineY = valToY(0);

  function niceStep(range) {
    const rough = range / 5;
    if (rough <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    if (norm <= 1.5) return mag;
    if (norm <= 3.5) return 2 * mag;
    if (norm <= 7.5) return 5 * mag;
    return 10 * mag;
  }

  const step = niceStep(yRange);
  const gridStart = Math.ceil(yMin / step) * step;
  const gridVals = [];
  for (let v = gridStart; v <= yMax + step * 0.001; v += step) {
    gridVals.push(Math.round(v * 1e6) / 1e6);
  }

  gridVals.forEach(val => {
    const y = valToY(val);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = textColor;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const abs = Math.abs(val);
    const formatted = abs >= 10000 ? (abs / 1000).toFixed(0) + 'k' : abs >= 1000 ? (abs / 1000).toFixed(1) + 'k' : abs.toFixed(0);
    ctx.fillText(val < 0 ? '-' + formatted : formatted, padL - 8, y);
  });

  if (hasNegative) {
    ctx.beginPath();
    ctx.moveTo(padL, baselineY);
    ctx.lineTo(padL + chartW, baselineY);
    ctx.strokeStyle = zeroLineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.stroke();
  }

  function smoothCurve(points) {
    if (points.length === 0) return;
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 1) return;
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      return;
    }
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  function getPoints(data) {
    return data.map((val, i) => ({ x: idxToX(i), y: valToY(val) }));
  }

  function buildAreaPath(points) {
    if (points.length === 0) return;
    ctx.moveTo(points[0].x, baselineY);
    ctx.lineTo(points[0].x, points[0].y);
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? i : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    }
    ctx.lineTo(points[points.length - 1].x, baselineY);
    ctx.closePath();
  }

  const incomePoints = getPoints(incomeData);
  const expensePoints = getPoints(expenseData);
  const hasSavingsData = savingsData && savingsData.some(v => v !== 0);
  const savingsPoints = hasSavingsData ? getPoints(savingsData) : [];

  function fillArea(points, top, bot) {
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bot);
    ctx.fillStyle = grad;
    ctx.beginPath();
    buildAreaPath(points);
    ctx.fill();
  }

  fillArea(incomePoints, isDark ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.10)', isDark ? 'rgba(34,197,94,0.02)' : 'rgba(34,197,94,0.01)');
  fillArea(expensePoints, isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.10)', isDark ? 'rgba(239,68,68,0.02)' : 'rgba(239,68,68,0.01)');

  ctx.beginPath();
  smoothCurve(incomePoints);
  ctx.strokeStyle = incomeColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  smoothCurve(expensePoints);
  ctx.strokeStyle = expenseColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  if (savingsPoints.length > 1) {
    ctx.beginPath();
    smoothCurve(savingsPoints);
    ctx.strokeStyle = savingsColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  labels.forEach((label, i) => {
    const x = idxToX(i);
    ctx.fillStyle = textColor;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, padT + chartH + 10);
  });

  canvas._chartData = { labels, incomeData, expenseData, savingsData: savingsData || [] };
  canvas._chartLayout = {
    padL, padR, padT, padB, chartW, chartH, n,
    yMin, yMax, yRange, baselineY, isDark, hasNegative, zeroLineColor,
    incomeColor, expenseColor, savingsColor, hoverBandColor,
    hasSavings: savingsPoints.length > 1,
    incomePoints, expensePoints, savingsPoints
  };
  canvas._hoverIdx = -1;
  updateLineTooltip(canvas);
}

function updateLineTooltip(canvas) {
  const tooltip = document.getElementById('dash-line-tooltip');
  if (!tooltip) return;

  function findNearest(clientX) {
    const layout = canvas._chartLayout;
    if (!layout || layout.n === 0) return -1;
    const r = canvas.getBoundingClientRect();
    const mx = clientX - r.left;
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < layout.n; i++) {
      const x = layout.padL + (layout.n === 1 ? layout.chartW / 2 : (i / (layout.n - 1)) * layout.chartW);
      const d = Math.abs(mx - x);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return bestDist < 40 ? best : -1;
  }

  function drawHoverState(idx) {
    const layout = canvas._chartLayout;
    const data = canvas._chartData;
    if (!layout || !data) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    ctx.scale(dpr, dpr);

    const W = r.width, H = r.height;
    const { padL, padT, padB, chartW, chartH, n, yMin, yMax, yRange, baselineY, isDark } = layout;
    const textColor = isDark ? '#a1a1aa' : '#71717a';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const zeroLineColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)';

    ctx.clearRect(0, 0, W, H);

    function valToY(val) { return padT + chartH - ((val - yMin) / yRange) * chartH; }
    function idxToX(i) { return padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW); }
    function niceStep(range) {
      const rough = range / 5;
      if (rough <= 0) return 1;
      const mag = Math.pow(10, Math.floor(Math.log10(rough)));
      const norm = rough / mag;
      if (norm <= 1.5) return mag;
      if (norm <= 3.5) return 2 * mag;
      if (norm <= 7.5) return 5 * mag;
      return 10 * mag;
    }

    const step = niceStep(yRange);
    const gridStart = Math.ceil(yMin / step) * step;
    for (let v = gridStart; v <= yMax + step * 0.001; v += step) {
      const gv = Math.round(v * 1e6) / 1e6;
      const y = valToY(gv);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y);
      ctx.strokeStyle = gridColor; ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = textColor; ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const abs = Math.abs(gv);
      const f = abs >= 10000 ? (abs / 1000).toFixed(0) + 'k' : abs >= 1000 ? (abs / 1000).toFixed(1) + 'k' : abs.toFixed(0);
      ctx.fillText(gv < 0 ? '-' + f : f, padL - 8, y);
    }

    if (layout.hasNegative) {
      ctx.beginPath(); ctx.moveTo(padL, baselineY); ctx.lineTo(padL + chartW, baselineY);
      ctx.strokeStyle = zeroLineColor; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.stroke();
    }

    function smoothCurve(points) {
      if (points.length === 0) return;
      ctx.moveTo(points[0].x, points[0].y);
      if (points.length === 1) return;
      if (points.length === 2) { ctx.lineTo(points[1].x, points[1].y); return; }
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? i : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
        ctx.bezierCurveTo(
          p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
          p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
          p2.x, p2.y
        );
      }
    }

    function buildAreaPath(points) {
      if (points.length === 0) return;
      ctx.moveTo(points[0].x, baselineY);
      ctx.lineTo(points[0].x, points[0].y);
      if (points.length === 2) { ctx.lineTo(points[1].x, points[1].y); }
      else {
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i === 0 ? i : i - 1];
          const p1 = points[i], p2 = points[i + 1];
          const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
          ctx.bezierCurveTo(
            p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
            p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
            p2.x, p2.y
          );
        }
      }
      ctx.lineTo(points[points.length - 1].x, baselineY);
      ctx.closePath();
    }

    function fillArea(points, top, bot) {
      const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
      grad.addColorStop(0, top); grad.addColorStop(1, bot);
      ctx.fillStyle = grad; ctx.beginPath(); buildAreaPath(points); ctx.fill();
    }

    fillArea(layout.incomePoints, isDark ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.10)', isDark ? 'rgba(34,197,94,0.02)' : 'rgba(34,197,94,0.01)');
    fillArea(layout.expensePoints, isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.10)', isDark ? 'rgba(239,68,68,0.02)' : 'rgba(239,68,68,0.01)');

    ctx.beginPath(); smoothCurve(layout.incomePoints);
    ctx.strokeStyle = layout.incomeColor; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); smoothCurve(layout.expensePoints);
    ctx.strokeStyle = layout.expenseColor; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    if (layout.hasSavings) {
      ctx.beginPath(); smoothCurve(layout.savingsPoints);
      ctx.strokeStyle = layout.savingsColor; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    }

    data.labels.forEach((label, i) => {
      ctx.fillStyle = textColor; ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(label, idxToX(i), padT + chartH + 10);
    });

    // Draw small dots for all data points (always visible)
    const drawAllDots = (pts, color) => {
      if (!pts) return;
      pts.forEach((p, i) => {
        if (i === idx) return;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    };
    drawAllDots(layout.incomePoints, layout.incomeColor);
    drawAllDots(layout.expensePoints, layout.expenseColor);
    if (layout.hasSavings) drawAllDots(layout.savingsPoints, layout.savingsColor);

    if (idx >= 0 && idx < n) {

      const drawDot = (pts, color) => {
        if (pts && pts[idx]) {
          const p = pts[idx];
          ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill();
          ctx.strokeStyle = isDark ? '#1a1a1e' : '#fff';
          ctx.lineWidth = 2; ctx.stroke();
        }
      };
      drawDot(layout.incomePoints, layout.incomeColor);
      drawDot(layout.expensePoints, layout.expenseColor);
      if (layout.hasSavings) drawDot(layout.savingsPoints, layout.savingsColor);
    }
  }

  const onMove = (e) => {
    const data = canvas._chartData;
    const layout = canvas._chartLayout;
    if (!data || !layout || !data.labels.length) { tooltip.style.display = 'none'; return; }

    const idx = findNearest(e.clientX);

    if (idx !== canvas._hoverIdx) {
      canvas._hoverIdx = idx;
      drawHoverState(idx);
    }

    if (idx >= 0) {
      const inc = data.incomeData[idx] || 0;
      const exp = data.expenseData[idx] || 0;
      const sav = data.savingsData && data.savingsData[idx] !== undefined ? data.savingsData[idx] : null;

      let html = '<div class="tooltip-title">' + data.labels[idx] + '</div>';
      if (inc > 0) html += '<div class="tooltip-row"><span class="tooltip-dot" style="background:' + layout.incomeColor + '"></span>Ingresos: <strong>' + formatCurrency(inc) + '</strong></div>';
      if (exp > 0) html += '<div class="tooltip-row"><span class="tooltip-dot" style="background:' + layout.expenseColor + '"></span>Gastos: <strong>' + formatCurrency(exp) + '</strong></div>';
      if (sav !== null && layout.hasSavings) html += '<div class="tooltip-row"><span class="tooltip-dot" style="background:' + layout.savingsColor + '"></span>Ahorro: <strong>' + formatCurrency(sav) + '</strong></div>';

      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      tooltip.style.left = Math.min(e.clientX + 12, window.innerWidth - 200) + 'px';
      tooltip.style.top = Math.max(e.clientY - 10, 10) + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  };

  const onOut = () => {
    canvas._hoverIdx = -1;
    tooltip.style.display = 'none';
    drawHoverState(-1);
  };

  canvas.removeEventListener('mousemove', canvas._lineTooltipMove);
  canvas.removeEventListener('mouseout', canvas._lineTooltipOut);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseout', onOut);
  canvas._lineTooltipMove = onMove;
  canvas._lineTooltipOut = onOut;
}



function drawDonutChart(canvas, centerEl, values, labels, colors, totalLabel) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width, H = rect.height;
  const cx = W / 2, cy = H / 2;
  const outerR = Math.min(W, H) / 2 - 10;
  const innerR = outerR * 0.55;
  const lineW = outerR - innerR;

  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) {
    const isDark = document.documentElement.classList.contains('theme-dark');
    ctx.strokeStyle = isDark ? '#303036' : '#e3e0db';
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.arc(cx, cy, (outerR + innerR) / 2, 0, Math.PI * 2);
    ctx.stroke();
    canvas._segments = [];
    return;
  }

  ctx.shadowColor = 'rgba(0,0,0,0.04)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;

  const segments = [];
  let startAngle = -Math.PI / 2;
  values.forEach((v, i) => {
    const sweep = (v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep);
    ctx.arc(cx, cy, innerR, startAngle + sweep, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    segments.push({ startAngle, endAngle: startAngle + sweep, label: labels[i], value: v, color: colors[i] });
    startAngle += sweep;
  });

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  canvas._segments = segments;
  canvas._cx = cx;
  canvas._cy = cy;
  canvas._outerR = outerR;
  canvas._innerR = innerR;

  updateDonutTooltip(canvas);
}

function updateDonutTooltip(canvas) {
  const tooltip = document.getElementById('dash-donut-tooltip');
  if (!tooltip) return;

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (canvas.width / (r.width * (window.devicePixelRatio || 1)));
    const my = (e.clientY - r.top) * (canvas.height / (r.height * (window.devicePixelRatio || 1)));
    const segments = canvas._segments || [];
    if (segments.length === 0) { tooltip.style.display = 'none'; return; }

    const cx = canvas._cx, cy = canvas._cy;
    const dx = mx - cx, dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < canvas._innerR || dist > canvas._outerR) {
      tooltip.style.display = 'none';
      return;
    }

    let angle = Math.atan2(dy, dx);
    if (angle < -Math.PI / 2) angle += Math.PI * 2;

    let found = null;
    for (const seg of segments) {
      let sa = seg.startAngle, ea = seg.endAngle;
      if (angle >= sa && angle < ea) { found = seg; break; }
    }

    if (!found) { tooltip.style.display = 'none'; return; }

    const pct = ((found.value / segments.reduce((a, s) => a + s.value, 0)) * 100).toFixed(1);
    tooltip.innerHTML = `<div class="tooltip-title">${found.label}</div><div class="tooltip-row"><span class="tooltip-dot" style="background:${found.color};width:8px;height:8px;border-radius:50%"></span><span class="tooltip-val">${formatCurrency(found.value)}</span> <span style="color:var(--text-lo)">(${pct}%)</span></div>`;
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top = (e.clientY - 10) + 'px';
  };

  const onOut = () => {
    tooltip.style.display = 'none';
  };

  canvas.removeEventListener('mousemove', canvas._tooltipMove);
  canvas.removeEventListener('mouseout', canvas._tooltipOut);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseout', onOut);
  canvas._tooltipMove = onMove;
  canvas._tooltipOut = onOut;
}

// ══════════════════════════════════════════════════════════════════════
//  METRIC DELTA — comparison vs previous period
// ══════════════════════════════════════════════════════════════════════
function dashRenderDelta(elId, current, previous) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!previous || previous === 0) {
    el.textContent = '';
    el.className = 'dash-metric-delta';
    return;
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const sign = change >= 0 ? '+' : '';
  el.textContent = sign + change.toFixed(0) + '%';
  el.className = 'dash-metric-delta ' + (change >= 0 ? 'positive' : 'negative');
}



// ══════════════════════════════════════════════════════════════
//  renderSummaryCards — 4 summary cards with period comparison
// ══════════════════════════════════════════════════════════════
function renderSummaryCards(totalIncome, totalExpenses, netDiff, prevIncome, prevExpenses, prevNetDiff) {
  const container = document.getElementById('dash-summary-cards');
  if (!container) return;

  const savings = netDiff;
  const prevSavings = prevNetDiff;

  const cards = [
    {
      id: 'summary-balance',
      icon: 'wallet',
      iconClass: 'balance',
      label: 'Balance neto',
      value: netDiff,
      prev: prevNetDiff,
      format: v => (v >= 0 ? '+' : '') + formatCurrency(v),
    },
    {
      id: 'summary-income',
      icon: 'arrow-up-right',
      iconClass: 'income',
      label: 'Ingresos',
      value: totalIncome,
      prev: prevIncome,
      format: v => formatCurrency(v),
    },
    {
      id: 'summary-expense',
      icon: 'arrow-down-left',
      iconClass: 'expense',
      label: 'Gastos',
      value: totalExpenses,
      prev: prevExpenses,
      format: v => formatCurrency(v),
    },
    {
      id: 'summary-savings',
      icon: 'piggy-bank',
      iconClass: 'savings',
      label: 'Ahorro',
      value: savings,
      prev: prevSavings,
      format: v => (v >= 0 ? '+' : '') + formatCurrency(v),
    },
  ];

  // Determine comparison period label
  let prevLabel = '';
  const p = dashGetPeriod();
  if (dashState.periodType === 'month') {
    let pm = p.month - 1, py = p.year;
    if (pm < 0) { pm = 11; py--; }
    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    prevLabel = 'vs ' + monthNames[pm];
  } else if (dashState.periodType !== 'all') {
    prevLabel = 'vs período ant.';
  }

  container.innerHTML = cards.map(c => {
    const change = (c.prev && c.prev !== 0)
      ? ((c.value - c.prev) / Math.abs(c.prev)) * 100
      : null;
    const changeSign = change !== null ? (change >= 0 ? '+' : '') : '';
    const deltaIcon = change !== null ? (change >= 0 ? 'trending-up' : 'trending-down') : 'minus';

    // Per-card value color: income→green, expense→red, balance→accent, savings→purple
    const valClassMap = { 'income': 'income', 'expense': 'expense', 'balance': 'accent', 'savings': 'savings-val' };

    return `
      <div class="dash-summary-card">
        <div class="dash-summary-card-top">
          <div class="dash-summary-card-icon ${c.iconClass}">
            <i data-lucide="${c.icon}"></i>
          </div>
        </div>
        <div class="dash-summary-card-body">
          <span class="dash-summary-card-label">${c.label}</span>
          <span class="dash-summary-card-value ${valClassMap[c.iconClass] || ''}">${c.format(c.value)}</span>
        </div>
        <div class="dash-summary-card-delta neutral">
          ${change !== null
            ? `<i data-lucide="${deltaIcon}"></i> ${changeSign}${change.toFixed(0)}% <span style="opacity:0.55">${prevLabel || ''}</span>`
            : `<i data-lucide="minus"></i> <span style="opacity:0.55">Sin comparación</span>`
          }
        </div>
      </div>`;
  }).join('');

  lucide.createIcons();
}

// ══════════════════════════════════════════════════════════════
//  renderSavingsCard — right-side card next to line chart
// ══════════════════════════════════════════════════════════════
function renderSavingsCard(totalIncome, totalExpenses, netDiff) {
  const body = document.getElementById('dash-savings-body');
  if (!body) return;

  const savings = netDiff;
  const savingsPct = totalIncome > 0 ? Math.max(0, (savings / totalIncome) * 100) : 0;
  const expensePct = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

  // SVG ring: 3 segments
  const r = 42;           // ring radius
  const circ = 2 * Math.PI * r; // circumference
  const expenseDash = (expensePct / 100) * circ;
  const savingsDash = (savingsPct / 100) * circ;
  const gapDash = Math.max(0, circ - expenseDash - savingsDash);

  const strokeW = 10;
  const viewBox = 100;

  body.innerHTML = `
    <div class="dash-savings-ring">
      <svg viewBox="0 0 ${viewBox} ${viewBox}" aria-label="Proporción de ahorro">
        <!-- Background ring -->
        <circle cx="${viewBox/2}" cy="${viewBox/2}" r="${r}"
          fill="none" stroke="var(--bg-sunken)" stroke-width="${strokeW}" />
        ${expenseDash > 2 ? `<circle cx="${viewBox/2}" cy="${viewBox/2}" r="${r}"
          fill="none" stroke="var(--negative)" stroke-width="${strokeW}"
          stroke-dasharray="${expenseDash} ${circ - expenseDash}"
          stroke-linecap="round" />` : ''}
        ${savingsDash > 2 ? `<circle cx="${viewBox/2}" cy="${viewBox/2}" r="${r}"
          fill="none" stroke="var(--positive)" stroke-width="${strokeW}"
          stroke-dasharray="${savingsDash} ${circ - savingsDash}"
          stroke-dashoffset="${-(expenseDash + 1)}"
          stroke-linecap="round" />` : ''}
      </svg>
      <div class="dash-savings-ring-center">
        <span class="dash-savings-ring-pct">${savingsPct.toFixed(0)}%</span>
        <span class="dash-savings-ring-label">Ahorro</span>
      </div>
    </div>
    <div class="dash-savings-stats">
      <div class="dash-savings-stat">
        <span class="dash-savings-stat-label">
          <span class="dash-savings-stat-dot" style="background:#22c55e"></span>
          Ingresos
        </span>
        <span class="dash-savings-stat-val">${formatCurrency(totalIncome)}</span>
      </div>
      <div class="dash-savings-stat">
        <span class="dash-savings-stat-label">
          <span class="dash-savings-stat-dot" style="background:#ef4444"></span>
          Gastos
        </span>
        <span class="dash-savings-stat-val">${formatCurrency(totalExpenses)}</span>
      </div>
      <div class="dash-savings-stat">
        <span class="dash-savings-stat-label">
          <span class="dash-savings-stat-dot" style="background:#0284c7"></span>
          Ahorro
        </span>
        <span class="dash-savings-stat-val" style="color:#0284c7">${formatCurrency(savings)}</span>
      </div>
    </div>`;

  lucide.createIcons();
}

// ══════════════════════════════════════════════════════════════
//  renderDonutCategories — unified donut + cat list with colors
// ══════════════════════════════════════════════════════════════
function renderDonutCategories(monthTxs, totalIncome, totalExpenses, prevTxs) {
  const isExp = dashState.donutMode === 'expense';
  const total = isExp ? totalExpenses : totalIncome;
  const filtered = monthTxs.filter(tx => isExp ? tx.amount < 0 : tx.amount > 0);
  const excludedCats = new Set(state.settings.excludedBalanceCats || []);

  // Hidden cats set
  const key = isExp ? 'expenses' : 'income';
  if (!dashState.hiddenCats[key]) dashState.hiddenCats[key] = new Set();
  const hidden = dashState.hiddenCats[key];

  // Build category totals
  const catTotals = {};
  filtered.forEach(tx => {
    if (excludedCats.has(tx.category_name)) return;
    const cat = tx.category_name || 'Otros';
    catTotals[cat] = (catTotals[cat] || 0) + (isExp ? Math.abs(getTxAmountInSettingsCurrency(tx)) : getTxAmountInSettingsCurrency(tx));
  });
  const entries = Object.entries(catTotals).sort((a, b) => {
    const aH = hidden.has(a[0]) ? 1 : 0;
    const bH = hidden.has(b[0]) ? 1 : 0;
    if (aH !== bH) return aH - bH;
    return b[1] - a[1];
  });

  // Build previous period totals (for per-row comparison)
  const prevTotals = {};
  if (prevTxs) {
    prevTxs.forEach(tx => {
      if (excludedCats.has(tx.category_name)) return;
      if (isExp ? tx.amount < 0 : tx.amount > 0) {
        const cat = tx.category_name || 'Otros';
        prevTotals[cat] = (prevTotals[cat] || 0) + (isExp ? Math.abs(getTxAmountInSettingsCurrency(tx)) : getTxAmountInSettingsCurrency(tx));
      }
    });
  }

  // Previous period label for tooltips
  let prevPeriodLabel = 'período anterior';
  if (dashState.periodType === 'month') {
    const p = dashGetPeriod();
    let pm = p.month - 1, py = p.year;
    if (pm < 0) { pm = 11; py--; }
    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    prevPeriodLabel = monthNames[pm];
  }

  // Color map — assign colors by amount-sorted order (hidden cats stay in place)
  const allSorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const colorMap = {};
  getChartColors(allSorted.length).forEach((c, i) => { colorMap[allSorted[i][0]] = c; });

  // Update title
  const title = document.getElementById('dash-donut-title');
  if (title) title.textContent = isExp ? 'Distribución de gastos' : 'Distribución de ingresos';

  // Update center total (visible only, excluding hidden categories)
  const visibleTotal = entries.filter(([k]) => !hidden.has(k)).reduce((sum, [, v]) => sum + v, 0);
  const totalEl = document.getElementById('dash-donut-total');
  if (totalEl) totalEl.textContent = formatCurrency(visibleTotal);

  // Render cat list
  const list = document.getElementById('dash-donut-cat-list');
  if (list) {
    list.innerHTML = '';
    if (entries.length === 0) {
      list.innerHTML = '<div class="dash-empty">Sin datos en este período</div>';
    } else {
      const maxVal = entries[0][1];
      const hasPrev = Object.keys(prevTotals).length > 0;

      entries.forEach(([cat, amount]) => {
        const pct = maxVal > 0 ? (amount / maxVal) * 100 : 0;
        const totalPct = total > 0 ? (amount / total * 100).toFixed(0) : 0;
        const catObj = state.predefined.categories.find(c => (typeof c === 'string' ? c : c.name) === cat);
        const catIcon = catObj && typeof catObj !== 'string' ? catObj.icon : 'tag';
        const color = colorMap[cat] || 'var(--accent)';
        const isHidden = hidden.has(cat);

        // Prev period comparison
        const prevAmt = prevTotals[cat] || 0;
        const diff = amount - prevAmt;
        const pctChange = prevAmt > 0 ? ((diff / prevAmt) * 100).toFixed(1) : (prevAmt === 0 && amount > 0 ? '100' : '0');
        const isUpBad = isExp ? diff > 0 : diff < 0;
        let compareHtml = '';
        if (hasPrev && prevTxs.length > 0) {
          const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '—';
          const compClass = diff === 0 ? '' : (isUpBad ? 'comp-bad' : 'comp-good');
          compareHtml = `<span class="dash-cat-compare ${compClass}" title="vs ${prevPeriodLabel}">${diff === 0 ? '—' : arrow + ' ' + pctChange + '%'}</span>`;
        }

        const row = document.createElement('div');
        row.className = 'dash-cat-row' + (isHidden ? ' cat-hidden' : '');
        row.innerHTML = `
          <div class="dash-cat-top">
            <span class="dash-cat-label">
              <span class="dash-cat-icon"><i data-lucide="${catIcon}"></i></span>
              <span class="dash-cat-name" onclick="dashGoToCategory('${cat.replace(/'/g, "\\'")}')">${cat}</span>
              <button class="dash-cat-eye" onclick="event.stopPropagation();dashToggleCat('${cat.replace(/'/g, "\\'")}','${isExp ? 'expense' : 'income'}')" title="${isHidden ? 'Mostrar' : 'Ocultar'}">
                <i data-lucide="${isHidden ? 'eye-off' : 'eye'}"></i>
              </button>
            </span>
            <span class="dash-cat-amount">
              ${formatCurrency(amount)}
              <span class="dash-cat-pct" title="${totalPct}% del total">${totalPct}%</span>
              ${compareHtml}
            </span>
          </div>
          <div class="dash-cat-bar-track"><div class="dash-cat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        `;
        list.appendChild(row);
      });
    }
  }

  lucide.createIcons();
}

function dashToggleDonutMode() {
  dashState.donutMode = dashState.donutMode === 'expense' ? 'income' : 'expense';
  renderDashboard();
}

function dashGoToCategory(catName) {
  const searchInput = document.getElementById('tx-search-input');
  if (searchInput) {
    searchInput.value = catName;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const searchBox = document.getElementById('search-box');
  if (searchBox) searchBox.classList.add('expanded');
  state.currentView = 'all';
  state.selectedAccounts = [];
  showView('main');
  renderAll();
}

// ── MAIN renderDashboard ──────────────────────────────────────
function renderDashboard() {
  const accFilter = dashState.accounts !== null ? (dashState.accounts.length > 0 ? dashState.accounts : []) : null;
  const balances = calculateBalances(accFilter);
  const period = dashGetPeriod();
  const now = new Date();

  // ── Hero: period label (big) ──
  const heroPeriod = document.getElementById('dash-hero-period');
  const periodLabel = document.getElementById('dash-period-label');
  const prevBtn = document.getElementById('dash-month-prev');
  const nextBtn = document.getElementById('dash-month-next');
  const isMonthMode = dashState.periodType === 'month';

  const getPeriodDisplayText = () => {
    if (isMonthMode) {
      const p = state.period;
      if (p && p.type !== 'all') return getPeriodLabel();
      if (dashState.month) {
        const d = new Date(period.year, period.month, 1);
        return d.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' }).replace(/^./, s => s.toUpperCase());
      }
      return now.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' }).replace(/^./, s => s.toUpperCase());
    }
    return period.rangeLabel || 'Histórico';
  };
  const periodText = getPeriodDisplayText();
  if (heroPeriod) heroPeriod.textContent = periodText;
  if (periodLabel) periodLabel.textContent = periodText;
  if (prevBtn) prevBtn.style.display = isMonthMode ? '' : 'none';
  if (nextBtn) nextBtn.style.display = isMonthMode ? '' : 'none';

  // ── Filter transactions for selected period ──
  const dashIncludeTxLocal = (tx) => {
    if (isTxExcluded(tx) || tx.split_parent_id) return false;
    const acc = state.accounts.find(a => a.id === tx.account_id);
    if (acc && acc.excluded) return false;
    if (acc && acc.type === 'credit_card') return true;
    return !tx.is_future;
  };

  const monthTxs = dashGetTxForPeriod().filter(tx => dashIncludeTxLocal(tx));
  const prevTxs  = dashGetPrevTxForPeriod().filter(tx => dashIncludeTxLocal(tx));

  let totalIncome = 0, totalExpenses = 0;
  const dashExcludedCats = new Set(state.settings.excludedBalanceCats || []);
  monthTxs.forEach(tx => {
    if (dashExcludedCats.has(tx.category_name)) return;
    const val = getTxAmountInSettingsCurrency(tx);
    if (val > 0) totalIncome += val;
    else totalExpenses += Math.abs(val);
  });
  const netDiff = totalIncome - totalExpenses;

  let prevIncome = 0, prevExpenses = 0;
  prevTxs.forEach(tx => {
    if (dashExcludedCats.has(tx.category_name)) return;
    const val = getTxAmountInSettingsCurrency(tx);
    if (val > 0) prevIncome += val;
    else prevExpenses += Math.abs(val);
  });
  const prevNetDiff = prevIncome - prevExpenses;

  // ── Balances for hero ──
  const netWorth  = balances.liquid + balances.credit_card + balances.receivables;

  // ── Summary cards (4 cards) ──
  renderSummaryCards(totalIncome, totalExpenses, netDiff, prevIncome, prevExpenses, prevNetDiff);

  // ── Savings side card ──
  renderSavingsCard(totalIncome, totalExpenses, netDiff);

  // ── Category breakdown (donut mode based) ──
  renderDonutCategories(monthTxs, totalIncome, totalExpenses, prevTxs);

  // ── Recent activity (10 items) ──
  const recentList = document.getElementById('dash-recent-list');
  if (recentList) {
    recentList.innerHTML = '';
    let recent = [...state.transactions].filter(tx => dashIncludeTx(tx) && isTxInPeriod(tx));
    if (dashState.accounts !== null) {
      const accSet = new Set(dashState.accounts);
      recent = recent.filter(tx => accSet.has(tx.account_id));
    }
    recent = recent.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    recent = recent.filter(tx => !dashExcludedCats.has(tx.category_name));
    if (recent.length === 0) {
      recentList.innerHTML = '<div class="dash-empty">Sin movimientos aún</div>';
    } else {
      const amtStyle = state.settings.amountStyle || 'default';
      const showSign = amtStyle !== 'no-sign';
      const showColor = amtStyle !== 'no-color';
      recent.forEach(tx => {
        const isExp = tx.amount < 0;
        const rAcc = state.accounts.find(a => a.id === tx.account_id);
        const rCur = rAcc?.currency || state.settings.currency || 'UYU';
        const rTooltip = getConvertedTooltip(tx.amount, rCur);
        const item = document.createElement('div');
        item.className = 'dash-recent-item';
        item.innerHTML = `
          <span class="dash-recent-date">${formatDate(tx.date)}</span>
          <span class="dash-recent-payee">${tx.payee || '—'}</span>
          <span class="dash-recent-notes">${tx.notes || ''}</span>
          <span class="dash-recent-amount ${showColor ? (isExp ? 'expense' : 'income') : 'amount-no-color'}" ${rTooltip ? 'title="' + rTooltip + '"' : ''}>${isExp ? (showSign ? '-' : '') : (showSign ? '+' : '')}${formatAccountCurrency(Math.abs(tx.amount), rCur)}</span>
        `;
        recentList.appendChild(item);
      });
    }
  }

  // ── Top expenses/incomes ──
  const topList = document.getElementById('dash-top-list');
  const topLabel = document.getElementById('dash-top-label');
  const topIcon = document.getElementById('dash-top-icon');
  const topIsExpense = dashState.topMode === 'expense';
  if (topLabel) topLabel.textContent = topIsExpense ? 'Mayores gastos' : 'Mayores ingresos';
  if (topIcon) topIcon.setAttribute('data-lucide', topIsExpense ? 'trending-down' : 'trending-up');
  if (topList) {
    topList.innerHTML = '';
    let topTxs = [...state.transactions].filter(tx => {
      if (!dashIncludeTx(tx) || !isTxInPeriod(tx)) return false;
      return topIsExpense ? tx.amount < 0 : tx.amount > 0;
    });
    if (dashState.accounts !== null) {
      const accSet = new Set(dashState.accounts);
      topTxs = topTxs.filter(tx => accSet.has(tx.account_id));
    }
    topTxs.sort((a, b) => topIsExpense ? a.amount - b.amount : b.amount - a.amount);
    topTxs = topTxs.slice(0, 10);
    topTxs = topTxs.filter(tx => !dashExcludedCats.has(tx.category_name));
    if (topTxs.length === 0) {
      topList.innerHTML = `<div class="dash-empty">Sin ${topIsExpense ? 'gastos' : 'ingresos'} en este período</div>`;
    } else {
      const amtStyle = state.settings.amountStyle || 'default';
      const showSign = amtStyle !== 'no-sign';
      const showColor = amtStyle !== 'no-color';
      topTxs.forEach(tx => {
        const tAcc = state.accounts.find(a => a.id === tx.account_id);
        const tCur = tAcc?.currency || state.settings.currency || 'UYU';
        const tTooltip = getConvertedTooltip(tx.amount, tCur);
        const item = document.createElement('div');
        item.className = 'dash-recent-item';
        item.innerHTML = `
          <span class="dash-recent-date">${formatDate(tx.date)}</span>
          <span class="dash-recent-payee">${tx.payee || '—'}</span>
          <span class="dash-recent-notes">${tx.notes || ''}</span>
          <span class="dash-recent-amount ${showColor ? (topIsExpense ? 'expense' : 'income') : 'amount-no-color'}" ${tTooltip ? 'title="' + tTooltip + '"' : ''}>${topIsExpense ? (showSign ? '-' : '') : (showSign ? '+' : '')}${formatAccountCurrency(Math.abs(tx.amount), tCur)}</span>
        `;
        topList.appendChild(item);
      });
    }
  }

  lucide.createIcons();
  dashBuildSectionMenu();
  // Sync section visibility
  Object.keys(dashState.visibleSections).forEach(name => {
    const visible = dashState.visibleSections[name];
    const el = document.getElementById('dash-section-' + name);
    const cb = document.querySelector(`.dash-section-item[data-section="${name}"] input[type="checkbox"]`);
    if (el) el.classList.toggle('dash-hidden', !visible);
    if (cb) cb.checked = visible;
  });
  renderCalendarHeatmap();
  renderAccountCards();
  // Draw charts
  setTimeout(() => {
    renderDashCharts();
    dashUpdateChartLabel();
  }, 30);

  // ResizeObserver on chart wrapper: re-render chart when container resizes (e.g. sidebar toggle)
  const wrap = document.querySelector('.dash-line-chart-wrap');
  if (wrap && !wrap._ro) {
    let roTimer;
    wrap._ro = new ResizeObserver(() => {
      clearTimeout(roTimer);
      roTimer = setTimeout(() => {
        if (dashState.visibleSections.resumen) renderLineChart();
      }, 50);
    });
    wrap._ro.observe(wrap);
  }
}

function dashGetChartEndMonth() {
  if (dashState.chartMonth) return { ...dashState.chartMonth };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function dashUpdateChartLabel() {
  const el = document.getElementById('dash-chart-period');
  if (!el) return;
  const p = dashGetChartEndMonth();
  const d = new Date(p.year, p.month, 1);
  const str = d.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' });
  el.textContent = str.charAt(0).toUpperCase() + str.slice(1);
}

function dashChartPrevMonth() {
  const p = dashGetChartEndMonth();
  let m = p.month - 1, y = p.year;
  if (m < 0) { m = 11; y--; }
  dashState.chartMonth = { year: y, month: m };
  renderLineChart();
  dashUpdateChartLabel();
}

function dashChartNextMonth() {
  const p = dashGetChartEndMonth();
  let m = p.month + 1, y = p.year;
  if (m > 11) { m = 0; y++; }
  dashState.chartMonth = { year: y, month: m };
  renderLineChart();
  dashUpdateChartLabel();
}

function renderLineChart() {
  const lineCanvas = document.getElementById('dash-line-chart');
  if (!lineCanvas || !dashState.visibleSections.resumen || lineCanvas.offsetWidth <= 0) return;
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  const savingsData = [];
  const center = dashGetChartEndMonth();

  // Always show 6 months: 4 before + center + 1 after = 6 total
  const numMonths = 6;

  let prevYear = null;
  for (let i = numMonths - 1; i >= 0; i--) {
    // i=5 → 4 months before center, i=0 → 2 months after center
    let m = center.month - (i - 2), y = center.year;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    const d = new Date(y, m, 1);
    const monthLabel = d.toLocaleDateString('es-UY', { month: 'short' }).replace('.', '');
    let label = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    if (prevYear === null || y !== prevYear) {
      label += ` ${y}`;
    }
    prevYear = y;
    let inc = 0, exp = 0;
    const accFilter = dashState.accounts !== null ? new Set(dashState.accounts) : null;
    state.transactions.forEach(tx => {
      const td = new Date(tx.date + 'T00:00:00');
      if (td.getMonth() === m && td.getFullYear() === y && dashIncludeTx(tx)) {
        if (accFilter && !accFilter.has(tx.account_id)) return;
        const conv = getTxAmountInSettingsCurrency(tx);
        if (conv > 0) inc += conv;
        else exp += Math.abs(conv);
      }
    });
    labels.push(label);
    incomeData.push(inc);
    expenseData.push(exp);
    savingsData.push(inc - exp);
  }
  drawLineChart(lineCanvas, labels, incomeData, expenseData, savingsData);

  // Populate inline legend
}

function renderDashCharts() {
  renderLineChart();

  // ── Donut chart (based on donutMode) ──
  const donutCanvas = document.getElementById('dash-donut-chart');
  if (donutCanvas && dashState.visibleSections.categorias && donutCanvas.offsetWidth > 0) {
    const isExp = dashState.donutMode === 'expense';
    const monthTxs = dashGetTxForPeriod().filter(tx => dashIncludeTx(tx));
    const catTotals = {};
    const donutExcluded = new Set(state.settings.excludedBalanceCats || []);
    monthTxs.filter(tx => isExp ? tx.amount < 0 : tx.amount > 0).forEach(tx => {
      if (donutExcluded.has(tx.category_name)) return;
      const cat = tx.category_name || 'Otros';
      catTotals[cat] = (catTotals[cat] || 0) + (isExp ? Math.abs(getTxAmountInSettingsCurrency(tx)) : getTxAmountInSettingsCurrency(tx));
    });
    const allSorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const dColorMap = {};
    getChartColors(allSorted.length).forEach((c, i) => { dColorMap[allSorted[i][0]] = c; });
    const key = isExp ? 'expenses' : 'income';
    const hidden = dashState.hiddenCats[key] || new Set();
    const entries = allSorted.filter(([k]) => !hidden.has(k)).slice(0, 8);
    const colors = entries.map(([k]) => dColorMap[k] || '#6b7280');
    drawDonutChart(donutCanvas, null, entries.map(e => e[1]), entries.map(e => e[0]), colors, isExp ? 'Total gastos' : 'Total ingresos');
  }
}

// helper needed by renderDashCharts
function dashIncludeTx(tx) {
  if (isTxExcluded(tx) || tx.split_parent_id) return false;
  const acc = state.accounts.find(a => a.id === tx.account_id);
  if (acc && acc.excluded) return false;
  if (acc && acc.type === 'credit_card') return true;
  return !tx.is_future;
}

function renderCalendarHeatmap() {
  const wrap = document.getElementById('dash-section-calendario');
  if (!wrap || wrap.classList.contains('dash-hidden')) return;
  const grid = document.getElementById('dash-cal-grid');
  const insightsEl = document.getElementById('dash-insights');
  if (!grid) return;

  const period = dashGetCalMonth();
  const year = period.year, month = period.month;
  if (year == null) {
    grid.innerHTML = '';
    if (insightsEl) insightsEl.innerHTML = '<div class="dash-empty">Seleccioná un mes para ver el calendario</div>';
    return;
  }

  // Update month label
  const labelEl = document.getElementById('dash-cal-month-label');
  if (labelEl) {
    const d = new Date(year, month, 1);
    labelEl.textContent = d.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' }).replace(/^./, s => s.toUpperCase());
  }

  // Gather transactions for this calendar month (not dashboard period)
  const txs = state.transactions.filter(tx => {
    if (isTxExcluded(tx) || tx.split_parent_id) return false;
    const d = new Date(tx.date + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  }).filter(tx => dashIncludeTx(tx));
  const settingsCur = state.settings.currency || 'UYU';

  const dailyTotals = {};
  txs.forEach(tx => {
    const day = parseInt(tx.date.split('-')[2], 10);
    const val = getTxAmountInSettingsCurrency(tx);
    // Only include expenses for the heatmap
    if (val < 0) {
      dailyTotals[day] = (dailyTotals[day] || 0) + Math.abs(val);
    }
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = firstDow === 0 ? 6 : firstDow - 1; // Mon=0

  const vals = Object.values(dailyTotals);
  const maxDay = vals.length ? Math.max(...vals) : 0;

  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };

  // Build grid
  grid.innerHTML = '';
  const totalCells = startOffset + daysInMonth;
  const weeks = Math.ceil(totalCells / 7);

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d;
      const dayNum = idx - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        const empty = document.createElement('div');
        empty.className = 'dash-cal-day dash-cal-day-empty';
        grid.appendChild(empty);
        continue;
      }
      const total = dailyTotals[dayNum] || 0;
      let intensity;
      if (total <= 0) {
        intensity = 0;
      } else if (total <= 250) {
        intensity = 1;
      } else if (total <= 500) {
        intensity = 2;
      } else if (total <= 1000) {
        intensity = 3;
      } else if (total <= 2000) {
        intensity = 4;
      } else if (total <= 3500) {
        intensity = 5;
      } else if (total <= 5000) {
        intensity = 6;
      } else {
        intensity = 7;
      }
      const heatLabels = ['Sin gastos', 'Hasta $250', '$250 – $500', '$500 – $1.000', '$1.000 – $2.000', '$2.000 – $3.500', '$3.500 – $5.000', 'Más de $5.000'];
      const isToday = dayNum === today.day && month === today.month && year === today.year;

      const cell = document.createElement('div');
      cell.className = 'dash-cal-day'
        + (total > 0 ? ' dash-cal-day-has' : '')
        + ' dash-cal-lvl-' + intensity
        + (isToday ? ' dash-cal-day-today' : '');
      cell.textContent = dayNum;
      if (total > 0) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        cell.dataset.date = dateStr;
        cell.dataset.amount = total;
        cell.dataset.heatLabel = heatLabels[intensity];
        cell.addEventListener('mouseenter', showCalTooltip);
        cell.addEventListener('mouseleave', hideCalTooltip);
      } else {
        cell.title = heatLabels[intensity];
      }
      grid.appendChild(cell);
    }
  }

  // Hide tooltip when leaving the grid
  grid.addEventListener('mouseleave', hideCalTooltip);

  // Render legend
  const calCard = grid.closest('.dash-card');
  if (calCard) {
    let legend = calCard.querySelector('.dash-cal-legend');
    if (!legend) {
      legend = document.createElement('div');
      legend.className = 'dash-cal-legend';
      grid.parentNode.appendChild(legend);
    }
    legend.innerHTML = `
      <span class="dash-cal-legend-label">0</span>
      ${[1,2,3,4,5,6,7].map(l => `<span class="dash-cal-legend-item"><span class="dash-cal-legend-swatch dash-cal-lvl-${l}"></span></span>`).join('')}
      <span class="dash-cal-legend-label">5000+</span>
    `;
  }

  // Render insights
  renderDailyInsights(txs, year, month, daysInMonth, dailyTotals, maxDay, settingsCur);
}

function showCalTooltip(e) {
  const el = e.currentTarget;
  const tip = document.getElementById('dash-cal-tooltip');
  if (!tip) return;
  const dateStr = el.dataset.date;
  const amount = parseFloat(el.dataset.amount);
  const heatLabel = el.dataset.heatLabel || '';
  tip.innerHTML = `<div class="tooltip-title">${formatDate(dateStr)}</div><div class="tooltip-row"><span class="tooltip-val">${formatCurrency(amount)}</span></div><div class="tooltip-row" style="font-size:10px;color:var(--text-lo)">${heatLabel}</div>`;
  tip.style.display = 'block';
  const rect = el.getBoundingClientRect();
  tip.style.left = (rect.left + rect.width / 2) + 'px';
  tip.style.top = (rect.top - 8) + 'px';
  tip.style.transform = 'translate(-50%, -100%)';
}

function hideCalTooltip() {
  const tip = document.getElementById('dash-cal-tooltip');
  if (tip) tip.style.display = 'none';
}

function renderDailyInsights(txs, year, month, daysInMonth, dailyTotals, maxDay, settingsCur) {
  const el = document.getElementById('dash-insights');
  if (!el) return;

  const vals = Object.values(dailyTotals);
  const totalSpend = vals.reduce((a, b) => a + b, 0);
  const daysWithTx = Object.keys(dailyTotals).length;
  const avgDaily = daysInMonth > 0 ? totalSpend / daysInMonth : 0;

  // Today
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todaySpend = dailyTotals[now.getDate()] || 0;
  const isCurrentMonth = now.getMonth() === month && now.getFullYear() === year;

  // Previous month comparison
  let prevMonthTotal = 0;
  let prevMonthTxs = [];
  const pm = month === 0 ? 11 : month - 1;
  const py = month === 0 ? year - 1 : year;
  const prevTxs = state.transactions.filter(tx => {
    if (isTxExcluded(tx) || tx.split_parent_id) return false;
    const d = new Date(tx.date + 'T00:00:00');
    return d.getMonth() === pm && d.getFullYear() === py && dashIncludeTx(tx);
  });
  prevTxs.forEach(tx => {
    const val = getTxAmountInSettingsCurrency(tx);
    if (val < 0) prevMonthTotal += Math.abs(val);
  });

  // Delta vs previous month
  const deltaPct = prevMonthTotal > 0 ? ((totalSpend - prevMonthTotal) / prevMonthTotal) * 100 : 0;
  const deltaClass = Math.abs(deltaPct) < 0.5 ? 'neutral' : deltaPct > 0 ? 'up' : 'down';
  const deltaArrow = deltaPct > 0 ? '▲' : deltaPct < 0 ? '▼' : '—';
  const deltaText = Math.abs(deltaPct) < 0.5 ? 'Sin cambio vs mes anterior'
    : `${deltaArrow} ${Math.abs(deltaPct).toFixed(1)}% vs mes anterior`;

  // Day elapsed / projection
  const daysElapsed = now.getDate();
  const totalDays = daysInMonth;
  const pctElapsed = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
  const projected = avgDaily > 0 ? avgDaily * totalDays : 0;
  const projDeltaPct = prevMonthTotal > 0 ? ((projected - prevMonthTotal) / prevMonthTotal) * 100 : 0;
  const projDeltaClass = Math.abs(projDeltaPct) < 0.5 ? 'neutral' : projDeltaPct > 0 ? 'up' : 'down';
  const projDeltaArrow = projDeltaPct > 0 ? '▲' : projDeltaPct < 0 ? '▼' : '—';
  const projDeltaText = Math.abs(projDeltaPct) < 0.5 ? 'igual que mes pasado'
    : `${projDeltaArrow} ${Math.abs(projDeltaPct).toFixed(1)}% vs mes pasado`;

  // Today comparison vs daily average
  const todayComparePct = avgDaily > 0 ? ((todaySpend - avgDaily) / avgDaily) * 100 : 0;
  const todayCompareClass = todayComparePct > 5 ? 'over' : todayComparePct < -5 ? 'under' : '';
  const todayCompareText = todaySpend === 0 ? ''
    : Math.abs(todayComparePct) < 5 ? 'similar a tu promedio'
    : `${todayComparePct > 0 ? '+' : ''}${todayComparePct.toFixed(0)}% vs tu promedio`;

  // Busiest / quietest day
  let bestDay = null, bestAmt = 0, worstDay = null, worstAmt = Infinity;
  Object.entries(dailyTotals).forEach(([day, amt]) => {
    if (amt > bestAmt) { bestAmt = amt; bestDay = parseInt(day); }
    if (amt < worstAmt) { worstAmt = amt; worstDay = parseInt(day); }
  });

  // Weekday data
  const weekdayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  txs.forEach(tx => {
    const val = getTxAmountInSettingsCurrency(tx);
    if (val >= 0) return; // expenses only
    const d = new Date(tx.date + 'T00:00:00');
    const dow = d.getDay();
    const wIdx = dow === 0 ? 6 : dow - 1;
    weekdayTotals[wIdx] += Math.abs(val);
    weekdayCounts[wIdx]++;
  });

  const weekdayAvgs = weekdayNames.map((_, i) => weekdayCounts[i] > 0 ? weekdayTotals[i] / weekdayCounts[i] : 0);
  const maxWday = Math.max(...weekdayAvgs, 1);

  // Weekend average
  const weekendTotal = weekdayTotals[5] + weekdayTotals[6];
  const weekendCount = weekdayCounts[5] + weekdayCounts[6];
  const weekendAvg = weekendCount > 0 ? weekendTotal / weekendCount : 0;

  // Week average (Mon-Fri)
  const weekTotal = weekdayTotals.slice(0, 5).reduce((a, b) => a + b, 0);
  const weekCount = weekdayCounts.slice(0, 5).reduce((a, b) => a + b, 0);
  const weekAvg = weekCount > 0 ? weekTotal / weekCount : 0;

  // Spending streak (consecutive days without expenses)
  let streak = 0;
  const todayD = now.getDate();
  for (let d = todayD; d >= 1; d--) {
    if (dailyTotals[d] && dailyTotals[d] > 0) break;
    streak++;
  }
  // Don't count today if it has no spending (subtract 1 if today has no spending)
  if (todaySpend === 0 && streak > 0) streak--;
  streak = Math.max(0, streak);

  // Build weekday bars HTML
  const wdayBars = weekdayNames.map((name, i) => {
    const pct = maxWday > 0 ? (weekdayAvgs[i] / maxWday) * 100 : 0;
    return `<div class="dash-insight-wday-row">
      <span class="dash-insight-wday-name">${name}</span>
      <div class="dash-insight-wday-track">
        <div class="dash-insight-wday-fill" style="width:${pct}%"></div>
      </div>
      <span class="dash-insight-wday-amt">${weekdayAvgs[i] > 0 ? formatCurrency(weekdayAvgs[i]) : '—'}</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="dash-insight-month">
      <span class="dash-insight-month-label">Gasto del mes</span>
      <span class="dash-insight-month-val">${formatCurrency(totalSpend)}</span>
      <span class="dash-insight-month-delta ${deltaClass}">${deltaText}</span>
    </div>

    <div class="dash-insight-velocity">
      <div class="dash-insight-velocity-label">Al ritmo actual</div>
      <div class="dash-insight-velocity-bar">
        <div class="dash-insight-velocity-fill" style="width:${Math.min(pctElapsed, 100)}%"></div>
      </div>
      <div class="dash-insight-velocity-info">
        <span>Día ${daysElapsed} de ${totalDays}</span>
        <span>${pctElapsed.toFixed(0)}%</span>
      </div>
      <div class="dash-insight-velocity-proj">
        <span>Proyectado:</span>
        <span class="dash-insight-velocity-proj-val">${formatCurrency(projected)}</span>
        <span class="dash-insight-velocity-proj-delta ${projDeltaClass}">${projDeltaText}</span>
      </div>
    </div>

    <div class="dash-insight-today">
      <div class="dash-insight-today-label">${isCurrentMonth ? 'Hoy' : 'Promedio diario'}</div>
      ${isCurrentMonth ? (todaySpend > 0 ? `
      <div class="dash-insight-today-row">
        <span class="dash-insight-today-val">${formatCurrency(todaySpend)}</span>
        ${todayCompareText ? `<span class="dash-insight-today-compare ${todayCompareClass}">${todayCompareText}</span>` : ''}
      </div>` : `<span class="dash-insight-today-none">No registraste gastos hoy</span>`)
      : `<div class="dash-insight-today-row"><span class="dash-insight-today-val">${formatCurrency(avgDaily)}</span><span class="dash-insight-today-compare neutral">/día</span></div>`}
    </div>

    <div class="dash-insight-metrics">
      <div class="dash-insight-metric">
        <span class="dash-insight-metric-label">Día peak</span>
        <span class="dash-insight-metric-val">${bestDay ? formatCurrency(bestAmt) : '—'}</span>
        <span class="dash-insight-metric-sub">${bestDay ? bestDay + ' de ' + (month + 1) : ''}</span>
      </div>
      <div class="dash-insight-metric">
        <span class="dash-insight-metric-label">Promedio</span>
        <span class="dash-insight-metric-val">${formatCurrency(avgDaily)}</span>
        <span class="dash-insight-metric-sub">/día</span>
      </div>
      <div class="dash-insight-metric">
        <span class="dash-insight-metric-label">Racha</span>
        <span class="dash-insight-metric-val">${streak}</span>
        <span class="dash-insight-metric-sub">${streak === 1 ? 'día sin gastos' : 'días sin gastos'}</span>
      </div>
      <div class="dash-insight-metric">
        <span class="dash-insight-metric-label">Semana</span>
        <span class="dash-insight-metric-val">${formatCurrency(weekAvg)}</span>
        <span class="dash-insight-metric-sub">/día (lun–vie)</span>
      </div>
      <div class="dash-insight-metric">
        <span class="dash-insight-metric-label">Finde</span>
        <span class="dash-insight-metric-val">${formatCurrency(weekendAvg)}</span>
        <span class="dash-insight-metric-sub">/día (sáb–dom)</span>
      </div>
      <div class="dash-insight-metric">
        <span class="dash-insight-metric-label">Días c/gasto</span>
        <span class="dash-insight-metric-val">${daysWithTx}</span>
        <span class="dash-insight-metric-sub">de ${daysInMonth}</span>
      </div>
    </div>

    <div class="dash-insight-weekdays">
      <div class="dash-insight-weekdays-title">Patrón semanal</div>
      ${wdayBars}
    </div>
  `;
}

function renderAccountCards() {
  const container = document.getElementById('dash-acc-cards');
  if (!container) return;
  const wrap = document.getElementById('dash-section-cuentas');
  if (wrap && wrap.classList.contains('dash-hidden')) { container.innerHTML = ''; return; }

  const accFilter = dashState.accounts !== null ? (dashState.accounts.length > 0 ? new Set(dashState.accounts) : null) : null;

  // Calculate per-account balance from transactions (same logic as sidebar)
  const txBalances = {};
  state.accounts.forEach(a => { txBalances[a.id] = 0; });
  state.transactions.forEach(tx => {
    if (isTxExcluded(tx) || tx.split_parent_id) return;
    if (!isTxInPeriod(tx)) return;
    if (accFilter && !accFilter.has(tx.account_id)) return;
    if (txBalances[tx.account_id] !== undefined) {
      txBalances[tx.account_id] += Number(tx.amount) || 0;
    }
  });

  const accounts = state.accounts.filter(a => !a.excluded && (a.type === 'liquid' || a.type === 'credit_card'));

  if (accounts.length === 0) {
    container.innerHTML = '<div class="dash-empty">No hay cuentas configuradas</div>';
    return;
  }

  const cardColors = ['#5b52f5', '#059669', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#db2777', '#2563eb'];

  container.innerHTML = '<div class="dash-acc-cards-grid">' + accounts.map((acc, i) => {
    const bal = acc.balance + (txBalances[acc.id] || 0);
    const isNegative = bal < 0;
    const color = cardColors[i % cardColors.length];
    const typeLabel = acc.type === 'liquid' ? 'Débito / Efectivo' : 'Tarjeta de crédito';
    const last4 = acc.id.slice(-4).toUpperCase();

    return `<div class="dash-acc-card" onclick="dashGoToAccount('${acc.id}')" title="Ver movimientos de ${acc.name}">
      <svg class="dash-acc-card-svg" viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="acc-grad-${i}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity=".9"/>
            <stop offset="100%" stop-color="${color}" stop-opacity=".55"/>
          </linearGradient>
        </defs>
        <!-- Card background -->
        <rect x="0" y="0" width="320" height="200" rx="12" fill="url(#acc-grad-${i})"/>
        <!-- Top: type + currency -->
        <text x="22" y="26" fill="rgba(255,255,255,0.55)" font-size="9" font-weight="500" font-family="system-ui, sans-serif" letter-spacing="0.5">${typeLabel.toUpperCase()}</text>
        <text x="298" y="26" fill="rgba(255,255,255,0.55)" font-size="9" font-weight="600" font-family="system-ui, sans-serif" text-anchor="end">${acc.currency}</text>
        <!-- Account name -->
        <text x="22" y="46" fill="white" font-size="14" font-weight="600" font-family="system-ui, sans-serif">${acc.name}</text>
        <!-- Black magnetic stripe (near top) -->
        <rect x="0" y="56" width="320" height="32" fill="rgba(0,0,0,0.8)"/>
        <!-- EMV Chip (below stripe, right side) -->
        <rect x="248" y="100" width="40" height="28" rx="5" fill="#e8b830" stroke="rgba(0,0,0,0.12)" stroke-width="0.5"/>
        <line x1="248" y1="110" x2="288" y2="110" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>
        <line x1="268" y1="100" x2="268" y2="128" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>
        <!-- Bottom section: balance + card number -->
        <text x="22" y="118" fill="rgba(255,255,255,0.5)" font-size="9" font-weight="500" font-family="system-ui, sans-serif" letter-spacing="0.3">SALDO</text>
        <text x="22" y="150" fill="white" font-size="24" font-weight="700" font-family="system-ui, sans-serif">${isNegative ? '−' : ''}${formatAccountCurrency(Math.abs(bal), acc.currency)}</text>
        ${isNegative ? '<text x="22" y="168" fill="rgba(255,255,255,0.45)" font-size="10" font-family="system-ui, sans-serif">Saldo negativo</text>' : ''}
        <!-- Card number (last 4) -->
        <text x="22" y="188" fill="rgba(255,255,255,0.35)" font-size="12" font-weight="600" font-family="system-ui, sans-serif" letter-spacing="2">•••• •••• •••• ${last4}</text>
      </svg>
    </div>`;
  }).join('') + '</div>';

  lucide.createIcons();
}

function dashGoToAccount(accountId) {
  filterTransactions(accountId);
}
