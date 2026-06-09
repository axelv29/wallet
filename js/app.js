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

  // Fetch exchange rates, then render
  fetchExchangeRates().then(() => {
    if (lastView === 'main' && lastFilter) {
      if (lastFilter.startsWith('multi:')) {
        const ids = lastFilter.replace('multi:', '').split(',').filter(Boolean);
        if (ids.length > 1) {
          state.selectedAccounts = ids;
          state.currentView = 'multi';
          showView('main');
          clearTxSelection();
          renderAll();
        } else {
          filterTransactions(ids[0] || 'all');
        }
      } else {
        filterTransactions(lastFilter);
      }
    } else {
      showView(lastView);
    }
    renderAll();
    updatePeriodLabel();
    initColumnResize();
    initCatIconPicker();
    initCsvDropzone();
    initTagsTrash();
  });

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

  // Close dropdowns on outside click
  document.addEventListener('click', e => {
    const dd = document.querySelector('.dash-section-dropdown');
    if (dd && !dd.contains(e.target)) dd.classList.remove('open');
    const accFilter = document.getElementById('dash-acc-filter');
    if (accFilter && !accFilter.contains(e.target)) accFilter.classList.remove('open');
    const pdd = document.getElementById('period-dropdown');
    if (pdd && pdd.classList.contains('open') && !e.target.closest('.period-selector')) {
      pdd.classList.remove('open');
    }
    const pcal = document.getElementById('period-calendar-popup');
    if (pcal && pcal.classList.contains('open') && !e.target.closest('.modal-card') && !e.target.closest('.period-option-custom')) {
      closePeriodCalendar();
    }
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

  if (name === 'dashboard') {
    dashSyncAccountsFromSidebar();
  }

  if (name !== 'main') {
    state.currentView = '';
    renderSidebar();
  }

  if (name === 'dashboard') {
    renderDashboard();
    applyTheme();
  }

  if (name === 'settings') {
    renderSettingsAccountsList();
    renderPredefinedLists();
    const keyInput = document.getElementById('set-gemini-key');
    if (keyInput) keyInput.value = state.settings.geminiKey || '';
    const curSel = document.getElementById('set-currency');
    if (curSel) curSel.value = state.settings.currency || 'ARS';
    const accCurSel = document.getElementById('acc-currency');
    if (accCurSel) accCurSel.value = state.settings.currency || 'ARS';
    const symCb = document.getElementById('set-show-symbol');
    if (symCb) symCb.checked = state.settings.showSymbol !== false;
    const decSel = document.getElementById('set-decimals');
    if (decSel) decSel.value = String(state.settings.decimals ?? 2);
    syncThemeUI();
  }
}

// ── THEME ─────────────────────────────────────────────────────
const SCHEMES = {
  'default':      { mode: 'light' },
  'ocean':        { mode: 'light' },
  'forest':       { mode: 'light' },
  'lavender':     { mode: 'light' },
  'default-dark': { mode: 'dark' },
  'midnight':     { mode: 'dark' },
  'ember':        { mode: 'dark' },
};

function toggleTheme() {
  const current = state.settings.colorScheme || 'default';
  const currentMode = SCHEMES[current]?.mode || 'light';
  const newMode = currentMode === 'light' ? 'dark' : 'light';
  // Find first scheme with the target mode
  const target = Object.entries(SCHEMES).find(([, v]) => v.mode === newMode);
  if (target) setColorScheme(target[0]);
}

function setColorScheme(name) {
  state.settings.colorScheme = name;
  state.settings.theme = SCHEMES[name]?.mode || 'light';
  localStorage.setItem('wallet_settings', JSON.stringify(state.settings));
  applyTheme();
  syncThemeUI();
}

function applyTheme() {
  const isDark = state.settings.theme === 'dark';
  document.body.classList.toggle('theme-dark', isDark);
  document.body.classList.toggle('theme-light', !isDark);

  // Remove all scheme classes, then apply current
  Object.keys(SCHEMES).forEach(s => document.body.classList.remove('scheme-' + s));
  const scheme = state.settings.colorScheme || 'default';
  if (scheme !== 'default') {
    document.body.classList.add('scheme-' + scheme);
  }

  const icon = isDark ? 'moon' : 'sun';
  ['theme-icon', 'theme-icon-settings', 'theme-icon-dash'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('data-lucide', icon);
  });
  lucide.createIcons();
}

function syncThemeUI() {
  const scheme = state.settings.colorScheme || 'default';
  document.querySelectorAll('.scheme-card').forEach(card => {
    card.classList.toggle('active', card.dataset.scheme === scheme);
  });
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
window.setColorScheme           = setColorScheme;
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
window.toggleAccountSelection   = toggleAccountSelection;
window.toggleTypeSelection      = toggleTypeSelection;
window.openAccountCreator        = openAccountCreator;
window.openImportModal           = openImportModal;
window.closeImportModal          = closeImportModal;
window.onAiFileSelected          = onAiFileSelected;
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
window.dashToggleSection         = dashToggleSection;
window.dashToggleDropdown        = dashToggleDropdown;
window.dashCloseDropdown         = dashCloseDropdown;
window.dashToggleAccDropdown     = dashToggleAccDropdown;
window.dashCloseAccDropdown      = dashCloseAccDropdown;
window.dashToggleAccountFilter   = dashToggleAccountFilter;
window.dashToggleAccountSidebar  = dashToggleAccountSidebar;
window.dashToggleAllAccounts     = dashToggleAllAccounts;
window.dashCloseDropdown         = dashCloseDropdown;
window.onCsvFileSelected         = onCsvFileSelected;
window.reparseCsv                = reparseCsv;
window.onCsvMappingChange        = onCsvMappingChange;
window.confirmCsvImport          = confirmCsvImport;
window.loadSampleCsv             = loadSampleCsv;
window.resetCsvImport            = resetCsvImport;
window.togglePeriodDropdown      = togglePeriodDropdown;
window.setPeriod                 = setPeriod;
window.openPeriodCalendar        = openPeriodCalendar;
window.closePeriodCalendar       = closePeriodCalendar;
window.switchCalMode             = switchCalMode;
window.calNavMonth               = calNavMonth;
window.calNavYear                = calNavYear;
window.applyPeriodCalendar       = applyPeriodCalendar;
window.clearPeriodCalendar       = clearPeriodCalendar;
window.calSelectDay              = calSelectDay;
window.calSelectMonth            = calSelectMonth;
window.exportBackup             = exportBackup;
window.openImportBackupModal    = openImportBackupModal;
window.closeImportBackupModal   = closeImportBackupModal;
window.onImportBackupFile       = onImportBackupFile;
window.confirmImportBackup      = confirmImportBackup;
window.confirmDeleteAllData     = confirmDeleteAllData;
window.clearBackupDates         = clearBackupDates;
