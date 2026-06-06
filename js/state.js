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
    payees: ['Leo', 'Escaramuza', 'Rocío', 'Nati', 'Tienda Inglesa', 'El Tío', 'Supermercado Coto'],
    categories: [
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
    ],
    tags: ['Rocio', 'NyL', 'pan', 'viaje', 'compras']
  },
  settings: { geminiKey: '', theme: 'light', currency: 'ARS', showSymbol: true, decimals: 2 },
  currentTxSign: -1,
  importedTransactions: [],
  currentView: 'all',
  editingTxId: null,
  selectedTxIds: new Set(),
  tableFilters: [],

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
      { id: 'acc-1', name: 'Itaú Débito',  type: 'liquid',      balance: 1047.40 },
      { id: 'acc-2', name: 'Brou',          type: 'liquid',      balance: 1900.00 },
      { id: 'acc-3', name: 'Efectivo',      type: 'liquid',      balance: 1727.00 },
      { id: 'acc-4', name: 'Itaú Crédito',  type: 'credit_card', balance: -10300.38, card_closing_day: 20, card_due_day: 30 },
      { id: 'acc-5', name: 'Deudas',        type: 'credit_card', balance: -460.00,   card_closing_day: 15, card_due_day: 25 }
    ];
    saveData('accounts');
  }

  if (lsTx) {
    state.transactions = JSON.parse(lsTx);
  } else {
    state.transactions = [
      { id: 'tx-1',  date: '2026-06-01', account_id: 'acc-5', payee: 'Leo',            category_name: 'Fuera del presupuesto', amount:  5033.00, notes: 'Pasajes + Préstamo',    tags: [], is_receivable: true  },
      { id: 'tx-2',  date: '2026-05-24', account_id: 'acc-4', payee: 'Escaramuza',     category_name: 'Entretenimiento',       amount:  -258.75, notes: 'Libro w/',              tags: ['Rocio'], is_receivable: false },
      { id: 'tx-3',  date: '2026-05-19', account_id: 'acc-5', payee: 'Rocío',          category_name: 'Fuera del presupuesto', amount:   700.00, notes: 'Comida + Regalo Jessi', tags: [], is_receivable: false },
      { id: 'tx-4',  date: '2026-05-18', account_id: 'acc-5', payee: 'Leo',            category_name: 'Fuera del presupuesto', amount:  -141.00, notes: 'Compras finde',         tags: [], is_receivable: false },
      { id: 'tx-5',  date: '2026-05-18', account_id: 'acc-5', payee: 'Leo',            category_name: 'Fuera del presupuesto', amount:  -250.00, notes: 'Limpieza heladera',     tags: [], is_receivable: false },
      { id: 'tx-6',  date: '2026-05-18', account_id: 'acc-5', payee: 'Nati',           category_name: 'Fuera del presupuesto', amount: -1000.00, notes: 'Limpieza + Alfombra',   tags: [], is_receivable: false },
      { id: 'tx-7',  date: '2026-05-18', account_id: 'acc-5', payee: 'Nati',           category_name: 'Fuera del presupuesto', amount:  -400.00, notes: 'Limpieza Sillas',       tags: [], is_receivable: false },
      { id: 'tx-8',  date: '2026-05-17', account_id: 'acc-3', payee: 'Tienda Inglesa', category_name: 'Supermercado',          amount:   -53.00, notes: 'Bicarbonato',           tags: [], is_receivable: false },
      { id: 'tx-9',  date: '2026-05-17', account_id: 'acc-4', payee: 'Tienda Inglesa', category_name: 'Supermercado',          amount:  -373.00, notes: 'Galletitas w/',         tags: ['Rocio'], is_receivable: false },
      { id: 'tx-10', date: '2026-05-16', account_id: 'acc-4', payee: 'El Tío',         category_name: 'Supermercado',          amount:  -744.64, notes: 'Compras hamburguesas',  tags: [], is_receivable: false },
      { id: 'tx-11', date: '2026-05-16', account_id: 'acc-4', payee: 'El Tío',         category_name: 'Supermercado',          amount:  -141.00, notes: 'Aceite y Pan',          tags: ['NyL'], is_receivable: false },
      { id: 'tx-12', date: '2026-05-16', account_id: 'acc-4', payee: 'El Tío',         category_name: 'Supermercado',          amount:  -603.64, notes: 'Merienda y cena w/',    tags: [], is_receivable: false }
    ];
    saveData('transactions');
  }

  if (lsPre) {
    state.predefined = JSON.parse(lsPre);
    // Migrate string categories → { name, icon }
    if (state.predefined.categories.length && typeof state.predefined.categories[0] === 'string') {
      state.predefined.categories = state.predefined.categories.map((c, i) => ({
        name: c,
        icon: ['shopping-cart','utensils-crossed','package','car','zap','gamepad-2','heart-pulse','book-open','briefcase','laptop','gift','home','shirt','smartphone','more-horizontal'][i] || 'tag'
      }));
      saveData('predefined');
    }
  } else {
    saveData('predefined');
  }
}

function saveData(type) {
  if (type === 'accounts')     localStorage.setItem('wallet_accounts',     JSON.stringify(state.accounts));
  if (type === 'transactions') localStorage.setItem('wallet_transactions', JSON.stringify(state.transactions));
  if (type === 'predefined')   localStorage.setItem('wallet_predefined',   JSON.stringify(state.predefined));
}

function loadSettings() {
  const s = localStorage.getItem('wallet_settings');
  if (s) state.settings = JSON.parse(s);
}
