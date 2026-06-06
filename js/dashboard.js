// ═══════════════════════════════════════════════════════════════════════
//  dashboard.js — Dashboard con resumen mensual, categorías y cobertura
//  Contiene: renderDashboard(), renderDashCharts(), dashState,
//  dashPrevMonth(), dashNextMonth(), dashGetPeriod(), switchDashTab(),
//  destroyChart(), getChartColors(), drawBarChart(), drawDonutChart().
// ═══════════════════════════════════════════════════════════════════════

// ── DASHBOARD STATE ───────────────────────────────────────────
let dashState = {
  month: null, // { year, month } — null = current
  activeTab: 'resumen',
  barChartInstance: null,
  donutChartInstance: null,
  donutIncomeChartInstance: null,
};

function dashGetPeriod() {
  if (dashState.month) return dashState.month;
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function dashPrevMonth() {
  const p = dashGetPeriod();
  let m = p.month - 1, y = p.year;
  if (m < 0) { m = 11; y--; }
  dashState.month = { year: y, month: m };
  renderDashboard();
}

function dashNextMonth() {
  const p = dashGetPeriod();
  let m = p.month + 1, y = p.year;
  if (m > 11) { m = 0; y++; }
  dashState.month = { year: y, month: m };
  renderDashboard();
}

function switchDashTab(name) {
  ['resumen','gastos','ingresos','cobertura'].forEach(t => {
    document.getElementById('dash-tab-' + t)?.classList.toggle('active', t === name);
    document.getElementById('dash-panel-' + t)?.classList.toggle('active', t === name);
  });
  dashState.activeTab = name;
  // Trigger chart redraws after panel becomes visible
  setTimeout(() => renderDashCharts(), 10);
}

// ── Chart helpers (pure canvas, no dependencies) ──────────────

function destroyChart(instance) {
  if (instance && typeof instance.destroy === 'function') instance.destroy();
}

function getChartColors(n) {
  const palette = [
    '#818cf8','#7dd3fc','#6ee7b7','#fcd34d','#fda4af',
    '#c4b5fd','#fdba74','#bef264','#67e8f9','#f9a8d4',
  ];
  return Array.from({ length: n }, (_, i) => palette[i % palette.length]);
}

function drawBarChart(canvas, labels, incomeData, expenseData) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width, H = rect.height;
  const padL = 52, padR = 12, padT = 16, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = labels.length;
  const groupW = chartW / n;
  const barW = Math.min(18, groupW * 0.35);
  const gap = 3;

  // styles
  const isDark = document.body.classList.contains('theme-dark');
  const textColor = isDark ? '#a1a1aa' : '#71717a';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const incomeColor = isDark ? '#6ee7b7' : '#34d399';
  const expenseColor = isDark ? '#fda4af' : '#fb7185';

  const maxVal = Math.max(...incomeData, ...expenseData, 1);

  // grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    const val = maxVal * (1 - i / 4);
    ctx.fillStyle = textColor;
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(0), padL - 5, y + 3.5);
  }

  // bars
  labels.forEach((label, i) => {
    const cx = padL + i * groupW + groupW / 2;
    // income bar
    const iH = (incomeData[i] / maxVal) * chartH;
    ctx.fillStyle = incomeColor;
    ctx.beginPath();
    ctx.roundRect(cx - barW - gap / 2, padT + chartH - iH, barW, iH, [3, 3, 0, 0]);
    ctx.fill();
    // expense bar
    const eH = (expenseData[i] / maxVal) * chartH;
    ctx.fillStyle = expenseColor;
    ctx.beginPath();
    ctx.roundRect(cx + gap / 2, padT + chartH - eH, barW, eH, [3, 3, 0, 0]);
    ctx.fill();

    // label
    ctx.fillStyle = textColor;
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, H - 8);
  });

  // Legend
  const legY = padT - 4;
  ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = incomeColor;
  ctx.fillRect(padL, legY - 7, 10, 7);
  ctx.fillStyle = textColor;
  ctx.fillText('Ingresos', padL + 13, legY);
  ctx.fillStyle = expenseColor;
  ctx.fillRect(padL + 70, legY - 7, 10, 7);
  ctx.fillStyle = textColor;
  ctx.fillText('Gastos', padL + 83, legY);
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
  const innerR = outerR * 0.62;

  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) {
    const isDark = document.body.classList.contains('theme-dark');
    ctx.strokeStyle = isDark ? '#303036' : '#e3e0db';
    ctx.lineWidth = outerR - innerR;
    ctx.beginPath();
    ctx.arc(cx, cy, (outerR + innerR) / 2, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  let startAngle = -Math.PI / 2;
  values.forEach((v, i) => {
    const sweep = (v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep);
    ctx.closePath();
    // Outer
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep);
    ctx.arc(cx, cy, innerR, startAngle + sweep, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    startAngle += sweep;
  });
}

// ── MAIN renderDashboard ──────────────────────────────────────
function renderDashboard() {
  const balances = calculateBalances();
  const period = dashGetPeriod();
  const now = new Date();

  // ── Greeting ──
  const hour = now.getHours();
  let greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const greetEl = document.getElementById('dash-greeting');
  if (greetEl) greetEl.textContent = greet;

  const dateEl = document.getElementById('dash-date-display');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ── Net worth in banner ──
  const liquidCov = balances.liquid + balances.credit_card;
  const projCov   = balances.liquid + balances.receivables + balances.credit_card;
  const netWorth  = liquidCov + balances.receivables;
  const nwEl = document.getElementById('dash-net-worth');
  if (nwEl) nwEl.textContent = formatCurrency(netWorth);

  // ── Month label ──
  const monthLabel = document.getElementById('dash-month-label');
  if (monthLabel) {
    const d = new Date(period.year, period.month, 1);
    monthLabel.textContent = d.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })
      .replace(/^./, s => s.toUpperCase());
  }

  // ── Filter transactions for selected month ──
  const monthTxs = state.transactions.filter(tx => {
    const d = new Date(tx.date + 'T00:00:00');
    return d.getMonth() === period.month && d.getFullYear() === period.year;
  });

  let totalIncome = 0, totalExpenses = 0;
  monthTxs.forEach(tx => {
    if (tx.amount > 0) totalIncome += tx.amount;
    else totalExpenses += Math.abs(tx.amount);
  });
  const netDiff = totalIncome - totalExpenses;

  // ── Metric strip ──
  const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  setEl('dash-income', formatCurrency(totalIncome));
  setEl('dash-expenses', formatCurrency(totalExpenses));
  const netEl = document.getElementById('dash-net');
  if (netEl) {
    netEl.textContent = (netDiff >= 0 ? '+' : '') + formatCurrency(netDiff);
    netEl.className = 'dash-strip-val' + (netDiff < 0 ? ' expense' : netDiff > 0 ? ' income' : '');
  }
  setEl('dash-tx-count', monthTxs.length);

  // ── Savings rate ──
  const savingsPct = totalIncome > 0 ? Math.max(0, Math.min(100, (netDiff / totalIncome) * 100)) : 0;
  const savingsFill = document.getElementById('dash-savings-fill');
  const savingsPctEl = document.getElementById('dash-savings-pct');
  const savingsDesc = document.getElementById('dash-savings-desc');
  if (savingsFill) savingsFill.style.width = savingsPct.toFixed(1) + '%';
  if (savingsPctEl) savingsPctEl.textContent = savingsPct.toFixed(1) + '%';
  if (savingsDesc) {
    if (totalIncome === 0) savingsDesc.textContent = 'Sin ingresos registrados en este período.';
    else if (savingsPct <= 0) savingsDesc.textContent = 'Los gastos superan los ingresos este mes.';
    else if (savingsPct < 10) savingsDesc.textContent = `Ahorrás ${savingsPct.toFixed(1)}% de tus ingresos. Meta sugerida: 20%.`;
    else if (savingsPct < 20) savingsDesc.textContent = `Ahorrás ${savingsPct.toFixed(1)}% de tus ingresos. Vas bien, seguí así.`;
    else savingsDesc.textContent = `¡Excelente! Ahorrás ${savingsPct.toFixed(1)}% de tus ingresos este mes.`;
  }

  // ── Coverage tab ──
  setEl('dash-liquid-cov', formatCurrency(liquidCov));
  setEl('dash-proj-cov', formatCurrency(projCov));
  setEl('dash-net-worth-tab', formatCurrency(netWorth));

  const covDetails = document.getElementById('dash-cov-details');
  if (covDetails) {
    const rows = [
      { label: 'Efectivo disponible (cuentas líquidas)', val: balances.liquid, max: Math.max(balances.liquid, 1) },
      { label: 'Deuda en tarjetas de crédito', val: balances.credit_card, max: Math.max(Math.abs(balances.credit_card), 1), invert: true },
      { label: 'Préstamos a cobrar', val: balances.receivables, max: Math.max(balances.receivables, 1) },
    ];
    covDetails.innerHTML = rows.map(r => {
      const pct = Math.min(100, r.max > 0 ? Math.abs(r.val) / r.max * 100 : 0);
      const colorClass = r.invert ? (r.val < 0 ? 'bad' : 'ok') : (r.val > 0 ? 'ok' : r.val < 0 ? 'bad' : 'warn');
      return `<div class="dash-cov-detail-row">
        <div class="dash-cov-detail-top">
          <span class="dash-cov-detail-label">${r.label}</span>
          <span class="dash-cov-detail-val">${formatCurrency(r.val)}</span>
        </div>
        <div class="dash-cov-bar-track"><div class="dash-cov-bar-fill ${colorClass}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  // ── Category breakdown (expenses) ──
  const catTotals = {};
  monthTxs.filter(tx => tx.amount < 0).forEach(tx => {
    const cat = tx.category_name || 'Otros';
    catTotals[cat] = (catTotals[cat] || 0) + Math.abs(tx.amount);
  });
  const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const maxCat = catEntries.length > 0 ? catEntries[0][1] : 0;

  const catList = document.getElementById('dash-category-list');
  if (catList) {
    catList.innerHTML = '';
    if (catEntries.length === 0) {
      catList.innerHTML = '<div class="dash-empty">Sin gastos este mes</div>';
    } else {
      catEntries.forEach(([cat, amount], idx) => {
        const pct = maxCat > 0 ? (amount / maxCat) * 100 : 0;
        const totalPct = totalExpenses > 0 ? (amount / totalExpenses * 100).toFixed(0) : 0;
        const catObj = state.predefined.categories.find(c => (typeof c === 'string' ? c : c.name) === cat);
        const catIcon = catObj && typeof catObj !== 'string' ? catObj.icon : 'tag';
        const row = document.createElement('div');
        row.className = 'dash-cat-row';
        row.innerHTML = `
          <div class="dash-cat-top">
            <span class="dash-cat-label"><span class="dash-cat-icon"><i data-lucide="${catIcon}"></i></span>${cat}</span>
            <span class="dash-cat-amount">${formatCurrency(amount)}<span class="dash-cat-pct">${totalPct}%</span></span>
          </div>
          <div class="dash-cat-bar-track"><div class="dash-cat-bar-fill" style="width:${pct}%"></div></div>
        `;
        catList.appendChild(row);
      });
    }
  }

  // ── Category breakdown (income) ──
  const incomeCatTotals = {};
  monthTxs.filter(tx => tx.amount > 0).forEach(tx => {
    const cat = tx.category_name || 'Otros';
    incomeCatTotals[cat] = (incomeCatTotals[cat] || 0) + tx.amount;
  });
  const incomeCatEntries = Object.entries(incomeCatTotals).sort((a, b) => b[1] - a[1]);
  const maxIncomeCat = incomeCatEntries.length > 0 ? incomeCatEntries[0][1] : 0;

  const incomeCatList = document.getElementById('dash-income-category-list');
  if (incomeCatList) {
    incomeCatList.innerHTML = '';
    if (incomeCatEntries.length === 0) {
      incomeCatList.innerHTML = '<div class="dash-empty">Sin ingresos este mes</div>';
    } else {
      incomeCatEntries.forEach(([cat, amount]) => {
        const pct = maxIncomeCat > 0 ? (amount / maxIncomeCat) * 100 : 0;
        const totalPct = totalIncome > 0 ? (amount / totalIncome * 100).toFixed(0) : 0;
        const catObj = state.predefined.categories.find(c => (typeof c === 'string' ? c : c.name) === cat);
        const catIcon = catObj && typeof catObj !== 'string' ? catObj.icon : 'tag';
        const row = document.createElement('div');
        row.className = 'dash-cat-row';
        row.innerHTML = `
          <div class="dash-cat-top">
            <span class="dash-cat-label"><span class="dash-cat-icon"><i data-lucide="${catIcon}"></i></span>${cat}</span>
            <span class="dash-cat-amount">${formatCurrency(amount)}<span class="dash-cat-pct">${totalPct}%</span></span>
          </div>
          <div class="dash-cat-bar-track"><div class="dash-cat-bar-fill income-fill" style="width:${pct}%"></div></div>
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

  // ── Recent activity ──
  const recentList = document.getElementById('dash-recent-list');
  if (recentList) {
    recentList.innerHTML = '';
    const recent = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    if (recent.length === 0) {
      recentList.innerHTML = '<div class="dash-empty">Sin movimientos aún</div>';
    } else {
      recent.forEach(tx => {
        const isExpense = tx.amount < 0;
        const item = document.createElement('div');
        item.className = 'dash-recent-item';
        item.innerHTML = `
          <span class="dash-recent-date">${formatDate(tx.date)}</span>
          <span class="dash-recent-dot ${isExpense ? 'expense' : 'income'}"></span>
          <span class="dash-recent-payee">${tx.payee || '—'}</span>
          <span class="dash-recent-amount ${isExpense ? 'expense' : 'income'}">${isExpense ? '-' : '+'}${formatCurrency(Math.abs(tx.amount))}</span>
        `;
        recentList.appendChild(item);
      });
    }
  }

  lucide.createIcons();
  // Draw charts
  setTimeout(() => renderDashCharts(), 30);
}

function renderDashCharts() {
  // ── Bar chart (last 6 months) ──
  const barCanvas = document.getElementById('dash-bar-chart');
  if (barCanvas && barCanvas.offsetWidth > 0) {
    const labels = [];
    const incomeData = [];
    const expenseData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth(), y = d.getFullYear();
      const label = d.toLocaleDateString('es-UY', { month: 'short' }).replace('.', '');
      labels.push(label.charAt(0).toUpperCase() + label.slice(1));
      let inc = 0, exp = 0;
      state.transactions.forEach(tx => {
        const td = new Date(tx.date + 'T00:00:00');
        if (td.getMonth() === m && td.getFullYear() === y) {
          if (tx.amount > 0) inc += tx.amount;
          else exp += Math.abs(tx.amount);
        }
      });
      incomeData.push(inc);
      expenseData.push(exp);
    }
    drawBarChart(barCanvas, labels, incomeData, expenseData);
  }

  // ── Donut chart (expenses) ──
  const donutCanvas = document.getElementById('dash-donut-chart');
  if (donutCanvas && donutCanvas.offsetWidth > 0) {
    const period = dashGetPeriod();
    const monthTxs = state.transactions.filter(tx => {
      const d = new Date(tx.date + 'T00:00:00');
      return d.getMonth() === period.month && d.getFullYear() === period.year;
    });
    const catTotals = {};
    monthTxs.filter(tx => tx.amount < 0).forEach(tx => {
      const cat = tx.category_name || 'Otros';
      catTotals[cat] = (catTotals[cat] || 0) + Math.abs(tx.amount);
    });
    const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const colors = getChartColors(entries.length);
    drawDonutChart(donutCanvas, null, entries.map(e => e[1]), entries.map(e => e[0]), colors, 'Total gastos');
  }

  // ── Donut chart (income) ──
  const donutIncomeCanvas = document.getElementById('dash-donut-income-chart');
  if (donutIncomeCanvas && donutIncomeCanvas.offsetWidth > 0) {
    const period = dashGetPeriod();
    const monthTxs = state.transactions.filter(tx => {
      const d = new Date(tx.date + 'T00:00:00');
      return d.getMonth() === period.month && d.getFullYear() === period.year;
    });
    const catTotals = {};
    monthTxs.filter(tx => tx.amount > 0).forEach(tx => {
      const cat = tx.category_name || 'Otros';
      catTotals[cat] = (catTotals[cat] || 0) + tx.amount;
    });
    const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const colors = getChartColors(entries.length).map((_, i) => {
      const greens = ['#22c55e','#4ade80','#16a34a','#86efac','#15803d','#bbf7d0','#166534','#dcfce7'];
      return greens[i % greens.length];
    });
    drawDonutChart(donutIncomeCanvas, null, entries.map(e => e[1]), entries.map(e => e[0]), colors, 'Total ingresos');
  }
}
