// ═══════════════════════════════════════════════════════════════════════
//  backup.js — Exportación e importación de datos (backup JSON)
//  Contiene: exportBackup(), openImportBackupModal(), closeImportBackupModal(),
//  onImportBackupFile(), confirmImportBackup(), confirmDeleteAllData().
// ═══════════════════════════════════════════════════════════════════════

let _importBackupData = null;

// Predefinidos originales (para saber qué es default)
const DEFAULT_PREDEFINED = {
  payees: [],
  account_types: [
    { id: 'liquid', label: 'Líquida (Efectivo / Débito)', isDefault: true },
    { id: 'credit_card', label: 'Tarjeta de crédito', isDefault: true },
  ],
  categories: [
    { name: 'Saldo inicial', icon: 'banknote' },
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
};

// ── EXPORT ─────────────────────────────────────────────────────
function clearBackupDates() {
  document.getElementById('backup-date-from').value = '';
  document.getElementById('backup-date-to').value = '';
}

function exportBackup() {
  const dateFrom = document.getElementById('backup-date-from')?.value || '';
  const dateTo = document.getElementById('backup-date-to')?.value || '';

  let txs = state.transactions;
  if (dateFrom) txs = txs.filter(tx => tx.date >= dateFrom);
  if (dateTo) txs = txs.filter(tx => tx.date <= dateTo);

  const backup = {
    version: 1,
    exportDate: new Date().toISOString(),
    dateFilter: { from: dateFrom || null, to: dateTo || null },
    accounts: state.accounts,
    transactions: txs,
    predefined: state.predefined,
    settings: state.settings,
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const suffix = (dateFrom || dateTo) ? `-${dateFrom || 'start'}-a-${dateTo || 'end'}` : '';
  const a = document.createElement('a');
  a.href = url;
  a.download = `wallet-backup-${today}${suffix}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── IMPORT ─────────────────────────────────────────────────────
function openImportBackupModal() {
  _importBackupData = null;
  const modal = document.getElementById('import-backup-modal');
  const upload = document.getElementById('import-backup-upload');
  const preview = document.getElementById('import-backup-preview');
  const btn = document.getElementById('btn-confirm-import-backup');
  const input = document.getElementById('import-backup-input');

  upload.style.display = '';
  preview.style.display = 'none';
  btn.style.display = 'none';
  input.value = '';
  modal.classList.add('open');
  lucide.createIcons();
}

function closeImportBackupModal() {
  const modal = document.getElementById('import-backup-modal');
  modal.classList.remove('open');
  _importBackupData = null;
}

function onImportBackupFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);

      if (!data.accounts || !data.transactions) {
        alert('El archivo no parece ser un backup válido de Wallet.');
        return;
      }

      _importBackupData = data;

      const upload = document.getElementById('import-backup-upload');
      const preview = document.getElementById('import-backup-preview');
      const btn = document.getElementById('btn-confirm-import-backup');

      document.getElementById('import-backup-filename').textContent = file.name;

      const stats = document.getElementById('import-backup-stats');
      stats.innerHTML = `
        <div class="import-backup-stat">
          <span class="import-backup-stat-val">${data.accounts.length}</span>
          <span class="import-backup-stat-label">Cuentas</span>
        </div>
        <div class="import-backup-stat">
          <span class="import-backup-stat-val">${data.transactions.length}</span>
          <span class="import-backup-stat-label">Transacciones</span>
        </div>
        <div class="import-backup-stat">
          <span class="import-backup-stat-val">${data.predefined ? data.predefined.payees?.length || 0 : 0}</span>
          <span class="import-backup-stat-label">Beneficiarios</span>
        </div>
        <div class="import-backup-stat">
          <span class="import-backup-stat-val">${data.predefined ? data.predefined.categories?.length || 0 : 0}</span>
          <span class="import-backup-stat-label">Categorías</span>
        </div>
      `;

      upload.style.display = 'none';
      preview.style.display = '';
      btn.style.display = '';
      lucide.createIcons();
    } catch (err) {
      alert('Error al leer el archivo: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function confirmImportBackup() {
  if (!_importBackupData) return;

  const mode = document.querySelector('input[name="import-backup-mode"]:checked')?.value || 'replace';

  const doImport = () => {
    const d = _importBackupData;

    if (mode === 'replace') {
      state.accounts = d.accounts || [];
      state.transactions = d.transactions || [];
      if (d.predefined) state.predefined = d.predefined;
      if (d.settings) {
        state.settings = { ...state.settings, ...d.settings };
        localStorage.setItem('wallet_settings', JSON.stringify(state.settings));
        applyTheme();
        syncThemeUI();
      }
    } else {
      // Merge: add accounts with new IDs, transactions with new IDs
      const accIdMap = {};

      (d.accounts || []).forEach(acc => {
        const exists = state.accounts.find(a => a.name === acc.name && a.type === acc.type);
        if (exists) {
          accIdMap[acc.id] = exists.id;
        } else {
          const newId = 'acc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          accIdMap[acc.id] = newId;
          state.accounts.push({ ...acc, id: newId });
        }
      });

      (d.transactions || []).forEach(tx => {
        const newTx = { ...tx, id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) };
        if (accIdMap[tx.account_id]) {
          newTx.account_id = accIdMap[tx.account_id];
        }
        state.transactions.push(newTx);
      });

      if (d.predefined) {
        if (d.predefined.payees) {
          d.predefined.payees.forEach(p => {
            if (!state.predefined.payees.includes(p)) state.predefined.payees.push(p);
          });
        }
        if (d.predefined.account_types) {
          d.predefined.account_types.forEach(t => {
            if (!state.predefined.account_types.find(x => x.id === t.id)) {
              state.predefined.account_types.push({ ...t });
            }
          });
        }
        if (d.predefined.categories) {
          d.predefined.categories.forEach(c => {
            const name = typeof c === 'string' ? c : c.name;
            if (!state.predefined.categories.find(x => (typeof x === 'string' ? x : x.name) === name)) {
              state.predefined.categories.push(c);
            }
          });
        }
        if (d.predefined.tags) {
          d.predefined.tags.forEach(t => {
            const name = typeof t === 'string' ? t : t.name;
            if (!state.predefined.tags.find(x => (typeof x === 'string' ? x : x.name) === name)) {
              state.predefined.tags.push(typeof t === 'string' ? { name: t, color: '#d1d5db' } : { ...t });
            }
          });
        }
      }
    }

    saveData('accounts');
    saveData('transactions');
    saveData('predefined');
    renderAll();
    closeImportBackupModal();
  };

  if (mode === 'replace') {
    showConfirm(
      'Se borrarán todas tus transacciones y cuentas actuales y se cargarán las del backup. ¿Continuar?',
      { title: 'Reemplazar datos', confirmText: 'Reemplazar', danger: true }
    ).then(ok => {
      if (ok) doImport();
    });
  } else {
    doImport();
  }
}

// ── DELETE ALL DATA ────────────────────────────────────────────
function confirmDeleteAllData() {
  const txCount = state.transactions.length;
  const accCount = state.accounts.length;
  const extraPayees = state.predefined.payees.filter(p => !DEFAULT_PREDEFINED.payees.includes(p)).length;
  const extraAccTypes = (state.predefined.account_types || []).filter(t => !t.isDefault).length;
  const extraCategories = state.predefined.categories.filter(c => {
    const name = typeof c === 'string' ? c : c.name;
    return !DEFAULT_PREDEFINED.categories.find(d => (typeof d === 'string' ? d : d.name) === name);
  }).length;
  const extraTags = state.predefined.tags.filter(t => {
    const name = typeof t === 'string' ? t : t.name;
    return !DEFAULT_PREDEFINED.tags.includes(name);
  }).length;

  const parts = [];
  if (txCount) parts.push(`${txCount} transacciones`);
  if (accCount) parts.push(`${accCount} cuentas`);
  if (extraPayees) parts.push(`${extraPayees} beneficiarios personalizados`);
  if (extraAccTypes) parts.push(`${extraAccTypes} tipos de cuenta personalizados`);
  if (extraCategories) parts.push(`${extraCategories} categorías personalizadas`);
  if (extraTags) parts.push(`${extraTags} etiquetas personalizadas`);

  const summary = parts.length ? parts.join(', ') : 'No hay datos para borrar';

  showConfirm(
    `Esto eliminará permanentemente: ${summary}. Las listas predeterminadas se mantendrán intactas. Esta acción no se puede deshacer.`,
    { title: 'Borrar todos los datos', confirmText: 'Borrar todo', danger: true }
  ).then(ok => {
    if (ok) deleteAllData();
  });
}

function deleteAllData() {
  state.transactions = [];
  state.accounts = [];
  state.predefined.payees = [...DEFAULT_PREDEFINED.payees];
  state.predefined.account_types = DEFAULT_PREDEFINED.account_types.map(t => ({ ...t }));
  state.predefined.categories = DEFAULT_PREDEFINED.categories.map(c => ({ ...c }));
  state.predefined.tags = [...DEFAULT_PREDEFINED.tags];

  saveData('accounts');
  saveData('transactions');
  saveData('predefined');
  renderAll();
}
