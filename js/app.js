const PAGE_TITLES = {
  dashboard: 'לוח בקרה',
  calendar: 'לוח שנה',
  custody: 'משמורת',
  children: 'ילדים',
  events: 'אירועים',
  expenses: 'הוצאות',
  messages: 'הודעות',
  settings: 'הגדרות'
};

let appData = structuredClone(DEFAULT_DATA);
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let listenersReady = false;
let loadedUserId = null;
let custodyPreviewWeekOffset = 0;

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
  appData = await loadAppData();
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

function render() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  const page = PAGE_TITLES[hash] ? hash : 'dashboard';

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
    case 'expenses':
      content.innerHTML = renderExpenses(appData);
      break;
    case 'messages':
      content.innerHTML = renderMessages(appData);
      scrollMessagesToBottom();
      break;
    case 'settings':
      content.innerHTML = renderSettings(appData);
      break;
  }

  document.getElementById('topbar-actions').innerHTML = actionsHtml;
  closeSidebar();
}

function scrollMessagesToBottom() {
  const thread = document.getElementById('message-thread');
  if (thread) thread.scrollTop = thread.scrollHeight;
}

async function saveCustodySettings(toastMsg) {
  try {
    await saveSettings(appData.settings);
    await refreshData();
    if (toastMsg) showToast(toastMsg, 'success');
    render();
  } catch (err) {
    handleDbError(err);
  }
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

  document.getElementById('modal-save')?.addEventListener('click', async () => {
    const data = getFormData(form);
    const paidCheckbox = form.querySelector('[name=paid]');

    const payload = {
      ...data,
      amount: parseFloat(data.amount),
      splitPercent: Math.max(0, Math.min(100, parseInt(data.splitPercent, 10) || 50)),
      paid: paidCheckbox?.checked || false,
      childId: data.childId || null
    };

    try {
      showLoading(true);
      if (isEdit) await updateExpense(expense.id, payload);
      else await createExpense(payload);
      await refreshData();
      closeModal();
      showToast(isEdit ? 'ההוצאה עודכנה' : 'הוצאה נוספה', 'success');
      render();
    } catch (err) {
      handleDbError(err);
    } finally {
      showLoading(false);
    }
  });
  document.getElementById('modal-cancel')?.addEventListener('click', () => closeModal());
}

function handleDayClick(dateStr) {
  openModal(formatDate(dateStr), getDayDetailHtml(appData, dateStr), '');
  document.querySelector('[data-action="add-event-date"]')?.addEventListener('click', () => {
    closeModal();
    handleEventForm(null, dateStr);
  });
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

  document.getElementById('content').addEventListener('change', e => {
    if (e.target.name === 'custodyPattern' && e.target.closest('#custody-form')) {
      appData.settings.custodyPattern = e.target.value;
      custodyPreviewWeekOffset = 0;
      if (e.target.value === 'biweekly') {
        if (!appData.settings.weekSchedule2) {
          appData.settings.weekSchedule2 = { ...getBiweeklyPresets().week2 };
        }
      }
      saveCustodySettings();
    }
  });

  document.getElementById('content').addEventListener('submit', e => {
    if (e.target.id === 'custody-form') {
      e.preventDefault();
      const fd = getFormData(e.target);
      appData.settings.custodyPattern = fd.custodyPattern || appData.settings.custodyPattern;
      if (fd.custodyStartDate) appData.settings.custodyStartDate = fd.custodyStartDate;
      (async () => {
        try {
          showLoading(true);
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
      appData.settings.currentParent = appData.family?.hasPartner
        ? appData.family.myParentRole
        : fd.currentParent;
      (async () => {
        try {
          showLoading(true);
          await saveSettings(appData.settings);
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
}

function onUserLoggedOut() {
  loadedUserId = null;
  clearFamilyContext();
  appData = structuredClone(DEFAULT_DATA);
  showAuthGate('login');
}

async function bootstrap() {
  captureJoinCodeFromUrl();

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
