// ═══════════════════════════════════════════════════════════════════════
//  modals.js — Modales de ayuda y confirmación
//  Contiene: openWelcomeModal(), closeWelcomeModal(), showConfirm(),
//  resolveConfirm(), y la variable _confirmResolve.
// ═══════════════════════════════════════════════════════════════════════

// ── CONFIRM MODAL ──────────────────────────────────────────────
let _confirmResolve = null;

function showConfirm(message, { title = 'Confirmar', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false, middleText = '' } = {}) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const btn = document.getElementById('confirm-action-btn');
    btn.textContent = confirmText;
    btn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    if (cancelBtn) cancelBtn.textContent = cancelText;
    const midBtn = document.getElementById('confirm-middle-btn');
    if (middleText) {
      midBtn.textContent = middleText;
      midBtn.style.display = '';
    } else {
      midBtn.style.display = 'none';
    }
    document.getElementById('confirm-modal').classList.add('open');
    lucide.createIcons();
  });
}

function resolveConfirm(val) {
  document.getElementById('confirm-modal').classList.remove('open');
  if (_confirmResolve) { _confirmResolve(val); _confirmResolve = null; }
}

// ── WELCOME MODAL ─────────────────────────────────────────────
function openWelcomeModal() {
  document.getElementById('welcome-modal').classList.add('open');
  lucide.createIcons();
}

function closeWelcomeModal() {
  document.getElementById('welcome-modal').classList.remove('open');
}

function showWelcomeOnFirstVisit() {
  const seen = localStorage.getItem('wallet_welcome_seen');
  if (!seen) {
    localStorage.setItem('wallet_welcome_seen', 'true');
    openWelcomeModal();
  }
}
