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
  bindSearchSelect('tx-debtor-search',   'dropdown-debtor',   'dropdown-debtor-list',   () => state.predefined.payees);
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

  const SPECIAL_TAGS = [
    { name: 'Pago de tarjeta', icon: 'credit-card', color: '#22c55e' },
    { name: 'Oculto', icon: 'eye-off', color: '#94a3b8' },
    { name: 'A cobrar', icon: 'clock', color: '#b45309' }
  ];
  const specialNames = SPECIAL_TAGS.map(t => t.name);

  // Regular tags
  const regularTags = state.predefined.tags.filter(t => {
    const n = typeof t === 'string' ? t : t.name;
    return !specialNames.includes(n) && !t.isSystem;
  });
  regularTags.forEach(tag => {
    const tagName = typeof tag === 'string' ? tag : tag.name;
    const tagColor = typeof tag === 'string' ? null : (tag.color || null);
    const isChecked = checked.includes(tagName);
    const label = document.createElement('label');
    label.className = 'tag-check-label';
    label.draggable = true;
    label.dataset.tag = tagName;
    const dotHtml = tagColor ? `<span class="tag-check-dot" style="background:${tagColor}"></span>` : '';
    label.innerHTML = `<input type="checkbox" name="tx-tags" value="${tagName}" ${isChecked ? 'checked' : ''}>${dotHtml}<span>${tagName}</span>`;
    label.addEventListener('dragstart', e => {
      _draggedTag = tagName;
      e.dataTransfer.setData('text/plain', tagName);
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

  // Special tags section
  const specialWrap = document.createElement('div');
  specialWrap.className = 'tags-special-section';
  const specialLabel = document.createElement('span');
  specialLabel.className = 'tags-special-title';
  specialLabel.textContent = 'Especiales';
  specialWrap.appendChild(specialLabel);

  SPECIAL_TAGS.forEach(st => {
    const isChecked = checked.includes(st.name);
    const label = document.createElement('label');
    label.className = 'tag-check-label tag-check-special';
    label.dataset.tag = st.name;
    label.innerHTML = `<input type="checkbox" name="tx-tags" value="${st.name}" ${isChecked ? 'checked' : ''}><i data-lucide="${st.icon}" style="width:12px;height:12px;color:${st.color}"></i><span>${st.name}</span>`;
    // Oculto syncs with excluded checkbox
    if (st.name === 'Oculto') {
      label.querySelector('input').addEventListener('change', function() {
        const excl = document.getElementById('tx-is-excluded');
        if (excl) excl.checked = this.checked;
      });
    }
    // A cobrar syncs with receivable checkbox
    if (st.name === 'A cobrar') {
      label.querySelector('input').addEventListener('change', function() {
        const recv = document.getElementById('tx-is-receivable');
        if (recv) {
          recv.checked = this.checked;
          toggleReceivableFields(this.checked);
          if (this.checked) {
            const payeeVal = document.getElementById('tx-payee-search')?.value?.trim();
            const debtorInput = document.getElementById('tx-debtor-search');
            if (debtorInput && payeeVal && !debtorInput.value.trim()) {
              debtorInput.value = payeeVal;
            }
          }
        }
      });
    }
    specialWrap.appendChild(label);
  });
  checklist.appendChild(specialWrap);

  // Sync excluded checkbox ↔ Oculto tag
  const exclCb = document.getElementById('tx-is-excluded');
  if (exclCb) {
    exclCb.onchange = function() {
      const ocultoInput = checklist.querySelector('input[name="tx-tags"][value="Oculto"]');
      if (ocultoInput) ocultoInput.checked = this.checked;
      // Visual update
      const ocultoLabel = ocultoInput?.closest('.tag-check-label');
      if (ocultoLabel) ocultoLabel.classList.toggle('tag-check-special-active', this.checked);
    };
  }

  // Sync receivable checkbox ↔ A cobrar tag
  const recvCb = document.getElementById('tx-is-receivable');
  if (recvCb) {
    recvCb.onchange = function() {
      const recvInput = checklist.querySelector('input[name="tx-tags"][value="A cobrar"]');
      if (recvInput) recvInput.checked = this.checked;
      const recvLabel = recvInput?.closest('.tag-check-label');
      if (recvLabel) recvLabel.classList.toggle('tag-check-special-active', this.checked);
      toggleReceivableFields(this.checked);
      if (this.checked) {
        const payeeVal = document.getElementById('tx-payee-search')?.value?.trim();
        const debtorInput = document.getElementById('tx-debtor-search');
        if (debtorInput && payeeVal && !debtorInput.value.trim()) {
          debtorInput.value = payeeVal;
        }
      }
    };
  }

  lucide.createIcons();
}

function removeTag(tag) {
  state.predefined.tags = state.predefined.tags.filter(t => (typeof t === 'string' ? t : t.name) !== tag);
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
  input.setAttribute('aria-label', 'Nueva etiqueta');
  const resize = () => { input.style.width = Math.max(5, input.value.length + 1) + 'ch'; };
  input.addEventListener('input', resize);
  wrap.appendChild(input);

  const commit = () => {
    const name = input.value.trim();
    const tagNames = state.predefined.tags.map(t => typeof t === 'string' ? t : t.name);
    if (name && !tagNames.includes(name)) {
      state.predefined.tags.push({ name, color: getRandomTagColor() });
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

  // Prevent browser autofill suggestions
  document.querySelectorAll('#tx-modal input:not([type="checkbox"]):not([type="file"]), #tx-modal select').forEach(el => el.setAttribute('autocomplete', 'off'));

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
    document.getElementById('tx-amount').value = tx.amount_expression || formatNoTrailingZeros(Math.abs(tx.amount));
    document.getElementById('tx-notes').value = tx.notes || '';

    setTxSign(tx.amount < 0 ? -1 : 1);

    renderTagsChecklist(tx.tags);

    const chk = document.getElementById('tx-is-receivable');
    chk.checked = !!tx.is_receivable;
    toggleReceivableFields(!!tx.is_receivable);
    const noDueDateChk = document.getElementById('tx-no-due-date');
    noDueDateChk.checked = !tx.no_due_date && !!tx.due_date;
    document.getElementById('tx-due-date').value = tx.due_date || '';
    document.getElementById('tx-due-date').disabled = !noDueDateChk.checked;
    document.getElementById('tx-debtor-search').value = tx.debtor || '';

    document.getElementById('tx-is-excluded').checked = !!tx.excluded;
    // Sync excluded → Oculto tag visual
    if (tx.excluded) {
      const ocultoInput = document.getElementById('tx-tags-checklist')?.querySelector('input[name="tx-tags"][value="Oculto"]');
      if (ocultoInput) {
        ocultoInput.checked = true;
        const lbl = ocultoInput.closest('.tag-check-label');
        if (lbl) lbl.classList.add('tag-check-special-active');
      }
    }
    // Sync receivable → A cobrar tag visual
    if (tx.is_receivable) {
      const recvInput = document.getElementById('tx-tags-checklist')?.querySelector('input[name="tx-tags"][value="A cobrar"]');
      if (recvInput) {
        recvInput.checked = true;
        const lbl = recvInput.closest('.tag-check-label');
        if (lbl) lbl.classList.add('tag-check-special-active');
      }
    }

    // Installment fields when editing
    const isInst = !!(tx.installment_group && tx.installment_total);
    const instChk = document.getElementById('tx-is-installment');
    instChk.checked = isInst;
    document.getElementById('tx-installment-index-display').style.display = 'none';
    document.getElementById('tx-installment-editor').style.display = isInst ? 'block' : 'none';
    if (isInst) {
      document.getElementById('tx-amount').value = formatNoTrailingZeros(tx.installment_full_amount || Math.abs(tx.amount));
      document.getElementById('tx-installment-count').value = tx.installment_total;
      document.getElementById('tx-installment-count').disabled = true;
      document.getElementById('tx-installment-index').value = tx.installment_index;
      document.getElementById('tx-installment-index').max = tx.installment_total;
      updateInstallmentPreview();
    } else {
      document.getElementById('tx-installment-count').disabled = false;
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
    document.getElementById('tx-no-due-date').checked = false;
    document.getElementById('tx-due-date').disabled = true;
    document.getElementById('tx-debtor-search').value = '';

    document.getElementById('tx-is-excluded').checked = false;

    // Reset installment fields
    document.getElementById('tx-is-installment').checked = false;
    document.getElementById('tx-installment-count').value = '3';
    document.getElementById('tx-installment-count').disabled = false;
    document.getElementById('tx-installment-index').value = '1';
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

  const amtErr = document.getElementById('tx-amount-error');
  if (amtErr) amtErr.style.display = 'none';

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
  const instIndex = document.getElementById('tx-installment-index');
  if (instIndex) instIndex.value = '1';
  const instCount = document.getElementById('tx-installment-count');
  if (instCount) { instCount.disabled = false; instCount.value = '3'; }
  const cuotaInput = document.getElementById('inst-cuota-input');
  if (cuotaInput) cuotaInput.value = '';
}

function toggleReceivableFields(show) {
  document.getElementById('tx-receivable-details').style.display = show ? 'block' : 'none';
}

function toggleNoDueDate(checked) {
  const dateInput = document.getElementById('tx-due-date');
  dateInput.disabled = !checked;
  if (!checked) dateInput.value = '';
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
  editor.style.display = checked ? 'block' : 'none';
  if (checked) {
    const tx = state.editingTxId ? state.transactions.find(t => t.id === state.editingTxId) : null;
    if (!tx || !tx.installment_group) {
      document.getElementById('tx-installment-count').value = '3';
      document.getElementById('tx-installment-index').value = '1';
    }
    updateInstallmentPreview();
  }
}

function getInstallmentMonthOffset(dateVal, accountId) {
  if (!dateVal || !accountId) return 0;
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc || acc.type !== 'credit_card' || !acc.card_schedule) return 0;
  const txDay = new Date(dateVal + 'T12:00:00').getDate();
  const txYM = dateVal.substring(0, 7);
  const sch = acc.card_schedule[txYM];
  if (!sch) return 0;
  const closingDay = new Date(sch.closing + 'T12:00:00').getDate();
  return closingDay < txDay ? 1 : 0;
}

function buildInstallmentTimeline() {
  const total     = parseInt(document.getElementById('tx-installment-count').value) || 0;
  const timeline  = document.getElementById('installment-timeline');
  const dateVal   = document.getElementById('tx-date').value;
  const indexInput = document.getElementById('tx-installment-index');
  let manualIdx   = parseInt(indexInput.value) || 1;
  if (manualIdx < 1) manualIdx = 1;
  if (total >= 2 && manualIdx > total) manualIdx = total;

  timeline.innerHTML = '';
  for (let i = manualIdx; i <= total; i++) {
    const cell = document.createElement('div');
    cell.className = 'inst-cell';
    const dot   = document.createElement('div');
    const isCurrent = i === manualIdx;
    dot.className = 'inst-dot ' + (isCurrent ? 'now' : 'future');
    dot.textContent = i;
    const lbl   = document.createElement('div');
    lbl.className = 'inst-dot-label ' + (isCurrent ? 'now' : '');
    if (dateVal) {
      const d = new Date(dateVal + 'T12:00:00');
      d.setMonth(d.getMonth() + i - 1);
      lbl.textContent = d.toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' });
    } else if (isCurrent) {
      lbl.textContent = 'ahora';
    } else {
      lbl.textContent = '+' + (i - manualIdx) + 'm';
    }
    cell.appendChild(dot);
    cell.appendChild(lbl);
    timeline.appendChild(cell);
  }
}

function formatNoTrailingZeros(num) {
  return parseFloat(num.toFixed(2)).toString().replace('.', ',');
}

function toggleInstallmentFields(checked) {
  onAccountChangeInModal();
}

function updateInstallmentPreview() {
  const total   = parseInt(document.getElementById('tx-installment-count').value) || 0;
  const rawInput = document.getElementById('tx-amount').value.trim();
  let rawAmt;
  if (isPlainNumber(rawInput)) {
    rawAmt = parseFloat(rawInput.replace(/[^\d,.\-]/g, '').replace(',', '.')) || 0;
  } else {
    const res = evaluateExpression(rawInput, state.settings.decimals);
    rawAmt = (res && res.value !== null) ? Math.abs(res.value) : 0;
  }
  const cuotaInput = document.getElementById('inst-cuota-input');

  const indexInput = document.getElementById('tx-installment-index');
  let manualIdx = parseInt(indexInput.value) || 1;
  if (manualIdx < 1) manualIdx = 1;
  if (total >= 2 && manualIdx > total) manualIdx = total;
  indexInput.max = total || 48;
  indexInput.value = manualIdx;

  if (total >= 2 && rawAmt > 0) {
    const perCuota = rawAmt / total;
    cuotaInput.value = formatNoTrailingZeros(perCuota);
  } else {
    cuotaInput.value = '';
  }

  buildInstallmentTimeline();
}

function onCuotaInput() {
  const total = parseInt(document.getElementById('tx-installment-count').value) || 0;
  const raw = document.getElementById('inst-cuota-input').value.replace(/[^\d,.\-]/g, '').replace(',', '.');
  const perCuota = parseFloat(raw) || 0;
  if (total >= 2 && perCuota > 0) {
    document.getElementById('tx-amount').value = formatNoTrailingZeros(perCuota * total);
  }
  buildInstallmentTimeline();
}

async function handleTransactionSubmit(event) {
  event.preventDefault();

  const dateVal     = document.getElementById('tx-date').value;
  const accountId   = document.getElementById('tx-account').value;
  const payee       = document.getElementById('tx-payee-search').value.trim();
  const categoryName = document.getElementById('tx-category-search').value.trim();
  const rawAmountInput = document.getElementById('tx-amount').value.trim();
  let rawAmount;
  if (isPlainNumber(rawAmountInput)) {
    rawAmount = parseFloat(rawAmountInput.replace(/[^\d,.\-]/g, '').replace(',', '.'));
  } else {
    const evalRes = evaluateExpression(rawAmountInput, state.settings.decimals);
    rawAmount = (evalRes && evalRes.value !== null) ? evalRes.value : NaN;
  }
  const amountExpression = (rawAmountInput && !isPlainNumber(rawAmountInput)) ? rawAmountInput : null;
  const notes       = document.getElementById('tx-notes').value.trim();
  const isReceivable = document.getElementById('tx-is-receivable').checked;
  const dueDate     = document.getElementById('tx-due-date').value;
  const noDueDate   = !document.getElementById('tx-no-due-date').checked;
  const debtor      = document.getElementById('tx-debtor-search').value.trim();
  const isExcluded  = document.getElementById('tx-is-excluded').checked;

  if (state._batchEditIds) {
    const activeTags = [];
    document.querySelectorAll('input[name="tx-tags"]:checked').forEach(c => {
      if (c.value !== 'Oculto' && c.value !== 'A cobrar') activeTags.push(c.value);
    });
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

  if (!accountId || isNaN(rawAmount)) {
    if (rawAmountInput && !isPlainNumber(rawAmountInput)) {
      const res = evaluateExpression(rawAmountInput, state.settings.decimals);
      if (res && res.error === 'too_large') {
        const amtErr = document.getElementById('tx-amount-error');
        if (amtErr) { amtErr.textContent = 'Número demasiado grande'; amtErr.style.display = ''; }
      }
    }
    return;
  }

  if (payee && !state.predefined.payees.includes(payee)) { state.predefined.payees.push(payee); saveData('predefined'); }
  const catNames = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name);
  if (categoryName && !catNames.includes(categoryName)) {
    state.predefined.categories.push({ name: categoryName, icon: 'tag' });
    saveData('predefined');
  }

  const activeTags = [];
  document.querySelectorAll('input[name="tx-tags"]:checked').forEach(c => {
    if (c.value !== 'Oculto' && c.value !== 'A cobrar') activeTags.push(c.value);
  });

  const amount = Math.abs(rawAmount) * state.currentTxSign;

  if (state.editingTxId) {
    const tx = state.transactions.find(t => t.id === state.editingTxId);
    if (tx) {
      const isInst = document.getElementById('tx-is-installment').checked;
      const totalCuotas = parseInt(document.getElementById('tx-installment-count').value) || 0;

      if (isInst && totalCuotas >= 2 && !tx.installment_group) {
        // Convert to installment: remove original, create installments
        state.transactions = state.transactions.filter(t => t.id !== state.editingTxId);
        const groupId   = 'ig-' + Date.now();
        const perCuota  = amount / totalCuotas;
        const today     = new Date().toISOString().split('T')[0];
        let manualIdx = parseInt(document.getElementById('tx-installment-index').value) || 1;
        if (manualIdx < 1) manualIdx = 1;
        if (manualIdx > totalCuotas) manualIdx = totalCuotas;

        for (let i = manualIdx; i <= totalCuotas; i++) {
          const d = new Date(dateVal + 'T12:00:00');
          d.setMonth(d.getMonth() + i - 1);
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
            excluded: isExcluded,
            is_future: isFuture,
            installment_group: groupId,
            installment_total: totalCuotas,
            installment_index: i,
            installment_full_amount: Math.abs(amount)
          });
        }
      } else if (!isInst && tx.installment_group) {
        const count = state.transactions.filter(t => t.installment_group === tx.installment_group).length;
        const ok = await showConfirm(
          `¿Estás seguro? Se eliminarán ${count} cuotas siguientes de esta compra.`,
          { title: 'Quitar cuotas', confirmText: 'Sí, eliminar cuotas', danger: true }
        );
        if (!ok) {
          document.getElementById('tx-is-installment').checked = true;
          onInstallmentCheck(true);
          return;
        }
        state.transactions = state.transactions.filter(t => t.installment_group !== tx.installment_group);
        delete tx.installment_group;
        delete tx.installment_total;
        delete tx.installment_index;
        delete tx.installment_full_amount;
        tx.date = dateVal;
        tx.is_future = dateVal > new Date().toISOString().split('T')[0];
        tx.account_id = accountId;
        tx.payee = payee;
        tx.category_name = categoryName;
        tx.amount = amount;
        tx.amount_expression = amountExpression;
        tx.notes = notes;
        tx.tags = activeTags;
        tx.is_receivable = isReceivable;
        tx.due_date = isReceivable && !noDueDate ? dueDate : '';
        tx.no_due_date = isReceivable ? noDueDate : false;
        tx.debtor = isReceivable ? debtor : '';
        tx.excluded = isExcluded;
      } else {
        tx.date = dateVal;
        tx.is_future = dateVal > new Date().toISOString().split('T')[0];
        tx.account_id = accountId;
        tx.payee = payee;
        tx.category_name = categoryName;
        tx.amount = amount;
        tx.amount_expression = amountExpression;
        tx.notes = notes;
        tx.tags = activeTags;
        tx.is_receivable = isReceivable;
        tx.due_date = isReceivable && !noDueDate ? dueDate : '';
        tx.no_due_date = isReceivable ? noDueDate : false;
        tx.debtor = isReceivable ? debtor : '';
        tx.excluded = isExcluded;
        if (tx.installment_group && tx.installment_total) {
          const newIdx = parseInt(document.getElementById('tx-installment-index').value) || tx.installment_index;
          tx.installment_index = Math.max(1, Math.min(newIdx, tx.installment_total));
        }
      }
    }
  } else {
    const isInst = document.getElementById('tx-is-installment').checked;
    const totalCuotas = parseInt(document.getElementById('tx-installment-count').value) || 0;

    if (isInst && totalCuotas >= 2) {
      const groupId   = 'ig-' + Date.now();
      const perCuota  = amount / totalCuotas;  // negative amount / N = negative per cuota
      const today     = new Date().toISOString().split('T')[0];
      let manualIdx = parseInt(document.getElementById('tx-installment-index').value) || 1;
      if (manualIdx < 1) manualIdx = 1;
      if (manualIdx > totalCuotas) manualIdx = totalCuotas;

      for (let i = manualIdx; i <= totalCuotas; i++) {
        const d = new Date(dateVal + 'T12:00:00');
        d.setMonth(d.getMonth() + i - 1);
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
          excluded: isExcluded,
          is_future: isFuture,
          installment_group: groupId,
          installment_total: totalCuotas,
          installment_index: i,
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
        amount_expression: amountExpression,
        notes,
        tags: activeTags,
        is_receivable: isReceivable,
        due_date: isReceivable && !noDueDate ? dueDate : '',
        no_due_date: isReceivable ? noDueDate : false,
        debtor: isReceivable ? debtor : '',
        excluded: isExcluded
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
  } else if (tx.split_group && !tx.split_parent_id) {
    const childCount = state.transactions.filter(t => t.split_parent_id === txId).length;
    if (childCount > 0) {
      if (!await showConfirm(`¿Eliminar esta transacción y sus ${childCount} divisiones?`, { title: 'Eliminar dividida', confirmText: 'Eliminar todo', danger: true })) return;
      deleteSplitChildren(txId);
    } else {
      if (!await showConfirm('¿Seguro que deseas eliminar esta transacción?', { title: 'Eliminar transacción', confirmText: 'Eliminar', danger: true })) return;
    }
    state.transactions = state.transactions.filter(t => t.id !== txId);
    state.selectedTxIds.delete(txId);
  } else if (tx.split_parent_id) {
    const parent = state.transactions.find(t => t.id === tx.split_parent_id);
    if (!parent) return;
    const childCount = state.transactions.filter(t => t.split_parent_id === parent.id).length;
    const acc = state.accounts.find(a => a.id === parent.account_id);
    const accCurrency = acc?.currency || state.settings.currency || 'UYU';
    const removedAbs = Math.abs(tx.amount);
    if (childCount <= 1) {
      if (!await showConfirm(`Esta es la única división. Al eliminarla, la transacción volverá a ser única.`, { title: 'Eliminar única división', confirmText: 'Eliminar' })) return;
      state.transactions = state.transactions.filter(t => t.id !== txId);
      state.selectedTxIds.delete(txId);
      delete parent.split_group;
    } else {
      const msg = `Al eliminar esta división de ${formatAccountCurrency(removedAbs, accCurrency)}, el monto quedará sin asignar dentro de la transacción dividida. ¿Deseas ir al editor de divisiones para redistribuirlo?`;
      if (!await showConfirm(msg, { title: 'División sin asignar', confirmText: 'Ir al editor', cancelText: 'Eliminar de todas formas' })) {
        state.transactions = state.transactions.filter(t => t.id !== txId);
        state.selectedTxIds.delete(txId);
        const remainingChildren = state.transactions.filter(t => t.split_parent_id === parent.id).length;
        if (remainingChildren === 0) delete parent.split_group;
      } else {
        openSplitModal(parent.id);
        return;
      }
    }
  } else {
    if (!await showConfirm('¿Seguro que deseas eliminar esta transacción?', { title: 'Eliminar transacción', confirmText: 'Eliminar', danger: true })) return;
    // Restore receivable if deleting a refund
    _restoreReceivableFromRefund(tx);
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
  const accCur = acc?.currency || state.settings.currency || 'UYU';
  const debtorName = tx.debtor || tx.payee;
  if (await showConfirm(`¿Marcar como cobrado el préstamo de ${formatAccountCurrency(Math.abs(tx.amount), accCur)} de ${debtorName}?`, { title: 'Cobrar préstamo', confirmText: 'Marcar cobrado' })) {
    tx.is_receivable = false;
    state.transactions.unshift({
      id: 'tx-' + Date.now() + '-refund',
      date: new Date().toISOString().split('T')[0],
      account_id: tx.account_id,
      payee: debtorName,
      category_name: 'Pagos',
      amount: Math.abs(tx.amount),
      notes: 'Préstamo cobrado ' + tx.payee,
      tags: [...(tx.tags || [])],
      is_receivable: false
    });
    saveData('transactions');
    renderAll();
  }
}

// ── TX SELECTION ──────────────────────────────────────────────
let _lastClickTxId = null;

function handleTxRowClick(txId, event) {
  if (!event) return;
  event.stopPropagation();

  if (event.shiftKey && _lastClickTxId !== null && _lastClickTxId !== txId) {
    const tbody = document.getElementById('tx-table-body');
    const rows = [...tbody.querySelectorAll('tr[data-tx-id]')];
    const ids = rows.map(r => r.dataset.txId);
    const start = ids.indexOf(_lastClickTxId);
    const end = ids.indexOf(txId);
    if (start !== -1 && end !== -1) {
      state.selectedTxIds.clear();
      const [from, to] = start < end ? [start, end] : [end, start];
      for (let i = from; i <= to; i++) {
        state.selectedTxIds.add(ids[i]);
      }
      rows.forEach(r => {
        const id = r.dataset.txId;
        r.classList.toggle('selected', state.selectedTxIds.has(id));
        const cb = r.querySelector('.tx-checkbox');
        if (cb) cb.checked = state.selectedTxIds.has(id);
      });
      updateSelectionBar();
      updateSelectAllCheckbox();
      return;
    }
    _lastClickTxId = null;
  }

  const wasSelected = state.selectedTxIds.has(txId);
  if (wasSelected) {
    state.selectedTxIds.delete(txId);
  } else {
    state.selectedTxIds.add(txId);
  }
  const row = document.querySelector(`tr[data-tx-id="${txId}"]`);
  if (row) row.classList.toggle('selected', state.selectedTxIds.has(txId));
  const cb = row ? row.querySelector('.tx-checkbox') : null;
  if (cb) cb.checked = state.selectedTxIds.has(txId);

  // Propagate to children when parent is toggled
  const tx = state.transactions.find(t => t.id === txId);
  if (tx && tx.split_group && !tx.split_parent_id) {
    const children = state.transactions.filter(t => t.split_parent_id === txId);
    children.forEach(child => {
      if (wasSelected) {
        state.selectedTxIds.delete(child.id);
      } else {
        state.selectedTxIds.add(child.id);
      }
      const childRow = document.querySelector(`tr[data-tx-id="${child.id}"]`);
      if (childRow) childRow.classList.toggle('selected', state.selectedTxIds.has(child.id));
      const childCb = childRow ? childRow.querySelector('.tx-checkbox') : null;
      if (childCb) childCb.checked = state.selectedTxIds.has(child.id);
    });
  }

  updateSelectionBar();
  updateSelectAllCheckbox();
  _lastClickTxId = txId;
}

function toggleTxSelection(txId) {
  handleTxRowClick(txId, { shiftKey: false, stopPropagation: () => {} });
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
  _lastClickTxId = null;
  updateSelectionBar();
}

function clearTxSelection() {
  state.selectedTxIds.clear();
  _lastClickTxId = null;
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
  { value: 'closing_period', label: 'Cierre TC', type: 'text' },
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
  colSel.setAttribute('aria-label', 'Columna de filtro');
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
  opSel.setAttribute('aria-label', 'Operador de filtro');
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
  valInput.setAttribute('aria-label', 'Valor de filtro');
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

  const settingsCur = state.settings.currency || 'UYU';
  let total = 0;
  const selectedIds = [...state.selectedTxIds];

  const selectedParents = new Set();
  selectedIds.forEach(id => {
    const tx = state.transactions.find(t => t.id === id);
    if (tx && tx.split_group && !tx.split_parent_id) selectedParents.add(id);
  });

  const childOfSelectedParent = new Set();
  selectedIds.forEach(id => {
    const tx = state.transactions.find(t => t.id === id);
    if (tx && tx.split_parent_id && selectedParents.has(tx.split_parent_id)) {
      childOfSelectedParent.add(id);
    }
  });

  selectedIds.forEach(id => {
    if (childOfSelectedParent.has(id)) return;
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;
    const acc = state.accounts.find(a => a.id === tx.account_id);
    const accCur = acc?.currency || settingsCur;
    const converted = convertCurrency(Number(tx.amount) || 0, accCur, settingsCur);
    total += (converted !== null && converted !== undefined) ? converted : (Number(tx.amount) || 0);
  });

  const count = selectedIds.length - childOfSelectedParent.size;
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

  const excludedCount = _countExcludedInSelection();
  if (excludedCount > 0) {
    const totalCount = state.selectedTxIds.size;
    const activeCount = totalCount - excludedCount;
    showConfirm(
      `La selección incluye ${excludedCount} transacción${excludedCount > 1 ? 'es' : ''} excluida${excludedCount > 1 ? 's' : ''} del total.\n\n¿Qué deseas hacer?`,
      {
        title: 'Transacciones excluidas',
        confirmText: `Incluir las ${excludedCount} excluidas`,
        cancelText: `Solo las ${activeCount} activas`,
        danger: false
      }
    ).then(ok => {
      if (!ok) _filterExcludedFromSelection();
      _openBatchEditModalInner();
    });
    return;
  }
  _openBatchEditModalInner();
}

function _openBatchEditModalInner() {
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
  const batchCuotaInput = document.getElementById('inst-cuota-input');
  if (batchCuotaInput) batchCuotaInput.value = '';

  document.getElementById('tx-modal').classList.add('open');
  lucide.createIcons();
}

function _countExcludedInSelection() {
  let excludedCount = 0;
  state.selectedTxIds.forEach(id => {
    const tx = state.transactions.find(t => t.id === id);
    if (tx && isTxExcluded(tx)) excludedCount++;
  });
  return excludedCount;
}

function _filterExcludedFromSelection() {
  state.selectedTxIds.forEach(id => {
    const tx = state.transactions.find(t => t.id === id);
    if (tx && isTxExcluded(tx)) state.selectedTxIds.delete(id);
  });
}

function batchDeleteTransactions() {
  if (state.selectedTxIds.size === 0) return;
  const excludedCount = _countExcludedInSelection();

  const doDelete = (ids) => {
    const count = ids.size;
    showConfirm(`¿Eliminar ${count} transacciones seleccionadas? Esta acción no se puede deshacer.`, {
      title: 'Eliminar transacciones',
      confirmText: `Eliminar ${count}`,
      danger: true
    }).then(ok => {
      if (!ok) return;
      state.transactions = state.transactions.filter(t => !ids.has(t.id));
      state.selectedTxIds.clear();
      saveData('transactions');
      renderAll();
    });
  };

  if (excludedCount > 0) {
    const totalCount = state.selectedTxIds.size;
    const activeCount = totalCount - excludedCount;
    showConfirm(
      `La selección incluye ${excludedCount} transacción${excludedCount > 1 ? 'es' : ''} excluida${excludedCount > 1 ? 's' : ''} del total.\n\n¿Qué deseas hacer?`,
      {
        title: 'Transacciones excluidas',
        confirmText: `Incluir las ${excludedCount} excluidas`,
        cancelText: `Solo las ${activeCount} activas`,
        danger: false
      }
    ).then(ok => {
      if (ok) {
        doDelete(state.selectedTxIds);
      } else {
        _filterExcludedFromSelection();
        doDelete(state.selectedTxIds);
      }
    });
  } else {
    doDelete(state.selectedTxIds);
  }
}

// ── INLINE EDITING — rewrite robusto ───────────────────────────
let _ie = null;   // estado global del editor activo
let _lastEditedPosition = null; // { txId, field } para Enter post-edición

// ── posicionar dropdown fijo bajo una celda ───────────────────
function _positionDD(dd, anchorEl) {
  if (!anchorEl || !anchorEl.isConnected) return;
  const r = anchorEl.getBoundingClientRect();
  if (!r.width && !r.height) return;
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

  // ── Navegación por teclado dentro del dropdown ────────
  const _getDDItems = () => [...dd.querySelectorAll('.comfy-dropdown-item')];

  const _highlightRel = (dir) => {
    const els = _getDDItems();
    if (!els.length) return;
    let idx = els.findIndex(el => el.classList.contains('active'));
    idx = idx === -1 ? (dir > 0 ? 0 : els.length - 1) : Math.max(0, Math.min(idx + dir, els.length - 1));
    els.forEach((el, i) => el.classList.toggle('active', i === idx));
    els[idx]?.scrollIntoView({ block: 'nearest' });
  };

  const _selectActive = () => {
    const els = _getDDItems();
    if (!els.length) return;
    let idx = els.findIndex(el => el.classList.contains('active'));
    if (idx === -1) idx = 0;
    if (idx >= 0 && idx < items.length) {
      onSelect(items[idx]);
    }
  };

  dd.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); _highlightRel(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); _highlightRel(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); _selectActive(); }
  });

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
  const { cell, txId, field, originalValue, getValue, parser, getRawText } = _ie;

  _closeDD();
  cell.classList.remove('editing');
  _ie = null;

  if (commit) {
    _lastEditedPosition = { txId, field };
  } else {
    _lastEditedPosition = null;
    document.querySelectorAll('.cell-selected').forEach(el => el.classList.remove('cell-selected'));
  }

  if (commit) {
    const rawVal = getValue();
    let parsed = parser ? parser(rawVal, getRawText ? getRawText() : null) : rawVal;
    // Si el campo de texto queda vacío, asignar "Sin asignar"
    if ((field === 'payee' || field === 'category_name') && (!parsed || !parsed.trim())) {
      parsed = 'Sin asignar';
    }
    // Comparación flexible para arrays (tags)
    const unchanged = Array.isArray(parsed)
      ? JSON.stringify(parsed) === JSON.stringify(originalValue)
      : parsed === originalValue || parsed === null || parsed === undefined;

    if (!unchanged) {
      const tx = state.transactions.find(t => t.id === txId);
      if (tx && parsed !== null && parsed !== undefined) {
        tx[field] = parsed;
        if (field === 'amount') {
          const rawText = getRawText ? getRawText() : null;
          tx.amount_expression = (rawText && !isPlainNumber(rawText)) ? rawText : null;
        }
        saveData('transactions');
        // Auto-agregar a predefinidos si es nuevo
        if (field === 'payee' && parsed !== 'Sin asignar' && !state.predefined.payees.includes(parsed)) {
          state.predefined.payees.push(parsed);
          saveData('predefined');
        }
        if (field === 'category_name' && parsed !== 'Sin asignar' && !state.predefined.categories.some(c => (typeof c === 'string' ? c : c.name) === parsed)) {
          state.predefined.categories.push({ name: parsed, icon: 'tag' });
          saveData('predefined');
        }
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
    _lastEditedPosition = null;
    document.querySelectorAll('.cell-selected').forEach(el => el.classList.remove('cell-selected'));
  }
}

document.addEventListener('mousedown', _globalMousedown, true);

// ── (navegación desde celda seleccionada ahora se maneja
//     por listener directo en cada .editable-cell ──────────────

// ── helper: celdas editables de una fila (ocultas excluidas) ─
function _getEditableCellsInRow(tr) {
  return [...tr.querySelectorAll('.editable-cell')].filter(c => c.offsetParent !== null);
}

// ── marcar celda como seleccionada (post-commit) ─────────────
function _markCellSelected(txId, field) {
  _lastEditedPosition = { txId, field };
  document.querySelectorAll('.cell-selected').forEach(el => {
    el.classList.remove('cell-selected');
    el.removeAttribute('tabindex');
  });
  const tr = document.querySelector(`tr[data-tx-id="${txId}"]`);
  if (!tr) return;
  const cell = tr.querySelector(`.editable-cell[data-field="${field}"]`);
  if (cell) {
    cell.classList.add('cell-selected');
    cell.tabIndex = -1;
    cell.focus();
  }
}

// ── navegar desde la celda actual a otra celda ────────────────
function _navigateFromInline(fromTxId, fromField, dirRow, dirCol) {
  const tr = document.querySelector(`tr[data-tx-id="${fromTxId}"]`);
  if (!tr) return;
  const tbody = tr.closest('tbody');
  if (!tbody) return;

  const rows = [...tbody.querySelectorAll('tr[data-tx-id]')];
  const rowIdx = rows.indexOf(tr);
  if (rowIdx === -1) return;

  const curCells = _getEditableCellsInRow(tr);
  let colIdx = curCells.findIndex(c => c.dataset.field === fromField);
  if (colIdx === -1) return;

  colIdx += dirCol;
  let targetRowIdx = rowIdx + dirRow;
  const curMax = curCells.length - 1;

  // Tab wrapping: last col → next row first col, first col → prev row last col
  if (dirCol !== 0 && dirRow === 0) {
    if (colIdx > curMax) { targetRowIdx = rowIdx + 1; colIdx = 0; }
    else if (colIdx < 0) { targetRowIdx = rowIdx - 1; }
  }

  if (targetRowIdx < 0 || targetRowIdx >= rows.length) return;

  const targetRow = rows[targetRowIdx];
  const targetCells = _getEditableCellsInRow(targetRow);

  if (colIdx < 0) colIdx = targetCells.length - 1;
  if (colIdx >= targetCells.length) colIdx = 0;

  const targetCell = targetCells[colIdx];
  if (!targetCell) return;

  const targetTxId = targetRow.dataset.txId;
  const targetField = targetCell.dataset.field;
  if (!targetTxId || !targetField) return;

  const targetTx = state.transactions.find(t => t.id === targetTxId);
  if (!targetTx) return;
  const opts = getEditOptions(targetField, targetTx);
  if (!opts) return;

  startInlineEdit(targetCell, targetTxId, targetField, opts.type, opts);
}

// ── función principal ─────────────────────────────────────────
function startInlineEdit(cell, txId, field, type, options) {
  if (_ie) closeInlineEditor(false);
  document.querySelectorAll('.cell-selected').forEach(el => el.classList.remove('cell-selected'));

  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;

  const originalValue = tx[field];
  cell.classList.add('editing');

  _ie = {
    cell, txId, field, originalValue,
    dd: null,
    getValue: () => originalValue,
    getRawText: null,
    parser: options.parser || null
  };

  // ── TIPO: text / number (contentEditable span) ──────────
  if (type === 'text' || type === 'number') {
    cell.textContent = '';
    const span = document.createElement('span');
    span.className = 'inline-editor-span';
    span.contentEditable = 'plaintext-only';
    const displayVal = type === 'number'
      ? (tx.amount_expression || String(Math.abs(originalValue)))
      : (originalValue || '').trim();
    span.textContent = displayVal;
    cell.appendChild(span);

    if (type === 'number') {
      const errEl = document.createElement('span');
      errEl.className = 'calc-error';
      errEl.style.display = 'none';
      cell.appendChild(errEl);
      _ie._errEl = errEl;
    }

    _ie.getValue = () => {
      let v = span.textContent.trim();
      if (type === 'number') {
        if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
        const evalResult = evaluateExpression(v, state.settings.decimals);
        if (evalResult && evalResult.error) return 0;
        return evalResult ? evalResult.value : (parseFloat(v) || 0);
      }
      return v;
    };

    _ie.getRawText = () => {
      if (type === 'number') {
        let v = span.textContent.trim();
        if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
        return v;
      }
      return null;
    };

    const _getDDItemText = (el) => {
      const s = el.querySelector('span:first-child');
      return s ? s.textContent.trim() : el.textContent.trim();
    };

    span.addEventListener('keydown', e => {
      const ddItems = _ie && _ie.dd ? [..._ie.dd.querySelectorAll('.comfy-dropdown-item')] : [];

      if (e.key === 'Tab') {
        e.preventDefault();
        closeInlineEditor(true);
        _navigateFromInline(txId, field, 0, e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (ddItems.length) {
          let idx = ddItems.findIndex(el => el.classList.contains('active'));
          if (idx === -1) idx = 0;
          if (idx < ddItems.length) span.textContent = _getDDItemText(ddItems[idx]);
        }
        closeInlineEditor(true);
        _markCellSelected(txId, field);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); closeInlineEditor(false); return; }

      // Arrow keys navigate the suggestion dropdown
      if (ddItems.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        let idx = ddItems.findIndex(el => el.classList.contains('active'));
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        idx = idx === -1 ? (dir > 0 ? 0 : ddItems.length - 1) : Math.max(0, Math.min(idx + dir, ddItems.length - 1));
        ddItems.forEach((el, i) => el.classList.toggle('active', i === idx));
        ddItems[idx]?.scrollIntoView({ block: 'nearest' });
      }
    });

    if (type === 'number') {
      span.addEventListener('input', () => {
        if (!_ie || _ie.cell !== cell) return;
        const errEl = _ie._errEl;
        if (!errEl) return;
        let v = span.textContent.trim();
        if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
        const res = evaluateExpression(v, state.settings.decimals);
        if (res && res.error === 'too_large') {
          errEl.textContent = 'Número demasiado grande';
          errEl.style.display = '';
        } else if (res && (res.error === 'syntax' || res.error === 'invalid')) {
          errEl.textContent = 'Expresión inválida';
          errEl.style.display = '';
        } else {
          errEl.style.display = 'none';
        }
      });
    }

    if (type === 'text' && options.suggestions) {
      let _lastSuggestKey = '';
      const openSuggestDD = (filter) => {
        const all = options.suggestions();
        const filtered = filter
          ? all.filter(s => s.toLowerCase().includes(filter.toLowerCase()))
          : all;
        const key = filtered.join('|');
        if (key === _lastSuggestKey) return;
        _lastSuggestKey = key;
        if (!filtered.length) { _closeDD(); return; }
        const dd = _makeListDD(filtered, originalValue, (item) => {
          span.textContent = item;
          _closeDD();
          closeInlineEditor(true);
          _markCellSelected(txId, field);
        });
        dd.id = 'wallet-dd';
        _positionDD(dd, cell);
        _ie.dd = dd;
      };
      let _suggestTimer = null;
      span.addEventListener('input', () => {
        clearTimeout(_suggestTimer);
        _suggestTimer = setTimeout(() => openSuggestDD(span.textContent.trim()), 280);
      });
      setTimeout(() => openSuggestDD(span.textContent.trim()), 0);
    }

    span.focus();
    const range = document.createRange();
    range.selectNodeContents(span);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Click en padding del td → caret al final del span
    cell.addEventListener('click', function _ceClick(e) {
      if (!_ie || _ie.cell !== cell) return;
      if (!span.contains(e.target)) {
        const r = document.createRange();
        r.selectNodeContents(span);
        r.collapse(false);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        span.focus();
      }
    });
  }

  // ── TIPO: date (invisible input + display) ──────────────
  else if (type === 'date') {
    const plainText = originalValue || '';
    cell.textContent = '';
    cell.style.position = 'relative';

    const display = document.createElement('span');
    display.className = 'inline-display';
    display.textContent = originalValue ? formatDate(originalValue) : '';
    cell.appendChild(display);

    const input = document.createElement('input');
    input.className = 'inline-input-ghost';
    input.type = 'date';
    input.value = plainText;
    input.setAttribute('aria-label', 'Fecha');
    cell.appendChild(input);

    const syncDisplay = () => {
      display.textContent = input.value ? formatDate(input.value) : '';
    };
    input.addEventListener('input', syncDisplay);

    _ie.getValue = () => input.value || '';

    const _dateTabHandler = e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        closeInlineEditor(true);
        _navigateFromInline(txId, field, 0, e.shiftKey ? -1 : 1);
    }
  };

    cell.addEventListener('keydown', _dateTabHandler, { capture: true });

    input.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); closeInlineEditor(true); _navigateFromInline(txId, field, 0, e.shiftKey ? -1 : 1); return; }
      if (e.key === 'Enter') { e.preventDefault(); closeInlineEditor(true); _markCellSelected(txId, field); return; }
      if (e.key === 'Escape') { e.preventDefault(); closeInlineEditor(false); }
    });

    setTimeout(() => { input.focus(); input.select(); }, 0);
  }

  // ── TIPO: select ─────────────────────────────────────────
  else if (type === 'select') {
    cell.innerHTML = '';
    const items  = options.options || [];
    const currentLabel = items.find(i => i.value === originalValue);
    const dispEl = document.createElement('div');
    dispEl.className = 'inline-editor-display';
    dispEl.textContent = currentLabel ? currentLabel.label : '—';
    cell.appendChild(dispEl);

    _ie.getValue = () => _ie._chosen !== undefined ? _ie._chosen : originalValue;
    _ie._chosen = undefined;

    const openSelectDD = () => {
      const labels = items.map(i => i.label);
      const curLabel = currentLabel ? currentLabel.label : '';
      const onSelectAccount = (label) => {
        const found = items.find(i => i.label === label);
        if (found) { _ie._chosen = found.value; dispEl.textContent = label; }
        _closeDD();
        closeInlineEditor(true);
        _markCellSelected(txId, field);
      };
      const dd = _makeListDD(labels, curLabel, onSelectAccount);
      dd.id = 'wallet-dd';
      _positionDD(dd, cell);
      _ie.dd = dd;

      // Navegación por teclado (Tab, Escape) y foco
      dd.addEventListener('keydown', e => {
        if (e.key === 'Tab') { e.preventDefault(); closeInlineEditor(true); _navigateFromInline(txId, field, 0, e.shiftKey ? -1 : 1); }
        else if (e.key === 'Escape') { e.preventDefault(); closeInlineEditor(false); }
      });
      dd.tabIndex = -1;
      setTimeout(() => dd.focus(), 0);
    };

    dispEl.addEventListener('click', openSelectDD);
    setTimeout(openSelectDD, 0);
  }

  // ── TIPO: tags ────────────────────────────────────────────
  else if (type === 'tags') {
    cell.innerHTML = '';
    const current = new Set(Array.isArray(originalValue) ? originalValue : []);

    const tagsWrap = cell.querySelector('.tags-wrap');
    if (tagsWrap) tagsWrap.style.display = 'none';

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
      if (!cell.isConnected) { closeInlineEditor(false); return; }

      const available = (options.suggestions ? options.suggestions() : [])
        .filter(t => !current.has(t));

      _closeDD();
      const dd = document.createElement('div');
      dd.className = 'comfy-dropdown open';
      dd.style.position = 'fixed';
      dd.style.zIndex = '9999';

      const inputRow = document.createElement('div');
      inputRow.className = 'comfy-dropdown-input-row';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'comfy-dropdown-input';
      input.placeholder = 'nueva etiqueta…';
      input.setAttribute('aria-label', 'Nueva etiqueta');
      inputRow.appendChild(input);
      dd.appendChild(inputRow);

      const listWrap = document.createElement('div');
      listWrap.className = 'comfy-dropdown-list';
      dd.appendChild(listWrap);

      const renderList = () => {
        listWrap.innerHTML = '';
        const filtered = available.filter(t => !current.has(t));
        if (!filtered.length && !input.value.trim()) {
          const empty = document.createElement('div');
          empty.className = 'comfy-dropdown-empty';
          empty.textContent = 'Sin sugerencias';
          listWrap.appendChild(empty);
        } else {
          filtered.forEach(item => {
            const row = document.createElement('div');
            row.className = 'comfy-dropdown-item';
            row.innerHTML = `<span>${item}</span><span class="check">✓</span>`;
            row.addEventListener('mousedown', e => {
              e.preventDefault();
              current.add(item);
              renderPills();
              _closeDD();
              setTimeout(openTagsDD, 80);
            });
            listWrap.appendChild(row);
          });
        }
      };
      renderList();

      input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        const filtered = available.filter(t =>
          !current.has(t) && t.toLowerCase().includes(val)
        );
        listWrap.innerHTML = '';
        if (val) {
          const exact = available.find(t => t.toLowerCase() === val);
          const createRow = document.createElement('div');
          createRow.className = 'comfy-dropdown-item';
          createRow.innerHTML = `<span>+ "${exact || input.value.trim()}"</span><span class="check">↵</span>`;
          createRow.addEventListener('mousedown', e => {
            e.preventDefault();
            const name = input.value.trim();
            if (!current.has(name)) {
              const tagNames = state.predefined.tags.map(t => typeof t === 'string' ? t : t.name);
              if (!tagNames.includes(name)) {
                state.predefined.tags.push({ name, color: getRandomTagColor() });
                saveData('predefined');
              }
              current.add(name);
              renderPills();
              _closeDD();
              setTimeout(openTagsDD, 80);
            }
          });
          listWrap.appendChild(createRow);
        }
        filtered.forEach(item => {
          const row = document.createElement('div');
          row.className = 'comfy-dropdown-item';
          row.innerHTML = `<span>${item}</span><span class="check">✓</span>`;
          row.addEventListener('mousedown', e => {
            e.preventDefault();
            current.add(item);
            renderPills();
            _closeDD();
            setTimeout(openTagsDD, 80);
          });
          listWrap.appendChild(row);
        });
      });

      const _highlightTagItem = (dir) => {
        const els = [...listWrap.querySelectorAll('.comfy-dropdown-item')];
        if (!els.length) return;
        let idx = els.findIndex(el => el.classList.contains('active'));
        idx = idx === -1 ? (dir > 0 ? 0 : els.length - 1) : Math.max(0, Math.min(idx + dir, els.length - 1));
        els.forEach((el, i) => el.classList.toggle('active', i === idx));
        els[idx]?.scrollIntoView({ block: 'nearest' });
      };

      const _selectTagItem = () => {
        const els = [...listWrap.querySelectorAll('.comfy-dropdown-item')];
        let idx = els.findIndex(el => el.classList.contains('active'));
        if (idx === -1) idx = 0;
        if (idx < els.length) {
          els[idx].click();
          return true;
        }
        return false;
      };

      input.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
          e.preventDefault();
          _closeDD();
          closeInlineEditor(true);
          _navigateFromInline(txId, field, 0, e.shiftKey ? -1 : 1);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const name = input.value.trim();
          if (name) {
            // Try to add the typed text as a new tag
            if (!current.has(name)) {
              const tagNames = state.predefined.tags.map(t => typeof t === 'string' ? t : t.name);
              if (!tagNames.includes(name)) {
                state.predefined.tags.push({ name, color: getRandomTagColor() });
                saveData('predefined');
              }
              current.add(name);
              renderPills();
              _closeDD();
              setTimeout(openTagsDD, 80);
            }
          } else if (!_selectTagItem()) {
            // No text and no items to select → close only
            closeInlineEditor(true);
            _markCellSelected(txId, field);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          _closeDD();
          return;
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); _highlightTagItem(1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); _highlightTagItem(-1); return; }
      });

      document.body.appendChild(dd);
      dd.id = 'wallet-dd';
      _ie.dd = dd;
      _positionDD(dd, cell);
      input.focus();
    };

    wrap.addEventListener('click', e => {
      e.stopPropagation();
      const remove = e.target.closest('.remove-tag');
      if (remove) {
        current.delete(remove.dataset.tag);
        renderPills();
        _closeDD();
        return;
      }
      openTagsDD();
    });

    wrap.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); closeInlineEditor(true); _navigateFromInline(txId, field, 0, e.shiftKey ? -1 : 1); return; }
      if (e.key === 'Escape') { e.preventDefault(); closeInlineEditor(false); return; }
      if (e.key === 'Enter') { e.preventDefault(); closeInlineEditor(true); _markCellSelected(txId, field); }
    });

    setTimeout(openTagsDD, 0);
  }
}

// ── SORT ────────────────────────────────────────────────────
function toggleSort(column) {
  if (state._justResized) return;
  if (state.sortColumn === column) {
    if (state.sortDirection === 'asc') {
      state.sortDirection = 'desc';
    } else {
      state.sortColumn = null;
      state.sortDirection = 'asc';
    }
  } else {
    state.sortColumn = column;
    state.sortDirection = 'asc';
  }
  renderTransactions();
}

function sortTransactions(arr) {
  if (!state.sortColumn) return;

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
      case 'cuota': {
        const aIdx = a.installment_index || 0;
        const aTot = a.installment_total || 0;
        const bIdx = b.installment_index || 0;
        const bTot = b.installment_total || 0;
        const aRatio = aTot > 0 ? aIdx / aTot : 0;
        const bRatio = bTot > 0 ? bIdx / bTot : 0;
        return dir * (aRatio - bRatio);
      }
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
    if (arrow) arrow.textContent = '';
    th.classList.remove('sort-active', 'sort-desc');
    if (col === state.sortColumn && state.sortColumn) {
      th.classList.add('sort-active');
      th.classList.toggle('sort-desc', state.sortDirection === 'desc');
      if (arrow) arrow.textContent = state.sortDirection === 'asc' ? '↑' : '↓';
    }
  });
}

// ── RECEIVABLE HELPERS ────────────────────────────────────────
function _findRefundTx(tx) {
  const debtorName = tx.debtor || tx.payee;
  return state.transactions.find(t =>
    t.id !== tx.id
    && t.payee === debtorName
    && t.account_id === tx.account_id
    && Math.abs(Number(t.amount) || 0) === Math.abs(Number(tx.amount) || 0)
    && t.notes.startsWith('Préstamo cobrado ')
  ) || null;
}

function _getReceivablePill(tx) {
  const refund = _findRefundTx(tx);
  if (refund) {
    return '<span class="tag-pill-collected"><i data-lucide="check-circle"></i> Cobrado</span>';
  }
  if (tx.is_receivable) {
    if (tx.due_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(tx.due_date + 'T00:00:00');
      const diffMs = due - today;
      const diffDays = Math.round(diffMs / 86400000);
      if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        const label = overdueDays === 1 ? 'Hace 1 día vencido' : `Hace ${overdueDays} días vencido`;
        return `<span class="tag-pill-overdue" title="${label}"><i data-lucide="clock-alert"></i> A cobrar</span>`;
      }
      if (diffDays === 0) {
        return '<span class="tag-pill-receivable" title="El cobro es hoy"><i data-lucide="clock"></i> A cobrar</span>';
      }
      const label = diffDays === 1 ? 'Falta 1 día para el cobro' : `Faltan ${diffDays} días para el cobro`;
      return `<span class="tag-pill-receivable" title="${label}"><i data-lucide="clock"></i> A cobrar</span>`;
    }
    return '<span class="tag-pill-receivable"><i data-lucide="clock"></i> A cobrar</span>';
  }
  return '';
}

function _restoreReceivableFromRefund(refundTx) {
  if (!refundTx.notes.startsWith('Préstamo cobrado ')) return null;
  const original = state.transactions.find(t =>
    t.payee === refundTx.payee
    && t.account_id === refundTx.account_id
    && Math.abs(Number(t.amount) || 0) === Math.abs(Number(refundTx.amount) || 0)
  );
  if (original) {
    original.is_receivable = true;
    return original;
  }
  return null;
}

// ── RENDER TABLE ─────────────────────────────────────────────
function renderTransactions() {
  const tbody  = document.getElementById('tx-table-body');
  const search = document.getElementById('tx-search-input').value.toLowerCase();
  tbody.innerHTML = '';

  let filtered = [...state.transactions];

  // Filter out split children (they render under their parent)
  filtered = filtered.filter(t => !t.split_parent_id);

  // Show/hide account column
  const isSingleAccount = state.selectedAccounts.length === 1
    || (state.currentView !== 'all' && state.currentView !== 'multi' && !state.currentView.startsWith('type-') && state.currentView !== 'receivables');
  document.querySelector('.ledger')?.classList.toggle('hide-account-col', isSingleAccount);
  const colCount = getColCount();
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
          case 'closing_period': {
            const txAcc = state.accounts.find(a => a.id === tx.account_id);
            if (!txAcc || txAcc.type !== 'credit_card' || !txAcc.card_schedule) return false;
            const periodKey = getClosingPeriodKey(tx.date, txAcc.card_schedule);
            const periodLabel = getClosingPeriodMonthLabel(periodKey).toLowerCase();
            const keyMatch = periodKey.toLowerCase().includes(val);
            const labelMatch = periodLabel.toLowerCase().includes(val);
            if (f.operator === 'contains') return keyMatch || labelMatch;
            if (f.operator === 'equals') return periodKey === f.value || periodLabel === f.value.toLowerCase();
            if (f.operator === 'not_equals') return periodKey !== f.value && periodLabel !== f.value.toLowerCase();
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

  // Apply viewPrefs: hide future transactions if disabled
  const vp = state.settings.viewPrefs || {};
  const hideFutures = vp.showFutureTxs === false;
  const visibleOutOfPeriodFuture = hideFutures ? [] : outOfPeriodFuture;

  // Separate CC transactions for closing groups
  const showClosing = vp.showClosingRows !== false;
  const ccAccIds = new Set(state.accounts.filter(a => a.type === 'credit_card').map(a => a.id));
  const ccTx = showClosing ? inPeriodRows.filter(tx => ccAccIds.has(tx.account_id)) : [];
  const nonCCTx = showClosing ? inPeriodRows.filter(tx => !ccAccIds.has(tx.account_id)) : inPeriodRows;

  // Determine if showing multiple CC accounts (need to distinguish by name)
  const ccInView = [...ccAccIds].filter(id => ccTx.some(tx => tx.account_id === id)
    || visibleOutOfPeriodFuture.some(tx => tx.account_id === id));
  const showAccountInLabel = !isSingleAccount && ccInView.length > 1;

  // Group ALL CC transactions (present + future) by billing period
  const ccGroups = {};
  const ungroupedCcIds = new Set();
  const addTxToCCGroups = (tx) => {
    const acc = state.accounts.find(a => a.id === tx.account_id);
    if (!acc) return;
    // Use closing_period if set (payment txs), otherwise compute from date
    const periodKey = tx.closing_period || getClosingPeriodKey(tx.date, acc.card_schedule);
    if (!periodKey) {
      ungroupedCcIds.add(tx.id);
      return;
    }
    const key = showAccountInLabel ? periodKey + '|' + tx.account_id : periodKey;
    if (!ccGroups[key]) {
      const label = getClosingPeriodMonthLabel(periodKey) + (showAccountInLabel ? ' · ' + acc.name : '');
      ccGroups[key] = { key, txs: [], total: 0, label, period: periodKey };
    }
    ccGroups[key].txs.push(tx);
    // Exclude payment txs and excluded txs from total
    const isPayment = (tx.tags || []).includes('Pago de tarjeta');
    if (!isPayment && !isTxExcluded(tx)) {
      const accCur = acc.currency || (state.settings.currency || 'UYU');
      const converted = convertCurrency(Number(tx.amount) || 0, accCur, state.settings.currency || 'UYU');
      ccGroups[key].total += converted !== null ? converted : (Number(tx.amount) || 0);
    }
  };
  if (showClosing) {
    ccTx.forEach(addTxToCCGroups);
    visibleOutOfPeriodFuture.filter(tx => ccAccIds.has(tx.account_id)).forEach(addTxToCCGroups);
  }
  const sortedCcGroups = Object.values(ccGroups).sort((a, b) => b.key.localeCompare(a.key));

  // Count badge only counts in-period present rows
  document.getElementById('tx-count-badge').textContent = inPeriodRows.length;

  if (inPeriodRows.length === 0 && visibleOutOfPeriodFuture.length === 0 && outOfPeriodPresent.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${colCount}">No hay movimientos registrados.</td></tr>`;
    return;
  }

  const appendTxRow = (tx, closingPeriod) => {
    const acc       = state.accounts.find(a => a.id === tx.account_id);
    const isExpense = tx.amount < 0;
    const isSelected = state.selectedTxIds.has(tx.id);
    // A future tx shows normal (not dimmed) if it's within the closing period's month
    const isFutureRow = tx.is_future && (!closingPeriod || tx.date.substring(0, 7) !== closingPeriod);

    const tagPills = (tx.tags || []).filter(tag => tag !== 'Pago de tarjeta' && tag !== 'Oculto').map(tag => {
      const c = _tagColor(tag);
      return `<span class="tag-pill" style="background:${c.bg};color:${c.text};">#${tag}</span>`;
    }).join('');

    const excludedPill = isTxExcluded(tx) ? '<span class="tag-pill-excluded"><i data-lucide="eye-off"></i>Oculto</span>' : '';
    const hasPaymentTag = (tx.tags || []).includes('Pago de tarjeta');
    const paymentPill = hasPaymentTag ? '<span class="tag-pill-payment"><i data-lucide="credit-card"></i>Pago</span>' : '';
    const receivablePill = _getReceivablePill(tx);

    const notesHtml = tx.notes || '';
    const tagsHtml  = (tagPills || '') + excludedPill + paymentPill + receivablePill;

    const accCurrency = acc?.currency || state.settings.currency || 'UYU';
    const amtStyle = state.settings.amountStyle || 'default';
    const showSign = amtStyle !== 'no-sign';
    const showColor = amtStyle !== 'no-color';
    const amountVal   = isExpense
      ? (showSign ? '-' : '') + formatAccountCurrency(Math.abs(tx.amount), accCurrency)
      : (showSign ? '+' : '') + formatAccountCurrency(tx.amount, accCurrency);
    const amountClass = showColor ? (isExpense ? 'expense' : 'income') : 'amount-no-color';
    const amountTooltip = getConvertedTooltip(tx.amount, accCurrency);

    let payeeCellHtml = '';
    const hasSplitChildren = tx.split_group && !tx.split_parent_id && state.transactions.filter(t => t.split_parent_id === tx.id).length > 0;
    const isSplitParent = tx.split_group && !tx.split_parent_id;
    let hasChildrenVisible = false;

    if (isSplitParent) {
      const childCount = state.transactions.filter(t => t.split_parent_id === tx.id).length;
      const isOpen = isSplitChildrenOpen(tx.id);
      hasChildrenVisible = childCount > 0 && isOpen;

      const payeeName = tx.payee === 'Sin asignar'
        ? `<span class="payee-name" style="color:var(--text-lo);font-style:italic;">Sin asignar</span>`
        : `<span class="payee-name">${tx.payee}</span>`;

      if (hasSplitChildren) {
        payeeCellHtml = `<span class="split-parent-indicator">
          <button class="split-toggle-btn ${isOpen ? 'open' : ''}" onclick="event.stopPropagation();toggleSplitChildren('${tx.id}')" title="${isOpen ? 'Ocultar' : 'Mostrar'} divisiones"><i data-lucide="chevron-right"></i></button>
          ${payeeName}
          <span class="split-parent-split" onclick="event.stopPropagation();openSplitModal('${tx.id}')" title="Editar divisiones"><i data-lucide="scissors"></i> ${childCount}</span>
        </span>`;
      } else {
        payeeCellHtml = `<span class="split-parent-indicator">
          ${payeeName}
          <span class="split-parent-split" onclick="event.stopPropagation();openSplitModal('${tx.id}')" title="Dividir transacción"><i data-lucide="scissors"></i></span>
        </span>`;
      }
    } else {
      payeeCellHtml = tx.payee === 'Sin asignar'
        ? `<span class="payee-name" style="color:var(--text-lo);font-style:italic;">Sin asignar</span>`
        : `<span class="payee-name">${tx.payee}</span>`;
    }

    let actionsHtml = `
      <div class="row-action-dropdown">
        <button class="row-action" onclick="event.stopPropagation();toggleRowMenu(this)" title="Acciones">
          <i data-lucide="more-horizontal"></i>
        </button>
        <div class="row-action-menu" style="display:none;">
          ${tx.is_receivable ? `<button class="ram-item" onclick="markAsCollected('${tx.id}');closeRowMenu(this)"><i data-lucide="check-square"></i> Cobrado</button>` : ''}
          ${hasSplitChildren ? `<button class="ram-item" onclick="openSplitModal('${tx.id}');closeRowMenu(this)"><i data-lucide="scissors"></i> Editar divisiones</button><button class="ram-item" onclick="mergeSplitChildren('${tx.id}');closeRowMenu(this)"><i data-lucide="merge"></i> Reunir</button>` : `<button class="ram-item" onclick="openSplitModal('${tx.id}');closeRowMenu(this)"><i data-lucide="scissors"></i> Dividir</button>`}
          <button class="ram-item" onclick="openTransactionModal('${tx.id}');closeRowMenu(this)"><i data-lucide="pencil"></i> Editar</button>
          <button class="ram-item danger" onclick="deleteTransaction('${tx.id}')"><i data-lucide="trash-2"></i> Eliminar</button>
        </div>
      </div>
    `;

    const tr = document.createElement('tr');
    tr.dataset.txId = tx.id;
    if (isSelected) tr.classList.add('selected');
    if (isFutureRow) tr.classList.add('tx-future');
    if (hasChildrenVisible) tr.classList.add('has-children-visible');

    tr.innerHTML = `
      <td class="tx-cell"><input type="checkbox" class="tx-checkbox" data-tx-id="${tx.id}" ${isSelected ? 'checked' : ''} onclick="handleTxRowClick('${tx.id}', event)"></td>
      <td class="date-cell editable-cell" data-field="date" title="Click para editar">${formatDate(tx.date)}</td>
      <td class="col-account account-cell editable-cell" data-field="account_id" title="Click para editar">${acc ? acc.name : '—'}</td>
      <td class="payee-cell editable-cell" data-field="payee" title="Click para editar">${payeeCellHtml}</td>
      <td class="cuota-cell">${tx.installment_total ? `<span class="cuota-badge" title="Total: ${formatAccountCurrency(tx.installment_full_amount, accCurrency)}">${tx.installment_index}/${tx.installment_total}</span>` : ''}</td>
      <td class="notes-cell editable-cell" data-field="notes" title="Click para editar">${notesHtml}</td>
      <td class="tags-cell editable-cell" data-field="tags" title="Click para editar"><div class="tags-wrap">${tagsHtml}</div></td>
      <td class="category-cell editable-cell" data-field="category_name" title="Click para editar">${tx.category_name === 'Sin asignar' ? '<span style="color:var(--text-lo);font-style:italic;">Sin asignar</span>' : getCategoryIcon(tx.category_name) + ' ' + (tx.category_name || 'Otros')}</td>
      <td class="amount-cell ${amountClass} editable-cell" data-field="amount" title="${amountTooltip ? amountTooltip + ' — Click para editar' : 'Click para editar'}">${amountVal}</td>
      <td class="actions-cell">${actionsHtml}</td>
    `;
    tbody.appendChild(tr);

    if (tx.split_group && !tx.split_parent_id && isSplitChildrenOpen(tx.id)) {
      const children = state.transactions.filter(t => t.split_parent_id === tx.id);
      children.forEach((child, idx) => {
        appendSplitChildRow(child, tx, idx === children.length - 1);
      });
    }

    if (!isFutureRow) {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.tx-checkbox, .editable-cell, .row-action-dropdown, button, a, select, .cuota-cell')) return;
        handleTxRowClick(tx.id, e);
      });
      tr.querySelectorAll('.editable-cell').forEach(cell => {
        cell.addEventListener('click', e => {
          if (_ie && _ie.cell === cell) return;
          e.stopPropagation();
          const field = cell.dataset.field;
          const opts = getEditOptions(field, tx);
          if (!opts) return;
          startInlineEdit(cell, tx.id, field, opts.type, opts);
        });
        cell.addEventListener('keydown', function _cellNavKeydown(e) {
          if (_ie) return;
          if (e.key !== 'Enter' && e.key !== 'Tab') return;
          e.preventDefault();
          const dirRow = e.key === 'Enter' ? (e.shiftKey ? -1 : 1) : 0;
          const dirCol = e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0;
          _navigateFromInline(tx.id, cell.dataset.field, dirRow, dirCol);
        });
      });
    }
  };

  const appendSplitChildRow = (child, parent, isLast) => {
    const acc = state.accounts.find(a => a.id === child.account_id);
    const isExpense = child.amount < 0;
    const accCurrency = acc?.currency || state.settings.currency || 'UYU';
    const amtStyle = state.settings.amountStyle || 'default';
    const showSign = amtStyle !== 'no-sign';
    const showColor = amtStyle !== 'no-color';
    const amountVal = isExpense
      ? (showSign ? '-' : '') + formatAccountCurrency(Math.abs(child.amount), accCurrency)
      : (showSign ? '+' : '') + formatAccountCurrency(child.amount, accCurrency);
    const amountClass = showColor ? (isExpense ? 'expense' : 'income') : 'amount-no-color';

    const tagPills = (child.tags || []).filter(tag => tag !== 'Pago de tarjeta' && tag !== 'Oculto').map(tag => {
      const c = _tagColor(tag);
      return `<span class="tag-pill" style="background:${c.bg};color:${c.text};">#${tag}</span>`;
    }).join('');
    const excludedPill = isTxExcluded(child) ? '<span class="tag-pill-excluded"><i data-lucide="eye-off"></i>Oculto</span>' : '';
    const hasPaymentTag = (child.tags || []).includes('Pago de tarjeta');
    const paymentPill = hasPaymentTag ? '<span class="tag-pill-payment"><i data-lucide="credit-card"></i>Pago</span>' : '';
    const receivablePill = _getReceivablePill(child);
    const notesHtml = child.notes || '';
    const tagsHtml = (tagPills || '') + excludedPill + paymentPill + receivablePill;

    let childActionsHtml = `
      <div class="row-action-dropdown">
        <button class="row-action" onclick="event.stopPropagation();toggleRowMenu(this)" title="Acciones">
          <i data-lucide="more-horizontal"></i>
        </button>
        <div class="row-action-menu" style="display:none;">
          <button class="ram-item" onclick="openTransactionModal('${child.id}');closeRowMenu(this)"><i data-lucide="pencil"></i> Editar</button>
          <button class="ram-item danger" onclick="deleteTransaction('${child.id}')"><i data-lucide="trash-2"></i> Eliminar</button>
        </div>
      </div>
    `;

    const tr = document.createElement('tr');
    tr.dataset.txId = child.id;
    tr.classList.add('split-child-row');
    if (isLast) tr.classList.add('split-child-last');

    const isChildSelected = state.selectedTxIds.has(child.id);
    if (isChildSelected) tr.classList.add('selected');

    tr.innerHTML = `
      <td class="tx-cell">
        <input type="checkbox" class="tx-checkbox" data-tx-id="${child.id}"
               ${isChildSelected ? 'checked' : ''}
               onclick="handleTxRowClick('${child.id}', event)">
      </td>
      <td class="date-cell split-child-indent"></td>
      ${isSingleAccount ? '' : `<td class="col-account account-cell editable-cell" data-field="account_id" title="Click para editar">${acc ? acc.name : '—'}</td>`}
      <td class="payee-cell">
        ${child.payee || parent.payee || ''}
      </td>
      <td class="cuota-cell"></td>
      <td class="notes-cell editable-cell" data-field="notes" title="Click para editar">
        ${notesHtml ? `<span class="split-child-note-text">${notesHtml}</span>` : ''}
      </td>
      <td class="tags-cell editable-cell" data-field="tags" title="Click para editar">
        <div class="tags-wrap">${tagsHtml}</div>
      </td>
      <td class="category-cell editable-cell" data-field="category_name" title="Click para editar">
        ${child.category_name === 'Sin asignar' ? '<span style="color:var(--text-lo);font-style:italic;">Sin asignar</span>' : getCategoryIcon(child.category_name) + ' ' + (child.category_name || 'Otros')}
      </td>
      <td class="amount-cell ${amountClass} editable-cell" data-field="amount" title="Click para editar">
        ${amountVal}
      </td>
      <td class="actions-cell">${childActionsHtml}</td>
    `;
    tbody.appendChild(tr);

    tr.addEventListener('click', e => {
      if (e.target.closest('.tx-checkbox, .editable-cell, .row-action-dropdown, button, a, select, .cuota-cell')) return;
      handleTxRowClick(child.id, e);
    });

    tr.querySelectorAll('.editable-cell').forEach(cell => {
      cell.addEventListener('click', e => {
        if (_ie && _ie.cell === cell) return;
        e.stopPropagation();
        const field = cell.dataset.field;
        const opts = getEditOptions(field, child);
        if (!opts) return;
        startInlineEdit(cell, child.id, field, opts.type, opts);
      });
      cell.addEventListener('keydown', function _cellNavKeydown(e) {
        if (_ie) return;
        if (e.key !== 'Enter' && e.key !== 'Tab') return;
        e.preventDefault();
        const dirRow = e.key === 'Enter' ? (e.shiftKey ? -1 : 1) : 0;
        const dirCol = e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0;
        _navigateFromInline(child.id, cell.dataset.field, dirRow, dirCol);
      });
    });
  };

  // Render future rows — CC are already in closing groups, only show non-CC futures (and ungrouped CC futures)
  const futureNonCC = visibleOutOfPeriodFuture.filter(tx => !ccAccIds.has(tx.account_id) || ungroupedCcIds.has(tx.id));
  if (futureNonCC.length > 0) {
    const groupKey = 'future-group-open';
    const isOpen = sessionStorage.getItem(groupKey) === 'true';

    const headerTr = document.createElement('tr');
    headerTr.className = 'future-group-row';
    const headerTd = document.createElement('td');
    headerTd.colSpan = colCount;
    headerTd.innerHTML = `
      <div class="future-group-header">
        <span class="future-group-arrow ${isOpen ? 'open' : ''}"><i data-lucide="chevron-right"></i></span>
        <span class="future-group-label">Cuotas futuras</span>
        <span class="future-group-count">${futureNonCC.length} mov.</span>
      </div>
    `;
    headerTr.addEventListener('click', () => {
      const nowOpen = sessionStorage.getItem(groupKey) === 'true';
      sessionStorage.setItem(groupKey, (!nowOpen).toString());
      renderTransactions();
    });
    tbody.appendChild(headerTr);

    if (isOpen) {
      futureNonCC.forEach(tx => appendTxRow(tx, null));
    }
  }

  // Render in-period rows: closing groups for CC + normal rows
  if (showClosing && sortedCcGroups.length > 0) {
    // Render CC closing groups (with both present and future txs inside)
    sortedCcGroups.forEach(group => {
      const isOpen = isClosingGroupOpen(group.key);
      const groupAccountId = group.txs[0]?.account_id || '';
      const paid = isClosingPaid(group.key, group.total, groupAccountId);
      const status = getClosingStatus(group.period, groupAccountId);
      const totalHtml = formatCurrency(group.total);


      const isCurrentPeriod = group.period === getCurrentYearMonth();
      const payIcon = paid ? 'calendar-check' : (isCurrentPeriod ? 'calendar-1' : (status ? status.icon : 'circle'));
      const payOpacity = '1';
      const payColor = paid ? 'var(--positive)' : (isCurrentPeriod ? 'var(--text-mid)' : (status ? status.color : 'var(--text-lo)'));
      const statusDetail = status && status.detail ? ` · ${status.detail}` : '';
      const payTitle = paid
        ? `Pagado${statusDetail} — click para marcar como no pagado`
        : (status ? `${status.label}${statusDetail}` : 'Pagar');
      const payAction = paid
        ? `onToggleClosingPay('${group.period}','${groupAccountId}','${group.key}',${group.total})`
        : (status && status.status !== 'not_closed' && status.status !== 'no_schedule')
          ? `openPaymentModal('${group.period}','${groupAccountId}')`
          : '';

      const periodRange = getPeriodDateRange(groupAccountId, group.period);
      const headerTr = document.createElement('tr');
      headerTr.className = 'closing-group-row';
      const headerTd = document.createElement('td');
      headerTd.colSpan = colCount;
      headerTd.innerHTML = `
        <div class="closing-group-header">
          <span class="closing-group-arrow ${isOpen ? 'open' : ''}"><i data-lucide="chevron-right"></i></span>
          <span class="closing-group-label" title="${periodRange}">Cierre ${group.label}</span>
          ${isOpen ? `<span class="closing-group-meta-count">${group.txs.length} mov.</span>` : ''}
          <span class="closing-group-total">${totalHtml}</span>
          <button class="closing-paid-btn ${paid ? 'paid' : ''}" ${payAction ? `onclick="event.stopPropagation();${payAction}"` : 'disabled'} style="opacity:${payOpacity};color:${payColor}" title="${payTitle}">
            <i data-lucide="${payIcon}"></i>
          </button>
          <button class="closing-more-btn" onclick="event.stopPropagation();toggleClosingMenu(this,'${group.key}','${groupAccountId}','${group.period}')" title="Acciones">
            <i data-lucide="more-horizontal"></i>
          </button>
        </div>
      `;
      headerTr.addEventListener('click', () => {
        toggleClosingGroup(group.key);
        renderTransactions();
      });
      headerTd.style.cursor = 'pointer';
      headerTr.appendChild(headerTd);
      tbody.appendChild(headerTr);

      if (isOpen) {
        const sorted = [...group.txs].sort((a, b) => {
          // When sorting by date, interleave future + present by date
          if (state.sortColumn === 'date') {
            const dir = state.sortDirection === 'asc' ? 1 : -1;
            return dir * (a.date || '').localeCompare(b.date || '');
          }
          // Default: future first
          return (b.is_future ? 1 : 0) - (a.is_future ? 1 : 0);
        });
        // All txs in group should be from same account (one CC)
        const groupAccountId = group.txs[0]?.account_id;
        sorted.forEach(tx => appendTxRow(tx, group.period));
      }
    });
    // Render non-CC in-period rows
    nonCCTx.forEach(tx => appendTxRow(tx, null));
    // Render CC transactions without a closing schedule as normal rows
    inPeriodRows.filter(tx => ungroupedCcIds.has(tx.id)).forEach(tx => appendTxRow(tx, null));
  } else {
    // No closing groups — render all as normal
    inPeriodRows.forEach(tx => appendTxRow(tx, null));
  }

  // Render out-of-period present group (collapsible, only when period filter is active)
  if (hasPeriodFilter && outOfPeriodPresent.length > 0) {
    const groupKey  = 'oop-group-open';
    const isOpen    = sessionStorage.getItem(groupKey) === 'true';

    const headerTr  = document.createElement('tr');
    headerTr.className = 'future-group-row oop-group-row';
    const headerTd  = document.createElement('td');
    headerTd.colSpan = colCount;
    const headerDiv = document.createElement('div');
    headerDiv.className = 'future-group-header';
    headerDiv.innerHTML = `
      <span class="future-group-arrow ${isOpen ? 'open' : ''}"><i data-lucide="chevron-right"></i></span>
      <span>Fuera del período</span>
      <span class="future-group-count" style="margin-left:auto;">${outOfPeriodPresent.length}</span>
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
      outOfPeriodPresent.forEach(tx => appendTxRow(tx, null));
    }
  }

  updateSelectAllCheckbox();
  updateSelectionBar();
  updateSortIndicators();
  applyViewPrefs();
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

// ── SPLIT TRANSACTIONS ────────────────────────────────────────
let _splitTxId = null;

const SPLIT_COLORS = ['#5b52f5','#e6b800','#22c55e','#ef4444','#06b6d4','#f472b6','#8b5cf6','#f97316'];

function parseLocalNumber(val) {
  return parseFloat((val || '').replace(/[^\d,.\-]/g, '').replace(',', '.')) || 0;
}

function openSplitModal(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;
  _splitTxId = txId;

  const totalAbs = Math.abs(tx.amount);
  const acc = state.accounts.find(a => a.id === tx.account_id);
  const accCurrency = acc?.currency || state.settings.currency || 'UYU';
  document.getElementById('split-total-val').textContent = formatAccountCurrency(totalAbs, accCurrency);

  const existingChildren = state.transactions.filter(t => t.split_parent_id === txId);
  const wrap = document.getElementById('split-rows-wrap');
  wrap.innerHTML = '';

  if (existingChildren.length > 0) {
    existingChildren.forEach(child =>
      addSplitRow(child.notes || '', Math.abs(child.amount), child.tags || [], child.category_name || '')
    );
  } else {
    const parentTags = tx.tags || [];
    const parentCat = tx.category_name || '';
    addSplitRow('', totalAbs, [...parentTags], parentCat);
    addSplitRow('', 0, [...parentTags], parentCat);
  }

  recalcSplitProgress();
  document.getElementById('split-modal').classList.add('open');
  lucide.createIcons();
}

function closeSplitModal() {
  document.getElementById('split-modal').classList.remove('open');
  _splitTxId = null;
  _closeDD();
  const catDD = document.getElementById('wallet-split-cat-dd');
  if (catDD) catDD.remove();
}

function addSplitRow(notes = '', amount = 0, tags = [], categoryName = '') {
  const wrap = document.getElementById('split-rows-wrap');
  const idx = wrap.children.length + 1;

  const row = document.createElement('div');
  row.className = 'split-row';
  row.dataset.idx = idx;

  const amountVal = amount ? formatNoTrailingZeros(amount) : '';

  row.innerHTML = `
    <div class="split-row-main">
      <span class="split-row-num">${idx}</span>
      <input class="split-amount-input" type="text" inputmode="decimal"
             placeholder="0,00" value="${amountVal}" aria-label="Monto" oninput="onSplitAmountInput(this)">
      <input class="split-notes-input" type="text" placeholder="Nota…" value="${notes}" aria-label="Nota">
      <div class="split-tags-cell" data-tags='${JSON.stringify(tags)}'></div>
      <div class="split-cat-wrap">
        <input class="split-cat-input" type="text" placeholder="Categoría…" value="${categoryName}" aria-label="Categoría" autocomplete="off">
      </div>
      <button class="split-row-remove" onclick="removeSplitRow(this)" title="Quitar">
        <i data-lucide="x"></i>
      </button>
    </div>
  `;

  wrap.appendChild(row);
  initSplitTags(row.querySelector('.split-tags-cell'));
  initSplitCategory(row);
  recalcSplitProgress();
  lucide.createIcons();
}

function initSplitTags(cell) {
  renderSplitTagPills(cell);
  cell.addEventListener('click', e => {
    const removeBtn = e.target.closest('.remove-split-tag');
    if (removeBtn) {
      const tag = removeBtn.dataset.tag;
      const tags = JSON.parse(cell.dataset.tags || '[]');
      cell.dataset.tags = JSON.stringify(tags.filter(t => t !== tag));
      renderSplitTagPills(cell);
      return;
    }
    if (e.target.closest('.split-tag-add')) {
      openSplitTagDD(cell);
    }
  });
}

function renderSplitTagPills(cell) {
  const tags = JSON.parse(cell.dataset.tags || '[]');
  cell.innerHTML = '';
  tags.forEach(tag => {
    const c = _tagColor(tag);
    const pill = document.createElement('span');
    pill.className = 'split-tag-pill';
    pill.style.background = c.bg;
    pill.style.color = c.text;
    pill.innerHTML = `#${tag}<span class="remove-split-tag" data-tag="${tag}">\u00d7</span>`;
    cell.appendChild(pill);
  });
  const addBtn = document.createElement('span');
  addBtn.className = 'split-tag-add';
  addBtn.innerHTML = '<i data-lucide="plus"></i>';
  cell.appendChild(addBtn);
  lucide.createIcons();
}

function openSplitTagDD(cell) {
  const current = new Set(JSON.parse(cell.dataset.tags || '[]'));
  const allTags = state.predefined.tags.map(t => typeof t === 'string' ? t : t.name);
  const available = allTags.filter(t => !current.has(t));

  _closeDD();
  const dd = document.createElement('div');
  dd.className = 'comfy-dropdown open';
  dd.style.position = 'fixed';
  dd.style.zIndex = '9999';

  const inputRow = document.createElement('div');
  inputRow.className = 'comfy-dropdown-input-row';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'comfy-dropdown-input';
      input.placeholder = 'nueva etiqueta…';
      input.setAttribute('aria-label', 'Nueva etiqueta');
  inputRow.appendChild(input);
  dd.appendChild(inputRow);

  const listWrap = document.createElement('div');
  listWrap.className = 'comfy-dropdown-list';
  dd.appendChild(listWrap);

  const renderList = (filter = '') => {
    listWrap.innerHTML = '';
    const q = filter.toLowerCase();
    const filtered = available.filter(t => !current.has(t) && t.toLowerCase().includes(q));

    if (filter) {
      const exact = available.find(t => t.toLowerCase() === q);
      const createRow = document.createElement('div');
      createRow.className = 'comfy-dropdown-item';
      createRow.innerHTML = `<span>+ "${exact || filter}"</span><span class="check">\u21b5</span>`;
      createRow.addEventListener('mousedown', e => {
        e.preventDefault();
        const name = filter.trim();
        if (name && !current.has(name)) {
          const tagNames = state.predefined.tags.map(t => typeof t === 'string' ? t : t.name);
          if (!tagNames.includes(name)) {
            state.predefined.tags.push({ name, color: getRandomTagColor() });
            saveData('predefined');
          }
          current.add(name);
          cell.dataset.tags = JSON.stringify([...current]);
          renderSplitTagPills(cell);
          _closeDD();
        }
      });
      listWrap.appendChild(createRow);
    }

    if (!filtered.length && !filter) {
      const empty = document.createElement('div');
      empty.className = 'comfy-dropdown-empty';
      empty.textContent = 'Sin sugerencias';
      listWrap.appendChild(empty);
    } else {
      filtered.forEach(item => {
        const row = document.createElement('div');
        row.className = 'comfy-dropdown-item';
        row.innerHTML = `<span>#${item}</span><span class="check">\u2713</span>`;
        row.addEventListener('mousedown', e => {
          e.preventDefault();
          current.add(item);
          cell.dataset.tags = JSON.stringify([...current]);
          renderSplitTagPills(cell);
          _closeDD();
        });
        listWrap.appendChild(row);
      });
    }
  };

  renderList();

  input.addEventListener('input', () => renderList(input.value.trim()));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { _closeDD(); return; }
    const items = [...listWrap.querySelectorAll('.comfy-dropdown-item')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      let idx = items.findIndex(el => el.classList.contains('active'));
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      idx = idx === -1 ? (dir > 0 ? 0 : items.length - 1) : Math.max(0, Math.min(idx + dir, items.length - 1));
      items.forEach((el, i) => el.classList.toggle('active', i === idx));
      items[idx]?.scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const active = items.find(el => el.classList.contains('active'));
      if (active) { active.click(); return; }
      const name = input.value.trim();
      if (name && !current.has(name)) {
        const tagNames = state.predefined.tags.map(t => typeof t === 'string' ? t : t.name);
        if (!tagNames.includes(name)) {
          state.predefined.tags.push({ name, color: getRandomTagColor() });
          saveData('predefined');
        }
        current.add(name);
        cell.dataset.tags = JSON.stringify([...current]);
        renderSplitTagPills(cell);
      }
      _closeDD();
    }
  });

  document.body.appendChild(dd);
  dd.id = 'wallet-dd';
  _positionDD(dd, cell);
  input.focus();
}

function initSplitCategory(row) {
  const input = row.querySelector('.split-cat-input');
  if (!input) return;

  const categories = state.predefined.categories;

  const renderDD = (filter = '') => {
    let dd = document.getElementById('wallet-split-cat-dd');
    if (!dd) {
      dd = document.createElement('div');
      dd.className = 'searchable-dropdown open';
      dd.id = 'wallet-split-cat-dd';
      dd.style.position = 'fixed';
      dd.style.zIndex = '9999';
      const ul = document.createElement('ul');
      dd.appendChild(ul);
      document.body.appendChild(dd);
    }
    const ul = dd.querySelector('ul');
    ul.innerHTML = '';
    const q = filter.toLowerCase();
    categories.filter(c => {
      const name = typeof c === 'string' ? c : c.name;
      return name.toLowerCase().includes(q);
    }).forEach(c => {
      const name = typeof c === 'string' ? c : c.name;
      const icon = typeof c === 'string' ? null : c.icon;
      const li = document.createElement('li');
      li.innerHTML = icon ? `<span class="cat-icon"><i data-lucide="${icon}"></i></span>${name}` : name;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = name;
        dd.remove();
      });
      ul.appendChild(li);
    });
    if (!ul.children.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Sin resultados';
      ul.appendChild(li);
    }
    _positionDD(dd, input);
    lucide.createIcons();
  };

  input.addEventListener('focus', () => renderDD(input.value));
  input.addEventListener('blur', () => setTimeout(() => {
    const dd = document.getElementById('wallet-split-cat-dd');
    if (dd) dd.remove();
  }, 150));
  input.addEventListener('input', () => renderDD(input.value));
  input.addEventListener('keydown', e => {
    const dd = document.getElementById('wallet-split-cat-dd');
    if (!dd) return;
    const items = [...dd.querySelectorAll('li:not(.empty)')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      let idx = items.findIndex(el => el.classList.contains('active'));
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      idx = idx === -1 ? (dir > 0 ? 0 : items.length - 1) : Math.max(0, Math.min(idx + dir, items.length - 1));
      items.forEach((el, i) => el.classList.toggle('active', i === idx));
      items[idx]?.scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const active = items.find(el => el.classList.contains('active'));
      if (active) { active.click(); return; }
      dd.remove();
    }
    if (e.key === 'Escape') {
      dd.remove();
    }
  });
}

function removeSplitRow(btn) {
  const wrap = document.getElementById('split-rows-wrap');
  if (wrap.children.length <= 1) return;

  const row = btn.closest('.split-row');
  const removedAmount = parseLocalNumber(row.querySelector('.split-amount-input').value) || 0;
  const isLastRow = row === wrap.lastElementChild;
  row.remove();
  renumberSplitRows();

  if (!isLastRow && wrap.children.length > 0 && removedAmount > 0) {
    const lastInput = wrap.lastElementChild.querySelector('.split-amount-input');
    const currentLast = parseLocalNumber(lastInput.value) || 0;
    lastInput.value = formatNoTrailingZeros(currentLast + removedAmount);
  }
  recalcSplitProgress();
}

function renumberSplitRows() {
  [...document.getElementById('split-rows-wrap').children].forEach((row, i) => {
    row.dataset.idx = i + 1;
    const num = row.querySelector('.split-row-num');
    if (num) num.textContent = i + 1;
  });
}

function distributeEqually() {
  const wrap = document.getElementById('split-rows-wrap');
  const rows = [...wrap.children];
  const tx = state.transactions.find(t => t.id === _splitTxId);
  if (!tx || rows.length < 2) return;
  const totalAbs = Math.abs(tx.amount);
  const perPart = totalAbs / rows.length;
  rows.forEach((row, i) => {
    const input = row.querySelector('.split-amount-input');
    input.value = (i < rows.length - 1)
      ? formatNoTrailingZeros(perPart)
      : formatNoTrailingZeros(totalAbs - perPart * (rows.length - 1));
  });
  recalcSplitProgress();
}

function onSplitAmountInput(changedInput) {
  const wrap = document.getElementById('split-rows-wrap');
  const rows = [...wrap.children];
  if (rows.length < 2) return;
  const tx = state.transactions.find(t => t.id === _splitTxId);
  if (!tx) return;

  const totalAbs = Math.abs(tx.amount);
  const inputs = rows.map(r => r.querySelector('.split-amount-input'));
  const changedIdx = inputs.indexOf(changedInput);
  const lastIdx = rows.length - 1;

  if (changedIdx !== lastIdx) {
    const sumOthers = inputs
      .filter((_, i) => i !== lastIdx)
      .reduce((s, inp) => s + (parseLocalNumber(inp.value) || 0), 0);
    inputs[lastIdx].value = formatNoTrailingZeros(Math.max(0, totalAbs - sumOthers));
  }
  recalcSplitProgress();
}

function recalcSplitProgress() {
  const tx = state.transactions.find(t => t.id === _splitTxId);
  if (!tx) return;
  const acc = state.accounts.find(a => a.id === tx.account_id);
  const accCurrency = acc?.currency || state.settings.currency || 'UYU';
  const totalAbs = Math.abs(tx.amount);

  const rows = [...document.querySelectorAll('#split-rows-wrap .split-row')];
  const amounts = rows.map(r => parseLocalNumber(r.querySelector('.split-amount-input').value) || 0);
  const sum = amounts.reduce((s, v) => s + v, 0);
  const remaining = totalAbs - sum;
  const isOver = remaining < -0.01;

  const segWrap = document.getElementById('split-progress-segments');
  if (segWrap) {
    segWrap.innerHTML = '';
    rows.forEach((row, i) => {
      if (amounts[i] <= 0) return;
      const pct = totalAbs > 0 ? Math.min(100, (amounts[i] / totalAbs) * 100) : 0;
      const seg = document.createElement('div');
      seg.className = 'split-progress-segment' + (isOver ? ' over' : '');
      seg.style.width = pct + '%';
      if (!isOver) seg.style.background = SPLIT_COLORS[i % SPLIT_COLORS.length];
      segWrap.appendChild(seg);
      const num = row.querySelector('.split-row-num');
      if (num) num.style.color = isOver ? 'var(--negative)' : SPLIT_COLORS[i % SPLIT_COLORS.length];
    });
  }

  const el = document.getElementById('split-remaining');
  if (Math.abs(remaining) < 0.01) {
    el.textContent = '✓ Completo';
    el.className = 'split-total-remaining zero';
  } else if (remaining < -0.01) {
    el.textContent = `Excedido: ${formatAccountCurrency(Math.abs(remaining), accCurrency)}`;
    el.className = 'split-total-remaining excess';
  } else {
    el.textContent = `Falta: ${formatAccountCurrency(remaining, accCurrency)}`;
    el.className = 'split-total-remaining nonzero';
  }
}

function removeAllSplits() {
  const wrap = document.getElementById('split-rows-wrap');
  wrap.innerHTML = '';
  const tx = state.transactions.find(t => t.id === _splitTxId);
  if (!tx) return;
  addSplitRow('', Math.abs(tx.amount), [], tx.category_name || '');
  addSplitRow('', 0, [], '');
}

function saveSplits() {
  if (!_splitTxId) return;
  const tx = state.transactions.find(t => t.id === _splitTxId);
  if (!tx) return;
  const acc = state.accounts.find(a => a.id === tx.account_id);
  const accCurrency = acc?.currency || state.settings.currency || 'UYU';

  const rows = [...document.querySelectorAll('#split-rows-wrap .split-row')];
  const splits = rows.map(row => ({
    amount:        parseLocalNumber(row.querySelector('.split-amount-input').value) || 0,
    notes:         row.querySelector('.split-notes-input').value.trim(),
    tags:          JSON.parse(row.querySelector('.split-tags-cell')?.dataset.tags || '[]'),
    category_name: row.querySelector('.split-cat-input')?.value || ''
  })).filter(s => s.amount > 0);

  if (splits.length < 1) { closeSplitModal(); return; }

  const totalAbs = Math.abs(tx.amount);
  const sumAmounts = splits.reduce((s, sp) => s + sp.amount, 0);
  const diff = sumAmounts - totalAbs;

  if (Math.abs(diff) > 0.01) {
    const msg = diff > 0
      ? `La suma (${formatAccountCurrency(sumAmounts, accCurrency)}) supera el total por ${formatAccountCurrency(diff, accCurrency)}. ¿Guardar igual?`
      : `Faltan ${formatAccountCurrency(Math.abs(diff), accCurrency)} por asignar. ¿Guardar igual?`;
    showConfirm(msg, { title: 'Monto no coincide', confirmText: 'Guardar' })
      .then(ok => { if (ok) _commitSplits(tx, splits); });
  } else {
    _commitSplits(tx, splits);
  }
}

function _commitSplits(tx, splits) {
  state.transactions = state.transactions.filter(t => t.split_parent_id !== tx.id);
  tx.split_group = 'sg-' + tx.id;
  const sign = tx.amount < 0 ? -1 : 1;

  splits.forEach((sp, i) => {
    state.transactions.push({
      id:             'tx-' + Date.now() + '-s' + (i + 1),
      date:           tx.date,
      account_id:     tx.account_id,
      payee:          tx.payee,
      category_name:  sp.category_name || tx.category_name,
      amount:         sign * sp.amount,
      notes:          sp.notes,
      tags:           sp.tags,
      is_receivable:  false,
      due_date:       '',
      excluded:       false,
      split_group:    tx.split_group,
      split_parent_id: tx.id
    });
  });

  saveData('transactions');
  closeSplitModal();
  renderAll();
}

async function mergeSplitChildren(txId) {
  const childCount = state.transactions.filter(t => t.split_parent_id === txId).length;
  if (childCount === 0) return;
  const ok = await showConfirm(
    `¿Eliminar las ${childCount} divisiones? La transacción volverá a ser una sola.`,
    { title: 'Reunir divisiones', confirmText: 'Reunir' }
  );
  if (!ok) return;
  deleteSplitChildren(txId);
  saveData('transactions');
  renderAll();
}

function deleteSplitChildren(txId) {
  state.transactions = state.transactions.filter(t => t.split_parent_id !== txId);
  const parent = state.transactions.find(t => t.id === txId);
  if (parent) delete parent.split_group;
}

function toggleSplitChildren(txId) {
  const key = 'split-open-' + txId;
  sessionStorage.setItem(key, (sessionStorage.getItem(key) !== 'true').toString());
  renderTransactions();
}

function isSplitChildrenOpen(txId) {
  return sessionStorage.getItem('split-open-' + txId) === 'true';
}

// ── TRANSFER BETWEEN ACCOUNTS ──────────────────────────────────

function openTransferModal() {
  // Prevent browser autofill suggestions
  document.querySelectorAll('#transfer-modal input:not([type="checkbox"]):not([type="file"]), #transfer-modal select').forEach(el => el.setAttribute('autocomplete', 'off'));

  const fromSelect = document.getElementById('tf-account-from');
  const toSelect   = document.getElementById('tf-account-to');

  fromSelect.innerHTML = '';
  toSelect.innerHTML   = '';

  state.accounts.forEach(acc => {
    const opt1 = document.createElement('option');
    opt1.value = acc.id;
    opt1.textContent = acc.name;
    fromSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = acc.id;
    opt2.textContent = acc.name;
    toSelect.appendChild(opt2);
  });

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Seleccionar cuenta...';
  placeholder.disabled = true;
  placeholder.selected = true;
  toSelect.insertBefore(placeholder, toSelect.firstChild);

  const defaultFrom = (state.currentView && state.currentView !== 'all' && state.currentView !== 'multi' && state.currentView !== 'receivables' && state.accounts.some(a => a.id === state.currentView))
    ? state.currentView
    : state.accounts[0]?.id;
  if (defaultFrom) fromSelect.value = defaultFrom;

  document.getElementById('tf-date').valueAsDate = new Date();
  document.getElementById('tf-amount').value = '';
  document.getElementById('tf-notes').value = '';
  document.getElementById('tf-converted-note').style.display = 'none';

  renderTransferTagsChecklist();
  onTransferAccountChange();

  document.getElementById('transfer-modal').classList.add('open');
}

function renderTransferTagsChecklist(selectedTags) {
  const checklist = document.getElementById('tf-tags-checklist');
  const checked = selectedTags || [];
  checklist.innerHTML = '';
  state.predefined.tags.forEach(tag => {
    const tagName = typeof tag === 'string' ? tag : tag.name;
    const tagColor = typeof tag === 'string' ? null : (tag.color || null);
    const isChecked = checked.includes(tagName);
    const label = document.createElement('label');
    label.className = 'tag-check-label';
    const dotHtml = tagColor ? `<span class="tag-check-dot" style="background:${tagColor}"></span>` : '';
    label.innerHTML = `<input type="checkbox" name="tf-tags" value="${tagName}" ${isChecked ? 'checked' : ''}>${dotHtml}<span>#${tagName}</span>`;
    checklist.appendChild(label);
  });

  const addBtn = document.createElement('span');
  addBtn.className = 'tag-add-btn';
  addBtn.innerHTML = `<i data-lucide="plus"></i>Nueva`;
  addBtn.onclick = () => {
    const input = createTransferTagInput();
    addBtn.replaceWith(input);
    lucide.createIcons();
    input.querySelector('input').focus();
  };
  checklist.appendChild(addBtn);
  lucide.createIcons();
}

function getCheckedTransferTags() {
  return Array.from(document.querySelectorAll('input[name="tf-tags"]:checked')).map(c => c.value);
}

function createTransferTagInput() {
  const wrap = document.createElement('span');
  wrap.className = 'tag-add-input';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'nueva…';
  input.setAttribute('aria-label', 'Nueva etiqueta');
  const resize = () => { input.style.width = Math.max(5, input.value.length + 1) + 'ch'; };
  input.addEventListener('input', resize);
  wrap.appendChild(input);

  const commit = () => {
    const name = input.value.trim();
    const tagNames = state.predefined.tags.map(t => typeof t === 'string' ? t : t.name);
    if (name && !tagNames.includes(name)) {
      state.predefined.tags.push({ name, color: getRandomTagColor() });
      saveData('predefined');
    }
    const checked = getCheckedTransferTags();
    if (name && !checked.includes(name)) checked.push(name);
    renderTransferTagsChecklist(checked);
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') renderTransferTagsChecklist(getCheckedTransferTags());
  });
  input.addEventListener('blur', commit);

  return wrap;
}

function onTransferAccountChange() {
  const fromId    = document.getElementById('tf-account-from').value;
  const toSelect  = document.getElementById('tf-account-to');

  const prevTo = toSelect.value;
  toSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Seleccionar cuenta...';
  placeholder.disabled = true;
  toSelect.appendChild(placeholder);

  state.accounts.forEach(acc => {
    if (acc.id === fromId) return;
    const opt = document.createElement('option');
    opt.value = acc.id;
    opt.textContent = acc.name;
    toSelect.appendChild(opt);
  });

  if (prevTo && prevTo !== fromId && toSelect.querySelector(`option[value="${prevTo}"]`)) {
    toSelect.value = prevTo;
  } else {
    toSelect.value = '';
  }

  updateTransferConvertedNote();
}

function updateTransferConvertedNote() {
  const fromId  = document.getElementById('tf-account-from').value;
  const toId    = document.getElementById('tf-account-to').value;
  const fromAcc = state.accounts.find(a => a.id === fromId);
  const toAcc   = state.accounts.find(a => a.id === toId);
  const noteEl  = document.getElementById('tf-converted-note');
  const curEl   = document.getElementById('tf-amount-currency');

  if (!fromAcc || !toAcc) { noteEl.style.display = 'none'; return; }

  curEl.textContent = fromAcc.currency || state.settings.currency;

  if (fromAcc.currency === toAcc.currency || !fromAcc.currency || !toAcc.currency) {
    noteEl.style.display = 'none';
    return;
  }

  const rate = getExchangeRate(fromAcc.currency, toAcc.currency);
  if (rate === null) {
    noteEl.textContent = `No hay cotización disponible (${fromAcc.currency} → ${toAcc.currency})`;
    noteEl.style.display = 'block';
    return;
  }

  noteEl.textContent = `1 ${fromAcc.currency} ≈ ${rate.toFixed(4)} ${toAcc.currency}`;
  noteEl.style.display = 'block';
}

function closeTransferModal() {
  document.getElementById('transfer-modal').classList.remove('open');
  document.getElementById('transfer-form').reset();
}

async function handleTransferSubmit(event) {
  event.preventDefault();

  const fromId   = document.getElementById('tf-account-from').value;
  const toId     = document.getElementById('tf-account-to').value;
  const dateVal  = document.getElementById('tf-date').value;
  const rawInput = document.getElementById('tf-amount').value.trim();
  const notes    = document.getElementById('tf-notes').value.trim();

  if (!fromId || !toId) return;

  let rawAmount;
  if (isPlainNumber(rawInput)) {
    rawAmount = parseFloat(rawInput.replace(/[^\d,.\-]/g, '').replace(',', '.'));
  } else {
    const evalRes = evaluateExpression(rawInput, state.settings.decimals);
    rawAmount = (evalRes && evalRes.value !== null) ? evalRes.value : NaN;
  }

  if (isNaN(rawAmount) || rawAmount <= 0) return;

  const fromAcc = state.accounts.find(a => a.id === fromId);
  const toAcc   = state.accounts.find(a => a.id === toId);
  if (!fromAcc || !toAcc) return;

  const fromCurrency = fromAcc.currency || state.settings.currency;
  const toCurrency   = toAcc.currency   || state.settings.currency;

  const activeTags = [];
  document.querySelectorAll('input[name="tf-tags"]:checked').forEach(c => activeTags.push(c.value));

  const fromAmount = -Math.abs(rawAmount);
  const convertedAmount = convertCurrency(Math.abs(rawAmount), fromCurrency, toCurrency);

  const baseId = Date.now();
  const fromName = fromAcc.name;

  state.transactions.unshift({
    id: 'tx-' + baseId,
    date: dateVal,
    account_id: fromId,
    payee: fromName,
    category_name: 'Transferencias',
    amount: fromAmount,
    amount_expression: null,
    notes: notes,
    tags: activeTags,
    is_receivable: false,
    due_date: '',
    excluded: false
  });

  state.transactions.unshift({
    id: 'tx-' + baseId + '-t',
    date: dateVal,
    account_id: toId,
    payee: fromName,
    category_name: 'Transferencias',
    amount: convertedAmount,
    amount_expression: null,
    notes: notes,
    tags: activeTags,
    is_receivable: false,
    due_date: '',
    excluded: false
  });

  saveData('transactions');
  closeTransferModal();
  renderAll();
}

// ── CLOSING GROUP MENU ──────────────────────────────────────

function toggleClosingMenu(btn, key, accountId, periodKey) {
  closeClosingMenu();
  const paid = isClosingPaid(key, 0, accountId);
  const status = getClosingStatus(periodKey, accountId);
  const canPay = status && status.status !== 'not_closed' && status.status !== 'no_schedule';

  const dd = document.createElement('div');
  dd.className = 'closing-menu-dropdown';
  dd.innerHTML = `
    <button class="closing-menu-item" onclick="event.stopPropagation();selectClosingTxs('${key}','${accountId}');closeClosingMenu()">
      <i data-lucide="check-square"></i> Seleccionar transacciones
    </button>
    <button class="closing-menu-item" onclick="event.stopPropagation();openCcScheduleModal('${accountId}','${periodKey}');closeClosingMenu()">
      <i data-lucide="calendar-cog"></i> Configurar cierre y vencimiento
    </button>
    <button class="closing-menu-item ${canPay ? '' : 'disabled'}" onclick="event.stopPropagation();${canPay ? `openPaymentModal('${periodKey}','${accountId}');closeClosingMenu()` : ''}">
      <i data-lucide="${paid ? 'pencil' : 'credit-card'}"></i> ${paid ? 'Editar pago' : 'Pagar tarjeta'}
    </button>
  `;
  btn.parentElement.appendChild(dd);
  lucide.createIcons();

  const closeHandler = (e) => {
    if (!dd.contains(e.target) && !btn.contains(e.target)) {
      closeClosingMenu();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

function closeClosingMenu() {
  document.querySelectorAll('.closing-menu-dropdown').forEach(dd => dd.remove());
}

function selectClosingTxs(key, accountId) {
  const parts = key.split('|');
  const periodKey = parts[0];
  const accId = accountId || parts[1];
  if (!accId) return;
  state.selectedTxIds = new Set();
  state.transactions.forEach(tx => {
    if (tx.account_id !== accId) return;
    const txPeriod = tx.closing_period || (tx.date ? tx.date.substring(0, 7) : '');
    if (txPeriod === periodKey) state.selectedTxIds.add(tx.id);
  });
  renderTransactions();
  updateSelectAllCheckbox();
}

// ── SPLIT BUTTON DROPDOWN ──────────────────────────────────────

function toggleSplitDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('split-dropdown');
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) {
    document.addEventListener('click', closeSplitDropdownOnClickOutside);
  }
}

function closeSplitDropdown() {
  document.getElementById('split-dropdown').classList.remove('open');
  document.removeEventListener('click', closeSplitDropdownOnClickOutside);
}

function closeSplitDropdownOnClickOutside(e) {
  const wrap = document.getElementById('new-tx-split');
  if (wrap && !wrap.contains(e.target)) {
    closeSplitDropdown();
  }
}
