const NOTICE_PRESETS = [
  { id: 'bring_shoes', type: 'reminder', title: 'להביא נעלי ספורט לבית הספר', icon: '👟' },
  { id: 'bring_diapers', type: 'reminder', title: 'להביא חבילת חיתולים למעון', icon: '🧷' },
  { id: 'pickup_friend', type: 'reminder', title: 'לאסוף מהחברה', icon: '🏠' },
  { id: 'after_school_friend', type: 'reminder', title: 'הולך/ת לחברה אחרי הלימודים', icon: '🎒' },
  { id: 'sleepover_elsewhere', type: 'reminder', title: 'לא ישן/ה אצלי היום', icon: '🌙' },
  { id: 'custom_reminder', type: 'reminder', title: 'תזכורת אחרת', icon: '🔔' }
];

const NOTICE_TYPE_META = {
  reminder: { label: 'תזכורת', icon: '🔔', color: 'notice-reminder' },
  absence: { label: 'אי הגעה / היעדרות', icon: '🚫', color: 'notice-absence' },
  cancellation: { label: 'ביטול מפגש', icon: '❌', color: 'notice-cancel' },
  military: { label: 'מילואים / צו 8', icon: '🪖', color: 'notice-military' },
  violation: { label: 'הפרת זמן משמורת', icon: '⚠️', color: 'notice-violation' }
};

function getNoticeTypeMeta(type) {
  return NOTICE_TYPE_META[type] || { label: type, icon: '📌', color: '' };
}

function getNoticesAwaitingMyAck(data, myRole) {
  return (data.parentNotices || []).filter(n =>
    n.status === 'active' && n.requiresAck && n.createdBy !== myRole && !n.acknowledgedBy
  );
}

function renderNoticesPage(data) {
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const notices = [...(data.parentNotices || [])].sort((a, b) =>
    (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  const awaiting = getNoticesAwaitingMyAck(data, myRole);
  const today = new Date().toISOString().split('T')[0];
  const upcoming = notices.filter(n => n.status !== 'cancelled' && n.date >= today);

  return `
    <div class="section-header">
      <h2>תזכורות ודיווחים</h2>
      <div class="section-header-actions">
        <button class="btn btn-primary" data-action="add-notice" data-notice-type="reminder">+ תזכורת</button>
        <button class="btn btn-secondary" data-action="add-notice" data-notice-type="absence">דיווח היעדרות</button>
        <button class="btn btn-secondary" data-action="add-notice" data-notice-type="military">מילואים/צו 8</button>
        <button class="btn btn-secondary" data-action="add-notice" data-notice-type="violation">הפרת משמורת</button>
      </div>
    </div>

    <p class="page-intro">תזכורות להבאת ציוד, איסוף מחברה, לינה אצל אחרים, דיווחי מילואים/צו 8, והפרות משמורת עם קנס — נשלחים להורה השני לעדכונים.</p>

    ${awaiting.length ? `
      <div class="card expense-approval-card" style="margin-bottom:1.25rem">
        <div class="card-title">📬 ממתין לאישורך / לידיעתך (${awaiting.length})</div>
        <ul class="notice-pending-list">
          ${awaiting.map(n => renderNoticeRow(data, n, myRole, true)).join('')}
        </ul>
      </div>
    ` : ''}

    <div class="notice-presets card" style="margin-bottom:1.25rem">
      <div class="card-title" style="margin-bottom:0.75rem">תזכורות נפוצות</div>
      <div class="notice-preset-grid">
        ${NOTICE_PRESETS.map(p => `
          <button type="button" class="notice-preset-btn" data-action="add-notice-preset" data-preset-id="${p.id}">
            <span>${p.icon}</span>
            <span>${escapeHtml(p.title)}</span>
          </button>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">כל התזכורות והדיווחים</div>
        <div class="card-subtitle">${upcoming.length} פעילים</div>
      </div>
      ${notices.length === 0 ? renderEmptyState('🔔', 'אין תזכורות עדיין', 'צרו תזכורת או דיווח — ההורה השני יקבל בעדכונים', '+ תזכורת', 'add-notice') : `
        <ul class="notice-list">
          ${notices.map(n => renderNoticeRow(data, n, myRole, false)).join('')}
        </ul>
      `}
    </div>
  `;
}

function renderNoticeRow(data, n, myRole, compact) {
  const meta = getNoticeTypeMeta(n.noticeType);
  const needsAck = n.requiresAck && n.createdBy !== myRole && !n.acknowledgedBy && n.status === 'active';
  const acked = !!n.acknowledgedBy;
  return `
    <li class="notice-list-row ${needsAck ? 'needs-ack' : ''}">
      <div class="notice-list-icon">${meta.icon}</div>
      <div class="notice-list-body">
        <div class="notice-list-title">${escapeHtml(n.title)}</div>
        <div class="notice-list-meta">
          <span class="badge badge-${n.createdBy}">${getParentName(data, n.createdBy)}</span>
          · ${formatDate(n.date)}${n.time ? ' ' + n.time : ''}
          ${n.childId ? ' · ' + escapeHtml(getChildName(data, n.childId)) : ''}
        </div>
        ${n.withPerson ? `<div class="notice-list-meta">אצל: ${escapeHtml(n.withPerson)}</div>` : ''}
        ${n.location ? `<div class="notice-list-meta">מיקום: ${escapeHtml(n.location)}</div>` : ''}
        ${n.description ? `<div class="notice-list-desc">${escapeHtml(n.description)}</div>` : ''}
        ${n.hasPenalty && n.penaltyAmount ? `<div class="notice-penalty-tag">💰 קנס: ${formatCurrency(n.penaltyAmount)}${n.expenseId ? ' · נרשם בהוצאות' : ''}</div>` : ''}
        ${acked ? `<div class="notice-acked">✓ נקרא/אושר ע"י ${getParentName(data, n.acknowledgedBy)}</div>` : ''}
      </div>
      <div class="notice-list-actions">
        ${needsAck ? `<button class="btn btn-sm btn-primary" data-action="ack-notice" data-id="${n.id}">קראתי / מאשר/ת</button>` : ''}
        ${!compact ? `
          <button class="btn btn-sm btn-secondary" data-action="edit-notice" data-id="${n.id}">ערוך</button>
          <button class="btn btn-sm btn-danger" data-action="delete-notice" data-id="${n.id}">מחק</button>
        ` : ''}
      </div>
    </li>
  `;
}

function getNoticeFormHtml(data, notice = null, defaults = {}) {
  const n = notice || {};
  const type = n.noticeType || defaults.noticeType || 'reminder';
  const preset = NOTICE_PRESETS.find(p => p.id === (n.presetId || defaults.presetId));
  const childOptions = data.children.map(ch =>
    `<option value="${ch.id}" ${(n.childId || defaults.childId) === ch.id ? 'selected' : ''}>${escapeHtml(ch.name)}</option>`
  ).join('');
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';

  return `
    <form id="notice-form" class="notice-form">
      <div class="form-group">
        <label class="form-label">סוג</label>
        <select class="form-select" name="noticeType" id="notice-type-select">
          <option value="reminder" ${type === 'reminder' ? 'selected' : ''}>🔔 תזכורת</option>
          <option value="absence" ${type === 'absence' ? 'selected' : ''}>🚫 אי הגעה / היעדרות</option>
          <option value="cancellation" ${type === 'cancellation' ? 'selected' : ''}>❌ ביטול מפגש</option>
          <option value="military" ${type === 'military' ? 'selected' : ''}>🪖 מילואים / צו 8</option>
          <option value="violation" ${type === 'violation' ? 'selected' : ''}>⚠️ הפרת זמן משמורת</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">כותרת *</label>
        <input class="form-input" name="title" required value="${escapeHtml(n.title || preset?.title || defaults.title || '')}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">תאריך *</label>
          <input class="form-input" type="date" name="date" required value="${n.date || defaults.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">שעה</label>
          <input class="form-input" type="time" name="time" value="${n.time || defaults.time || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">ילד/ה</label>
        <select class="form-select" name="childId">
          <option value="">— כללי —</option>
          ${childOptions}
        </select>
      </div>
      <div class="form-group notice-field-with-person">
        <label class="form-label">אצל מי? (חברה, סבתא, אמא וכו')</label>
        <input class="form-input" name="withPerson" placeholder="למשל: אצל חברה שרה / אצל סבתא" value="${escapeHtml(n.withPerson || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">מיקום / הערות</label>
        <input class="form-input" name="location" value="${escapeHtml(n.location || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">פרטים נוספים</label>
        <textarea class="form-textarea" name="description">${escapeHtml(n.description || '')}</textarea>
      </div>
      <div class="form-group notice-field-violator" style="display:${type === 'violation' ? 'block' : 'none'}">
        <label class="form-label">מי הפר את זמן השהות?</label>
        <select class="form-select" name="violatorRole">
          <option value="a" ${n.violatorRole === 'a' ? 'selected' : ''}>${escapeHtml(getParentName(data, 'a'))}</option>
          <option value="b" ${n.violatorRole === 'b' ? 'selected' : ''}>${escapeHtml(getParentName(data, 'b'))}</option>
        </select>
      </div>
      <div class="form-group notice-field-penalty" style="display:${type === 'violation' ? 'block' : 'none'}">
        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
          <input type="checkbox" name="hasPenalty" ${n.hasPenalty ? 'checked' : ''}>
          <span>יש קנס כספי על ההפרה</span>
        </label>
        <div class="notice-penalty-amount" style="margin-top:0.5rem;display:${n.hasPenalty ? 'block' : 'none'}">
          <label class="form-label">סכום הקנס (₪)</label>
          <input class="form-input" type="number" name="penaltyAmount" min="0" step="1" value="${n.penaltyAmount || ''}" placeholder="למשל: 500">
          <p class="form-hint">יירשם אוטומטית בלוח ההוצאות (ממתין לאישור ההורה השני)</p>
        </div>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
          <input type="checkbox" name="requiresAck" ${n.requiresAck !== false ? 'checked' : ''}>
          <span>שלח להורה השני לידיעה / אישור</span>
        </label>
      </div>
      <input type="hidden" name="presetId" value="${escapeHtml(n.presetId || defaults.presetId || '')}">
    </form>
  `;
}

function initNoticeFormFields(form) {
  const typeSelect = form.querySelector('#notice-type-select');
  const violatorField = form.querySelector('.notice-field-violator');
  const penaltyField = form.querySelector('.notice-field-penalty');
  const withPersonField = form.querySelector('.notice-field-with-person');
  const penaltyCheckbox = form.querySelector('[name=hasPenalty]');
  const penaltyAmountWrap = form.querySelector('.notice-penalty-amount');

  function syncFields() {
    const type = typeSelect?.value || 'reminder';
    if (violatorField) violatorField.style.display = type === 'violation' ? 'block' : 'none';
    if (penaltyField) penaltyField.style.display = type === 'violation' ? 'block' : 'none';
    if (withPersonField) {
      withPersonField.style.display = ['reminder', 'absence', 'cancellation'].includes(type) ? 'block' : 'none';
    }
  }

  typeSelect?.addEventListener('change', syncFields);
  penaltyCheckbox?.addEventListener('change', () => {
    if (penaltyAmountWrap) penaltyAmountWrap.style.display = penaltyCheckbox.checked ? 'block' : 'none';
  });
  syncFields();
}

async function notifyPartnerAboutNotice(data, notice) {
  if (!notice.requiresAck) return;
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const partnerRole = myRole === 'a' ? 'b' : 'a';
  const meta = getNoticeTypeMeta(notice.noticeType);
  await createAppUpdate({
    updateType: notice.noticeType === 'reminder' ? 'reminder' : 'schedule_notice',
    title: `${meta.icon} ${meta.label}`,
    body: `${notice.title} — ${formatDate(notice.date)}`,
    linkPage: 'notices',
    referenceId: notice.id,
    targetParentRole: partnerRole
  });
}

async function createViolationExpense(data, notice, violatorRole) {
  if (!notice.hasPenalty || !notice.penaltyAmount) return null;
  const amount = parseFloat(notice.penaltyAmount);
  if (!amount || amount <= 0) return null;
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const splitPercent = violatorRole === 'a' ? 100 : 0;
  const expense = await createExpense({
    title: `הפרת משמורת — ${formatDate(notice.date)}`,
    amount,
    date: notice.date,
    paidBy: violatorRole,
    splitPercent,
    paid: false,
    category: 'הפרת משמורת',
    notes: notice.description || notice.title,
    childId: notice.childId || null,
    requiresApproval: true,
    createdBy: myRole
  });
  const partnerRole = myRole === 'a' ? 'b' : 'a';
  await createAppUpdate({
    updateType: 'expense_approval',
    title: '✋ קנס הפרת משמורת — לאישורך',
    body: `${formatCurrency(amount)} — ${notice.title}`,
    linkPage: 'expenses',
    referenceId: expense.id,
    targetParentRole: partnerRole
  });
  return expense.id;
}
