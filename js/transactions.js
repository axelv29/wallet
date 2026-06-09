// ═══════════════════════════════════════════════════════════════════════
//  transactions.js — Tabla de transacciones, CRUD, modales,
//  operaciones por lote, edición inline, filtros de tabla,
//  selectores buscables.
//  Contiene: renderTransactions(), open/closeTransactionModal(),
//  handleTransactionSubmit(), deleteTransaction(), markAsCollected(),
//  batch operations, inline editing, filter panel, selection, etc.
// ═══════════════════════════════════════════════════════════════════════

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

// ── TRANSACTIONS CRUD ─────────────────────────────────────────
let _draggedTag = null;

function renderTagsChecklist(selectedTags) {
  const checklist = document.getElementById('tx-tags-checklist');
  const checked = selectedTags || [];
  checklist.innerHTML = '';
  state.predefined.tags.forEach(tag => {
    const isChecked = checked.includes(tag);
    const label = document.createElement('label');
    label.className = 'tag-check-label';
    label.draggable = true;
    label.dataset.tag = tag;
    label.innerHTML = `<input type="checkbox" name="tx-tags" value="${tag}" ${isChecked ? 'checked' : ''}><span>#${tag}</span>`;
    label.addEventListener('dragstart', e => {
      _draggedTag = tag;
      e.dataTransfer.setData('text/plain', tag);
      e.dataTransfer.effectAllowed = 'move';
      label.classList.add('dragging');
      document.getElementById('tx-tags-trash').classList.add('visible');
    });
    label.addEventListener('dragend', () => {
      label.classList.remove('dragging');
      _draggedTag = null;
      const trash = document.getElementById('tx-tags-trash');
      trash.classList.remove('visible', 'drag-hover');
    });
    checklist.appendChild(label);
  });

  const addBtn = document.createElement('span');
  addBtn.className = 'tag-add-btn';
  addBtn.innerHTML = `<i data-lucide="plus"></i>Nueva`;
  addBtn.onclick = () => {
    const input = createTagInput();
    addBtn.replaceWith(input);
    lucide.createIcons();
    input.querySelector('input').focus();
  };
  checklist.appendChild(addBtn);
  lucide.createIcons();
}

function removeTag(tag) {
  state.predefined.tags = state.predefined.tags.filter(t => t !== tag);
  saveData('predefined');
  const checked = getCheckedTags().filter(t => t !== tag);
  renderTagsChecklist(checked);
}

function initTagsTrash() {
  const trash = document.getElementById('tx-tags-trash');
  const checklist = document.getElementById('tx-tags-checklist');
  lucide.createIcons();

  trash.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    trash.classList.add('drag-hover');
  });

  trash.addEventListener('dragleave', () => {
    trash.classList.remove('drag-hover');
  });

  trash.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    trash.classList.remove('visible', 'drag-hover');
    const tag = _draggedTag || e.dataTransfer.getData('text/plain');
    if (tag) removeTag(tag);
  });

  checklist.addEventListener('dragover', e => {
    e.preventDefault();
  });
}

function getCheckedTags() {
  return [...document.querySelectorAll('#tx-tags-checklist input[name="tx-tags"]:checked')]
    .map(cb => cb.value);
}

function createTagInput() {
  const wrap = document.createElement('span');
  wrap.className = 'tag-add-input';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'nueva…';
  const resize = () => { input.style.width = Math.max(5, input.value.length + 1) + 'ch'; };
  input.addEventListener('input', resize);
  wrap.appendChild(input);

  const commit = () => {
    const name = input.value.trim();
    if (name && !state.predefined.tags.includes(name)) {
      state.predefined.tags.push(name);
      saveData('predefined');
    }
    const checked = getCheckedTags();
    if (name && !checked.includes(name)) checked.push(name);
    renderTagsChecklist(checked);
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') renderTagsChecklist(getCheckedTags());
  });
  input.addEventListener('blur', commit);

  return wrap;
}

function openTransactionModal(txId) {
  updateSelectors();
  state.editingTxId = txId || null;

  if (!txId && state.currentView !== 'all' && state.currentView !== 'multi' && state.currentView !== 'receivables') {
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
  const accId      = document.getElementById('tx-account')?.value;
  const acc        = state.accounts.find(a => a.id === accId);
  const accCur     = acc?.currency || state.settings.currency || 'ARS';

  if (total >= 2 && rawAmt > 0) {
    const perCuota = rawAmt / total;
    previewVal.textContent = formatAccountCurrency(perCuota, accCur);
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
  const acc = state.accounts.find(a => a.id === tx.account_id);
  const accCur = acc?.currency || state.settings.currency || 'ARS';
  if (await showConfirm(`¿Marcar como cobrado el préstamo de ${formatAccountCurrency(Math.abs(tx.amount), accCur)} de ${tx.payee}?`, { title: 'Cobrar préstamo', confirmText: 'Marcar cobrado' })) {
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

  const settingsCur = state.settings.currency || 'ARS';
  let total = 0;
  state.selectedTxIds.forEach(id => {
    const tx = state.transactions.find(t => t.id === id);
    if (tx) {
      const acc = state.accounts.find(a => a.id === tx.account_id);
      const accCur = acc?.currency || settingsCur;
      const converted = convertCurrency(Number(tx.amount) || 0, accCur, settingsCur);
      total += (converted !== null && converted !== undefined) ? converted : (Number(tx.amount) || 0);
    }
  });

  const count = state.selectedTxIds.size;
  const countStr = count === 1 ? '1 seleccionado' : `${count} seleccionados`;
  const totalStr = formatCurrency(Math.abs(total));
  const sign = total < 0 ? '−' : total > 0 ? '+' : '';
  text.textContent = `${countStr} · ${sign}${totalStr}`;
  bar.style.display = 'inline-flex';
  lucide.createIcons();
}

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

// ── INLINE EDITING — rewrite robusto ───────────────────────────
let _ie = null;   // estado global del editor activo

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

// ── SORT ────────────────────────────────────────────────────
function toggleSort(column) {
  if (state.sortColumn === column) {
    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortColumn = column;
    state.sortDirection = column === 'date' ? 'desc' : 'asc';
  }
  renderTransactions();
}

function sortTransactions(arr) {
  const col = state.sortColumn;
  const dir = state.sortDirection === 'asc' ? 1 : -1;

  return arr.sort((a, b) => {
    let va, vb;
    switch (col) {
      case 'date':
        va = a.date || '';
        vb = b.date || '';
        return dir * va.localeCompare(vb);
      case 'account': {
        const accA = state.accounts.find(ac => ac.id === a.account_id);
        const accB = state.accounts.find(ac => ac.id === b.account_id);
        va = accA ? accA.name : '';
        vb = accB ? accB.name : '';
        break;
      }
      case 'payee':
        va = a.payee || '';
        vb = b.payee || '';
        break;
      case 'notes':
        va = a.notes || '';
        vb = b.notes || '';
        break;
      case 'tags':
        va = (a.tags || []).join(', ');
        vb = (b.tags || []).join(', ');
        break;
      case 'category':
        va = a.category_name || '';
        vb = b.category_name || '';
        break;
      case 'amount':
        return dir * ((Math.abs(a.amount) || 0) - (Math.abs(b.amount) || 0));
      default:
        return 0;
    }
    return dir * va.localeCompare(vb);
  });
}

function updateSortIndicators() {
  document.querySelectorAll('.col-sortable').forEach(th => {
    const col = th.dataset.sort;
    const arrow = th.querySelector('.sort-arrow');
    if (col === state.sortColumn) {
      th.classList.add('sort-active');
      th.classList.toggle('sort-desc', state.sortDirection === 'desc');
      if (arrow) arrow.textContent = state.sortDirection === 'asc' ? '↑' : '↓';
    } else {
      th.classList.remove('sort-active', 'sort-desc');
      if (arrow) arrow.textContent = '';
    }
  });
}

// ── RENDER TABLE ─────────────────────────────────────────────
function renderTransactions() {
  const tbody  = document.getElementById('tx-table-body');
  const search = document.getElementById('tx-search-input').value.toLowerCase();
  tbody.innerHTML = '';

  let filtered = [...state.transactions];

  // Show/hide account column
  const isSingleAccount = state.selectedAccounts.length === 1
    || (state.currentView !== 'all' && state.currentView !== 'multi' && !state.currentView.startsWith('type-') && state.currentView !== 'receivables');
  document.querySelector('.ledger')?.classList.toggle('hide-account-col', isSingleAccount);
  if (state.currentView === 'receivables') {
    filtered = filtered.filter(t => t.is_receivable);
  } else if (state.currentView === 'multi') {
    const selSet = new Set(state.selectedAccounts);
    filtered = filtered.filter(t => selSet.has(t.account_id));
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

  sortTransactions(filtered);

  // Separate present/future
  const today   = new Date().toISOString().split('T')[0];
  const present = filtered.filter(tx => !tx.is_future);
  const futures  = filtered.filter(tx => tx.is_future);

  // Split by period: in-period vs out-of-period
  const periodRange = getPeriodRange();
  const hasPeriodFilter = periodRange.start || periodRange.end;

  let inPeriodPresent, outOfPeriodPresent, inPeriodFuture, outOfPeriodFuture;
  if (hasPeriodFilter) {
    inPeriodPresent = present.filter(tx => isTxInPeriod(tx));
    outOfPeriodPresent = present.filter(tx => !isTxInPeriod(tx));
    // Future installments in period → treat as present (normal rows)
    inPeriodFuture = futures.filter(tx => isTxInPeriod(tx));
    outOfPeriodFuture = futures.filter(tx => !isTxInPeriod(tx));
  } else {
    inPeriodPresent = present;
    outOfPeriodPresent = [];
    inPeriodFuture = [];
    outOfPeriodFuture = futures;
  }

  // Merged in-period rows (present + future that fell in period)
  const inPeriodRows = [...inPeriodPresent, ...inPeriodFuture];

  // Count badge only counts in-period present rows
  document.getElementById('tx-count-badge').textContent = inPeriodRows.length;

  if (inPeriodRows.length === 0 && outOfPeriodFuture.length === 0 && outOfPeriodPresent.length === 0) {
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

    const accCurrency = acc?.currency || state.settings.currency || 'ARS';
    const amountVal   = isExpense ? '-' + formatAccountCurrency(Math.abs(tx.amount), accCurrency) : '+' + formatAccountCurrency(tx.amount, accCurrency);
    const amountClass = isExpense ? 'expense' : 'income';
    const amountTooltip = getConvertedTooltip(tx.amount, accCurrency);

    let payeeCellHtml = `<span class="payee-name">${tx.payee}</span>`;
    let cuotaCellHtml = '<span style="color:var(--text-lo)">—</span>';
    if (tx.installment_total) {
      cuotaCellHtml = `<span class="cuota-badge" title="Total: ${formatAccountCurrency(tx.installment_full_amount, accCurrency)}">${tx.installment_index}/${tx.installment_total}</span>`;
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
      <td class="amount-cell ${amountClass} editable-cell" data-field="amount" title="${amountTooltip ? amountTooltip + ' — Click para editar' : 'Click para editar'}">${amountVal}</td>
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

  // Render future rows first (above header) so they expand upward
  if (outOfPeriodFuture.length > 0) {
    const colCount  = isSingleAccount ? 10 : 11;
    const groupKey  = 'future-group-open';
    const isOpen    = sessionStorage.getItem(groupKey) === 'true';

    if (isOpen) {
      outOfPeriodFuture.forEach(tx => appendTxRow(tx, true));
    }

    // Header acts as separator between future and present
    const headerTr  = document.createElement('tr');
    headerTr.className = 'future-group-row';
    const headerTd  = document.createElement('td');
    headerTd.colSpan = colCount;
    const headerDiv = document.createElement('div');
    headerDiv.className = 'future-group-header';
    headerDiv.innerHTML = `
      <span class="future-group-arrow ${isOpen ? 'open' : ''}">›</span>
      <span>Cuotas futuras</span>
      <span class="future-group-count">${outOfPeriodFuture.length}</span>
    `;
    headerDiv.addEventListener('click', () => {
      const nowOpen = sessionStorage.getItem(groupKey) === 'true';
      sessionStorage.setItem(groupKey, (!nowOpen).toString());
      renderTransactions();
    });
    headerTd.appendChild(headerDiv);
    headerTr.appendChild(headerTd);
    tbody.appendChild(headerTr);
  }

  // Render in-period rows (present + future that fell in period as normal)
  inPeriodRows.forEach(tx => appendTxRow(tx, false));

  // Render out-of-period present group (collapsible, only when period filter is active)
  if (hasPeriodFilter && outOfPeriodPresent.length > 0) {
    const colCount  = isSingleAccount ? 10 : 11;
    const groupKey  = 'oop-group-open';
    const isOpen    = sessionStorage.getItem(groupKey) === 'true';

    const headerTr  = document.createElement('tr');
    headerTr.className = 'future-group-row oop-group-row';
    const headerTd  = document.createElement('td');
    headerTd.colSpan = colCount;
    const headerDiv = document.createElement('div');
    headerDiv.className = 'future-group-header';
    headerDiv.innerHTML = `
      <span class="future-group-arrow ${isOpen ? 'open' : ''}">›</span>
      <span>Fuera del período</span>
      <span class="future-group-count">${outOfPeriodPresent.length}</span>
    `;
    headerDiv.addEventListener('click', () => {
      const nowOpen = sessionStorage.getItem(groupKey) === 'true';
      sessionStorage.setItem(groupKey, (!nowOpen).toString());
      renderTransactions();
    });
    headerTd.appendChild(headerDiv);
    headerTr.appendChild(headerTd);
    tbody.appendChild(headerTr);

    if (isOpen) {
      outOfPeriodPresent.forEach(tx => appendTxRow(tx, true));
    }
  }

  updateSelectAllCheckbox();
  updateSelectionBar();
  updateSortIndicators();
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
