// ═══════════════════════════════════════════════════════════════════════
//  state.js — Global application state & persistence (localStorage)
//  Contiene: state object, dashState, loadData(), saveData(),
//  loadSettings(), y variables de estado global sueltas.
// ═══════════════════════════════════════════════════════════════════════

// ── ESTADO GLOBAL ────────────────────────────────────────────
let state = {
  accounts: [],
  transactions: [],
  predefined: {
    payees: [],
    account_types: [
      { id: 'liquid', label: 'Líquida (Efectivo / Débito)', isDefault: true },
      { id: 'credit_card', label: 'Tarjeta de crédito', isDefault: true },
    ],
    categories: [
      { name: 'Ajuste de saldo', icon: 'banknote' },
      { name: 'Transferencias', icon: 'arrow-left-right' },
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
      { name: 'Pagos', icon: 'credit-card' },
      { name: 'Sin asignar', icon: 'circle-dashed' },
    ],
    tags: [
      { name: 'Pago de tarjeta', color: '#22c55e', isSystem: true },
    ]
  },
  settings: { geminiKey: '', theme: 'light', colorScheme: 'default', currency: 'ARS', showSymbol: true, decimals: 2, amountStyle: 'default',
    viewPrefs: {
      showImportBtn: true,
      showFilterBtn: true,
      showAccountBalances: true,
      showClosingRows: true,
      showFutureTxs: true,
      showColDate: true,
      showColAccount: true,
      showColPayee: true,
      showColInstallment: true,
      showColNotes: true,
      showColTags: true,
      showColCategory: true,
      showColAmount: true,
    }
  },
  period: { type: 'all', startDate: null, endDate: null },
  currentTxSign: -1,
  importedTransactions: [],
  currentView: 'all',
  selectedAccounts: [],
  editingTxId: null,
  selectedTxIds: new Set(),
  tableFilters: [],
  sortColumn: null,
  sortDirection: 'asc',

};

// ── DATA PERSISTENCE ──────────────────────────────────────────
function loadData() {
  const lsAcc  = localStorage.getItem('wallet_accounts');
  const lsTx   = localStorage.getItem('wallet_transactions');
  const lsPre  = localStorage.getItem('wallet_predefined');

  if (lsAcc) {
    state.accounts = JSON.parse(lsAcc);
  }

  if (lsTx) {
    state.transactions = JSON.parse(lsTx);
  }

  if (lsPre) {
    state.predefined = JSON.parse(lsPre);
    // Migrate string categories → { name, icon }
    if (state.predefined.categories.length && typeof state.predefined.categories[0] === 'string') {
      state.predefined.categories = state.predefined.categories.map((c, i) => ({
        name: c,
        icon: ['shopping-cart','utensils-crossed','package','car','zap','gamepad-2','heart-pulse','book-open','briefcase','laptop','gift','home','shirt','smartphone','more-horizontal','circle-dashed'][i] || 'tag'
      }));
      saveData('predefined');
    }
    // Migrate string tags → { name, color }
    if (state.predefined.tags.length && typeof state.predefined.tags[0] === 'string') {
      const colors = ['#fca5a5','#fdba74','#fcd34d','#fde047','#bef264','#86efac','#6ee7b7','#5eead4','#67e8f9','#7dd3fc','#93c5fd','#a5b4fc','#c4b5fd','#d8b4fe','#f0abfc','#f9a8d4','#fda4af','#d1d5db'];
      state.predefined.tags = state.predefined.tags.map((t, i) => ({ name: t, color: colors[i % colors.length] }));
      saveData('predefined');
    }
    // Ensure 'Pago de tarjeta' tag exists (system tag)
    const hasPagoTag = state.predefined.tags.some(t => (typeof t === 'string' ? t : t.name) === 'Pago de tarjeta');
    if (!hasPagoTag) {
      state.predefined.tags.push({ name: 'Pago de tarjeta', color: '#22c55e', isSystem: true });
      saveData('predefined');
    }
    // Ensure 'Sin asignar' category exists
    const hasSinAsignar = state.predefined.categories.some(c => (typeof c === 'string' ? c : c.name) === 'Sin asignar');
    if (!hasSinAsignar) {
      state.predefined.categories.push({ name: 'Sin asignar', icon: 'circle-dashed' });
      saveData('predefined');
    }
    // Ensure 'Transferencias' category exists
    const hasTransferencias = state.predefined.categories.some(c => (typeof c === 'string' ? c : c.name) === 'Transferencias');
    if (!hasTransferencias) {
      state.predefined.categories.push({ name: 'Transferencias', icon: 'arrow-left-right' });
      saveData('predefined');
    }
    // Ensure 'Pagos' category exists
    const hasPagos = state.predefined.categories.some(c => (typeof c === 'string' ? c : c.name) === 'Pagos');
    if (!hasPagos) {
      state.predefined.categories.push({ name: 'Pagos', icon: 'credit-card' });
      saveData('predefined');
    }
    // Ensure account_types exists (migration for older presets)
    if (!state.predefined.account_types) {
      state.predefined.account_types = [
        { id: 'liquid', label: 'Líquida (Efectivo / Débito)', isDefault: true },
        { id: 'credit_card', label: 'Tarjeta de crédito', isDefault: true },
      ];
      saveData('predefined');
    }
  } else {
    saveData('predefined');
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

  // ── Migration: Convert account.balance to "Ajuste de saldo" transactions ──
  let migrated = false;
  state.accounts.forEach(acc => {
    const bal = Number(acc.balance) || 0;
    if (bal !== 0) {
      const alreadyHas = state.transactions.some(t => t.account_id === acc.id && t.category_name === 'Ajuste de saldo');
      if (!alreadyHas) {
        const accTxs = state.transactions.filter(t => t.account_id === acc.id);
        const dates = accTxs.map(t => t.date).filter(Boolean).sort();
        const date = dates.length > 0 ? dates[0] : new Date().toISOString().split('T')[0];
        state.transactions.unshift({
          id: 'tx-init-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          date,
          account_id: acc.id,
          payee: 'Ajuste de saldo',
          category_name: 'Ajuste de saldo',
          amount: bal,
          notes: '',
          tags: [],
          is_receivable: false,
          due_date: ''
        });
        acc.balance = 0;
        migrated = true;
      }
    }
  });
  if (migrated) {
    saveData('accounts');
    saveData('transactions');
  }
}

function saveData(type) {
  if (type === 'accounts')     localStorage.setItem('wallet_accounts',     JSON.stringify(state.accounts));
  if (type === 'transactions') localStorage.setItem('wallet_transactions', JSON.stringify(state.transactions));
  if (type === 'predefined')   localStorage.setItem('wallet_predefined',   JSON.stringify(state.predefined));
}

function loadSettings() {
  const s = localStorage.getItem('wallet_settings');
  if (s) {
    const parsed = JSON.parse(s);
    state.settings = parsed;
    if (parsed.period) state.period = parsed.period;
  }
}

function savePeriod() {
  state.settings.period = state.period;
  localStorage.setItem('wallet_settings', JSON.stringify(state.settings));
}
