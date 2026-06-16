// ═══════════════════════════════════════════════════════════════════════
//  dashboard.js — "nly" style: smooth line/area charts, monthly balance hero
//  Contiene: renderDashboard(), renderDashCharts(), dashState,
//  drawLineChart(), drawDonutChart(), getChartColors().
// ═══════════════════════════════════════════════════════════════════════

// ── DASHBOARD STATE ───────────────────────────────────────────
let dashState = {
  month: null,
  chartMonth: null,
  periodType: 'month',
  accounts: null,
  visibleSections: { resumen: true, categorias: true },
  donutMode: 'expense', // 'expense' | 'income'
  lineChartInstance: null,
  donutChartInstance: null,
  donutIncomeChartInstance: null,
  topMode: 'expense',
  hiddenCats: (() => {
    try {
      const saved = JSON.parse(localStorage.getItem('wallet_hidden_cats'));
      return {
        expenses: new Set(saved?.expenses || ['Ajuste de saldos']),
        income: new Set(saved?.income || ['Ajuste de saldos']),
      };
    } catch { return { expenses: new Set(['Ajuste de saldos']), income: new Set(['Ajuste de saldos']) }; }
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
  let txs;
  if (period.range && (period.range.start || period.range.end)) {
    txs = state.transactions.filter(tx => {
      if (isTxExcluded(tx)) return false;
      if (tx.split_parent_id) return false;
      if (period.range.start && tx.date < period.range.start) return false;
      if (period.range.end && tx.date > period.range.end) return false;
      return true;
    });
  } else if (period.year != null) {
    txs = state.transactions.filter(tx => {
      if (tx.split_parent_id) return false;
      const d = new Date(tx.date + 'T00:00:00');
      return !isTxExcluded(tx) && d.getMonth() === period.month && d.getFullYear() === period.year;
    });
  } else {
    txs = state.transactions.filter(tx => {
      if (tx.split_parent_id) return false;
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
  if (period.range && period.range.start) {
    const start = new Date(period.range.start + 'T00:00:00');
    const end = period.range.end ? new Date(period.range.end + 'T00:00:00') : new Date();
    const durationMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return state.transactions.filter(tx => {
      if (isTxExcluded(tx) || tx.split_parent_id) return false;
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

function dashSetPeriod(type) {
  dashState.periodType = type;
  if (type !== 'month') dashState.month = null;
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

function drawLineChart(canvas, labels, incomeData, expenseData) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width, H = rect.height;
  const padL = 52, padR = 12, padT = 20, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = labels.length;

  const isDark = document.documentElement.classList.contains('theme-dark');
  const textColor = isDark ? '#a1a1aa' : '#71717a';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const incomeColor = '#22c55e';
  const incomeFill = isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)';
  const expenseColor = '#ef4444';
  const expenseFill = isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)';

  const maxVal = Math.max(...incomeData, ...expenseData, 1) * 1.1;

  ctx.clearRect(0, 0, W, H);

  // Grid lines (dashed)
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    const val = maxVal * (1 - i / 4);
    ctx.fillStyle = textColor;
    ctx.font = '10px "DM Sans", -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(0), padL - 6, y + 3.5);
  }
  ctx.setLineDash([]);

  // Helper: smooth curve through points
  function smoothCurve(points) {
    if (points.length < 2) return;
    ctx.moveTo(points[0].x, points[0].y);
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
    return data.map((val, i) => ({
      x: padL + (i / (n - 1)) * chartW,
      y: padT + chartH - (val / maxVal) * chartH,
    }));
  }

  // Income area fill
  const incomePoints = getPoints(incomeData);
  ctx.beginPath();
  ctx.moveTo(incomePoints[0].x, padT + chartH);
  ctx.lineTo(incomePoints[0].x, incomePoints[0].y);
  smoothCurve(incomePoints);
  ctx.lineTo(incomePoints[incomePoints.length - 1].x, padT + chartH);
  ctx.closePath();
  ctx.fillStyle = incomeFill;
  ctx.fill();

  // Expense area fill
  const expensePoints = getPoints(expenseData);
  ctx.beginPath();
  ctx.moveTo(expensePoints[0].x, padT + chartH);
  ctx.lineTo(expensePoints[0].x, expensePoints[0].y);
  smoothCurve(expensePoints);
  ctx.lineTo(expensePoints[expensePoints.length - 1].x, padT + chartH);
  ctx.closePath();
  ctx.fillStyle = expenseFill;
  ctx.fill();

  // Income line
  ctx.beginPath();
  smoothCurve(incomePoints);
  ctx.strokeStyle = incomeColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Expense line
  ctx.beginPath();
  smoothCurve(expensePoints);
  ctx.strokeStyle = expenseColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Data points (dots)
  incomePoints.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = incomeColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  expensePoints.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = expenseColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // X-axis labels
  labels.forEach((label, i) => {
    const cx = padL + (i / (n - 1)) * chartW;
    ctx.fillStyle = textColor;
    ctx.font = '10px "DM Sans", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, H - 8);
  });

  // Legend
  const legY = padT - 4;
  ctx.font = '10px "DM Sans", -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = incomeColor;
  ctx.beginPath();
  ctx.roundRect(padL, legY - 7, 8, 7, 1.5);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.fillText('Ingresos', padL + 12, legY);
  ctx.fillStyle = expenseColor;
  ctx.beginPath();
  ctx.roundRect(padL + 68, legY - 7, 8, 7, 1.5);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.fillText('Gastos', padL + 80, legY);
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
    // Force red for expense card; for others use sign-based
    let valClass = '';
    if (c.iconClass === 'expense') {
      valClass = 'negative';
    } else if (c.value < 0) {
      valClass = 'negative';
    } else if (c.value > 0) {
      valClass = 'positive';
    }

    return `
      <div class="dash-summary-card">
        <div class="dash-summary-card-top">
          <div class="dash-summary-card-icon ${c.iconClass}">
            <i data-lucide="${c.icon}"></i>
          </div>
        </div>
        <div class="dash-summary-card-body">
          <span class="dash-summary-card-label">${c.label}</span>
          <span class="dash-summary-card-value ${valClass}">${c.format(c.value)}</span>
        </div>
        <div class="dash-summary-card-delta neutral">
          ${change !== null
            ? `<i data-lucide="${deltaIcon}"></i> ${changeSign}${change.toFixed(0)}% ${prevLabel ? `<span style="opacity:0.5">${prevLabel}</span>` : ''}`
            : `<i data-lucide="minus"></i> <span style="opacity:0.5">Sin comparación</span>`
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
          <span class="dash-savings-stat-dot" style="background:var(--positive)"></span>
          Ingresos
        </span>
        <span class="dash-savings-stat-val">${formatCurrency(totalIncome)}</span>
      </div>
      <div class="dash-savings-stat">
        <span class="dash-savings-stat-label">
          <span class="dash-savings-stat-dot" style="background:var(--negative)"></span>
          Gastos
        </span>
        <span class="dash-savings-stat-val">${formatCurrency(totalExpenses)}</span>
      </div>
      <div class="dash-savings-stat">
        <span class="dash-savings-stat-label">
          <span class="dash-savings-stat-dot" style="background:var(--accent)"></span>
          Neto
        </span>
        <span class="dash-savings-stat-val" style="color:${savings >= 0 ? 'var(--positive)' : 'var(--negative)'}">${formatCurrency(savings)}</span>
      </div>
    </div>`;

  lucide.createIcons();
}

// ══════════════════════════════════════════════════════════════
//  renderDonutCategories — unified donut + cat list + compare table
// ══════════════════════════════════════════════════════════════
function renderDonutCategories(monthTxs, totalIncome, totalExpenses, prevTxs) {
  const isExp = dashState.donutMode === 'expense';
  const total = isExp ? totalExpenses : totalIncome;
  const filtered = monthTxs.filter(tx => isExp ? tx.amount < 0 : tx.amount > 0);

  // Build category totals
  const catTotals = {};
  filtered.forEach(tx => {
    const cat = tx.category_name || 'Otros';
    catTotals[cat] = (catTotals[cat] || 0) + (isExp ? Math.abs(getTxAmountInSettingsCurrency(tx)) : getTxAmountInSettingsCurrency(tx));
  });
  const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  // Update title
  const title = document.getElementById('dash-donut-title');
  if (title) title.textContent = isExp ? 'Distribución de gastos' : 'Distribución de ingresos';
  const compareTitle = document.getElementById('dash-compare-title');
  if (compareTitle) compareTitle.textContent = `Comparación de ${isExp ? 'gastos' : 'ingresos'} vs período anterior`;

  // Update center total
  const totalEl = document.getElementById('dash-donut-total');
  if (totalEl) totalEl.textContent = formatCurrency(total);

  // Render cat list below donut
  const list = document.getElementById('dash-donut-cat-list');
  if (list) {
    list.innerHTML = '';
    if (entries.length === 0) {
      list.innerHTML = '<div class="dash-empty">Sin datos en este período</div>';
    } else {
      const maxVal = entries[0][1];
      entries.forEach(([cat, amount]) => {
        const pct = maxVal > 0 ? (amount / maxVal) * 100 : 0;
        const totalPct = total > 0 ? (amount / total * 100).toFixed(0) : 0;
        const catObj = state.predefined.categories.find(c => (typeof c === 'string' ? c : c.name) === cat);
        const catIcon = catObj && typeof catObj !== 'string' ? catObj.icon : 'tag';
        const row = document.createElement('div');
        row.className = 'dash-cat-row dash-cat-row-clickable';
        row.title = 'Ver movimientos de "' + cat + '"';
        row.addEventListener('click', () => dashGoToCategory(cat));
        row.innerHTML = `
          <div class="dash-cat-top">
            <span class="dash-cat-label">
              <span class="dash-cat-icon"><i data-lucide="${catIcon}"></i></span>
              <span class="dash-cat-name">${cat}</span>
            </span>
            <span class="dash-cat-amount">${formatCurrency(amount)}<span class="dash-cat-pct">${totalPct}%</span></span>
          </div>
          <div class="dash-cat-bar-track"><div class="dash-cat-bar-fill" style="width:${pct}%"></div></div>
        `;
        list.appendChild(row);
      });
    }
  }

  // ── Comparison table ──
  const compareTable = document.getElementById('dash-compare-table');
  if (compareTable) {
    if (!prevTxs || prevTxs.length === 0 || entries.length === 0) {
      compareTable.innerHTML = '<div class="dash-empty">Sin datos del período anterior para comparar</div>';
    } else {
      // Build previous period totals
      const prevTotals = {};
      prevTxs.forEach(tx => {
        if (isExp ? tx.amount < 0 : tx.amount > 0) {
          const cat = tx.category_name || 'Otros';
          prevTotals[cat] = (prevTotals[cat] || 0) + (isExp ? Math.abs(getTxAmountInSettingsCurrency(tx)) : getTxAmountInSettingsCurrency(tx));
        }
      });
      const prevTotal = Object.values(prevTotals).reduce((a, b) => a + b, 0);

      const allCats = new Set([...entries.map(e => e[0]), ...Object.keys(prevTotals)]);
      let rows = '';
      allCats.forEach(cat => {
        const curAmt = catTotals[cat] || 0;
        const prevAmt = prevTotals[cat] || 0;
        const diff = curAmt - prevAmt;
        const pctChange = prevAmt > 0 ? ((diff / prevAmt) * 100).toFixed(1) : (curAmt > 0 ? '100' : '0');
        const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '—';
        const isUpBad = isExp ? diff > 0 : diff < 0; // for expenses, up is bad; for income, down is bad
        rows += `
          <div class="dash-compare-row">
            <span class="dash-compare-name" onclick="dashGoToCategory('${cat.replace(/'/g, "\\'")}')">${cat}</span>
            <span class="dash-compare-val">${formatCurrency(curAmt)}</span>
            <span class="dash-compare-prev">${formatCurrency(prevAmt)}</span>
            <span class="dash-compare-diff ${diff === 0 ? '' : (isUpBad ? 'comp-bad' : 'comp-good')}">${diff === 0 ? '—' : arrow + ' ' + pctChange + '%'}</span>
          </div>
        `;
      });
      compareTable.innerHTML = `
        <div class="dash-compare-header">
          <span class="dash-compare-hdr">Categoría</span>
          <span class="dash-compare-hdr">Este período</span>
          <span class="dash-compare-hdr">Período anterior</span>
          <span class="dash-compare-hdr">Variación</span>
        </div>
        ${rows}`;
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
    // Trigger input event so any listeners fire
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
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
  const dashIncludeTx = (tx) => {
    if (isTxExcluded(tx) || tx.split_parent_id) return false;
    const acc = state.accounts.find(a => a.id === tx.account_id);
    if (acc && acc.type === 'credit_card') return true;
    return !tx.is_future;
  };

  const monthTxs = dashGetTxForPeriod().filter(tx => dashIncludeTx(tx));
  const prevTxs  = dashGetPrevTxForPeriod().filter(tx => dashIncludeTx(tx));

  let totalIncome = 0, totalExpenses = 0;
  monthTxs.forEach(tx => {
    const val = getTxAmountInSettingsCurrency(tx);
    if (val > 0) totalIncome += val;
    else totalExpenses += Math.abs(val);
  });
  const netDiff = totalIncome - totalExpenses;

  let prevIncome = 0, prevExpenses = 0;
  prevTxs.forEach(tx => {
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
  // Draw charts
  setTimeout(() => {
    renderDashCharts();
    dashUpdateChartLabel();
  }, 30);
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
  const end = dashGetChartEndMonth();
  const numMonths = 6;
  for (let i = numMonths - 1; i >= 0; i--) {
    let m = end.month - i, y = end.year;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    const d = new Date(y, m, 1);
    const label = d.toLocaleDateString('es-UY', { month: 'short' }).replace('.', '');
    labels.push(label.charAt(0).toUpperCase() + label.slice(1));
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
    incomeData.push(inc);
    expenseData.push(exp);
  }
  drawLineChart(lineCanvas, labels, incomeData, expenseData);
}

function renderDashCharts() {
  renderLineChart();

  // ── Donut chart (based on donutMode) ──
  const donutCanvas = document.getElementById('dash-donut-chart');
  if (donutCanvas && dashState.visibleSections.categorias && donutCanvas.offsetWidth > 0) {
    const isExp = dashState.donutMode === 'expense';
    const monthTxs = dashGetTxForPeriod().filter(tx => dashIncludeTx(tx));
    const catTotals = {};
    monthTxs.filter(tx => isExp ? tx.amount < 0 : tx.amount > 0).forEach(tx => {
      const cat = tx.category_name || 'Otros';
      catTotals[cat] = (catTotals[cat] || 0) + (isExp ? Math.abs(getTxAmountInSettingsCurrency(tx)) : getTxAmountInSettingsCurrency(tx));
    });
    const allSorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const dColorMap = {};
    getChartColors(allSorted.length).forEach((c, i) => { dColorMap[allSorted[i][0]] = c; });
    const entries = allSorted.slice(0, 8);
    const colors = entries.map(([k]) => dColorMap[k] || '#6b7280');
    drawDonutChart(donutCanvas, null, entries.map(e => e[1]), entries.map(e => e[0]), colors, isExp ? 'Total gastos' : 'Total ingresos');
  }
}

// helper needed by renderDashCharts
function dashIncludeTx(tx) {
  if (isTxExcluded(tx) || tx.split_parent_id) return false;
  const acc = state.accounts.find(a => a.id === tx.account_id);
  if (acc && acc.type === 'credit_card') return true;
  return !tx.is_future;
}
