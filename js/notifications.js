const NOTIF_PREFS_KEY = 'coparent-notif-prefs';
const NOTIF_STATE_KEY = 'coparent-notif-state';

const DEFAULT_NOTIF_PREFS = {
  enabled: false,
  messages: true,
  expenses: true,
  expenseApproval: true,
  birthdays: true,
  events: true,
  custody: true
};

function getNotificationPrefs() {
  try {
    return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || '{}') };
  } catch (_) {
    return { ...DEFAULT_NOTIF_PREFS };
  }
}

function saveNotificationPrefs(prefs) {
  localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify({ ...getNotificationPrefs(), ...prefs }));
}

function getNotificationState() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_STATE_KEY) || '{}');
  } catch (_) {
    return {};
  }
}

function saveNotificationState(patch) {
  localStorage.setItem(NOTIF_STATE_KEY, JSON.stringify({ ...getNotificationState(), ...patch }));
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    return reg;
  } catch (err) {
    console.warn('SW registration failed', err);
    return null;
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

async function showAppNotification(title, body, options = {}) {
  const prefs = getNotificationPrefs();
  if (!prefs.enabled || Notification.permission !== 'granted') return;

  const payload = {
    body,
    tag: options.tag || 'coparent',
    icon: 'icons/icon-192.svg',
    badge: 'icons/icon-192.svg',
    dir: 'rtl',
    lang: 'he',
    data: options.data || {}
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg?.showNotification) {
        await reg.showNotification(title, payload);
        return;
      }
    }
    new Notification(title, payload);
  } catch (err) {
    console.warn('Notification failed', err);
  }
}

function renderNotificationSettings() {
  const prefs = getNotificationPrefs();
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const permLabel = {
    granted: '✓ התראות מאושרות',
    denied: 'חסום בדפדפן — אפשר בהגדרות הטלפון',
    default: 'לא אושר עדיין',
    unsupported: 'הדפדפן לא תומך'
  }[perm] || perm;

  return `
    <div class="card">
      <div class="card-title" style="margin-bottom:0.75rem">התראות לטלפון</div>
      <p class="form-hint" style="margin-bottom:1rem">
        הוסיפי את האפליקציה למסך הבית (PWA), אשרי התראות, ותקבלי עדכונים בחלונית ההתראות.
      </p>
      <p class="notif-perm-status">${permLabel}</p>
      <button type="button" class="btn btn-primary btn-sm" id="enable-notifications-btn" ${perm === 'granted' ? 'disabled' : ''}>
        ${perm === 'granted' ? 'התראות פעילות' : 'אפשר התראות'}
      </button>
      <div class="notif-prefs-list ${prefs.enabled ? '' : 'is-disabled'}" id="notif-prefs-list">
        <label class="notif-pref-row">
          <input type="checkbox" data-notif-pref="enabled" ${prefs.enabled ? 'checked' : ''}>
          <span>הפעל התראות</span>
        </label>
        <label class="notif-pref-row">
          <input type="checkbox" data-notif-pref="messages" ${prefs.messages ? 'checked' : ''}>
          <span>💬 הודעות חדשות</span>
        </label>
        <label class="notif-pref-row">
          <input type="checkbox" data-notif-pref="expenses" ${prefs.expenses ? 'checked' : ''}>
          <span>💰 הוצאות חדשות</span>
        </label>
        <label class="notif-pref-row">
          <input type="checkbox" data-notif-pref="expenseApproval" ${prefs.expenseApproval ? 'checked' : ''}>
          <span>✋ בקשות אישור הוצאה</span>
        </label>
        <label class="notif-pref-row">
          <input type="checkbox" data-notif-pref="birthdays" ${prefs.birthdays ? 'checked' : ''}>
          <span>🎂 ימי הולדת</span>
        </label>
        <label class="notif-pref-row">
          <input type="checkbox" data-notif-pref="events" ${prefs.events ? 'checked' : ''}>
          <span>📌 אירועים</span>
        </label>
        <label class="notif-pref-row">
          <input type="checkbox" data-notif-pref="custody" ${prefs.custody ? 'checked' : ''}>
          <span>🔄 שינויי משמורת</span>
        </label>
      </div>
    </div>
  `;
}

function initNotificationSettings(root) {
  root.querySelector('#enable-notifications-btn')?.addEventListener('click', async () => {
    await registerServiceWorker();
    const perm = await requestNotificationPermission();
    if (perm === 'granted') {
      saveNotificationPrefs({ enabled: true });
      showToast('התראות הופעלו', 'success');
      render();
    } else if (perm === 'denied') {
      showToast('התראות חסומות — אפשרי בהגדרות הדפדפן/טלפון');
    }
  });

  root.querySelectorAll('[data-notif-pref]').forEach(el => {
    el.addEventListener('change', () => {
      saveNotificationPrefs({ [el.dataset.notifPref]: el.checked });
      const list = root.querySelector('#notif-prefs-list');
      if (list) list.classList.toggle('is-disabled', !getNotificationPrefs().enabled);
    });
  });
}

async function checkNotifications(data, prevSnapshot) {
  const prefs = getNotificationPrefs();
  if (!prefs.enabled || Notification.permission !== 'granted') return;

  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const today = new Date().toISOString().split('T')[0];

  if (prefs.birthdays && prevSnapshot?.date !== today) {
    const birthdays = await getBirthdaysOnDate(data, today);
    if (birthdays.length) {
      const names = birthdays.map(b => b.child.name).join(', ');
      await showAppNotification('🎂 יום הולדת!', `מזל טוב ל${names}!`, { tag: `birthday-${today}` });
    }
  }

  if (prefs.messages && prevSnapshot?.messageCount != null) {
    const newCount = data.messages.length - prevSnapshot.messageCount;
    if (newCount > 0) {
      const last = data.messages[data.messages.length - 1];
      if (last?.sender !== myRole) {
        await showAppNotification('💬 הודעה חדשה', last.text.slice(0, 120), { tag: `msg-${last.id}` });
      }
    }
  }

  if (prefs.expenseApproval) {
    const pending = (data.expenses || []).filter(e =>
      e.requiresApproval && e.approvalStatus === 'pending' && e.createdBy !== myRole
    );
    const prevIds = new Set(prevSnapshot?.pendingApprovalIds || []);
    for (const e of pending) {
      if (!prevIds.has(e.id)) {
        await showAppNotification('✋ בקשת אישור הוצאה', `${e.title} — ${formatCurrency(e.amount)}`, { tag: `exp-approval-${e.id}` });
      }
    }
  }

  if (prefs.expenses && prevSnapshot?.expenseCount != null) {
    const newExpenses = data.expenses.length - prevSnapshot.expenseCount;
    if (newExpenses > 0) {
      const last = data.expenses[data.expenses.length - 1];
      if (last?.createdBy !== myRole && !last?.requiresApproval) {
        await showAppNotification('💰 הוצאה חדשה', `${last.title} — ${formatCurrency(last.amount)}`, { tag: `exp-${last.id}` });
      }
    }
  }
}

function buildNotificationSnapshot(data) {
  return {
    date: new Date().toISOString().split('T')[0],
    messageCount: data.messages?.length || 0,
    expenseCount: data.expenses?.length || 0,
    pendingApprovalIds: (data.expenses || [])
      .filter(e => e.requiresApproval && e.approvalStatus === 'pending')
      .map(e => e.id)
  };
}
