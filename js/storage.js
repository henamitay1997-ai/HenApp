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
    manualDates: {},
    dayDetails: {},
    week2DayDetails: {},
    manualDayDetails: {},
    weekendCycle: {
      parent: 'b',
      offParent: 'a',
      intervalWeeks: 3,
      startDate: new Date().toISOString().split('T')[0],
      days: [4, 5, 6],
      dayDetails: {},
      followUpVisit: {
        enabled: false,
        dayOfWeek: 5,
        weeksAfter: 1,
        parent: 'b',
        pickup: '14:00',
        returnTime: '18:00'
      },
      skippedFollowUpDates: [],
      flexVisits: []
    },
    monthlyVisits: [],
    visitHours: {
      baseParent: 'a',
      days: {}
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

function defaultDayDetail() {
  return { overnight: true, pickup: '', returnTime: '' };
}

function normalizeDayDetail(raw) {
  if (!raw || typeof raw !== 'object') return defaultDayDetail();
  return {
    overnight: raw.overnight !== false,
    pickup: raw.pickup || '',
    returnTime: raw.returnTime || raw.return || ''
  };
}

function getDayDetailMap(settings, mapName, key) {
  const map = settings[mapName] || {};
  return normalizeDayDetail(map[key] ?? map[String(key)]);
}

function setDayDetailInSettings(settings, mapName, key, patch) {
  if (!settings[mapName]) settings[mapName] = {};
  const current = normalizeDayDetail(settings[mapName][key] ?? settings[mapName][String(key)]);
  settings[mapName][key] = { ...current, ...patch };
}

function getSaturdayOfWeekContaining(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const sat = new Date(d);
  sat.setDate(d.getDate() + (6 - d.getDay()));
  return sat;
}

function getWeekdayNthInMonth(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return Math.floor((d.getDate() - 1) / 7) + 1;
}

function getMonthlyVisitForDate(dateStr, monthlyVisits) {
  if (!monthlyVisits?.length) return null;
  const dow = new Date(dateStr + 'T12:00:00').getDay();
  const nth = getWeekdayNthInMonth(dateStr);
  return monthlyVisits.find(v => v.dayOfWeek === dow && v.nthInMonth === nth) || null;
}

function isWeekendCycleWeek(dateStr, weekendCycle) {
  if (!weekendCycle?.startDate) return false;
  const sat = getSaturdayOfWeekContaining(dateStr);
  const start = getSaturdayOfWeekContaining(weekendCycle.startDate);
  const weeksDiff = Math.round((sat - start) / (7 * 86400000));
  return weeksDiff >= 0 && weeksDiff % (weekendCycle.intervalWeeks || 1) === 0;
}

function getWeekendCycleParent(dateStr, weekendCycle) {
  if (!weekendCycle) return null;
  const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
  if (isWeekendCycleWeek(dateStr, weekendCycle) && weekendCycle.days?.includes(dayOfWeek)) {
    return weekendCycle.parent;
  }
  return weekendCycle.offParent || null;
}

function getFlexVisitForDate(dateStr, flexVisits) {
  if (!flexVisits?.length) return null;
  return flexVisits.find(v => v.date === dateStr) || null;
}

function isFollowUpVisitDate(dateStr, weekendCycle) {
  const fu = weekendCycle?.followUpVisit;
  if (!fu?.enabled || !weekendCycle?.startDate) return false;
  if ((weekendCycle.skippedFollowUpDates || []).includes(dateStr)) return false;

  const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
  if (dayOfWeek !== (fu.dayOfWeek ?? 5)) return false;

  const weeksAfter = fu.weeksAfter ?? 1;
  const sat = getSaturdayOfWeekContaining(dateStr);
  const refSat = new Date(sat);
  refSat.setDate(sat.getDate() - weeksAfter * 7);
  const refSatStr = refSat.toISOString().split('T')[0];
  return isWeekendCycleWeek(refSatStr, weekendCycle);
}

function getFollowUpVisitForDate(dateStr, weekendCycle) {
  if (!isFollowUpVisitDate(dateStr, weekendCycle)) return null;
  const fu = weekendCycle.followUpVisit;
  return {
    parent: fu.parent || weekendCycle.parent,
    overnight: false,
    pickup: fu.pickup || '14:00',
    returnTime: fu.returnTime || fu.return || '18:00'
  };
}

function getVisitHoursDayConfig(visitHours, dayOfWeek) {
  const days = visitHours?.days || {};
  return days[dayOfWeek] ?? days[String(dayOfWeek)] ?? null;
}

function getCustodyForDate(data, dateStr) {
  const {
    custodyPattern, custodyStartDate, weekSchedule, weekSchedule2,
    manualDates = {}, weekendCycle, monthlyVisits = [], visitHours
  } = data.settings;
  const date = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay();

  if (manualDates[dateStr]) return manualDates[dateStr];

  const monthly = getMonthlyVisitForDate(dateStr, monthlyVisits);
  if (monthly) return monthly.parent;

  if (custodyPattern === 'weekend-cycle') {
    const flex = getFlexVisitForDate(dateStr, weekendCycle?.flexVisits);
    if (flex) return flex.parent;
    const followUp = getFollowUpVisitForDate(dateStr, weekendCycle);
    if (followUp) return followUp.parent;
  }

  if (custodyPattern === 'visit-hours') {
    const dayConfig = getVisitHoursDayConfig(visitHours, dayOfWeek);
    if (dayConfig?.active) return dayConfig.parent || visitHours?.baseParent || 'a';
    return visitHours?.baseParent || weekSchedule[dayOfWeek] || 'a';
  }

  if (custodyPattern === 'weekend-cycle') {
    const wcParent = getWeekendCycleParent(dateStr, weekendCycle);
    if (wcParent) return wcParent;
    return weekSchedule[dayOfWeek] || 'a';
  }

  if (custodyPattern === 'manual') {
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

function getCustodyDayInfo(data, dateStr) {
  const parent = getCustodyForDate(data, dateStr);
  const {
    custodyPattern, custodyStartDate, manualDayDetails = {}, dayDetails = {},
    week2DayDetails = {}, weekendCycle, monthlyVisits = [], visitHours
  } = data.settings;
  const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
  let detail = defaultDayDetail();

  if (manualDayDetails[dateStr]) {
    detail = normalizeDayDetail(manualDayDetails[dateStr]);
  } else {
    const monthly = getMonthlyVisitForDate(dateStr, monthlyVisits);
    if (monthly && monthly.parent === parent) {
      detail = normalizeDayDetail(monthly);
    } else if (custodyPattern === 'weekend-cycle') {
      const flex = getFlexVisitForDate(dateStr, weekendCycle?.flexVisits);
      if (flex && flex.parent === parent) {
        detail = normalizeDayDetail(flex);
      } else {
        const followUp = getFollowUpVisitForDate(dateStr, weekendCycle);
        if (followUp && followUp.parent === parent) {
          detail = normalizeDayDetail(followUp);
        } else if (isWeekendCycleWeek(dateStr, weekendCycle) && weekendCycle?.days?.includes(dayOfWeek) && weekendCycle.parent === parent) {
          detail = getDayDetailMap({ dayDetails: weekendCycle.dayDetails || {} }, 'dayDetails', dayOfWeek);
        }
      }
    } else if (custodyPattern === 'visit-hours') {
      const dayConfig = getVisitHoursDayConfig(visitHours, dayOfWeek);
      if (dayConfig?.active) {
        detail = normalizeDayDetail({
          overnight: false,
          pickup: dayConfig.pickup || '14:00',
          returnTime: dayConfig.returnTime || dayConfig.return || '18:00'
        });
      } else {
        detail = defaultDayDetail();
      }
    } else if (custodyPattern === 'biweekly') {
      const weekIndex = getBiweeklyWeekIndex(dateStr, custodyStartDate);
      const detailsMap = weekIndex === 1 ? dayDetails : week2DayDetails;
      detail = getDayDetailMap({ dayDetails: detailsMap }, 'dayDetails', dayOfWeek);
    } else {
      detail = getDayDetailMap(data.settings, 'dayDetails', dayOfWeek);
    }
  }

  return { parent, ...detail };
}

function getCalendarDayDisplay(data, dateStr) {
  const dayInfo = getCustodyDayInfo(data, dateStr);
  const visitParent = dayInfo.parent;

  if (dayInfo.overnight !== false) {
    return { mode: 'overnight', parent: visitParent, dayInfo };
  }

  let baseParent = visitParent === 'a' ? 'b' : 'a';
  const { custodyPattern, visitHours, weekendCycle } = data.settings;

  if (custodyPattern === 'visit-hours') {
    const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
    const dayConfig = getVisitHoursDayConfig(visitHours, dayOfWeek);
    if (dayConfig?.active) {
      baseParent = visitHours?.baseParent || baseParent;
    }
  } else if (custodyPattern === 'weekend-cycle') {
    const hasVisitOverlay = getFlexVisitForDate(dateStr, weekendCycle?.flexVisits)
      || getFollowUpVisitForDate(dateStr, weekendCycle);
    if (hasVisitOverlay && weekendCycle?.offParent) {
      baseParent = weekendCycle.offParent;
    }
  }

  return {
    mode: 'visit',
    parent: visitParent,
    baseParent,
    visitParent,
    dayInfo
  };
}

function formatCustodyTimeLabel(info) {
  if (info.overnight) return 'משמורת עם לינה';
  const pickup = info.pickup || '?';
  const ret = info.returnTime || info.return || '?';
  return `ביקור ${pickup}–${ret}`;
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
