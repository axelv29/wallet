// ═══════════════════════════════════════════════════════════════════════
//  sidebar.js — Renderizado del sidebar y filtrado por cuenta
//  Contiene: renderSidebar(), filterTransactions(viewId),
//  renderHeaderAndMetrics().
// ═══════════════════════════════════════════════════════════════════════

// ── RENDER ALL ────────────────────────────────────────────────
function renderSidebar() {
  const listLiquid = document.getElementById('sidebar-liquid-list');
  const listCredit = document.getElementById('sidebar-credit-list');
  if (listLiquid) listLiquid.innerHTML = '';
  if (listCredit) listCredit.innerHTML = '';

  // Compute running balances (exclude future installments)
  const accBalances = {};
  state.accounts.forEach(acc => { accBalances[acc.id] = Number(acc.balance) || 0; });
  state.transactions.forEach(tx => {
    if (tx.is_future) return;
    if (accBalances[tx.account_id] !== undefined) accBalances[tx.account_id] += Number(tx.amount) || 0;
  });

  const makeItem = (acc) => {
    const li = document.createElement('li');
    const isActive = state.currentView === acc.id;
    li.className = 'account-item-sidebar' + (isActive ? ' active' : '');
    li.onclick = () => filterTransactions(acc.id);
    const val = accBalances[acc.id];
    li.innerHTML = `
      <span class="acc-name-sidebar">${acc.name}</span>
      <span class="acc-balance-sidebar ${val < 0 ? 'negative' : ''}">${formatCurrency(val)}</span>
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
  document.getElementById('sidebar-all-row')?.classList.toggle('active', state.currentView === 'all');
  document.getElementById('sidebar-liquid-list')?.closest('.sidebar-section-group')?.querySelector('.section-filter-label')?.classList.toggle('active', state.currentView === 'type-liquid');
  document.getElementById('sidebar-credit-list')?.closest('.sidebar-section-group')?.querySelector('.section-filter-label')?.classList.toggle('active', state.currentView === 'type-credit_card');
}

function filterTransactions(viewId) {
  showView('main');
  state.currentView = viewId;
  localStorage.setItem('wallet_last_filter', viewId);
  clearTxSelection();
  renderAll();
}

function renderHeaderAndMetrics() {
  const titleEl    = document.getElementById('view-title');
  const subtitleEl = document.getElementById('view-subtitle');

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
  } else {
    const acc = state.accounts.find(a => a.id === state.currentView);
    if (acc) {
      title    = acc.name;
      subtitle = acc.type === 'credit_card'
        ? `Tarjeta · cierre día ${acc.card_closing_day || '—'} · vencimiento día ${acc.card_due_day || '—'}`
        : 'Cuenta líquida';
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
