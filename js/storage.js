const STORAGE_KEY = 'coparent-app-data';

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

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    const data = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_DATA), ...data };
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

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

function seedDemoData(data) {
  if (data.children.length > 0) return data;

  const child1 = { id: generateId(), name: 'נועה', birthDate: '2016-03-15', school: 'בית ספר יסודי אילנות', allergies: 'אגוזים', notes: '' };
  const child2 = { id: generateId(), name: 'איתי', birthDate: '2019-07-22', school: 'גן חובה שקד', allergies: '', notes: '' };

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 5);

  data.settings.parentAName = 'דנה';
  data.settings.parentBName = 'יוסי';
  data.children = [child1, child2];
  data.events = [
    { id: generateId(), title: 'רופא משפחה — נועה', date: tomorrow.toISOString().split('T')[0], time: '16:30', childId: child1.id, location: 'קופ"ח כללית', notes: 'בדיקה שנתית', createdBy: 'a' },
    { id: generateId(), title: 'אספת הורים בבית הספר', date: nextWeek.toISOString().split('T')[0], time: '09:00', childId: child1.id, location: 'בית ספר יסודי', notes: '', createdBy: 'b' }
  ];
  data.expenses = [
    { id: generateId(), title: 'חוג שחייה — נועה', amount: 450, date: today.toISOString().split('T')[0], childId: child1.id, paidBy: 'a', splitPercent: 50, paid: false, category: 'חוגים', notes: '' },
    { id: generateId(), title: 'תשלום גן — איתי', amount: 2800, date: today.toISOString().split('T')[0], childId: child2.id, paidBy: 'b', splitPercent: 50, paid: true, category: 'חינוך', notes: 'תשלום רבעוני' }
  ];
  data.messages = [
    { id: generateId(), text: 'היי, מחר יש לנועה רופא ב-16:30. תוכל/י לקחת?', sender: 'a', timestamp: new Date(Date.now() - 86400000).toISOString() },
    { id: generateId(), text: 'בטח, אקח אותה. תשלח/י לי את הכתובת?', sender: 'b', timestamp: new Date(Date.now() - 82800000).toISOString() }
  ];

  saveData(data);
  return data;
}
