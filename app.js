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
  settings: { geminiKey: '', theme: 'light' },
  currentTxSign: -1,
  importedTransactions: [],
  currentView: 'all',
  editingTxId: null,
  selectedTxIds: new Set(),
  sidebarCollapse: { liquid: true, credit: true }
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
  initColumnResize();
  initCatIconPicker();
});

// ── VIEW SWITCHING ────────────────────────────────────────────
function showView(name) {
  ['dashboard', 'main', 'settings'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = v === name ? 'flex' : 'none';
  });

  document.getElementById('nav-dash-pill').classList.toggle('active', name === 'dashboard');

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
  state.accounts.forEach(acc => {
    const item = document.createElement('div');
    item.className = 'account-list-item';
    item.style.cursor = 'pointer';
    item.innerHTML = `
      <div class="acc-list-info">
        <span class="acc-list-name">${acc.name}</span>
        <span class="acc-list-type">${acc.type === 'credit_card' ? 'Tarjeta de crédito' : 'Cuenta líquida'}${acc.card_closing_day ? ' · cierra día ' + acc.card_closing_day : ''}</span>
      </div>
      <button class="delete-btn" onclick="event.stopPropagation();removeAccount('${acc.id}')"><i data-lucide="trash-2"></i></button>
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

    const checklist = document.getElementById('tx-tags-checklist');
    checklist.innerHTML = '';
    state.predefined.tags.forEach(tag => {
      const checked = (tx.tags || []).includes(tag) ? 'checked' : '';
      const label = document.createElement('label');
      label.className = 'tag-check-label';
      label.innerHTML = `<input type="checkbox" name="tx-tags" value="${tag}" ${checked}><span>#${tag}</span>`;
      checklist.appendChild(label);
    });

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

    // Reset installment fields
    document.getElementById('tx-is-installment').checked = false;
    document.getElementById('tx-installment-count').value = '3';
    document.getElementById('tx-installment-editor').style.display = 'none';
    onAccountChangeInModal();
  }

  document.getElementById('tx-modal').classList.add('open');
}

function closeTransactionModal() {
  document.getElementById('tx-modal').classList.remove('open');
  document.getElementById('tx-form').reset();
  state.editingTxId = null;

  const modalTitle = document.querySelector('#tx-modal .modal-title');
  const submitBtn  = document.querySelector('#tx-form button[type="submit"]');
  modalTitle.textContent = 'Registrar movimiento';
  submitBtn.textContent  = 'Guardar transacción';

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

  if (!accountId || !payee || !categoryName || isNaN(rawAmount)) return;

  if (!state.predefined.payees.includes(payee)) { state.predefined.payees.push(payee); saveData('predefined'); }
  const catNames = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name);
  if (!catNames.includes(categoryName)) {
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

  // Collapse state
  document.querySelectorAll('.sidebar-collapse').forEach(group => {
    const key = group.dataset.collapse;
    const body = group.querySelector('.sidebar-collapse-body');
    const arrow = group.querySelector('.collapse-arrow');
    const collapsed = state.sidebarCollapse[key] === false;
    if (body) body.classList.toggle('collapsed', collapsed);
    if (arrow) arrow.classList.toggle('collapsed', collapsed);
  });

  // Active states
  const allRow = document.getElementById('sidebar-all-row');
  if (allRow) allRow.classList.toggle('active', state.currentView === 'all');

  const titleEl = document.querySelector('.sidebar-section-title');
  if (titleEl) titleEl.classList.toggle('active', state.currentView === 'all');

  document.querySelectorAll('.sidebar-filter-label').forEach(label => {
    const header = label.closest('.sidebar-collapse');
    if (!header) return;
    const key = header.dataset.collapse;
    const typeView = 'type-' + (key === 'liquid' ? 'liquid' : 'credit_card');
    label.classList.toggle('active', state.currentView === typeView);
  });
}

function toggleCollapse(key) {
  if (state.sidebarCollapse[key] === undefined) return;
  state.sidebarCollapse[key] = !state.sidebarCollapse[key];
  renderSidebar();
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
      <button class="row-action" onclick="openTransactionModal('${tx.id}')" title="Editar">
        <i data-lucide="pencil"></i>
      </button>
      <button class="row-action danger" onclick="deleteTransaction('${tx.id}')" title="Eliminar">
        <i data-lucide="trash-2"></i>
      </button>
    `;
    if (tx.is_receivable) {
      actionsHtml = `
        <button class="row-action success" onclick="markAsCollected('${tx.id}')" title="Marcar como cobrado">
          <i data-lucide="check-square"></i>
        </button>
        <button class="row-action" onclick="openTransactionModal('${tx.id}')" title="Editar">
          <i data-lucide="pencil"></i>
        </button>
        <button class="row-action danger" onclick="deleteTransaction('${tx.id}')" title="Eliminar">
          <i data-lucide="trash-2"></i>
        </button>
      `;
    }

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

  // Render present rows
  present.forEach(tx => appendTxRow(tx, false));

  // Render future group if any
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
      <span class="future-group-arrow ${isOpen ? 'open' : ''}">▶</span>
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
    }
  }

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

  const categoriesList = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name).join(', ');
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
      const catObj = state.predefined.categories.find(c => (typeof c === 'string' ? c : c.name) === cat);
      const catIcon = catObj && typeof catObj !== 'string' ? catObj.icon : 'tag';
      row.innerHTML = `
        <div class="dash-cat-top">
          <span class="dash-cat-label"><span class="dash-cat-icon"><i data-lucide="${catIcon}"></i></span>${cat}</span>
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
window.openImportModal           = openImportModal;
window.closeImportModal          = closeImportModal;
window.backToImportSetup         = backToImportSetup;
window.processImportWithGemini   = processImportWithGemini;
window.confirmImportedTransactions = confirmImportedTransactions;
window.updateImportedTx          = updateImportedTx;
window.renderTransactions        = renderTransactions;
window.openHelpModal             = openHelpModal;
window.closeHelpModal            = closeHelpModal;
window.resolveConfirm            = resolveConfirm;
window.toggleTxSelection         = toggleTxSelection;
window.toggleSelectAll           = toggleSelectAll;
window.clearTxSelection          = clearTxSelection;
window.startInlineEdit           = startInlineEdit;
window.closeInlineEditor         = closeInlineEditor;
window.toggleCollapse            = toggleCollapse;
