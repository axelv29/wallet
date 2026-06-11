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
      { name: 'Sin asignar', icon: 'circle-dashed' },
    ],
    tags: []
  },
  settings: { geminiKey: '', theme: 'light', colorScheme: 'default', currency: 'ARS', showSymbol: true, decimals: 2, amountStyle: 'default' },
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
  } else {
    state.accounts = [
      { id: 'acc-1', name: 'Itaú Débito',  type: 'liquid',      balance: 0 },
      { id: 'acc-2', name: 'Brou',          type: 'liquid',      balance: 0 },
      { id: 'acc-3', name: 'Efectivo',      type: 'liquid',      balance: 0 },
      { id: 'acc-4', name: 'Itaú Crédito',  type: 'credit_card', balance: 0, card_closing_day: 20, card_due_day: 30 },
      { id: 'acc-5', name: 'Deudas',        type: 'credit_card', balance: 0,   card_closing_day: 15, card_due_day: 25 }
    ];
    saveData('accounts');
  }

  if (lsTx) {
    state.transactions = JSON.parse(lsTx);
  } else {
    state.transactions = [
      { id: 'tx-init-1', date: '2026-05-01', account_id: 'acc-1', payee: 'Ajuste de saldo', category_name: 'Ajuste de saldo', amount:  1047.40, notes: '', tags: [], is_receivable: false, due_date: '', excluded: false },
      { id: 'tx-init-2', date: '2026-05-01', account_id: 'acc-2', payee: 'Ajuste de saldo', category_name: 'Ajuste de saldo', amount:  1900.00, notes: '', tags: [], is_receivable: false, due_date: '', excluded: false },
      { id: 'tx-init-3', date: '2026-05-01', account_id: 'acc-3', payee: 'Ajuste de saldo', category_name: 'Ajuste de saldo', amount:  1727.00, notes: '', tags: [], is_receivable: false, due_date: '', excluded: false },
      { id: 'tx-init-4', date: '2026-05-01', account_id: 'acc-4', payee: 'Ajuste de saldo', category_name: 'Ajuste de saldo', amount: -10300.38, notes: '', tags: [], is_receivable: false, due_date: '', excluded: false },
      { id: 'tx-init-5', date: '2026-05-01', account_id: 'acc-5', payee: 'Ajuste de saldo', category_name: 'Ajuste de saldo', amount:  -460.00, notes: '', tags: [], is_receivable: false, due_date: '', excluded: false },
      { id: 'tx-1',  date: '2026-06-01', account_id: 'acc-5', payee: 'Leo',            category_name: 'Fuera del presupuesto', amount:  5033.00, notes: 'Pasajes + Préstamo',    tags: [], is_receivable: true, excluded: false },
      { id: 'tx-2',  date: '2026-05-24', account_id: 'acc-4', payee: 'Escaramuza',     category_name: 'Entretenimiento',       amount:  -258.75, notes: 'Libro w/',              tags: ['Rocio'], is_receivable: false, excluded: false },
      { id: 'tx-3',  date: '2026-05-19', account_id: 'acc-5', payee: 'Rocío',          category_name: 'Fuera del presupuesto', amount:   700.00, notes: 'Comida + Regalo Jessi', tags: [], is_receivable: false, excluded: false },
      { id: 'tx-4',  date: '2026-05-18', account_id: 'acc-5', payee: 'Leo',            category_name: 'Fuera del presupuesto', amount:  -141.00, notes: 'Compras finde',         tags: [], is_receivable: false, excluded: false },
      { id: 'tx-5',  date: '2026-05-18', account_id: 'acc-5', payee: 'Leo',            category_name: 'Fuera del presupuesto', amount:  -250.00, notes: 'Limpieza heladera',     tags: [], is_receivable: false, excluded: false },
      { id: 'tx-6',  date: '2026-05-18', account_id: 'acc-5', payee: 'Nati',           category_name: 'Fuera del presupuesto', amount: -1000.00, notes: 'Limpieza + Alfombra',   tags: [], is_receivable: false, excluded: false },
      { id: 'tx-7',  date: '2026-05-18', account_id: 'acc-5', payee: 'Nati',           category_name: 'Fuera del presupuesto', amount:  -400.00, notes: 'Limpieza Sillas',       tags: [], is_receivable: false, excluded: false },
      { id: 'tx-8',  date: '2026-05-17', account_id: 'acc-3', payee: 'Tienda Inglesa', category_name: 'Supermercado',          amount:   -53.00, notes: 'Bicarbonato',           tags: [], is_receivable: false, excluded: false },
      { id: 'tx-9',  date: '2026-05-17', account_id: 'acc-4', payee: 'Tienda Inglesa', category_name: 'Supermercado',          amount:  -373.00, notes: 'Galletitas w/',         tags: ['Rocio'], is_receivable: false, excluded: false },
      { id: 'tx-10', date: '2026-05-16', account_id: 'acc-4', payee: 'El Tío',         category_name: 'Supermercado',          amount:  -744.64, notes: 'Compras hamburguesas',  tags: [], is_receivable: false, excluded: false },
      { id: 'tx-11', date: '2026-05-16', account_id: 'acc-4', payee: 'El Tío',         category_name: 'Supermercado',          amount:  -141.00, notes: 'Aceite y Pan',          tags: ['NyL'], is_receivable: false, excluded: false },
      { id: 'tx-12', date: '2026-05-16', account_id: 'acc-4', payee: 'El Tío',         category_name: 'Supermercado',          amount:  -603.64, notes: 'Merienda y cena w/',    tags: [], is_receivable: false, excluded: false }
    ];
    saveData('transactions');
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
    // Ensure 'Sin asignar' category exists
    const hasSinAsignar = state.predefined.categories.some(c => (typeof c === 'string' ? c : c.name) === 'Sin asignar');
    if (!hasSinAsignar) {
      state.predefined.categories.push({ name: 'Sin asignar', icon: 'circle-dashed' });
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
