// ═══════════════════════════════════════════════════════════════════════
//  app.js — Entry point principal
//  Contiene: bloque init (DOMContentLoaded), showView(), toggleTheme(),
//  applyTheme(), setupKeyboardShortcuts(), setTxSign(), initColumnResize(),
//  renderAll(), y todos los window.* bindings.
// ═══════════════════════════════════════════════════════════════════════

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  try {
    // Migration: generate cached custom vars for blocking script
    if (state.settings.colorScheme === 'custom' && state.settings.customColors && !state.settings.customGeneratedVars) {
      const cc = state.settings.customColors;
      if (cc.table && cc.sidebar && cc.button) {
        const css = buildCustomPalette(cc.table, cc.sidebar, cc.button, cc.positive, cc.negative);
        const vars = Object.entries(css).map(([k, v]) => `  ${k}: ${v};`).join('\n');
        if (vars) {
          state.settings.customGeneratedVars = vars;
          localStorage.setItem('wallet_settings', JSON.stringify(state.settings));
        }
      }
    }
    applyTheme();
  } catch(e) {
    // Ensure page works even if theme application fails
    document.documentElement.classList.add('theme-light');
  }
  loadData();
  setupSearchableSelects();
  setupKeyboardShortcuts();
  initCustomThemeUI();
  try { initSidebarCollapse(); } catch(e) { console.warn('sidebar collapse init failed', e); }
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
    showWelcomeOnFirstVisit();
    populateAccountTypeSelects();
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
    const dashPeriod = document.getElementById('dash-period-dropdown');
    if (dashPeriod && dashPeriod.classList.contains('open') && !dashPeriod.contains(e.target)) {
      dashPeriod.classList.remove('open');
    }
    const pcal = document.getElementById('period-calendar-popup');
    if (pcal && pcal.classList.contains('open') && !e.target.closest('.modal-card') && !e.target.closest('.period-option-custom')) {
      closePeriodCalendar();
    }
    const searchBox = document.getElementById('search-box');
    if (searchBox && searchBox.classList.contains('expanded') && !searchBox.contains(e.target)) {
      collapseSearchBox();
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

// ── SIDEBAR COLLAPSE / EXPAND ────────────────────────────────
let _sidebarHoverTimeout = null;
let _sidebarHoverActive = false;

function toggleSidebar() {
  const container = document.getElementById('app-container');
  const trigger = document.getElementById('sidebar-hover-trigger');
  const isCollapsed = container.classList.contains('sidebar-collapsed');

  if (isCollapsed) {
    container.classList.remove('sidebar-collapsed');
    if (trigger) trigger.classList.remove('visible');
    localStorage.setItem('wallet_sidebar_collapsed', 'false');
  } else {
    container.classList.add('sidebar-collapsed');
    if (trigger) trigger.classList.add('visible');
    localStorage.setItem('wallet_sidebar_collapsed', 'true');
  }
}

function pinSidebar() {
  const container = document.getElementById('app-container');
  const trigger = document.getElementById('sidebar-hover-trigger');
  container.classList.remove('sidebar-collapsed');
  container.classList.remove('sidebar-hover-active');
  if (trigger) trigger.classList.remove('visible');
  localStorage.setItem('wallet_sidebar_collapsed', 'false');
}

function initSidebarCollapse() {
  const collapsed = localStorage.getItem('wallet_sidebar_collapsed') === 'true';
  const container = document.getElementById('app-container');
  const trigger = document.getElementById('sidebar-hover-trigger');
  const sidebar = document.querySelector('.sidebar');

  if (collapsed) {
    container.classList.add('sidebar-collapsed');
    if (trigger) trigger.classList.add('visible');
  }

  if (!trigger || !sidebar) return;

  function showOverlay() {
    if (!container.classList.contains('sidebar-collapsed')) return;
    clearTimeout(_sidebarHoverTimeout);
    _sidebarHoverActive = true;
    container.classList.add('sidebar-hover-active');
  }

  function hideOverlay() {
    _sidebarHoverTimeout = setTimeout(() => {
      _sidebarHoverActive = false;
      container.classList.remove('sidebar-hover-active');
    }, 250);
  }

  trigger.addEventListener('mouseenter', showOverlay);
  trigger.addEventListener('mouseleave', hideOverlay);

  sidebar.addEventListener('mouseenter', () => {
    clearTimeout(_sidebarHoverTimeout);
  });

  sidebar.addEventListener('mouseleave', hideOverlay);
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
    const amountStyle = state.settings.amountStyle || 'default';
    const radio = document.querySelector(`input[name="amount-style"][value="${amountStyle}"]`);
    if (radio) radio.checked = true;
    syncThemeUI();
  }
}

// ── THEME ─────────────────────────────────────────────────────
const SCHEMES = {
  'default':      { mode: 'light' },
  'ocean':        { mode: 'light' },
  'forest':       { mode: 'light' },
  'lavender':     { mode: 'light' },
  'slate':        { mode: 'light' },
  'default-dark': { mode: 'dark' },
  'midnight':     { mode: 'dark' },
  'ember':        { mode: 'dark' },
};

// ── CUSTOM THEME ──────────────────────────────────────────────
function hexToHsl(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function hslString(h, s, l) { return `hsl(${h} ${s}% ${l}%)`; }

function luminance(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const toLinear = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = luminance(hex1), l2 = luminance(hex2);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function mixWithBlack(hex, t) {
  hex = hex.replace('#', '');
  const r = Math.round(parseInt(hex.substring(0, 2), 16) * (1 - t));
  const g = Math.round(parseInt(hex.substring(2, 4), 16) * (1 - t));
  const b = Math.round(parseInt(hex.substring(4, 6), 16) * (1 - t));
  return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}

function buildCustomPalette(tableBase, sidebarBase, accentBase, positiveBase, negativeBase) {
  if (!tableBase || !sidebarBase || !accentBase) return {};
  const tb = hexToHsl(tableBase), sb = hexToHsl(sidebarBase), ab = hexToHsl(accentBase);
  const css = {};
  const set = (name, val) => { css[name] = val; };

  // Root background: user's exact table color
  set('--bg-root', `#${tableBase.replace('#','')}`);
  // Surface: user's exact sidebar color
  set('--bg-surface', `#${sidebarBase.replace('#','')}`);
  // Raised: slightly darker than root (table headers, hover)
  set('--bg-raised', hslToHex(tb.h, tb.s, Math.max(tb.l - 5, 10)));
  // Sunken: slightly darker than surface
  set('--bg-sunken', hslToHex(sb.h, sb.s, Math.max(sb.l - 5, 10)));

  // Borders: slightly darker than sidebar
  set('--border', hslToHex(sb.h, sb.s, Math.max(sb.l - 8, 15)));

  // Accent: user's exact button color, derive hover/soft
  set('--accent', `#${accentBase.replace('#','')}`);
  set('--accent-soft', hslToHex(ab.h, Math.min(ab.s, 50), 95));
  set('--accent-hover', hslToHex(ab.h, ab.s, Math.max(ab.l - 12, 20)));
  set('--border-focus', `#${accentBase.replace('#','')}`);

  // Text: fixed dark grays (subtle, not black)
  set('--text-hi',  '#1a1a1f');
  set('--text-mid', '#52525b');
  set('--text-lo',  '#7c7c87');
  set('--text-inv', '#ffffff');

  // Semantic colors from accent hue (or custom overrides)
  if (positiveBase) {
    const pb = hexToHsl(positiveBase);
    set('--positive', `#${positiveBase.replace('#','')}`);
    set('--positive-bg', hslToHex(pb.h, Math.min(pb.s, 70), 93));
  } else {
    set('--positive', hslToHex(145, 60, 35));
    set('--positive-bg', hslToHex(145, 65, 93));
  }
  if (negativeBase) {
    const nb = hexToHsl(negativeBase);
    set('--negative', `#${negativeBase.replace('#','')}`);
    set('--negative-bg', hslToHex(nb.h, Math.min(nb.s, 70), 95));
  } else {
    set('--negative', hslToHex(0, 70, 45));
    set('--negative-bg', hslToHex(0, 75, 95));
  }
  set('--warn', hslToHex(40, 80, 40));
  set('--warn-bg', hslToHex(40, 80, 94));

  // Tags: derive from accent hue
  set('--tag-a-bg', hslToHex((ab.h + 330) % 360, 60, 95));
  set('--tag-a-tx', hslToHex((ab.h + 330) % 360, 55, 30));
  set('--tag-b-bg', hslToHex((ab.h + 50) % 360, 70, 94));
  set('--tag-b-tx', hslToHex((ab.h + 50) % 360, 60, 28));
  set('--tag-c-bg', hslToHex((ab.h + 200) % 360, 55, 94));
  set('--tag-c-tx', hslToHex((ab.h + 200) % 360, 50, 30));

  // Shadows
  set('--shadow-card', '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)');
  set('--shadow-pop', '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)');

  return css;
}

let _customStyleEl = null;

function applyCustomTheme() {
  const cc = state.settings.customColors;
  if (!cc) return;
  const css = buildCustomPalette(cc.table, cc.sidebar, cc.button, cc.positive, cc.negative);
  const vars = Object.entries(css).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  if (!_customStyleEl) {
    _customStyleEl = document.createElement('style');
    _customStyleEl.id = 'custom-theme-vars';
    document.head.appendChild(_customStyleEl);
  }
  _customStyleEl.textContent = `:root {\n${vars}\n}`;
  // Cache for blocking script
  state.settings.customGeneratedVars = vars;
  localStorage.setItem('wallet_settings', JSON.stringify(state.settings));
}

function saveCustomThemeColors() {
  const tableI = document.getElementById('custom-color-table');
  const sidebarI = document.getElementById('custom-color-sidebar');
  const buttonI = document.getElementById('custom-color-button');
  const positiveI = document.getElementById('custom-color-positive');
  const negativeI = document.getElementById('custom-color-negative');
  if (!tableI || !sidebarI || !buttonI) return;
  state.settings.customColors = {
    table: tableI.value,
    sidebar: sidebarI.value,
    button: buttonI.value,
    positive: positiveI ? positiveI.value : null,
    negative: negativeI ? negativeI.value : null,
  };
  state.settings.colorScheme = 'custom';
  state.settings.theme = 'light';
  applyCustomTheme();
  syncThemeUI();
}

function initCustomThemeUI() {
  const grid = document.querySelector('.scheme-grid');
  if (!grid) return;

  // Add custom scheme card
  const card = document.createElement('button');
  card.className = 'scheme-card';
  card.dataset.scheme = 'custom';
  card.onclick = () => setColorScheme('custom');
  card.innerHTML = `
    <div class="scheme-dots scheme-card-custom">
      <span class="scheme-dot-custom" id="custom-dot-table" style="background:#ffffff"></span>
      <span class="scheme-dot-custom" id="custom-dot-sidebar" style="background:#f0eeeb"></span>
      <span class="scheme-dot-custom" id="custom-dot-button" style="background:#5b52f5"></span>
      <span class="scheme-dot-custom" id="custom-dot-positive" style="background:#16a34a"></span>
      <span class="scheme-dot-custom" id="custom-dot-negative" style="background:#dc2626"></span>
    </div>
    <span class="scheme-name">Personalizado</span>`;
  grid.appendChild(card);

  // Add custom theme section below the grid
  const subsection = grid.closest('.pane-subsection');
  if (!subsection) return;
  const section = document.createElement('div');
  section.className = 'custom-theme-section';
  section.id = 'custom-theme-section';
  section.innerHTML = `
    <div class="pane-subsection-title" style="border-left-color:var(--accent);">Colores personalizados</div>
    <div class="custom-theme-colors">
      <div class="custom-color-item">
        <div class="custom-color-top">
          <input type="color" class="custom-color-input" id="custom-color-table" aria-label="Tabla / Fondo" value="#ffffff">
          <div>
            <div class="custom-color-label">Tabla / Fondo</div>
            <div class="custom-color-hex" id="custom-hex-table">#ffffff</div>
          </div>
        </div>
        <div class="custom-color-desc">Color base del área de contenido y la tabla de transacciones</div>
      </div>
      <div class="custom-color-item">
        <div class="custom-color-top">
          <input type="color" class="custom-color-input" id="custom-color-sidebar" aria-label="Barra lateral" value="#f0eeeb">
          <div>
            <div class="custom-color-label">Barra lateral</div>
            <div class="custom-color-hex" id="custom-hex-sidebar">#f0eeeb</div>
          </div>
        </div>
        <div class="custom-color-desc">Color base de la barra lateral, headers y toolbar</div>
      </div>
      <div class="custom-color-item">
        <div class="custom-color-top">
          <input type="color" class="custom-color-input" id="custom-color-button" aria-label="Botones / Acento" value="#5b52f5">
          <div>
            <div class="custom-color-label">Botones / Acento</div>
            <div class="custom-color-hex" id="custom-hex-button">#5b52f5</div>
          </div>
        </div>
        <div class="custom-color-desc">Color de botones, links e interacciones</div>
      </div>
      <div class="custom-color-item">
        <div class="custom-color-top">
          <input type="color" class="custom-color-input" id="custom-color-positive" aria-label="Positivos" value="#16a34a">
          <div>
            <div class="custom-color-label">Positivos</div>
            <div class="custom-color-hex" id="custom-hex-positive">#16a34a</div>
          </div>
        </div>
        <div class="custom-color-desc">Ingresos, cobros y montos a favor</div>
      </div>
      <div class="custom-color-item">
        <div class="custom-color-top">
          <input type="color" class="custom-color-input" id="custom-color-negative" aria-label="Negativos" value="#dc2626">
          <div>
            <div class="custom-color-label">Negativos</div>
            <div class="custom-color-hex" id="custom-hex-negative">#dc2626</div>
          </div>
        </div>
        <div class="custom-color-desc">Gastos, débitos y montos en rojo</div>
      </div>
    </div>
    <div class="custom-theme-actions">
      <button class="btn btn-primary" onclick="saveCustomThemeColors()">Aplicar colores</button>
      <span class="custom-theme-note">Los demás colores se generan automáticamente</span>
    </div>`;
  subsection.appendChild(section);

  // Load saved colors
  const cc = state.settings.customColors;
  if (cc) {
    const t = document.getElementById('custom-color-table');
    const s = document.getElementById('custom-color-sidebar');
    const b = document.getElementById('custom-color-button');
    const p = document.getElementById('custom-color-positive');
    const n = document.getElementById('custom-color-negative');
    if (t) t.value = cc.table || '#ffffff';
    if (s) s.value = cc.sidebar || '#f0eeeb';
    if (b) b.value = cc.button || '#5b52f5';
    if (p) p.value = cc.positive || '#16a34a';
    if (n) n.value = cc.negative || '#dc2626';
  }

  // Live hex display + live preview
  ['table', 'sidebar', 'button', 'positive', 'negative'].forEach(key => {
    const input = document.getElementById('custom-color-' + key);
    const hex = document.getElementById('custom-hex-' + key);
    const dot = document.getElementById('custom-dot-' + key);
    if (input) {
      input.addEventListener('input', () => {
        if (hex) hex.textContent = input.value;
        if (dot) dot.style.background = input.value;
      });
    }
  });
}

function toggleTheme() {
  const current = state.settings.colorScheme || 'default';
  if (current === 'custom') {
    // Custom is light; toggle to first dark scheme
    const target = Object.entries(SCHEMES).find(([, v]) => v.mode === 'dark');
    if (target) setColorScheme(target[0]);
    return;
  }
  const currentMode = SCHEMES[current]?.mode || 'light';
  const newMode = currentMode === 'light' ? 'dark' : 'light';
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
  document.documentElement.classList.toggle('theme-dark', isDark);
  document.documentElement.classList.toggle('theme-light', !isDark);

  // Remove all scheme classes, then apply current
  Object.keys(SCHEMES).forEach(s => document.documentElement.classList.remove('scheme-' + s));
  document.documentElement.classList.remove('scheme-custom');
  const scheme = state.settings.colorScheme || 'default';
  if (scheme !== 'default' && scheme !== 'custom') {
    document.documentElement.classList.add('scheme-' + scheme);
  }

  // Apply custom theme CSS variables
  if (scheme === 'custom') applyCustomTheme();
  else if (_customStyleEl) _customStyleEl.textContent = '';

  // Show/hide custom theme section
  const cs = document.getElementById('custom-theme-section');
  if (cs) cs.classList.toggle('visible', scheme === 'custom');

  const icon = isDark ? 'moon' : 'sun';
  ['theme-icon', 'theme-icon-settings', 'theme-icon-dash', 'theme-icon-settings-mini'].forEach(id => {
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
  const themeLabel = document.getElementById('theme-label');
  if (themeLabel) themeLabel.textContent = state.settings.theme === 'dark' ? 'Oscuro' : 'Claro';
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────
function toggleSearchBox() {
  const box = document.getElementById('search-box');
  const input = document.getElementById('tx-search-input');
  if (!box || !input) return;

  if (box.classList.contains('expanded')) {
    box.classList.remove('expanded');
    input.value = '';
    renderTransactions();
  } else {
    box.classList.add('expanded');
    input.focus();
  }
}

function collapseSearchBox() {
  const box = document.getElementById('search-box');
  const input = document.getElementById('tx-search-input');
  if (!box || !input) return;
  box.classList.remove('expanded');
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('confirm-modal').classList.contains('open')) {
      resolveConfirm(false);
      return;
    }
    if (e.key === 'Escape' && document.getElementById('search-box')?.classList.contains('expanded')) {
      collapseSearchBox();
      return;
    }
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      toggleSearchBox();
      return;
    }
  });

  // Live preview when amount or date changes
  const amtInput  = document.getElementById('tx-amount');
  const dateInput = document.getElementById('tx-date');
  const amtError  = document.getElementById('tx-amount-error');
  if (amtInput)  amtInput.addEventListener('input', () => {
    if (document.getElementById('tx-is-installment')?.checked) updateInstallmentPreview();
    if (amtError) {
      const v = amtInput.value.trim();
      if (!v || isPlainNumber(v)) {
        amtError.style.display = 'none';
      } else {
        let nv = v.replace(/,/g, '.');
        const res = evaluateExpression(nv, state.settings.decimals);
        if (res && res.error === 'too_large') {
          amtError.textContent = 'Número demasiado grande';
          amtError.style.display = '';
        } else if (res && (res.error === 'syntax' || res.error === 'invalid')) {
          amtError.textContent = 'Expresión inválida';
          amtError.style.display = '';
        } else {
          amtError.style.display = 'none';
        }
      }
    }
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

  const COL_WIDTHS_KEY = 'wallet_col_widths';

  // Restore saved widths
  try {
    const saved = JSON.parse(localStorage.getItem(COL_WIDTHS_KEY));
    if (saved) {
      table.querySelectorAll('thead th.col-resizable').forEach((th, i) => {
        const key = th.dataset.sort || 'col-' + i;
        if (saved[key]) {
          th.style.width = saved[key];
          th.style.maxWidth = 'none';
        }
      });
    }
  } catch (_) {}

  const handles = table.querySelectorAll('.col-resize-handle');
  let startX = 0, startW = 0, th = null, handle = null;
  let didDrag = false;

  function saveWidths() {
    const widths = {};
    table.querySelectorAll('thead th.col-resizable').forEach((th, i) => {
      const key = th.dataset.sort || 'col-' + i;
      widths[key] = th.style.width;
    });
    localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(widths));
  }

  function onMouseDown(e) {
    handle = e.currentTarget;
    th = handle.closest('th');
    if (!th) return;

    const rect = th.getBoundingClientRect();
    startX = e.clientX;
    startW = rect.width;
    didDrag = false;

    table.classList.add('col-resizing');
    handle.classList.add('resizing');

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!th) return;
    if (Math.abs(e.clientX - startX) > 2) didDrag = true;
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

    if (didDrag) {
      state._justResized = true;
      setTimeout(() => { state._justResized = false; }, 0);
      saveWidths();
    }

    startX = 0; startW = 0; th = null; handle = null; didDrag = false;
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
window.openFloatingAccountCreator = openFloatingAccountCreator;
window.closeFloatingAccountCreator = closeFloatingAccountCreator;
window.toggleAccountClosingFieldsFloating = toggleAccountClosingFieldsFloating;
window.createAccountFromFloating  = createAccountFromFloating;
window.openEditAccountModal       = openEditAccountModal;
window.closeEditAccountModal      = closeEditAccountModal;
window.toggleAccountClosingFieldsEdit = toggleAccountClosingFieldsEdit;
window.saveAccountEdit            = saveAccountEdit;
window.addPredefined             = addPredefined;
window.removePredefined          = removePredefined;
window.filterPredefinedList      = filterPredefinedList;
window.addAccountType           = addAccountType;
window.removeAccountType        = removeAccountType;
window.editAccountType          = editAccountType;
window.populateAccountTypeSelects = populateAccountTypeSelects;
window.renderAccountTypesList   = renderAccountTypesList;
window.initColumnResize          = initColumnResize;
window.toggleCatIconPicker       = toggleCatIconPicker;
window.selectCatIcon             = selectCatIcon;
window.openTransactionModal      = openTransactionModal;
window.closeTransactionModal     = closeTransactionModal;
window.toggleReceivableFields     = toggleReceivableFields;
window.toggleInstallmentFields    = toggleInstallmentFields;
window.onInstallmentCheck          = onInstallmentCheck;
window.onAccountChangeInModal      = onAccountChangeInModal;
window.updateInstallmentPreview    = updateInstallmentPreview;
window.getInstallmentMonthOffset   = getInstallmentMonthOffset;
window.onCuotaInput                = onCuotaInput;
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
window.openWelcomeModal          = openWelcomeModal;
window.closeWelcomeModal         = closeWelcomeModal;
window.showWelcomeOnFirstVisit   = showWelcomeOnFirstVisit;
window.resolveConfirm            = resolveConfirm;
window.handleTxRowClick          = handleTxRowClick;
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
window.dashSetPeriod             = dashSetPeriod;
window.dashTogglePeriodDropdown  = dashTogglePeriodDropdown;
window.dashClosePeriodDropdown   = dashClosePeriodDropdown;
window.onCsvFileSelected         = onCsvFileSelected;
window.reparseCsv                = reparseCsv;
window.onCsvMappingChange        = onCsvMappingChange;
window.confirmCsvImport          = confirmCsvImport;
window.downloadCsvFromAi        = downloadCsvFromAi;
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
window.toggleDeleteAll          = toggleDeleteAll;
window.syncDeleteCheckboxes     = syncDeleteCheckboxes;
window.confirmDeleteSelected    = confirmDeleteSelected;
window.clearBackupDates         = clearBackupDates;
window.toggleSearchBox          = toggleSearchBox;
window.collapseSearchBox        = collapseSearchBox;
window.toggleSort               = toggleSort;
window.saveCustomThemeColors    = saveCustomThemeColors;
window.openBalanceModal         = openBalanceModal;
window.closeBalanceModal        = closeBalanceModal;
window.updateBalanceDiff        = updateBalanceDiff;
window.confirmBalanceAdjustment = confirmBalanceAdjustment;
window.openBalanceFromEditModal = openBalanceFromEditModal;
window.getCardSchedule         = getCardSchedule;
window.getCardScheduleMonths   = getCardScheduleMonths;
window.getCurrentYearMonth     = getCurrentYearMonth;
window.getCycleStartDate       = getCycleStartDate;
window.calculateCycleBalance   = calculateCycleBalance;
window.addMonths               = addMonths;
window.openCcScheduleModal     = openCcScheduleModal;
window.closeCcScheduleModal    = closeCcScheduleModal;
window.addCcScheduleRow        = addCcScheduleRow;
window.saveCcSchedule          = saveCcSchedule;
window.openSplitModal         = openSplitModal;
window.closeSplitModal        = closeSplitModal;
window.addSplitRow            = addSplitRow;
window.removeSplitRow         = removeSplitRow;
window.onSplitAmountInput     = onSplitAmountInput;
window.saveSplits             = saveSplits;
window.toggleSplitChildren    = toggleSplitChildren;
window.mergeSplitChildren     = mergeSplitChildren;
window.distributeEqually      = distributeEqually;
window.removeAllSplits        = removeAllSplits;

window.openTransferModal            = openTransferModal;
window.handleTransferSubmit         = handleTransferSubmit;
window.closeTransferModal           = closeTransferModal;
window.onTransferAccountChange      = onTransferAccountChange;
window.updateTransferConvertedNote  = updateTransferConvertedNote;
window.toggleSplitDropdown          = toggleSplitDropdown;
window.closeSplitDropdown           = closeSplitDropdown;
window.toggleSidebar                = toggleSidebar;
window.pinSidebar                  = pinSidebar;
