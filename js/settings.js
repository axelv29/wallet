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

  if (name === 'general') renderExcludedBalanceCats();
  if (name === 'accounts') {
    renderSettingsAccountsList();
    renderAccountTypesList();
    populateAccountTypeSelects();
  }
  if (name === 'listas') renderPredefinedLists();
  if (name === 'sistema') renderDeleteCounts();
}

// ── GENERAL SETTINGS ──────────────────────────────────────────
function saveCurrencySettings(event) {
  event.preventDefault();
  state.settings.currency = document.getElementById('set-currency').value;
  state.settings.showSymbol = document.getElementById('set-show-symbol').checked;
  state.settings.decimals = parseInt(document.getElementById('set-decimals').value);
  const checkedRadio = document.querySelector('input[name="amount-style"]:checked');
  state.settings.amountStyle = checkedRadio ? checkedRadio.value : 'default';
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

// ── EXCLUDED BALANCE CATEGORIES ─────────────────────────────────
function renderExcludedBalanceCats() {
  const wrap = document.getElementById('set-excluded-cats-list');
  if (!wrap) return;
  const cats = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name);
  const excluded = new Set(state.settings.excludedBalanceCats || []);
  wrap.innerHTML = '';
  cats.forEach(cat => {
    const label = document.createElement('label');
    label.className = 'set-cat-excl-label';
    label.innerHTML = `<input type="checkbox" name="set-excluded-cat" value="${cat}" ${excluded.has(cat) ? 'checked' : ''}><span>${cat}</span>`;
    label.querySelector('input').addEventListener('change', saveExcludedBalanceCats);
    wrap.appendChild(label);
  });
}

function saveExcludedBalanceCats() {
  const checks = document.querySelectorAll('input[name="set-excluded-cat"]');
  state.settings.excludedBalanceCats = [];
  checks.forEach(cb => { if (cb.checked) state.settings.excludedBalanceCats.push(cb.value); });
  localStorage.setItem('wallet_settings', JSON.stringify(state.settings));
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
  document.querySelectorAll('#acc-floating-modal input:not([type="checkbox"]):not([type="file"]), #acc-floating-modal select').forEach(el => el.setAttribute('autocomplete', 'off'));
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
  const currency = document.getElementById('acc-f-currency').value || 'UYU';

  const newAcc = { id: 'acc-' + Date.now(), name, type, balance: 0, currency };
  if (type === 'credit_card') {
    const closingDay = parseInt(document.getElementById('acc-f-close-day').value) || 1;
    const dueDay = parseInt(document.getElementById('acc-f-due-day').value) || 10;
    const ym = getCurrentYearMonth();
    const [y, m] = ym.split('-').map(Number);
    const dueOff = dueDay <= closingDay ? 1 : 0;
    newAcc.card_schedule = {};
    newAcc.card_schedule[ym] = { closing: formatDateISO(new Date(y, m - 1, closingDay)), due: formatDateISO(new Date(y, m - 1 + dueOff, dueDay)) };
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
  const currency = document.getElementById('acc-currency').value || 'UYU';

  const newAcc = { id: 'acc-' + Date.now(), name, type, balance: 0, currency };
  if (type === 'credit_card') {
    const closingDay = parseInt(document.getElementById('acc-close-day').value) || 1;
    const dueDay = parseInt(document.getElementById('acc-due-day').value) || 10;
    const ym = getCurrentYearMonth();
    const [y, m] = ym.split('-').map(Number);
    const dueOff = dueDay <= closingDay ? 1 : 0;
    newAcc.card_schedule = {};
    newAcc.card_schedule[ym] = { closing: formatDateISO(new Date(y, m - 1, closingDay)), due: formatDateISO(new Date(y, m - 1 + dueOff, dueDay)) };
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
  const settingsCur = state.settings.currency || 'UYU';
  state.accounts.forEach(acc => {
    const accCur = acc.currency || settingsCur;
    const curLabel = accCur !== settingsCur ? ' · ' + accCur : '';
    const typeLabel = getAccountTypeLabel(acc.type);
    let scheduleInfo = '';
    if (acc.type === 'credit_card' && acc.card_schedule) {
      const ym = getCurrentYearMonth();
      const sch = acc.card_schedule[ym];
      if (sch && sch.closing) {
        scheduleInfo = ' · cierre ' + new Date(sch.closing + 'T12:00:00').getDate();
      }
    }
    const item = document.createElement('div');
    item.className = 'account-list-item' + (acc.excluded ? ' account-excluded' : '');
    item.style.cursor = 'pointer';
    item.innerHTML = `
      <div class="acc-list-info">
        <span class="acc-list-name">${acc.name}${acc.excluded ? ' <span class="acc-excluded-badge">Excluida</span>' : ''}</span>
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

// ── EDIT ACCOUNT MODAL ──────────────────────────────────────
function openEditAccountModal(accId) {
  document.querySelectorAll('#acc-edit-modal input:not([type="checkbox"]):not([type="file"]), #acc-edit-modal select').forEach(el => el.setAttribute('autocomplete', 'off'));
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return;
  document.getElementById('acc-edit-id').value = acc.id;
  document.getElementById('acc-edit-name').value = acc.name;
  document.getElementById('acc-edit-currency').value = acc.currency || state.settings.currency || 'UYU';
  document.getElementById('acc-edit-excluded').checked = !!acc.excluded;
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

function openCcScheduleModal(accId, initialYm) {
  document.querySelectorAll('#cc-schedule-modal input:not([type="checkbox"]):not([type="file"]), #cc-schedule-modal select').forEach(el => el.setAttribute('autocomplete', 'off'));
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return;
  ccScheduleAccountId = accId;

  // Account selector (only show if >1 CC)
  const ccAccounts = state.accounts.filter(a => a.type === 'credit_card');
  const accGroup = document.getElementById('cc-schedule-acc-group');
  const accSelect = document.getElementById('cc-schedule-acc-select');
  if (ccAccounts.length > 1) {
    accGroup.style.display = '';
    accSelect.innerHTML = ccAccounts.map(a => `<option value="${a.id}" ${a.id === accId ? 'selected' : ''}>${a.name}</option>`).join('');
  } else {
    accGroup.style.display = 'none';
  }

  // Build timeline (3 back + current + 12 forward)
  const currentYm = getCurrentYearMonth();
  const months = [];
  for (let i = -3; i <= 12; i++) {
    months.push(addMonths(currentYm, i));
  }

  const timeline = document.getElementById('cc-timeline');
  timeline.innerHTML = '';
  months.forEach((ym, idx) => {
    const isCurrent = ym === currentYm;
    const div = document.createElement('div');
    div.className = 'cc-timeline-item' + (isCurrent ? ' current' : '');
    div.dataset.ym = ym;
    div.onclick = () => selectCcTimelineMonth(ym);

    const [y, m] = ym.split('-').map(Number);
    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    div.innerHTML = `<span class="cc-tl-month">${monthNames[m-1]}</span><span class="cc-tl-year">${y}</span>`;

    // Status dot
    const periodKey = ym;
    const status = getClosingStatus(periodKey, accId);
    if (status && status.status !== 'no_schedule') {
      const dot = document.createElement('div');
      dot.className = 'cc-tl-status-dot';
      dot.style.background = status.color;
      dot.title = status.label;
      div.appendChild(dot);
    }

    timeline.appendChild(div);
  });

  // Select initial month (from period row or current)
  const defaultYm = initialYm && months.includes(initialYm) ? initialYm : currentYm;
  selectCcTimelineMonth(defaultYm);
  ccSchedulePrevYm = defaultYm;

  // Render default schedule section
  renderDefaultScheduleUI(acc);

  document.getElementById('cc-schedule-modal').classList.add('open');
  lucide.createIcons();
}

function onCcScheduleAccChange() {
  const accId = document.getElementById('cc-schedule-acc-select').value;
  ccScheduleAccountId = accId;
  // Re-select the current timeline month to refresh data
  const currentYm = getCurrentYearMonth();
  const activeItem = document.querySelector('.cc-timeline-item.active');
  const ym = activeItem ? activeItem.dataset.ym : currentYm;
  selectCcTimelineMonth(ym, accId);
}

function selectCcTimelineMonth(ym, overrideAccId) {
  const accId = overrideAccId || ccScheduleAccountId;
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return;

  // Highlight active timeline item
  document.querySelectorAll('.cc-timeline-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.querySelector(`.cc-timeline-item[data-ym="${ym}"]`);
  if (activeEl) {
    activeEl.classList.add('active');
    // Scroll into view if needed
    activeEl.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  ccSchedulePrevYm = ym;

  // Update month subtitle
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const [sy, sm] = ym.split('-').map(Number);
  const subtitleEl = document.getElementById('cc-month-subtitle');
  if (subtitleEl) subtitleEl.textContent = `Cierre de ${monthNames[sm - 1]} ${sy}`;

  // Load schedule dates (fall back to defaults if active)
  let sch = acc.card_schedule ? acc.card_schedule[ym] : null;
  let isDefaultFilled = false;
  if (!sch || !sch.closing) {
    const defaults = computeDefaultDates(acc, ym);
    if (defaults) {
      sch = defaults;
      isDefaultFilled = true;
    }
  }

  // Populate hidden inputs
  const closingInput = document.getElementById('cc-schedule-closing-date');
  const dueInput = document.getElementById('cc-schedule-due-date');
  closingInput.value = sch ? sch.closing : '';
  dueInput.value = sch ? sch.due : '';

  // Update display buttons
  const closingDisplay = document.getElementById('cc-closing-display');
  const dueDisplay = document.getElementById('cc-due-display');
  const configured = !isDefaultFilled && sch && sch.closing;
  if (closingDisplay) {
    closingDisplay.textContent = sch && sch.closing ? formatDate(sch.closing) : 'Sin configurar';
    closingDisplay.classList.toggle('configured', !!configured);
  }
  if (dueDisplay) {
    dueDisplay.textContent = sch && sch.due ? formatDate(sch.due) : 'Sin configurar';
    dueDisplay.classList.toggle('configured', !!configured);
  }

  // Validate
  validateCcSchedule(closingInput.value, dueInput.value);

  // Render period summary
  renderCcPeriodSummary(ym, accId);

  // Render status section
  renderCcStatusSection(ym, accId);
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function onCcScheduleDateChange() {
  const ym = ccSchedulePrevYm;
  const accId = ccScheduleAccountId;
  if (!ym || !accId) return;

  const closingInput = document.getElementById('cc-schedule-closing-date');
  const dueInput = document.getElementById('cc-schedule-due-date');

  const closingVal = closingInput.value || null;
  const dueVal = dueInput.value || null;

  // Validate only (actual save happens via saveCcSchedule)
  validateCcSchedule(closingVal, dueVal);
}

function countAffectedTransactions(accId, periodKey, newClosingDate) {
  if (!newClosingDate) return 0;
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return 0;
  let count = 0;
  state.transactions.forEach(tx => {
    if (tx.account_id !== accId) return;
    if (tx.is_future) return;
    if (tx.split_parent_id) return;
    if (tx.closing_period) return;
    const txDate = tx.date || '';
    const oldKey = getClosingPeriodKey(txDate, acc.card_schedule);
    if (oldKey !== periodKey) return;
    const modifiedSchedule = { ...(acc.card_schedule || {}) };
    modifiedSchedule[periodKey] = { ...(modifiedSchedule[periodKey] || {}), closing: newClosingDate };
    const newKey = getClosingPeriodKey(txDate, modifiedSchedule);
    if (newKey !== periodKey) count++;
  });
  return count;
}

async function saveCcSchedule() {
  const ym = ccSchedulePrevYm;
  const accId = ccScheduleAccountId;
  if (!ym || !accId) return;

  const closingInput = document.getElementById('cc-schedule-closing-date');
  const dueInput = document.getElementById('cc-schedule-due-date');
  const closingVal = closingInput.value || null;
  const dueVal = dueInput.value || null;

  if (!validateCcSchedule(closingVal, dueVal)) return;

  // Check affected transactions
  const affected = countAffectedTransactions(accId, ym, closingVal);
  if (affected > 0) {
    const confirmed = await showConfirm(
      `${affected} movimiento${affected !== 1 ? 's' : ''} con fecha posterior al nuevo cierre serán movidos al próximo período. ¿Continuar?`,
      { title: 'Mover transacciones', confirmText: 'Guardar' }
    );
    if (!confirmed) return;
  }

  // Save current month
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return;
  if (!acc.card_schedule) acc.card_schedule = {};
  if (closingVal && dueVal) {
    acc.card_schedule[ym] = { closing: closingVal, due: dueVal };
  } else {
    delete acc.card_schedule[ym];
    if (Object.keys(acc.card_schedule).length === 0) delete acc.card_schedule;
  }

  // Save default schedule settings
  const ds = getDefaultScheduleValues();
  if (!acc.default_schedule) acc.default_schedule = { active: false, closing_day: 20, due_offset: 10, next_month: false };
  acc.default_schedule.active = ds.active;
  acc.default_schedule.closing_day = ds.closing_day;
  acc.default_schedule.due_offset = ds.due_offset;
  acc.default_schedule.next_month = ds.next_month;

  // If default is active, apply to other months
  if (ds.active) {
    const timelineItems = document.querySelectorAll('.cc-timeline-item');
    let hasManualMonths = false;
    timelineItems.forEach(item => {
      const tYm = item.dataset.ym;
      const existing = acc.card_schedule ? acc.card_schedule[tYm] : null;
      if (existing && existing.closing) hasManualMonths = true;
    });

    let overwriteMode = 'all';
    if (hasManualMonths) {
      const result = await showConfirm(
        'Algunos meses ya tienen fechas configuradas manualmente. ¿Qué deseas hacer?',
        {
          title: 'Fechas predeterminadas',
          confirmText: 'Sobreescribir todo',
          middleText: 'Solo meses vacíos'
        }
      );
      if (result === false) return;
      if (result === 'middle') overwriteMode = 'empty';
    }

    timelineItems.forEach(item => {
      const tYm = item.dataset.ym;
      const existing = acc.card_schedule ? acc.card_schedule[tYm] : null;
      if (existing && existing.closing && overwriteMode !== 'all') return;
      const dates = computeDefaultDates(acc, tYm);
      if (!dates) return;
      if (!acc.card_schedule) acc.card_schedule = {};
      acc.card_schedule[tYm] = dates;
    });
  } else if (acc.default_schedule && acc.default_schedule.active) {
    // Se desactivó el toggle: limpiar meses que tenían fechas predeterminadas
    const timelineItems = document.querySelectorAll('.cc-timeline-item');
    timelineItems.forEach(item => {
      const tYm = item.dataset.ym;
      if (tYm === ym) return;
      if (acc.card_schedule && acc.card_schedule[tYm]) {
        delete acc.card_schedule[tYm];
      }
    });
    if (acc.card_schedule && Object.keys(acc.card_schedule).length === 0) {
      delete acc.card_schedule;
    }
  }

  saveData('accounts');

  // Refresh current month's inputs after overwrite
  const updatedSch = acc.card_schedule ? acc.card_schedule[ym] : null;
  const closingBtn = document.getElementById('cc-schedule-closing-btn');
  const dueBtn = document.getElementById('cc-schedule-due-btn');
  const updatedClosing = updatedSch && updatedSch.closing ? updatedSch.closing : '';
  const updatedDue = updatedSch && updatedSch.due ? updatedSch.due : '';
  if (closingInput) closingInput.value = updatedClosing;
  if (dueInput) dueInput.value = updatedDue;
  if (closingBtn) closingBtn.innerHTML = updatedClosing
    ? `<i data-lucide="calendar"></i> ${formatDate(updatedClosing)}`
    : '<i data-lucide="calendar"></i> Seleccionar fecha';
  if (dueBtn) dueBtn.innerHTML = updatedDue
    ? `<i data-lucide="calendar"></i> ${formatDate(updatedDue)}`
    : '<i data-lucide="calendar"></i> Seleccionar fecha';
  lucide.createIcons();

  refreshTimelineStatusDots(accId);
  renderCcStatusSection(ym, accId);
  renderCcPeriodSummary(ym, accId);
  renderAll();
}

function validateCcSchedule(closingISO, dueISO) {
  const alert = document.getElementById('cc-validation-alert');
  if (!closingISO && !dueISO) {
    alert.style.display = 'none';
    return true;
  }
  if (closingISO && !dueISO) {
    alert.style.display = '';
    alert.className = 'cc-validation-alert warning';
    alert.innerHTML = '<i data-lucide="alert-triangle"></i> Faltan datos de vencimiento.';
    lucide.createIcons();
    return false;
  }
  if (!closingISO && dueISO) {
    alert.style.display = '';
    alert.className = 'cc-validation-alert warning';
    alert.innerHTML = '<i data-lucide="alert-triangle"></i> Faltan datos de cierre.';
    lucide.createIcons();
    return false;
  }
  const closingDate = new Date(closingISO + 'T12:00:00');
  const dueDate = new Date(dueISO + 'T12:00:00');
  if (closingDate >= dueDate) {
    alert.style.display = '';
    alert.className = 'cc-validation-alert error';
    alert.innerHTML = '<i data-lucide="circle-x"></i> La fecha de cierre debe ser anterior al vencimiento.';
    lucide.createIcons();
    return false;
  }
  const diffMs = dueDate - closingDate;
  const diffDays = diffMs / 864e5;
  if (diffDays > 31) {
    alert.style.display = '';
    alert.className = 'cc-validation-alert error';
    alert.innerHTML = '<i data-lucide="circle-x"></i> La diferencia entre cierre y vencimiento no puede superar 1 mes.';
    lucide.createIcons();
    return false;
  }
  alert.style.display = 'none';
  return true;
}

function refreshTimelineStatusDots(accId) {
  const items = document.querySelectorAll('.cc-timeline-item');
  items.forEach(item => {
    const ym = item.dataset.ym;
    // Remove old dot
    const oldDot = item.querySelector('.cc-tl-status-dot');
    if (oldDot) oldDot.remove();
    // Add new dot if schedule exists
    const status = getClosingStatus(ym, accId);
    if (status && status.status !== 'no_schedule') {
      const dot = document.createElement('div');
      dot.className = 'cc-tl-status-dot';
      dot.style.background = status.color;
      dot.title = status.label;
      item.appendChild(dot);
    }
  });
}

// ── CC DATE CALENDAR ──────────────────────────────────────────
let _ccCalState = {
  type: '',
  viewYear: 0,
  viewMonth: 0,
  selected: null,
  markers: [],
};

function openCcDateCalendar(type) {
  const ym = ccSchedulePrevYm;
  const accId = ccScheduleAccountId;
  if (!ym || !accId) return;
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return;

  _ccCalState.type = type;

  const [py, pm] = ym.split('-').map(Number);
  _ccCalState.viewYear = py;
  _ccCalState.viewMonth = pm - 1;

  const inputId = type === 'closing' ? 'cc-schedule-closing-date' : 'cc-schedule-due-date';
  const currentVal = document.getElementById(inputId).value;
  _ccCalState.selected = currentVal || null;

  if (currentVal) {
    const d = new Date(currentVal + 'T12:00:00');
    _ccCalState.viewYear = d.getFullYear();
    _ccCalState.viewMonth = d.getMonth();
  }

  _ccCalState.markers = [];
  const prevYm = addMonths(ym, -1);
  const nextYm = addMonths(ym, 1);
  const currentSch = acc.card_schedule ? acc.card_schedule[ym] : null;
  const prevSch = acc.card_schedule ? acc.card_schedule[prevYm] : null;
  const nextSch = acc.card_schedule ? acc.card_schedule[nextYm] : null;

  if (currentSch && currentSch[type]) {
    _ccCalState.markers.push({ date: currentSch[type], color: '#22c55e', label: type === 'closing' ? 'Cierre actual' : 'Venc. actual' });
  }
  if (prevSch && prevSch[type]) {
    _ccCalState.markers.push({ date: prevSch[type], color: '#eab308', label: type === 'closing' ? 'Cierre anterior' : 'Venc. anterior' });
  }
  if (nextSch && nextSch[type]) {
    _ccCalState.markers.push({ date: nextSch[type], color: '#ef4444', label: type === 'closing' ? 'Cierre siguiente' : 'Venc. siguiente' });
  }

  const title = document.getElementById('cc-cal-title');
  title.textContent = type === 'closing' ? 'Fecha de cierre' : 'Fecha de vencimiento';

  const popup = document.getElementById('cc-date-calendar-popup');
  popup.classList.add('open');
  ccCalRenderGrid();
  ccCalRenderLegend();
  lucide.createIcons();
}

function closeCcDateCalendar() {
  document.getElementById('cc-date-calendar-popup').classList.remove('open');
}

function ccCalNavMonth(delta) {
  _ccCalState.viewMonth += delta;
  if (_ccCalState.viewMonth > 11) { _ccCalState.viewMonth = 0; _ccCalState.viewYear++; }
  if (_ccCalState.viewMonth < 0) { _ccCalState.viewMonth = 11; _ccCalState.viewYear--; }
  const maxDay = new Date(_ccCalState.viewYear, _ccCalState.viewMonth + 1, 0).getDate();
  let day = 1;
  if (_ccCalState.selected) {
    const d = new Date(_ccCalState.selected + 'T12:00:00');
    day = Math.min(d.getDate(), maxDay);
  }
  _ccCalState.selected = _ccCalState.viewYear + '-' + String(_ccCalState.viewMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  ccCalSyncInput();
  ccCalRenderGrid();
}

function ccCalRenderGrid() {
  const grid = document.getElementById('cc-cal-grid');
  const label = document.getElementById('cc-cal-month-label');
  if (!grid || !label) return;

  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  label.textContent = monthNames[_ccCalState.viewMonth] + ' ' + _ccCalState.viewYear;

  const year = _ccCalState.viewYear;
  const month = _ccCalState.viewMonth;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const markerMap = {};
  _ccCalState.markers.forEach(m => { markerMap[m.date] = m; });

  let html = '';
  for (let i = 0; i < startDow; i++) {
    html += '<div class="cal-day cal-day-empty"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const isSelected = dateStr === _ccCalState.selected;
    const marker = markerMap[dateStr];
    const classes = ['cal-day'];
    if (isSelected) classes.push('cal-day-start', 'cal-day-end', 'cal-day-single');
    if (marker) classes.push('cal-day-marked');
    let markerHtml = '';
    if (marker) {
      markerHtml = `<span class="cal-day-dot" style="background:${marker.color}" title="${marker.label}"></span>`;
    }
    html += `<div class="${classes.join(' ')}" data-date="${dateStr}" onclick="ccCalSelectDay('${dateStr}')" title="${marker ? marker.label : ''}">${d}${markerHtml}</div>`;
  }
  grid.innerHTML = html;
}

function ccCalSelectDay(dateStr) {
  _ccCalState.selected = dateStr;
  ccCalSyncInput();
  closeCcDateCalendar();
}

function ccCalClear() {
  _ccCalState.selected = null;
  ccCalSyncInput();
  ccCalRenderGrid();
}

function ccCalSyncInput() {
  const inputId = _ccCalState.type === 'closing' ? 'cc-schedule-closing-date' : 'cc-schedule-due-date';
  const displayId = _ccCalState.type === 'closing' ? 'cc-closing-display' : 'cc-due-display';
  const input = document.getElementById(inputId);
  const display = document.getElementById(displayId);
  if (!input) return;
  input.value = _ccCalState.selected || '';
  if (display) {
    display.textContent = _ccCalState.selected ? formatDate(_ccCalState.selected) : 'Sin configurar';
    display.classList.toggle('configured', !!_ccCalState.selected);
  }
  onCcScheduleDateChange();
}

function ccCalRenderLegend() {
  const legend = document.getElementById('cc-cal-markers-legend');
  if (!legend) return;
  if (_ccCalState.markers.length === 0) { legend.innerHTML = ''; return; }
  legend.innerHTML = _ccCalState.markers.map(m =>
    `<span class="cc-cal-legend-item"><span class="cc-cal-legend-dot" style="background:${m.color}"></span>${m.label}</span>`
  ).join('');
}

// ── DEFAULT SCHEDULE ────────────────────────────────────────

function renderDefaultScheduleUI(acc) {
  const wrap = document.getElementById('cc-default-schedule');
  if (!wrap || !acc) { if (wrap) wrap.innerHTML = ''; return; }

  const ds = acc.default_schedule || { active: false, closing_day: 20, due_offset: 10, next_month: false };

  wrap.innerHTML = `
    <label class="cc-default-toggle">
      <input type="checkbox" id="cc-default-active" ${ds.active ? 'checked' : ''} onchange="onDefaultScheduleToggle(this.checked)">
      <span class="cc-default-toggle-label">Usar cierre y vencimiento predeterminado para todos los meses</span>
    </label>
    <div class="cc-default-config" id="cc-default-config" style="display:${ds.active ? '' : 'none'}">
      <div class="cc-default-main-row">
        <div class="cc-default-fields">
          <div class="cc-default-field">
            <label class="cc-default-field-label">Cierre día</label>
            <div class="cc-default-input-wrap">
              <input type="number" class="cc-default-input" id="cc-default-closing" min="1" max="31" value="${ds.closing_day}" oninput="onDefaultDayInput(this, 'closing')">
              <div class="cc-default-input-error" id="cc-default-closing-error"></div>
            </div>
          </div>
          <div class="cc-default-field">
            <label class="cc-default-field-label"><span class="cc-default-input-prefix">+</span> días vto.</label>
            <div class="cc-default-input-wrap">
              <input type="number" class="cc-default-input" id="cc-default-due" min="1" max="31" value="${ds.due_offset}" oninput="onDefaultDayInput(this, 'due')">
              <div class="cc-default-input-error" id="cc-default-due-error"></div>
            </div>
          </div>
        </div>
        <div class="cc-default-info-side">
          <label class="cc-default-month-label">
            <input type="checkbox" id="cc-default-next-month" ${ds.next_month ? 'checked' : ''} onchange="onDefaultMonthToggle()">
            <span>Mes siguiente</span>
          </label>
          <div class="cc-default-preview" id="cc-default-preview"></div>
        </div>
      </div>
    </div>
    <div class="cc-default-info" id="cc-default-info" style="display:${ds.active ? '' : 'none'}">>
      <i data-lucide="info"></i> Al guardar, los meses sin configurar recibirán automáticamente estos días de cierre y vencimiento.
    </div>
  `;
  lucide.createIcons();
  updateDefaultPreview();
}

function onDefaultScheduleToggle(checked) {
  const config = document.getElementById('cc-default-config');
  const info = document.getElementById('cc-default-info');
  if (config) config.style.display = checked ? '' : 'none';
  if (info) info.style.display = checked ? '' : 'none';
  if (checked) updateDefaultPreview();
}

function onDefaultDayInput(el, type) {
  const val = parseInt(el.value);
  const errorEl = document.getElementById(`cc-default-${type}-error`);
  if (isNaN(val) || val < 1 || val > 31) {
    if (errorEl) errorEl.textContent = 'Solo se permiten días del 1 al 31';
    el.classList.add('cc-default-input-invalid');
  } else {
    if (errorEl) errorEl.textContent = '';
    el.classList.remove('cc-default-input-invalid');
  }
  updateDefaultPreview();
}

function onDefaultMonthToggle() {
  updateDefaultPreview();
}

function updateDefaultPreview() {
  const previewEl = document.getElementById('cc-default-preview');
  if (!previewEl) return;

  const closingInput = document.getElementById('cc-default-closing');
  const dueInput = document.getElementById('cc-default-due');
  const nextMonthTgl = document.getElementById('cc-default-next-month');

  const closingDay = parseInt(closingInput?.value);
  const dueOffset = parseInt(dueInput?.value);
  const nextMonth = nextMonthTgl?.checked || false;

  if (isNaN(closingDay) || closingDay < 1 || closingDay > 31 || isNaN(dueOffset) || dueOffset < 1 || dueOffset > 31) {
    previewEl.innerHTML = '';
    return;
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  const closingM = m + (nextMonth ? 1 : 0);
  const maxClosingDay = new Date(y, closingM, 0).getDate();
  const clampedClosingDay = Math.min(closingDay, maxClosingDay);
  const closingDate = new Date(y, closingM - 1, clampedClosingDay);

  const dueDate = new Date(closingDate);
  dueDate.setDate(dueDate.getDate() + dueOffset);

  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const closingLabel = `${clampedClosingDay} ${monthNames[closingDate.getMonth()]} ${closingDate.getFullYear()}`;
  const dueLabel = `${dueDate.getDate()} ${monthNames[dueDate.getMonth()]} ${dueDate.getFullYear()}`;

  previewEl.innerHTML = `<i data-lucide="info"></i> Cierre: ${closingLabel} · Vto.: ${dueLabel}`;
  lucide.createIcons();
}

function getDefaultScheduleValues() {
  const activeEl = document.getElementById('cc-default-active');
  const closingInput = document.getElementById('cc-default-closing');
  const dueInput = document.getElementById('cc-default-due');
  const nextMonthTgl = document.getElementById('cc-default-next-month');
  return {
    active: activeEl?.checked ?? false,
    closing_day: parseInt(closingInput?.value) || 20,
    due_offset: parseInt(dueInput?.value) || 10,
    next_month: nextMonthTgl?.checked ?? false
  };
}

function computeDefaultDates(acc, ym) {
  const ds = acc.default_schedule;
  if (!ds || !ds.active) return null;
  const [y, m] = ym.split('-').map(Number);
  const closingM = m + (ds.next_month ? 1 : 0);
  const maxClosingDay = new Date(y, closingM, 0).getDate();
  const closingDay = Math.min(ds.closing_day, maxClosingDay);
  const closingDate = formatDateISO(new Date(y, closingM - 1, closingDay));
  const dueDate = formatDateISO(new Date(y, closingM - 1, closingDay + (ds.due_offset || 0)));
  return { closing: closingDate, due: dueDate };
}

function renderCcPeriodSummary(ym, accId) {
  const wrap = document.getElementById('cc-period-summary');
  const total = getClosingPeriodTotal(ym, accId);
  const allPeriods = getBillingPeriodTxs(accId, state.transactions);
  const period = allPeriods.find(p => p.key === ym);
  const txs = period ? period.txs : [];
  const paid = isClosingPaid(ym + '|' + accId, total, accId);

  if (!total && txs.length === 0) {
    wrap.innerHTML = '<div class="cc-period-empty"><i data-lucide="receipt"></i><span>Sin movimientos en este período</span></div>';
    lucide.createIcons();
    return;
  }

  wrap.innerHTML = `
    <div class="cc-period-row"><span>Movimientos</span><span>${txs.length}</span></div>
    <div class="cc-period-row cc-period-total"><span>Total</span><span>${formatCurrency(total)}</span></div>
    ${paid ? '<div class="cc-period-row cc-period-paid"><i data-lucide="check-circle"></i> Pago registrado</div>' : ''}
  `;
  lucide.createIcons();
}

function renderCcStatusSection(ym, accId) {
  const section = document.getElementById('cc-status-section');
  const status = getClosingStatus(ym, accId);
  const total = getClosingPeriodTotal(ym, accId);
  const paid = isClosingPaid(ym + '|' + accId, total, accId);

  if (!status || status.status === 'no_schedule') {
    section.innerHTML = '<div class="cc-status-note"><i data-lucide="info"></i> Configurá las fechas de cierre y vencimiento para ver el estado.</div>';
    lucide.createIcons();
    return;
  }

  const isPaid = status.status === 'paid';
  const canPay = status.status !== 'not_closed';

  section.innerHTML = `
    <div class="cc-status-card ${status.status}">
      <div class="cc-status-icon"><i data-lucide="${status.icon}"></i></div>
      <div class="cc-status-info">
        <span class="cc-status-label">${status.label}</span>
        <span class="cc-status-detail">${status.detail}</span>
      </div>
    </div>
    ${canPay ? `<button class="btn ${isPaid ? '' : 'btn-primary'}" style="width:100%;margin-top:10px;" onclick="event.stopPropagation();openPaymentModal('${ym}','${accId}')">
      <i data-lucide="${isPaid ? 'pencil' : 'credit-card'}"></i> ${isPaid ? 'Editar pago' : 'Pagar este período'}
    </button>` : ''}
  `;
  lucide.createIcons();
}

function closeCcScheduleModal() {
  document.getElementById('cc-schedule-modal').classList.remove('open');
  ccScheduleAccountId = null;
  ccSchedulePrevYm = null;
  renderSettingsAccountsList();
  renderAll();
}

// ── PAYMENT MODAL ─────────────────────────────────────────

let ccPaymentPeriodKey = null;
let ccPaymentAccountId = null;
let ccPaymentTotal = 0;
let ccPaymentSum = 0;      // monto ya pagado en este período
let ccPaymentRemaining = 0; // lo que falta para cubrir la deuda
let ccPaymentType = 'total';
let ccPaymentData = { payee: '', category: 'Pagos', notes: 'Pago de tarjeta', tags: ['Pago de tarjeta'] };

function openPaymentModal(periodKey, accountId) {
  document.querySelectorAll('#cc-payment-modal input:not([type="checkbox"]), #cc-payment-modal select').forEach(el => el.setAttribute('autocomplete', 'off'));
  ccPaymentPeriodKey = periodKey;
  ccPaymentAccountId = accountId;
  ccPaymentTotal = getClosingPeriodTotal(periodKey, accountId);
  ccPaymentType = 'total';

  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc) return;

  const liquidAccounts = state.accounts.filter(a => a.type === 'liquid');
  const sourceSelect = document.getElementById('cc-pay-source');
  sourceSelect.innerHTML = '';
  liquidAccounts.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.name;
    sourceSelect.appendChild(opt);
  });
  // Add "Otro medio" option
  const otherOpt = document.createElement('option');
  otherOpt.value = 'other';
  otherOpt.textContent = 'Otro medio';
  sourceSelect.appendChild(otherOpt);

  // Init payment data — payee defaults to the first source account name
  const firstSource = liquidAccounts[0];
  ccPaymentData = {
    payee: firstSource ? firstSource.name : (state.predefined.payees[0] || ''),
    category: 'Pagos',
    notes: 'Pago de tarjeta',
    tags: ['Pago de tarjeta']
  };

  // Check if already paid
  const paid = isClosingPaid(periodKey + '|' + accountId, ccPaymentTotal, accountId);
  const alertPaid = document.getElementById('cc-pay-alert-paid');
  if (paid) {
    alertPaid.style.display = '';
    document.getElementById('cc-pay-confirm-btn').textContent = 'Editar pago';
  } else {
    alertPaid.style.display = 'none';
    document.getElementById('cc-pay-confirm-btn').textContent = 'Pagar';
  }

  // Calculate already-paid and remaining
  ccPaymentSum = getPaymentSum(accountId, periodKey);
  ccPaymentRemaining = Math.max(0, Math.abs(ccPaymentTotal) - ccPaymentSum);
  renderCcPaymentSummary(paid);

  // Check overdue status
  const status = getClosingStatus(periodKey, accountId);
  const alertOverdue = document.getElementById('cc-pay-alert-overdue');
  const fineGroup = document.getElementById('cc-pay-fine-group');
  const fineCheck = document.getElementById('cc-pay-fine-check');
  if (status && status.status === 'overdue') {
    alertOverdue.style.display = '';
    document.getElementById('cc-pay-alert-overdue-text').textContent = status.label;
    fineGroup.style.display = '';
    fineCheck.checked = true;
    onPaymentFineToggle();
  } else {
    alertOverdue.style.display = 'none';
    fineGroup.style.display = 'none';
    fineCheck.checked = false;
  }

  // Set total
  setPaymentType('total');
  document.getElementById('cc-pay-amount').value = '';
  onPaymentAmountInput();

  document.getElementById('cc-pay-alert-other').style.display = 'none';
  document.getElementById('cc-schedule-modal').classList.remove('open');
  document.getElementById('cc-payment-modal').classList.add('open');
  lucide.createIcons();
}

function onPaymentSourceChange() {
  const sourceId = document.getElementById('cc-pay-source').value;
  const alertOther = document.getElementById('cc-pay-alert-other');
  if (sourceId === 'other') {
    alertOther.style.display = '';
  } else {
    alertOther.style.display = 'none';
    const sourceAcc = state.accounts.find(a => a.id === sourceId);
    if (sourceAcc) {
      ccPaymentData.payee = sourceAcc.name;
    }
  }
  onPaymentAmountInput();
}

function setPaymentType(type) {
  ccPaymentType = type;
  const totalBtn = document.getElementById('cc-pay-total-btn');
  const partialBtn = document.getElementById('cc-pay-partial-btn');
  const amountGroup = document.getElementById('cc-pay-amount-group');

  if (type === 'total') {
    totalBtn.classList.add('active');
    partialBtn.classList.remove('active');
    amountGroup.style.display = 'none';
  } else {
    totalBtn.classList.remove('active');
    partialBtn.classList.add('active');
    amountGroup.style.display = '';
    const amountInput = document.getElementById('cc-pay-amount');
    const remaining = Math.max(0, Math.abs(ccPaymentTotal) - ccPaymentSum);
    if (remaining > 0 && !amountInput.value) {
      const decimals = state.settings.decimals ?? 2;
      amountInput.value = remaining.toFixed(decimals).replace(/\./g, ',');
    }
    amountInput.focus();
  }
  onPaymentAmountInput();
}

function renderCcPaymentSummary(paid) {
  const wrap = document.getElementById('cc-pay-paid-summary');
  if (!wrap) return;
  const debt = Math.abs(ccPaymentTotal);
  if (ccPaymentSum <= 0 || debt <= 0) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  wrap.innerHTML = `
    <div class="cc-pay-paid-row"><span><i data-lucide="check-circle"></i> Pagado</span><span>${formatCurrency(ccPaymentSum)}</span></div>
    <div class="cc-pay-paid-row cc-pay-remaining"><span>Restante</span><span>${formatCurrency(ccPaymentRemaining)}</span></div>
    <div style="margin-top:8px;display:flex;gap:6px;">
      <button type="button" class="btn btn-ghost btn-small" style="color:var(--text-lo);font-size:11px;padding:4px 8px;" onclick="cancelPaymentFromModal()"><i data-lucide="trash-2" style="width:11px;height:11px;"></i> Cancelar pagos</button>
    </div>
  `;
  lucide.createIcons();
}

function onPaymentAmountInput() {
  renderPaymentPreview();
}

function renderPaymentPreview() {
  const wrap = document.getElementById('cc-pay-preview');
  if (!wrap) return;

  const tagsHtml = ccPaymentData.tags.map(t => {
    const def = (state.predefined.tags || []).find(pt => pt.name === t);
    if (def && def.isSystem) {
      return `<span class="tag-pill tag-pill-payment"><i data-lucide="credit-card"></i> ${t}</span>`;
    }
    const c = _tagColor(t);
    return `<span class="tag-pill" style="background:${c.bg};color:${c.text};">#${t}</span>`;
  }).join(' ');

  const amount = ccPaymentType === 'total' ? Math.abs(ccPaymentTotal) : parsePaymentAmount();
  const fineAmount = getFineAmount();
  const total = amount + fineAmount;
  const debt = Math.abs(ccPaymentTotal);
  const remaining = Math.max(0, debt - ccPaymentSum);

  let summaryHtml = '';
  if (ccPaymentSum > 0) {
    summaryHtml = `
      <div class="cc-pay-preview-row cc-pay-preview-sub"><span>Pagado anteriormente</span><span>${formatCurrency(ccPaymentSum)}</span></div>
      <div class="cc-pay-preview-row cc-pay-preview-sub"><span>Restante</span><span>${formatCurrency(remaining)}</span></div>
    `;
  }

  wrap.innerHTML = `
    <div class="cc-pay-preview-title">Vista previa de la transacción</div>
    ${summaryHtml}
    <div class="cc-pay-preview-row"><span>Beneficiario</span>
      <span class="cc-pay-editable" data-field="payee">${ccPaymentData.payee || '—'}</span></div>
    <div class="cc-pay-preview-row"><span>Categoría</span>
      <span class="cc-pay-editable" data-field="category_name">${ccPaymentData.category || 'Pagos'}</span></div>
    <div class="cc-pay-preview-row"><span>Notas</span>
      <span class="cc-pay-editable" data-field="notes">${ccPaymentData.notes || '—'}</span></div>
    <div class="cc-pay-preview-row"><span>Etiquetas</span>
      <span class="cc-pay-editable" data-field="tags">${tagsHtml || '<span style="color:var(--text-lo)">Sin etiquetas</span>'}</span></div>
    <div class="cc-pay-preview-row cc-pay-preview-total"><span>Total</span><span id="cc-pay-preview-total">${formatCurrency(total)}</span></div>
  `;

  wrap.querySelectorAll('.cc-pay-editable').forEach(el => {
    el.addEventListener('click', () => editPaymentField(el.dataset.field));
  });
  lucide.createIcons();
}

function parsePaymentAmount() {
  const raw = document.getElementById('cc-pay-amount').value.trim();
  if (!raw) return 0;
  let val;
  if (raw.includes(',')) {
    // Spanish format: comma = decimal, dots = thousands
    val = raw.replace(/\./g, '').replace(/,/g, '.');
  } else {
    // No comma: keep only the last dot as decimal separator
    const dotIdx = raw.lastIndexOf('.');
    if (dotIdx === -1) {
      val = raw;
    } else {
      val = raw.substring(0, dotIdx).replace(/\./g, '') + raw.substring(dotIdx);
    }
  }
  return Math.abs(parseFloat(val) || 0);
}

function onPaymentFineToggle() {
  const checked = document.getElementById('cc-pay-fine-check').checked;
  document.getElementById('cc-pay-fine-amount').style.display = checked ? '' : 'none';
  if (checked) document.getElementById('cc-pay-fine-amount').focus();
  onPaymentAmountInput();
}

function onPaymentFineInput() {
  onPaymentAmountInput();
}

function getFineAmount() {
  if (!document.getElementById('cc-pay-fine-check').checked) return 0;
  const raw = document.getElementById('cc-pay-fine-amount').value.trim();
  if (!raw) return 0;
  let val;
  if (raw.includes(',')) {
    val = raw.replace(/\./g, '').replace(/,/g, '.');
  } else {
    const dotIdx = raw.lastIndexOf('.');
    if (dotIdx === -1) {
      val = raw;
    } else {
      val = raw.substring(0, dotIdx).replace(/\./g, '') + raw.substring(dotIdx);
    }
  }
  return Math.abs(parseFloat(val) || 0);
}

function closeExistingPaymentDropdown() {
  document.querySelectorAll('.cc-pay-dropdown').forEach(dd => dd.remove());
}

function positionDropdown(dd, targetEl) {
  const tRect = targetEl.getBoundingClientRect();
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  dd.style.position = 'fixed';
  dd.style.zIndex = '9999';
  dd.style.maxHeight = (vpH - tRect.bottom - 12) + 'px';
  dd.style.overflowY = 'auto';
  document.body.appendChild(dd);

  // Measure after append to get real size
  const ddRect = dd.getBoundingClientRect();
  let top = tRect.bottom + 4;
  let left = tRect.left;

  // Clamp bottom
  if (top + ddRect.height > vpH - 8) {
    top = tRect.top - ddRect.height - 4;
  }
  // Clamp right
  if (left + ddRect.width > vpW - 8) {
    left = vpW - ddRect.width - 8;
  }
  if (left < 8) left = 8;

  dd.style.top = top + 'px';
  dd.style.left = left + 'px';
}

function editPaymentField(field) {
  closeExistingPaymentDropdown();

  if (field === 'tags') { editPaymentTags(); return; }
  if (field === 'category_name') { editPaymentCategory(); return; }
  if (field === 'payee') { editPaymentPayee(); return; }

  const el = document.querySelector(`.cc-pay-editable[data-field="${field}"]`);
  if (!el) return;

  const current = ccPaymentData[field] || '';

  const measure = document.createElement('span');
  measure.style.cssText = 'visibility:hidden;position:absolute;white-space:nowrap;font:12px var(--font-ui);padding:0;';
  measure.textContent = current || ' ';
  document.body.appendChild(measure);
  const textW = measure.offsetWidth;
  document.body.removeChild(measure);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cc-pay-inline-input';
  input.value = current;
  input.style.cssText = `width:${Math.max(textW + 12, 60)}px;height:auto;font-size:12px;padding:1px 4px;border:none;border-bottom:1px solid var(--accent);background:transparent;color:var(--text-hi);font-family:var(--font-ui);outline:none;border-radius:0;`;
  el.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    ccPaymentData[field] = input.value.trim();
    renderPaymentPreview();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { committed = true; renderPaymentPreview(); }
  });
  input.addEventListener('input', () => {
    measure.style.cssText = 'visibility:hidden;position:absolute;white-space:nowrap;font:12px var(--font-ui);padding:0;';
    measure.textContent = input.value || ' ';
    document.body.appendChild(measure);
    input.style.width = Math.max(measure.offsetWidth + 12, 60) + 'px';
    document.body.removeChild(measure);
  });
}

function editPaymentPayee() {
  const el = document.querySelector('.cc-pay-editable[data-field="payee"]');
  if (!el) return;

  const payees = state.predefined.payees || [];
  const current = ccPaymentData.payee || '';

  const dd = document.createElement('div');
  dd.className = 'cc-pay-dropdown';
  dd.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-sm);box-shadow:0 4px 12px rgba(0,0,0,.12);padding:4px 0;max-height:200px;overflow-y:auto;min-width:160px;';

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Buscar...';
  search.value = current;
  search.style.cssText = 'width:100%;box-sizing:border-box;padding:5px 8px;border:none;border-bottom:1px solid var(--border);background:transparent;color:var(--text-hi);font:12px var(--font-ui);outline:none;';
  dd.appendChild(search);

  const list = document.createElement('div');
  list.style.cssText = 'max-height:160px;overflow-y:auto;';
  dd.appendChild(list);

  const renderList = (filter) => {
    list.innerHTML = '';
    const filtered = payees.filter(p => !filter || p.toLowerCase().includes(filter.toLowerCase()));
    if (filtered.length === 0 && filter) {
      const btn = document.createElement('button');
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;text-align:left;padding:5px 10px;font-size:12px;color:var(--text-lo);cursor:pointer;font-family:var(--font-ui);font-style:italic;';
      btn.textContent = `Agregar "${filter}"`;
      btn.onmouseenter = () => btn.style.background = 'var(--bg-raised)';
      btn.onmouseleave = () => btn.style.background = 'none';
      btn.onclick = (e) => { e.stopPropagation(); ccPaymentData.payee = filter; renderPaymentPreview(); };
      list.appendChild(btn);
    }
    filtered.forEach(p => {
      const btn = document.createElement('button');
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;text-align:left;padding:5px 10px;font-size:12px;color:var(--text-mid);cursor:pointer;font-family:var(--font-ui);';
      btn.innerHTML = `<span style="width:14px;text-align:center;flex-shrink:0;">${p === current ? '✓' : ''}</span><span>${p}</span>`;
      btn.onmouseenter = () => btn.style.background = 'var(--bg-raised)';
      btn.onmouseleave = () => btn.style.background = 'none';
      btn.onclick = (e) => { e.stopPropagation(); ccPaymentData.payee = p; renderPaymentPreview(); };
      list.appendChild(btn);
    });
  };
  renderList('');

  search.addEventListener('input', () => renderList(search.value));

  positionDropdown(dd, el);
  search.focus();
  search.select();

  const closeDD = (e) => {
    if (!dd.contains(e.target)) { closeExistingPaymentDropdown(); document.removeEventListener('click', closeDD); }
  };
  setTimeout(() => document.addEventListener('click', closeDD), 0);
}

function editPaymentCategory() {
  const el = document.querySelector('.cc-pay-editable[data-field="category_name"]');
  if (!el) return;

  const cats = state.predefined.categories || [];
  const current = ccPaymentData.category || 'Pagos';

  const dd = document.createElement('div');
  dd.className = 'cc-pay-dropdown';
  dd.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-sm);box-shadow:0 4px 12px rgba(0,0,0,.12);padding:4px 0;max-height:200px;overflow-y:auto;min-width:160px;';

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Buscar categoría...';
  search.style.cssText = 'width:100%;box-sizing:border-box;padding:5px 8px;border:none;border-bottom:1px solid var(--border);background:transparent;color:var(--text-hi);font:12px var(--font-ui);outline:none;';
  dd.appendChild(search);

  const list = document.createElement('div');
  list.style.cssText = 'max-height:160px;overflow-y:auto;';
  dd.appendChild(list);

  const renderList = (filter) => {
    list.innerHTML = '';
    const filtered = cats.filter(c => !filter || c.name.toLowerCase().includes(filter.toLowerCase()));
    filtered.forEach(cat => {
      const btn = document.createElement('button');
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;text-align:left;padding:5px 10px;font-size:12px;color:var(--text-mid);cursor:pointer;font-family:var(--font-ui);';
      const isCurrent = cat.name === current;
      const iconHtml = cat.icon ? `<span class="cat-icon"><i data-lucide="${cat.icon}"></i></span>` : '';
      btn.innerHTML = `<span style="width:14px;text-align:center;flex-shrink:0;">${isCurrent ? '✓' : ''}</span>${iconHtml}<span>${cat.name}</span>`;
      btn.onmouseenter = () => btn.style.background = 'var(--bg-raised)';
      btn.onmouseleave = () => btn.style.background = 'none';
      btn.onclick = (e) => { e.stopPropagation(); ccPaymentData.category = cat.name; renderPaymentPreview(); };
      list.appendChild(btn);
    });
  };
  renderList('');

  search.addEventListener('input', () => renderList(search.value));

  positionDropdown(dd, el);
  search.focus();

  const closeDD = (e) => {
    if (!dd.contains(e.target)) { closeExistingPaymentDropdown(); document.removeEventListener('click', closeDD); }
  };
  setTimeout(() => document.addEventListener('click', closeDD), 0);
  lucide.createIcons();
}

function editPaymentTags() {
  closeExistingPaymentDropdown();

  const el = document.querySelector('.cc-pay-editable[data-field="tags"]');
  if (!el) return;

  const allTags = state.predefined.tags || [];
  const currentTags = new Set(ccPaymentData.tags);

  const dd = document.createElement('div');
  dd.className = 'cc-pay-dropdown';
  dd.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-sm);box-shadow:0 4px 12px rgba(0,0,0,.12);padding:4px 0;max-height:200px;overflow-y:auto;min-width:160px;';

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Buscar etiqueta...';
  search.style.cssText = 'width:100%;box-sizing:border-box;padding:5px 8px;border:none;border-bottom:1px solid var(--border);background:transparent;color:var(--text-hi);font:12px var(--font-ui);outline:none;';
  dd.appendChild(search);

  const list = document.createElement('div');
  list.style.cssText = 'max-height:160px;overflow-y:auto;';
  dd.appendChild(list);

  const renderList = (filter) => {
    list.innerHTML = '';
    const filtered = allTags.filter(t => !filter || t.name.toLowerCase().includes(filter.toLowerCase()));
    filtered.forEach(t => {
      const btn = document.createElement('button');
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;text-align:left;padding:5px 10px;font-size:12px;color:var(--text-mid);cursor:pointer;font-family:var(--font-ui);';
      const isChecked = currentTags.has(t.name);
      const colorDot = t.color ? `<span style="width:8px;height:8px;border-radius:50%;background:${t.color};flex-shrink:0;"></span>` : '';
      btn.innerHTML = `<span style="width:14px;text-align:center;flex-shrink:0;">${isChecked ? '✓' : ''}</span>${colorDot}<span>${t.name}</span>`;
      btn.onmouseenter = () => btn.style.background = 'var(--bg-raised)';
      btn.onmouseleave = () => btn.style.background = 'none';
      btn.onclick = (e) => {
        e.stopPropagation();
        if (currentTags.has(t.name)) currentTags.delete(t.name);
        else currentTags.add(t.name);
        ccPaymentData.tags = [...currentTags];
        renderPaymentPreview();
        editPaymentTags();
      };
      list.appendChild(btn);
    });
  };
  renderList('');

  search.addEventListener('input', () => renderList(search.value));

  positionDropdown(dd, el);
  search.focus();

  const closeDD = (e) => {
    if (!dd.contains(e.target)) { closeExistingPaymentDropdown(); document.removeEventListener('click', closeDD); }
  };
  setTimeout(() => document.addEventListener('click', closeDD), 0);
}

function confirmPayment() {
  const sourceId = document.getElementById('cc-pay-source').value;
  if (sourceId === 'other') return;
  const rawAmount = ccPaymentType === 'total' ? ccPaymentTotal : parsePaymentAmount();
  const amount = Math.abs(rawAmount);
  if (amount <= 0) return;

  const acc = state.accounts.find(a => a.id === ccPaymentAccountId);
  if (!acc) return;

  // Use today's date for the transaction, but closing_period maps it to the right period
  const today = new Date().toISOString().split('T')[0];

  // Simple case: payment from same CC account — use toggleClosingPaid
  if (sourceId === ccPaymentAccountId) {
    const paid = isClosingPaid(ccPaymentPeriodKey + '|' + ccPaymentAccountId, ccPaymentTotal, ccPaymentAccountId);
    if (paid) {
      // Unpay
      toggleClosingPaid(ccPaymentPeriodKey + '|' + ccPaymentAccountId, ccPaymentTotal, ccPaymentAccountId);
    } else {
      // Pay — delegate to toggleClosingPaid
      toggleClosingPaid(ccPaymentPeriodKey + '|' + ccPaymentAccountId, ccPaymentTotal, ccPaymentAccountId);
    }
    saveData('transactions');
    closePaymentModal();
    renderAll();
    return;
  }

  // Complex case: payment from different account
  // If already paid, remove existing payment txs for this period first
  const wasPaid = isClosingPaid(ccPaymentPeriodKey + '|' + ccPaymentAccountId, ccPaymentTotal, ccPaymentAccountId);
  if (wasPaid) {
    toggleClosingPaid(ccPaymentPeriodKey + '|' + ccPaymentAccountId, ccPaymentTotal, ccPaymentAccountId);
  }

  const paymentGroupId = 'pg-' + Date.now();

  // Create payment tx on CC account (positive = reduces debt)
  const paymentTx = {
    id: 'tx-' + Date.now(),
    date: today,
    closing_period: ccPaymentPeriodKey,
    account_id: ccPaymentAccountId,
    payee: ccPaymentData.payee || 'Pago TC',
    category_name: ccPaymentData.category || 'Pagos',
    amount: Math.abs(amount),
    notes: ccPaymentData.notes || 'Pago de tarjeta',
    tags: [...ccPaymentData.tags],
    is_receivable: false,
    due_date: '',
    excluded: false,
    split_group: null,
    split_parent_id: null,
    amount_expression: null,
    is_future: false,
    payment_group_id: paymentGroupId
  };
  state.transactions.push(paymentTx);

  // Create fine tx if applicable
  const fineAmount = getFineAmount();
  if (fineAmount > 0) {
    const fineTx = {
      id: 'tx-' + (Date.now() + 1),
      date: today,
      closing_period: ccPaymentPeriodKey,
      account_id: ccPaymentAccountId,
      payee: ccPaymentData.payee || 'Pago TC',
      category_name: ccPaymentData.category || 'Pagos',
      amount: Math.abs(fineAmount),
      notes: 'Multa por pago fuera de fecha',
      tags: ['Pago de tarjeta'],
      is_receivable: false,
      due_date: '',
      excluded: false,
      split_group: null,
      split_parent_id: null,
      amount_expression: null,
      is_future: false,
      payment_group_id: paymentGroupId
    };
    state.transactions.push(fineTx);
  }

  // If source is not the CC itself, create a transfer tx on the source account
  if (sourceId !== ccPaymentAccountId) {
    const sourceAcc = state.accounts.find(a => a.id === sourceId);
    const transferTx = {
      id: 'tx-' + (Date.now() + 2),
      date: today,
      account_id: sourceId,
      payee: acc.name,
      category_name: 'Pagos',
      amount: -(Math.abs(amount) + fineAmount),
      notes: `Pago TC ${acc.name}`,
      tags: [...ccPaymentData.tags],
      is_receivable: false,
      due_date: '',
      excluded: false,
      split_group: null,
      split_parent_id: null,
      amount_expression: null,
      is_future: false,
      payment_group_id: paymentGroupId
    };
    state.transactions.push(transferTx);
  }

  saveData('transactions');
  closePaymentModal();
  renderAll();
}

function cancelPaymentFromModal() {
  showConfirm('Se eliminarán todos los pagos registrados para este período y el dinero volverá a la cuenta de origen.', {
    title: 'Cancelar pagos',
    confirmText: 'Eliminar pagos',
    danger: true
  }).then(confirmed => {
    if (!confirmed) return;
    const periodKey = ccPaymentPeriodKey;
    const accountId = ccPaymentAccountId;
    if (!periodKey || !accountId) return;
    removeClosingPayments(periodKey, accountId);
    saveData('transactions');
    openPaymentModal(periodKey, accountId);
    renderAll();
  });
}

function closePaymentModal() {
  document.getElementById('cc-payment-modal').classList.remove('open');
  ccPaymentPeriodKey = null;
  ccPaymentAccountId = null;
  ccPaymentTotal = 0;
  ccPaymentSum = 0;
  ccPaymentRemaining = 0;
  ccPaymentType = 'total';
  ccPaymentData = { payee: '', category: 'Pagos', notes: 'Pago de tarjeta', tags: ['Pago de tarjeta'] };
}

function saveAccountEdit(event) {
  event.preventDefault();
  const id = document.getElementById('acc-edit-id').value;
  const acc = state.accounts.find(a => a.id === id);
  if (!acc) return;
  acc.name = document.getElementById('acc-edit-name').value.trim();
  acc.type = document.getElementById('acc-edit-type').value;
  acc.currency = document.getElementById('acc-edit-currency').value;
  acc.excluded = document.getElementById('acc-edit-excluded').checked;
  if (acc.type !== 'credit_card') {
    delete acc.card_schedule;
  }
  saveData('accounts');
  closeEditAccountModal();
  renderSettingsAccountsList();
  renderAll();
}

// ── BALANCE ADJUSTMENT ────────────────────────────────────
let balanceModalState = { accountId: null };

function calculateAccountBalance(accountId) {
  let balance = 0;
  state.transactions.forEach(tx => {
    if (tx.account_id !== accountId) return;
    if (!includeCcFutureTx(tx)) return;
    if (isTxExcluded(tx)) return;
    if (tx.split_parent_id) return;
    if (!isTxInPeriod(tx)) return;
    balance += Number(tx.amount) || 0;
  });
  return balance;
}

function openBalanceModal(accountId) {
  document.querySelectorAll('#balance-modal input:not([type="checkbox"]):not([type="file"]), #balance-modal select').forEach(el => el.setAttribute('autocomplete', 'off'));
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc) return;

  balanceModalState.accountId = accountId;
  const currentBalance = calculateAccountBalance(accountId);
  const settingsCur = state.settings.currency || 'UYU';
  const accCur = acc.currency || settingsCur;

  document.getElementById('balance-account-name').textContent = acc.name;
  document.getElementById('balance-current').textContent = formatAccountCurrency(currentBalance, accCur);
  document.getElementById('balance-target').value = currentBalance.toFixed(2);
  document.getElementById('balance-target').setAttribute('data-currency', accCur);
  updateBalanceDiff();

  document.getElementById('balance-modal').classList.add('open');
  setTimeout(() => document.getElementById('balance-target')?.focus(), 100);
}

function closeBalanceModal() {
  document.getElementById('balance-modal').classList.remove('open');
  balanceModalState.accountId = null;
}

function updateBalanceDiff() {
  const accountId = balanceModalState.accountId;
  if (!accountId) return;

  const acc = state.accounts.find(a => a.id === accountId);
  const settingsCur = state.settings.currency || 'UYU';
  const accCur = acc?.currency || settingsCur;

  const currentBalance = calculateAccountBalance(accountId);
  const targetBalance = parseFloat(document.getElementById('balance-target').value) || 0;
  const diff = targetBalance - currentBalance;

  const diffEl = document.getElementById('balance-diff');
  diffEl.textContent = (diff >= 0 ? '+' : '') + formatAccountCurrency(diff, accCur);
  diffEl.style.color = diff > 0 ? 'var(--positive)' : diff < 0 ? 'var(--negative)' : 'var(--text-mid)';
}

function confirmBalanceAdjustment() {
  const accountId = balanceModalState.accountId;
  if (!accountId) return;

  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc) return;

  const currentBalance = calculateAccountBalance(accountId);
  const targetBalance = parseFloat(document.getElementById('balance-target').value);
  if (isNaN(targetBalance)) return;

  const diff = targetBalance - currentBalance;
  if (diff === 0) {
    closeBalanceModal();
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  state.transactions.push({
    id: 'tx-balance-' + Date.now(),
    date: today,
    account_id: accountId,
    payee: 'Balanceo de cuenta',
    category_name: 'Ajuste de saldo',
    amount: diff,
    notes: '',
    tags: [],
    is_receivable: false,
    due_date: ''
  });

  saveData('transactions');
  closeBalanceModal();
  renderAll();
}

function openBalanceFromEditModal() {
  const accId = document.getElementById('acc-edit-id')?.value;
  if (!accId) return;
  closeEditAccountModal();
  setTimeout(() => openBalanceModal(accId), 200);
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

function getRandomTagColor() {
  const usedColors = (state.predefined.tags || []).map(t => (typeof t === 'string' ? null : t.color)).filter(Boolean);
  const available = TAG_COLORS.filter(c => !usedColors.includes(c));
  const pool = available.length > 0 ? available : TAG_COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function renderPredefinedLists() {
  const txPayees = [...new Set(state.transactions.map(t => t.payee).filter(p => p && p !== 'Sin asignar'))];
  const allPayees = [...new Set([...state.predefined.payees, ...txPayees])];
  renderListItems('payees',     allPayees);
  renderListItems('categories', state.predefined.categories);
  renderListItems('tags',       state.predefined.tags);
}

function filterPredefinedList(type) {
  const ids = { payees: 'add-payee-val', categories: 'add-category-val', tags: 'add-tag-val' };
  const input = document.getElementById(ids[type]);
  const val = input.value.trim().replace(/#/g, '').toLowerCase();
  const ul = document.getElementById('predefined-' + type + '-list');
  if (!ul) return;
  const items = ul.querySelectorAll('li');
  let exactFound = false;
  items.forEach(li => {
    const nameSpan = li.querySelector('.predefined-name');
    if (!nameSpan) return;
    const name = nameSpan.textContent.replace(/^#/, '').toLowerCase();
    if (!val) {
      li.style.display = '';
    } else if (name.includes(val)) {
      li.style.display = '';
      if (name === val) exactFound = true;
    } else {
      li.style.display = 'none';
    }
  });
  const msg = document.getElementById('predefined-dup-' + type);
  if (msg) {
    if (val && exactFound) {
      msg.style.display = '';
      const displayName = type === 'tags' ? '#' + input.value.trim().replace(/#/g, '') : input.value.trim();
      msg.textContent = '"' + displayName + '" ya existe en la lista';
    } else {
      msg.style.display = 'none';
    }
  }
}

function renderListItems(type, list) {
  const ul = document.getElementById('predefined-' + type + '-list');
  if (!ul) return;
  ul.innerHTML = '';
  const filtered = (type === 'categories' || type === 'payees') ? list.filter(item => (typeof item === 'string' ? item : item.name) !== 'Sin asignar') : list.filter(item => !item.isSystem);
  filtered.forEach(item => {
    const name = typeof item === 'string' ? item : item.name;
    const icon = typeof item === 'string' ? null : item.icon;
    const isProtected = (type === 'categories' && name === 'Sin asignar') || (type === 'tags' && item.isSystem);

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
  if (type === 'tags' && item.isSystem) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'predefined-rename-input';
  input.value = name;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('aria-label', 'Renombrar ' + name);

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
    state.predefined.tags.push({ name: val, color: getRandomTagColor() });
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
    const tagName = typeof item === 'string' ? item : item.name;
    const isSystem = typeof item === 'object' && item.isSystem;
    if (isSystem) return;
    const usedCount = state.transactions.filter(t => (t.tags || []).includes(tagName)).length;
    if (usedCount > 0) {
      showConfirm(
        `La etiqueta "#${tagName}" está siendo usada en ${usedCount} transacciones. Se eliminará de todas. ¿Continuar?`,
        { title: 'Eliminar etiqueta', confirmText: 'Eliminar', danger: true }
      ).then(ok => {
        if (!ok) return;
        state.transactions.forEach(t => {
          if (t.tags && t.tags.includes(tagName)) t.tags = t.tags.filter(tag => tag !== tagName);
        });
        state.predefined[type] = state.predefined[type].filter(i => (typeof i === 'string' ? i : i.name) !== tagName);
        saveData('predefined');
        saveData('transactions');
        renderPredefinedLists();
      });
    } else {
      state.predefined[type] = state.predefined[type].filter(i => (typeof i === 'string' ? i : i.name) !== tagName);
      saveData('predefined');
      renderPredefinedLists();
    }
    return;
  }
  if (type === 'payees') {
    const usedCount = state.transactions.filter(t => t.payee === item).length;
    if (usedCount > 0) {
      showConfirm(
        `El beneficiario "${item}" está siendo usado en ${usedCount} transacciones. Se moverán a "Sin asignar". ¿Continuar?`,
        { title: 'Eliminar beneficiario', confirmText: 'Eliminar', danger: true }
      ).then(ok => {
        if (!ok) return;
        state.transactions.forEach(t => {
          if (t.payee === item) t.payee = 'Sin asignar';
        });
        state.predefined.payees = state.predefined.payees.filter(p => p !== item);
        saveData('predefined');
        saveData('transactions');
        renderPredefinedLists();
      });
    } else {
      state.predefined.payees = state.predefined.payees.filter(p => p !== item);
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
