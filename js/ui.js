let modalResolve = null;

function showToast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast${type === 'success' ? ' success' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function openModal(title, bodyHtml, footerHtml = '') {
  return new Promise(resolve => {
    modalResolve = resolve;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('modal-overlay').classList.add('open');
  });
}

function closeModal(result = null) {
  document.getElementById('modal-overlay').classList.remove('open');
  if (modalResolve) {
    modalResolve(result);
    modalResolve = null;
  }
}

function confirmDelete(message) {
  return openModal('אישור מחיקה', `<p>${message}</p>`, `
    <button class="btn btn-danger" id="modal-confirm-delete">מחק</button>
    <button class="btn btn-secondary" id="modal-cancel">ביטול</button>
  `).then(result => result === true);
}

function setupModalListeners() {
  document.getElementById('modal-close').addEventListener('click', () => closeModal(null));
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal(null);
  });
  document.getElementById('modal-footer').addEventListener('click', e => {
    if (e.target.id === 'modal-cancel') closeModal(null);
    if (e.target.id === 'modal-confirm-delete') closeModal(true);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderEmpty(icon, title, desc, btnLabel, btnAction) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      ${btnLabel ? `<button class="btn btn-primary" data-action="${btnAction}">${btnLabel}</button>` : ''}
    </div>
  `;
}
