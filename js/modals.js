// ═══════════════════════════════════════════════════════════════════════
//  modals.js — Modales de ayuda y confirmación
//  Contiene: openHelpModal(), closeHelpModal(), showConfirm(),
//  resolveConfirm(), y la variable _confirmResolve.
// ═══════════════════════════════════════════════════════════════════════

// ── CONFIRM MODAL ──────────────────────────────────────────────
let _confirmResolve = null;

function showConfirm(message, { title = 'Confirmar', confirmText = 'Confirmar', danger = false } = {}) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const btn = document.getElementById('confirm-action-btn');
    btn.textContent = confirmText;
    btn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    document.getElementById('confirm-modal').classList.add('open');
    lucide.createIcons();
  });
}

function resolveConfirm(val) {
  document.getElementById('confirm-modal').classList.remove('open');
  if (_confirmResolve) { _confirmResolve(val); _confirmResolve = null; }
}

// ── HELP MODAL ─────────────────────────────────────────────────
function openHelpModal() {
  document.getElementById('help-modal').classList.add('open');
}

function closeHelpModal() {
  document.getElementById('help-modal').classList.remove('open');
}
