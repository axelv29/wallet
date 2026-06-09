// ═══════════════════════════════════════════════════════════════════════
//  settings.js — Gestión de configuración y ajustes
//  Contiene: switchSettingsPane(), saveCurrencySettings(),
//  saveGeneralSettings(), CRUD de cuentas, predefinidos editables,
//  selector de íconos de categoría.
// ═══════════════════════════════════════════════════════════════════════

// ── SETTINGS PANE SWITCHING ───────────────────────────────────
function switchSettingsPane(name) {
  const panes = ['general', 'apariencia', 'accounts', 'listas', 'sistema'];
  panes.forEach(p => {
    const pane = document.getElementById('spane-' + p);
    const btn  = document.getElementById('snav-' + p);
    if (pane) pane.classList.toggle('active', p === name);
    if (btn)  btn.classList.toggle('active', p === name);
  });

  if (name === 'accounts') {
    renderSettingsAccountsList();
    renderAccountTypesList();
    populateAccountTypeSelects();
  }
  if (name === 'listas') renderPredefinedLists();
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

// ── FLOATING ACCOUNT CREATOR ──────────────────────────────────
function openFloatingAccountCreator(type) {
  document.getElementById('acc-floating-modal').classList.add('open');
  const typeEl = document.getElementById('acc-f-type');
  if (type && typeEl) {
    typeEl.value = type;
    toggleAccountClosingFieldsFloating(type);
  } else if (typeEl) {
    typeEl.value = '';
    toggleAccountClosingFieldsFloating('');
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
    newAcc.card_closing_day = parseInt(document.getElementById('acc-f-close-day').value) || 1;
    newAcc.card_due_day     = parseInt(document.getElementById('acc-f-due-day').value)   || 10;
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

  // Reset form
  document.getElementById('acc-f-name').value    = '';
  document.getElementById('acc-f-balance').value = '0.00';
  document.getElementById('acc-f-type').value    = '';
  toggleAccountClosingFieldsFloating('');
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
    const typeLabel = getAccountTypeLabel(acc.type);
    const item = document.createElement('div');
    item.className = 'account-list-item';
    item.style.cursor = 'pointer';
    item.innerHTML = `
      <div class="acc-list-info">
        <span class="acc-list-name">${acc.name}</span>
        <span class="acc-list-type">${typeLabel}${acc.card_closing_day ? ' · cierra día ' + acc.card_closing_day : ''}${curLabel}</span>
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

// ── EDIT ACCOUNT MODAL ──────────────────────────────────────
function openEditAccountModal(accId) {
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return;
  document.getElementById('acc-edit-id').value = acc.id;
  document.getElementById('acc-edit-name').value = acc.name;
  document.getElementById('acc-edit-currency').value = acc.currency || state.settings.currency || 'ARS';
  document.getElementById('acc-edit-close-day').value = acc.card_closing_day || '';
  document.getElementById('acc-edit-due-day').value = acc.card_due_day || '';
  // Populate type select
  const typeEl = document.getElementById('acc-edit-type');
  const types = state.predefined.account_types || [];
  typeEl.innerHTML = '';
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    typeEl.appendChild(opt);
  });
  typeEl.value = acc.type;
  toggleAccountClosingFieldsEdit(acc.type);
  document.getElementById('acc-edit-modal').classList.add('open');
  lucide.createIcons();
  setTimeout(() => document.getElementById('acc-edit-name')?.focus(), 100);
}

function closeEditAccountModal() {
  document.getElementById('acc-edit-modal').classList.remove('open');
}

function toggleAccountClosingFieldsEdit(type) {
  const el = document.getElementById('cc-edit-closing-fields');
  if (el) el.style.display = type === 'credit_card' ? 'block' : 'none';
}

function saveAccountEdit(event) {
  event.preventDefault();
  const id = document.getElementById('acc-edit-id').value;
  const acc = state.accounts.find(a => a.id === id);
  if (!acc) return;
  acc.name = document.getElementById('acc-edit-name').value.trim();
  acc.type = document.getElementById('acc-edit-type').value;
  acc.currency = document.getElementById('acc-edit-currency').value;
  if (acc.type === 'credit_card') {
    acc.card_closing_day = parseInt(document.getElementById('acc-edit-close-day').value) || null;
    acc.card_due_day = parseInt(document.getElementById('acc-edit-due-day').value) || null;
  } else {
    delete acc.card_closing_day;
    delete acc.card_due_day;
  }
  saveData('accounts');
  closeEditAccountModal();
  renderSettingsAccountsList();
  renderAll();
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
const TAG_COLORS = [
  '#fecaca', '#fca5a5',
  '#fed7aa', '#fdba74',
  '#fef08a', '#fcd34d',
  '#fef9c3', '#fde047',
  '#d9f99d', '#bef264',
  '#bbf7d0', '#86efac',
  '#a7f3d0', '#6ee7b7',
  '#99f6e4', '#5eead4',
  '#a5f3fc', '#67e8f9',
  '#bae6fd', '#7dd3fc',
  '#bfdbfe', '#93c5fd',
  '#c7d2fe', '#a5b4fc',
  '#ddd6fe', '#c4b5fd',
  '#e9d5ff', '#d8b4fe',
  '#f5d0fe', '#f0abfc',
  '#fbcfe8', '#f9a8d4',
  '#ffe4e6', '#fecdd3',
  '#e5e7eb', '#d1d5db',
];

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
    const name = typeof item === 'string' ? item : item.name;
    const icon = typeof item === 'string' ? null : item.icon;
    const isProtected = type === 'categories' && name === 'Sin asignar';

    const li = document.createElement('li');

    const leftSpan = document.createElement('span');
    leftSpan.className = 'predefined-item-left';

    if (type === 'categories' && icon) {
      const iconBtn = document.createElement('button');
      iconBtn.className = 'predefined-icon-btn';
      iconBtn.type = 'button';
      iconBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
      iconBtn.title = 'Cambiar ícono';
      iconBtn.addEventListener('click', e => {
        e.stopPropagation();
        openCategoryIconPicker(iconBtn, name);
      });
      leftSpan.appendChild(iconBtn);
    }

    if (type === 'tags') {
      const tagColor = typeof item === 'string' ? '#d1d5db' : (item.color || '#d1d5db');
      const colorBtn = document.createElement('button');
      colorBtn.className = 'tag-color-btn';
      colorBtn.type = 'button';
      colorBtn.title = 'Cambiar color';
      const dot = document.createElement('span');
      dot.className = 'tag-color-dot';
      dot.style.background = tagColor;
      colorBtn.appendChild(dot);
      colorBtn.addEventListener('click', e => {
        e.stopPropagation();
        openTagColorPicker(colorBtn, name);
      });
      leftSpan.appendChild(colorBtn);
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'predefined-name';
    nameSpan.textContent = type === 'tags' ? '#' + name : name;
    if (!isProtected) {
      nameSpan.addEventListener('click', () => startRename(type, item, nameSpan));
    }
    leftSpan.appendChild(nameSpan);

    li.appendChild(leftSpan);

    if (!isProtected) {
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.innerHTML = `<i data-lucide="x"></i>`;
      delBtn.addEventListener('click', () => removePredefined(type, name));
      li.appendChild(delBtn);
    }

    ul.appendChild(li);
  });
  lucide.createIcons();
}

function startRename(type, item, targetEl) {
  const name = typeof item === 'string' ? item : item.name;
  if (type === 'categories' && name === 'Sin asignar') return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'predefined-rename-input';
  input.value = name;
  input.setAttribute('autocomplete', 'off');

  const finish = save => {
    const val = input.value.trim().replace(/#/g, '');
    if (save && val && val !== name) {
      if (type === 'payees') {
        const idx = state.predefined.payees.indexOf(name);
        if (idx !== -1) state.predefined.payees[idx] = val;
        state.transactions.forEach(t => { if (t.payee === name) t.payee = val; });
      } else if (type === 'categories') {
        const cat = state.predefined.categories.find(c => (typeof c === 'string' ? c : c.name) === name);
        if (cat) cat.name = val;
        state.transactions.forEach(t => { if (t.category_name === name) t.category_name = val; });
      } else if (type === 'tags') {
        const tag = state.predefined.tags.find(t => (typeof t === 'string' ? t : t.name) === name);
        if (tag && typeof tag !== 'string') tag.name = val;
        state.transactions.forEach(t => {
          if (t.tags) {
            const ti = t.tags.indexOf(name);
            if (ti !== -1) t.tags[ti] = val;
          }
        });
      }
      saveData('predefined');
      saveData('transactions');
    }
    renderPredefinedLists();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));

  targetEl.replaceWith(input);
  input.focus();
  input.select();
}

function openCategoryIconPicker(btn, catName) {
  const existingPopover = document.querySelector('.cat-picker-popover.inline');
  if (existingPopover) {
    existingPopover.remove();
    return;
  }

  const popover = document.createElement('div');
  popover.className = 'cat-picker-popover open inline';
  const grid = document.createElement('div');
  grid.className = 'cat-picker-grid';

  CATEGORY_ICONS.forEach(icon => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<i data-lucide="${icon}"></i>`;
    b.dataset.icon = icon;
    b.addEventListener('click', e => {
      e.stopPropagation();
      const cat = state.predefined.categories.find(c => (typeof c === 'string' ? c : c.name) === catName);
      if (cat && typeof cat !== 'string') cat.icon = icon;
      saveData('predefined');
      popover.remove();
      renderPredefinedLists();
    });
    grid.appendChild(b);
  });

  popover.appendChild(grid);
  document.body.appendChild(popover);

  const rect = btn.getBoundingClientRect();
  const popH = popover.offsetHeight || 200;
  const spaceBelow = window.innerHeight - rect.bottom;
  popover.style.position = 'fixed';
  popover.style.left = rect.left + 'px';
  popover.style.top = (spaceBelow >= popH ? rect.bottom + 4 : rect.top - popH - 4) + 'px';

  lucide.createIcons();

  const close = e => {
    if (!e.target.closest('.cat-picker-popover.inline') && !e.target.closest('.predefined-icon-btn')) {
      popover.remove();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
  window.addEventListener('scroll', () => { popover.remove(); document.removeEventListener('click', close); }, { once: true });
}

function openTagColorPicker(btn, tagName) {
  const existingPopover = document.querySelector('.tag-color-popover');
  if (existingPopover) {
    existingPopover.remove();
    return;
  }

  const popover = document.createElement('div');
  popover.className = 'tag-color-popover open';
  popover.innerHTML = '<div class="tag-color-grid"></div>';
  const grid = popover.querySelector('.tag-color-grid');

  TAG_COLORS.forEach(color => {
    const dot = document.createElement('button');
    dot.className = 'tag-color-opt';
    dot.style.background = color;
    dot.addEventListener('click', e => {
      e.stopPropagation();
      const tag = state.predefined.tags.find(t => (typeof t === 'string' ? t : t.name) === tagName);
      if (tag && typeof tag !== 'string') tag.color = color;
      saveData('predefined');
      popover.remove();
      renderPredefinedLists();
    });
    grid.appendChild(dot);
  });

  popover.appendChild(grid);
  document.body.appendChild(popover);

  const rect = btn.getBoundingClientRect();
  const popH = popover.offsetHeight || 200;
  const spaceBelow = window.innerHeight - rect.bottom;
  popover.style.position = 'fixed';
  popover.style.left = rect.left + 'px';
  popover.style.top = (spaceBelow >= popH ? rect.bottom + 4 : rect.top - popH - 4) + 'px';

  const close = e => {
    if (!e.target.closest('.tag-color-popover') && !e.target.closest('.tag-color-btn')) {
      popover.remove();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
  window.addEventListener('scroll', () => { popover.remove(); document.removeEventListener('click', close); }, { once: true });
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
  if (!val) return;
  if (type === 'tags') {
    const exists = state.predefined.tags.some(t => (typeof t === 'string' ? t : t.name) === val);
    if (exists) return;
    const usedColors = state.predefined.tags.map(t => (typeof t === 'string' ? null : t.color)).filter(Boolean);
    const defaultColor = TAG_COLORS.find(c => !usedColors.includes(c)) || '#d1d5db';
    state.predefined.tags.push({ name: val, color: defaultColor });
  } else {
    if (state.predefined[type].includes(val)) return;
    state.predefined[type].push(val);
  }
  saveData('predefined');
  input.value = '';
  renderPredefinedLists();
}

function removePredefined(type, item) {
  if (type === 'categories') {
    const name = typeof item === 'string' ? item : item.name;
    if (name === 'Sin asignar') return;
    const usedCount = state.transactions.filter(t => t.category_name === name).length;
    if (usedCount > 0) {
      showConfirm(
        `La categoría "${name}" está siendo usada en ${usedCount} transacciones. Se moverán a "Sin asignar". ¿Continuar?`,
        { title: 'Eliminar categoría', confirmText: 'Eliminar', danger: true }
      ).then(ok => {
        if (!ok) return;
        state.transactions.forEach(t => {
          if (t.category_name === name) t.category_name = 'Sin asignar';
        });
        state.predefined[type] = state.predefined[type].filter(c => (typeof c === 'string' ? c : c.name) !== name);
        saveData('predefined');
        saveData('transactions');
        renderPredefinedLists();
      });
    } else {
      state.predefined[type] = state.predefined[type].filter(c => (typeof c === 'string' ? c : c.name) !== name);
      saveData('predefined');
      renderPredefinedLists();
    }
    return;
  }
  if (type === 'tags') {
    const usedCount = state.transactions.filter(t => (t.tags || []).includes(item)).length;
    if (usedCount > 0) {
      showConfirm(
        `La etiqueta "#${item}" está siendo usada en ${usedCount} transacciones. Se eliminará de todas. ¿Continuar?`,
        { title: 'Eliminar etiqueta', confirmText: 'Eliminar', danger: true }
      ).then(ok => {
        if (!ok) return;
        state.transactions.forEach(t => {
          if (t.tags && t.tags.includes(item)) t.tags = t.tags.filter(tag => tag !== item);
        });
        state.predefined[type] = state.predefined[type].filter(i => (typeof i === 'string' ? i : i.name) !== item);
        saveData('predefined');
        saveData('transactions');
        renderPredefinedLists();
      });
    } else {
      state.predefined[type] = state.predefined[type].filter(i => (typeof i === 'string' ? i : i.name) !== item);
      saveData('predefined');
      renderPredefinedLists();
    }
    return;
  }
  state.predefined[type] = state.predefined[type].filter(i => i !== item);
  saveData('predefined');
  renderPredefinedLists();
}

// ── ACCOUNT TYPES MANAGEMENT ────────────────────────────────
function renderAccountTypesList() {
  const ul = document.getElementById('predefined-account-types-list');
  if (!ul) return;
  ul.innerHTML = '';
  const types = state.predefined.account_types || [];
  types.forEach(t => {
    const li = document.createElement('li');
    const accountsUsing = state.accounts.filter(a => a.type === t.id).length;
    const usageLabel = accountsUsing > 0 ? ` · ${accountsUsing} cuenta${accountsUsing > 1 ? 's' : ''}` : '';
    li.innerHTML = `
      <span>
        <span class="acc-type-label">${t.label}</span>
        ${t.isDefault ? '<span class="acc-type-badge">Por defecto</span>' : '<span class="acc-type-usage">' + usageLabel + '</span>'}
      </span>
      <span class="acc-type-actions">
        ${!t.isDefault ? `<button class="delete-btn" onclick="event.stopPropagation();editAccountType('${t.id}')" title="Editar"><i data-lucide="pencil"></i></button>
        <button class="delete-btn" onclick="event.stopPropagation();removeAccountType('${t.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>` : ''}
      </span>
    `;
    ul.appendChild(li);
  });
  lucide.createIcons();
}

function addAccountType() {
  const input = document.getElementById('add-acc-type-val');
  const val = input.value.trim();
  if (!val) return;
  const types = state.predefined.account_types || [];
  if (types.some(t => t.label.toLowerCase() === val.toLowerCase())) return;
  const id = 'custom_' + Date.now();
  types.push({ id, label: val, isDefault: false });
  state.predefined.account_types = types;
  saveData('predefined');
  input.value = '';
  renderAccountTypesList();
  populateAccountTypeSelects();
}

function removeAccountType(typeId) {
  const types = state.predefined.account_types || [];
  const t = types.find(t => t.id === typeId);
  if (!t || t.isDefault) return;
  const accountsUsing = state.accounts.filter(a => a.type === typeId);
  if (accountsUsing.length > 0) {
    showConfirm(
      `El tipo "${t.label}" está siendo usado en ${accountsUsing.length} cuenta${accountsUsing.length > 1 ? 's' : ''}. No se puede eliminar mientras haya cuentas de este tipo.`,
      { title: 'Eliminar tipo de cuenta', confirmText: 'Entendido', danger: false }
    );
    return;
  }
  state.predefined.account_types = types.filter(t => t.id !== typeId);
  saveData('predefined');
  renderAccountTypesList();
  populateAccountTypeSelects();
}

function editAccountType(typeId) {
  const types = state.predefined.account_types || [];
  const t = types.find(t => t.id === typeId);
  if (!t || t.isDefault) return;
  const newName = prompt('Editar nombre del tipo de cuenta:', t.label);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed) return;
  if (types.some(x => x.id !== typeId && x.label.toLowerCase() === trimmed.toLowerCase())) return;
  t.label = trimmed;
  saveData('predefined');
  renderAccountTypesList();
  populateAccountTypeSelects();
  renderSettingsAccountsList();
}

function populateAccountTypeSelects() {
  const selects = [document.getElementById('acc-type'), document.getElementById('acc-f-type')];
  const types = state.predefined.account_types || [];
  selects.forEach(sel => {
    if (!sel) return;
    const currentVal = sel.value;
    const isFloating = sel.id === 'acc-f-type';
    sel.innerHTML = isFloating ? '<option value="">Tipo de cuenta</option>' : '';
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      sel.appendChild(opt);
    });
    if (currentVal && types.some(t => t.id === currentVal)) {
      sel.value = currentVal;
    }
  });
}
