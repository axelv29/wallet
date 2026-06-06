// ═══════════════════════════════════════════════════════════════════════
//  app.js — Entry point principal
//  Contiene: bloque init (DOMContentLoaded), showView(), toggleTheme(),
//  applyTheme(), setupKeyboardShortcuts(), setTxSign(), initColumnResize(),
//  renderAll(), y todos los window.* bindings.
// ═══════════════════════════════════════════════════════════════════════

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

// ── RENDER ALL ────────────────────────────────────────────────
function renderAll() {
  renderSidebar();
  renderHeaderAndMetrics();
  renderTransactions();
  renderDashboard();
  updateSelectors();
  updateFilterBadge();
}

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

// ══════════════════════════════════════════════════════════════
//  GLOBAL BINDINGS — expone funciones al scope global (window)
//  para que funcionen desde atributos onclick en HTML.
// ══════════════════════════════════════════════════════════════

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
window.initColumnResize          = initColumnResize;
window.toggleCatIconPicker       = toggleCatIconPicker;
window.selectCatIcon             = selectCatIcon;
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
window.openGeminiImportModal     = openGeminiImportModal;
window.closeGeminiImportModal    = closeGeminiImportModal;
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
