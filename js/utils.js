// ═══════════════════════════════════════════════════════════════════════
//  utils.js — Utilidades / helpers
//  Contiene: formatCurrency(), formatAccountCurrency(), getConvertedTooltip(),
//  formatDate(), getCategoryIcon(), calculateBalances(), getPeriodRange(),
//  isTxInPeriod(), _tagColor(), getEditOptions().
// ═══════════════════════════════════════════════════════════════════════

// ── ACCOUNT TYPE HELPERS ──────────────────────────────────
function getAccountTypeLabel(typeId) {
  const types = state.predefined?.account_types || [];
  const found = types.find(t => t.id === typeId);
  return found ? found.label : typeId;
}

function isDefaultType(typeId) {
  const types = state.predefined?.account_types || [];
  const found = types.find(t => t.id === typeId);
  return found ? !!found.isDefault : false;
}

// ── UTILITIES ─────────────────────────────────────────────────
function formatCurrency(value) {
  const cur = state.settings.currency || 'ARS';
  const decimals = state.settings.decimals ?? 2;
  const localeMap = { ARS: 'es-AR', USD: 'en-US', EUR: 'es-ES', UYU: 'es-UY' };
  const locale = localeMap[cur] || 'es-AR';

  if (state.settings.showSymbol !== false) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(value);
  } else {
    return new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(value);
  }
}

function formatAccountCurrency(value, currency) {
  const cur     = currency || state.settings.currency || 'ARS';
  const decimals = state.settings.decimals ?? 2;
  const localeMap = { ARS: 'es-AR', USD: 'en-US', EUR: 'es-ES', UYU: 'es-UY' };
  const locale = localeMap[cur] || 'es-AR';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

function getConvertedTooltip(value, currency) {
  const settingsCur = state.settings.currency || 'ARS';
  const accCur = currency || settingsCur;
  if (accCur === settingsCur) return null;
  const converted = convertCurrency(value, accCur, settingsCur);
  if (converted === null || converted === undefined) return null;
  return formatCurrency(converted);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' });
}

// ── CATEGORY ICON HELPER ─────────────────────────────────
function getCategoryIcon(catName) {
  if (!catName) return '<span class="cat-icon"><i data-lucide="tag"></i></span>';
  const cat = state.predefined.categories.find(c => (typeof c === 'string' ? c : c.name) === catName);
  const icon = cat && typeof cat !== 'string' ? cat.icon : 'tag';
  return `<span class="cat-icon"><i data-lucide="${icon}"></i></span>`;
}

function calculateBalances(accountIds) {
  const settingsCur = state.settings.currency || 'ARS';
  const balances = { liquid: 0, credit_card: 0, receivables: 0 };
  const accFilter = accountIds ? new Set(accountIds) : null;
  state.transactions.forEach(tx => {
    if (tx.is_future) return;
    if (tx.excluded) return;
    if (!isTxInPeriod(tx)) return;
    if (accFilter && !accFilter.has(tx.account_id)) return;
    const acc = state.accounts.find(a => a.id === tx.account_id);
    if (acc) {
      const accCur = acc.currency || settingsCur;
      const converted = convertCurrency(Number(tx.amount) || 0, accCur, settingsCur);
      const val = (converted !== null && converted !== undefined) ? converted : (Number(tx.amount) || 0);
      if (acc.type === 'liquid')      balances.liquid      += val;
      else if (acc.type === 'credit_card') balances.credit_card += val;
      else {
        if (!balances[acc.type]) balances[acc.type] = 0;
        balances[acc.type] += val;
      }
    }
    if (tx.is_receivable) {
      const acc = state.accounts.find(a => a.id === tx.account_id);
      const accCur = acc?.currency || settingsCur;
      const absAmt = Math.abs(Number(tx.amount) || 0);
      const converted = convertCurrency(absAmt, accCur, settingsCur);
      balances.receivables += (converted !== null && converted !== undefined) ? converted : absAmt;
    }
  });
  return balances;
}

// ── PERIOD FILTER ────────────────────────────────────────────
function getPeriodRange() {
  const p = state.period;
  if (!p || p.type === 'all') return { start: null, end: null };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (p.type === 'this_month') {
    return {
      start: new Date(year, month, 1).toISOString().split('T')[0],
      end: new Date(year, month + 1, 0).toISOString().split('T')[0]
    };
  }
  if (p.type === 'prev_month') {
    const prev = new Date(year, month - 1, 1);
    return {
      start: prev.toISOString().split('T')[0],
      end: new Date(prev.getFullYear(), prev.getMonth() + 1, 0).toISOString().split('T')[0]
    };
  }
  if (p.type === 'next_month') {
    const next = new Date(year, month + 1, 1);
    return {
      start: next.toISOString().split('T')[0],
      end: new Date(next.getFullYear(), next.getMonth() + 1, 0).toISOString().split('T')[0]
    };
  }
  if (p.type === 'last_3_months') {
    const start = new Date(year, month - 2, 1);
    return {
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    };
  }
  if (p.type === 'custom') {
    return { start: p.startDate || null, end: p.endDate || null };
  }
  return { start: null, end: null };
}

function isTxInPeriod(tx) {
  const range = getPeriodRange();
  if (!range.start && !range.end) return true;
  const d = tx.date || '';
  if (range.start && d < range.start) return false;
  if (range.end && d > range.end) return false;
  return true;
}

function getPeriodLabel() {
  const p = state.period;
  if (!p || p.type === 'all') return 'Todos';
  if (p.type === 'this_month') return 'Este mes';
  if (p.type === 'prev_month') return 'Mes anterior';
  if (p.type === 'next_month') return 'Próximo mes';
  if (p.type === 'last_3_months') return 'Últimos 3 meses';
  if (p.type === 'custom') {
    if (p.startDate && p.endDate) return formatDate(p.startDate) + ' – ' + formatDate(p.endDate);
    if (p.startDate) return 'Desde ' + formatDate(p.startDate);
    if (p.endDate) return 'Hasta ' + formatDate(p.endDate);
    return 'Personalizado';
  }
  return 'Todos';
}

// ── helpers de color de tag ───────────────────────────────────
function _tagColor(tag) {
  const predefined = state.predefined.tags.find(t => (typeof t === 'string' ? t : t.name) === tag);
  if (predefined && typeof predefined !== 'string' && predefined.color) {
    return { bg: predefined.color, text: '#555' };
  }
  let hash = 0;
  const str = (tag || '').toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return { bg: `hsl(${hue}, 55%, 88%)`, text: `hsl(${hue}, 50%, 30%)` };
}

// ── opciones de edición por campo ────────────────────────────
function getEditOptions(field, tx) {
  switch (field) {
    case 'date':
      return {
        type: 'date',
        parser: v => v || tx.date
      };
    case 'account_id':
      return {
        type: 'select',
        options: state.accounts.map(a => ({ value: a.id, label: a.name })),
        parser: v => v
      };
    case 'payee':
      return {
        type: 'text',
        suggestions: () => {
          const fromTxs = [...new Set(state.transactions.map(t => t.payee).filter(Boolean))];
          return [...new Set([...state.predefined.payees, ...fromTxs])];
        },
        parser: v => v.trim() || 'Sin asignar'
      };
    case 'category_name':
      return {
        type: 'text',
        suggestions: () => {
          const fromTxs = [...new Set(state.transactions.map(t => t.category_name).filter(Boolean))];
          const catNames = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name);
          return [...new Set([...catNames, ...fromTxs])];
        },
        parser: v => v.trim() || 'Sin asignar'
      };
    case 'notes':
      return {
        type: 'text',
        parser: v => v.trim()
      };
    case 'tags':
      return {
        type: 'tags',
        suggestions: () => {
          const fromTxs = [...new Set(state.transactions.flatMap(t => t.tags || []))];
          const tagNames = state.predefined.tags.map(t => typeof t === 'string' ? t : t.name);
          return [...new Set([...tagNames, ...fromTxs])];
        },
        parser: v => v   // ya es array
      };
    case 'amount': {
      const sign = tx.amount < 0 ? -1 : 1;
      return {
        type: 'number',
        parser: v => {
          const n = parseFloat(v);
          return isNaN(n) ? null : sign * Math.abs(n);
        }
      };
    }
    default:
      return null;
  }
}
