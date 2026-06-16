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
  visibleSections: { resumen: true, gastos: true, ingresos: true },
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
    tooltip.innerHTML = `<strong>${found.label}</strong><br>${formatCurrency(found.value)} <span style="color:var(--text-lo)">(${pct}%)</span>`;
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



// ── MAIN renderDashboard ──────────────────────────────────────

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

  // ── Metric cards with deltas ──
  const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  setEl('dash-income', formatCurrency(totalIncome));
  setEl('dash-expenses', formatCurrency(totalExpenses));
  const netEl = document.getElementById('dash-net');
  if (netEl) {
    netEl.textContent = (netDiff >= 0 ? '+' : '') + formatCurrency(netDiff);
    const amtStyle = state.settings.amountStyle || 'default';
    const showDashColor = amtStyle !== 'no-color';
    netEl.className = 'dash-metric-val' + (showDashColor ? (netDiff < 0 ? ' expense' : netDiff > 0 ? ' income' : '') : '');
  }
  setEl('dash-tx-count', monthTxs.length);

  // Metric deltas
  dashRenderDelta('dash-income-delta', totalIncome, prevIncome);
  dashRenderDelta('dash-expenses-delta', totalExpenses, prevExpenses);
  dashRenderDelta('dash-net-delta', netDiff, prevNetDiff);
  dashRenderDelta('dash-count-delta', monthTxs.length, prevTxs.length);

  // ── Hero balance (big number) ──
  const heroBalance = document.getElementById('dash-hero-balance');
  if (heroBalance) {
    heroBalance.textContent = (netDiff >= 0 ? '+' : '') + formatCurrency(netDiff);
    heroBalance.className = 'dash-hero-balance' + (netDiff < 0 ? ' negative' : netDiff > 0 ? ' positive' : '');
  }
  const heroSavings = document.getElementById('dash-hero-savings');
  if (heroSavings) {
    const savingsPct = totalIncome > 0 ? ((netDiff / totalIncome) * 100) : 0;
    heroSavings.textContent = totalIncome > 0
      ? `Ahorrás ${savingsPct.toFixed(0)}% de tus ingresos`
      : 'Sin ingresos en este período';
  }

  // ── Hero summary cards (account balances) ──
  const accBalances = {};
  state.accounts.forEach(acc => { accBalances[acc.id] = 0; });
  state.transactions.forEach(tx => {
    if (!includeCcFutureTx(tx)) return;
    if (isTxExcluded(tx)) return;
    if (tx.split_parent_id) return;
    if (!isTxInPeriod(tx)) return;
    if (accBalances[tx.account_id] !== undefined) {
      accBalances[tx.account_id] += Number(tx.amount) || 0;
    }
  });

  const settingsCur = state.settings.currency || 'UYU';
  let totalLiquid = 0, totalCC = 0, totalReceivables = 0;
  const hasLiquidAcc = state.accounts.some(a => a.type === 'liquid');
  const hasCCAcc = state.accounts.some(a => a.type === 'credit_card');
  state.accounts.forEach(acc => {
    const running = accBalances[acc.id] || 0;
    const cur = acc.currency || settingsCur;
    const converted = convertCurrency(acc.balance + running, cur, settingsCur);
    const val = (converted !== null && converted !== undefined) ? converted : (acc.balance + running);
    if (acc.type === 'liquid') totalLiquid += val;
    else if (acc.type === 'credit_card') totalCC += val;
    else totalReceivables += val;
  });

  setEl('dash-hero-liquid', formatCurrency(totalLiquid));
  setEl('dash-hero-cc', formatCurrency(totalCC));

  const liquidEl = document.getElementById('dash-hero-liquid');
  const ccEl = document.getElementById('dash-hero-cc');
  if (liquidEl) liquidEl.classList.toggle('negative', totalLiquid < 0);
  if (ccEl) ccEl.classList.toggle('negative', totalCC < 0);

  const liquidCard = document.getElementById('dash-hero-liquid')?.closest('.dash-hero-card');
  const ccCard = document.getElementById('dash-hero-cc')?.closest('.dash-hero-card');
  if (liquidCard) liquidCard.style.display = hasLiquidAcc ? '' : 'none';
  if (ccCard) ccCard.style.display = hasCCAcc ? '' : 'none';

  const thirdCard = document.getElementById('dash-hero-third-card');
  const heroCards = document.getElementById('dash-hero-cards');
  const customAccs = state.accounts.filter(a => a.type !== 'liquid' && a.type !== 'credit_card');
  if (thirdCard) {
    const showThird = customAccs.length > 0;
    thirdCard.style.display = showThird ? '' : 'none';
    if (heroCards) heroCards.classList.toggle('two-cols', !showThird);
    if (showThird) {
      setEl('dash-hero-third-val', formatCurrency(totalReceivables));
      const thirdValEl = document.getElementById('dash-hero-third-val');
      if (thirdValEl) thirdValEl.classList.toggle('negative', totalReceivables < 0);
      const typeDef = (state.predefined.account_types || []).find(t => t.id === customAccs[0].type);
      const label = document.getElementById('dash-hero-third-label');
      if (label) label.textContent = typeDef ? typeDef.label : customAccs[0].type;
    }
  }

  // ── Category breakdown (expenses) ──
  const catTotals = {};
  monthTxs.filter(tx => tx.amount < 0).forEach(tx => {
    const cat = tx.category_name || 'Otros';
    catTotals[cat] = (catTotals[cat] || 0) + Math.abs(getTxAmountInSettingsCurrency(tx));
  });
  const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const maxCat = catEntries.length > 0 ? catEntries[0][1] : 0;
  const catColorMap = {};
  getChartColors(catEntries.length).forEach((c, i) => { catColorMap[catEntries[i][0]] = c; });
  const hiddenExp = dashState.hiddenCats.expenses || new Set();
  const catSorted = [...catEntries].sort((a, b) => {
    const ha = hiddenExp.has(a[0]) ? 1 : 0;
    const hb = hiddenExp.has(b[0]) ? 1 : 0;
    if (ha !== hb) return ha - hb;
    return b[1] - a[1];
  });

  const catList = document.getElementById('dash-category-list');
  if (catList) {
    catList.innerHTML = '';
    if (catEntries.length === 0) {
      catList.innerHTML = '<div class="dash-empty">Sin gastos en este período</div>';
    } else {
      catSorted.forEach(([cat, amount]) => {
        const pct = maxCat > 0 ? (amount / maxCat) * 100 : 0;
        const totalPct = totalExpenses > 0 ? (amount / totalExpenses * 100).toFixed(0) : 0;
        const catObj = state.predefined.categories.find(c => (typeof c === 'string' ? c : c.name) === cat);
        const catIcon = catObj && typeof catObj !== 'string' ? catObj.icon : 'tag';
        const isHidden = hiddenExp.has(cat);
        const color = catColorMap[cat] || 'var(--text-lo)';
        const row = document.createElement('div');
        row.className = 'dash-cat-row' + (isHidden ? ' cat-hidden' : '');
        row.innerHTML = `
          <div class="dash-cat-top">
            <span class="dash-cat-label">
              <span class="dash-cat-icon" style="color:${color}"><i data-lucide="${catIcon}"></i></span>
              <span class="dash-cat-name">${cat}</span>
              <button class="dash-cat-eye" onclick="event.stopPropagation();dashToggleCat('${cat.replace(/'/g, "\\'")}','expense')" title="${isHidden ? 'Mostrar' : 'Ocultar'}">
                <i data-lucide="${isHidden ? 'eye-off' : 'eye'}"></i>
              </button>
            </span>
            <span class="dash-cat-amount">${formatCurrency(amount)}<span class="dash-cat-pct">${totalPct}%</span></span>
          </div>
          <div class="dash-cat-bar-track"><div class="dash-cat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        `;
        catList.appendChild(row);
      });
    }
  }

  // ── Category breakdown (income) ──
  const incomeCatTotals = {};
  monthTxs.filter(tx => tx.amount > 0).forEach(tx => {
    const cat = tx.category_name || 'Otros';
    incomeCatTotals[cat] = (incomeCatTotals[cat] || 0) + getTxAmountInSettingsCurrency(tx);
  });
  const incomeCatEntries = Object.entries(incomeCatTotals).sort((a, b) => b[1] - a[1]);
  const maxIncomeCat = incomeCatEntries.length > 0 ? incomeCatEntries[0][1] : 0;
  const incomeCatColorMap = {};
  getChartColors(incomeCatEntries.length).forEach((c, i) => { incomeCatColorMap[incomeCatEntries[i][0]] = c; });
  const hiddenInc = dashState.hiddenCats.income || new Set();
  const incomeCatSorted = [...incomeCatEntries].sort((a, b) => {
    const ha = hiddenInc.has(a[0]) ? 1 : 0;
    const hb = hiddenInc.has(b[0]) ? 1 : 0;
    if (ha !== hb) return ha - hb;
    return b[1] - a[1];
  });

  const incomeCatList = document.getElementById('dash-income-category-list');
  if (incomeCatList) {
    incomeCatList.innerHTML = '';
    if (incomeCatEntries.length === 0) {
      incomeCatList.innerHTML = '<div class="dash-empty">Sin ingresos en este período</div>';
    } else {
      incomeCatSorted.forEach(([cat, amount]) => {
        const pct = maxIncomeCat > 0 ? (amount / maxIncomeCat) * 100 : 0;
        const totalPct = totalIncome > 0 ? (amount / totalIncome * 100).toFixed(0) : 0;
        const catObj = state.predefined.categories.find(c => (typeof c === 'string' ? c : c.name) === cat);
        const catIcon = catObj && typeof catObj !== 'string' ? catObj.icon : 'tag';
        const isHidden = hiddenInc.has(cat);
        const color = incomeCatColorMap[cat] || 'var(--text-lo)';
        const row = document.createElement('div');
        row.className = 'dash-cat-row' + (isHidden ? ' cat-hidden' : '');
        row.innerHTML = `
          <div class="dash-cat-top">
            <span class="dash-cat-label">
              <span class="dash-cat-icon" style="color:${color}"><i data-lucide="${catIcon}"></i></span>
              <span class="dash-cat-name">${cat}</span>
              <button class="dash-cat-eye" onclick="event.stopPropagation();dashToggleCat('${cat.replace(/'/g, "\\'")}','income')" title="${isHidden ? 'Mostrar' : 'Ocultar'}">
                <i data-lucide="${isHidden ? 'eye-off' : 'eye'}"></i>
              </button>
            </span>
            <span class="dash-cat-amount">${formatCurrency(amount)}<span class="dash-cat-pct">${totalPct}%</span></span>
          </div>
          <div class="dash-cat-bar-track"><div class="dash-cat-bar-fill income-fill" style="width:${pct}%;background:${color}"></div></div>
        `;
        incomeCatList.appendChild(row);
      });
    }
  }

  // ── Donut totals ──
  const donutTotal = document.getElementById('dash-donut-total');
  if (donutTotal) donutTotal.textContent = formatCurrency(totalExpenses);
  const donutIncomeTotal = document.getElementById('dash-donut-income-total');
  if (donutIncomeTotal) donutIncomeTotal.textContent = formatCurrency(totalIncome);

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

  // ── Donut chart (expenses) ──
  const donutCanvas = document.getElementById('dash-donut-chart');
  if (donutCanvas && dashState.visibleSections.gastos && donutCanvas.offsetWidth > 0) {
    const monthTxs = dashGetTxForPeriod().filter(tx => dashIncludeTx(tx));
    const catTotals = {};
    monthTxs.filter(tx => tx.amount < 0).forEach(tx => {
      const cat = tx.category_name || 'Otros';
      catTotals[cat] = (catTotals[cat] || 0) + Math.abs(getTxAmountInSettingsCurrency(tx));
    });
    const allSorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const dColorMap = {};
    getChartColors(allSorted.length).forEach((c, i) => { dColorMap[allSorted[i][0]] = c; });
    const hiddenExp = dashState.hiddenCats.expenses || new Set();
    const entries = allSorted.filter(([k]) => !hiddenExp.has(k)).slice(0, 8);
    const colors = entries.map(([k]) => dColorMap[k] || '#6b7280');
    drawDonutChart(donutCanvas, null, entries.map(e => e[1]), entries.map(e => e[0]), colors, 'Total gastos');
  }

  // ── Donut chart (income) ──
  const donutIncomeCanvas = document.getElementById('dash-donut-income-chart');
  if (donutIncomeCanvas && dashState.visibleSections.ingresos && donutIncomeCanvas.offsetWidth > 0) {
    const monthTxs = dashGetTxForPeriod().filter(tx => dashIncludeTx(tx));
    const catTotals = {};
    monthTxs.filter(tx => tx.amount > 0).forEach(tx => {
      const cat = tx.category_name || 'Otros';
      catTotals[cat] = (catTotals[cat] || 0) + getTxAmountInSettingsCurrency(tx);
    });
    const allSorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const dColorMap = {};
    getChartColors(allSorted.length).forEach((c, i) => { dColorMap[allSorted[i][0]] = c; });
    const hiddenInc = dashState.hiddenCats.income || new Set();
    const entries = allSorted.filter(([k]) => !hiddenInc.has(k)).slice(0, 8);
    const colors = entries.map(([k]) => dColorMap[k] || '#6b7280');
    drawDonutChart(donutIncomeCanvas, null, entries.map(e => e[1]), entries.map(e => e[0]), colors, 'Total ingresos');
  }
}

// helper needed by renderDashCharts
function dashIncludeTx(tx) {
  if (isTxExcluded(tx) || tx.split_parent_id) return false;
  const acc = state.accounts.find(a => a.id === tx.account_id);
  if (acc && acc.type === 'credit_card') return true;
  return !tx.is_future;
}
