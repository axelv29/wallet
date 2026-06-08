// ═══════════════════════════════════════════════════════════════════════
//  currency.js — Conversión de monedas con cotizaciones en línea
//  Contiene: fetchExchangeRates(), convertCurrency(), getExchangeRate().
//  Fuente: open.er-api.com (gratuito, sin API key, CORS habilitado).
// ═══════════════════════════════════════════════════════════════════════

const EXCHANGE_RATE_API = 'https://open.er-api.com/v6/latest/';
const CACHE_KEY = 'wallet_exchange_rates';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

let _exchangeRates = null; // { base: 'USD', rates: { ARS: 1442, EUR: 0.87, ... }, timestamp: Date.now() }

function fetchExchangeRates() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
        _exchangeRates = parsed;
        return Promise.resolve(parsed);
      }
    } catch (e) { /* ignore corrupt cache */ }
  }

  return fetch(EXCHANGE_RATE_API + 'USD')
    .then(res => {
      if (!res.ok) throw new Error('Exchange rate fetch failed: ' + res.status);
      return res.json();
    })
    .then(data => {
      if (data.result !== 'success') throw new Error('API returned error');
      const rates = data.rates;
      // Ensure all needed currencies are present
      const needed = ['ARS', 'USD', 'EUR', 'UYU'];
      for (const c of needed) {
        if (typeof rates[c] !== 'number') throw new Error('Missing rate for ' + c);
      }
      const bundle = { base: 'USD', rates, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(bundle));
      _exchangeRates = bundle;
      return bundle;
    })
    .catch(err => {
      console.warn('[currency] Failed to fetch rates:', err.message);
      // If we have stale rates, use them
      if (_exchangeRates) return _exchangeRates;
      // Last resort: try to load stale cache
      if (cached) {
        try {
          _exchangeRates = JSON.parse(cached);
          return _exchangeRates;
        } catch (e) { /* nope */ }
      }
      return null;
    });
}

function getExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return 1;
  if (!_exchangeRates) return null;
  const rates = _exchangeRates.rates;
  // Rates are USD-based: rates['ARS'] = how many ARS per 1 USD
  const fromInUSD = rates[fromCurrency] ? (1 / rates[fromCurrency]) : null;
  const toInUSD   = rates[toCurrency]   ? (1 / rates[toCurrency])   : null;
  if (fromInUSD === null || toInUSD === null) return null;
  // fromCurrency -> USD -> toCurrency
  return fromInUSD * rates[toCurrency];
}

function convertCurrency(value, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return value;
  const rate = getExchangeRate(fromCurrency, toCurrency);
  if (rate === null) return value; // fallback: return original value
  return value * rate;
}
