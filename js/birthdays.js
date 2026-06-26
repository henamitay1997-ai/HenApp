const hebrewBirthCache = {};

function getAgeOnDate(birthDate, dateStr) {
  if (!birthDate || !dateStr) return '';
  const birth = new Date(birthDate + 'T12:00:00');
  const on = new Date(dateStr + 'T12:00:00');
  let age = on.getFullYear() - birth.getFullYear();
  const m = on.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < birth.getDate())) age--;
  return age;
}

function matchesGregorianBirthday(birthDate, dateStr) {
  if (!birthDate) return false;
  const b = birthDate.slice(5);
  const d = dateStr.slice(5);
  return b === d;
}

async function fetchHebrewDateFromGregorian(dateStr) {
  const [gy, gm, gd] = dateStr.split('-').map(Number);
  const key = `g2h-${dateStr}`;
  if (hebrewBirthCache[key]) return hebrewBirthCache[key];
  try {
    const res = await fetch(`https://www.hebcal.com/converter?cfg=json&gy=${gy}&gm=${gm}&gd=${gd}&g2h=1`);
    if (!res.ok) throw new Error('converter');
    const data = await res.json();
    hebrewBirthCache[key] = data;
    return data;
  } catch (err) {
    console.warn('Hebrew date fetch failed', err);
    return null;
  }
}

async function getChildHebrewBirthParts(child) {
  if (!child?.birthDate) return null;
  if (child._hebBirth) return child._hebBirth;
  const data = await fetchHebrewDateFromGregorian(child.birthDate);
  if (!data) return null;
  child._hebBirth = { hm: data.hm, hd: data.hd, label: data.hebrew };
  return child._hebBirth;
}

async function getGregorianDateForHebrewBirthday(hm, hd, gregYear) {
  const cacheKey = `h2g-${gregYear}-${hm}-${hd}`;
  if (hebrewBirthCache[cacheKey]) return hebrewBirthCache[cacheKey];

  for (const hy of [gregYear + 3760, gregYear + 3761, gregYear + 3759]) {
    try {
      const res = await fetch(`https://www.hebcal.com/converter?cfg=json&hy=${hy}&hm=${hm}&hd=${hd}&h2g=1`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.gy === gregYear) {
        const dateStr = `${data.gy}-${String(data.gm).padStart(2, '0')}-${String(data.gd).padStart(2, '0')}`;
        hebrewBirthCache[cacheKey] = dateStr;
        return dateStr;
      }
    } catch (_) { /* try next */ }
  }
  return null;
}

function getGregorianBirthdaysOnDate(data, dateStr) {
  return (data.children || [])
    .filter(c => c.birthDate && matchesGregorianBirthday(c.birthDate, dateStr))
    .map(c => ({
      child: c,
      age: getAgeOnDate(c.birthDate, dateStr),
      kind: 'gregorian',
      hebrewLabel: null
    }));
}

async function getBirthdaysOnDate(data, dateStr) {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const found = new Map();
  const add = (entry) => {
    if (!found.has(entry.child.id)) found.set(entry.child.id, entry);
  };

  getGregorianBirthdaysOnDate(data, dateStr).forEach(add);

  for (const child of data.children || []) {
    if (!child.birthDate) continue;
    const parts = await getChildHebrewBirthParts(child);
    if (!parts) continue;
    const hebGreg = await getGregorianDateForHebrewBirthday(parts.hm, parts.hd, year);
    if (hebGreg === dateStr && !matchesGregorianBirthday(child.birthDate, dateStr)) {
      add({
        child,
        age: getAgeOnDate(child.birthDate, dateStr),
        kind: 'hebrew',
        hebrewLabel: parts.label
      });
    }
  }

  return [...found.values()];
}

async function enrichBirthdayHebrewLabels(birthdays, dateStr) {
  const heb = await fetchHebrewDateFromGregorian(dateStr);
  const hebToday = heb?.hebrew || '';
  return birthdays.map(b => ({
    ...b,
    hebrewLabel: b.hebrewLabel || hebToday,
    gregorianLabel: formatDate(dateStr)
  }));
}

const birthdayByDateCache = {};

async function getBirthdaysOnDateCached(data, dateStr) {
  if (birthdayByDateCache[dateStr]) return birthdayByDateCache[dateStr];
  const result = await enrichBirthdayHebrewLabels(await getBirthdaysOnDate(data, dateStr), dateStr);
  birthdayByDateCache[dateStr] = result;
  return result;
}

function getBirthdaysOnDateSync(data, dateStr) {
  return birthdayByDateCache[dateStr] || getGregorianBirthdaysOnDate(data, dateStr);
}

async function preloadBirthdaysForMonth(data, year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = new Date(first);
  start.setDate(start.getDate() - first.getDay());
  const end = new Date(last);
  end.setDate(end.getDate() + (6 - last.getDay()));
  const tasks = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    tasks.push(getBirthdaysOnDateCached(data, d.toISOString().split('T')[0]));
  }
  await Promise.all(tasks);
}

function clearBirthdayCache() {
  Object.keys(birthdayByDateCache).forEach(k => delete birthdayByDateCache[k]);
  Object.keys(hebrewBirthCache).forEach(k => delete hebrewBirthCache[k]);
}

function renderBirthdayBar(b) {
  const icon = b.kind === 'hebrew' ? '🎈' : '🎂';
  return `<div class="cal-birthday-bar" title="יום הולדת — ${b.child.name}">${icon} ${b.child.name} · בן/ת ${b.age}</div>`;
}

function renderBirthdayCelebrationHtml(birthdays) {
  return birthdays.map(b => `
    <div class="birthday-celebration-card">
      <div class="birthday-celebration-icons" aria-hidden="true">🎈🎂🎉</div>
      <h3 class="birthday-celebration-title">מזל טוב ל${b.child.name}!</h3>
      <p class="birthday-celebration-age">בן/בת <strong>${b.age}</strong></p>
      <div class="birthday-celebration-dates">
        <p><span>תאריך לועזי:</span> ${b.gregorianLabel || ''}</p>
        ${b.hebrewLabel ? `<p><span>תאריך עברי:</span> ${b.hebrewLabel}</p>` : ''}
        ${b.kind === 'hebrew' ? '<p class="birthday-hebrew-note">🎈 יום הולדת עברי</p>' : ''}
      </div>
    </div>
  `).join('');
}
