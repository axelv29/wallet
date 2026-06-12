// ════════════════════════════════════════════════════════════
//  WALLET — app.js   (refactored for new UI)
// ════════════════════════════════════════════════════════════

// ── ESTADO GLOBAL ────────────────────────────────────────────
let state = {
  accounts: [],
  transactions: [],
  predefined: {
    payees: ['Leo', 'Escaramuza', 'Rocío', 'Nati', 'Tienda Inglesa', 'El Tío', 'Supermercado Coto'],
    categories: [
      { name: 'Supermercado', icon: 'shopping-cart' },
      { name: 'Alimentos', icon: 'utensils-crossed' },
      { name: 'Compras', icon: 'package' },
      { name: 'Transporte', icon: 'car' },
      { name: 'Servicios', icon: 'zap' },
      { name: 'Entretenimiento', icon: 'gamepad-2' },
      { name: 'Salud', icon: 'heart-pulse' },
      { name: 'Educación', icon: 'book-open' },
      { name: 'Sueldo', icon: 'briefcase' },
      { name: 'Freelance', icon: 'laptop' },
      { name: 'Regalos', icon: 'gift' },
      { name: 'Hogar', icon: 'home' },
      { name: 'Ropa', icon: 'shirt' },
      { name: 'Tecnología', icon: 'smartphone' },
      { name: 'Otros', icon: 'more-horizontal' },
    ],
    tags: ['Rocio', 'NyL', 'pan', 'viaje', 'compras']
  },
  settings: { geminiKey: '', theme: 'light', currency: 'ARS', showSymbol: true, decimals: 2 },
  currentTxSign: -1,
  importedTransactions: [],
  currentView: 'all',
  editingTxId: null,
  selectedTxIds: new Set(),
  tableFilters: [],

};

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  applyTheme();
  loadData();
  setupSearchableSelects();
  setupKeyboardShortcuts();
  const lastView = localStorage.getItem('wallet_last_view') || 'dashboard';
  const lastFilter = localStorage.getItem('wallet_last_filter');
  if (lastView === 'main' && lastFilter) {
    filterTransactions(lastFilter);
  } else {
    showView(lastView);
  }
  renderAll();
  initColumnResize();
  initCatIconPicker();
  initCsvDropzone();
  showWelcomeOnFirstVisit();

  // Re-draw charts on resize
  let _resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      if (document.getElementById('view-dashboard')?.style.display !== 'none') {
        renderDashCharts();
      }
    }, 120);
  });
});

// ── VIEW SWITCHING ────────────────────────────────────────────
function showView(name) {
  ['dashboard', 'main', 'settings'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = v === name ? 'flex' : 'none';
  });

  document.getElementById('nav-dash-pill').classList.toggle('active', name === 'dashboard');
  localStorage.setItem('wallet_last_view', name);

  if (name !== 'main') {
    state.currentView = '';
    renderSidebar();
  }

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
    const curSel = document.getElementById('set-currency');
    if (curSel) curSel.value = state.settings.currency || 'ARS';
    const symCb = document.getElementById('set-show-symbol');
    if (symCb) symCb.checked = state.settings.showSymbol !== false;
    const decSel = document.getElementById('set-decimals');
    if (decSel) decSel.value = String(state.settings.decimals ?? 2);
  }
}

// ── SETTINGS PANE SWITCHING ───────────────────────────────────
function switchSettingsPane(name) {
  const panes = ['general', 'accounts', 'payees', 'categories', 'tags', 'currency'];
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
  ['theme-icon', 'theme-icon-settings', 'theme-icon-dash'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('data-lucide', icon);
  });
  lucide.createIcons();
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('confirm-modal').classList.contains('open')) {
      resolveConfirm(false);
      return;
    }
    if (document.activeElement.id === 'tx-amount') {
      if (e.key === '-') { e.preventDefault(); setTxSign(-1); }
      if (e.key === '+') { e.preventDefault(); setTxSign(1); }
    }
  });

  // Live preview when amount or date changes
  const amtInput  = document.getElementById('tx-amount');
  const dateInput = document.getElementById('tx-date');
  if (amtInput)  amtInput.addEventListener('input', () => {
    if (document.getElementById('tx-is-installment')?.checked) updateInstallmentPreview();
  });
  if (dateInput) dateInput.addEventListener('change', () => {
    if (document.getElementById('tx-is-installment')?.checked) updateInstallmentPreview();
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
    const ym = getCurrentYearMonth();
    state.accounts = [
      { id: 'acc-1', name: 'Itaú Débito',  type: 'liquid',      balance: 1047.40 },
      { id: 'acc-2', name: 'Brou',          type: 'liquid',      balance: 1900.00 },
      { id: 'acc-3', name: 'Efectivo',      type: 'liquid',      balance: 1727.00 },
      { id: 'acc-4', name: 'Itaú Crédito',  type: 'credit_card', balance: -10300.38, card_schedule: { [ym]: { closing: 20, due: 30 } } },
      { id: 'acc-5', name: 'Deudas',        type: 'credit_card', balance: -460.00,   card_schedule: { [ym]: { closing: 15, due: 25 } } }
    ];
    saveData('accounts');
  }

  // ── Migration: card_closing_day/card_due_day → card_schedule ──
  let scheduleMigrated = false;
  state.accounts.forEach(acc => {
    if (acc.type === 'credit_card' && !acc.card_schedule) {
      const closing = acc.card_closing_day || null;
      const due = acc.card_due_day || null;
      acc.card_schedule = {};
      if (closing || due) {
        const now = new Date();
        const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        acc.card_schedule[ym] = { closing: closing || 1, due: due || 10 };
      }
      delete acc.card_closing_day;
      delete acc.card_due_day;
      scheduleMigrated = true;
    }
  });
  if (scheduleMigrated) saveData('accounts');

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
    // Migrate string categories → { name, icon }
    if (state.predefined.categories.length && typeof state.predefined.categories[0] === 'string') {
      state.predefined.categories = state.predefined.categories.map((c, i) => ({
        name: c,
        icon: ['shopping-cart','utensils-crossed','package','car','zap','gamepad-2','heart-pulse','book-open','briefcase','laptop','gift','home','shirt','smartphone','more-horizontal'][i] || 'tag'
      }));
      saveData('predefined');
    }
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

  const isCategorySelect = inputId === 'tx-category-search';

  const render = (filter = '') => {
    list.innerHTML = '';
    const q = filter.toLowerCase();
    dataAccessor().filter(item => {
      const name = typeof item === 'string' ? item : item.name;
      return name.toLowerCase().includes(q);
    }).forEach(item => {
      const name = typeof item === 'string' ? item : item.name;
      const icon = typeof item === 'string' ? null : item.icon;
      const li = document.createElement('li');
      li.innerHTML = isCategorySelect && icon ? `<span class="cat-icon"><i data-lucide="${icon}"></i></span>${name}` : name;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = name;
        dropdown.classList.remove('open');
      });
      list.appendChild(li);
    });
    if (isCategorySelect) lucide.createIcons();
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

// ── CATEGORY ICON PICKER ─────────────────────────────────
const CATEGORY_ICONS = [
  'tag','shopping-cart','utensils-crossed','package','car','bus','plane',
  'zap','gamepad-2','heart-pulse','book-open','briefcase','laptop',
  'gift','home','shirt','smartphone','monitor','tv','headphones',
  'music','camera','coffee','beer','wine','cake','pizza',
  'apple','dumbbell','trees','sun','moon','star','heart',
  'users','building','banknote','credit-card','piggy-bank',
  'trending-up','chart-line','bar-chart-3','wallet','phone',
  'globe','map-pin','more-horizontal'
];

function initCatIconPicker() {
  const grid = document.getElementById('cat-picker-grid');
  if (!grid) return;
  grid.innerHTML = '';
  CATEGORY_ICONS.forEach(icon => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `<i data-lucide="${icon}"></i>`;
    btn.dataset.icon = icon;
    btn.onclick = () => selectCatIcon(icon);
    grid.appendChild(btn);
  });
  lucide.createIcons();

  // Close on outside click
  document.addEventListener('click', e => {
    const popover = document.getElementById('cat-picker-popover');
    const btn = document.getElementById('cat-picker-btn');
    if (!popover || !btn) return;
    if (!e.target.closest('#cat-picker-btn') && !e.target.closest('#cat-picker-popover')) {
      popover.classList.remove('open');
    }
  });
}

function toggleCatIconPicker() {
  const popover = document.getElementById('cat-picker-popover');
  if (popover) popover.classList.toggle('open');
}

function selectCatIcon(icon) {
  state._selectedCatIcon = icon;
  const btn = document.getElementById('cat-picker-btn');
  if (btn) {
    btn.innerHTML = `<i data-lucide="${icon}"></i>`;
    lucide.createIcons();
  }
  // Update active state in grid & close
  document.querySelectorAll('#cat-picker-grid button').forEach(b => {
    b.classList.toggle('active', b.dataset.icon === icon);
  });
  const popover = document.getElementById('cat-picker-popover');
  if (popover) popover.classList.remove('open');
}

function renderListItems(type, list) {
  const ul = document.getElementById('predefined-' + type + '-list');
  if (!ul) return;
  ul.innerHTML = '';
  list.forEach(item => {
    const li = document.createElement('li');
    const name = typeof item === 'string' ? item : item.name;
    const icon = typeof item === 'string' ? null : item.icon;
    const iconHtml = type === 'categories' && icon ? `<i data-lucide="${icon}" style="width:14px;height:14px;"></i>` : '';
    li.innerHTML = `
      <span>${iconHtml} ${type === 'tags' ? '#' : ''}${name}</span>
      <button class="delete-btn" onclick="removePredefined('${type}', '${name}')"><i data-lucide="x"></i></button>
    `;
    ul.appendChild(li);
  });
  lucide.createIcons();
}

function addPredefined(type) {
  if (type === 'categories') {
    const input = document.getElementById('add-category-val');
    const val = input.value.trim().replace(/#/g, '');
    const icon = state._selectedCatIcon || 'tag';
    if (!val) return;
    const exists = state.predefined.categories.some(c => (typeof c === 'string' ? c : c.name) === val);
    if (exists) return;
    state.predefined.categories.push({ name: val, icon });
    saveData('predefined');
    input.value = '';
    state._selectedCatIcon = null;
    document.getElementById('cat-picker-btn').innerHTML = '<i data-lucide="tag"></i>';
    lucide.createIcons();
    renderPredefinedLists();
    return;
  }
  const ids = { payees: 'add-payee-val', tags: 'add-tag-val' };
  const input = document.getElementById(ids[type]);
  const val = input.value.trim().replace(/#/g, '');
  if (!val || state.predefined[type].includes(val)) return;
  state.predefined[type].push(val);
  saveData('predefined');
  input.value = '';
  renderPredefinedLists();
}

function removePredefined(type, item) {
  if (type === 'categories') {
    state.predefined[type] = state.predefined[type].filter(c => (typeof c === 'string' ? c : c.name) !== item);
  } else {
    state.predefined[type] = state.predefined[type].filter(i => i !== item);
  }
  saveData('predefined');
  renderPredefinedLists();
}

// ── ACCOUNTS ──────────────────────────────────────────────────
function openAccountCreator(type) {
  showView('settings');
  switchSettingsPane('accounts');
  const typeEl = document.getElementById('acc-type');
  if (type && typeEl) {
    typeEl.value = type;
    toggleAccountClosingFields(type);
  }
  // Focus the name input
  setTimeout(() => document.getElementById('acc-name')?.focus(), 100);
}

// ── FLOATING ACCOUNT CREATOR ──────────────────────────────────
function openFloatingAccountCreator(type) {
  document.getElementById('acc-floating-modal').classList.add('open');
  const typeEl = document.getElementById('acc-f-type');
  if (type && typeEl) {
    typeEl.value = type;
    toggleAccountClosingFieldsFloating(type);
  } else if (typeEl) {
    typeEl.value = 'liquid';
    toggleAccountClosingFieldsFloating('liquid');
  }
  lucide.createIcons();
  setTimeout(() => document.getElementById('acc-f-name')?.focus(), 100);
}

function closeFloatingAccountCreator() {
  document.getElementById('acc-floating-modal').classList.remove('open');
}

function toggleAccountClosingFieldsFloating(type) {
  const el = document.getElementById('cc-f-closing-fields');
  if (el) el.style.display = type === 'credit_card' ? 'block' : 'none';
}

function createAccountFromFloating(event) {
  event.preventDefault();
  const name     = document.getElementById('acc-f-name').value.trim();
  const type     = document.getElementById('acc-f-type').value;
  const balance  = parseFloat(document.getElementById('acc-f-balance').value) || 0;
  const currency = document.getElementById('acc-f-currency').value || 'ARS';

  const newAcc = { id: 'acc-' + Date.now(), name, type, balance: 0, currency };
  if (type === 'credit_card') {
    const closing = parseInt(document.getElementById('acc-f-close-day').value) || 1;
    const due = parseInt(document.getElementById('acc-f-due-day').value) || 10;
    const ym = getCurrentYearMonth();
    newAcc.card_schedule = {};
    newAcc.card_schedule[ym] = { closing, due };
  }

  state.accounts.push(newAcc);
  saveData('accounts');

  if (balance !== 0) {
    state.transactions.unshift({
      id: 'tx-init-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      account_id: newAcc.id,
      payee: 'Ajuste de saldo',
      category_name: 'Ajuste de saldo',
      amount: balance,
      notes: '',
      tags: [],
      is_receivable: false,
      due_date: ''
    });
    saveData('transactions');
  }

  // Reset form
  document.getElementById('acc-f-name').value    = '';
  document.getElementById('acc-f-balance').value = '0.00';
  document.getElementById('acc-f-type').value    = 'liquid';
  toggleAccountClosingFieldsFloating('liquid');
  const cd = document.getElementById('acc-f-close-day');
  const dd = document.getElementById('acc-f-due-day');
  if (cd) cd.value = '';
  if (dd) dd.value = '';

  closeFloatingAccountCreator();
  renderSettingsAccountsList();
  renderAll();
}

function createNewAccount(event) {
  event.preventDefault();
  const name    = document.getElementById('acc-name').value.trim();
  const type    = document.getElementById('acc-type').value;
  const balance = parseFloat(document.getElementById('acc-balance').value) || 0;

  const newAcc = { id: 'acc-' + Date.now(), name, type, balance };
  if (type === 'credit_card') {
    const closing = parseInt(document.getElementById('acc-close-day').value) || 1;
    const due = parseInt(document.getElementById('acc-due-day').value) || 10;
    const ym = getCurrentYearMonth();
    newAcc.card_schedule = {};
    newAcc.card_schedule[ym] = { closing, due };
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

async function removeAccount(accId) {
  if (!await showConfirm('¿Seguro que deseas eliminar esta cuenta? Se perderán todas sus transacciones.', { title: 'Eliminar cuenta', confirmText: 'Eliminar', danger: true })) return;
  const removedTxIds = state.transactions.filter(t => t.account_id === accId).map(t => t.id);
  removedTxIds.forEach(id => state.selectedTxIds.delete(id));
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
  const settingsCur = state.settings.currency || 'ARS';
  state.accounts.forEach(acc => {
    const accCur = acc.currency || settingsCur;
    const curLabel = accCur !== settingsCur ? ' · ' + accCur : '';
    const typeLabel = getAccountTypeLabel(acc.type);
    let scheduleInfo = '';
    if (acc.type === 'credit_card' && acc.card_schedule) {
      const ym = getCurrentYearMonth();
      const sch = acc.card_schedule[ym];
      if (sch) {
        scheduleInfo = ' · cierre ' + sch.closing;
      }
    }
    const item = document.createElement('div');
    item.className = 'account-list-item';
    item.style.cursor = 'pointer';
    item.innerHTML = `
      <div class="acc-list-info">
        <span class="acc-list-name">${acc.name}</span>
        <span class="acc-list-type">${typeLabel}${scheduleInfo}${curLabel}</span>
      </div>
      <span class="acc-list-actions">
        <button class="delete-btn" onclick="event.stopPropagation();openEditAccountModal('${acc.id}')" title="Editar"><i data-lucide="pencil"></i></button>
        <button class="delete-btn" onclick="event.stopPropagation();removeAccount('${acc.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>
      </span>
    `;
    item.addEventListener('click', () => filterTransactions(acc.id));
    container.appendChild(item);
  });
  lucide.createIcons();
}

function toggleAccountClosingFields(type) {
  const el = document.getElementById('cc-closing-fields');
  if (el) el.style.display = type === 'credit_card' ? 'block' : 'none';
}

// ── GENERAL SETTINGS ──────────────────────────────────────────
function saveCurrencySettings(event) {
  event.preventDefault();
  state.settings.currency = document.getElementById('set-currency').value;
  state.settings.showSymbol = document.getElementById('set-show-symbol').checked;
  state.settings.decimals = parseInt(document.getElementById('set-decimals').value);
  localStorage.setItem('wallet_settings', JSON.stringify(state.settings));
  const btn = event.submitter;
  if (btn) { const t = btn.textContent; btn.textContent = '✓ Guardado'; setTimeout(() => { btn.textContent = t; }, 1500); }
  renderAll();
}

function saveGeneralSettings(event) {
  event.preventDefault();
  state.settings.geminiKey = document.getElementById('set-gemini-key').value.trim();
  localStorage.setItem('wallet_settings', JSON.stringify(state.settings));
  // Visual feedback
  const btn = event.submitter;
  if (btn) { const t = btn.textContent; btn.textContent = '✓ Guardado'; setTimeout(() => { btn.textContent = t; }, 1500); }
}

// ── TRANSACTIONS CRUD ─────────────────────────────────────────
function openTransactionModal(txId) {
  updateSelectors();
  state.editingTxId = txId || null;

  if (!txId && state.currentView !== 'all' && state.currentView !== 'receivables') {
    document.getElementById('tx-account').value = state.currentView;
  }

  const modalTitle = document.querySelector('#tx-modal .modal-title');
  const submitBtn  = document.querySelector('#tx-form button[type="submit"]');

  if (txId) {
    const tx = state.transactions.find(t => t.id === txId);
    if (!tx) return;

    modalTitle.textContent = 'Editar transacción';
    submitBtn.textContent  = 'Guardar cambios';

    document.getElementById('tx-date').value = tx.date;
    document.getElementById('tx-account').value = tx.account_id;
    document.getElementById('tx-payee-search').value = tx.payee;
    document.getElementById('tx-category-search').value = tx.category_name || '';
    document.getElementById('tx-amount').value = Math.abs(tx.amount);
    document.getElementById('tx-notes').value = tx.notes || '';

    setTxSign(tx.amount < 0 ? -1 : 1);

    renderTagsChecklist(tx.tags);

    const chk = document.getElementById('tx-is-receivable');
    chk.checked = !!tx.is_receivable;
    toggleReceivableFields(!!tx.is_receivable);
    document.getElementById('tx-due-date').value = tx.due_date || '';

    // Installment fields when editing
    const isInst = !!(tx.installment_group && tx.installment_total);
    const instChk = document.getElementById('tx-is-installment');
    instChk.checked = isInst;
    instChk.disabled = isInst; // can't change cuota structure when editing
    if (isInst) {
      document.getElementById('tx-installment-index-display').textContent =
        `Cuota ${tx.installment_index} de ${tx.installment_total}`;
      document.getElementById('tx-installment-index-display').style.display = 'inline-flex';
      document.getElementById('tx-installment-editor').style.display = 'none';
    } else {
      document.getElementById('tx-installment-index-display').style.display = 'none';
      document.getElementById('tx-installment-editor').style.display = 'none';
    }
    onAccountChangeInModal();
  } else {
    modalTitle.textContent = 'Registrar movimiento';
    submitBtn.textContent  = 'Guardar transacción';

    document.getElementById('tx-date').valueAsDate = new Date();
    setTxSign(-1);
    document.getElementById('tx-payee-search').value   = '';
    document.getElementById('tx-category-search').value = '';
    document.getElementById('tx-amount').value          = '';
    document.getElementById('tx-notes').value           = '';

    renderTagsChecklist();

    const chk = document.getElementById('tx-is-receivable');
    chk.checked = false;
    toggleReceivableFields(false);

    // Reset installment fields
    document.getElementById('tx-is-installment').checked = false;
    document.getElementById('tx-installment-count').value = '3';
    document.getElementById('tx-installment-editor').style.display = 'none';
    onAccountChangeInModal();
  }

  document.getElementById('tx-modal').classList.add('open');
  lucide.createIcons();
}

function closeTransactionModal() {
  document.getElementById('tx-modal').classList.remove('open');
  document.getElementById('tx-form').reset();
  state.editingTxId = null;
  state._batchEditIds = null;

  const modalTitle = document.querySelector('#tx-modal .modal-title');
  const submitBtn  = document.querySelector('#tx-form button[type="submit"]');
  modalTitle.textContent = 'Registrar movimiento';
  submitBtn.textContent  = 'Guardar transacción';

  const banner = document.getElementById('tx-batch-banner');
  if (banner) banner.style.display = 'none';

  // Hide installment fields
  const instFields = document.getElementById('tx-installment-fields');
  if (instFields) instFields.style.display = 'none';
  const instEditor = document.getElementById('tx-installment-editor');
  if (instEditor) instEditor.style.display = 'none';
  const instChk = document.getElementById('tx-is-installment');
  if (instChk) { instChk.checked = false; instChk.disabled = false; }
  const instBadge = document.getElementById('tx-installment-index-display');
  if (instBadge) instBadge.style.display = 'none';
}

function toggleReceivableFields(show) {
  document.getElementById('tx-receivable-details').style.display = show ? 'block' : 'none';
}

function onAccountChangeInModal() {
  const accId  = document.getElementById('tx-account').value;
  const acc    = state.accounts.find(a => a.id === accId);
  const isCC   = acc && acc.type === 'credit_card';
  const fields = document.getElementById('tx-installment-fields');
  const instChk = document.getElementById('tx-is-installment');
  if (!fields) return;
  fields.style.display = isCC ? 'flex' : 'none';
  if (!isCC) {
    instChk.checked = false;
    document.getElementById('tx-installment-editor').style.display = 'none';
  }
}

function onInstallmentCheck(checked) {
  const editor = document.getElementById('tx-installment-editor');
  editor.style.display = checked ? 'flex' : 'none';
  if (checked) {
    document.getElementById('tx-installment-count').value = '3';
    updateInstallmentPreview();
  }
}

function stepInstallment(delta) {
  const input = document.getElementById('tx-installment-count');
  const val = Math.min(48, Math.max(2, (parseInt(input.value) || 2) + delta));
  input.value = val;
  updateInstallmentPreview();
}

function updateInstallmentPreview() {
  const total   = parseInt(document.getElementById('tx-installment-count').value) || 0;
  const rawAmt  = parseFloat(document.getElementById('tx-amount').value) || 0;
  const previewVal = document.getElementById('inst-preview-val');
  const timeline   = document.getElementById('installment-timeline');
  const dateVal    = document.getElementById('tx-date').value;

  if (total >= 2 && rawAmt > 0) {
    const perCuota = rawAmt / total;
    previewVal.textContent = formatCurrency(perCuota);
  } else {
    previewVal.textContent = total >= 2 ? '—' : 'Mín. 2';
  }

  // Build timeline dots
  timeline.innerHTML = '';
  const maxDots = Math.min(total, 10);
  for (let i = 0; i < maxDots; i++) {
    if (i > 0) {
      const conn = document.createElement('div');
      conn.className = 'inst-connector';
      timeline.appendChild(conn);
    }
    const wrap  = document.createElement('div');
    wrap.className = 'inst-dot-wrap';
    const dot   = document.createElement('div');
    dot.className = 'inst-dot ' + (i === 0 ? 'now' : 'future');
    dot.textContent = i + 1;
    const lbl   = document.createElement('div');
    lbl.className = 'inst-dot-label ' + (i === 0 ? 'now' : '');
    if (dateVal && i < 6) {
      const d = new Date(dateVal + 'T12:00:00');
      d.setMonth(d.getMonth() + i);
      lbl.textContent = d.toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' });
    } else if (i === 0) {
      lbl.textContent = 'ahora';
    } else {
      lbl.textContent = '+' + i + 'm';
    }
    wrap.appendChild(dot);
    wrap.appendChild(lbl);
    timeline.appendChild(wrap);
  }
  if (total > 10) {
    const conn = document.createElement('div');
    conn.className = 'inst-connector';
    timeline.appendChild(conn);
    const more = document.createElement('div');
    more.className = 'inst-dot-wrap';
    more.innerHTML = `<div class="inst-dot future" style="font-size:11px;">…</div><div class="inst-dot-label">+${total - 10}</div>`;
    timeline.appendChild(more);
  }
}

function toggleInstallmentFields(checked) {
  // Legacy stub — kept for backward compat, delegates to new fn
  onAccountChangeInModal();
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

  if (state._batchEditIds) {
    const activeTags = [];
    document.querySelectorAll('input[name="tx-tags"]:checked').forEach(c => activeTags.push(c.value));
    const amount = !isNaN(rawAmount) ? Math.abs(rawAmount) * state.currentTxSign : null;

    const tagsChanged = document.querySelectorAll('input[name="tx-tags"]').length > 0;
    state._batchEditIds.forEach(id => {
      const tx = state.transactions.find(t => t.id === id);
      if (!tx) return;
      if (dateVal) tx.date = dateVal;
      if (accountId) tx.account_id = accountId;
      if (payee) tx.payee = payee;
      if (categoryName) tx.category_name = categoryName;
      if (amount !== null) tx.amount = amount;
      if (notes) tx.notes = notes;
      if (tagsChanged) tx.tags = activeTags;
    });
    saveData('transactions');
    state._batchEditIds = null;
    document.getElementById('tx-modal').classList.remove('open');
    document.getElementById('tx-form').reset();
    const banner = document.getElementById('tx-batch-banner');
    if (banner) banner.style.display = 'none';
    renderAll();
    return;
  }

  if (!accountId || isNaN(rawAmount)) return;

  if (payee && !state.predefined.payees.includes(payee)) { state.predefined.payees.push(payee); saveData('predefined'); }
  const catNames = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name);
  if (categoryName && !catNames.includes(categoryName)) {
    state.predefined.categories.push({ name: categoryName, icon: 'tag' });
    saveData('predefined');
  }

  const activeTags = [];
  document.querySelectorAll('input[name="tx-tags"]:checked').forEach(c => activeTags.push(c.value));

  const amount = Math.abs(rawAmount) * state.currentTxSign;

  if (state.editingTxId) {
    const tx = state.transactions.find(t => t.id === state.editingTxId);
    if (tx) {
      tx.date = dateVal;
      tx.account_id = accountId;
      tx.payee = payee;
      tx.category_name = categoryName;
      tx.amount = amount;
      tx.notes = notes;
      tx.tags = activeTags;
      tx.is_receivable = isReceivable;
      tx.due_date = isReceivable ? dueDate : '';
    }
  } else {
    const isInst = document.getElementById('tx-is-installment').checked;
    const totalCuotas = parseInt(document.getElementById('tx-installment-count').value) || 0;

    if (isInst && totalCuotas >= 2) {
      const groupId   = 'ig-' + Date.now();
      const perCuota  = amount / totalCuotas;  // negative amount / N = negative per cuota
      const today     = new Date().toISOString().split('T')[0];

      for (let i = 0; i < totalCuotas; i++) {
        const d = new Date(dateVal + 'T12:00:00');
        d.setMonth(d.getMonth() + i);
        const instDate = d.toISOString().split('T')[0];
        const isFuture = instDate > today;

        state.transactions.unshift({
          id: 'tx-' + Date.now() + '-' + i,
          date: instDate,
          account_id: accountId,
          payee,
          category_name: categoryName,
          amount: perCuota,
          notes: notes,
          tags: activeTags,
          is_receivable: false,
          due_date: '',
          is_future: isFuture,
          installment_group: groupId,
          installment_total: totalCuotas,
          installment_index: i + 1,
          installment_full_amount: Math.abs(amount)
        });
      }
    } else {
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
    }
  }

  saveData('transactions');
  closeTransactionModal();
  renderAll();
}

async function deleteTransaction(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;

  document.querySelectorAll('.row-action-menu').forEach(m => m.style.display = 'none');

  if (tx.installment_group) {
    if (!await showConfirm('¿Eliminar todas las cuotas de esta compra?', { title: 'Eliminar cuotas', confirmText: 'Eliminar todo', danger: true })) return;
    state.transactions = state.transactions.filter(t => t.installment_group !== tx.installment_group);
    state.selectedTxIds.clear();
  } else {
    if (!await showConfirm('¿Seguro que deseas eliminar esta transacción?', { title: 'Eliminar transacción', confirmText: 'Eliminar', danger: true })) return;
    state.transactions = state.transactions.filter(t => t.id !== txId);
    state.selectedTxIds.delete(txId);
  }
  saveData('transactions');
  renderAll();
}

async function markAsCollected(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;
  if (await showConfirm(`¿Marcar como cobrado el préstamo de ${formatCurrency(Math.abs(tx.amount))} de ${tx.payee}?`, { title: 'Cobrar préstamo', confirmText: 'Marcar cobrado' })) {
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
  showView('main');
  state.currentView = viewId;
  localStorage.setItem('wallet_last_filter', viewId);
  clearTxSelection();
  renderAll();
}

// ── CALCULATE ────────────────────────────────────────────────
// ── CATEGORY ICON HELPER ─────────────────────────────────
function getCategoryIcon(catName) {
  if (!catName) return '<span class="cat-icon"><i data-lucide="tag"></i></span>';
  const cat = state.predefined.categories.find(c => (typeof c === 'string' ? c : c.name) === catName);
  const icon = cat && typeof cat !== 'string' ? cat.icon : 'tag';
  return `<span class="cat-icon"><i data-lucide="${icon}"></i></span>`;
}

function calculateBalances() {
  const balances = { liquid: 0, credit_card: 0, receivables: 0 };
  state.accounts.forEach(acc => {
    if (acc.type === 'liquid')      balances.liquid      += Number(acc.balance) || 0;
    if (acc.type === 'credit_card') balances.credit_card += Number(acc.balance) || 0;
  });
  state.transactions.forEach(tx => {
    if (tx.is_future) return;   // cuotas futuras no afectan balances actuales
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
  updateFilterBadge();
}

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

    let scheduleHtml = '';
    if (acc.type === 'credit_card') {
      const ym = getCurrentYearMonth();
      const sch = getCardSchedule(acc.id, ym);
      if (sch) {
        const monthNamesShort = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const [, m] = ym.split('-').map(Number);
        scheduleHtml = '<span class="acc-schedule-sidebar">cierre ' + sch.closing + ' ' + monthNamesShort[m] + ' · vence ' + sch.due + ' ' + monthNamesShort[m] + '</span>';
      } else {
        scheduleHtml = '<span class="acc-schedule-sidebar acc-schedule-pending">Configurar cierre y vencimiento</span>';
      }
    }

    li.innerHTML = `
      <span class="acc-name-sidebar">${acc.name}</span>
      ${scheduleHtml}
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
      if (acc.type === 'credit_card') {
        const ym = getCurrentYearMonth();
        const sch = getCardSchedule(acc.id, ym);
        if (sch) {
          const monthNamesShort = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
          const [, m] = ym.split('-').map(Number);
          subtitle = `Tarjeta · cierre ${sch.closing} ${monthNamesShort[m]} · vence ${sch.due} ${monthNamesShort[m]}`;
        } else {
          subtitle = `Tarjeta · Configurar cierre y vencimiento`;
        }
        state._subtitleHtml = !!sch ? false : true;
      } else {
        subtitle = 'Cuenta líquida';
        state._subtitleHtml = false;
      }
    }
  }

  if (titleEl)    titleEl.textContent    = title;
  const subtitleTextEl = document.getElementById('view-subtitle-text');
  const addBtn = document.getElementById('subtitle-add-btn');
  if (subtitleTextEl) {
    if (state._subtitleHtml) {
      subtitleTextEl.innerHTML = subtitle;
    } else {
      subtitleTextEl.textContent = subtitle;
    }
  }

  // Show/hide and configure the "+" button for adding accounts
  if (addBtn) {
    if (state.currentView === 'all' || state.currentView.startsWith('type-')) {
      addBtn.style.display = '';
      let accType = null;
      if (state.currentView === 'type-liquid') accType = 'liquid';
      else if (state.currentView === 'type-credit_card') accType = 'credit_card';
      addBtn.onclick = () => openFloatingAccountCreator(accType);
    } else {
      addBtn.style.display = 'none';
    }
  }
}

function renderTransactions() {
  const tbody  = document.getElementById('tx-table-body');
  const search = document.getElementById('tx-search-input').value.toLowerCase();
  tbody.innerHTML = '';

  let filtered = [...state.transactions];

  // Show/hide account column
  const isSingleAccount = state.currentView !== 'all' && !state.currentView.startsWith('type-') && state.currentView !== 'receivables';
  document.querySelector('.ledger')?.classList.toggle('hide-account-col', isSingleAccount);
  if (state.currentView === 'receivables') {
    filtered = filtered.filter(t => t.is_receivable);
  } else if (state.currentView.startsWith('type-')) {
    const type = state.currentView.replace('type-', '');
    const accIds = new Set(state.accounts.filter(a => a.type === type).map(a => a.id));
    filtered = filtered.filter(t => accIds.has(t.account_id));
  } else if (state.currentView !== 'all') {
    filtered = filtered.filter(t => t.account_id === state.currentView);
  }

  // Apply table filters
  if (state.tableFilters.length > 0) {
    filtered = filtered.filter(tx => {
      const acc = state.accounts.find(a => a.id === tx.account_id);
      return state.tableFilters.every(f => {
        if (!f.value) return true;
        const val = f.value.toLowerCase();
        switch (f.column) {
          case 'payee': {
            const text = (tx.payee || '').toLowerCase();
            if (f.operator === 'contains') return text.includes(val);
            if (f.operator === 'equals') return text === val;
            if (f.operator === 'not_equals') return text !== val;
            return true;
          }
          case 'notes': {
            const text = (tx.notes || '').toLowerCase();
            if (f.operator === 'contains') return text.includes(val);
            if (f.operator === 'equals') return text === val;
            if (f.operator === 'not_equals') return text !== val;
            return true;
          }
          case 'tags': {
            const tags = (tx.tags || []).map(t => t.toLowerCase());
            if (f.operator === 'contains') return tags.some(t => t.includes(val));
            if (f.operator === 'equals') return tags.some(t => t === val);
            if (f.operator === 'not_equals') return !tags.some(t => t === val);
            return true;
          }
          case 'category_name': {
            const text = (tx.category_name || '').toLowerCase();
            if (f.operator === 'contains') return text.includes(val);
            if (f.operator === 'equals') return text === val;
            if (f.operator === 'not_equals') return text !== val;
            return true;
          }
          case 'account_name': {
            const text = (acc ? acc.name : '').toLowerCase();
            if (f.operator === 'contains') return text.includes(val);
            if (f.operator === 'equals') return text === val;
            if (f.operator === 'not_equals') return text !== val;
            return true;
          }
          case 'amount': {
            const num = Number(tx.amount);
            const filterNum = Number(f.value);
            if (isNaN(filterNum)) return true;
            if (f.operator === 'equals') return num === filterNum;
            if (f.operator === 'gt') return num > filterNum;
            if (f.operator === 'lt') return num < filterNum;
            if (f.operator === 'gte') return num >= filterNum;
            if (f.operator === 'lte') return num <= filterNum;
            return true;
          }
          case 'date': {
            const d = tx.date || '';
            if (f.operator === 'equals') return d === f.value;
            if (f.operator === 'before') return d < f.value;
            if (f.operator === 'after') return d > f.value;
            return true;
          }
          default:
            return true;
        }
      });
    });
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

  // Separate present/future
  const today   = new Date().toISOString().split('T')[0];
  const present = filtered.filter(tx => !tx.is_future);
  const futures  = filtered.filter(tx => tx.is_future);

  // Count badge only counts present rows
  document.getElementById('tx-count-badge').textContent = present.length;

  if (present.length === 0 && futures.length === 0) {
    const colCount = isSingleAccount ? 10 : 11;
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${colCount}">No hay movimientos registrados.</td></tr>`;
    return;
  }

  const appendTxRow = (tx, isFutureRow) => {
    const acc       = state.accounts.find(a => a.id === tx.account_id);
    const isExpense = tx.amount < 0;
    const isSelected = state.selectedTxIds.has(tx.id);

    const tagPills = (tx.tags || []).map(tag => {
      const c = _tagColor(tag);
      return `<span class="tag-pill" style="background:${c.bg};color:${c.text};">#${tag}</span>`;
    }).join('');

    const notesHtml = tx.notes || '';
    const tagsHtml  = tagPills || '<span class="no-tags">—</span>';

    const amountVal   = isExpense ? '-' + formatCurrency(Math.abs(tx.amount)) : '+' + formatCurrency(tx.amount);
    const amountClass = isExpense ? 'expense' : 'income';

    let payeeCellHtml = `<span class="payee-name">${tx.payee}</span>`;
    let cuotaCellHtml = '<span style="color:var(--text-lo)">—</span>';
    if (tx.installment_total) {
      cuotaCellHtml = `<span class="cuota-badge" title="Total: ${formatCurrency(tx.installment_full_amount)}">${tx.installment_index}/${tx.installment_total}</span>`;
    }

    let actionsHtml = `
      <div class="row-action-dropdown">
        <button class="row-action" onclick="event.stopPropagation();toggleRowMenu(this)" title="Acciones">
          <i data-lucide="more-horizontal"></i>
        </button>
        <div class="row-action-menu" style="display:none;">
          ${tx.is_receivable ? `<button class="ram-item" onclick="markAsCollected('${tx.id}');closeRowMenu(this)"><i data-lucide="check-square"></i> Cobrado</button>` : ''}
          <button class="ram-item" onclick="openTransactionModal('${tx.id}');closeRowMenu(this)"><i data-lucide="pencil"></i> Editar</button>
          <button class="ram-item danger" onclick="deleteTransaction('${tx.id}')"><i data-lucide="trash-2"></i> Eliminar</button>
        </div>
      </div>
    `;

    const tr = document.createElement('tr');
    tr.dataset.txId = tx.id;
    if (isSelected) tr.classList.add('selected');
    if (isFutureRow) tr.classList.add('tx-future');

    tr.innerHTML = `
      <td class="tx-cell">${isFutureRow ? '' : `<input type="checkbox" class="tx-checkbox" data-tx-id="${tx.id}" ${isSelected ? 'checked' : ''} onchange="toggleTxSelection('${tx.id}')">`}</td>
      <td class="date-cell editable-cell" data-field="date" title="Click para editar">${formatDate(tx.date)}</td>
      <td class="col-account account-cell editable-cell" data-field="account_id" title="Click para editar">${acc ? acc.name : '—'}</td>
      <td class="payee-cell editable-cell" data-field="payee" title="Click para editar">${payeeCellHtml}</td>
      <td class="cuota-cell">${cuotaCellHtml}</td>
      <td class="notes-cell editable-cell" data-field="notes" title="Click para editar">${notesHtml || '<span style="color:var(--text-lo)">—</span>'}</td>
      <td class="tags-cell editable-cell" data-field="tags" title="Click para editar">${tagsHtml}</td>
      <td class="category-cell editable-cell" data-field="category_name" title="Click para editar">${getCategoryIcon(tx.category_name)} ${tx.category_name || 'Otros'}</td>
      <td class="amount-cell ${amountClass} editable-cell" data-field="amount" title="Click para editar">${amountVal}</td>
      <td class="actions-cell">${actionsHtml}</td>
    `;
    tbody.appendChild(tr);

    if (!isFutureRow) {
      tr.querySelectorAll('.editable-cell').forEach(cell => {
        cell.addEventListener('click', e => {
          e.stopPropagation();
          const field = cell.dataset.field;
          const opts = getEditOptions(field, tx);
          if (!opts) return;
          startInlineEdit(cell, tx.id, field, opts.type, opts);
        });
      });
    }
  };

  // Render future group first (above present)
  if (futures.length > 0) {
    const colCount  = isSingleAccount ? 10 : 11;
    const groupKey  = 'future-group-open';
    const isOpen    = sessionStorage.getItem(groupKey) === 'true';

    // Header row
    const headerTr  = document.createElement('tr');
    headerTr.className = 'future-group-row';
    const headerTd  = document.createElement('td');
    headerTd.colSpan = colCount;
    const headerDiv = document.createElement('div');
    headerDiv.className = 'future-group-header';
    headerDiv.innerHTML = `
      <span class="future-group-arrow ${isOpen ? 'open' : ''}">›</span>
      <span>Cuotas futuras</span>
      <span class="future-group-count">${futures.length}</span>
    `;
    headerDiv.addEventListener('click', () => {
      const nowOpen = sessionStorage.getItem(groupKey) === 'true';
      sessionStorage.setItem(groupKey, (!nowOpen).toString());
      renderTransactions();
    });
    headerTd.appendChild(headerDiv);
    headerTr.appendChild(headerTd);
    tbody.appendChild(headerTr);

    // Future rows (collapsible)
    if (isOpen) {
      futures.forEach(tx => appendTxRow(tx, true));
      // spacer between future and present
      const spacer = document.createElement('tr');
      spacer.className = 'future-spacer';
      const td = document.createElement('td');
      td.colSpan = colCount;
      spacer.appendChild(td);
      tbody.appendChild(spacer);
    }
  }

  // Render present rows below future
  present.forEach(tx => appendTxRow(tx, false));

  updateSelectAllCheckbox();
  updateSelectionBar();
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
function openGeminiImportModal() {
  if (!state.settings.geminiKey) {
    alert('Configurá primero tu Gemini API Key en Ajustes → General.');
    showView('settings');
    return;
  }
  closeImportModal();
  updateSelectors();
  document.getElementById('import-setup-view').style.display  = 'block';
  document.getElementById('import-review-view').style.display = 'none';
  document.getElementById('import-modal').classList.add('open');
}

function closeGeminiImportModal() {
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

  const categoriesList = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name).join(', ');
  const curCode = state.settings.currency || 'ARS';
  const prompt = `Actúas como un procesador estructurado de extractos bancarios en español.
Analiza el siguiente texto y extrae todas las transacciones financieras.
Moneda del usuario: ${curCode}.

Texto:
"${text}"

Categorías válidas (usá estrictamente una de estas o mapeá a 'Otros'):
[${categoriesList}]

Reglas:
- Gastos/egresos: monto NEGATIVO.
- Ingresos/cobros: monto POSITIVO.
- Fechas en formato YYYY-MM-DD. Si no hay año, usá 2026.
- Respondé ÚNICAMENTE con un arreglo JSON válido, sin markdown ni texto adicional.
- Todos los montos deben expresarse numéricamente en ${curCode}.

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
    const catOptions = state.predefined.categories.map(c => {
      const name = typeof c === 'string' ? c : c.name;
      return `<option value="${name}" ${name.toLowerCase() === (tx.category || '').toLowerCase() ? 'selected' : ''}>${name}</option>`;
    }).join('');

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
  closeGeminiImportModal();
  renderAll();
}

// ── DASHBOARD ─────────────────────────────────────────────────
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
    '#5b52f5','#7c75f8','#38bdf8','#34d399','#fbbf24',
    '#f87171','#a78bfa','#fb923c','#4ade80','#60a5fa',
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
  const incomeColor = isDark ? '#4ade80' : '#22c55e';
  const expenseColor = isDark ? '#f87171' : '#ef4444';

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

// ── WELCOME MODAL ─────────────────────────────────────────────
function openWelcomeModal() {
  document.getElementById('welcome-modal').classList.add('open');
  lucide.createIcons();
}

function closeWelcomeModal() {
  document.getElementById('welcome-modal').classList.remove('open');
}

function showWelcomeOnFirstVisit() {
  const seen = localStorage.getItem('wallet_welcome_seen');
  if (!seen) {
    localStorage.setItem('wallet_welcome_seen', 'true');
    openWelcomeModal();
  }
}

// ── CONFIRM MODAL ──────────────────────────────────────────────
let _confirmResolve = null;

function showConfirm(message, { title = 'Confirmar', confirmText = 'Confirmar', danger = false } = {}) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const btn = document.getElementById('confirm-action-btn');
    btn.textContent = confirmText;
    btn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    document.getElementById('confirm-modal').classList.add('open');
    lucide.createIcons();
  });
}

function resolveConfirm(val) {
  document.getElementById('confirm-modal').classList.remove('open');
  if (_confirmResolve) { _confirmResolve(val); _confirmResolve = null; }
}

// ── TX SELECTION ──────────────────────────────────────────────
function toggleTxSelection(txId) {
  if (state.selectedTxIds.has(txId)) {
    state.selectedTxIds.delete(txId);
  } else {
    state.selectedTxIds.add(txId);
  }
  const row = document.querySelector(`tr[data-tx-id="${txId}"]`);
  if (row) row.classList.toggle('selected', state.selectedTxIds.has(txId));
  const cb = row ? row.querySelector('.tx-checkbox') : null;
  if (cb) cb.checked = state.selectedTxIds.has(txId);
  updateSelectionBar();
  updateSelectAllCheckbox();
}

function toggleSelectAll() {
  const selectAll = document.getElementById('tx-select-all').checked;
  const checkboxes = document.querySelectorAll('.tx-checkbox');
  checkboxes.forEach(cb => {
    const txId = cb.dataset.txId;
    if (selectAll) {
      state.selectedTxIds.add(txId);
    } else {
      state.selectedTxIds.delete(txId);
    }
    cb.closest('tr').classList.toggle('selected', selectAll);
    cb.checked = selectAll;
  });
  updateSelectionBar();
}

function clearTxSelection() {
  state.selectedTxIds.clear();
  document.querySelectorAll('.tx-checkbox').forEach(cb => {
    cb.checked = false;
    cb.closest('tr').classList.remove('selected');
  });
  updateSelectAllCheckbox();
  updateSelectionBar();
}

// ── SELECTION BAR DROPDOWN ───────────────────────────────
function toggleSelMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('sel-dropdown-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function closeSelMenu() {
  const menu = document.getElementById('sel-dropdown-menu');
  if (menu) menu.style.display = 'none';
}

// ── TABLE FILTERS ─────────────────────────────────────────
const FILTER_COLUMNS = [
  { value: 'payee', label: 'Beneficiario', type: 'text' },
  { value: 'notes', label: 'Notas', type: 'text' },
  { value: 'tags', label: 'Etiquetas', type: 'text' },
  { value: 'category_name', label: 'Categoría', type: 'text' },
  { value: 'account_name', label: 'Cuenta', type: 'text' },
  { value: 'amount', label: 'Monto', type: 'number' },
  { value: 'date', label: 'Fecha', type: 'date' },
];

function getOperatorsForColumn(col) {
  if (!col) return [{ value: 'contains', label: 'contiene' }];
  const def = FILTER_COLUMNS.find(c => c.value === col);
  if (!def) return [{ value: 'contains', label: 'contiene' }];
  if (def.type === 'number') {
    return [
      { value: 'equals', label: '=' },
      { value: 'gt', label: '>' },
      { value: 'lt', label: '<' },
      { value: 'gte', label: '≥' },
      { value: 'lte', label: '≤' },
    ];
  }
  if (def.type === 'date') {
    return [
      { value: 'equals', label: 'es' },
      { value: 'before', label: 'antes' },
      { value: 'after', label: 'después' },
    ];
  }
  return [
    { value: 'contains', label: 'contiene' },
    { value: 'equals', label: 'es' },
    { value: 'not_equals', label: 'no es' },
  ];
}

function openFilterPanel() {
  const panel = document.getElementById('filter-panel');
  const btn = document.getElementById('filter-toggle-btn');
  if (panel) {
    panel.classList.toggle('open');
    if (btn) btn.classList.toggle('active', panel.classList.contains('open'));
    if (panel.classList.contains('open')) renderFilterPanel();
  }
}

function renderFilterPanel() {
  const container = document.getElementById('filter-rows');
  if (!container) return;
  container.innerHTML = '';
  if (state.tableFilters.length === 0) {
    addFilterRow();
    return;
  }
  state.tableFilters.forEach(f => appendFilterRowEl(container, f));
}

let _filterIdCounter = 0;
function addFilterRow() {
  const id = 'f' + (++_filterIdCounter);
  state.tableFilters.push({ id, column: 'payee', operator: 'contains', value: '' });
  const container = document.getElementById('filter-rows');
  if (container) appendFilterRowEl(container, state.tableFilters[state.tableFilters.length - 1]);
}

function appendFilterRowEl(container, filter) {
  const row = document.createElement('div');
  row.className = 'filter-row';
  row.dataset.fid = filter.id;

  const colSel = document.createElement('select');
  colSel.className = 'filter-col-sel';
  FILTER_COLUMNS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.value;
    opt.textContent = c.label;
    if (c.value === filter.column) opt.selected = true;
    colSel.appendChild(opt);
  });
  colSel.onchange = () => {
    filter.column = colSel.value;
    filter.operator = getOperatorsForColumn(filter.column)[0].value;
    filter.value = '';
    // Update operator select in-place
    opSel.innerHTML = '';
    getOperatorsForColumn(filter.column).forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.value === filter.operator) opt.selected = true;
      opSel.appendChild(opt);
    });
    // Update input type in-place
    const colDef = FILTER_COLUMNS.find(c => c.value === filter.column);
    if (colDef && colDef.type === 'number') { valInput.type = 'number'; valInput.step = '0.01'; valInput.placeholder = '0.00'; }
    else if (colDef && colDef.type === 'date') { valInput.type = 'date'; valInput.placeholder = ''; }
    else { valInput.type = 'text'; valInput.placeholder = 'Valor…'; }
    valInput.value = '';
    applyFilters();
  };

  const opSel = document.createElement('select');
  opSel.className = 'filter-op-sel';
  const ops = getOperatorsForColumn(filter.column);
  ops.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.value === filter.operator) opt.selected = true;
    opSel.appendChild(opt);
  });
  opSel.onchange = () => {
    filter.operator = opSel.value;
    applyFilters();
  };

  const valInput = document.createElement('input');
  valInput.className = 'filter-val-input';
  const colDef = FILTER_COLUMNS.find(c => c.value === filter.column);
  if (colDef && colDef.type === 'number') { valInput.type = 'number'; valInput.step = '0.01'; }
  else if (colDef && colDef.type === 'date') valInput.type = 'date';
  else valInput.type = 'text';
  valInput.placeholder = 'Valor…';
  valInput.value = filter.value;
  valInput.oninput = () => {
    filter.value = valInput.value;
    applyFilters();
  };

  const removeBtn = document.createElement('button');
  removeBtn.className = 'filter-remove-btn';
  removeBtn.innerHTML = '<i data-lucide="x"></i>';
  removeBtn.title = 'Eliminar filtro';
  removeBtn.onclick = () => {
    state.tableFilters = state.tableFilters.filter(f => f.id !== filter.id);
    renderFilterPanel();
    applyFilters();
  };

  row.appendChild(colSel);
  row.appendChild(opSel);
  row.appendChild(valInput);
  row.appendChild(removeBtn);
  container.appendChild(row);
  lucide.createIcons();
}

function applyFilters() {
  renderTransactions();
  updateFilterBadge();
}

function updateFilterBadge() {
  const active = state.tableFilters.filter(f => f.value).length;
  const badge = document.getElementById('filter-count-badge');
  if (badge) {
    badge.textContent = active;
    badge.style.display = active > 0 ? '' : 'none';
  }
}

function clearAllFilters() {
  state.tableFilters = [];
  renderFilterPanel();
  applyFilters();
}

document.addEventListener('click', e => {
  if (!e.target.closest('.sel-dropdown')) {
    const m = document.getElementById('sel-dropdown-menu');
    if (m) m.style.display = 'none';
  }
});

// ── BATCH OPERATIONS ─────────────────────────────────────
function openBatchEditModal() {
  if (state.selectedTxIds.size === 0) return;
  // Single selection → open regular edit modal with data
  if (state.selectedTxIds.size === 1) {
    const id = [...state.selectedTxIds][0];
    clearTxSelection();
    openTransactionModal(id);
    return;
  }
  updateSelectors();
  state.editingTxId = null;
  state._batchEditIds = [...state.selectedTxIds];

  const modalTitle = document.querySelector('#tx-modal .modal-title');
  modalTitle.textContent = `Editar ${state._batchEditIds.length} transacciones`;

  // Add batch warning
  let banner = document.getElementById('tx-batch-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'tx-batch-banner';
    banner.className = 'tx-batch-banner';
    document.querySelector('#tx-form .modal-body').insertBefore(banner, document.querySelector('#tx-form .modal-body').firstChild);
  }
  banner.textContent = `Los cambios se aplicarán a las ${state._batchEditIds.length} transacciones seleccionadas. Solo se modificarán los campos que completes.`;
  banner.style.display = 'block';

  // Reset form
  document.getElementById('tx-date').value = '';
  document.getElementById('tx-account').value = '';
  document.getElementById('tx-payee-search').value = '';
  document.getElementById('tx-category-search').value = '';
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-notes').value = '';
  setTxSign(-1);

  renderTagsChecklist();

  document.getElementById('tx-is-receivable').checked = false;
  toggleReceivableFields(false);
  document.getElementById('tx-due-date').value = '';
  document.getElementById('tx-installment-fields').style.display = 'none';
  document.getElementById('tx-installment-editor').style.display = 'none';
  document.getElementById('tx-is-installment').checked = false;
  document.getElementById('tx-is-installment').disabled = false;

  document.getElementById('tx-modal').classList.add('open');
  lucide.createIcons();
}

function batchDeleteTransactions() {
  if (state.selectedTxIds.size === 0) return;
  const count = state.selectedTxIds.size;
  showConfirm(`¿Eliminar ${count} transacciones seleccionadas? Esta acción no se puede deshacer.`, {
    title: 'Eliminar transacciones',
    confirmText: `Eliminar ${count}`,
    danger: true
  }).then(ok => {
    if (!ok) return;
    state.transactions = state.transactions.filter(t => !state.selectedTxIds.has(t.id));
    state.selectedTxIds.clear();
    saveData('transactions');
    renderAll();
  });
}

// ── ROW ACTION DROPDOWN ──────────────────────────────────
function toggleRowMenu(btn) {
  const allMenus = document.querySelectorAll('.row-action-menu');
  const menu = btn.closest('.row-action-dropdown').querySelector('.row-action-menu');
  const isOpen = menu.style.display === 'block';
  allMenus.forEach(m => m.style.display = 'none');
  menu.style.display = isOpen ? 'none' : 'block';
}

function closeRowMenu(el) {
  if (!el) return;
  const menu = el.closest ? el.closest('.row-action-menu') : null;
  if (menu) menu.style.display = 'none';
}

// Close dropdowns on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.row-action-dropdown')) {
    document.querySelectorAll('.row-action-menu').forEach(m => m.style.display = 'none');
  }
});

function updateSelectAllCheckbox() {
  const checkboxes = document.querySelectorAll('.tx-checkbox');
  const selectAll = document.getElementById('tx-select-all');
  if (!selectAll) return;
  if (checkboxes.length === 0) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  } else {
    const checkedCount = [...checkboxes].filter(cb => cb.checked).length;
    selectAll.checked = checkedCount === checkboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }
}

function updateSelectionBar() {
  const bar = document.getElementById('tx-selection-bar');
  const text = document.getElementById('tx-selection-text');
  if (!bar || !text) return;

  if (state.selectedTxIds.size === 0) {
    bar.style.display = 'none';
    return;
  }

  let total = 0;
  state.selectedTxIds.forEach(id => {
    const tx = state.transactions.find(t => t.id === id);
    if (tx) total += tx.amount;
  });

  const count = state.selectedTxIds.size;
  const countStr = count === 1 ? '1 seleccionado' : `${count} seleccionados`;
  const totalStr = formatCurrency(Math.abs(total));
  const sign = total < 0 ? '−' : total > 0 ? '+' : '';
  text.textContent = `${countStr} · ${sign}${totalStr}`;
  bar.style.display = 'inline-flex';
  lucide.createIcons();
}

// ══════════════════════════════════════════════════════════════
//  INLINE EDITING — rewrite robusto
//  Estrategia:
//   • El dropdown se inserta en <body> con position:fixed y se
//     posiciona con getBoundingClientRect() en cada apertura.
//   • Un único listener global "mousedown" en capture phase
//     decide si cerrar o no, para evitar carreras de eventos.
//   • Las celdas texto/número abren el dropdown al hacer focus
//     y lo filtran mientras el usuario escribe.
//   • La celda de tags usa un dropdown de checkboxes propio.
//   • La celda de cuenta usa un dropdown custom (no <select>).
// ══════════════════════════════════════════════════════════════

let _ie = null;   // estado global del editor activo

// ── helpers de color de tag ───────────────────────────────────
function _tagColor(tag) {
  let hash = 0;
  const str = (tag || '').toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return { bg: `hsl(${hue}, 55%, 88%)`, text: `hsl(${hue}, 50%, 30%)` };
}

// ── posicionar dropdown fijo bajo una celda ───────────────────
function _positionDD(dd, anchorEl) {
  const r = anchorEl.getBoundingClientRect();
  const viewH = window.innerHeight;
  const ddH = Math.min(240, dd.scrollHeight || 200);
  const spaceBelow = viewH - r.bottom - 8;
  const spaceAbove = r.top - 8;

  dd.style.left     = r.left + 'px';
  dd.style.minWidth = Math.max(r.width, 160) + 'px';
  dd.style.maxWidth = '320px';

  if (spaceBelow >= ddH || spaceBelow >= spaceAbove) {
    dd.style.top    = (r.bottom + 4) + 'px';
    dd.style.bottom = 'auto';
  } else {
    dd.style.bottom = (viewH - r.top + 4) + 'px';
    dd.style.top    = 'auto';
  }
}

// ── crear y mostrar dropdown genérico de lista ─────────────────
function _makeListDD(items, currentValue, onSelect) {
  _closeDD();
  const dd = document.createElement('div');
  dd.className = 'comfy-dropdown open';
  dd.style.position = 'fixed';
  dd.style.zIndex   = '9999';

  if (!items.length) {
    const e = document.createElement('div');
    e.className = 'comfy-dropdown-empty';
    e.textContent = 'Sin sugerencias';
    dd.appendChild(e);
  } else {
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'comfy-dropdown-item';
      const isActive = Array.isArray(currentValue)
        ? currentValue.includes(item)
        : item === currentValue;
      if (isActive) row.classList.add('active');
      row.innerHTML = `<span>${item}</span><span class="check">✓</span>`;
      row.addEventListener('mousedown', e => {
        e.preventDefault();   // impide que el blur del input cierre todo antes
        onSelect(item);
      });
      dd.appendChild(row);
    });
  }

  document.body.appendChild(dd);
  return dd;
}

// ── cerrar dropdown sin cerrar el editor ─────────────────────
function _closeDD() {
  const old = document.getElementById('wallet-dd');
  if (old) old.remove();
  if (_ie) _ie.dd = null;
}

// ── cerrar el editor completo ─────────────────────────────────
function closeInlineEditor(commit) {
  if (!_ie) return;
  const { cell, txId, field, originalValue, getValue, parser } = _ie;

  _closeDD();
  cell.classList.remove('editing');
  _ie = null;

  if (commit) {
    const rawVal = getValue();
    const parsed = parser ? parser(rawVal) : rawVal;
    // Comparación flexible para arrays (tags)
    const unchanged = Array.isArray(parsed)
      ? JSON.stringify(parsed) === JSON.stringify(originalValue)
      : parsed === originalValue || parsed === null || parsed === undefined;

    if (!unchanged) {
      const tx = state.transactions.find(t => t.id === txId);
      if (tx && parsed !== null && parsed !== undefined) {
        tx[field] = parsed;
        saveData('transactions');
      }
    }
  }

  renderTransactions();
  lucide.createIcons();
}

// ── listener global que detecta clicks fuera ─────────────────
function _globalMousedown(e) {
  if (!_ie) return;
  const inCell = _ie.cell.contains(e.target);
  const inDD   = _ie.dd && _ie.dd.contains(e.target);
  if (!inCell && !inDD) {
    closeInlineEditor(true);
  }
}

document.addEventListener('mousedown', _globalMousedown, true);

// ── opciones de edición por campo ────────────────────────────
function getEditOptions(field, tx) {
  switch (field) {
    case 'date':
      return {
        type: 'date',
        parser: v => v || tx.date
      };
    case 'account_id':
      return {
        type: 'select',
        options: state.accounts.map(a => ({ value: a.id, label: a.name })),
        parser: v => v
      };
    case 'payee':
      return {
        type: 'text',
        suggestions: () => {
          const fromTxs = [...new Set(state.transactions.map(t => t.payee).filter(Boolean))];
          return [...new Set([...state.predefined.payees, ...fromTxs])];
        },
        parser: v => v.trim() || tx.payee
      };
    case 'category_name':
      return {
        type: 'text',
        suggestions: () => {
          const fromTxs = [...new Set(state.transactions.map(t => t.category_name).filter(Boolean))];
          const catNames = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name);
          return [...new Set([...catNames, ...fromTxs])];
        },
        parser: v => v.trim() || 'Otros'
      };
    case 'notes':
      return {
        type: 'text',
        parser: v => v.trim()
      };
    case 'tags':
      return {
        type: 'tags',
        suggestions: () => {
          const fromTxs = [...new Set(state.transactions.flatMap(t => t.tags || []))];
          return [...new Set([...state.predefined.tags, ...fromTxs])];
        },
        parser: v => v   // ya es array
      };
    case 'amount': {
      const sign = tx.amount < 0 ? -1 : 1;
      return {
        type: 'number',
        parser: v => {
          const n = parseFloat(v);
          return isNaN(n) ? null : sign * Math.abs(n);
        }
      };
    }
    default:
      return null;
  }
}

// ── función principal ─────────────────────────────────────────
function startInlineEdit(cell, txId, field, type, options) {
  if (_ie) closeInlineEditor(false);

  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;

  const originalValue = tx[field];
  cell.classList.add('editing');
  cell.innerHTML = '';

  _ie = {
    cell, txId, field, originalValue,
    dd: null,
    getValue: () => originalValue,
    parser: options.parser || null
  };

  // ── TIPO: text / number / date ─────────────────────────────
  if (type === 'text' || type === 'number' || type === 'date') {
    const input = document.createElement('input');
    input.type = type;
    input.className = 'inline-editor';
    if (type === 'number') { input.step = '0.01'; input.min = '0'; }
    let displayVal;
    if (type === 'number') displayVal = Math.abs(originalValue);
    else if (type === 'date') displayVal = originalValue || '';
    else displayVal = originalValue || '';
    input.value = displayVal;
    cell.appendChild(input);

    _ie.getValue = () => input.value;

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); closeInlineEditor(true); }
      if (e.key === 'Escape') { e.preventDefault(); closeInlineEditor(false); }
    });

    if (type === 'text' && options.suggestions) {
      const openSuggestDD = (filter) => {
        const all = options.suggestions();
        const filtered = filter
          ? all.filter(s => s.toLowerCase().includes(filter.toLowerCase()))
          : all;
        if (!filtered.length) { _closeDD(); return; }
        const dd = _makeListDD(filtered, originalValue, (item) => {
          input.value = item;
          _closeDD();
          closeInlineEditor(true);
        });
        dd.id = 'wallet-dd';
        _positionDD(dd, cell);
        _ie.dd = dd;
      };
      input.addEventListener('focus', () => openSuggestDD(input.value));
      input.addEventListener('input', () => openSuggestDD(input.value));
    }

    setTimeout(() => { input.focus(); input.select(); }, 0);
  }

  // ── TIPO: select ─────────────────────────────────────────
  else if (type === 'select') {
    const items  = options.options || [];
    const currentLabel = items.find(i => i.value === originalValue);
    const dispEl = document.createElement('div');
    dispEl.className = 'inline-editor inline-editor-display';
    dispEl.textContent = currentLabel ? currentLabel.label : '—';
    cell.appendChild(dispEl);

    _ie.getValue = () => _ie._chosen !== undefined ? _ie._chosen : originalValue;
    _ie._chosen = undefined;

    const openSelectDD = () => {
      const labels = items.map(i => i.label);
      const curLabel = currentLabel ? currentLabel.label : '';
      const dd = _makeListDD(labels, curLabel, (label) => {
        const found = items.find(i => i.label === label);
        if (found) { _ie._chosen = found.value; dispEl.textContent = label; }
        _closeDD();
        closeInlineEditor(true);
      });
      dd.id = 'wallet-dd';
      _positionDD(dd, cell);
      _ie.dd = dd;
    };

    dispEl.addEventListener('click', openSelectDD);
    setTimeout(openSelectDD, 0);
  }

  // ── TIPO: tags ────────────────────────────────────────────
  else if (type === 'tags') {
    const current = new Set(Array.isArray(originalValue) ? originalValue : []);

    const wrap = document.createElement('div');
    wrap.className = 'inline-editor-tags';
    cell.appendChild(wrap);

    _ie.getValue = () => Array.from(current);

    const renderPills = () => {
      wrap.innerHTML = '';
      current.forEach(tag => {
        const pill = document.createElement('span');
        const c = _tagColor(tag);
        pill.className = 'inline-tag-pill';
        pill.style.background = c.bg;
        pill.style.color = c.text;
        pill.innerHTML = `#${tag}<span class="remove-tag" data-tag="${tag}">×</span>`;
        wrap.appendChild(pill);
      });
      const addBtn = document.createElement('span');
      addBtn.className = 'inline-tag-add';
      addBtn.textContent = current.size ? '+ agregar' : '+ etiqueta';
      wrap.appendChild(addBtn);
    };

    renderPills();

    const openTagsDD = () => {
      const available = (options.suggestions ? options.suggestions() : [])
        .filter(t => !current.has(t));

      const dd = _makeListDD(available, [], (tag) => {
        current.add(tag);
        renderPills();
        _closeDD();
        // reabrir para seguir agregando
        setTimeout(openTagsDD, 80);
      });
      dd.id = 'wallet-dd';
      _positionDD(dd, cell);
      _ie.dd = dd;
    };

    wrap.addEventListener('click', e => {
      const remove = e.target.closest('.remove-tag');
      if (remove) {
        e.stopPropagation();
        current.delete(remove.dataset.tag);
        renderPills();
        _closeDD();
        return;
      }
      openTagsDD();
    });

    wrap.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closeInlineEditor(false); }
      if (e.key === 'Enter')  { e.preventDefault(); closeInlineEditor(true); }
    });

    setTimeout(openTagsDD, 0);
  }
}

// ── UTILITIES ─────────────────────────────────────────────────
function formatCurrency(value) {
  const cur = state.settings.currency || 'ARS';
  const decimals = state.settings.decimals ?? 2;
  const localeMap = { ARS: 'es-AR', USD: 'en-US', EUR: 'es-ES', UYU: 'es-UY' };
  const locale = localeMap[cur] || 'es-AR';

  if (state.settings.showSymbol !== false) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } else {
    return new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
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
window.saveCurrencySettings      = saveCurrencySettings;
window.toggleAccountClosingFields = toggleAccountClosingFields;
window.createNewAccount          = createNewAccount;
window.removeAccount             = removeAccount;
window.addPredefined             = addPredefined;
window.removePredefined          = removePredefined;
// ── COLUMN RESIZE ──────────────────────────────────────────
function initColumnResize() {
  const table = document.querySelector('.ledger');
  if (!table) return;

  const handles = table.querySelectorAll('.col-resize-handle');
  let startX = 0, startW = 0, th = null, handle = null;

  function onMouseDown(e) {
    handle = e.currentTarget;
    th = handle.closest('th');
    if (!th) return;

    const rect = th.getBoundingClientRect();
    startX = e.clientX;
    startW = rect.width;

    table.classList.add('col-resizing');
    handle.classList.add('resizing');

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!th) return;
    const minW = parseInt(th.style.minWidth) || 40;
    let newW = startW + (e.clientX - startX);
    if (newW < minW) newW = minW;
    th.style.width = newW + 'px';
    th.style.maxWidth = 'none';
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    table.classList.remove('col-resizing');
    if (handle) handle.classList.remove('resizing');
    startX = 0; startW = 0; th = null; handle = null;
  }

  handles.forEach(h => {
    h.addEventListener('mousedown', onMouseDown);
  });
}

// ════════════════════════════════════════════════════════════
//  CSV / XLS IMPORTER
// ════════════════════════════════════════════════════════════

const CSV_FIELD_OPTIONS = [
  { value: 'ignore', label: 'Ignorar', cls: 'csv-opt-ignore' },
  { value: 'date', label: 'Fecha' },
  { value: 'payee', label: 'Beneficiario' },
  { value: 'amount', label: 'Monto (automático)' },
  { value: 'debit', label: 'Débito (gasto)' },
  { value: 'credit', label: 'Crédito (ingreso)' },
  { value: 'category', label: 'Categoría' },
  { value: 'notes', label: 'Notas' },
  { value: 'tags', label: 'Etiquetas' },
];

let csvImportState = {
  rawData: [],
  rawText: '',
  isExcel: false,
  headers: [],
  mapping: {},
  fileName: '',
  fileDims: '',
};

function initCsvDropzone() {
  const dz = document.getElementById('csv-dropzone');
  if (!dz) return;
  ['dragenter', 'dragover'].forEach(ev => {
    dz.addEventListener(ev, e => { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; dz.style.background = 'var(--accent-soft)'; });
  });
  ['dragleave', 'drop'].forEach(ev => {
    dz.addEventListener(ev, e => { e.preventDefault(); dz.style.borderColor = ''; dz.style.background = ''; });
  });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });
}

function openImportModal() {
  document.getElementById('csv-import-modal')?.classList.add('open');
  resetCsvImport();
}

function closeImportModal() {
  document.getElementById('csv-import-modal')?.classList.remove('open');
}

function resetCsvImport() {
  csvImportState = { rawData: [], rawText: '', isExcel: false, headers: [], mapping: {}, fileName: '', fileDims: '' };
  document.getElementById('csv-step-upload').style.display = '';
  document.getElementById('csv-step-mapping').style.display = 'none';
  document.getElementById('csv-file-input').value = '';
  document.getElementById('csv-import-errors').textContent = '';
  const dropzone = document.getElementById('csv-dropzone');
  if (dropzone) dropzone.style.display = '';
}

// ── FILE SELECTION & PARSING ──────────────────────────────

function onCsvFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  processFile(file);
}

function processFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  csvImportState.fileName = file.name;

  const reader = new FileReader();

  if (ext === 'csv') {
    reader.onload = e => {
      parseCsvData(e.target.result);
    };
    reader.readAsText(file);
  } else if (ext === 'xls' || ext === 'xlsx') {
    reader.onload = e => {
      parseXlsxData(e.target.result, file.name);
    };
    reader.readAsArrayBuffer(file);
  } else {
    showCsvError('Formato no soportado. Usá CSV, XLS o XLSX.');
  }
}

function parseCsvData(text) {
  const sep = getCsvSeparator(text);
  const raw = parseCsv(text, sep);
  if (raw.length < 1) { showCsvError('El archivo está vacío o no se pudo leer.'); return; }
  csvImportState.rawData = raw;
  csvImportState.rawText = text;
  csvImportState.isExcel = false;
  csvImportState.fileDims = `${raw[0].length} columnas · ${raw.length} filas`;
  afterParse();
}

function parseXlsxData(buffer, fileName) {
  if (typeof XLSX === 'undefined') {
    showCsvError('La librería XLSX no está cargada. Verificá tu conexión.');
    return;
  }
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (data.length < 1) { showCsvError('El archivo Excel está vacío.'); return; }
    csvImportState.rawData = data.map(row =>
      row.map(cell => (cell === null || cell === undefined ? '' : String(cell)))
    );
    csvImportState.rawText = '';
    csvImportState.isExcel = true;
    csvImportState.fileDims = `${csvImportState.rawData[0].length} columnas · ${csvImportState.rawData.length} filas`;
    afterParse();
  } catch (err) {
    showCsvError('Error al leer el archivo Excel: ' + err.message);
  }
}

function showCsvError(msg) {
  const el = document.getElementById('csv-import-errors');
  if (el) el.textContent = msg;
}

function getCsvSeparator(text) {
  const sel = document.getElementById('csv-separator');
  if (sel && sel.value !== 'auto') return sel.value;
  const firstLine = text.split('\n')[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > semicolons && tabs > commas) return '\t';
  if (semicolons >= commas) return ';';
  return ',';
}

function parseCsv(text, separator) {
  const lines = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === separator) { current.push(field.trim()); field = ''; }
      else if (ch === '\n') { current.push(field.trim()); if (current.length > 0 && current.some(c => c !== '')) lines.push(current); current = []; field = ''; }
      else if (ch === '\r') { /* ignore */ }
      else { field += ch; }
    }
  }
  // Last field
  current.push(field.trim());
  if (current.length > 0 && current.some(c => c !== '')) lines.push(current);
  return lines;
}

function afterParse() {
  const raw = csvImportState.rawData;
  const hasHeader = document.getElementById('csv-has-header').checked;

  if (hasHeader && raw.length > 0) {
    csvImportState.headers = raw[0];
    csvImportState.rawData = raw.slice(1);
  } else {
    csvImportState.headers = raw[0].map((_, i) => 'Columna ' + (i + 1));
  }

  // Auto-map columns
  autoMapColumns();

  // Show mapping view
  document.getElementById('csv-step-upload').style.display = 'none';
  document.getElementById('csv-step-mapping').style.display = '';
  document.getElementById('csv-dropzone').style.display = 'none';

  document.getElementById('csv-file-name').textContent = csvImportState.fileName;
  document.getElementById('csv-file-dims').textContent = '· ' + csvImportState.fileDims;

  // Populate account selector
  const accSel = document.getElementById('csv-target-account');
  if (accSel) {
    accSel.innerHTML = '<option value="">Seleccionar cuenta…</option>';
    state.accounts.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name + (a.type === 'credit_card' ? ' (TC)' : '');
      accSel.appendChild(opt);
    });
    accSel.onchange = onCsvMappingChange;
  }

  renderCsvMapping();
}

// ── AUTO-MAPPING ──────────────────────────────────────────

function autoMapColumns() {
  const h = csvImportState.headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const map = {};
  h.forEach((header, i) => {
    if (/fecha|fec|date|dt|movimiento/i.test(header)) map[i] = 'date';
    else if (/beneficiari|payee|descripcion|descrip|detalle|concepto|razon/i.test(header)) map[i] = 'payee';
    else if (/monto|importe|valor|total|amount/i.test(header)) map[i] = 'amount';
    else if (/debito|debe|debit|egreso|gasto|salida|retiro/i.test(header)) map[i] = 'debit';
    else if (/credito|haber|credit|ingreso|deposito|entrada/i.test(header)) map[i] = 'credit';
    else if (/categoria|category|categ/i.test(header)) map[i] = 'category';
    else if (/nota|note|obs|observacion|comentario/i.test(header)) map[i] = 'notes';
    else if (/etiqueta|tag|tags/i.test(header)) map[i] = 'tags';
    else if (/saldo|balance/i.test(header)) map[i] = 'ignore';
    else map[i] = 'ignore';
  });
  csvImportState.mapping = map;
}

// ── RENDER MAPPING TABLE ──────────────────────────────────

function renderCsvMapping() {
  const thead = document.getElementById('csv-mapping-head');
  const tbody = document.getElementById('csv-mapping-body');
  if (!thead || !tbody) return;
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const raw = csvImportState.rawData;
  const headers = csvImportState.headers;
  const map = csvImportState.mapping;

  // Header row
  const headerTr = document.createElement('tr');
  headers.forEach((h, i) => {
    const th = document.createElement('th');
    const isIgnored = map[i] === 'ignore' || !map[i];
    th.className = isIgnored ? 'csv-col-ignore' : '';

    const label = document.createElement('div');
    label.textContent = h || 'Columna ' + (i + 1);
    th.appendChild(label);

    const sel = document.createElement('select');
    CSV_FIELD_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.cls) o.className = opt.cls;
      if ((map[i] || 'ignore') === opt.value) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      csvImportState.mapping[i] = sel.value;
      renderCsvMapping();
      onCsvMappingChange();
    };
    th.appendChild(sel);
    headerTr.appendChild(th);
  });
  thead.appendChild(headerTr);

  // Data rows (max 15)
  const maxRows = Math.min(raw.length, 15);
  for (let r = 0; r < maxRows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < headers.length; c++) {
      const td = document.createElement('td');
      const val = raw[r][c] || '';
      td.textContent = val;
      const isIgnored = map[c] === 'ignore' || !map[c];
      td.className = isIgnored ? 'csv-cell-ignore' : 'csv-cell-mapped';
      td.title = val;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  if (raw.length > maxRows) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = headers.length;
    td.textContent = '… y ' + (raw.length - maxRows) + ' filas más';
    td.style.cssText = 'text-align:center;color:var(--text-lo);font-style:italic;padding:8px;';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  onCsvMappingChange();
}

function reparseCsv() {
  const hasHeader = document.getElementById('csv-has-header')?.checked ?? true;
  if (csvImportState.isExcel) {
    const raw = csvImportState.rawData;
    if (hasHeader && raw.length > 0) {
      csvImportState.headers = raw[0];
      csvImportState.rawData = raw.slice(1);
    } else {
      csvImportState.headers = raw[0].map((_, i) => 'Columna ' + (i + 1));
    }
    autoMapColumns();
    renderCsvMapping();
    return;
  }
  if (csvImportState.rawText) {
    const sep = getCsvSeparator(csvImportState.rawText);
    const allRows = parseCsv(csvImportState.rawText, sep);
    if (allRows.length > 0) {
      if (hasHeader) {
        csvImportState.headers = allRows[0];
        csvImportState.rawData = allRows.slice(1);
      } else {
        csvImportState.headers = allRows[0].map((_, i) => 'Columna ' + (i + 1));
        csvImportState.rawData = allRows;
      }
      csvImportState.fileDims = `${csvImportState.rawData[0]?.length || 0} columnas · ${csvImportState.rawData.length} filas`;
    }
  }
  if (csvImportState.rawData.length > 0) {
    autoMapColumns();
    renderCsvMapping();
  }
}

// ── PREVIEW & CONFIRM ─────────────────────────────────────

function onCsvMappingChange() {
  const preview = document.getElementById('csv-preview-section');
  const tbody = document.getElementById('csv-preview-tbody');
  const countEl = document.getElementById('csv-import-count');
  const btn = document.getElementById('btn-csv-import');

  const parsed = buildTransactionsFromMapping();
  if (parsed.length === 0) {
    preview.style.display = 'none';
    btn.disabled = true;
    return;
  }

  btn.disabled = false;
  preview.style.display = '';
  countEl.textContent = parsed.length;

  tbody.innerHTML = '';
  parsed.forEach(tx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${tx.date || '—'}</td>
      <td>${tx.payee || '—'}</td>
      <td>${tx.category_name || '—'}</td>
      <td class="r ${tx.amount < 0 ? 'expense' : 'income'}">${formatCurrency(tx.amount)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function buildTransactionsFromMapping() {
  const raw = csvImportState.rawData;
  const map = csvImportState.mapping;
  const accountId = document.getElementById('csv-target-account')?.value;
  if (!accountId) return [];

  const dateFmt = document.getElementById('csv-date-format')?.value || 'auto';
  const numFmt = document.getElementById('csv-number-format')?.value || 'auto';

  const results = [];

  raw.forEach(row => {
    let tx = {
      date: '',
      payee: '',
      amount: 0,
      category_name: '',
      notes: '',
      tags: [],
      account_id: accountId,
    };

    let hasDate = false, hasPayee = false, hasAmount = false;

    Object.keys(map).forEach(colIdx => {
      const field = map[colIdx];
      const val = (row[parseInt(colIdx)] || '').trim();
      if (!val) return;

      switch (field) {
        case 'date': {
          const parsed = parseDate(val, dateFmt);
          if (parsed) { tx.date = parsed; hasDate = true; }
          break;
        }
        case 'payee': {
          tx.payee = val;
          hasPayee = true;
          break;
        }
        case 'amount': {
          const num = parseNumber(val, numFmt);
          if (!isNaN(num)) { tx.amount += num; hasAmount = true; }
          break;
        }
        case 'debit': {
          const num = parseNumber(val, numFmt);
          if (!isNaN(num) && num > 0) { tx.amount -= Math.abs(num); hasAmount = true; }
          break;
        }
        case 'credit': {
          const num = parseNumber(val, numFmt);
          if (!isNaN(num) && num > 0) { tx.amount += Math.abs(num); hasAmount = true; }
          break;
        }
        case 'category': {
          tx.category_name = val;
          break;
        }
        case 'notes': {
          tx.notes = val;
          break;
        }
        case 'tags': {
          tx.tags = val.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
          break;
        }
      }
    });

    if (hasDate && hasPayee && hasAmount && tx.amount !== 0) {
      results.push(tx);
    }
  });

  return results;
}

function parseDate(val, format) {
  val = val.trim();
  if (!val) return '';

  // Already ISO-like
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  let parts;
  if (format === 'auto') {
    // Try common formats
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) parts = val.split('/');
    else if (/^\d{2}\/\d{2}\/\d{2}$/.test(val)) parts = val.split('/');
    else if (/^\d{2}-\d{2}-\d{4}$/.test(val)) parts = val.split('-');
    else if (/^\d{2}-\d{2}-\d{2}$/.test(val)) parts = val.split('-');
    else if (/^\d{4}\/\d{2}\/\d{2}$/.test(val)) parts = val.split('/');
    else if (/^\d{8}$/.test(val)) {
      // DDMMYYYY or YYYYMMDD
      if (val.substring(0, 4) > '1900' && val.substring(0, 4) < '2100') {
        return val.substring(0, 4) + '-' + val.substring(4, 6) + '-' + val.substring(6, 8);
      }
      return val.substring(4, 6) + '-' + val.substring(6, 8) + '-' + val.substring(0, 4);
    }
    else return val; // fallback

    if (parts && parts[2].length === 4 && parseInt(parts[2]) > 1900) {
      // Likely DD/MM/YYYY
      return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    }
    if (parts && parts[2].length === 2) {
      const y = parseInt(parts[2]) + 2000;
      return y + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    }
    return val;
  }

  // Specific format
  if (format === 'dd/mm/yyyy') {
    parts = val.split(/[\/\-\.]/);
    if (parts.length === 3) return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
  }
  if (format === 'mm/dd/yyyy') {
    parts = val.split(/[\/\-\.]/);
    if (parts.length === 3) return parts[2] + '-' + parts[0].padStart(2, '0') + '-' + parts[1].padStart(2, '0');
  }
  if (format === 'yyyy-mm-dd') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    parts = val.split(/[\/\-\.]/);
    if (parts.length === 3) return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
  }
  if (format === 'dd/mm/yy') {
    parts = val.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let y = parseInt(parts[2]);
      if (y < 100) y += 2000;
      return y + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    }
  }

  return val;
}

function parseNumber(val, format) {
  if (!val) return NaN;
  let s = val.trim();
  // Remove currency symbols and spaces
  s = s.replace(/[$€£¥$]\s*/g, '').replace(/\s+/g, '');

  if (format === 'auto') {
    // Detect format: if uses . for thousands and , for decimals → EU
    // If uses , for thousands and . for decimals → US
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    if (hasDot && hasComma) {
      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      if (lastComma > lastDot) {
        // EU: 1.234,56
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // US: 1,234.56
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Could be EU decimal (1234,56) or US thousands (1,234)
      // If only one comma and followed by exactly 2 digits → EU decimal
      const parts = s.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        s = s.replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    }
    // If hasDot but no comma, it's either US decimal or thousands separator
    // Try to interpret: if after last dot there are 2 digits → likely decimal
    else if (hasDot) {
      const parts = s.split('.');
      if (parts.length > 1) {
        const last = parts[parts.length - 1];
        if (last.length === 2 && parts.length > 2) {
          // EU: 1.234.56 → remove dots except last
          s = s.replace(/\./g, '');
          s = s.substring(0, s.length - 2) + '.' + s.substring(s.length - 2);
        }
        // else: US or simple number with dot → keep as is
      }
    }
  } else if (format === 'eu') {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (format === 'us') {
    s = s.replace(/,/g, '');
  }

  const num = parseFloat(s);
  return isNaN(num) ? NaN : num;
}

function confirmCsvImport() {
  const parsed = buildTransactionsFromMapping();
  if (parsed.length === 0) {
    showCsvError('No hay movimientos válidos para importar. Revisá el mapeo de columnas.');
    return;
  }

  const existingIds = new Set(state.transactions.map(t => t.id));
  let idCounter = 0;

  parsed.forEach(tx => {
    let id = 'tx-' + Date.now() + '-' + (++idCounter);
    while (existingIds.has(id)) id = 'tx-' + Date.now() + '-' + (++idCounter);
    existingIds.add(id);
    state.transactions.push({
      id,
      date: tx.date,
      account_id: tx.account_id,
      payee: tx.payee,
      category_name: tx.category_name || 'Otros',
      amount: tx.amount,
      notes: tx.notes || '',
      tags: tx.tags || [],
      is_receivable: false,
      due_date: '',
      is_future: false,
      installment_id: null,
      installment_total: null,
      installment_index: null,
    });
    // Auto-add new payees and categories
    if (tx.payee && !state.predefined.payees.includes(tx.payee)) {
      state.predefined.payees.push(tx.payee);
    }
    if (tx.category_name) {
      const exists = state.predefined.categories.some(c =>
        (typeof c === 'string' ? c : c.name) === tx.category_name
      );
      if (!exists) {
        state.predefined.categories.push({ name: tx.category_name, icon: 'tag' });
      }
    }
  });

  saveData('transactions');
  saveData('predefined');
  renderAll();
  closeImportModal();
}

// ── SAMPLE DATA ───────────────────────────────────────────

function loadSampleCsv(type) {
  let text = '';
  if (type === 'bank') {
    text = `Fecha;Descripción;Débito;Crédito;Saldo
02/06/2026;Supermercado Coto;12580,00;;45200,00
03/06/2026;Farmacia;3450,00;;41750,00
04/06/2026;Sueldo Mensual;;250000,00;291750,00
05/06/2026;Estacionamiento;800,00;;290950,00
06/06/2026;Netflix;3899,00;;287051,00
07/06/2026;Recarga SUBE;2000,00;;285051,00
08/06/2026;Transferencia de Leo;;15000,00;300051,00
09/06/2026;Mercado Pago - envio;4500,00;;295551,00
10/06/2026;Restaurante La Farola;8900,00;;286651,00`;
  } else {
    text = `Fecha;Establecimiento;Categoría;Monto
01/06/2026;McDonald's;Comidas;4580,00
02/06/2026;Spotify;Entretenimiento;1299,00
03/06/2026;Falabella;Indumentaria;25000,00
05/06/2026;Disney+;Entretenimiento;3899,00
07/06/2026;Coto;Supermercado;18750,00
10/06/2026;YPF;Transporte;15000,00`;
  }

  // Set separator to semicolon
  const sepSel = document.getElementById('csv-separator');
  if (sepSel) sepSel.value = ';';

  // Parse directly
  const sep = ';';
  const raw = parseCsv(text, sep);
  if (raw.length < 1) return;
  csvImportState.rawData = raw;
  csvImportState.rawText = text;
  csvImportState.isExcel = false;
  csvImportState.fileName = type === 'bank' ? 'extracto_bancario.csv' : 'resumen_tarjeta.csv';
  csvImportState.fileDims = `${raw[0].length} columnas · ${raw.length} filas`;
  document.getElementById('csv-dropzone').style.display = 'none';
  afterParse();
}

window.initColumnResize = initColumnResize;
window.toggleCatIconPicker = toggleCatIconPicker;
window.selectCatIcon = selectCatIcon;

window.openTransactionModal      = openTransactionModal;
window.closeTransactionModal     = closeTransactionModal;
window.toggleReceivableFields     = toggleReceivableFields;
window.toggleInstallmentFields    = toggleInstallmentFields;
window.onInstallmentCheck          = onInstallmentCheck;
window.onAccountChangeInModal      = onAccountChangeInModal;
window.stepInstallment             = stepInstallment;
window.updateInstallmentPreview    = updateInstallmentPreview;
window.handleTransactionSubmit   = handleTransactionSubmit;
window.deleteTransaction         = deleteTransaction;
window.markAsCollected           = markAsCollected;
window.filterTransactions        = filterTransactions;
window.openAccountCreator        = openAccountCreator;
window.openFloatingAccountCreator = openFloatingAccountCreator;
window.closeFloatingAccountCreator = closeFloatingAccountCreator;
window.toggleAccountClosingFieldsFloating = toggleAccountClosingFieldsFloating;
window.createAccountFromFloating  = createAccountFromFloating;
window.openImportModal           = openImportModal;
window.closeImportModal          = closeImportModal;
window.openGeminiImportModal     = openGeminiImportModal;
window.closeGeminiImportModal    = closeGeminiImportModal;
window.backToImportSetup         = backToImportSetup;
window.processImportWithGemini   = processImportWithGemini;
window.confirmImportedTransactions = confirmImportedTransactions;
window.updateImportedTx          = updateImportedTx;
window.renderTransactions        = renderTransactions;
window.openWelcomeModal          = openWelcomeModal;
window.closeWelcomeModal         = closeWelcomeModal;
window.showWelcomeOnFirstVisit   = showWelcomeOnFirstVisit;
window.resolveConfirm            = resolveConfirm;
window.toggleTxSelection         = toggleTxSelection;
window.toggleSelectAll           = toggleSelectAll;
window.clearTxSelection          = clearTxSelection;
window.startInlineEdit           = startInlineEdit;
window.closeInlineEditor         = closeInlineEditor;
window.toggleRowMenu             = toggleRowMenu;
window.closeRowMenu              = closeRowMenu;
window.toggleSelMenu             = toggleSelMenu;
window.closeSelMenu              = closeSelMenu;
window.openBatchEditModal        = openBatchEditModal;
window.batchDeleteTransactions   = batchDeleteTransactions;
window.onCsvFileSelected         = onCsvFileSelected;
window.reparseCsv                = reparseCsv;
window.onCsvMappingChange        = onCsvMappingChange;
window.confirmCsvImport          = confirmCsvImport;
window.loadSampleCsv             = loadSampleCsv;
window.resetCsvImport            = resetCsvImport;
