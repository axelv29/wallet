// ═══════════════════════════════════════════════════════════════════════
//  utils.js — Utilidades / helpers
//  Contiene: formatCurrency(), formatAccountCurrency(), getConvertedTooltip(),
//  formatDate(), getCategoryIcon(), calculateBalances(), getPeriodRange(),
//  isTxInPeriod(), _tagColor(), getEditOptions().
// ═══════════════════════════════════════════════════════════════════════

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

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

// ── CREDIT CARD CYCLE HELPERS ───────────────────────────
function getCurrentYearMonth() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function getCardSchedule(accountId, yearMonth) {
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc || acc.type !== 'credit_card' || !acc.card_schedule) return null;
  return acc.card_schedule[yearMonth] || null;
}

function getCardScheduleMonths(accountId) {
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc || !acc.card_schedule) return [];
  return Object.keys(acc.card_schedule).sort();
}

function yearMonthToDate(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function dateToYearMonth(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return dateToYearMonth(d);
}

// ── CLOSING PERIOD HELPERS ──────────────────────────────────
function getClosingPeriodKey(dateStr, closingDay) {
  const d = new Date(dateStr + 'T12:00:00');
  return dateToYearMonth(d);
}

function getClosingPeriodMonthLabel(periodKey) {
  const [y, m] = periodKey.split('-').map(Number);
  return (MONTH_NAMES[m - 1] || '') + ' ' + y;
}

function getBillingPeriodTxs(accountId, transactions) {
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc || acc.type !== 'credit_card' || !acc.card_schedule) return [];

  const settingsCur = state.settings.currency || 'ARS';
  const accCur = acc.currency || settingsCur;

  const groups = {};
  transactions.forEach(tx => {
    if (tx.account_id !== accountId) return;
    if (tx.is_future) return;
    if (tx.split_parent_id) return;
    const sch = acc.card_schedule[tx.date ? tx.date.substring(0, 7) : ''];
    const closingDay = sch ? sch.closing : 20;
    const key = getClosingPeriodKey(tx.date, closingDay);
    if (!groups[key]) groups[key] = { key, txs: [], total: 0, label: getClosingPeriodMonthLabel(key) };
    groups[key].txs.push(tx);
    const isPayment = (tx.tags || []).includes('Pago de tarjeta');
    if (!isPayment && !tx.excluded) {
      groups[key].total += Number(convertCurrency(Number(tx.amount) || 0, accCur, settingsCur)) || Number(tx.amount) || 0;
    }
  });

  return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
}

function toggleClosingGroup(key) {
  const groupKey = 'closing-group-' + key;
  const isOpen = sessionStorage.getItem(groupKey) === 'true';
  sessionStorage.setItem(groupKey, (!isOpen).toString());
}

function isClosingGroupOpen(key) {
  return sessionStorage.getItem('closing-group-' + key) === 'true';
}

function toggleClosingPaid(key, groupTotal, accountId) {
  const parts = key.split('|');
  const periodKey = parts[0];
  const accId = accountId || parts[1];
  if (!accId) return;

  const paid = isClosingPaid(key, groupTotal, accId);
  if (paid) {
    // Delete payment txs for this CC in this period
    state.transactions = state.transactions.filter(tx => {
      if (tx.account_id !== accId) return true;
      if (tx.date.substring(0, 7) !== periodKey) return true;
      if (!(tx.tags || []).includes('Pago de tarjeta')) return true;
      return false;
    });
  } else {
    // Create positive payment tx on CC
    const today = new Date().toISOString().split('T')[0];
    state.transactions.push({
      id: 'tx-' + Date.now(),
      date: today,
      account_id: accId,
      payee: 'Pago TC',
      category_name: 'Sin asignar',
      amount: Math.abs(groupTotal),
      notes: 'Pago automático de cierre',
      tags: ['Pago de tarjeta'],
      is_receivable: false,
      due_date: '',
      excluded: false,
      split_group: null,
      split_parent_id: null,
      amount_expression: null
    });
  }
  saveData('transactions');
}

function getPaymentSum(accountId, periodKey) {
  const settingsCur = state.settings.currency || 'ARS';
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc) return 0;
  const accCur = acc.currency || settingsCur;
  return state.transactions
    .filter(tx => {
      if (tx.account_id !== accountId) return false;
      if (tx.is_future) return false;
      if (!(tx.tags || []).includes('Pago de tarjeta')) return false;
      return tx.date.substring(0, 7) === periodKey;
    })
    .reduce((sum, tx) => {
      const converted = convertCurrency(Number(tx.amount) || 0, accCur, settingsCur);
      return sum + (converted !== null ? converted : (Number(tx.amount) || 0));
    }, 0);
}

function isClosingPaid(key, groupTotal, groupAccountId) {
  const parts = key.split('|');
  const periodKey = parts[0];
  const accountId = groupAccountId || parts[1];
  if (!accountId) return false;
  return getPaymentSum(accountId, periodKey) >= Math.abs(groupTotal);
}

function getCycleStartDate(accountId) {
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc || acc.type !== 'credit_card' || !acc.card_schedule) return null;

  const now = new Date();
  const today = now.getDate();
  const currentYM = dateToYearMonth(now);
  const prevYM = addMonths(currentYM, -1);

  const currentSchedule = acc.card_schedule[currentYM];
  const prevSchedule = acc.card_schedule[prevYM];

  if (currentSchedule) {
    if (today >= currentSchedule.closing) {
      // After this month's closing → cycle started day after closing
      const cycleStart = new Date(now.getFullYear(), now.getMonth(), currentSchedule.closing + 1);
      return cycleStart;
    } else {
      // Before this month's closing → cycle started day after last month's closing
      if (prevSchedule) {
        const prevMonthDate = yearMonthToDate(currentYM);
        const cycleStart = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), prevSchedule.closing + 1);
        return cycleStart;
      }
      // No prev schedule → can't determine cycle start
      return null;
    }
  }

  // No current month schedule → try previous
  if (prevSchedule) {
    const prevMonthDate = yearMonthToDate(currentYM);
    const cycleStart = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), prevSchedule.closing + 1);
    return cycleStart;
  }

  return null;
}

function calculateCycleBalance(accountId) {
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc || acc.type !== 'credit_card') return 0;

  const cycleStart = getCycleStartDate(accountId);
  if (!cycleStart) return 0;

  const settingsCur = state.settings.currency || 'ARS';
  const accCur = acc.currency || settingsCur;
  let total = 0;
  const startStr = cycleStart.toISOString().split('T')[0];

  state.transactions.forEach(tx => {
    if (tx.account_id !== accountId) return;
    if (tx.is_future) return;
    if (tx.excluded) return;
    if (tx.split_parent_id) return;
    if (tx.date < startStr) return;
    const converted = convertCurrency(Number(tx.amount) || 0, accCur, settingsCur);
    total += (converted !== null && converted !== undefined) ? converted : (Number(tx.amount) || 0);
  });

  return total;
}

function calculateBalances(accountIds) {
  const settingsCur = state.settings.currency || 'ARS';
  const balances = { liquid: 0, credit_card: 0, credit_card_cycle: 0, receivables: 0 };
  const accFilter = accountIds ? new Set(accountIds) : null;
  state.transactions.forEach(tx => {
    if (tx.is_future) return;
    if (tx.excluded) return;
    if (tx.split_parent_id) return;
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

  // Calculate cycle balance for all credit card accounts
  if (!accFilter) {
    state.accounts.filter(a => a.type === 'credit_card').forEach(acc => {
      balances.credit_card_cycle += calculateCycleBalance(acc.id);
    });
  } else {
    accFilter.forEach(id => {
      const acc = state.accounts.find(a => a.id === id);
      if (acc && acc.type === 'credit_card') {
        balances.credit_card_cycle += calculateCycleBalance(id);
      }
    });
  }

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

// ── CALCULADORA DE EXPRESIONES ─────────────────────────────
function isPlainNumber(str) {
  if (!str) return false;
  return /^-?\d+([.,]\d+)?$/.test(str.trim());
}

function evaluateExpression(expr, decimals) {
  if (!expr || typeof expr !== 'string') return null;
  expr = expr.trim();
  if (!expr) return null;

  const normalized = expr.replace(/,/g, '.');
  if (!/^[\d+\-*/().\s]+$/.test(normalized)) return null;

  const numbers = normalized.match(/\d+\.?\d*/g);
  if (numbers) {
    for (const num of numbers) {
      if (parseFloat(num) >= 1e15) return { value: null, error: 'too_large' };
    }
  }

  try {
    const result = Function('"use strict"; return (' + normalized + ')')();
    if (typeof result !== 'number' || !isFinite(result)) return { value: null, error: 'invalid' };
    if (Math.abs(result) >= 1e15) return { value: null, error: 'too_large' };

    const d = decimals ?? 2;
    return { value: parseFloat(result.toFixed(d)), error: null };
  } catch (e) {
    return { value: null, error: 'syntax' };
  }
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
        parser: (v, rawText) => {
          let n;
          if (rawText && !isPlainNumber(rawText)) {
            const res = evaluateExpression(rawText, state.settings.decimals);
            if (!res || res.error) return null;
            n = res.value;
          } else {
            n = parseFloat(v);
            if (isNaN(n)) return null;
          }
          return sign * Math.abs(n);
        }
      };
    }
    default:
      return null;
  }
}
