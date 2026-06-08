// ═══════════════════════════════════════════════════════════════════════
//  settings.js — Gestión de configuración y ajustes
//  Contiene: switchSettingsPane(), saveCurrencySettings(),
//  saveGeneralSettings(), CRUD de cuentas, predefinidos editables,
//  selector de íconos de categoría.
// ═══════════════════════════════════════════════════════════════════════

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
  const name     = document.getElementById('acc-name').value.trim();
  const type     = document.getElementById('acc-type').value;
  const balance  = parseFloat(document.getElementById('acc-balance').value) || 0;
  const currency = document.getElementById('acc-currency').value || 'ARS';

  const newAcc = { id: 'acc-' + Date.now(), name, type, balance: 0, currency };
  if (type === 'credit_card') {
    newAcc.card_closing_day = parseInt(document.getElementById('acc-close-day').value) || 1;
    newAcc.card_due_day     = parseInt(document.getElementById('acc-due-day').value)   || 10;
  }

  state.accounts.push(newAcc);
  saveData('accounts');

  if (balance !== 0) {
    state.transactions.unshift({
      id: 'tx-init-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      account_id: newAcc.id,
      payee: 'Saldo inicial',
      category_name: 'Saldo inicial',
      amount: balance,
      notes: '',
      tags: [],
      is_receivable: false,
      due_date: ''
    });
    saveData('transactions');
  }

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
    const item = document.createElement('div');
    item.className = 'account-list-item';
    item.style.cursor = 'pointer';
    item.innerHTML = `
      <div class="acc-list-info">
        <span class="acc-list-name">${acc.name}</span>
        <span class="acc-list-type">${acc.type === 'credit_card' ? 'Tarjeta de crédito' : 'Cuenta líquida'}${acc.card_closing_day ? ' · cierra día ' + acc.card_closing_day : ''}${curLabel}</span>
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
