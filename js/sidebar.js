// ═══════════════════════════════════════════════════════════════════════
//  sidebar.js — Renderizado del sidebar y filtrado por cuenta
//  Contiene: renderSidebar(), filterTransactions(viewId),
//  renderHeaderAndMetrics(), togglePeriodDropdown(), setPeriod().
// ═══════════════════════════════════════════════════════════════════════

// ── PERIOD DROPDOWN ──────────────────────────────────────────
function togglePeriodDropdown() {
  const dd = document.getElementById('period-dropdown');
  if (dd) dd.classList.toggle('open');
}

function closePeriodDropdown() {
  const dd = document.getElementById('period-dropdown');
  if (dd) dd.classList.remove('open');
}

function setPeriod(type) {
  state.period.type = type;
  if (type !== 'custom') {
    state.period.startDate = null;
    state.period.endDate = null;
  }
  savePeriod();
  closePeriodDropdown();
  updatePeriodLabel();
  renderAll();
}

function updatePeriodLabel() {
  const el = document.getElementById('period-label');
  if (el) el.textContent = getPeriodLabel();
  // Highlight active option
  document.querySelectorAll('.period-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === state.period.type);
  });
}

// ── RENDER ALL ────────────────────────────────────────────────
function renderSidebar() {
  const listLiquid = document.getElementById('sidebar-liquid-list');
  const listCredit = document.getElementById('sidebar-credit-list');
  if (listLiquid) listLiquid.innerHTML = '';
  if (listCredit) listCredit.innerHTML = '';

  // Compute running balances filtered by period
  const settingsCur = state.settings.currency || 'ARS';
  const accBalances = {};
  state.accounts.forEach(acc => { accBalances[acc.id] = 0; });
  state.transactions.forEach(tx => {
    if (tx.is_future) return;
    if (!isTxInPeriod(tx)) return;
    if (accBalances[tx.account_id] !== undefined) {
      accBalances[tx.account_id] += Number(tx.amount) || 0;
    }
  });

  const makeItem = (acc) => {
    const li = document.createElement('li');
    const isActive = state.selectedAccounts.length > 0
      ? state.selectedAccounts.includes(acc.id)
      : state.currentView === acc.id;
    li.className = 'account-item-sidebar' + (isActive ? ' active' : '');
    li.onclick = (e) => {
      const onDashboard = document.getElementById('view-dashboard')?.style.display !== 'none';
      if (e.ctrlKey || e.metaKey) {
        if (onDashboard) {
          dashToggleAccountSidebar(acc.id);
        } else {
          toggleAccountSelection(acc.id);
        }
      } else {
        filterTransactions(acc.id);
      }
    };
    const val = accBalances[acc.id];
    const accCurrency = acc.currency || settingsCur;
    const tooltip = getConvertedTooltip(val, accCurrency);
    const showCurrencyCode = accCurrency !== settingsCur;
    li.innerHTML = `
      <span class="acc-name-sidebar">${acc.name}${showCurrencyCode ? ' <span class="acc-currency-code">' + accCurrency + '</span>' : ''}</span>
      <span class="acc-balance-sidebar ${val < 0 ? 'negative' : ''}" ${tooltip ? 'title="' + tooltip + '"' : ''}>${formatAccountCurrency(val, accCurrency)}</span>
    `;
    return li;
  };

  if (listLiquid) state.accounts.filter(a => a.type === 'liquid').forEach(acc => listLiquid.appendChild(makeItem(acc)));
  if (listCredit) state.accounts.filter(a => a.type === 'credit_card').forEach(acc => listCredit.appendChild(makeItem(acc)));

  // Net worth
  const balances  = calculateBalances();
  const netWorth  = balances.liquid + balances.receivables + balances.credit_card;
  const netEl     = document.getElementById('net-worth-val');
  if (netEl) {
    netEl.textContent = formatCurrency(netWorth);
    netEl.classList.toggle('negative', netWorth < 0);
  }

  // Active states
  const liquidIds = state.accounts.filter(a => a.type === 'liquid').map(a => a.id);
  const creditIds = state.accounts.filter(a => a.type === 'credit_card').map(a => a.id);
  const selSet = new Set(state.selectedAccounts);
  const isMulti = state.selectedAccounts.length > 1;

  document.getElementById('sidebar-all-row')?.classList.toggle('active', state.currentView === 'all');
  document.getElementById('sidebar-liquid-list')?.closest('.sidebar-section-group')?.querySelector('.section-filter-label')?.classList.toggle('active',
    isMulti ? liquidIds.every(id => selSet.has(id)) && liquidIds.length > 0 : state.currentView === 'type-liquid');
  document.getElementById('sidebar-credit-list')?.closest('.sidebar-section-group')?.querySelector('.section-filter-label')?.classList.toggle('active',
    isMulti ? creditIds.every(id => selSet.has(id)) && creditIds.length > 0 : state.currentView === 'type-credit_card');
}

function filterTransactions(viewId) {
  showView('main');
  state.currentView = viewId;
  state.selectedAccounts = [];
  localStorage.removeItem('wallet_selected_accounts');
  localStorage.setItem('wallet_last_filter', viewId);
  clearTxSelection();
  renderAll();
}

function toggleAccountSelection(accId) {
  showView('main');
  if (state.selectedAccounts.length === 0 && state.currentView !== 'all' && state.currentView !== 'multi' && !state.currentView.startsWith('type-') && state.currentView !== 'receivables') {
    state.selectedAccounts.push(state.currentView);
  }
  state.currentView = 'multi';
  const idx = state.selectedAccounts.indexOf(accId);
  if (idx === -1) {
    state.selectedAccounts.push(accId);
  } else {
    state.selectedAccounts.splice(idx, 1);
  }
  if (state.selectedAccounts.length === 0) {
    state.currentView = 'all';
    localStorage.removeItem('wallet_selected_accounts');
    localStorage.setItem('wallet_last_filter', 'all');
  } else if (state.selectedAccounts.length === 1) {
    state.currentView = state.selectedAccounts[0];
    localStorage.removeItem('wallet_selected_accounts');
    localStorage.setItem('wallet_last_filter', state.selectedAccounts[0]);
  } else {
    localStorage.setItem('wallet_selected_accounts', JSON.stringify(state.selectedAccounts));
    localStorage.setItem('wallet_last_filter', 'multi:' + state.selectedAccounts.join(','));
  }
  clearTxSelection();
  renderAll();
}

function toggleTypeSelection(type) {
  const typeAccounts = state.accounts.filter(a => a.type === type).map(a => a.id);
  const selSet = new Set(state.selectedAccounts);
  const allSelected = typeAccounts.every(id => selSet.has(id));
  showView('main');
  if (allSelected) {
    state.selectedAccounts = state.selectedAccounts.filter(id => !typeAccounts.includes(id));
  } else {
    typeAccounts.forEach(id => { if (!selSet.has(id)) state.selectedAccounts.push(id); });
  }
  state.currentView = state.selectedAccounts.length === 0 ? 'all' : state.selectedAccounts.length === 1 ? state.selectedAccounts[0] : 'multi';
  if (state.selectedAccounts.length === 0) {
    localStorage.removeItem('wallet_selected_accounts');
    localStorage.setItem('wallet_last_filter', 'all');
  } else if (state.selectedAccounts.length === 1) {
    localStorage.removeItem('wallet_selected_accounts');
    localStorage.setItem('wallet_last_filter', state.selectedAccounts[0]);
  } else {
    localStorage.setItem('wallet_selected_accounts', JSON.stringify(state.selectedAccounts));
    localStorage.setItem('wallet_last_filter', 'multi:' + state.selectedAccounts.join(','));
  }
  clearTxSelection();
  renderAll();
}

function renderHeaderAndMetrics() {
  const titleEl    = document.getElementById('view-title');
  const subtitleEl = document.getElementById('view-subtitle');
  const settingsCur = state.settings.currency || 'ARS';

  let title    = 'Todas las cuentas';
  let subtitle = 'Resumen general de movimientos';

  if (state.currentView === 'receivables') {
    title    = 'Préstamos a cobrar';
    subtitle = 'Historial de préstamos y deudas pendientes';
  } else if (state.currentView.startsWith('type-')) {
    const type = state.currentView.replace('type-', '');
    const bal  = calculateBalances();
    if (type === 'liquid') {
      title = 'Cuentas líquidas';
      subtitle = 'Efectivo y débito · ' + formatCurrency(bal.liquid);
    } else if (type === 'credit_card') {
      title = 'Tarjetas de crédito';
      subtitle = 'Deuda y consumo · ' + formatCurrency(bal.credit_card);
    }
  } else if (state.currentView === 'all') {
    const bal = calculateBalances();
    subtitle = 'Resumen general · ' + formatCurrency(bal.liquid + bal.receivables + bal.credit_card);
  } else if (state.currentView === 'multi') {
    const selAccs = state.accounts.filter(a => state.selectedAccounts.includes(a.id));
    const totalBal = selAccs.reduce((sum, a) => {
      let bal = 0;
      state.transactions.forEach(tx => {
        if (tx.account_id === a.id && !tx.is_future && isTxInPeriod(tx)) bal += Number(tx.amount) || 0;
      });
      return sum + bal;
    }, 0);
    title = selAccs.length + ' cuentas';
    subtitle = selAccs.map(a => a.name).join(', ') + ' · ' + formatCurrency(totalBal);
  } else {
    const acc = state.accounts.find(a => a.id === state.currentView);
    if (acc) {
      const accCur = acc.currency || settingsCur;
      const curLabel = accCur !== settingsCur ? ' · ' + accCur : '';
      title    = acc.name;
      subtitle = acc.type === 'credit_card'
        ? `Tarjeta · cierre día ${acc.card_closing_day || '—'} · vencimiento día ${acc.card_due_day || '—'}${curLabel}`
        : 'Cuenta líquida' + curLabel;
    }
  }

  if (titleEl)    titleEl.textContent    = title;
  const subtitleTextEl = document.getElementById('view-subtitle-text');
  const addBtn = document.getElementById('subtitle-add-btn');
  if (subtitleTextEl) subtitleTextEl.textContent = subtitle;

  // Show/hide and configure the "+" button for adding accounts
  if (addBtn) {
    if (state.currentView === 'all' || state.currentView.startsWith('type-')) {
      addBtn.style.display = '';
      let accType = null;
      if (state.currentView === 'type-liquid') accType = 'liquid';
      else if (state.currentView === 'type-credit_card') accType = 'credit_card';
      addBtn.onclick = () => openAccountCreator(accType);
    } else {
      addBtn.style.display = 'none';
    }
  }
}
