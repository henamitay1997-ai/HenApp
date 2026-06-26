const DEFAULT_DATA = {
  settings: {
    parentAName: 'הורה א',
    parentBName: 'הורה ב',
    currentParent: 'a',
    custodyStartDate: new Date().toISOString().split('T')[0],
    custodyPattern: 'alternating-weeks',
    weekSchedule: {
      0: 'a', 1: 'a', 2: 'a', 3: 'b', 4: 'b', 5: 'b', 6: 'b'
    }
  },
  children: [],
  events: [],
  expenses: [],
  messages: []
};

function getParentName(data, parent) {
  return parent === 'a' ? data.settings.parentAName : data.settings.parentBName;
}

function getCustodyForDate(data, dateStr) {
  const { custodyPattern, custodyStartDate, weekSchedule } = data.settings;
  const date = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay();

  if (custodyPattern === 'weekly') {
    return weekSchedule[dayOfWeek] || 'a';
  }

  const start = new Date(custodyStartDate + 'T12:00:00');
  const diffDays = Math.floor((date - start) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(diffDays / 7);
  const isEvenWeek = weekNum % 2 === 0;
  const baseParent = isEvenWeek ? 'a' : 'b';

  if (custodyPattern === 'alternating-weeks') {
    return baseParent;
  }

  const schedule = { ...weekSchedule };
  if (baseParent === 'b') {
    Object.keys(schedule).forEach(k => {
      schedule[k] = schedule[k] === 'a' ? 'b' : 'a';
    });
  }
  return schedule[dayOfWeek] || 'a';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
  return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount);
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getChildName(data, childId) {
  const child = data.children.find(c => c.id === childId);
  return child ? child.name : '';
}

function getAge(birthDate) {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getUpcomingEvents(data, days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + days);

  return data.events
    .filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      return d >= today && d <= end;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getPendingExpenses(data) {
  return data.expenses.filter(e => !e.paid);
}
