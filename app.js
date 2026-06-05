// ════════════════════════════════════════════════════════════
//  WALLET — app.js   (refactored for new UI)
// ════════════════════════════════════════════════════════════

// ── ESTADO GLOBAL ────────────────────────────────────────────
let state = {
  accounts: [],
  transactions: [],
  predefined: {
    payees: ['Leo', 'Escaramuza', 'Rocío', 'Nati', 'Tienda Inglesa', 'El Tío', 'Supermercado Coto'],
    categories: ['Supermercado', 'Alimentos', 'Compras', 'Transporte', 'Servicios', 'Entretenimiento', 'Salud', 'Educación', 'Sueldo', 'Freelance', 'Regalos', 'Hogar', 'Ropa', 'Tecnología', 'Otros'],
    tags: ['Rocio', 'NyL', 'pan', 'viaje', 'compras']
  },
  settings: { geminiKey: '', theme: 'light' },
  currentTxSign: -1,
  importedTransactions: [],
  currentView: 'all'  // 'all' | 'receivables' | account id
};

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  applyTheme();
  loadData();
  setupSearchableSelects();
  setupKeyboardShortcuts();
  showView('dashboard');
  renderAll();
});

// ── VIEW SWITCHING ────────────────────────────────────────────
function showView(name) {
  ['dashboard', 'main', 'settings'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = v === name ? 'flex' : 'none';
  });

  document.getElementById('nav-dash-btn').classList.toggle('active-nav', name === 'dashboard');
  document.getElementById('nav-main-btn').classList.toggle('active-nav', name === 'main');
  document.getElementById('nav-settings-btn').classList.toggle('active-nav', name === 'settings');

  if (name === 'dashboard') {
    renderDashboard();
    // Sync theme icon
    applyTheme();
  }

  if (name === 'settings') {
    renderSettingsAccountsList();
    renderPredefinedLists();
    const keyInput = document.getElementById('set-gemini-key');
    if (keyInput) keyInput.value = state.settings.geminiKey || '';
  }
}

// ── SETTINGS PANE SWITCHING ───────────────────────────────────
function switchSettingsPane(name) {
  const panes = ['general', 'accounts', 'payees', 'categories', 'tags'];
  panes.forEach(p => {
    const pane = document.getElementById('spane-' + p);
    const btn  = document.getElementById('snav-' + p);
    if (pane) pane.classList.toggle('active', p === name);
    if (btn)  btn.classList.toggle('active', p === name);
  });

  if (name === 'accounts') renderSettingsAccountsList();
  if (['payees', 'categories', 'tags'].includes(name)) renderPredefinedLists();
}

// ── THEME ─────────────────────────────────────────────────────
function toggleTheme() {
  state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('wallet_settings', JSON.stringify(state.settings));
  applyTheme();
}

function applyTheme() {
  const isDark = state.settings.theme === 'dark';
  document.body.classList.toggle('theme-dark', isDark);
  document.body.classList.toggle('theme-light', !isDark);
  const icon = isDark ? 'moon' : 'sun';
  ['theme-icon', 'theme-icon-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('data-lucide', icon);
  });
  lucide.createIcons();
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (document.activeElement.id === 'tx-amount') {
      if (e.key === '-') { e.preventDefault(); setTxSign(-1); }
      if (e.key === '+') { e.preventDefault(); setTxSign(1); }
    }
  });
}

function setTxSign(sign) {
  state.currentTxSign = sign;
  document.getElementById('btn-sign-expense').className = 'sign-btn' + (sign === -1 ? ' active-expense' : '');
  document.getElementById('btn-sign-income').className  = 'sign-btn' + (sign ===  1 ? ' active-income'  : '');
}

// ── DATA PERSISTENCE ──────────────────────────────────────────
function loadData() {
  const lsAcc  = localStorage.getItem('wallet_accounts');
  const lsTx   = localStorage.getItem('wallet_transactions');
  const lsPre  = localStorage.getItem('wallet_predefined');

  if (lsAcc) {
    state.accounts = JSON.parse(lsAcc);
  } else {
    state.accounts = [
      { id: 'acc-1', name: 'Itaú Débito',  type: 'liquid',      balance: 1047.40 },
      { id: 'acc-2', name: 'Brou',          type: 'liquid',      balance: 1900.00 },
      { id: 'acc-3', name: 'Efectivo',      type: 'liquid',      balance: 1727.00 },
      { id: 'acc-4', name: 'Itaú Crédito',  type: 'credit_card', balance: -10300.38, card_closing_day: 20, card_due_day: 30 },
      { id: 'acc-5', name: 'Deudas',        type: 'credit_card', balance: -460.00,   card_closing_day: 15, card_due_day: 25 }
    ];
    saveData('accounts');
  }

  if (lsTx) {
    state.transactions = JSON.parse(lsTx);
  } else {
    state.transactions = [
      { id: 'tx-1',  date: '2026-06-01', account_id: 'acc-5', payee: 'Leo',            category_name: 'Fuera del presupuesto', amount:  5033.00, notes: 'Pasajes + Préstamo',    tags: [], is_receivable: true  },
      { id: 'tx-2',  date: '2026-05-24', account_id: 'acc-4', payee: 'Escaramuza',     category_name: 'Entretenimiento',       amount:  -258.75, notes: 'Libro w/',              tags: ['Rocio'], is_receivable: false },
      { id: 'tx-3',  date: '2026-05-19', account_id: 'acc-5', payee: 'Rocío',          category_name: 'Fuera del presupuesto', amount:   700.00, notes: 'Comida + Regalo Jessi', tags: [], is_receivable: false },
      { id: 'tx-4',  date: '2026-05-18', account_id: 'acc-5', payee: 'Leo',            category_name: 'Fuera del presupuesto', amount:  -141.00, notes: 'Compras finde',         tags: [], is_receivable: false },
      { id: 'tx-5',  date: '2026-05-18', account_id: 'acc-5', payee: 'Leo',            category_name: 'Fuera del presupuesto', amount:  -250.00, notes: 'Limpieza heladera',     tags: [], is_receivable: false },
      { id: 'tx-6',  date: '2026-05-18', account_id: 'acc-5', payee: 'Nati',           category_name: 'Fuera del presupuesto', amount: -1000.00, notes: 'Limpieza + Alfombra',   tags: [], is_receivable: false },
      { id: 'tx-7',  date: '2026-05-18', account_id: 'acc-5', payee: 'Nati',           category_name: 'Fuera del presupuesto', amount:  -400.00, notes: 'Limpieza Sillas',       tags: [], is_receivable: false },
      { id: 'tx-8',  date: '2026-05-17', account_id: 'acc-3', payee: 'Tienda Inglesa', category_name: 'Supermercado',          amount:   -53.00, notes: 'Bicarbonato',           tags: [], is_receivable: false },
      { id: 'tx-9',  date: '2026-05-17', account_id: 'acc-4', payee: 'Tienda Inglesa', category_name: 'Supermercado',          amount:  -373.00, notes: 'Galletitas w/',         tags: ['Rocio'], is_receivable: false },
      { id: 'tx-10', date: '2026-05-16', account_id: 'acc-4', payee: 'El Tío',         category_name: 'Supermercado',          amount:  -744.64, notes: 'Compras hamburguesas',  tags: [], is_receivable: false },
      { id: 'tx-11', date: '2026-05-16', account_id: 'acc-4', payee: 'El Tío',         category_name: 'Supermercado',          amount:  -141.00, notes: 'Aceite y Pan',          tags: ['NyL'], is_receivable: false },
      { id: 'tx-12', date: '2026-05-16', account_id: 'acc-4', payee: 'El Tío',         category_name: 'Supermercado',          amount:  -603.64, notes: 'Merienda y cena w/',    tags: [], is_receivable: false }
    ];
    saveData('transactions');
  }

  if (lsPre) {
    state.predefined = JSON.parse(lsPre);
  } else {
    saveData('predefined');
  }
}

function saveData(type) {
  if (type === 'accounts')     localStorage.setItem('wallet_accounts',     JSON.stringify(state.accounts));
  if (type === 'transactions') localStorage.setItem('wallet_transactions', JSON.stringify(state.transactions));
  if (type === 'predefined')   localStorage.setItem('wallet_predefined',   JSON.stringify(state.predefined));
}

function loadSettings() {
  const s = localStorage.getItem('wallet_settings');
  if (s) state.settings = JSON.parse(s);
}

// ── SEARCHABLE SELECTS ────────────────────────────────────────
function setupSearchableSelects() {
  bindSearchSelect('tx-payee-search',    'dropdown-payee',    'dropdown-payee-list',    () => state.predefined.payees);
  bindSearchSelect('tx-category-search', 'dropdown-category', 'dropdown-category-list', () => state.predefined.categories);
}

function bindSearchSelect(inputId, dropdownId, listId, dataAccessor) {
  const input    = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const list     = document.getElementById(listId);
  if (!input || !dropdown || !list) return;

  const render = (filter = '') => {
    list.innerHTML = '';
    const q = filter.toLowerCase();
    dataAccessor().filter(i => i.toLowerCase().includes(q)).forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = item;
        dropdown.classList.remove('open');
      });
      list.appendChild(li);
    });
  };

  input.addEventListener('focus',  () => { render(input.value); dropdown.classList.add('open'); });
  input.addEventListener('blur',   () => setTimeout(() => dropdown.classList.remove('open'), 150));
  input.addEventListener('input',  () => { render(input.value); dropdown.classList.add('open'); });
}

// ── PREDEFINED LISTS ──────────────────────────────────────────
function renderPredefinedLists() {
  renderListItems('payees',     state.predefined.payees);
  renderListItems('categories', state.predefined.categories);
  renderListItems('tags',       state.predefined.tags);
}

function renderListItems(type, list) {
  const ul = document.getElementById('predefined-' + type + '-list');
  if (!ul) return;
  ul.innerHTML = '';
  list.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${type === 'tags' ? '#' : ''}${item}</span>
      <button class="delete-btn" onclick="removePredefined('${type}', '${item}')"><i data-lucide="x"></i></button>
    `;
    ul.appendChild(li);
  });
  lucide.createIcons();
}

function addPredefined(type) {
  const ids = { payees: 'add-payee-val', categories: 'add-category-val', tags: 'add-tag-val' };
  const input = document.getElementById(ids[type]);
  const val = input.value.trim().replace(/#/g, '');
  if (!val || state.predefined[type].includes(val)) return;
  state.predefined[type].push(val);
  saveData('predefined');
  input.value = '';
  renderPredefinedLists();
}

function removePredefined(type, item) {
  state.predefined[type] = state.predefined[type].filter(i => i !== item);
  saveData('predefined');
  renderPredefinedLists();
}

// ── ACCOUNTS ──────────────────────────────────────────────────
function createNewAccount(event) {
  event.preventDefault();
  const name    = document.getElementById('acc-name').value.trim();
  const type    = document.getElementById('acc-type').value;
  const balance = parseFloat(document.getElementById('acc-balance').value) || 0;

  const newAcc = { id: 'acc-' + Date.now(), name, type, balance };
  if (type === 'credit_card') {
    newAcc.card_closing_day = parseInt(document.getElementById('acc-close-day').value) || 1;
    newAcc.card_due_day     = parseInt(document.getElementById('acc-due-day').value)   || 10;
  }

  state.accounts.push(newAcc);
  saveData('accounts');

  document.getElementById('acc-name').value    = '';
  document.getElementById('acc-balance').value = '0.00';
  const cd = document.getElementById('acc-close-day');
  const dd = document.getElementById('acc-due-day');
  if (cd) cd.value = '';
  if (dd) dd.value = '';

  renderSettingsAccountsList();
  renderAll();
}

function removeAccount(accId) {
  if (!confirm('¿Seguro que deseas eliminar esta cuenta? Se perderán todas sus transacciones.')) return;
  state.accounts = state.accounts.filter(a => a.id !== accId);
  state.transactions = state.transactions.filter(t => t.account_id !== accId);
  saveData('accounts');
  saveData('transactions');
  renderSettingsAccountsList();
  renderAll();
}

function renderSettingsAccountsList() {
  const container = document.getElementById('accounts-scroll-container');
  if (!container) return;
  container.innerHTML = '';
  state.accounts.forEach(acc => {
    const item = document.createElement('div');
    item.className = 'account-list-item';
    item.innerHTML = `
      <div class="acc-list-info">
        <span class="acc-list-name">${acc.name}</span>
        <span class="acc-list-type">${acc.type === 'credit_card' ? 'Tarjeta de crédito' : 'Cuenta líquida'}${acc.card_closing_day ? ' · cierra día ' + acc.card_closing_day : ''}</span>
      </div>
      <button class="delete-btn" onclick="removeAccount('${acc.id}')"><i data-lucide="trash-2"></i></button>
    `;
    container.appendChild(item);
  });
  lucide.createIcons();
}

function toggleAccountClosingFields(type) {
  const el = document.getElementById('cc-closing-fields');
  if (el) el.style.display = type === 'credit_card' ? 'block' : 'none';
}

// ── GENERAL SETTINGS ──────────────────────────────────────────
function saveGeneralSettings(event) {
  event.preventDefault();
  state.settings.geminiKey = document.getElementById('set-gemini-key').value.trim();
  localStorage.setItem('wallet_settings', JSON.stringify(state.settings));
  // Visual feedback
  const btn = event.submitter;
  if (btn) { const t = btn.textContent; btn.textContent = '✓ Guardado'; setTimeout(() => { btn.textContent = t; }, 1500); }
}

// ── TRANSACTIONS CRUD ─────────────────────────────────────────
function openTransactionModal() {
  updateSelectors();
  document.getElementById('tx-date').valueAsDate = new Date();
  setTxSign(-1);
  document.getElementById('tx-payee-search').value   = '';
  document.getElementById('tx-category-search').value = '';
  document.getElementById('tx-amount').value          = '';
  document.getElementById('tx-notes').value           = '';

  const checklist = document.getElementById('tx-tags-checklist');
  checklist.innerHTML = '';
  state.predefined.tags.forEach(tag => {
    const label = document.createElement('label');
    label.className = 'tag-check-label';
    label.innerHTML = `<input type="checkbox" name="tx-tags" value="${tag}"><span>#${tag}</span>`;
    checklist.appendChild(label);
  });

  const chk = document.getElementById('tx-is-receivable');
  chk.checked = false;
  toggleReceivableFields(false);

  document.getElementById('tx-modal').classList.add('open');
}

function closeTransactionModal() {
  document.getElementById('tx-modal').classList.remove('open');
  document.getElementById('tx-form').reset();
}

function toggleReceivableFields(show) {
  document.getElementById('tx-receivable-details').style.display = show ? 'block' : 'none';
}

function handleTransactionSubmit(event) {
  event.preventDefault();

  const dateVal     = document.getElementById('tx-date').value;
  const accountId   = document.getElementById('tx-account').value;
  const payee       = document.getElementById('tx-payee-search').value.trim();
  const categoryName = document.getElementById('tx-category-search').value.trim();
  const rawAmount   = parseFloat(document.getElementById('tx-amount').value);
  const notes       = document.getElementById('tx-notes').value.trim();
  const isReceivable = document.getElementById('tx-is-receivable').checked;
  const dueDate     = document.getElementById('tx-due-date').value;

  if (!accountId || !payee || !categoryName || isNaN(rawAmount)) return;

  // Auto-add to predefined if new
  if (!state.predefined.payees.includes(payee)) { state.predefined.payees.push(payee); saveData('predefined'); }
  if (!state.predefined.categories.includes(categoryName)) { state.predefined.categories.push(categoryName); saveData('predefined'); }

  const activeTags = [];
  document.querySelectorAll('input[name="tx-tags"]:checked').forEach(c => activeTags.push(c.value));

  const amount = Math.abs(rawAmount) * state.currentTxSign;

  state.transactions.unshift({
    id: 'tx-' + Date.now(),
    date: dateVal,
    account_id: accountId,
    payee,
    category_name: categoryName,
    amount,
    notes,
    tags: activeTags,
    is_receivable: isReceivable,
    due_date: isReceivable ? dueDate : ''
  });

  saveData('transactions');
  closeTransactionModal();
  renderAll();
}

function deleteTransaction(txId) {
  if (!confirm('¿Seguro que deseas eliminar esta transacción?')) return;
  state.transactions = state.transactions.filter(t => t.id !== txId);
  saveData('transactions');
  renderAll();
}

function markAsCollected(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;
  if (confirm(`¿Marcar como cobrado el préstamo de ${formatCurrency(Math.abs(tx.amount))} de ${tx.payee}?`)) {
    tx.is_receivable = false;
    state.transactions.unshift({
      id: 'tx-' + Date.now() + '-refund',
      date: new Date().toISOString().split('T')[0],
      account_id: tx.account_id,
      payee: 'Cobro: ' + tx.payee,
      category_name: 'Otros',
      amount: Math.abs(tx.amount),
      notes: 'Reintegro préstamo del ' + tx.date,
      tags: [],
      is_receivable: false
    });
    saveData('transactions');
    renderAll();
  }
}

// ── FILTER ────────────────────────────────────────────────────
function filterTransactions(viewId) {
  state.currentView = viewId;
  renderAll();
}

// ── CALCULATE ────────────────────────────────────────────────
function calculateBalances() {
  const balances = { liquid: 0, credit_card: 0, receivables: 0 };
  state.accounts.forEach(acc => {
    if (acc.type === 'liquid')      balances.liquid      += Number(acc.balance) || 0;
    if (acc.type === 'credit_card') balances.credit_card += Number(acc.balance) || 0;
  });
  state.transactions.forEach(tx => {
    const acc = state.accounts.find(a => a.id === tx.account_id);
    if (acc) {
      if (acc.type === 'liquid')      balances.liquid      += Number(tx.amount) || 0;
      if (acc.type === 'credit_card') balances.credit_card += Number(tx.amount) || 0;
    }
    if (tx.is_receivable) balances.receivables += Math.abs(tx.amount);
  });
  return balances;
}

// ── RENDER ALL ────────────────────────────────────────────────
function renderAll() {
  renderSidebar();
  renderHeaderAndMetrics();
  renderTransactions();
  renderDashboard();
  updateSelectors();
}

function renderSidebar() {
  const listLiquid = document.getElementById('sidebar-liquid-list');
  const listCredit = document.getElementById('sidebar-credit-list');
  listLiquid.innerHTML = '';
  listCredit.innerHTML = '';

  // Compute running balances
  const accBalances = {};
  state.accounts.forEach(acc => { accBalances[acc.id] = Number(acc.balance) || 0; });
  state.transactions.forEach(tx => {
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

  state.accounts.filter(a => a.type === 'liquid').forEach(acc => listLiquid.appendChild(makeItem(acc)));
  state.accounts.filter(a => a.type === 'credit_card').forEach(acc => listCredit.appendChild(makeItem(acc)));

  const balances  = calculateBalances();
  const netWorth  = balances.liquid + balances.receivables + balances.credit_card;
  const netEl     = document.getElementById('net-worth-val');
  netEl.textContent = formatCurrency(netWorth);
  netEl.classList.toggle('negative', netWorth < 0);

  document.getElementById('receivables-sum-val').textContent = formatCurrency(balances.receivables);
}

function renderHeaderAndMetrics() {
  const titleEl    = document.getElementById('view-title');
  const subtitleEl = document.getElementById('view-subtitle');

  let title    = 'Todas las cuentas';
  let subtitle = 'Resumen general de movimientos';

  if (state.currentView === 'receivables') {
    title    = 'Préstamos a cobrar';
    subtitle = 'Historial de préstamos y deudas pendientes';
  } else if (state.currentView !== 'all') {
    const acc = state.accounts.find(a => a.id === state.currentView);
    if (acc) {
      title    = acc.name;
      subtitle = acc.type === 'credit_card'
        ? `Tarjeta · cierre día ${acc.card_closing_day || '—'} · vencimiento día ${acc.card_due_day || '—'}`
        : 'Cuenta líquida';
    }
  }

  if (titleEl)    titleEl.textContent    = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;
}

function renderTransactions() {
  const tbody  = document.getElementById('tx-table-body');
  const search = document.getElementById('tx-search-input').value.toLowerCase();
  tbody.innerHTML = '';

  let filtered = [...state.transactions];
  if (state.currentView === 'receivables') {
    filtered = filtered.filter(t => t.is_receivable);
  } else if (state.currentView !== 'all') {
    filtered = filtered.filter(t => t.account_id === state.currentView);
  }

  if (search) {
    filtered = filtered.filter(tx => {
      const acc = state.accounts.find(a => a.id === tx.account_id);
      return (tx.payee || '').toLowerCase().includes(search)
          || (tx.notes || '').toLowerCase().includes(search)
          || (tx.tags  || []).some(t => t.toLowerCase().includes(search))
          || (acc && acc.name.toLowerCase().includes(search))
          || (tx.category_name || '').toLowerCase().includes(search);
    });
  }

  document.getElementById('tx-count-badge').textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No hay movimientos registrados.</td></tr>`;
    return;
  }

  // Tag color map
  const tagClass = tag => {
    const t = (tag || '').toLowerCase();
    if (t === 'rocio') return 'a';
    if (t === 'nyl')   return 'b';
    return 'c';
  };

  filtered.forEach(tx => {
    const acc       = state.accounts.find(a => a.id === tx.account_id);
    const isExpense = tx.amount < 0;

    const tagPills = (tx.tags || []).map(tag =>
      `<span class="tag-pill ${tagClass(tag)}">#${tag}</span>`
    ).join('');

    const notesHtml = `${tx.notes || ''}${tagPills ? ' ' + tagPills : ''}`;

    const amountVal = isExpense ? '-' + formatCurrency(Math.abs(tx.amount)) : '+' + formatCurrency(tx.amount);
    const amountClass = isExpense ? 'expense' : 'income';

    let actionsHtml = `
      <button class="row-action danger" onclick="deleteTransaction('${tx.id}')" title="Eliminar">
        <i data-lucide="trash-2"></i>
      </button>
    `;
    if (tx.is_receivable) {
      actionsHtml = `
        <button class="row-action success" onclick="markAsCollected('${tx.id}')" title="Marcar como cobrado">
          <i data-lucide="check-square"></i>
        </button>
        <button class="row-action danger" onclick="deleteTransaction('${tx.id}')" title="Eliminar">
          <i data-lucide="trash-2"></i>
        </button>
      `;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="date-cell">${formatDate(tx.date)}</td>
      <td class="account-cell">${acc ? acc.name : '—'}</td>
      <td class="payee-cell">${tx.payee}</td>
      <td class="notes-cell">${notesHtml}</td>
      <td class="category-cell">${tx.category_name || 'Otros'}</td>
      <td class="amount-cell ${amountClass}">${amountVal}</td>
      <td class="actions-cell">${actionsHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

function updateSelectors() {
  const selectAcc = document.getElementById('tx-account');
  const importAcc = document.getElementById('import-account-id');

  if (selectAcc) {
    const prev = selectAcc.value;
    selectAcc.innerHTML = '';
    state.accounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.id;
      opt.textContent = acc.name;
      selectAcc.appendChild(opt);
    });
    if (prev) selectAcc.value = prev;
  }

  if (importAcc) {
    importAcc.innerHTML = '';
    state.accounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.id;
      opt.textContent = acc.name;
      importAcc.appendChild(opt);
    });
  }
}

// ── IMPORT (GEMINI) ───────────────────────────────────────────
function openImportModal() {
  if (!state.settings.geminiKey) {
    alert('Configurá primero tu Gemini API Key en Ajustes → General.');
    showView('settings');
    return;
  }
  updateSelectors();
  document.getElementById('import-setup-view').style.display  = 'block';
  document.getElementById('import-review-view').style.display = 'none';
  document.getElementById('import-modal').classList.add('open');
}

function closeImportModal() {
  document.getElementById('import-modal').classList.remove('open');
  state.importedTransactions = [];
}

function backToImportSetup() {
  document.getElementById('import-setup-view').style.display  = 'block';
  document.getElementById('import-review-view').style.display = 'none';
}

async function processImportWithGemini() {
  const text = document.getElementById('import-text').value.trim();
  const key  = state.settings.geminiKey;
  const btn  = document.getElementById('btn-process-import');

  if (!text) { alert('Ingresá el texto del extracto bancario.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2"></i> Procesando…';
  lucide.createIcons();

  const categoriesList = state.predefined.categories.join(', ');
  const prompt = `Actúas como un procesador estructurado de extractos bancarios en español.
Analiza el siguiente texto y extrae todas las transacciones financieras.

Texto:
"${text}"

Categorías válidas (usá estrictamente una de estas o mapeá a 'Otros'):
[${categoriesList}]

Reglas:
- Gastos/egresos: monto NEGATIVO.
- Ingresos/cobros: monto POSITIVO.
- Fechas en formato YYYY-MM-DD. Si no hay año, usá 2026.
- Respondé ÚNICAMENTE con un arreglo JSON válido, sin markdown ni texto adicional.

Formato:
[{"date":"YYYY-MM-DD","payee":"Nombre","amount":-120.00,"category":"Categoría","notes":""}]`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const result = await response.json();
    let textResponse = result.candidates[0].content.parts[0].text;
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedTxs = JSON.parse(textResponse);

    if (Array.isArray(parsedTxs)) {
      state.importedTransactions = parsedTxs;
      renderImportReview();
    } else {
      throw new Error('JSON inválido');
    }
  } catch (err) {
    console.error(err);
    alert('Error al procesar con Gemini. Revisá tu API Key y la consola.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="sparkles"></i> Procesar con Gemini IA';
    lucide.createIcons();
  }
}

function renderImportReview() {
  document.getElementById('import-setup-view').style.display  = 'none';
  document.getElementById('import-review-view').style.display = 'block';

  const tbody = document.getElementById('import-review-tbody');
  tbody.innerHTML = '';

  state.importedTransactions.forEach((tx, idx) => {
    const catOptions = state.predefined.categories.map(c =>
      `<option value="${c}" ${c.toLowerCase() === (tx.category || '').toLowerCase() ? 'selected' : ''}>${c}</option>`
    ).join('');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="date" value="${tx.date}" onchange="updateImportedTx(${idx}, 'date', this.value)"></td>
      <td><input type="text" value="${tx.payee}" onchange="updateImportedTx(${idx}, 'payee', this.value)"></td>
      <td><select onchange="updateImportedTx(${idx}, 'category_name', this.value)">${catOptions}</select></td>
      <td><input type="number" step="0.01" value="${tx.amount}" style="text-align:right;" onchange="updateImportedTx(${idx}, 'amount', parseFloat(this.value))"></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateImportedTx(index, field, value) {
  state.importedTransactions[index][field] = value;
}

function confirmImportedTransactions() {
  const accountId = document.getElementById('import-account-id').value;
  const newTxs = state.importedTransactions.map(itx => ({
    id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    date: itx.date,
    account_id: accountId,
    payee: itx.payee,
    category_name: itx.category_name || itx.category || 'Otros',
    amount: parseFloat(itx.amount),
    notes: itx.notes || '',
    tags: [],
    is_receivable: false
  }));
  state.transactions = [...newTxs, ...state.transactions];
  saveData('transactions');
  closeImportModal();
  renderAll();
}

// ── DASHBOARD ─────────────────────────────────────────────────
function renderDashboard() {
  const balances = calculateBalances();
  const now = new Date();
  const currMonth = now.getMonth();
  const currYear = now.getFullYear();

  const monthTxs = state.transactions.filter(tx => {
    const d = new Date(tx.date + 'T00:00:00');
    return d.getMonth() === currMonth && d.getFullYear() === currYear;
  });

  // Monthly summary
  let totalIncome = 0, totalExpenses = 0;
  monthTxs.forEach(tx => {
    if (tx.amount > 0) totalIncome += tx.amount;
    else totalExpenses += Math.abs(tx.amount);
  });
  const netDiff = totalIncome - totalExpenses;

  document.getElementById('dash-income').textContent = formatCurrency(totalIncome);
  document.getElementById('dash-expenses').textContent = formatCurrency(totalExpenses);
  const netEl = document.getElementById('dash-net');
  netEl.textContent = formatCurrency(netDiff);
  netEl.className = 'dash-hero-val' + (netDiff < 0 ? ' expense' : netDiff > 0 ? ' income' : '');

  // Subtitle
  document.getElementById('dash-subtitle').textContent =
    `Resumen de ${now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`;

  // Coverage
  const liquidCov = balances.liquid + balances.credit_card;
  const projCov = balances.liquid + balances.receivables + balances.credit_card;
  const netWorth = liquidCov + balances.receivables;

  const setCov = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = formatCurrency(val);
  };
  setCov('dash-liquid-cov', liquidCov);
  setCov('dash-proj-cov', projCov);
  setCov('dash-net-worth', netWorth);

  // Categories breakdown (expenses only)
  const catTotals = {};
  monthTxs.filter(tx => tx.amount < 0).forEach(tx => {
    const cat = tx.category_name || 'Otros';
    catTotals[cat] = (catTotals[cat] || 0) + Math.abs(tx.amount);
  });

  const catList = document.getElementById('dash-category-list');
  catList.innerHTML = '';

  const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const maxCat = catEntries.length > 0 ? catEntries[0][1] : 0;

  if (catEntries.length === 0) {
    catList.innerHTML = '<div class="dash-empty">Sin gastos este mes</div>';
  } else {
    catEntries.forEach(([cat, amount]) => {
      const pct = maxCat > 0 ? (amount / maxCat) * 100 : 0;
      const row = document.createElement('div');
      row.className = 'dash-cat-row';
      row.innerHTML = `
        <div class="dash-cat-top">
          <span class="dash-cat-label">${cat}</span>
          <span class="dash-cat-amount">${formatCurrency(amount)}</span>
        </div>
        <div class="dash-cat-bar-track"><div class="dash-cat-bar-fill" style="width:${pct}%"></div></div>
      `;
      catList.appendChild(row);
    });
  }

  // Recent activity (last 5)
  const recentList = document.getElementById('dash-recent-list');
  recentList.innerHTML = '';

  const recent = state.transactions.slice(0, 5);
  if (recent.length === 0) {
    recentList.innerHTML = '<div class="dash-empty">Sin movimientos aún</div>';
  } else {
    recent.forEach(tx => {
      const isExpense = tx.amount < 0;
      const item = document.createElement('div');
      item.className = 'dash-recent-item';
      item.innerHTML = `
        <span class="dash-recent-date">${formatDate(tx.date)}</span>
        <span class="dash-recent-payee">${tx.payee}</span>
        <span class="dash-recent-amount ${isExpense ? 'expense' : 'income'}">${isExpense ? '-' : '+'}${formatCurrency(Math.abs(tx.amount))}</span>
      `;
      recentList.appendChild(item);
    });
  }

  lucide.createIcons();
}

// ── HELP MODAL ─────────────────────────────────────────────────
function openHelpModal() {
  document.getElementById('help-modal').classList.add('open');
}

function closeHelpModal() {
  document.getElementById('help-modal').classList.remove('open');
}

// ── UTILITIES ─────────────────────────────────────────────────
function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' });
}

// ── GLOBAL BINDINGS ───────────────────────────────────────────
window.toggleTheme               = toggleTheme;
window.showView                  = showView;
window.switchSettingsPane        = switchSettingsPane;
window.setTxSign                 = setTxSign;
window.saveGeneralSettings       = saveGeneralSettings;
window.toggleAccountClosingFields = toggleAccountClosingFields;
window.createNewAccount          = createNewAccount;
window.removeAccount             = removeAccount;
window.addPredefined             = addPredefined;
window.removePredefined          = removePredefined;
window.openTransactionModal      = openTransactionModal;
window.closeTransactionModal     = closeTransactionModal;
window.toggleReceivableFields    = toggleReceivableFields;
window.handleTransactionSubmit   = handleTransactionSubmit;
window.deleteTransaction         = deleteTransaction;
window.markAsCollected           = markAsCollected;
window.filterTransactions        = filterTransactions;
window.openImportModal           = openImportModal;
window.closeImportModal          = closeImportModal;
window.backToImportSetup         = backToImportSetup;
window.processImportWithGemini   = processImportWithGemini;
window.confirmImportedTransactions = confirmImportedTransactions;
window.updateImportedTx          = updateImportedTx;
window.renderTransactions        = renderTransactions;
window.openHelpModal             = openHelpModal;
window.closeHelpModal            = closeHelpModal;
