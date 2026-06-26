
function renderDashboard(data) {
  const today = new Date().toISOString().split('T')[0];
  const custody = getCustodyForDate(data, today);
  const upcoming = getUpcomingEvents(data, 14);
  const pending = getPendingExpenses(data);
  const pendingTotal = pending.reduce((s, e) => s + e.amount * (e.splitPercent / 100), 0);
  const unreadMessages = data.messages.length;

  return `
    <div class="grid grid-4" style="margin-bottom:1.25rem">
      <div class="stat-card">
        <div class="stat-icon">👶</div>
        <div class="stat-value">${data.children.length}</div>
        <div class="stat-label">ילדים</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">${custody === 'a' ? '🔵' : '🟣'}</div>
        <div class="stat-value" style="font-size:1.1rem">${getParentName(data, custody)}</div>
        <div class="stat-label">משמורת היום</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📌</div>
        <div class="stat-value">${upcoming.length}</div>
        <div class="stat-label">אירועים קרובים</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💰</div>
        <div class="stat-value" style="font-size:1.25rem">${formatCurrency(pendingTotal)}</div>
        <div class="stat-label">הוצאות ממתינות</div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">אירועים קרובים</div>
            <div class="card-subtitle">14 הימים הבאים</div>
          </div>
          <a href="#events" class="btn btn-sm btn-secondary">הכל</a>
        </div>
        ${upcoming.length === 0 ? '<p style="color:var(--text-muted);font-size:0.9rem">אין אירועים קרובים</p>' : `
          <ul class="list">
            ${upcoming.slice(0, 5).map(e => `
              <li class="list-item">
                <div class="list-item-content">
                  <div class="list-item-title">${e.title}</div>
                  <div class="list-item-meta">${formatDate(e.date)}${e.time ? ' · ' + e.time : ''}${e.childId ? ' · ' + getChildName(data, e.childId) : ''}</div>
                </div>
                <span class="badge badge-${e.createdBy === 'a' ? 'a' : 'b'}">${getParentName(data, e.createdBy)}</span>
              </li>
            `).join('')}
          </ul>
        `}
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">הוצאות ממתינות לתשלום</div>
            <div class="card-subtitle">חלוקה שווה בין ההורים</div>
          </div>
          <a href="#expenses" class="btn btn-sm btn-secondary">הכל</a>
        </div>
        ${pending.length === 0 ? '<p style="color:var(--text-muted);font-size:0.9rem">אין הוצאות ממתינות 🎉</p>' : `
          <ul class="list">
            ${pending.slice(0, 5).map(e => `
              <li class="list-item">
                <div class="list-item-content">
                  <div class="list-item-title">${e.title}</div>
                  <div class="list-item-meta">שולם ע"י ${getParentName(data, e.paidBy)} · ${e.splitPercent}% חלוקה</div>
                </div>
                <div class="expense-amount">${formatCurrency(e.amount)}</div>
              </li>
            `).join('')}
          </ul>
        `}
      </div>
    </div>

    <div class="card" style="margin-top:1.25rem">
      <div class="card-header">
        <div class="card-title">הילדים שלנו</div>
        <a href="#children" class="btn btn-sm btn-secondary">נהל ילדים</a>
      </div>
      ${data.children.length === 0 ? '<p style="color:var(--text-muted)">טרם הוספת ילדים. <a href="#children">הוסף עכשיו</a></p>' : `
        <div class="grid grid-3">
          ${data.children.map(c => `
            <div class="card" style="box-shadow:none;background:var(--surface-2)">
              <div class="child-card">
                <div class="child-avatar">${c.name.charAt(0)}</div>
                <div>
                  <div style="font-weight:700">${c.name}</div>
                  <div style="font-size:0.85rem;color:var(--text-muted)">גיל ${getAge(c.birthDate)}${c.school ? ' · ' + c.school : ''}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function renderCalendar(data, year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const dayNames = ['א','ב','ג','ד','ה','ו','ש'];

  let cells = '';

  const prevMonth = new Date(year, month, 0);
  for (let i = startPad - 1; i >= 0; i--) {
    const d = prevMonth.getDate() - i;
    const dateStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells += renderCalDay(d, dateStr, data, true);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells += renderCalDay(d, dateStr, data, false);
  }

  const totalCells = startPad + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  const nextMonth = new Date(year, month + 1, 1);
  for (let d = 1; d <= remaining; d++) {
    const dateStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells += renderCalDay(d, dateStr, data, true);
  }

  return `
    <div class="card">
      <div class="calendar-header">
        <div class="calendar-nav">
          <button class="btn btn-secondary btn-sm" data-cal-nav="prev">←</button>
          <span class="calendar-month-title">${monthNames[month]} ${year}</span>
          <button class="btn btn-secondary btn-sm" data-cal-nav="next">→</button>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;font-size:0.85rem">
          <span class="badge badge-a">${getParentName(data, 'a')}</span>
          <span class="badge badge-b">${getParentName(data, 'b')}</span>
        </div>
      </div>
      <div class="calendar-grid">
        ${dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
        ${cells}
      </div>
    </div>
  `;
}

function renderCalDay(num, dateStr, data, otherMonth) {
  const today = new Date().toISOString().split('T')[0];
  const custody = getCustodyForDate(data, dateStr);
  const events = data.events.filter(e => e.date === dateStr);
  const isToday = dateStr === today;

  return `
    <div class="cal-day ${otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} custody-${custody}${events.length ? ' has-events' : ''}"
         data-date="${dateStr}" title="${getParentName(data, custody)}">
      <div class="cal-day-num">${num}</div>
      ${events.slice(0, 2).map(e => `<div class="cal-event-dot">${e.title}</div>`).join('')}
      ${events.length > 2 ? `<div class="cal-event-dot">+${events.length - 2} עוד</div>` : ''}
    </div>
  `;
}

function renderCustody(data, previewWeekOffset = 0) {
  const { custodyPattern, weekSchedule, custodyStartDate } = data.settings;
  const parentA = getParentName(data, 'a');
  const parentB = getParentName(data, 'b');

  const modes = [
    {
      id: 'alternating-weeks',
      icon: '🔄',
      title: 'שבועות מתחלפים',
      desc: 'שבוע שלם אצל כל הורה, ואז מתחלף לשבוע הבא'
    },
    {
      id: 'weekly',
      icon: '📅',
      title: 'לוח שבועי קבוע',
      desc: 'אותם ימים בכל שבוע — למשל א\'–ד\' אצל הורה א, ה\'–ש\' אצל הורה ב'
    },
    {
      id: 'biweekly',
      icon: '🔁',
      title: 'לוח דו-שבועי',
      desc: 'שני לוחות שונים שמתחלפים — למשל שבוע א\'–ב\'–א\' ואז שבוע ב\'–א\'–ב\''
    },
    {
      id: 'manual',
      icon: '✏️',
      title: 'סידור ידני',
      desc: 'בוחרים הורה לכל תאריך בנפרד — גמיש לחלוטין'
    }
  ];

  if (custodyPattern === 'custom-alternating') {
    modes.push({
      id: 'custom-alternating',
      icon: '⚙️',
      title: 'לוח שבועי + שבועות מתחלפים',
      desc: 'לוח ימים שמשתנה לפי שבוע או ב'
    });
  }

  return `
    <form id="custody-form" class="custody-page">
      <div class="card">
        <div class="card-header">
          <div class="card-title">איך עובדת המשמורת אצלכם?</div>
        </div>
        <p class="custody-intro">בחרו את סוג הסידור. אחר כך תוכלו לערוך את הימים בצורה פשוטה וברורה.</p>
        <div class="custody-mode-grid" role="radiogroup" aria-label="סוג סידור משמורת">
          ${modes.map(mode => `
            <label class="custody-mode-card ${custodyPattern === mode.id ? 'selected' : ''}">
              <input type="radio" name="custodyPattern" value="${mode.id}" ${custodyPattern === mode.id ? 'checked' : ''}>
              <span class="custody-mode-icon" aria-hidden="true">${mode.icon}</span>
              <span class="custody-mode-title">${mode.title}</span>
              <span class="custody-mode-desc">${mode.desc}</span>
            </label>
          `).join('')}
        </div>
      </div>

      ${renderCustodyEditor(data, custodyPattern, parentA, parentB, previewWeekOffset)}

      <div class="card">
        <div class="card-header">
          <div class="card-title">תצוגה מקדימה</div>
        </div>
        <p class="custody-intro">כך תיראה המשמורת ב-${custodyPattern === 'manual' || custodyPattern === 'biweekly' ? 'שבועיים הקרובים' : 'השבוע הקרוב'}.</p>
        ${getWeekPreview(data, custodyPattern === 'manual' || custodyPattern === 'biweekly' ? 14 : 7, 0)}
      </div>

      <div class="custody-save-bar">
        <button type="submit" class="btn btn-primary btn-lg">שמור הגדרות משמורת</button>
      </div>
    </form>
  `;
}

function renderParentPicker(data, type, id, currentParent) {
  const attrMap = {
    week: 'data-week-day',
    week2: 'data-week2-day',
    manual: 'data-manual-date'
  };
  const attr = attrMap[type] || 'data-week-day';

  return `
    <div class="parent-picker" role="group" aria-label="בחירת הורה">
      <button type="button" class="parent-pick parent-a ${currentParent === 'a' ? 'active' : ''}"
              ${attr}="${id}" data-parent="a" aria-pressed="${currentParent === 'a'}">
        ${getParentName(data, 'a')}
      </button>
      <button type="button" class="parent-pick parent-b ${currentParent === 'b' ? 'active' : ''}"
              ${attr}="${id}" data-parent="b" aria-pressed="${currentParent === 'b'}">
        ${getParentName(data, 'b')}
      </button>
    </div>
  `;
}

function renderWeekDayList(data, schedule, type) {
  return `
    <ul class="custody-day-list">
      ${DAY_NAMES.map((name, i) => {
        const parent = schedule[i] || 'a';
        return `
          <li class="custody-day-row">
            <div class="custody-day-label">
              <span class="custody-day-name">יום ${name}</span>
            </div>
            ${renderParentPicker(data, type, i, parent)}
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function renderCustodyEditor(data, pattern, parentA, parentB, previewWeekOffset) {
  const { weekSchedule, weekSchedule2, custodyStartDate, manualDates = {} } = data.settings;

  if (pattern === 'alternating-weeks') {
    return `
      <div class="card custody-editor">
        <div class="card-header">
          <div class="card-title">הגדרת שבועות מתחלפים</div>
        </div>
        <div class="custody-info-box">
          <p><strong>איך זה עובד?</strong> כל השבוע (ראשון–שבת) אצל הורה אחד, ובשבוע הבא אצל ההורה השני.</p>
          <p>לדוגמה: השבוע כולו אצל <span class="badge badge-a">${parentA}</span>, השבוע הבא כולו אצל <span class="badge badge-b">${parentB}</span>.</p>
        </div>
        <div class="form-group">
          <label class="form-label" for="custodyStartDate">מתי מתחיל המחזור?</label>
          <input class="form-input" type="date" id="custodyStartDate" name="custodyStartDate" value="${custodyStartDate}">
          <p class="form-hint">בחרו תאריך שבו השבוע היה אצל ${parentA}. מהשבוע הבא זה יתחלף.</p>
        </div>
      </div>
    `;
  }

  if (pattern === 'weekly' || pattern === 'custom-alternating') {
    const extraNote = pattern === 'custom-alternating'
      ? '<p class="custody-info-note">במצב מתקדם זה: הלוח שבועי משתנה לפי שבוע א או שבוע ב.</p>'
      : '';

    return `
      <div class="card custody-editor">
        <div class="card-header">
          <div class="card-title">לוח שבועי — בחרו הורה לכל יום</div>
        </div>
        <p class="custody-intro">לחצו על שם ההורה ליד כל יום. אותו סידור יחזור בכל שבוע.</p>
        ${extraNote}
        <div class="custody-quick-actions">
          <button type="button" class="btn btn-outline btn-sm" data-custody-fill="a">כל השבוע → ${parentA}</button>
          <button type="button" class="btn btn-outline btn-sm" data-custody-fill="b">כל השבוע → ${parentB}</button>
        </div>
        <ul class="custody-day-list">
          ${DAY_NAMES.map((name, i) => {
            const parent = weekSchedule[i] || 'a';
            return `
              <li class="custody-day-row">
                <div class="custody-day-label">
                  <span class="custody-day-name">יום ${name}</span>
                </div>
                ${renderParentPicker(data, 'week', i, parent)}
              </li>
            `;
          }).join('')}
        </ul>
        ${pattern === 'custom-alternating' ? `
          <div class="form-group" style="margin-top:1rem">
            <label class="form-label" for="custodyStartDate">תאריך התחלת מחזור</label>
            <input class="form-input" type="date" id="custodyStartDate" name="custodyStartDate" value="${custodyStartDate}">
          </div>
        ` : ''}
      </div>
    `;
  }

  if (pattern === 'biweekly') {
    const week2 = weekSchedule2 || getBiweeklyPresets().week2;

    return `
      <div class="card custody-editor">
        <div class="card-header">
          <div class="card-title">לוח דו-שבועי — שני לוחות שמתחלפים</div>
        </div>
        <div class="custody-info-box">
          <p><strong>איך זה עובד?</strong> מגדירים לוח נפרד לכל שבוע במחזור. שבוע 1, אחר כך שבוע 2, ואז חוזר חלילה.</p>
          <p><strong>דוגמה נפוצה:</strong><br>
            שבוע 1: א'–ב' ${parentA}, ג'–ה' ${parentB}, ו'–ש' ${parentA}<br>
            שבוע 2: א'–ב' ${parentB}, ג'–ד' ${parentA}, ה'–ש' ${parentB}
          </p>
        </div>
        <div class="custody-quick-actions">
          <button type="button" class="btn btn-outline btn-sm" data-custody-preset="common-biweekly">טען את הדוגמה הנפוצה ↑</button>
        </div>
        <div class="form-group">
          <label class="form-label" for="custodyStartDate">מתי מתחיל שבוע 1 במחזור?</label>
          <input class="form-input" type="date" id="custodyStartDate" name="custodyStartDate" value="${custodyStartDate}">
          <p class="form-hint">בחרו תאריך שנמצא בשבוע 1 (לפי הלוח למטה). מהשבוע הבא יופעל שבוע 2.</p>
        </div>
        <div class="biweekly-weeks">
          <div class="biweekly-week-block">
            <h3 class="biweekly-week-title">שבוע 1 במחזור</h3>
            <div class="custody-quick-actions">
              <button type="button" class="btn btn-outline btn-sm" data-custody-fill-week1="a">כל השבוע → ${parentA}</button>
              <button type="button" class="btn btn-outline btn-sm" data-custody-fill-week1="b">כל השבוע → ${parentB}</button>
            </div>
            ${renderWeekDayList(data, weekSchedule, 'week')}
          </div>
          <div class="biweekly-week-block">
            <h3 class="biweekly-week-title">שבוע 2 במחזור</h3>
            <div class="custody-quick-actions">
              <button type="button" class="btn btn-outline btn-sm" data-custody-fill-week2="a">כל השבוע → ${parentA}</button>
              <button type="button" class="btn btn-outline btn-sm" data-custody-fill-week2="b">כל השבוע → ${parentB}</button>
            </div>
            ${renderWeekDayList(data, week2, 'week2')}
          </div>
        </div>
      </div>
    `;
  }

  if (pattern === 'manual') {
    const weekStart = getCustodyWeekStart(previewWeekOffset);
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d);
    }

    const startStr = days[0].toISOString().split('T')[0];
    const endStr = days[13].toISOString().split('T')[0];
    const weekLabel = formatDateRange(startStr, endStr);

    return `
      <div class="card custody-editor">
        <div class="card-header custody-editor-header">
          <div class="card-title">סידור ידני — בחרו הורה לכל תאריך</div>
          <div class="custody-week-nav">
            <button type="button" class="btn btn-outline btn-sm" data-custody-week-nav="prev" aria-label="שבועיים קודמים">→</button>
            <span class="custody-week-label">${weekLabel}</span>
            <button type="button" class="btn btn-outline btn-sm" data-custody-week-nav="next" aria-label="שבועיים הבאים">←</button>
          </div>
        </div>
        <p class="custody-intro">לחצו על שם ההורה ליד כל תאריך. שינויים נשמרים מיד.</p>
        <div class="custody-quick-actions">
          <button type="button" class="btn btn-outline btn-sm" data-custody-fill-week="a">כל התקופה → ${parentA}</button>
          <button type="button" class="btn btn-outline btn-sm" data-custody-fill-week="b">כל התקופה → ${parentB}</button>
          <button type="button" class="btn btn-outline btn-sm" data-custody-clear-manual">נקה בחירות ידניות</button>
        </div>
        <ul class="custody-day-list">
          ${days.map(d => {
            const dateStr = d.toISOString().split('T')[0];
            const isManual = Boolean(manualDates[dateStr]);
            const parent = isManual ? manualDates[dateStr] : (weekSchedule[d.getDay()] || 'a');
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            return `
              <li class="custody-day-row ${isToday ? 'is-today' : ''} ${isManual ? 'is-manual' : ''}">
                <div class="custody-day-label">
                  <span class="custody-day-name">${formatDateShort(dateStr)}</span>
                  ${isManual ? '<span class="custody-manual-tag">ידני</span>' : ''}
                </div>
                ${renderParentPicker(data, 'manual', dateStr, parent)}
              </li>
            `;
          }).join('')}
        </ul>
        <p class="form-hint">תאריכים שלא נבחרו ידנית ישתמשו בלוח השבועי הבסיסי (אפשר לערוך למטה).</p>
        <details class="custody-weekly-fallback">
          <summary>לוח שבועי בסיסי (לתאריכים שלא נבחרו)</summary>
          <ul class="custody-day-list compact">
            ${DAY_NAMES.map((name, i) => {
              const parent = weekSchedule[i] || 'a';
              return `
                <li class="custody-day-row">
                  <div class="custody-day-label"><span class="custody-day-name">יום ${name}</span></div>
                  ${renderParentPicker(data, 'week', i, parent)}
                </li>
              `;
            }).join('')}
          </ul>
        </details>
      </div>
    `;
  }

  return '';
}

function getCustodyWeekStart(offsetWeeks = 0) {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay() + offsetWeeks * 7);
  sunday.setHours(12, 0, 0, 0);
  return sunday;
}

function getWeekPreview(data, days = 7, startOffset = 0) {
  const start = getCustodyWeekStart(startOffset);
  const todayStr = new Date().toISOString().split('T')[0];

  let html = '<ul class="custody-preview-list">';
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const custody = getCustodyForDate(data, dateStr);
    const isManual = data.settings.custodyPattern === 'manual' && data.settings.manualDates?.[dateStr];
    const biweeklyWeek = data.settings.custodyPattern === 'biweekly'
      ? getBiweeklyWeekIndex(dateStr, data.settings.custodyStartDate)
      : null;
    html += `
      <li class="custody-preview-row custody-parent-${custody} ${dateStr === todayStr ? 'is-today' : ''}">
        <span class="custody-preview-date">${formatDateShort(dateStr)}</span>
        ${biweeklyWeek ? `<span class="custody-cycle-tag">שבוע ${biweeklyWeek}</span>` : ''}
        <span class="badge badge-${custody}">${getParentName(data, custody)}</span>
        ${isManual ? '<span class="custody-manual-tag">ידני</span>' : ''}
      </li>
    `;
  }
  html += '</ul>';
  return html;
}

function renderChildren(data) {
  if (data.children.length === 0) {
    return `
      <div class="card">
        ${renderEmptyState('👶', 'אין ילדים עדיין', 'הוסף/י את הילדים שלכם כדי לנהל את הסידורים', 'הוסף ילד', 'add-child')}
      </div>
    `;
  }

  return `
    <div class="section-header">
      <h2>${data.children.length} ילדים</h2>
      <button class="btn btn-primary" data-action="add-child">+ הוסף ילד</button>
    </div>
    <div class="grid grid-2">
      ${data.children.map(c => `
        <div class="card">
          <div class="child-card" style="margin-bottom:1rem">
            <div class="child-avatar">${c.name.charAt(0)}</div>
            <div style="flex:1">
              <div style="font-size:1.15rem;font-weight:700">${c.name}</div>
              <div style="color:var(--text-muted);font-size:0.9rem">גיל ${getAge(c.birthDate)} · ${formatDate(c.birthDate).split(',')[0]}</div>
            </div>
            <div class="list-item-actions">
              <button class="btn btn-sm btn-secondary" data-action="edit-child" data-id="${c.id}">ערוך</button>
              <button class="btn btn-sm btn-danger" data-action="delete-child" data-id="${c.id}">מחק</button>
            </div>
          </div>
          <div style="font-size:0.9rem">
            ${c.school ? `<div style="margin-bottom:0.35rem"><strong>בית ספר/גן:</strong> ${c.school}</div>` : ''}
            ${c.allergies ? `<div style="margin-bottom:0.35rem"><strong>אלרגיות:</strong> <span class="badge badge-warning">${c.allergies}</span></div>` : ''}
            ${c.notes ? `<div style="color:var(--text-muted)">${c.notes}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderEmptyState(icon, title, desc, btnLabel, action) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      <button class="btn btn-primary" data-action="${action}">${btnLabel}</button>
    </div>
  `;
}

function renderEvents(data) {
  const sorted = [...data.events].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    return `
      <div class="card">
        ${renderEmptyState('📌', 'אין אירועים', 'הוסף/י אירועים כמו פגישות רופא, חגיגות ופעילויות', 'הוסף אירוע', 'add-event')}
      </div>
    `;
  }

  return `
    <div class="section-header">
      <h2>${sorted.length} אירועים</h2>
      <button class="btn btn-primary" data-action="add-event">+ הוסף אירוע</button>
    </div>
    <div class="card">
      <ul class="list">
        ${sorted.map(e => `
          <li class="list-item">
            <div class="list-item-content">
              <div class="list-item-title">${e.title}</div>
              <div class="list-item-meta">
                ${formatDate(e.date)}${e.time ? ' · ' + e.time : ''}
                ${e.location ? ' · 📍 ' + e.location : ''}
                ${e.childId ? ' · 👶 ' + getChildName(data, e.childId) : ''}
              </div>
              ${e.notes ? `<div style="font-size:0.85rem;margin-top:0.25rem;color:var(--text-muted)">${e.notes}</div>` : ''}
            </div>
            <span class="badge badge-${e.createdBy === 'a' ? 'a' : 'b'}">${getParentName(data, e.createdBy)}</span>
            <div class="list-item-actions">
              <button class="btn btn-sm btn-secondary" data-action="edit-event" data-id="${e.id}">ערוך</button>
              <button class="btn btn-sm btn-danger" data-action="delete-event" data-id="${e.id}">מחק</button>
            </div>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function renderExpenses(data) {
  const sorted = [...data.expenses].sort((a, b) => b.date.localeCompare(a.date));
  const pending = sorted.filter(e => !e.paid);
  const paid = sorted.filter(e => e.paid);
  const totalPending = pending.reduce((s, e) => s + e.amount, 0);

  return `
    <div class="grid grid-3" style="margin-bottom:1.25rem">
      <div class="stat-card">
        <div class="stat-value" style="font-size:1.4rem">${formatCurrency(totalPending)}</div>
        <div class="stat-label">סה"כ ממתין</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${pending.length}</div>
        <div class="stat-label">הוצאות פתוחות</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${paid.length}</div>
        <div class="stat-label">הוצאות ששולמו</div>
      </div>
    </div>

    <div class="section-header">
      <h2>הוצאות משותפות</h2>
      <button class="btn btn-primary" data-action="add-expense">+ הוסף הוצאה</button>
    </div>

    ${sorted.length === 0 ? `
      <div class="card">${renderEmptyState('💰', 'אין הוצאות', 'עקוב/י אחר הוצאות משותפות על הילדים', 'הוסף הוצאה', 'add-expense')}</div>
    ` : `
      <div class="card">
        <ul class="list">
          ${sorted.map(e => `
            <li class="list-item">
              <div class="list-item-content">
                <div class="list-item-title">${e.title}</div>
                <div class="list-item-meta">
                  ${formatDate(e.date)} · שולם ע"י ${getParentName(data, e.paidBy)}
                  · חלוקה ${e.splitPercent}/${100 - e.splitPercent}
                  ${e.category ? ' · ' + e.category : ''}
                  ${e.childId ? ' · ' + getChildName(data, e.childId) : ''}
                </div>
              </div>
              <div style="text-align:left">
                <div class="expense-amount">${formatCurrency(e.amount)}</div>
                <span class="badge ${e.paid ? 'badge-success' : 'badge-warning'}">${e.paid ? 'שולם' : 'ממתין'}</span>
              </div>
              <div class="list-item-actions">
                ${!e.paid ? `<button class="btn btn-sm btn-primary" data-action="mark-paid" data-id="${e.id}">סומן כשולם</button>` : ''}
                <button class="btn btn-sm btn-secondary" data-action="edit-expense" data-id="${e.id}">ערוך</button>
                <button class="btn btn-sm btn-danger" data-action="delete-expense" data-id="${e.id}">מחק</button>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    `}
  `;
}

function renderMessages(data) {
  const sorted = [...data.messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const currentParent = data.settings.currentParent;

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">תקשורת בין הורים</div>
          <div class="card-subtitle">שולח/ת כ: <span class="badge badge-${currentParent}">${getParentName(data, currentParent)}</span></div>
        </div>
      </div>

      <div class="message-thread" id="message-thread">
        ${sorted.length === 0 ? '<div class="empty-state" style="padding:2rem"><p>אין הודעות עדיין. התחילו שיחה!</p></div>' : sorted.map(m => `
          <div class="message-bubble ${m.sender === currentParent ? 'sent' : 'received'}">
            <div>${m.text}</div>
            <div class="message-meta">${getParentName(data, m.sender)} · ${formatTime(m.timestamp)}</div>
          </div>
        `).join('')}
      </div>

      <div class="message-compose">
        <textarea class="form-textarea" id="message-input" placeholder="כתוב/י הודעה..."></textarea>
        <button class="btn btn-primary" id="send-message">שלח</button>
      </div>
    </div>
  `;
}

function renderFamilySettings(family) {
  if (!family) return '';

  const membersHtml = family.members.map(m => `
    <div class="family-member">
      <span class="badge badge-${m.parentRole}">${m.parentRole === 'a' ? 'הורה א' : 'הורה ב'}</span>
      <span>${m.name}${m.isMe ? ' (את/ה)' : ''}</span>
    </div>
  `).join('');

  const joinSection = !family.hasPartner ? `
    <div class="form-group" style="margin-top:1rem">
      <label class="form-label">הצטרף/י למשפחה קיימת</label>
      <div class="invite-row">
        <input class="form-input" id="join-code-input" placeholder="הזן/י קוד הזמנה" dir="ltr" style="text-transform:uppercase">
        <button type="button" class="btn btn-primary" data-action="join-family">הצטרף</button>
      </div>
    </div>
  ` : '';

  return `
    <div class="card">
      <div class="card-title" style="margin-bottom:1rem">👨‍👩‍👧 המשפחה שלנו</div>

      <div class="family-members-list">${membersHtml}</div>

      ${!family.hasPartner ? `
        <div class="invite-box">
          <label class="form-label">קישור הזמנה להורה השני/ה</label>
          <div class="invite-row">
            <input class="form-input invite-link-input" id="invite-link" value="${family.inviteLink}" readonly dir="ltr">
            <button type="button" class="btn btn-primary" data-action="copy-invite">העתק</button>
          </div>
          <p class="form-hint">קוד הזמנה: <strong dir="ltr">${family.inviteCode}</strong> — שלח/י לינק או קוד להורה השני/ה</p>
        </div>
        ${joinSection}
      ` : `
        <p class="form-hint" style="margin-top:0.75rem;color:var(--success)">✓ שני ההורים מחוברים — הנתונים משותפים</p>
      `}
    </div>
  `;
}

function renderSettings(data) {
  const { settings } = data;
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const accountCard = user ? renderAccountSettings(user) : '';
  const familyCard = data.family ? renderFamilySettings(data.family) : '';

  return `
    <div class="grid grid-2">
      ${accountCard}
      ${familyCard}
      <div class="card">
        <div class="card-title" style="margin-bottom:1rem">פרטי הורים</div>
        <form id="settings-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">שם הורה א</label>
              <input class="form-input" name="parentAName" value="${settings.parentAName}">
            </div>
            <div class="form-group">
              <label class="form-label">שם הורה ב</label>
              <input class="form-input" name="parentBName" value="${settings.parentBName}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">אני מחובר/ת כ:</label>
            <select class="form-select" name="currentParent" ${data.family?.hasPartner ? 'disabled' : ''}>
              <option value="a" ${settings.currentParent === 'a' ? 'selected' : ''}>${settings.parentAName} (הורה א)</option>
              <option value="b" ${settings.currentParent === 'b' ? 'selected' : ''}>${settings.parentBName} (הורה ב)</option>
            </select>
            <p class="form-hint">${data.family?.hasPartner ? 'מוגדר אוטומטית לפי תפקידך במשפחה' : 'משפיע על שליחת הודעות ויצירת אירועים'}</p>
          </div>
          <button type="submit" class="btn btn-primary">שמור הגדרות</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:1rem">ניהול נתונים</div>
        <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1rem">
          הנתונים נשמרים בענן ומשותפים בין שני ההורים במשפחה.
        </p>
        <div style="display:flex;flex-direction:column;gap:0.5rem">
          <button class="btn btn-secondary" data-action="export-data">📥 ייצוא נתונים (JSON)</button>
          <button class="btn btn-secondary" data-action="import-data">📤 ייבוא נתונים</button>
          <button class="btn btn-secondary" data-action="load-demo">🎯 טען נתוני דוגמה</button>
          <button class="btn btn-danger" data-action="reset-data">🗑️ מחק את כל הנתונים</button>
        </div>
      </div>
    </div>
  `;
}

function getChildFormHtml(data, child = null) {
  return `
    <form id="child-form">
      <div class="form-group">
        <label class="form-label">שם מלא</label>
        <input class="form-input" name="name" value="${child?.name || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">תאריך לידה</label>
        <input class="form-input" type="date" name="birthDate" value="${child?.birthDate || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">בית ספר / גן</label>
        <input class="form-input" name="school" value="${child?.school || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">אלרגיות</label>
        <input class="form-input" name="allergies" value="${child?.allergies || ''}" placeholder="למשל: בוטנים, חלב">
      </div>
      <div class="form-group">
        <label class="form-label">הערות</label>
        <textarea class="form-textarea" name="notes">${child?.notes || ''}</textarea>
      </div>
    </form>
  `;
}

function getEventFormHtml(data, event = null) {
  const childOptions = data.children.map(c =>
    `<option value="${c.id}" ${event?.childId === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  return `
    <form id="event-form">
      <div class="form-group">
        <label class="form-label">כותרת</label>
        <input class="form-input" name="title" value="${event?.title || ''}" required placeholder="למשל: רופא ילדים">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">תאריך</label>
          <input class="form-input" type="date" name="date" value="${event?.date || new Date().toISOString().split('T')[0]}" required>
        </div>
        <div class="form-group">
          <label class="form-label">שעה</label>
          <input class="form-input" type="time" name="time" value="${event?.time || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">ילד/ה</label>
        <select class="form-select" name="childId">
          <option value="">— כל הילדים —</option>
          ${childOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">מיקום</label>
        <input class="form-input" name="location" value="${event?.location || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">הערות</label>
        <textarea class="form-textarea" name="notes">${event?.notes || ''}</textarea>
      </div>
    </form>
  `;
}

function getExpenseFormHtml(data, expense = null) {
  const childOptions = data.children.map(c =>
    `<option value="${c.id}" ${expense?.childId === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  return `
    <form id="expense-form">
      <div class="form-group">
        <label class="form-label">תיאור</label>
        <input class="form-input" name="title" value="${expense?.title || ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">סכום (₪)</label>
          <input class="form-input" type="number" name="amount" value="${expense?.amount || ''}" min="0" step="1" required>
        </div>
        <div class="form-group">
          <label class="form-label">תאריך</label>
          <input class="form-input" type="date" name="date" value="${expense?.date || new Date().toISOString().split('T')[0]}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">שולם ע"י</label>
          <select class="form-select" name="paidBy">
            <option value="a" ${expense?.paidBy === 'a' ? 'selected' : ''}>${data.settings.parentAName}</option>
            <option value="b" ${expense?.paidBy === 'b' ? 'selected' : ''}>${data.settings.parentBName}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">אחוז חלוקה (הורה א)</label>
          <input class="form-input" type="number" name="splitPercent" value="${expense?.splitPercent ?? 50}" min="0" max="100">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">קטגוריה</label>
          <select class="form-select" name="category">
            ${['חינוך','חוגים','בריאות','ביגוד','מזון','אחר'].map(cat =>
              `<option value="${cat}" ${expense?.category === cat ? 'selected' : ''}>${cat}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">ילד/ה</label>
          <select class="form-select" name="childId">
            <option value="">— כללי —</option>
            ${childOptions}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">הערות</label>
        <textarea class="form-textarea" name="notes">${expense?.notes || ''}</textarea>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
          <input type="checkbox" name="paid" ${expense?.paid ? 'checked' : ''}>
          <span>סומן כשולם</span>
        </label>
      </div>
    </form>
  `;
}

function getDayDetailHtml(data, dateStr) {
  const custody = getCustodyForDate(data, dateStr);
  const events = data.events.filter(e => e.date === dateStr);

  return `
    <p style="margin-bottom:1rem"><strong>משמורת:</strong> <span class="badge badge-${custody}">${getParentName(data, custody)}</span></p>
    ${events.length === 0 ? '<p style="color:var(--text-muted)">אין אירועים ביום זה</p>' : `
      <ul class="list">
        ${events.map(e => `
          <li class="list-item">
            <div class="list-item-content">
              <div class="list-item-title">${e.title}</div>
              <div class="list-item-meta">${e.time || ''} ${e.location ? '· ' + e.location : ''}</div>
            </div>
          </li>
        `).join('')}
      </ul>
    `}
    <div style="margin-top:1rem">
      <button class="btn btn-primary btn-sm" data-action="add-event-date" data-date="${dateStr}">+ הוסף אירוע</button>
    </div>
  `;
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
