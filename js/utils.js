// ═══════════════════════════════════════════════════════════════════════
//  utils.js — Utilidades / helpers
//  Contiene: formatCurrency(), formatDate(), getCategoryIcon(),
//  calculateBalances(), _tagColor(), getEditOptions().
// ═══════════════════════════════════════════════════════════════════════

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
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } else {
    return new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
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

function calculateBalances() {
  const balances = { liquid: 0, credit_card: 0, receivables: 0 };
  state.accounts.forEach(acc => {
    if (acc.type === 'liquid')      balances.liquid      += Number(acc.balance) || 0;
    if (acc.type === 'credit_card') balances.credit_card += Number(acc.balance) || 0;
  });
  state.transactions.forEach(tx => {
    if (tx.is_future) return;   // cuotas futuras no afectan balances actuales
    const acc = state.accounts.find(a => a.id === tx.account_id);
    if (acc) {
      if (acc.type === 'liquid')      balances.liquid      += Number(tx.amount) || 0;
      if (acc.type === 'credit_card') balances.credit_card += Number(tx.amount) || 0;
    }
    if (tx.is_receivable) balances.receivables += Math.abs(tx.amount);
  });
  return balances;
}

// ── helpers de color de tag ───────────────────────────────────
function _tagColor(tag) {
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
        parser: v => v.trim() || tx.payee
      };
    case 'category_name':
      return {
        type: 'text',
        suggestions: () => {
          const fromTxs = [...new Set(state.transactions.map(t => t.category_name).filter(Boolean))];
          const catNames = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name);
          return [...new Set([...catNames, ...fromTxs])];
        },
        parser: v => v.trim() || 'Otros'
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
          return [...new Set([...state.predefined.tags, ...fromTxs])];
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
