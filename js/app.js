const PAGE_TITLES = {
  dashboard: 'לוח בקרה',
  calendar: 'לוח שנה',
  custody: 'משמורת',
  children: 'ילדים',
  events: 'אירועים',
  notices: 'תזכורות ודיווחים',
  expenses: 'הוצאות',
  approvals: 'אישורים וחתימות',
  updates: 'עדכונים',
  messages: 'הודעות',
  settings: 'הגדרות'
};

let appData = structuredClone(DEFAULT_DATA);
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let listenersReady = false;
let loadedUserId = null;
let custodyPreviewWeekOffset = 0;
let calendarHolidaysLoading = false;
let calendarBirthdaysLoading = false;
let notifSnapshot = null;
let pendingOpenConsentId = null;

function captureJoinCodeFromUrl() {
  const match = window.location.hash.match(/^#join\/([A-Za-z0-9]+)/);
  if (match) {
    pendingJoinCode = match[1].toUpperCase();
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function getMySenderRole() {
  if (appData.family?.hasPartner) return appData.family.myParentRole;
  return appData.settings.currentParent;
}

function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}

async function refreshData() {
  const prev = notifSnapshot;
  appData = await loadAppData();
  if (typeof clearBirthdayCache === 'function') clearBirthdayCache();
  notifSnapshot = typeof buildNotificationSnapshot === 'function'
    ? buildNotificationSnapshot(appData)
    : null;
  if (prev && typeof checkNotifications === 'function') {
    await checkNotifications(appData, prev);
  }
}

async function handleDbError(err, fallbackMsg = 'שגיאה בשמירה') {
  console.error(err);
  showToast(translateDbError(err) || fallbackMsg);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function syncNavActive(page) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });
  document.querySelectorAll('.bottom-nav-link[data-page]').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });
}

function parseRoute() {
  const raw = window.location.hash.slice(1) || 'dashboard';
  const parts = raw.split('&');
  const pageKey = parts[0].split('/')[0];
  const params = {};
  for (let i = 1; i < parts.length; i++) {
    const [k, v] = parts[i].split('=');
    if (k) params[k] = decodeURIComponent(v || '');
  }
  const page = PAGE_TITLES[pageKey] ? pageKey : 'dashboard';
  return { page, params };
}

function updateNavBadges() {
  const myRole = getMySenderRole();
  const approvalCount = typeof getExpensesAwaitingMyApproval === 'function'
    ? getExpensesAwaitingMyApproval(appData, myRole).length
    : 0;
  const consentCount = (appData.consentForms || []).filter(c =>
    typeof needsMySignature === 'function' && needsMySignature(c, myRole)
  ).length;
  const updatesCount = typeof getUnreadUpdatesCount === 'function'
    ? getUnreadUpdatesCount(appData, myRole)
    : 0;
  const noticesCount = typeof getNoticesAwaitingMyAck === 'function'
    ? getNoticesAwaitingMyAck(appData, myRole).length
    : 0;
  const custodyCount = typeof getCustodyRequestsAwaitingMyResponse === 'function'
    ? getCustodyRequestsAwaitingMyResponse(appData, myRole).length
    : 0;

  function setBadge(selector, count, title) {
    document.querySelectorAll(selector).forEach(link => {
      let badge = link.querySelector('.nav-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'nav-badge';
          link.appendChild(badge);
        }
        badge.textContent = count;
        badge.title = title;
      } else {
        badge?.remove();
      }
    });
  }

  setBadge('.nav-link[data-page="expenses"]', approvalCount, `${approvalCount} הוצאות ממתינות לאישורך`);
  setBadge('.nav-link[data-page="notices"]', noticesCount, `${noticesCount} תזכורות ממתינות`);
  setBadge('.nav-link[data-page="custody"]', custodyCount, `${custodyCount} בקשות משמורת ממתינות`);
  setBadge('.nav-link[data-page="approvals"]', consentCount, `${consentCount} טפסים ממתינים לחתימתך`);
  setBadge('.nav-link[data-page="updates"]', updatesCount, `${updatesCount} עדכונים חדשים`);
}

function render() {
  const route = parseRoute();
  const page = route.page;
  if (route.params.consent) pendingOpenConsentId = route.params.consent;

  document.getElementById('page-title').textContent = PAGE_TITLES[page];
  syncNavActive(page);

  const content = document.getElementById('content');
  let actionsHtml = '';

  const user = getCurrentUser();
  if (user) {
    actionsHtml = `<span class="user-badge">${getUserDisplayName(user)}</span>`;
  }

  switch (page) {
    case 'dashboard':
      content.innerHTML = renderDashboard(appData);
      break;
    case 'calendar':
      content.innerHTML = renderCalendar(appData, calYear, calMonth);
      refreshCalendarExtrasOnce();
      break;
    case 'custody':
      content.innerHTML = renderCustody(appData, custodyPreviewWeekOffset);
      break;
    case 'children':
      content.innerHTML = renderChildren(appData);
      if (appData.children.length > 0) {
        actionsHtml += '<button class="btn btn-primary btn-sm" data-action="add-child">+ הוסף ילד</button>';
      }
      break;
    case 'events':
      content.innerHTML = renderEvents(appData);
      break;
    case 'notices':
      content.innerHTML = typeof renderNoticesPage === 'function'
        ? renderNoticesPage(appData)
        : '<div class="card"><p>טוען...</p></div>';
      break;
    case 'expenses':
      content.innerHTML = renderExpenses(appData);
      break;
    case 'approvals':
      content.innerHTML = typeof renderConsentApprovalsPage === 'function'
        ? renderConsentApprovalsPage(appData)
        : '<div class="card"><p>טוען...</p></div>';
      break;
    case 'updates':
      content.innerHTML = typeof renderUpdatesPage === 'function'
        ? renderUpdatesPage(appData)
        : '<div class="card"><p>טוען...</p></div>';
      break;
    case 'messages':
      content.innerHTML = renderMessages(appData);
      scrollMessagesToBottom();
      break;
    case 'settings':
      content.innerHTML = renderSettings(appData);
      initAvatarPickers(document.getElementById('content'));
      if (typeof initNotificationSettings === 'function') {
        initNotificationSettings(document.getElementById('content'));
      }
      break;
  }

  document.getElementById('topbar-actions').innerHTML = actionsHtml;
  updateNavBadges();
  closeSidebar();

  if (pendingOpenConsentId && page === 'approvals') {
    const consentId = pendingOpenConsentId;
    pendingOpenConsentId = null;
    const consent = (appData.consentForms || []).find(c => c.id === consentId);
    if (consent) setTimeout(() => handleConsentForm(consent), 50);
  }
}

function getCalendarHolidayYears(year, month) {
  const years = new Set([year]);
  if (month === 0) years.add(year - 1);
  if (month === 11) years.add(year + 1);
  return [...years];
}

async function refreshCalendarHolidaysOnce() {
  if (calendarHolidaysLoading) return;
  const years = getCalendarHolidayYears(calYear, calMonth);
  const missing = years.filter(y => !holidayCacheByYear[y]);
  if (!missing.length) return;

  calendarHolidaysLoading = true;
  try {
    await Promise.all(missing.map(y => ensureHolidaysForYear(y)));
    const page = window.location.hash.slice(1) || 'dashboard';
    if (page === 'calendar') render();
  } finally {
    calendarHolidaysLoading = false;
  }
}

async function refreshCalendarExtrasOnce() {
  refreshCalendarHolidaysOnce();
  if (calendarBirthdaysLoading || typeof preloadBirthdaysForMonth !== 'function') return;
  calendarBirthdaysLoading = true;
  try {
    await preloadBirthdaysForMonth(appData, calYear, calMonth);
    const page = window.location.hash.slice(1) || 'dashboard';
    if (page === 'calendar') render();
  } finally {
    calendarBirthdaysLoading = false;
  }
}

async function maybeShowBirthdayPopup() {
  if (typeof getBirthdaysOnDateCached !== 'function') return;
  const today = new Date().toISOString().split('T')[0];
  const key = `birthday-popup-${today}`;
  if (sessionStorage.getItem(key)) return;
  const birthdays = await getBirthdaysOnDateCached(appData, today);
  if (!birthdays.length) return;
  sessionStorage.setItem(key, '1');
  openModal(
    '🎉 יום הולדת שמח!',
    renderBirthdayCelebrationHtml(birthdays),
    '<button type="button" class="btn btn-primary" id="modal-birthday-ok">מזל טוב!</button>'
  );
  document.getElementById('modal-birthday-ok')?.addEventListener('click', closeModal);
}

function getCalendarPrintHtml() {
  const base = window.location.href.replace(/[#?].*$/, '').replace(/[^/]+$/, '');
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>לוח משמורת</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${base}css/styles.css?v=11">
  <style>
    body { margin: 0; padding: 16px; font-family: Heebo, sans-serif; background: #fff; }
    @page { size: A4 landscape; margin: 12mm; }
  </style>
</head>
<body>
  ${renderCalendarPrintSheet(appData, calYear, calMonth)}
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;
}

async function ensureHtml2Pdf() {
  if (typeof html2pdf !== 'undefined') return true;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('pdf lib'));
    document.head.appendChild(script);
  });
  return typeof html2pdf !== 'undefined';
}

async function downloadCalendarPdf() {
  try {
    showLoading(true);
    const ready = await ensureHtml2Pdf();
    if (!ready) throw new Error('pdf lib missing');
  } catch (_) {
    showLoading(false);
    showToast('לא ניתן לטעון את כלי ה-PDF — נסי הדפסה ובחרי "שמור כ-PDF"');
    return;
  }

  const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const sheet = document.createElement('div');
  sheet.innerHTML = renderCalendarPrintSheet(appData, calYear, calMonth);
  sheet.style.position = 'fixed';
  sheet.style.left = '-9999px';
  sheet.style.top = '0';
  sheet.style.width = '1100px';
  sheet.style.background = '#fff';
  document.body.appendChild(sheet);

  const printEl = sheet.firstElementChild;
  printEl.querySelectorAll('.cal-day').forEach(cell => {
    if (!cell.style.background && !cell.getAttribute('style')) {
      cell.style.background = '#fff';
      cell.style.border = '1px solid #ccc';
    }
  });

  try {
    showLoading(true);
    await html2pdf().set({
      margin: [8, 8, 8, 8],
      filename: `לוח-משמורת-${monthNames[calMonth]}-${calYear}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(printEl).save();
    showToast('הקובץ נשמר', 'success');
  } catch (err) {
    console.error(err);
    showToast('שגיאה ביצירת PDF — נסי הדפסה ובחרי "שמור כ-PDF"');
  } finally {
    document.body.removeChild(sheet);
    showLoading(false);
  }
}

function printCalendarMonth() {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    showToast('לא ניתן לפתוח חלון הדפסה — בדקי חסימת חלונות קופצים');
    return;
  }
  win.document.open();
  win.document.write(getCalendarPrintHtml());
  win.document.close();
}

function scrollMessagesToBottom() {
  const thread = document.getElementById('message-thread');
  if (thread) thread.scrollTop = thread.scrollHeight;
}

let custodyPersistTimer = null;

function queueCustodyPersist(toastMsg, delay = 500) {
  clearTimeout(custodyPersistTimer);
  const persist = async () => {
    try {
      await saveSettings(appData.settings);
      if (toastMsg) showToast(toastMsg, 'success');
    } catch (err) {
      handleDbError(err);
    }
  };
  if (delay <= 0) persist();
  else custodyPersistTimer = setTimeout(persist, delay);
}

function updateCustodyUi({ toastMsg, reRender = true, persist = true, saveDelay = 400 } = {}) {
  if (reRender) render();
  if (persist) queueCustodyPersist(toastMsg, saveDelay);
}

async function flushCustodyPersist() {
  clearTimeout(custodyPersistTimer);
  await saveSettings(appData.settings);
}

async function saveCustodySettings(toastMsg) {
  updateCustodyUi({ toastMsg, reRender: true, saveDelay: toastMsg ? 0 : 300 });
}

function getManualWeekDates(offsetWeeks = 0) {
  const weekStart = getCustodyWeekStart(offsetWeeks);
  const dates = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getFormData(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [key, val] of fd.entries()) obj[key] = val;
  return obj;
}

function handleChildForm(child = null) {
  const isEdit = !!child;
  openModal(
    isEdit ? 'עריכת ילד/ה' : 'הוספת ילד/ה',
    getChildFormHtml(appData, child),
    `<button class="btn btn-primary" id="modal-save">שמור</button>
     <button class="btn btn-secondary" id="modal-cancel">ביטול</button>`
  );

  const form = document.getElementById('child-form');
  if (!form) return;

  initAvatarPickers(form);

  document.getElementById('modal-save')?.addEventListener('click', async () => {
    const data = getFormData(form);
    if (!data.name.trim()) { showToast('יש להזין שם'); return; }

    try {
      showLoading(true);
      if (isEdit) await updateChild(child.id, data);
      else await createChild(data);
      await refreshData();
      closeModal();
      showToast(isEdit ? 'הילד/ה עודכן/ה' : 'ילד/ה נוסף/ה', 'success');
      render();
    } catch (err) {
      handleDbError(err);
    } finally {
      showLoading(false);
    }
  });
  document.getElementById('modal-cancel')?.addEventListener('click', () => closeModal());
}

function handleEventForm(event = null, defaultDate = null) {
  const isEdit = !!event;
  const ev = event || (defaultDate ? { date: defaultDate } : null);

  openModal(
    isEdit ? 'עריכת אירוע' : 'הוספת אירוע',
    getEventFormHtml(appData, ev),
    `<button class="btn btn-primary" id="modal-save">שמור</button>
     <button class="btn btn-secondary" id="modal-cancel">ביטול</button>`
  );

  const form = document.getElementById('event-form');
  if (!form) return;

  document.getElementById('modal-save')?.addEventListener('click', async () => {
    const data = getFormData(form);
    if (!data.title.trim() || !data.date) { showToast('יש למלא כותרת ותאריך'); return; }

    const payload = {
      ...data,
      childId: data.childId || null,
      createdBy: isEdit ? event.createdBy : getMySenderRole()
    };

    try {
      showLoading(true);
      if (isEdit) await updateEvent(event.id, payload);
      else await createEvent(payload);
      await refreshData();
      closeModal();
      showToast(isEdit ? 'האירוע עודכן' : 'אירוע נוסף', 'success');
      render();
    } catch (err) {
      handleDbError(err);
    } finally {
      showLoading(false);
    }
  });
  document.getElementById('modal-cancel')?.addEventListener('click', () => closeModal());
}

function handleExpenseForm(expense = null) {
  const isEdit = !!expense;

  openModal(
    isEdit ? 'עריכת הוצאה' : 'הוספת הוצאה',
    getExpenseFormHtml(appData, expense),
    `<button class="btn btn-primary" id="modal-save">שמור</button>
     <button class="btn btn-secondary" id="modal-cancel">ביטול</button>`
  );

  const form = document.getElementById('expense-form');
  if (!form) return;

  initExpenseSplitPicker(form);

  const approvalCheckbox = form.querySelector('[name=requiresApproval]');
  const paidGroup = form.querySelector('#expense-paid-group');
  approvalCheckbox?.addEventListener('change', () => {
    if (paidGroup) paidGroup.style.display = approvalCheckbox.checked ? 'none' : '';
  });
  if (approvalCheckbox?.checked && paidGroup) paidGroup.style.display = 'none';

  document.getElementById('modal-save')?.addEventListener('click', async () => {
    const data = getFormData(form);
    const paidCheckbox = form.querySelector('[name=paid]');
    const requiresApproval = !!form.querySelector('[name=requiresApproval]')?.checked;

    const payload = {
      ...data,
      amount: parseFloat(data.amount),
      splitPercent: Math.max(0, Math.min(100, parseInt(data.splitPercent, 10) || 50)),
      paid: requiresApproval ? false : (paidCheckbox?.checked || false),
      childId: data.childId || null,
      requiresApproval,
      createdBy: getMySenderRole()
    };

    try {
      showLoading(true);
      if (isEdit) await updateExpense(expense.id, payload);
      else {
        const created = await createExpense(payload);
        if (requiresApproval && typeof createAppUpdate === 'function') {
          const partnerRole = getMySenderRole() === 'a' ? 'b' : 'a';
          await createAppUpdate({
            updateType: 'expense_approval',
            title: '✋ בקשת אישור הוצאה',
            body: `${created.title} — ${formatCurrency(created.amount)}`,
            linkPage: 'expenses',
            referenceId: created.id,
            targetParentRole: partnerRole
          });
        }
      }
      await refreshData();
      closeModal();
      if (!isEdit && requiresApproval) {
        const other = getMySenderRole() === 'a' ? 'b' : 'a';
        showToast(`הבקשה נשלחה ל${getParentName(appData, other)} — יופיע אצלו/ה בדף «הוצאות»`, 'success');
      } else {
        showToast(isEdit ? 'ההוצאה עודכנה' : 'הוצאה נוספה', 'success');
      }
      render();
    } catch (err) {
      handleDbError(err);
    } finally {
      showLoading(false);
    }
  });
  document.getElementById('modal-cancel')?.addEventListener('click', () => closeModal());
}

function handleCustodyChangeForm() {
  openModal(
    'בקשת שינוי משמורת',
    typeof getCustodyChangeFormHtml === 'function' ? getCustodyChangeFormHtml(appData) : '<p>טוען...</p>',
    `<button class="btn btn-primary" id="modal-save">שלח בקשה</button>
     <button class="btn btn-secondary" id="modal-cancel">ביטול</button>`
  );

  document.getElementById('modal-save')?.addEventListener('click', async () => {
    const form = document.getElementById('custody-change-form');
    if (!form) return;
    const data = getFormData(form);
    const myRole = getMySenderRole();
    const payload = {
      title: data.title?.trim(),
      date: data.date,
      endDate: data.endDate || null,
      childId: data.childId || null,
      assignTo: data.assignTo || myRole,
      reason: data.reason?.trim(),
      requestedBy: myRole
    };

    if (!payload.title || !payload.date || !payload.reason) {
      showToast('נא למלא כותרת, תאריך וסיבה');
      return;
    }
    if (payload.endDate && payload.endDate < payload.date) {
      showToast('תאריך הסיום חייב להיות אחרי תאריך ההתחלה');
      return;
    }

    try {
      showLoading(true);
      const saved = await createCustodyChangeRequest(payload);
      if (typeof notifyPartnerAboutCustodyRequest === 'function') {
        await notifyPartnerAboutCustodyRequest(appData, saved);
      }
      await refreshData();
      closeModal();
      showToast('הבקשה נשלחה להורה השני לאישור', 'success');
      render();
    } catch (err) {
      handleDbError(err);
    } finally {
      showLoading(false);
    }
  });
  document.getElementById('modal-cancel')?.addEventListener('click', () => closeModal());
}

function handleRejectCustodyChange(requestId) {
  openModal(
    'דחיית בקשת שינוי משמורת',
    `<form id="custody-reject-form">
      <p style="margin:0 0 1rem;color:var(--text-muted)">נא להסביר למה הבקשה לא מאושרת — ההורה השני יראה את ההסבר.</p>
      <div class="form-group">
        <label class="form-label">סיבת הדחייה *</label>
        <textarea class="form-textarea" name="rejectionReason" required placeholder="למשל: יש אירוע משפחתי באותו יום..."></textarea>
      </div>
    </form>`,
    `<button class="btn btn-danger" id="modal-save">שלח דחייה</button>
     <button class="btn btn-secondary" id="modal-cancel">ביטול</button>`
  );

  document.getElementById('modal-save')?.addEventListener('click', async () => {
    const form = document.getElementById('custody-reject-form');
    const reason = form?.querySelector('[name=rejectionReason]')?.value?.trim();
    if (!reason) {
      showToast('נא למלא סיבת דחייה');
      return;
    }
    const request = (appData.custodyRequests || []).find(r => r.id === requestId);
    if (!request) return;

    try {
      showLoading(true);
      const myRole = getMySenderRole();
      await respondToCustodyChangeRequest(requestId, {
        status: 'rejected',
        respondedBy: myRole,
        rejectionReason: reason
      });
      await createAppUpdate({
        updateType: 'custody_change',
        title: '❌ בקשת משמורת נדחתה',
        body: `${request.title} — ${reason}`,
        linkPage: 'custody',
        referenceId: requestId,
        targetParentRole: request.requestedBy
      });
      await refreshData();
      closeModal();
      showToast('הבקשה נדחתה', 'success');
      render();
    } catch (err) {
      handleDbError(err);
    } finally {
      showLoading(false);
    }
  });
  document.getElementById('modal-cancel')?.addEventListener('click', () => closeModal());
}

function handleNoticeForm(notice = null, defaults = {}) {
  const isEdit = !!notice;
  const type = notice?.noticeType || defaults.noticeType || 'reminder';
  const titles = {
    reminder: 'תזכורת חדשה',
    absence: 'דיווח אי הגעה / היעדרות',
    cancellation: 'ביטול מפגש',
    military: 'דיווח מילואים / צו 8',
    violation: 'דיווח הפרת משמורת'
  };

  openModal(
    isEdit ? 'עריכת תזכורת / דיווח' : (titles[type] || 'תזכורת / דיווח'),
    getNoticeFormHtml(appData, notice, defaults),
    `<button class="btn btn-primary" id="modal-save">שמור ושלח</button>
     <button class="btn btn-secondary" id="modal-cancel">ביטול</button>`
  );

  const form = document.getElementById('notice-form');
  if (!form) return;
  if (typeof initNoticeFormFields === 'function') initNoticeFormFields(form);

  document.getElementById('modal-save')?.addEventListener('click', async () => {
    const data = getFormData(form);
    const requiresAck = !!form.querySelector('[name=requiresAck]')?.checked;
    const remindDayBefore = !!form.querySelector('[name=remindDayBefore]')?.checked;
    const hasPenalty = !!form.querySelector('[name=hasPenalty]')?.checked;
    const payload = {
      noticeType: data.noticeType || type,
      presetId: data.presetId || '',
      title: data.title?.trim(),
      description: data.description?.trim() || '',
      date: data.date,
      time: data.time || '',
      childId: data.childId || null,
      location: data.location?.trim() || '',
      withPerson: data.withPerson?.trim() || '',
      violatorRole: data.violatorRole || null,
      requiresAck,
      remindDayBefore,
      hasPenalty,
      penaltyAmount: hasPenalty ? parseFloat(data.penaltyAmount) : null,
      createdBy: getMySenderRole()
    };

    if (!payload.title || !payload.date) {
      showToast('נא למלא כותרת ותאריך');
      return;
    }

    try {
      showLoading(true);
      let saved;
      if (isEdit) {
        await updateParentNotice(notice.id, { ...payload, expenseId: notice.expenseId });
        saved = { ...notice, ...payload };
      } else {
        saved = await createParentNotice(payload);
        if (payload.noticeType === 'violation' && hasPenalty && payload.penaltyAmount > 0) {
          const expenseId = await createViolationExpense(appData, saved, payload.violatorRole || 'b');
          if (expenseId) {
            await linkNoticeExpense(saved.id, expenseId);
            saved.expenseId = expenseId;
          }
        }
        if (typeof notifyPartnerAboutNotice === 'function') {
          await notifyPartnerAboutNotice(appData, saved);
        }
      }
      await refreshData();
      closeModal();
      const partner = getParentName(appData, getMySenderRole() === 'a' ? 'b' : 'a');
      showToast(
        payload.requiresAck
          ? `נשמר ונשלח ל${partner} — יופיע בעדכונים`
          : 'נשמר בהצלחה',
        'success'
      );
      render();
    } catch (err) {
      handleDbError(err);
    } finally {
      showLoading(false);
    }
  });
  document.getElementById('modal-cancel')?.addEventListener('click', () => closeModal());
}

function handleConsentForm(consent = null) {
  if (typeof destroySignaturePad === 'function') destroySignaturePad();

  const myRole = getMySenderRole();
  const isNew = !consent;
  const canSign = consent && typeof canSignConsent === 'function' && canSignConsent(consent, myRole);
  const isCompleted = consent?.status === 'completed';
  const hasPartner = appData.family?.hasPartner;
  const iSigned = consent && typeof consentHasSignature === 'function' && consentHasSignature(consent, myRole);

  let footer = '';
  if (isCompleted) {
    footer = `<button class="btn btn-primary" id="modal-download-consent-pdf">📄 הורד PDF</button>
      <button class="btn btn-secondary" id="modal-print-consent">🖨️ הדפס / שמור PDF</button>
      <button class="btn btn-secondary" id="modal-cancel">סגור</button>`;
  } else {
    footer = `<button class="btn btn-primary" id="modal-save-consent">${isNew ? 'שמור טיוטה' : 'שמור שינויים'}</button>`;
    if (canSign || isNew) footer += `<button class="btn btn-primary" id="modal-sign-consent">✍️ חתום</button>`;
    if (hasPartner && consent && iSigned && consent.status === 'pending_signature') {
      footer += `<button class="btn btn-secondary" id="modal-send-consent">שלח להורה השני לחתימה</button>`;
    }
    footer += `<button class="btn btn-secondary" id="modal-cancel">ביטול</button>`;
  }

  openModal(
    isNew ? 'טופס הסכמה הורית משותפת' : `טופס הסכמה — ${consent.childFullName || ''}`,
    renderConsentFormModalHtml(appData, consent),
    footer
  );

  const canvas = document.getElementById('signature-canvas');
  if (canvas && typeof initSignaturePad === 'function') {
    requestAnimationFrame(() => initSignaturePad(canvas));
  }

  const form = document.getElementById('consent-form');
  form?.querySelector('#consent-child-select')?.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const nameInput = form.querySelector('[name=childFullName]');
    if (opt?.value && nameInput) nameInput.value = opt.textContent.trim();
  });

  const modalBody = document.getElementById('modal-body');
  const onModalClick = (e) => {
    if (e.target.closest('[data-action="clear-signature"]') && activeSignaturePad) {
      activeSignaturePad.clear();
    }
  };
  modalBody?.addEventListener('click', onModalClick);

  async function collectConsentPayload() {
    const data = getFormData(form);
    return {
      formType: 'parental_activity',
      institutionName: data.institutionName?.trim(),
      activityDescription: data.activityDescription?.trim(),
      childId: data.childId || null,
      childFullName: data.childFullName?.trim(),
      childIdNumber: data.childIdNumber?.trim(),
      parentAName: getParentName(appData, 'a'),
      parentBName: getParentName(appData, 'b'),
      parentAIdNumber: data.parentAIdNumber?.trim() || consent?.parentAIdNumber || '',
      parentBIdNumber: data.parentBIdNumber?.trim() || consent?.parentBIdNumber || '',
      createdBy: myRole
    };
  }

  async function ensureConsentSaved() {
    const payload = await collectConsentPayload();
    if (!payload.institutionName || !payload.activityDescription || !payload.childFullName || !payload.childIdNumber) {
      throw new Error('נא למלא את כל השדות המסומנים');
    }
    if (consent?.id) {
      await updateConsentForm(consent.id, { ...payload, status: consent.status });
      return consent.id;
    }
    const created = await createConsentForm(payload);
    return created.id;
  }

  document.getElementById('modal-save-consent')?.addEventListener('click', async () => {
    try {
      showLoading(true);
      await ensureConsentSaved();
      await refreshData();
      closeModal();
      showToast('הטופס נשמר', 'success');
      render();
    } catch (err) {
      showToast(err.message || translateDbError(err));
    } finally {
      showLoading(false);
    }
  });

  document.getElementById('modal-sign-consent')?.addEventListener('click', async () => {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) {
      showToast('שדה החתימה לא נמצא — גללו לחלק החתימה שלכם (א׳ או ב׳)');
      return;
    }
    if (!activeSignaturePad || activeSignaturePad.isEmpty()) {
      showToast('נא לחתום בשדה החתימה למעלה');
      canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const idField = form.querySelector(`[name=parent${myRole === 'a' ? 'A' : 'B'}IdNumber]`);
    const idNumber = idField?.value?.trim();
    if (!idNumber) {
      showToast('נא למלא תעודת זהות');
      return;
    }
    try {
      showLoading(true);
      const consentId = await ensureConsentSaved();
      if (typeof saveProfileIdNumber === 'function') await saveProfileIdNumber(idNumber);
      await signConsentForm(consentId, {
        parentRole: myRole,
        signature: activeSignaturePad.toDataUrl(),
        idNumber,
        parentName: getParentName(appData, myRole)
      });
      await refreshData();
      const updated = appData.consentForms.find(c => c.id === consentId);
      closeModal();
      if (updated?.status === 'completed') {
        showToast('שתי החתימות הושלמו! ניתן להוריד PDF', 'success');
      } else if (hasPartner) {
        showToast('נחתם בהצלחה — שלח/י להורה השני לחתימה', 'success');
        handleConsentForm(updated);
      } else {
        showToast('נחתם בהצלחה', 'success');
      }
      render();
    } catch (err) {
      handleDbError(err);
    } finally {
      showLoading(false);
    }
  });

  document.getElementById('modal-send-consent')?.addEventListener('click', async () => {
    if (!consent) return;
    try {
      showLoading(true);
      const result = await sendConsentSignatureRequest(appData, consent);
      await refreshData();
      closeModal();
      const emailNote = result.partnerEmail ? ' ונפתח חלון מייל' : ' (הקישור הועתק)';
      showToast(`נשלח להורה השני — מופיע גם בעדכונים${emailNote}`, 'success');
      render();
    } catch (err) {
      handleDbError(err);
    } finally {
      showLoading(false);
    }
  });

  document.getElementById('modal-download-consent-pdf')?.addEventListener('click', async () => {
    if (!consent) return;
    try {
      await downloadConsentPdf(appData, consent);
    } catch (err) {
      showToast(err.message || 'שגיאה בהורדת PDF');
    }
  });
  document.getElementById('modal-print-consent')?.addEventListener('click', () => {
    if (!consent || typeof printConsentForm !== 'function') return;
    printConsentForm(appData, consent);
  });

  document.getElementById('modal-cancel')?.addEventListener('click', () => {
    modalBody?.removeEventListener('click', onModalClick);
    if (typeof destroySignaturePad === 'function') destroySignaturePad();
    closeModal();
  });
}

function handleDayClick(dateStr) {
  (async () => {
    let birthdays = typeof getBirthdaysOnDateSync === 'function'
      ? getBirthdaysOnDateSync(appData, dateStr)
      : [];
    if (typeof getBirthdaysOnDateCached === 'function') {
      birthdays = await getBirthdaysOnDateCached(appData, dateStr);
    }
    const title = birthdays.length ? `🎂 ${formatDate(dateStr)}` : formatDate(dateStr);
    openModal(title, getDayDetailHtml(appData, dateStr), '');
    document.querySelector('[data-action="add-event-date"]')?.addEventListener('click', () => {
      closeModal();
      handleEventForm(null, dateStr);
    });
  })();
}

function handleContentClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.id;

  switch (action) {
    case 'add-child':
      handleChildForm();
      break;
    case 'edit-child': {
      const child = appData.children.find(c => c.id === id);
      if (child) handleChildForm(child);
      break;
    }
    case 'delete-child':
      confirmDelete('האם למחוק את הילד/ה?').then(async ok => {
        if (!ok) return;
        try {
          showLoading(true);
          await deleteChild(id);
          await refreshData();
          showToast('נמחק', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      });
      break;
    case 'add-event':
      handleEventForm();
      break;
    case 'edit-event': {
      const event = appData.events.find(ev => ev.id === id);
      if (event) handleEventForm(event);
      break;
    }
    case 'delete-event':
      confirmDelete('האם למחוק את האירוע?').then(async ok => {
        if (!ok) return;
        try {
          showLoading(true);
          await deleteEvent(id);
          await refreshData();
          showToast('נמחק', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      });
      break;
    case 'add-expense':
      handleExpenseForm();
      break;
    case 'edit-expense': {
      const expense = appData.expenses.find(ex => ex.id === id);
      if (expense) handleExpenseForm(expense);
      break;
    }
    case 'delete-expense':
      confirmDelete('האם למחוק את ההוצאה?').then(async ok => {
        if (!ok) return;
        try {
          showLoading(true);
          await deleteExpense(id);
          await refreshData();
          showToast('נמחק', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      });
      break;
    case 'mark-paid':
      (async () => {
        try {
          showLoading(true);
          await markExpensePaid(id);
          await refreshData();
          showToast('סומן כשולם', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      })();
      break;
    case 'approve-expense-split':
      (async () => {
        const expense = appData.expenses.find(ex => ex.id === id);
        if (!expense) return;
        try {
          showLoading(true);
          await respondToExpense(id, {
            approvalStatus: 'approved',
            agreeToSplit: true,
            respondedBy: getMySenderRole(),
            paidBy: expense.paidBy
          });
          await refreshData();
          showToast('ההוצאה אושרה לחלוק', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      })();
      break;
    case 'approve-expense-full':
      (async () => {
        const expense = appData.expenses.find(ex => ex.id === id);
        if (!expense) return;
        try {
          showLoading(true);
          await respondToExpense(id, {
            approvalStatus: 'approved',
            agreeToSplit: false,
            respondedBy: getMySenderRole(),
            paidBy: expense.paidBy
          });
          await refreshData();
          showToast('ההוצאה אושרה — המבקש/ת משלם/ת', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      })();
      break;
    case 'reject-expense':
      confirmDelete('לדחות את בקשת ההוצאה?').then(async ok => {
        if (!ok) return;
        const expense = appData.expenses.find(ex => ex.id === id);
        try {
          showLoading(true);
          await respondToExpense(id, {
            approvalStatus: 'rejected',
            agreeToSplit: false,
            respondedBy: getMySenderRole(),
            paidBy: expense?.paidBy
          });
          await refreshData();
          showToast('ההוצאה נדחתה', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      });
      break;
    case 'add-notice':
      handleNoticeForm(null, { noticeType: target.dataset.noticeType || 'reminder' });
      break;
    case 'add-notice-preset': {
      const preset = typeof NOTICE_PRESETS !== 'undefined'
        ? NOTICE_PRESETS.find(p => p.id === target.dataset.presetId)
        : null;
      if (preset) {
        handleNoticeForm(null, { noticeType: preset.type, presetId: preset.id, title: preset.title });
      }
      break;
    }
    case 'edit-notice': {
      const notice = (appData.parentNotices || []).find(n => n.id === id);
      if (notice) handleNoticeForm(notice);
      break;
    }
    case 'ack-notice':
      (async () => {
        try {
          showLoading(true);
          await acknowledgeParentNotice(id, getMySenderRole());
          await refreshData();
          showToast('סומן כנקרא / מאושר', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      })();
      break;
    case 'delete-notice':
      confirmDelete('למחוק את התזכורת / הדיווח?').then(async ok => {
        if (!ok) return;
        try {
          showLoading(true);
          await deleteParentNotice(id);
          await refreshData();
          showToast('נמחק', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      });
      break;
    case 'request-custody-change':
      handleCustodyChangeForm();
      break;
    case 'approve-custody-change':
      (async () => {
        const request = (appData.custodyRequests || []).find(r => r.id === id);
        if (!request || request.status !== 'pending') return;
        try {
          showLoading(true);
          const myRole = getMySenderRole();
          await respondToCustodyChangeRequest(id, {
            status: 'approved',
            respondedBy: myRole,
            rejectionReason: null
          });
          if (typeof applyApprovedCustodyChange === 'function') {
            await applyApprovedCustodyChange(appData, request);
          }
          await createAppUpdate({
            updateType: 'custody_change',
            title: '✅ בקשת משמורת אושרה',
            body: `${request.title} — ${formatDate(request.date)}`,
            linkPage: 'custody',
            referenceId: id,
            targetParentRole: request.requestedBy
          });
          await refreshData();
          showToast('הבקשה אושרה והמשמורת עודכנה', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      })();
      break;
    case 'reject-custody-change':
      handleRejectCustodyChange(id);
      break;
    case 'new-consent':
      handleConsentForm();
      break;
    case 'open-consent': {
      const consent = (appData.consentForms || []).find(c => c.id === id);
      if (consent) handleConsentForm(consent);
      break;
    }
    case 'download-consent-pdf': {
      const consent = (appData.consentForms || []).find(c => c.id === id);
      if (consent) {
        downloadConsentPdf(appData, consent).catch(err => {
          showToast(err.message || 'שגיאה בהורדת PDF');
        });
      }
      break;
    }
    case 'print-consent': {
      const consent = (appData.consentForms || []).find(c => c.id === id);
      if (consent && typeof printConsentForm === 'function') {
        printConsentForm(appData, consent);
      }
      break;
    }
    case 'open-update':
      (async () => {
        const update = (appData.updates || []).find(u => u.id === id);
        if (!update) return;
        try {
          await markAppUpdateRead(id, getMySenderRole());
          await refreshData();
          if (update.linkPage === 'approvals' && update.referenceId) {
            window.location.hash = `approvals&consent=${update.referenceId}`;
          } else if (update.linkPage === 'notices') {
            window.location.hash = 'notices';
          } else {
            window.location.hash = update.linkPage || 'updates';
          }
          render();
        } catch (err) {
          handleDbError(err);
        }
      })();
      break;
    case 'download-expense-pdf':
      downloadExpenseReportPdf(appData);
      break;
    case 'export-data': {
      const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'coparent-backup.json';
      a.click();
      showToast('הנתונים יוצאו', 'success');
      break;
    }
    case 'import-data': {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            showLoading(true);
            const imported = JSON.parse(reader.result);
            await importAppData(imported);
            await refreshData();
            showToast('הנתונים יובאו', 'success');
            render();
          } catch (err) {
            handleDbError(err, 'קובץ לא תקין');
          } finally {
            showLoading(false);
          }
        };
        reader.readAsText(file);
      };
      input.click();
      break;
    }
    case 'load-demo':
      (async () => {
        try {
          showLoading(true);
          await seedDemoDataToDb();
          await refreshData();
          showToast('נתוני דוגמה נטענו', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      })();
      break;
    case 'reset-data':
      confirmDelete('האם למחוק את כל הנתונים? פעולה זו בלתי הפיכה.').then(async ok => {
        if (!ok) return;
        try {
          showLoading(true);
          await deleteAllUserData();
          await refreshData();
          showToast('הנתונים נמחקו');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      });
      break;
    case 'copy-invite': {
      const input = document.getElementById('invite-link');
      const link = input?.value || appData.family?.inviteLink;
      if (!link) return;
      navigator.clipboard.writeText(link)
        .then(() => showToast('הלינק הועתק!', 'success'))
        .catch(() => showToast(link));
      break;
    }
    case 'join-family': {
      const input = document.getElementById('join-code-input');
      const code = input?.value.trim().toUpperCase();
      if (!code) { showToast('הזן/י קוד הזמנה'); return; }
      (async () => {
        try {
          showLoading(true);
          await joinFamilyByCode(code);
          await refreshData();
          showToast('הצטרפת למשפחה בהצלחה!', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      })();
      break;
    }
    case 'logout':
      signOut().then(() => showToast('התנתקת בהצלחה'));
      break;
  }
}

function readVisitDetailFromDom(scope, key) {
  const overnightEl = document.querySelector(`input[data-visit-overnight="${scope}"][data-visit-key="${key}"]`);
  const pickupEl = document.querySelector(`input[data-visit-pickup="${scope}"][data-visit-key="${key}"]`);
  const returnEl = document.querySelector(`input[data-visit-return="${scope}"][data-visit-key="${key}"]`);
  return {
    overnight: overnightEl ? overnightEl.checked : true,
    pickup: pickupEl?.value || '',
    returnTime: returnEl?.value || ''
  };
}

function applyVisitDetailToSettings(scope, key) {
  const detail = readVisitDetailFromDom(scope, key);
  if (scope === 'week') {
    setDayDetailInSettings(appData.settings, 'dayDetails', key, detail);
  } else if (scope === 'week2') {
    if (!appData.settings.week2DayDetails) appData.settings.week2DayDetails = {};
    setDayDetailInSettings(appData.settings, 'week2DayDetails', key, detail);
  } else if (scope === 'weekend') {
    if (!appData.settings.weekendCycle) appData.settings.weekendCycle = structuredClone(DEFAULT_DATA.settings.weekendCycle);
    if (!appData.settings.weekendCycle.dayDetails) appData.settings.weekendCycle.dayDetails = {};
    appData.settings.weekendCycle.dayDetails[key] = detail;
  } else if (scope === 'manual') {
    setDayDetailInSettings(appData.settings, 'manualDayDetails', key, detail);
  } else if (scope === 'monthly') {
    const idx = parseInt(key, 10);
    if (appData.settings.monthlyVisits?.[idx]) {
      Object.assign(appData.settings.monthlyVisits[idx], detail);
    }
  }
}

function collectCustodyExtrasFromForm(form) {
  for (let i = 0; i < 7; i++) {
    if (form.querySelector(`input[data-visit-overnight="week"][data-visit-key="${i}"]`)) {
      applyVisitDetailToSettings('week', i);
    }
    if (form.querySelector(`input[data-visit-overnight="week2"][data-visit-key="${i}"]`)) {
      applyVisitDetailToSettings('week2', i);
    }
  }

  if (form.weekendParent) {
    const wc = appData.settings.weekendCycle || structuredClone(DEFAULT_DATA.settings.weekendCycle);
    wc.parent = form.weekendParent.value;
    wc.offParent = form.weekendOffParent.value;
    wc.intervalWeeks = parseInt(form.weekendInterval.value, 10) || 3;
    wc.startDate = form.weekendStartDate.value;
    wc.days = [...form.querySelectorAll('input[name="weekendDays"]:checked')].map(el => parseInt(el.value, 10));
    wc.dayDetails = {};
    wc.days.forEach(day => {
      wc.dayDetails[day] = readVisitDetailFromDom('weekend', day);
    });
    if (form.followUpEnabled) {
      wc.followUpVisit = {
        enabled: form.followUpEnabled.checked,
        dayOfWeek: parseInt(form.followUpDay?.value ?? '5', 10),
        weeksAfter: 1,
        parent: form.followUpParent?.value || wc.parent,
        pickup: form.followUpPickup?.value || '14:00',
        returnTime: form.followUpReturn?.value || '18:00'
      };
    }
    if (!wc.skippedFollowUpDates) wc.skippedFollowUpDates = [];
    const flexRows = form.querySelectorAll('.monthly-visit-row[data-flex-idx]');
    wc.flexVisits = [...flexRows].map(row => ({
      date: row.querySelector('[data-flex-field="date"]')?.value || '',
      parent: row.querySelector('[data-flex-field="parent"]')?.value || wc.parent,
      overnight: false,
      pickup: row.querySelector('[data-flex-field="pickup"]')?.value || '14:00',
      returnTime: row.querySelector('[data-flex-field="returnTime"]')?.value || '18:00'
    })).filter(v => v.date);
    appData.settings.weekendCycle = wc;
  }

  const monthlyRows = form.querySelectorAll('.monthly-visit-row[data-monthly-idx]');
  if (monthlyRows.length) {
    appData.settings.monthlyVisits = [...monthlyRows].map(row => {
      const idx = row.dataset.monthlyIdx;
      return {
        dayOfWeek: parseInt(row.querySelector('[data-monthly-field="dayOfWeek"]').value, 10),
        nthInMonth: parseInt(row.querySelector('[data-monthly-field="nthInMonth"]').value, 10),
        parent: row.querySelector('[data-monthly-field="parent"]').value,
        ...readVisitDetailFromDom('monthly', idx)
      };
    });
  }

  document.querySelectorAll('input[data-visit-overnight="manual"]').forEach(el => {
    applyVisitDetailToSettings('manual', el.dataset.visitKey);
  });

  collectVisitHoursFromForm(form);
}

function collectVisitHoursFromForm(form) {
  if (!form.visitHoursBaseParent) return;
  const days = {};
  for (let i = 0; i < 7; i++) {
    const activeEl = form.querySelector(`input[data-visit-hours-active="${i}"]`);
    if (!activeEl) continue;
    if (activeEl.checked) {
      days[i] = {
        active: true,
        parent: form.querySelector(`[data-visit-hours-parent="${i}"]`)?.value || 'b',
        pickup: form.querySelector(`[data-visit-hours-pickup="${i}"]`)?.value || '14:00',
        returnTime: form.querySelector(`[data-visit-hours-return="${i}"]`)?.value || '18:00'
      };
    }
  }
  appData.settings.visitHours = {
    baseParent: form.visitHoursBaseParent.value,
    days
  };
}

function setupEventListeners() {
  if (listenersReady) return;
  listenersReady = true;

  window.addEventListener('hashchange', render);

  document.getElementById('main-nav').addEventListener('click', e => {
    if (e.target.closest('.nav-link')) closeSidebar();
  });

  document.getElementById('bottom-nav-more').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
  });

  document.getElementById('content').addEventListener('click', e => {
    if (e.target.closest('.cal-day')) {
      handleDayClick(e.target.closest('.cal-day').dataset.date);
      return;
    }

    if (e.target.closest('[data-cal-nav]')) {
      const dir = e.target.closest('[data-cal-nav]').dataset.calNav;
      if (dir === 'prev') {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
      } else {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
      }
      render();
      return;
    }

    if (e.target.closest('[data-cal-print]')) {
      printCalendarMonth();
      return;
    }

    if (e.target.closest('[data-cal-pdf]')) {
      downloadCalendarPdf();
      return;
    }

    if (e.target.closest('[data-week2-day]')) {
      const btn = e.target.closest('[data-week2-day]');
      const day = parseInt(btn.dataset.week2Day, 10);
      if (!appData.settings.weekSchedule2) appData.settings.weekSchedule2 = { ...getBiweeklyPresets().week2 };
      appData.settings.weekSchedule2[day] = btn.dataset.parent;
      saveCustodySettings();
      return;
    }

    if (e.target.closest('[data-week-day]')) {
      const btn = e.target.closest('[data-week-day]');
      const day = parseInt(btn.dataset.weekDay, 10);
      appData.settings.weekSchedule[day] = btn.dataset.parent;
      saveCustodySettings();
      return;
    }

    if (e.target.closest('[data-manual-date]')) {
      const btn = e.target.closest('[data-manual-date]');
      if (!appData.settings.manualDates) appData.settings.manualDates = {};
      appData.settings.manualDates[btn.dataset.manualDate] = btn.dataset.parent;
      saveCustodySettings();
      return;
    }

    if (e.target.matches('[data-visit-overnight]')) {
      const scope = e.target.dataset.visitOvernight;
      const key = e.target.dataset.visitKey;
      const timesRow = document.querySelector(`[data-visit-times-for="${scope}"][data-visit-key="${key}"]`);
      if (timesRow) timesRow.classList.toggle('is-hidden', e.target.checked);
      applyVisitDetailToSettings(scope, key);
      updateCustodyUi({ reRender: false, saveDelay: 500 });
      return;
    }

    if (e.target.matches('[data-visit-hours-active]')) {
      const day = e.target.dataset.visitHoursActive;
      const panel = document.querySelector(`[data-visit-hours-panel="${day}"]`);
      const row = e.target.closest('.visit-hours-day');
      if (panel) panel.classList.toggle('is-hidden', !e.target.checked);
      if (row) row.classList.toggle('is-visit-active', e.target.checked);
      collectVisitHoursFromForm(e.target.closest('#custody-form') || document);
      updateCustodyUi({ reRender: false, saveDelay: 400 });
      return;
    }

    if (e.target.closest('[data-add-monthly-visit]')) {
      if (!appData.settings.monthlyVisits) appData.settings.monthlyVisits = [];
      appData.settings.monthlyVisits.push({
        dayOfWeek: 5,
        nthInMonth: 1,
        parent: 'b',
        overnight: false,
        pickup: '14:00',
        returnTime: '18:00'
      });
      saveCustodySettings();
      return;
    }

    if (e.target.closest('[data-add-flex-visit]')) {
      if (!appData.settings.weekendCycle) appData.settings.weekendCycle = structuredClone(DEFAULT_DATA.settings.weekendCycle);
      if (!appData.settings.weekendCycle.flexVisits) appData.settings.weekendCycle.flexVisits = [];
      appData.settings.weekendCycle.flexVisits.push({
        date: '',
        parent: appData.settings.weekendCycle.parent || 'b',
        overnight: false,
        pickup: '14:00',
        returnTime: '18:00'
      });
      saveCustodySettings();
      return;
    }

    if (e.target.closest('[data-remove-flex-visit]')) {
      const idx = parseInt(e.target.closest('[data-remove-flex-visit]').dataset.removeFlexVisit, 10);
      if (appData.settings.weekendCycle?.flexVisits) {
        appData.settings.weekendCycle.flexVisits.splice(idx, 1);
        saveCustodySettings();
      }
      return;
    }

    if (e.target.closest('[data-add-skip-date]')) {
      const form = e.target.closest('#custody-form');
      const dateInput = form?.querySelector('#newSkipDate');
      const dateStr = dateInput?.value;
      if (!dateStr) return;
      if (!appData.settings.weekendCycle) appData.settings.weekendCycle = structuredClone(DEFAULT_DATA.settings.weekendCycle);
      if (!appData.settings.weekendCycle.skippedFollowUpDates) appData.settings.weekendCycle.skippedFollowUpDates = [];
      if (!appData.settings.weekendCycle.skippedFollowUpDates.includes(dateStr)) {
        appData.settings.weekendCycle.skippedFollowUpDates.push(dateStr);
        appData.settings.weekendCycle.skippedFollowUpDates.sort();
      }
      if (dateInput) dateInput.value = '';
      saveCustodySettings();
      return;
    }

    if (e.target.closest('[data-remove-skip-date]')) {
      const idx = parseInt(e.target.closest('[data-remove-skip-date]').dataset.removeSkipDate, 10);
      if (appData.settings.weekendCycle?.skippedFollowUpDates) {
        appData.settings.weekendCycle.skippedFollowUpDates.splice(idx, 1);
        saveCustodySettings();
      }
      return;
    }

    if (e.target.closest('[data-remove-monthly-visit]')) {
      const idx = parseInt(e.target.closest('[data-remove-monthly-visit]').dataset.removeMonthlyVisit, 10);
      appData.settings.monthlyVisits.splice(idx, 1);
      saveCustodySettings();
      return;
    }

    if (e.target.closest('[data-custody-fill-week1]')) {
      const parent = e.target.closest('[data-custody-fill-week1]').dataset.custodyFillWeek1;
      for (let i = 0; i < 7; i++) appData.settings.weekSchedule[i] = parent;
      saveCustodySettings('שבוע 1 עודכן');
      return;
    }

    if (e.target.closest('[data-custody-fill-week2]')) {
      const parent = e.target.closest('[data-custody-fill-week2]').dataset.custodyFillWeek2;
      if (!appData.settings.weekSchedule2) appData.settings.weekSchedule2 = { ...getBiweeklyPresets().week2 };
      for (let i = 0; i < 7; i++) appData.settings.weekSchedule2[i] = parent;
      saveCustodySettings('שבוע 2 עודכן');
      return;
    }

    if (e.target.closest('[data-custody-preset]')) {
      applyCommonBiweeklyPreset(appData.settings);
      saveCustodySettings('הדוגמה הנפוצה נטענה');
      return;
    }

    if (e.target.closest('[data-custody-fill]')) {
      const parent = e.target.closest('[data-custody-fill]').dataset.custodyFill;
      for (let i = 0; i < 7; i++) appData.settings.weekSchedule[i] = parent;
      saveCustodySettings('הלוח השבועי עודכן');
      return;
    }

    if (e.target.closest('[data-custody-fill-week]')) {
      const parent = e.target.closest('[data-custody-fill-week]').dataset.custodyFillWeek;
      if (!appData.settings.manualDates) appData.settings.manualDates = {};
      getManualWeekDates(custodyPreviewWeekOffset).forEach(dateStr => {
        appData.settings.manualDates[dateStr] = parent;
      });
      saveCustodySettings('התקופה עודכנה');
      return;
    }

    if (e.target.closest('[data-custody-clear-manual]')) {
      appData.settings.manualDates = {};
      saveCustodySettings('הבחירות הידניות נוקו');
      return;
    }

    if (e.target.closest('[data-custody-week-nav]')) {
      const dir = e.target.closest('[data-custody-week-nav]').dataset.custodyWeekNav;
      custodyPreviewWeekOffset += dir === 'next' ? 1 : -1;
      render();
      return;
    }

    if (e.target.closest('.week-day')) {
      const dayEl = e.target.closest('.week-day');
      const day = parseInt(dayEl.dataset.day, 10);
      const current = appData.settings.weekSchedule[day] || 'a';
      appData.settings.weekSchedule[day] = current === 'a' ? 'b' : 'a';
      saveCustodySettings();
      return;
    }

    handleContentClick(e);
  });

  document.getElementById('topbar-actions').addEventListener('click', handleContentClick);

  document.getElementById('content').addEventListener('input', e => {
    if (!e.target.closest('#custody-form')) return;

    if (e.target.matches('[data-visit-pickup], [data-visit-return]')) {
      const scope = e.target.dataset.visitPickup || e.target.dataset.visitReturn;
      const key = e.target.dataset.visitKey;
      applyVisitDetailToSettings(scope, key);
      updateCustodyUi({ reRender: false, saveDelay: 900 });
      return;
    }

    if (e.target.matches('[data-visit-hours-pickup], [data-visit-hours-return]')) {
      collectVisitHoursFromForm(e.target.closest('#custody-form'));
      updateCustodyUi({ reRender: false, saveDelay: 900 });
      return;
    }

    if (e.target.matches('[data-flex-field], #followUpPickup, #followUpReturn')) {
      collectCustodyExtrasFromForm(e.target.closest('#custody-form') || document);
      updateCustodyUi({ reRender: false, saveDelay: 900 });
    }
  });

  document.getElementById('content').addEventListener('change', e => {
    if (e.target.matches('[data-monthly-field], [data-flex-field]')) {
      collectCustodyExtrasFromForm(e.target.closest('#custody-form') || document);
      updateCustodyUi({ reRender: false, saveDelay: 500 });
      return;
    }
    if (e.target.matches('#followUpEnabled, #followUpDay, #followUpParent, #followUpPickup, #followUpReturn')) {
      const fields = document.getElementById('follow-up-fields');
      if (fields && e.target.id === 'followUpEnabled') {
        fields.classList.toggle('is-hidden', !e.target.checked);
      }
      collectCustodyExtrasFromForm(e.target.closest('#custody-form') || document);
      updateCustodyUi({ reRender: false, saveDelay: 400 });
      return;
    }
    if (e.target.matches('#visitHoursBaseParent, [data-visit-hours-parent]')) {
      collectVisitHoursFromForm(e.target.closest('#custody-form') || document);
      updateCustodyUi({ reRender: false, saveDelay: 500 });
      return;
    }
    if (e.target.matches('[data-visit-hours-pickup], [data-visit-hours-return]')) {
      collectVisitHoursFromForm(e.target.closest('#custody-form') || document);
      updateCustodyUi({ reRender: false, saveDelay: 500 });
      return;
    }
    if (e.target.matches('input[name="weekendDays"]')) {
      collectCustodyExtrasFromForm(e.target.closest('#custody-form') || document);
      updateCustodyUi({ reRender: true, saveDelay: 400 });
      return;
    }
    if (e.target.matches('#weekendParent, #weekendOffParent, #weekendInterval, #weekendStartDate')) {
      collectCustodyExtrasFromForm(e.target.closest('#custody-form') || document);
      updateCustodyUi({ reRender: false, saveDelay: 400 });
      return;
    }
    if (e.target.name === 'custodyPattern' && e.target.closest('#custody-form')) {
      appData.settings.custodyPattern = e.target.value;
      custodyPreviewWeekOffset = 0;
      if (e.target.value === 'biweekly') {
        if (!appData.settings.weekSchedule2) {
          appData.settings.weekSchedule2 = { ...getBiweeklyPresets().week2 };
        }
      }
      if (e.target.value === 'weekend-cycle' && !appData.settings.weekendCycle) {
        appData.settings.weekendCycle = structuredClone(DEFAULT_DATA.settings.weekendCycle);
      }
      if (e.target.value === 'visit-hours' && !appData.settings.visitHours) {
        appData.settings.visitHours = structuredClone(DEFAULT_DATA.settings.visitHours);
      }
      updateCustodyUi({ reRender: true, saveDelay: 300 });
    }
  });

  document.getElementById('content').addEventListener('submit', e => {
    if (e.target.id === 'custody-form') {
      e.preventDefault();
      const fd = getFormData(e.target);
      (async () => {
        try {
          collectCustodyExtrasFromForm(e.target);
          appData.settings.custodyPattern = fd.custodyPattern || appData.settings.custodyPattern;
          if (fd.custodyStartDate) appData.settings.custodyStartDate = fd.custodyStartDate;
          showLoading(true);
          clearTimeout(custodyPersistTimer);
          await saveSettings(appData.settings);
          await refreshData();
          showToast('הגדרות משמורת נשמרו', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      })();
    }
    if (e.target.id === 'settings-form') {
      e.preventDefault();
      const fd = getFormData(e.target);
      appData.settings.parentAName = fd.parentAName;
      appData.settings.parentBName = fd.parentBName;
      appData.settings.parentAAvatar = fd.parentAAvatar || '';
      appData.settings.parentBAvatar = fd.parentBAvatar || '';
      appData.settings.currentParent = appData.family?.hasPartner
        ? appData.family.myParentRole
        : fd.currentParent;
      (async () => {
        try {
          showLoading(true);
          await saveSettings(appData.settings);
          if (typeof saveProfileIdNumber === 'function') {
            await saveProfileIdNumber(fd.myIdNumber || '');
          }
          await refreshData();
          showToast('ההגדרות נשמרו', 'success');
          render();
        } catch (err) {
          handleDbError(err);
        } finally {
          showLoading(false);
        }
      })();
    }
  });

  document.getElementById('content').addEventListener('click', e => {
    if (e.target.id === 'send-message') {
      const input = document.getElementById('message-input');
      const text = input.value.trim();
      if (!text) return;
      (async () => {
        try {
          await createMessage(text, getMySenderRole());
          await refreshData();
          input.value = '';
          render();
        } catch (err) {
          handleDbError(err);
        }
      })();
    }
  });

  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
  });

  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
  setupModalListeners();
}

async function onUserLoggedIn(user) {
  if (loadedUserId === user.id) return;
  loadedUserId = user.id;

  hideAuthGate();
  updateUserUI(user);
  showLoading(true);

  try {
    await ensureUserData(user.id);

    if (pendingJoinCode) {
      const code = pendingJoinCode;
      pendingJoinCode = null;
      try {
        await joinFamilyByCode(code);
        showToast('הצטרפת למשפחה בהצלחה!', 'success');
      } catch (err) {
        handleDbError(err, 'שגיאה בהצטרפות למשפחה');
      }
    }

    await refreshData();
  } catch (err) {
    handleDbError(err, 'שגיאה בטעינת נתונים — ודא/י שהרצת fix-data.sql ב-Supabase');
    try {
      await refreshData();
    } catch {
      appData = structuredClone(DEFAULT_DATA);
    }
  } finally {
    showLoading(false);
  }

  if (!window.location.hash) window.location.hash = 'dashboard';
  setupEventListeners();
  render();
  maybeShowBirthdayPopup();
  if (typeof registerServiceWorker === 'function') registerServiceWorker();
}

function onUserLoggedOut() {
  loadedUserId = null;
  clearFamilyContext();
  appData = structuredClone(DEFAULT_DATA);
  showAuthGate('login');
}

async function bootstrap() {
  captureJoinCodeFromUrl();
  if (typeof registerServiceWorker === 'function') registerServiceWorker();

  if (!initAuth()) {
    showAuthGate('not-configured');
    return;
  }

  watchAuthState();
  onAuthChange(user => {
    if (user) onUserLoggedIn(user);
    else onUserLoggedOut();
  });

  showAuthGate('login');
  const session = await getSession();
  if (session?.user) await onUserLoggedIn(session.user);
}

bootstrap();
