function getTomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function getCustodyRequestsAwaitingMyResponse(data, myRole) {
  return (data.custodyRequests || []).filter(r =>
    r.status === 'pending' && r.requestedBy !== myRole
  );
}

function getMyCustodyRequestsPending(data, myRole) {
  return (data.custodyRequests || []).filter(r =>
    r.status === 'pending' && r.requestedBy === myRole
  );
}

function renderCustodyChangeSection(data) {
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const awaiting = getCustodyRequestsAwaitingMyResponse(data, myRole);
  const myPending = getMyCustodyRequestsPending(data, myRole);
  const recent = [...(data.custodyRequests || [])]
    .filter(r => r.status !== 'pending')
    .sort((a, b) => (b.respondedAt || b.createdAt || '').localeCompare(a.respondedAt || a.createdAt || ''))
    .slice(0, 5);

  return `
    <div class="card custody-change-card" style="margin-bottom:1.25rem">
      <div class="card-header">
        <div>
          <div class="card-title">📅 בקשות שינוי משמורת</div>
          <div class="card-subtitle">חופשה, יום מיוחד, או שינוי ליום שלא במשמורת שלך — דורש אישור ההורה השני</div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-action="request-custody-change">+ בקש שינוי</button>
      </div>

      ${awaiting.length ? `
        <div class="custody-request-pending-block">
          <div class="custody-request-label">ממתין לאישורך (${awaiting.length})</div>
          <ul class="custody-request-list">
            ${awaiting.map(r => renderCustodyRequestRow(data, r, true)).join('')}
          </ul>
        </div>
      ` : ''}

      ${myPending.length ? `
        <div class="custody-request-sent-block">
          <div class="custody-request-label">בקשות ששלחת — ממתין לתשובה (${myPending.length})</div>
          <ul class="custody-request-list">
            ${myPending.map(r => renderCustodyRequestRow(data, r, false)).join('')}
          </ul>
        </div>
      ` : ''}

      ${!awaiting.length && !myPending.length && !recent.length ? `
        <p style="color:var(--text-muted);font-size:0.9rem;margin:0">אין בקשות פתוחות. לחצו «בקש שינוי» לבקש יום חופשה או שינוי משמורת.</p>
      ` : ''}

      ${recent.length ? `
        <details class="custody-request-history">
          <summary>היסטוריית בקשות (${recent.length})</summary>
          <ul class="custody-request-list">
            ${recent.map(r => renderCustodyRequestRow(data, r, false)).join('')}
          </ul>
        </details>
      ` : ''}
    </div>
  `;
}

function renderCustodyRequestRow(data, r, showActions) {
  const statusLabel = r.status === 'approved' ? '✅ אושר'
    : r.status === 'rejected' ? '❌ נדחה' : '⏳ ממתין';
  const dateLabel = r.endDate && r.endDate !== r.date
    ? `${formatDate(r.date)} – ${formatDate(r.endDate)}`
    : formatDate(r.date);
  const currentCustody = getCustodyForDate(data, r.date);
  const currentName = getParentName(data, currentCustody);
  const requestedName = getParentName(data, r.assignTo);

  return `
    <li class="custody-request-row">
      <div class="custody-request-body">
        <div class="custody-request-title">${escapeHtml(r.title || 'בקשת שינוי משמורת')}</div>
        <div class="custody-request-meta">
          ${dateLabel} · ${getParentName(data, r.requestedBy)} מבקש/ת
          · לינה אצל <strong>${requestedName}</strong>
          (לפי הלוח: ${currentName})
        </div>
        ${r.reason ? `<div class="custody-request-reason">${escapeHtml(r.reason)}</div>` : ''}
        ${r.status === 'rejected' && r.rejectionReason ? `
          <div class="custody-request-reject">סיבת דחייה: ${escapeHtml(r.rejectionReason)}</div>
        ` : ''}
        <span class="badge ${r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">${statusLabel}</span>
      </div>
      ${showActions && r.status === 'pending' ? `
        <div class="custody-request-actions">
          <button type="button" class="btn btn-sm btn-primary" data-action="approve-custody-change" data-id="${r.id}">מאשר/ת</button>
          <button type="button" class="btn btn-sm btn-danger" data-action="reject-custody-change" data-id="${r.id}">לא מאשר/ת</button>
        </div>
      ` : ''}
    </li>
  `;
}

function getCustodyChangeFormHtml(data, request = null) {
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const r = request || {};
  const childOptions = data.children.map(ch =>
    `<option value="${ch.id}" ${r.childId === ch.id ? 'selected' : ''}>${escapeHtml(ch.name)}</option>`
  ).join('');

  return `
    <form id="custody-change-form">
      <div class="form-group">
        <label class="form-label">כותרת</label>
        <input class="form-input" name="title" required placeholder="למשל: חופשה / יום כיף" value="${escapeHtml(r.title || '')}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">תאריך התחלה *</label>
          <input class="form-input" type="date" name="date" required value="${r.date || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">תאריך סיום (אופציונלי)</label>
          <input class="form-input" type="date" name="endDate" value="${r.endDate || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">המשמורת תהיה אצל</label>
        <select class="form-select" name="assignTo">
          <option value="a" ${(r.assignTo || myRole) === 'a' ? 'selected' : ''}>${escapeHtml(getParentName(data, 'a'))}</option>
          <option value="b" ${(r.assignTo || myRole) === 'b' ? 'selected' : ''}>${escapeHtml(getParentName(data, 'b'))}</option>
        </select>
        <p class="form-hint">בדרך כלל — את/ה (${getParentName(data, myRole)}) מבקש/ת את היום</p>
      </div>
      <div class="form-group">
        <label class="form-label">ילד/ה</label>
        <select class="form-select" name="childId">
          <option value="">— כל הילדים —</option>
          ${childOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">סיבה / הסבר *</label>
        <textarea class="form-textarea" name="reason" required placeholder="למשל: חופשה משפחתית, אירוע מיוחד...">${escapeHtml(r.reason || '')}</textarea>
      </div>
    </form>
  `;
}

function getDatesInRange(startStr, endStr) {
  const dates = [];
  const start = new Date(startStr + 'T12:00:00');
  const end = new Date((endStr || startStr) + 'T12:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

async function notifyPartnerAboutCustodyRequest(data, request) {
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const partnerRole = myRole === 'a' ? 'b' : 'a';
  await createAppUpdate({
    updateType: 'custody_change',
    title: '📅 בקשת שינוי משמורת',
    body: `${request.title || 'בקשה'} — ${formatDate(request.date)}`,
    linkPage: 'custody',
    referenceId: request.id,
    targetParentRole: partnerRole
  });
}

async function applyApprovedCustodyChange(data, request) {
  if (!data.settings.manualDates) data.settings.manualDates = {};
  const dates = getDatesInRange(request.date, request.endDate || request.date);
  dates.forEach(d => {
    data.settings.manualDates[d] = request.assignTo;
  });
  await saveSettings(data.settings);
}
