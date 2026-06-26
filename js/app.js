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

let appData = loadData();
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

function navigate(page) {
  window.location.hash = page;
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
  const topbarActions = document.getElementById('topbar-actions');
  topbarActions.innerHTML = '';

  switch (page) {
    case 'dashboard':
      content.innerHTML = renderDashboard(appData);
      break;
    case 'calendar':
      content.innerHTML = renderCalendar(appData, calYear, calMonth);
      break;
    case 'custody':
      content.innerHTML = renderCustody(appData);
      break;
    case 'children':
      content.innerHTML = renderChildren(appData);
      if (appData.children.length > 0) {
        topbarActions.innerHTML = '<button class="btn btn-primary btn-sm" data-action="add-child">+ הוסף ילד</button>';
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

  closeSidebar();
}

function scrollMessagesToBottom() {
  const thread = document.getElementById('message-thread');
  if (thread) thread.scrollTop = thread.scrollHeight;
}

function getFormData(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [key, val] of fd.entries()) {
    obj[key] = val;
  }
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

  document.getElementById('modal-save')?.addEventListener('click', () => {
    const data = getFormData(form);
    if (!data.name.trim()) { showToast('יש להזין שם'); return; }

    if (isEdit) {
      Object.assign(child, data);
    } else {
      appData.children.push({ id: generateId(), ...data });
    }
    saveData(appData);
    closeModal();
    showToast(isEdit ? 'הילד/ה עודכן/ה' : 'ילד/ה נוסף/ה', 'success');
    render();
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

  document.getElementById('modal-save')?.addEventListener('click', () => {
    const data = getFormData(form);
    if (!data.title.trim() || !data.date) { showToast('יש למלא כותרת ותאריך'); return; }

    const payload = {
      ...data,
      childId: data.childId || null,
      createdBy: isEdit ? event.createdBy : appData.settings.currentParent
    };

    if (isEdit) {
      Object.assign(event, payload);
    } else {
      appData.events.push({ id: generateId(), ...payload });
    }
    saveData(appData);
    closeModal();
    showToast(isEdit ? 'האירוע עודכן' : 'אירוע נוסף', 'success');
    render();
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

  document.getElementById('modal-save')?.addEventListener('click', () => {
    const data = getFormData(form);
    const paidCheckbox = form.querySelector('[name=paid]');

    const payload = {
      ...data,
      amount: parseFloat(data.amount),
      splitPercent: parseInt(data.splitPercent, 10),
      paid: paidCheckbox?.checked || false,
      childId: data.childId || null
    };

    if (isEdit) {
      Object.assign(expense, payload);
    } else {
      appData.expenses.push({ id: generateId(), ...payload });
    }
    saveData(appData);
    closeModal();
    showToast(isEdit ? 'ההוצאה עודכנה' : 'הוצאה נוספה', 'success');
    render();
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
      confirmDelete('האם למחוק את הילד/ה?').then(ok => {
        if (ok) {
          appData.children = appData.children.filter(c => c.id !== id);
          saveData(appData);
          showToast('נמחק', 'success');
          render();
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
      confirmDelete('האם למחוק את האירוע?').then(ok => {
        if (ok) {
          appData.events = appData.events.filter(ev => ev.id !== id);
          saveData(appData);
          showToast('נמחק', 'success');
          render();
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
      confirmDelete('האם למחוק את ההוצאה?').then(ok => {
        if (ok) {
          appData.expenses = appData.expenses.filter(ex => ex.id !== id);
          saveData(appData);
          showToast('נמחק', 'success');
          render();
        }
      });
      break;
    case 'mark-paid': {
      const expense = appData.expenses.find(ex => ex.id === id);
      if (expense) {
        expense.paid = true;
        saveData(appData);
        showToast('סומן כשולם', 'success');
        render();
      }
      break;
    }
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
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            appData = { ...loadData(), ...JSON.parse(reader.result) };
            saveData(appData);
            showToast('הנתונים יובאו', 'success');
            render();
          } catch {
            showToast('קובץ לא תקין');
          }
        };
        reader.readAsText(file);
      };
      input.click();
      break;
    }
    case 'load-demo':
      appData = seedDemoData(structuredClone(loadData()));
      showToast('נתוני דוגמה נטענו', 'success');
      render();
      break;
    case 'reset-data':
      confirmDelete('האם למחוק את כל הנתונים? פעולה זו בלתי הפיכה.').then(ok => {
        if (ok) {
          localStorage.removeItem('coparent-app-data');
          appData = loadData();
          showToast('הנתונים נמחקו');
          render();
        }
      });
      break;
  }
}

function setupEventListeners() {
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
      const day = e.target.closest('.cal-day');
      handleDayClick(day.dataset.date);
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

    if (e.target.closest('.week-day')) {
      const dayEl = e.target.closest('.week-day');
      const day = parseInt(dayEl.dataset.day, 10);
      const current = appData.settings.weekSchedule[day] || 'a';
      appData.settings.weekSchedule[day] = current === 'a' ? 'b' : 'a';
      saveData(appData);
      render();
      return;
    }

    handleContentClick(e);
  });

  document.getElementById('topbar-actions').addEventListener('click', handleContentClick);

  document.getElementById('content').addEventListener('submit', e => {
    if (e.target.id === 'custody-form') {
      e.preventDefault();
      const fd = getFormData(e.target);
      appData.settings.custodyPattern = fd.custodyPattern;
      appData.settings.custodyStartDate = fd.custodyStartDate;
      saveData(appData);
      showToast('הגדרות משמורת נשמרו', 'success');
      render();
    }
    if (e.target.id === 'settings-form') {
      e.preventDefault();
      const fd = getFormData(e.target);
      appData.settings.parentAName = fd.parentAName;
      appData.settings.parentBName = fd.parentBName;
      appData.settings.currentParent = fd.currentParent;
      saveData(appData);
      showToast('ההגדרות נשמרו', 'success');
      render();
    }
  });

  document.getElementById('content').addEventListener('click', e => {
    if (e.target.id === 'send-message') {
      const input = document.getElementById('message-input');
      const text = input.value.trim();
      if (!text) return;
      appData.messages.push({
        id: generateId(),
        text,
        sender: appData.settings.currentParent,
        timestamp: new Date().toISOString()
      });
      saveData(appData);
      input.value = '';
      render();
    }
  });

  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
  });

  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  setupModalListeners();
}

function init() {
  if (!window.location.hash) {
    window.location.hash = 'dashboard';
  }

  if (appData.children.length === 0 && !localStorage.getItem('coparent-app-seen')) {
    appData = seedDemoData(appData);
    localStorage.setItem('coparent-app-seen', '1');
  }

  setupEventListeners();
  render();
}

init();
