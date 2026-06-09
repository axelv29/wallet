// ═══════════════════════════════════════════════════════════════════════
//  import.js — Importación de extractos bancarios (CSV/XLS y Gemini IA)
//  Contiene: modales de importación, procesamiento CSV/XLS,
//  mapeo de columnas, preview, confirmación, y procesamiento de
//  archivos PDF/imagen con Gemini API.
// ═══════════════════════════════════════════════════════════════════════

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

function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\S+/g, word => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

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
  csvImportState = { rawData: [], rawText: '', isExcel: false, headers: [], mapping: {}, fileName: '', fileDims: '', previewEdits: null };
  document.getElementById('csv-step-upload').style.display = '';
  document.getElementById('csv-step-mapping').style.display = 'none';
  document.getElementById('csv-file-input').value = '';
  document.getElementById('csv-import-errors').textContent = '';
  const dropzone = document.getElementById('csv-dropzone');
  if (dropzone) dropzone.style.display = '';
  const aiInput = document.getElementById('csv-ai-file-input');
  if (aiInput) aiInput.value = '';
  const aiBtn = document.querySelector('.csv-ai-btn');
  if (aiBtn) { aiBtn.disabled = false; aiBtn.innerHTML = '<i data-lucide="sparkles"></i> Importar con IA'; lucide.createIcons(); }
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

  autoMapColumns();

  document.getElementById('csv-step-upload').style.display = 'none';
  document.getElementById('csv-step-mapping').style.display = '';
  document.getElementById('csv-dropzone').style.display = 'none';

  document.getElementById('csv-file-name').textContent = csvImportState.fileName;
  document.getElementById('csv-file-dims').textContent = '· ' + csvImportState.fileDims;

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
  const importAccId = document.getElementById('csv-target-account')?.value;
  const importAcc = state.accounts.find(a => a.id === importAccId);
  const importCur = importAcc?.currency || state.settings.currency || 'ARS';
  const cats = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name);

  parsed.forEach((tx, idx) => {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    const inpDate = document.createElement('input');
    inpDate.type = 'date';
    inpDate.value = tx.date;
    inpDate.style.cssText = 'width:100%;height:26px;font-size:11.5px;padding:2px 4px;';
    inpDate.onchange = () => { csvImportState.previewEdits = csvImportState.previewEdits || {}; csvImportState.previewEdits[idx] = csvImportState.previewEdits[idx] || {}; csvImportState.previewEdits[idx].date = inpDate.value; };
    tdDate.appendChild(inpDate);

    const tdPayee = document.createElement('td');
    const inpPayee = document.createElement('input');
    inpPayee.type = 'text';
    inpPayee.value = tx.payee;
    inpPayee.style.cssText = 'width:100%;height:26px;font-size:11.5px;padding:2px 4px;';
    inpPayee.onchange = () => { csvImportState.previewEdits = csvImportState.previewEdits || {}; csvImportState.previewEdits[idx] = csvImportState.previewEdits[idx] || {}; csvImportState.previewEdits[idx].payee = inpPayee.value; };
    tdPayee.appendChild(inpPayee);

    const tdCat = document.createElement('td');
    const selCat = document.createElement('select');
    selCat.style.cssText = 'width:100%;height:26px;font-size:11.5px;padding:2px 4px;';
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c.toLowerCase() === (tx.category_name || '').toLowerCase()) opt.selected = true;
      selCat.appendChild(opt);
    });
    selCat.onchange = () => { csvImportState.previewEdits = csvImportState.previewEdits || {}; csvImportState.previewEdits[idx] = csvImportState.previewEdits[idx] || {}; csvImportState.previewEdits[idx].category_name = selCat.value; };
    tdCat.appendChild(selCat);

    const tdAmt = document.createElement('td');
    tdAmt.className = 'r ' + (tx.amount < 0 ? 'expense' : 'income');
    const inpAmt = document.createElement('input');
    inpAmt.type = 'number';
    inpAmt.step = '0.01';
    inpAmt.value = tx.amount;
    inpAmt.style.cssText = 'width:100%;height:26px;font-size:11.5px;padding:2px 4px;text-align:right;';
    inpAmt.onchange = () => { csvImportState.previewEdits = csvImportState.previewEdits || {}; csvImportState.previewEdits[idx] = csvImportState.previewEdits[idx] || {}; csvImportState.previewEdits[idx].amount = parseFloat(inpAmt.value); };
    tdAmt.appendChild(inpAmt);

    tr.appendChild(tdDate);
    tr.appendChild(tdPayee);
    tr.appendChild(tdCat);
    tr.appendChild(tdAmt);
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
          tx.payee = toTitleCase(val);
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
      tx.payee = toTitleCase(tx.payee);
      tx.category_name = toTitleCase(tx.category_name);
      results.push(tx);
    }
  });

  const edits = csvImportState.previewEdits;
  if (edits) {
    results.forEach((tx, i) => {
      if (edits[i]) {
        if (edits[i].date !== undefined) tx.date = edits[i].date;
        if (edits[i].payee !== undefined) tx.payee = toTitleCase(edits[i].payee);
        if (edits[i].category_name !== undefined) tx.category_name = toTitleCase(edits[i].category_name);
        if (edits[i].amount !== undefined) tx.amount = edits[i].amount;
      }
    });
  }

  return results;
}

function parseDate(val, format) {
  val = val.trim();
  if (!val) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  let parts;
  if (format === 'auto') {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) parts = val.split('/');
    else if (/^\d{2}\/\d{2}\/\d{2}$/.test(val)) parts = val.split('/');
    else if (/^\d{2}-\d{2}-\d{4}$/.test(val)) parts = val.split('-');
    else if (/^\d{2}-\d{2}-\d{2}$/.test(val)) parts = val.split('-');
    else if (/^\d{4}\/\d{2}\/\d{2}$/.test(val)) parts = val.split('/');
    else if (/^\d{8}$/.test(val)) {
      if (val.substring(0, 4) > '1900' && val.substring(0, 4) < '2100') {
        return val.substring(0, 4) + '-' + val.substring(4, 6) + '-' + val.substring(6, 8);
      }
      return val.substring(4, 6) + '-' + val.substring(6, 8) + '-' + val.substring(0, 4);
    }
    else return val;

    if (parts && parts[2].length === 4 && parseInt(parts[2]) > 1900) {
      return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    }
    if (parts && parts[2].length === 2) {
      const y = parseInt(parts[2]) + 2000;
      return y + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    }
    return val;
  }

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
  s = s.replace(/[$€£¥$]\s*/g, '').replace(/\s+/g, '');

  if (format === 'auto') {
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    if (hasDot && hasComma) {
      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      if (lastComma > lastDot) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      const parts = s.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        s = s.replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    }
    else if (hasDot) {
      const parts = s.split('.');
      if (parts.length > 1) {
        const last = parts[parts.length - 1];
        if (last.length === 2 && parts.length > 2) {
          s = s.replace(/\./g, '');
          s = s.substring(0, s.length - 2) + '.' + s.substring(s.length - 2);
        }
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
  const importedIds = [];

  parsed.forEach(tx => {
    let id = 'tx-' + Date.now() + '-' + (++idCounter);
    while (existingIds.has(id)) id = 'tx-' + Date.now() + '-' + (++idCounter);
    existingIds.add(id);
    importedIds.push(id);
    state.transactions.push({
      id,
      date: tx.date,
      account_id: tx.account_id,
      payee: toTitleCase(tx.payee),
      category_name: toTitleCase(tx.category_name) || 'Otros',
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
    if (tx.payee && !state.predefined.payees.includes(toTitleCase(tx.payee))) {
      state.predefined.payees.push(toTitleCase(tx.payee));
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

  if (importedIds.length > 0) {
    importedIds.forEach(id => state.selectedTxIds.add(id));
    updateSelectionBar();
    const rows = document.querySelectorAll('#tx-table-body tr');
    rows.forEach(row => {
      const cb = row.querySelector('.tx-checkbox');
      if (cb && importedIds.includes(cb.dataset.txId)) {
        row.classList.add('selected');
        cb.checked = true;
      }
    });
  }
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

  const sepSel = document.getElementById('csv-separator');
  if (sepSel) sepSel.value = ';';

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

// ════════════════════════════════════════════════════════════
//  GEMINI AI — PDF / IMAGE IMPORT
// ════════════════════════════════════════════════════════════

function onAiFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  processFileWithGemini(file);
}

function getMimeType(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const map = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processFileWithGemini(file) {
  const key = state.settings.geminiKey;
  if (!key) {
    alert('Configurá tu Gemini API Key en Ajustes → General.');
    closeImportModal();
    showView('settings');
    return;
  }

  const supportedExts = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!supportedExts.includes(ext)) {
    showCsvError('Formato no soportado. Subí un archivo PDF, PNG, JPG o WEBP.');
    return;
  }

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    showCsvError('El archivo es muy grande (' + Math.round(file.size / 1024 / 1024) + ' MB). El máximo es 10 MB.');
    return;
  }

  const aiBtn = document.querySelector('.csv-ai-btn');
  const aiFileInput = document.getElementById('csv-ai-file-input');
  if (aiBtn) {
    aiBtn.disabled = true;
    aiBtn.innerHTML = '<i data-lucide="loader-2" class="spinning"></i> Procesando…';
    lucide.createIcons();
  }

  try {
    const base64Data = await readFileAsBase64(file);
    const mimeType = getMimeType(file);

    const categoriesList = state.predefined.categories.map(c => typeof c === 'string' ? c : c.name).join(', ');
    const curCode = state.settings.currency || 'ARS';

    const prompt = `Actúas como un procesador de extractos bancarios.
El usuario subió un archivo que contiene su extracto bancario o resumen de cuenta.
Tu tarea es extraer TODAS las transacciones visibles en el archivo.

Moneda del usuario: ${curCode}.

Categorías válidas (usá estrictamente una de estas o mapeá a 'Otros'):
[${categoriesList}]

Respondé ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional.

El JSON debe tener esta estructura exacta:
{
  "headers": ["Fecha", "Beneficiario", "Monto", "Categoría"],
  "rows": [
    ["02/06/2026", "Supermercado Coto", "-12580.00", "Supermercado"],
    ["04/06/2026", "Sueldo Mensual", "250000.00", "Otros"]
  ]
}

Reglas:
- "headers" debe contener los nombres de las columnas que detectes.
- "rows" debe contener arrays donde cada elemento corresponde al header en la misma posición.
- Gastos/egresos: monto NEGATIVO (con signo -).
- Ingresos/cobros: monto POSITIVO.
- Si hay columnas separadas de Débito y Crédito, creá columnas "Débito" y "Crédito" con valores positivos.
- Fechas: mantené el formato original del archivo.
- Si no podés detectar una categoría, usá 'Otros'.
- No omitas ninguna transacción.
- Montos numéricos sin símbolo de moneda ni separadores de miles.`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }]
    };

    console.log('[IA] Enviando archivo a Gemini:', file.name, mimeType, '(' + Math.round(base64Data.length * 0.75 / 1024) + ' KB)');

    const maxRetries = 2;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log('[IA] Reintento ' + attempt + '/' + maxRetries + '…');
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      let response;
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      const result = await response.json();

      if (response.ok) {
        let textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) throw new Error('Respuesta vacía de Gemini');

        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        console.log('[IA] Respuesta:', textResponse.substring(0, 200));
        const parsed = JSON.parse(textResponse);

        if (!parsed.headers || !parsed.rows || !Array.isArray(parsed.rows)) {
          throw new Error('Formato de respuesta inválido de la IA');
        }

        console.log('[IA] Transacciones extraídas:', parsed.rows.length);
        loadGeminiDataAsCsv(parsed, file.name);
        return;
      }

      console.error('[IA] Error HTTP:', response.status, result);
      const apiMsg = result.error?.message || '';
      const isRetryable = response.status === 503 || apiMsg.includes('high demand') || apiMsg.includes('unavailable');

      if (!isRetryable || attempt === maxRetries) {
        if (response.status === 429 || apiMsg.includes('quota') || apiMsg.includes('rate limit')) {
          throw new Error('Se agotó la cuota de la API. Revisá tu plan en Google AI Studio.');
        }
        if (response.status === 400) {
          throw new Error(apiMsg || 'El archivo no pudo ser procesado. Probá con otro formato.');
        }
        if (response.status === 403) {
          throw new Error('La API key no tiene permisos. Verificala en Ajustes → General.');
        }
        if (isRetryable) {
          throw new Error('El servicio de IA sigue sobrecargado. Intentá de nuevo más tarde.');
        }
        throw new Error(apiMsg || `Error HTTP ${response.status}`);
      }

      lastError = apiMsg;
    }

  } catch (err) {
    console.error('[IA] Error:', err);
    if (err.name === 'AbortError') {
      showCsvError('La IA tardó demasiado en responder. Intentá con un archivo más pequeño o intentá más tarde.');
    } else {
      showCsvError('Error al procesar con IA: ' + err.message);
    }
  } finally {
    if (aiBtn) {
      aiBtn.disabled = false;
      aiBtn.innerHTML = '<i data-lucide="sparkles"></i> Importar con IA';
      lucide.createIcons();
    }
    if (aiFileInput) aiFileInput.value = '';
  }
}

function loadGeminiDataAsCsv(aiResult, fileName) {
  csvImportState.headers = aiResult.headers;
  csvImportState.rawData = aiResult.rows.map(row =>
    row.map(cell => (cell === null || cell === undefined ? '' : String(cell)))
  );
  csvImportState.rawText = '';
  csvImportState.isExcel = false;
  csvImportState.fileName = fileName;
  csvImportState.fileDims = `${csvImportState.headers.length} columnas · ${csvImportState.rawData.length} filas`;

  document.getElementById('csv-step-upload').style.display = 'none';
  document.getElementById('csv-step-mapping').style.display = '';
  document.getElementById('csv-dropzone').style.display = 'none';

  document.getElementById('csv-file-name').textContent = csvImportState.fileName;
  document.getElementById('csv-file-dims').textContent = '· ' + csvImportState.fileDims;

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

  autoMapColumns();
  renderCsvMapping();
}
