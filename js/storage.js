const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const BIWEEKLY_WEEK1_DEFAULT = { 0: 'a', 1: 'a', 2: 'b', 3: 'b', 4: 'b', 5: 'a', 6: 'a' };
const BIWEEKLY_WEEK2_DEFAULT = { 0: 'b', 1: 'b', 2: 'a', 3: 'a', 4: 'b', 5: 'b', 6: 'b' };

const DEFAULT_DATA = {
  settings: {
    parentAName: 'הורה א',
    parentBName: 'הורה ב',
    parentAAvatar: '',
    parentBAvatar: '',
    currentParent: 'a',
    custodyStartDate: new Date().toISOString().split('T')[0],
    custodyPattern: 'alternating-weeks',
    weekSchedule: {
      0: 'a', 1: 'a', 2: 'a', 3: 'b', 4: 'b', 5: 'b', 6: 'b'
    },
    weekSchedule2: { ...BIWEEKLY_WEEK2_DEFAULT },
    manualDates: {}
  },
  children: [],
  events: [],
  expenses: [],
  messages: []
};

function getParentName(data, parent) {
  return parent === 'a' ? data.settings.parentAName : data.settings.parentBName;
}

function getBiweeklyPresets() {
  return {
    week1: { ...BIWEEKLY_WEEK1_DEFAULT },
    week2: { ...BIWEEKLY_WEEK2_DEFAULT }
  };
}

function applyCommonBiweeklyPreset(settings) {
  const presets = getBiweeklyPresets();
  settings.weekSchedule = { ...presets.week1 };
  settings.weekSchedule2 = { ...presets.week2 };
}

function getBiweeklyWeekIndex(dateStr, custodyStartDate) {
  const date = new Date(dateStr + 'T12:00:00');
  const start = new Date(custodyStartDate + 'T12:00:00');
  const diffDays = Math.floor((date - start) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(diffDays / 7);
  return weekNum % 2 === 0 ? 1 : 2;
}

function getCustodyForDate(data, dateStr) {
  const { custodyPattern, custodyStartDate, weekSchedule, weekSchedule2, manualDates = {} } = data.settings;
  const date = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay();

  if (custodyPattern === 'manual') {
    if (manualDates[dateStr]) return manualDates[dateStr];
    return weekSchedule[dayOfWeek] || 'a';
  }

  if (custodyPattern === 'weekly') {
    return weekSchedule[dayOfWeek] || 'a';
  }

  if (custodyPattern === 'biweekly') {
    const weekIndex = getBiweeklyWeekIndex(dateStr, custodyStartDate);
    const schedule = weekIndex === 1 ? weekSchedule : (weekSchedule2 || weekSchedule);
    return schedule[dayOfWeek] || 'a';
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
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'short' });
}

function formatDateRange(startStr, endStr) {
  const start = new Date(startStr + 'T12:00:00');
  const end = new Date(endStr + 'T12:00:00');
  const opts = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('he-IL', opts)} – ${end.toLocaleDateString('he-IL', opts)}`;
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

function calculateExpenseSummary(data) {
  const parentAName = getParentName(data, 'a');
  const parentBName = getParentName(data, 'b');

  let paidA = 0;
  let paidB = 0;
  let shouldA = 0;
  let shouldB = 0;
  let total = 0;

  const rows = [...data.expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(e => {
      const shareA = e.amount * (e.splitPercent / 100);
      const shareB = e.amount - shareA;
      total += e.amount;
      shouldA += shareA;
      shouldB += shareB;
      if (e.paidBy === 'a') paidA += e.amount;
      else paidB += e.amount;

      return {
        ...e,
        shareA,
        shareB,
        paidByName: getParentName(data, e.paidBy)
      };
    });

  const balanceA = paidA - shouldA;
  let settlement = null;

  if (Math.abs(balanceA) >= 1) {
    if (balanceA > 0) {
      settlement = {
        from: 'b',
        fromName: parentBName,
        to: 'a',
        toName: parentAName,
        amount: balanceA
      };
    } else {
      settlement = {
        from: 'a',
        fromName: parentAName,
        to: 'b',
        toName: parentBName,
        amount: -balanceA
      };
    }
  }

  return {
    parentA: { name: parentAName, paid: paidA, shouldPay: shouldA, balance: balanceA },
    parentB: { name: parentBName, paid: paidB, shouldPay: shouldB, balance: -balanceA },
    total,
    settlement,
    rows
  };
}
