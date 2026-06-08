// ═══════════════════════════════════════════════════════════════════════
//  import.js — Importación de extractos bancarios (Gemini AI y CSV/XLS)
//  Contiene: modales de importación, integración con Gemini API,
//  procesamiento CSV/XLS, mapeo de columnas, preview, confirmación.
// ═══════════════════════════════════════════════════════════════════════

// ── IMPORT (GEMINI) ───────────────────────────────────────────
function openGeminiImportModal() {
  if (!state.settings.geminiKey) {
    alert('Configurá primero tu Gemini API Key en Ajustes → General.');
    showView('settings');
    return;
  }
  closeImportModal();
  updateSelectors();
  document.getElementById('import-setup-view').style.display  = 'block';
  document.getElementById('import-review-view').style.display = 'none';
  document.getElementById('import-modal').classList.add('open');
}

function closeGeminiImportModal() {
  document.getElementById('import-modal').classList.remove('open');
  state.importedTransactions = [];
}

function backToImportSetup() {
  document.getElementById('import-setup-view').style.display  = 'block';
  document.getElementById('import-review-view').style.display = 'none';
}

async function processImportWithGemini() {
  const text = document.getElementById('import-text').value.trim();
  const key  = state.settings.geminiKey;
  const btn  = document.getElementById('btn-process-import');

  if (!text) { alert('Ingresá el texto del extracto bancario.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2"></i> Procesando…';
  lucide.createIcons();

  const categoriesList = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name).join(', ');
  const curCode = state.settings.currency || 'ARS';
  const prompt = `Actúas como un procesador estructurado de extractos bancarios en español.
Analiza el siguiente texto y extrae todas las transacciones financieras.
Moneda del usuario: ${curCode}.

Texto:
"${text}"

Categorías válidas (usá estrictamente una de estas o mapeá a 'Otros'):
[${categoriesList}]

Reglas:
- Gastos/egresos: monto NEGATIVO.
- Ingresos/cobros: monto POSITIVO.
- Fechas en formato YYYY-MM-DD. Si no hay año, usá 2026.
- Respondé ÚNICAMENTE con un arreglo JSON válido, sin markdown ni texto adicional.
- Todos los montos deben expresarse numéricamente en ${curCode}.

Formato:
[{"date":"YYYY-MM-DD","payee":"Nombre","amount":-120.00,"category":"Categoría","notes":""}]`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const result = await response.json();
    let textResponse = result.candidates[0].content.parts[0].text;
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedTxs = JSON.parse(textResponse);

    if (Array.isArray(parsedTxs)) {
      state.importedTransactions = parsedTxs;
      renderImportReview();
    } else {
      throw new Error('JSON inválido');
    }
  } catch (err) {
    console.error(err);
    alert('Error al procesar con Gemini. Revisá tu API Key y la consola.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="sparkles"></i> Procesar con Gemini IA';
    lucide.createIcons();
  }
}

function renderImportReview() {
  document.getElementById('import-setup-view').style.display  = 'none';
  document.getElementById('import-review-view').style.display = 'block';

  const tbody = document.getElementById('import-review-tbody');
  tbody.innerHTML = '';

  state.importedTransactions.forEach((tx, idx) => {
    const catOptions = state.predefined.categories.map(c => {
      const name = typeof c === 'string' ? c : c.name;
      return `<option value="${name}" ${name.toLowerCase() === (tx.category || '').toLowerCase() ? 'selected' : ''}>${name}</option>`;
    }).join('');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="date" value="${tx.date}" onchange="updateImportedTx(${idx}, 'date', this.value)"></td>
      <td><input type="text" value="${tx.payee}" onchange="updateImportedTx(${idx}, 'payee', this.value)"></td>
      <td><select onchange="updateImportedTx(${idx}, 'category_name', this.value)">${catOptions}</select></td>
      <td><input type="number" step="0.01" value="${tx.amount}" style="text-align:right;" onchange="updateImportedTx(${idx}, 'amount', parseFloat(this.value))"></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateImportedTx(index, field, value) {
  state.importedTransactions[index][field] = value;
}

function confirmImportedTransactions() {
  const accountId = document.getElementById('import-account-id').value;
  const newTxs = state.importedTransactions.map(itx => ({
    id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    date: itx.date,
    account_id: accountId,
    payee: itx.payee,
    category_name: itx.category_name || itx.category || 'Otros',
    amount: parseFloat(itx.amount),
    notes: itx.notes || '',
    tags: [],
    is_receivable: false
  }));
  state.transactions = [...newTxs, ...state.transactions];
  saveData('transactions');
  closeGeminiImportModal();
  renderAll();
}

// ════════════════════════════════════════════════════════════
//  CSV / XLS IMPORTER
// ════════════════════════════════════════════════════════════

const CSV_FIELD_OPTIONS = [
  { value: 'ignore', label: 'Ignorar', cls: 'csv-opt-ignore' },
  { value: 'date', label: 'Fecha' },
  { value: 'payee', label: 'Beneficiario' },
  { value: 'amount', label: 'Monto (automático)' },
  { value: 'debit', label: 'Débito (gasto)' },
  { value: 'credit', label: 'Crédito (ingreso)' },
  { value: 'category', label: 'Categoría' },
  { value: 'notes', label: 'Notas' },
  { value: 'tags', label: 'Etiquetas' },
];

let csvImportState = {
  rawData: [],
  rawText: '',
  isExcel: false,
  headers: [],
  mapping: {},
  fileName: '',
  fileDims: '',
};

function initCsvDropzone() {
  const dz = document.getElementById('csv-dropzone');
  if (!dz) return;
  ['dragenter', 'dragover'].forEach(ev => {
    dz.addEventListener(ev, e => { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; dz.style.background = 'var(--accent-soft)'; });
  });
  ['dragleave', 'drop'].forEach(ev => {
    dz.addEventListener(ev, e => { e.preventDefault(); dz.style.borderColor = ''; dz.style.background = ''; });
  });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });
}

function openImportModal() {
  document.getElementById('csv-import-modal')?.classList.add('open');
  resetCsvImport();
}

function closeImportModal() {
  document.getElementById('csv-import-modal')?.classList.remove('open');
}

function resetCsvImport() {
  csvImportState = { rawData: [], rawText: '', isExcel: false, headers: [], mapping: {}, fileName: '', fileDims: '' };
  document.getElementById('csv-step-upload').style.display = '';
  document.getElementById('csv-step-mapping').style.display = 'none';
  document.getElementById('csv-file-input').value = '';
  document.getElementById('csv-import-errors').textContent = '';
  const dropzone = document.getElementById('csv-dropzone');
  if (dropzone) dropzone.style.display = '';
}

// ── FILE SELECTION & PARSING ──────────────────────────────

function onCsvFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  processFile(file);
}

function processFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  csvImportState.fileName = file.name;

  const reader = new FileReader();

  if (ext === 'csv') {
    reader.onload = e => {
      parseCsvData(e.target.result);
    };
    reader.readAsText(file);
  } else if (ext === 'xls' || ext === 'xlsx') {
    reader.onload = e => {
      parseXlsxData(e.target.result, file.name);
    };
    reader.readAsArrayBuffer(file);
  } else {
    showCsvError('Formato no soportado. Usá CSV, XLS o XLSX.');
  }
}

function parseCsvData(text) {
  const sep = getCsvSeparator(text);
  const raw = parseCsv(text, sep);
  if (raw.length < 1) { showCsvError('El archivo está vacío o no se pudo leer.'); return; }
  csvImportState.rawData = raw;
  csvImportState.rawText = text;
  csvImportState.isExcel = false;
  csvImportState.fileDims = `${raw[0].length} columnas · ${raw.length} filas`;
  afterParse();
}

function parseXlsxData(buffer, fileName) {
  if (typeof XLSX === 'undefined') {
    showCsvError('La librería XLSX no está cargada. Verificá tu conexión.');
    return;
  }
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (data.length < 1) { showCsvError('El archivo Excel está vacío.'); return; }
    csvImportState.rawData = data.map(row =>
      row.map(cell => (cell === null || cell === undefined ? '' : String(cell)))
    );
    csvImportState.rawText = '';
    csvImportState.isExcel = true;
    csvImportState.fileDims = `${csvImportState.rawData[0].length} columnas · ${csvImportState.rawData.length} filas`;
    afterParse();
  } catch (err) {
    showCsvError('Error al leer el archivo Excel: ' + err.message);
  }
}

function showCsvError(msg) {
  const el = document.getElementById('csv-import-errors');
  if (el) el.textContent = msg;
}

function getCsvSeparator(text) {
  const sel = document.getElementById('csv-separator');
  if (sel && sel.value !== 'auto') return sel.value;
  const firstLine = text.split('\n')[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > semicolons && tabs > commas) return '\t';
  if (semicolons >= commas) return ';';
  return ',';
}

function parseCsv(text, separator) {
  const lines = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === separator) { current.push(field.trim()); field = ''; }
      else if (ch === '\n') { current.push(field.trim()); if (current.length > 0 && current.some(c => c !== '')) lines.push(current); current = []; field = ''; }
      else if (ch === '\r') { /* ignore */ }
      else { field += ch; }
    }
  }
  // Last field
  current.push(field.trim());
  if (current.length > 0 && current.some(c => c !== '')) lines.push(current);
  return lines;
}

function afterParse() {
  const raw = csvImportState.rawData;
  const hasHeader = document.getElementById('csv-has-header').checked;

  if (hasHeader && raw.length > 0) {
    csvImportState.headers = raw[0];
    csvImportState.rawData = raw.slice(1);
  } else {
    csvImportState.headers = raw[0].map((_, i) => 'Columna ' + (i + 1));
  }

  // Auto-map columns
  autoMapColumns();

  // Show mapping view
  document.getElementById('csv-step-upload').style.display = 'none';
  document.getElementById('csv-step-mapping').style.display = '';
  document.getElementById('csv-dropzone').style.display = 'none';

  document.getElementById('csv-file-name').textContent = csvImportState.fileName;
  document.getElementById('csv-file-dims').textContent = '· ' + csvImportState.fileDims;

  // Populate account selector
  const accSel = document.getElementById('csv-target-account');
  if (accSel) {
    accSel.innerHTML = '<option value="">Seleccionar cuenta…</option>';
    state.accounts.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name + (a.type === 'credit_card' ? ' (TC)' : '');
      accSel.appendChild(opt);
    });
    accSel.onchange = onCsvMappingChange;
  }

  renderCsvMapping();
}

// ── AUTO-MAPPING ──────────────────────────────────────────

function autoMapColumns() {
  const h = csvImportState.headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const map = {};
  h.forEach((header, i) => {
    if (/fecha|fec|date|dt|movimiento/i.test(header)) map[i] = 'date';
    else if (/beneficiari|payee|descripcion|descrip|detalle|concepto|razon/i.test(header)) map[i] = 'payee';
    else if (/monto|importe|valor|total|amount/i.test(header)) map[i] = 'amount';
    else if (/debito|debe|debit|egreso|gasto|salida|retiro/i.test(header)) map[i] = 'debit';
    else if (/credito|haber|credit|ingreso|deposito|entrada/i.test(header)) map[i] = 'credit';
    else if (/categoria|category|categ/i.test(header)) map[i] = 'category';
    else if (/nota|note|obs|observacion|comentario/i.test(header)) map[i] = 'notes';
    else if (/etiqueta|tag|tags/i.test(header)) map[i] = 'tags';
    else if (/saldo|balance/i.test(header)) map[i] = 'ignore';
    else map[i] = 'ignore';
  });
  csvImportState.mapping = map;
}

// ── RENDER MAPPING TABLE ──────────────────────────────────

function renderCsvMapping() {
  const thead = document.getElementById('csv-mapping-head');
  const tbody = document.getElementById('csv-mapping-body');
  if (!thead || !tbody) return;
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const raw = csvImportState.rawData;
  const headers = csvImportState.headers;
  const map = csvImportState.mapping;

  // Header row
  const headerTr = document.createElement('tr');
  headers.forEach((h, i) => {
    const th = document.createElement('th');
    const isIgnored = map[i] === 'ignore' || !map[i];
    th.className = isIgnored ? 'csv-col-ignore' : '';

    const label = document.createElement('div');
    label.textContent = h || 'Columna ' + (i + 1);
    th.appendChild(label);

    const sel = document.createElement('select');
    CSV_FIELD_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.cls) o.className = opt.cls;
      if ((map[i] || 'ignore') === opt.value) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      csvImportState.mapping[i] = sel.value;
      renderCsvMapping();
      onCsvMappingChange();
    };
    th.appendChild(sel);
    headerTr.appendChild(th);
  });
  thead.appendChild(headerTr);

  // Data rows (max 15)
  const maxRows = Math.min(raw.length, 15);
  for (let r = 0; r < maxRows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < headers.length; c++) {
      const td = document.createElement('td');
      const val = raw[r][c] || '';
      td.textContent = val;
      const isIgnored = map[c] === 'ignore' || !map[c];
      td.className = isIgnored ? 'csv-cell-ignore' : 'csv-cell-mapped';
      td.title = val;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  if (raw.length > maxRows) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = headers.length;
    td.textContent = '… y ' + (raw.length - maxRows) + ' filas más';
    td.style.cssText = 'text-align:center;color:var(--text-lo);font-style:italic;padding:8px;';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  onCsvMappingChange();
}

function reparseCsv() {
  const hasHeader = document.getElementById('csv-has-header')?.checked ?? true;
  if (csvImportState.isExcel) {
    const raw = csvImportState.rawData;
    if (hasHeader && raw.length > 0) {
      csvImportState.headers = raw[0];
      csvImportState.rawData = raw.slice(1);
    } else {
      csvImportState.headers = raw[0].map((_, i) => 'Columna ' + (i + 1));
    }
    autoMapColumns();
    renderCsvMapping();
    return;
  }
  if (csvImportState.rawText) {
    const sep = getCsvSeparator(csvImportState.rawText);
    const allRows = parseCsv(csvImportState.rawText, sep);
    if (allRows.length > 0) {
      if (hasHeader) {
        csvImportState.headers = allRows[0];
        csvImportState.rawData = allRows.slice(1);
      } else {
        csvImportState.headers = allRows[0].map((_, i) => 'Columna ' + (i + 1));
      }
      csvImportState.fileDims = `${csvImportState.rawData[0]?.length || 0} columnas · ${csvImportState.rawData.length} filas`;
    }
  }
  if (csvImportState.rawData.length > 0) {
    autoMapColumns();
    renderCsvMapping();
  }
}

// ── PREVIEW & CONFIRM ─────────────────────────────────────

function onCsvMappingChange() {
  const preview = document.getElementById('csv-preview-section');
  const tbody = document.getElementById('csv-preview-tbody');
  const countEl = document.getElementById('csv-import-count');
  const btn = document.getElementById('btn-csv-import');

  const parsed = buildTransactionsFromMapping();
  if (parsed.length === 0) {
    preview.style.display = 'none';
    btn.disabled = true;
    return;
  }

  btn.disabled = false;
  preview.style.display = '';
  countEl.textContent = parsed.length;

  tbody.innerHTML = '';
  const importAccId = document.getElementById('import-account-id')?.value;
  const importAcc = state.accounts.find(a => a.id === importAccId);
  const importCur = importAcc?.currency || state.settings.currency || 'ARS';
  parsed.forEach(tx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${tx.date || '—'}</td>
      <td>${tx.payee || '—'}</td>
      <td>${tx.category_name || '—'}</td>
      <td class="r ${tx.amount < 0 ? 'expense' : 'income'}">${formatAccountCurrency(tx.amount, importCur)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function buildTransactionsFromMapping() {
  const raw = csvImportState.rawData;
  const map = csvImportState.mapping;
  const accountId = document.getElementById('csv-target-account')?.value;
  if (!accountId) return [];

  const dateFmt = document.getElementById('csv-date-format')?.value || 'auto';
  const numFmt = document.getElementById('csv-number-format')?.value || 'auto';

  const results = [];

  raw.forEach(row => {
    let tx = {
      date: '',
      payee: '',
      amount: 0,
      category_name: '',
      notes: '',
      tags: [],
      account_id: accountId,
    };

    let hasDate = false, hasPayee = false, hasAmount = false;

    Object.keys(map).forEach(colIdx => {
      const field = map[colIdx];
      const val = (row[parseInt(colIdx)] || '').trim();
      if (!val) return;

      switch (field) {
        case 'date': {
          const parsed = parseDate(val, dateFmt);
          if (parsed) { tx.date = parsed; hasDate = true; }
          break;
        }
        case 'payee': {
          tx.payee = val;
          hasPayee = true;
          break;
        }
        case 'amount': {
          const num = parseNumber(val, numFmt);
          if (!isNaN(num)) { tx.amount += num; hasAmount = true; }
          break;
        }
        case 'debit': {
          const num = parseNumber(val, numFmt);
          if (!isNaN(num) && num > 0) { tx.amount -= Math.abs(num); hasAmount = true; }
          break;
        }
        case 'credit': {
          const num = parseNumber(val, numFmt);
          if (!isNaN(num) && num > 0) { tx.amount += Math.abs(num); hasAmount = true; }
          break;
        }
        case 'category': {
          tx.category_name = val;
          break;
        }
        case 'notes': {
          tx.notes = val;
          break;
        }
        case 'tags': {
          tx.tags = val.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
          break;
        }
      }
    });

    if (hasDate && hasPayee && hasAmount && tx.amount !== 0) {
      results.push(tx);
    }
  });

  return results;
}

function parseDate(val, format) {
  val = val.trim();
  if (!val) return '';

  // Already ISO-like
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  let parts;
  if (format === 'auto') {
    // Try common formats
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) parts = val.split('/');
    else if (/^\d{2}\/\d{2}\/\d{2}$/.test(val)) parts = val.split('/');
    else if (/^\d{2}-\d{2}-\d{4}$/.test(val)) parts = val.split('-');
    else if (/^\d{2}-\d{2}-\d{2}$/.test(val)) parts = val.split('-');
    else if (/^\d{4}\/\d{2}\/\d{2}$/.test(val)) parts = val.split('/');
    else if (/^\d{8}$/.test(val)) {
      // DDMMYYYY or YYYYMMDD
      if (val.substring(0, 4) > '1900' && val.substring(0, 4) < '2100') {
        return val.substring(0, 4) + '-' + val.substring(4, 6) + '-' + val.substring(6, 8);
      }
      return val.substring(4, 6) + '-' + val.substring(6, 8) + '-' + val.substring(0, 4);
    }
    else return val; // fallback

    if (parts && parts[2].length === 4 && parseInt(parts[2]) > 1900) {
      // Likely DD/MM/YYYY
      return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    }
    if (parts && parts[2].length === 2) {
      const y = parseInt(parts[2]) + 2000;
      return y + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    }
    return val;
  }

  // Specific format
  if (format === 'dd/mm/yyyy') {
    parts = val.split(/[\/\-\.]/);
    if (parts.length === 3) return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
  }
  if (format === 'mm/dd/yyyy') {
    parts = val.split(/[\/\-\.]/);
    if (parts.length === 3) return parts[2] + '-' + parts[0].padStart(2, '0') + '-' + parts[1].padStart(2, '0');
  }
  if (format === 'yyyy-mm-dd') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    parts = val.split(/[\/\-\.]/);
    if (parts.length === 3) return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
  }
  if (format === 'dd/mm/yy') {
    parts = val.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let y = parseInt(parts[2]);
      if (y < 100) y += 2000;
      return y + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    }
  }

  return val;
}

function parseNumber(val, format) {
  if (!val) return NaN;
  let s = val.trim();
  // Remove currency symbols and spaces
  s = s.replace(/[$€£¥$]\s*/g, '').replace(/\s+/g, '');

  if (format === 'auto') {
    // Detect format: if uses . for thousands and , for decimals → EU
    // If uses , for thousands and . for decimals → US
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    if (hasDot && hasComma) {
      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      if (lastComma > lastDot) {
        // EU: 1.234,56
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // US: 1,234.56
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Could be EU decimal (1234,56) or US thousands (1,234)
      // If only one comma and followed by exactly 2 digits → EU decimal
      const parts = s.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        s = s.replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    }
    // If hasDot but no comma, it's either US decimal or thousands separator
    // Try to interpret: if after last dot there are 2 digits → likely decimal
    else if (hasDot) {
      const parts = s.split('.');
      if (parts.length > 1) {
        const last = parts[parts.length - 1];
        if (last.length === 2 && parts.length > 2) {
          // EU: 1.234.56 → remove dots except last
          s = s.replace(/\./g, '');
          s = s.substring(0, s.length - 2) + '.' + s.substring(s.length - 2);
        }
        // else: US or simple number with dot → keep as is
      }
    }
  } else if (format === 'eu') {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (format === 'us') {
    s = s.replace(/,/g, '');
  }

  const num = parseFloat(s);
  return isNaN(num) ? NaN : num;
}

function confirmCsvImport() {
  const parsed = buildTransactionsFromMapping();
  if (parsed.length === 0) {
    showCsvError('No hay movimientos válidos para importar. Revisá el mapeo de columnas.');
    return;
  }

  const existingIds = new Set(state.transactions.map(t => t.id));
  let idCounter = 0;

  parsed.forEach(tx => {
    let id = 'tx-' + Date.now() + '-' + (++idCounter);
    while (existingIds.has(id)) id = 'tx-' + Date.now() + '-' + (++idCounter);
    existingIds.add(id);
    state.transactions.push({
      id,
      date: tx.date,
      account_id: tx.account_id,
      payee: tx.payee,
      category_name: tx.category_name || 'Otros',
      amount: tx.amount,
      notes: tx.notes || '',
      tags: tx.tags || [],
      is_receivable: false,
      due_date: '',
      is_future: false,
      installment_id: null,
      installment_total: null,
      installment_index: null,
    });
    // Auto-add new payees and categories
    if (tx.payee && !state.predefined.payees.includes(tx.payee)) {
      state.predefined.payees.push(tx.payee);
    }
    if (tx.category_name) {
      const exists = state.predefined.categories.some(c =>
        (typeof c === 'string' ? c : c.name) === tx.category_name
      );
      if (!exists) {
        state.predefined.categories.push({ name: tx.category_name, icon: 'tag' });
      }
    }
  });

  saveData('transactions');
  saveData('predefined');
  renderAll();
  closeImportModal();
}

// ── SAMPLE DATA ───────────────────────────────────────────

function loadSampleCsv(type) {
  let text = '';
  if (type === 'bank') {
    text = `Fecha;Descripción;Débito;Crédito;Saldo
02/06/2026;Supermercado Coto;12580,00;;45200,00
03/06/2026;Farmacia;3450,00;;41750,00
04/06/2026;Sueldo Mensual;;250000,00;291750,00
05/06/2026;Estacionamiento;800,00;;290950,00
06/06/2026;Netflix;3899,00;;287051,00
07/06/2026;Recarga SUBE;2000,00;;285051,00
08/06/2026;Transferencia de Leo;;15000,00;300051,00
09/06/2026;Mercado Pago - envio;4500,00;;295551,00
10/06/2026;Restaurante La Farola;8900,00;;286651,00`;
  } else {
    text = `Fecha;Establecimiento;Categoría;Monto
01/06/2026;McDonald's;Comidas;4580,00
02/06/2026;Spotify;Entretenimiento;1299,00
03/06/2026;Falabella;Indumentaria;25000,00
05/06/2026;Disney+;Entretenimiento;3899,00
07/06/2026;Coto;Supermercado;18750,00
10/06/2026;YPF;Transporte;15000,00`;
  }

  // Set separator to semicolon
  const sepSel = document.getElementById('csv-separator');
  if (sepSel) sepSel.value = ';';

  // Parse directly
  const sep = ';';
  const raw = parseCsv(text, sep);
  if (raw.length < 1) return;
  csvImportState.rawData = raw;
  csvImportState.rawText = text;
  csvImportState.isExcel = false;
  csvImportState.fileName = type === 'bank' ? 'extracto_bancario.csv' : 'resumen_tarjeta.csv';
  csvImportState.fileDims = `${raw[0].length} columnas · ${raw.length} filas`;
  document.getElementById('csv-dropzone').style.display = 'none';
  afterParse();
}
