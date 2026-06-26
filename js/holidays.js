const holidayCacheByYear = {};

const HOLIDAY_SKIP_PATTERN = /הרצל|בן.gוריון|ז.בוטינסקי|השפה העברית|בית הספר|רבין|יום המשפחה|יום העליה(?!$)/i;

function shouldShowIsraeliHoliday(item) {
  if (item.category !== 'holiday') return false;
  if (item.subcat === 'shabbat') return false;
  if (item.subcat === 'fast') return true;
  if (!['major', 'modern', 'minor'].includes(item.subcat)) return false;
  if (item.subcat === 'modern' && HOLIDAY_SKIP_PATTERN.test(item.hebrew || item.title || '')) {
    return false;
  }
  return true;
}

function normalizeHolidayName(item) {
  const name = item.hebrew || item.title || '';
  if (/חנוכה/.test(name)) return 'חנוכה';
  if (/סוכות/.test(name) && /חוה/.test(name)) return 'חול המועד';
  if (/פסח/.test(name) && /חוה/.test(name)) return 'חול המועד פסח';
  return name;
}

function dedupeHolidayNames(items) {
  const seen = new Set();
  const result = [];
  items.forEach(item => {
    const name = normalizeHolidayName(item);
    if (seen.has(name)) return;
    seen.add(name);
    result.push({
      name,
      subcat: item.subcat,
      yomtov: !!item.yomtov
    });
  });
  return result;
}

function buildHolidayMap(items) {
  const byDate = {};
  items.forEach(item => {
    if (!shouldShowIsraeliHoliday(item)) return;
    if (!byDate[item.date]) byDate[item.date] = [];
    byDate[item.date].push(item);
  });
  Object.keys(byDate).forEach(date => {
    byDate[date] = dedupeHolidayNames(byDate[date]);
  });
  return byDate;
}

async function ensureHolidaysForYear(year) {
  if (holidayCacheByYear[year]) return holidayCacheByYear[year];

  const storageKey = `il-holidays-v1-${year}`;
  try {
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      holidayCacheByYear[year] = JSON.parse(cached);
      return holidayCacheByYear[year];
    }
  } catch (_) { /* ignore */ }

  try {
    const url = `https://www.hebcal.com/hebcal/?v=1&cfg=json&year=${year}&i=on&maj=on&min=on&mod=on&nx=on&ss=on`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('holiday fetch failed');
    const data = await res.json();
    const map = buildHolidayMap(data.items || []);
    holidayCacheByYear[year] = map;
    try {
      localStorage.setItem(storageKey, JSON.stringify(map));
    } catch (_) { /* ignore */ }
    return map;
  } catch (err) {
    console.warn('Could not load Israeli holidays for', year, err);
    holidayCacheByYear[year] = {};
    return {};
  }
}

function getHolidaysForDate(dateStr) {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const map = holidayCacheByYear[year];
  if (!map) return [];
  return map[dateStr] || [];
}

function getHolidayBarClass(holiday) {
  if (holiday.yomtov || holiday.subcat === 'major') return 'major';
  if (holiday.subcat === 'modern') return 'modern';
  if (holiday.subcat === 'fast') return 'fast';
  return 'minor';
}
