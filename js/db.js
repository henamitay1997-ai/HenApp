let dbUserId = null;
let familyId = null;
let familyInfo = null;
let useLegacyMode = false;

function setDbUser(userId) {
  dbUserId = userId;
}

function clearFamilyContext() {
  dbUserId = null;
  familyId = null;
  familyInfo = null;
  useLegacyMode = false;
}

function getFamilyId() {
  return familyId;
}

function getFamilyInfo() {
  return familyInfo;
}

function db() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase לא מחובר');
  return client;
}

function getInviteLink(code) {
  const base = window.location.origin + window.location.pathname;
  return `${base}#join/${code}`;
}

function translateDbError(err) {
  const msg = err?.message || '';
  const details = err?.details || '';
  const combined = `${msg} ${details}`;
  if (combined.includes('parent_a_avatar') || combined.includes('parent_b_avatar') || combined.includes('avatar_url')) {
    return 'חסרות עמודות תמונה — הרץ/י ב-Supabase את AVATARS-ONLY.sql';
  }
  if (isFamilyDbError(err)) {
    return 'בעיה בטבלאות משפחה — הרץ/י ב-Supabase את RUN-NOW-EN.sql';
  }
  if (combined.includes('row-level security') || combined.includes('RLS')) {
    return 'שגיאת הרשאות — הרץ/י ב-Supabase את RUN-NOW-EN.sql';
  }
  if (combined.includes('JWT')) return 'פג תוקף ההתחברות — התחבר/י מחדש';
  return msg || 'שגיאה בשמירה';
}

function switchToLegacyMode(reason) {
  console.warn('Switching to legacy data mode', reason);
  useLegacyMode = true;
  familyId = null;
  familyInfo = null;
}

function isFamilyDbError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const details = (err.details || '').toLowerCase();
  const combined = `${msg} ${details}`;
  const familyCodes = ['PGRST200', 'PGRST204', 'PGRST205', '42P01'];
  if (familyCodes.includes(err.code)) return true;
  return combined.includes('family_settings')
    || combined.includes('family_members')
    || combined.includes('user_family_prefs')
    || combined.includes('ensure_user_family')
    || (combined.includes('families') && (
      combined.includes('does not exist')
      || combined.includes('could not find')
      || combined.includes('schema cache')
    ));
}

function isAvatarColumnError(err) {
  const combined = `${err?.message || ''} ${err?.details || ''}`;
  return combined.includes('parent_a_avatar')
    || combined.includes('parent_b_avatar')
    || combined.includes('avatar_url');
}

function normalizeWeekSchedule(schedule) {
  const defaults = { 0: 'a', 1: 'a', 2: 'a', 3: 'b', 4: 'b', 5: 'b', 6: 'b' };
  const weekSchedule = { ...defaults };
  const weekSchedule2 = { ...BIWEEKLY_WEEK2_DEFAULT };
  let manualDates = {};
  let dayDetails = {};
  let week2DayDetails = {};
  let manualDayDetails = {};
  let weekendCycle = null;
  let monthlyVisits = [];
  let visitHours = null;

  if (!schedule || typeof schedule !== 'object') {
    return { weekSchedule, weekSchedule2, manualDates, dayDetails, week2DayDetails, manualDayDetails, weekendCycle, monthlyVisits, visitHours };
  }

  Object.entries(schedule).forEach(([key, value]) => {
    if (key === '__manualDates' && value && typeof value === 'object') {
      manualDates = { ...value };
      return;
    }
    if (key === '__dayDetails' && value && typeof value === 'object') {
      dayDetails = { ...value };
      return;
    }
    if (key === '__week2DayDetails' && value && typeof value === 'object') {
      week2DayDetails = { ...value };
      return;
    }
    if (key === '__manualDayDetails' && value && typeof value === 'object') {
      manualDayDetails = { ...value };
      return;
    }
    if (key === '__weekendCycle' && value && typeof value === 'object') {
      weekendCycle = { ...value };
      return;
    }
    if (key === '__monthlyVisits' && Array.isArray(value)) {
      monthlyVisits = value.map(v => ({ ...v }));
      return;
    }
    if (key === '__visitHours' && value && typeof value === 'object') {
      visitHours = { ...value };
      return;
    }
    if (key === '__week2' && value && typeof value === 'object') {
      Object.entries(value).forEach(([dayKey, parent]) => {
        const day = parseInt(dayKey, 10);
        if (!Number.isNaN(day) && day >= 0 && day <= 6) weekSchedule2[day] = parent;
      });
      return;
    }
    const day = parseInt(key, 10);
    if (!Number.isNaN(day) && day >= 0 && day <= 6) {
      weekSchedule[day] = value;
    }
  });

  return { weekSchedule, weekSchedule2, manualDates, dayDetails, week2DayDetails, manualDayDetails, weekendCycle, monthlyVisits, visitHours };
}

function buildWeekSchedulePayload(settings) {
  const payload = { ...settings.weekSchedule };
  if (settings.manualDates && Object.keys(settings.manualDates).length > 0) {
    payload.__manualDates = settings.manualDates;
  }
  if (settings.weekSchedule2) {
    payload.__week2 = settings.weekSchedule2;
  }
  if (settings.dayDetails && Object.keys(settings.dayDetails).length > 0) {
    payload.__dayDetails = settings.dayDetails;
  }
  if (settings.week2DayDetails && Object.keys(settings.week2DayDetails).length > 0) {
    payload.__week2DayDetails = settings.week2DayDetails;
  }
  if (settings.manualDayDetails && Object.keys(settings.manualDayDetails).length > 0) {
    payload.__manualDayDetails = settings.manualDayDetails;
  }
  if (settings.weekendCycle) {
    payload.__weekendCycle = settings.weekendCycle;
  }
  if (settings.monthlyVisits?.length) {
    payload.__monthlyVisits = settings.monthlyVisits;
  }
  if (settings.visitHours) {
    payload.__visitHours = settings.visitHours;
  }
  return payload;
}

function mapSettings(row, currentParent) {
  if (!row) return structuredClone(DEFAULT_DATA.settings);
  const {
    weekSchedule, weekSchedule2, manualDates, dayDetails, week2DayDetails,
    manualDayDetails, weekendCycle, monthlyVisits, visitHours
  } = normalizeWeekSchedule(row.week_schedule);
  return {
    parentAName: row.parent_a_name,
    parentBName: row.parent_b_name,
    parentAAvatar: row.parent_a_avatar || '',
    parentBAvatar: row.parent_b_avatar || '',
    currentParent: currentParent || row.current_parent || 'a',
    custodyPattern: row.custody_pattern,
    custodyStartDate: row.custody_start_date,
    weekSchedule,
    weekSchedule2,
    manualDates,
    dayDetails,
    week2DayDetails,
    manualDayDetails,
    weekendCycle: {
      ...structuredClone(DEFAULT_DATA.settings.weekendCycle),
      ...(weekendCycle || {})
    },
    monthlyVisits: monthlyVisits || [],
    visitHours: visitHours || structuredClone(DEFAULT_DATA.settings.visitHours)
  };
}

function mapChild(row) {
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date || '',
    school: row.school || '',
    allergies: row.allergies || '',
    notes: row.notes || '',
    avatarUrl: row.avatar_url || ''
  };
}

function mapEvent(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time || '',
    childId: row.child_id || null,
    location: row.location || '',
    notes: row.notes || '',
    createdBy: row.created_by
  };
}

function mapExpense(row) {
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount),
    date: row.date,
    paidBy: row.paid_by,
    splitPercent: row.split_percent,
    paid: row.paid,
    category: row.category || 'אחר',
    childId: row.child_id || null,
    notes: row.notes || ''
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    text: row.text,
    sender: row.sender,
    timestamp: row.created_at
  };
}

async function tryLoadFamilyContext() {
  const { data: fid, error: fidErr } = await db().rpc('ensure_user_family');
  if (fidErr) throw fidErr;
  familyId = fid;
  useLegacyMode = false;

  const [familyRes, membersRes, prefsRes] = await Promise.all([
    db().from('families').select('id, name, invite_code').eq('id', familyId).single(),
    db().from('family_members').select('user_id, parent_role').eq('family_id', familyId),
    db().from('user_family_prefs').select('current_parent').eq('user_id', dbUserId).eq('family_id', familyId).maybeSingle()
  ]);

  if (familyRes.error) throw familyRes.error;
  if (membersRes.error) throw membersRes.error;

  const memberRows = membersRes.data || [];
  const userIds = memberRows.map(m => m.user_id);
  const profileMap = {};

  if (userIds.length > 0) {
    const { data: profiles } = await db().from('profiles').select('id, full_name, email').in('id', userIds);
    (profiles || []).forEach(p => { profileMap[p.id] = p; });
  }

  const members = memberRows.map(m => {
    const profile = profileMap[m.user_id];
    return {
      userId: m.user_id,
      parentRole: m.parent_role,
      name: profile?.full_name || profile?.email?.split('@')[0] || 'הורה',
      email: profile?.email || '',
      isMe: m.user_id === dbUserId
    };
  });

  const myMember = members.find(m => m.isMe);

  familyInfo = {
    id: familyRes.data.id,
    name: familyRes.data.name,
    inviteCode: familyRes.data.invite_code,
    inviteLink: getInviteLink(familyRes.data.invite_code),
    members,
    myParentRole: myMember?.parentRole || 'a',
    isFull: members.length >= 2,
    hasPartner: members.length >= 2
  };

  return prefsRes.data?.current_parent || myMember?.parentRole || 'a';
}

async function loadFamilyContext() {
  try {
    return await tryLoadFamilyContext();
  } catch (err) {
    console.warn('Family mode unavailable, using legacy user scope', err);
    useLegacyMode = true;
    familyId = null;
    familyInfo = null;
    return 'a';
  }
}

async function ensureUserData(userId) {
  setDbUser(userId);
  await loadFamilyContext();
}

async function loadLegacyAppData() {
  const settingsRes = await db().from('user_settings').select('*').eq('user_id', dbUserId).maybeSingle();

  const [childrenRes, eventsRes, expensesRes, messagesRes] = await Promise.all([
    db().from('children').select('*').eq('user_id', dbUserId).order('created_at'),
    db().from('events').select('*').eq('user_id', dbUserId).order('date'),
    db().from('expenses').select('*').eq('user_id', dbUserId).order('date', { ascending: false }),
    db().from('messages').select('*').eq('user_id', dbUserId).order('created_at')
  ]);

  if (childrenRes.error) throw childrenRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (expensesRes.error) throw expensesRes.error;
  if (messagesRes.error) throw messagesRes.error;

  return {
    family: null,
    settings: mapSettings(settingsRes.data, settingsRes.data?.current_parent),
    children: (childrenRes.data || []).map(mapChild),
    events: (eventsRes.data || []).map(mapEvent),
    expenses: (expensesRes.data || []).map(mapExpense),
    messages: (messagesRes.data || []).map(mapMessage)
  };
}

async function loadFamilyAppData() {
  if (!familyId) throw new Error('אין משפחה מחוברת');

  const currentParent = await tryLoadFamilyContext();

  const settingsRes = await db().from('family_settings').select('*').eq('family_id', familyId).maybeSingle();
  if (settingsRes.error) throw settingsRes.error;

  if (!settingsRes.data) {
    const insertRes = await db().from('family_settings').insert({ family_id: familyId });
    if (insertRes.error) throw insertRes.error;
  }

  const [childrenRes, eventsRes, expensesRes, messagesRes] = await Promise.all([
    db().from('children').select('*').eq('family_id', familyId).order('created_at'),
    db().from('events').select('*').eq('family_id', familyId).order('date'),
    db().from('expenses').select('*').eq('family_id', familyId).order('date', { ascending: false }),
    db().from('messages').select('*').eq('family_id', familyId).order('created_at')
  ]);

  if (childrenRes.error) throw childrenRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (expensesRes.error) throw expensesRes.error;
  if (messagesRes.error) throw messagesRes.error;

  let children = childrenRes.data || [];
  if (children.length === 0) {
    const legacyChildren = await db().from('children').select('*').eq('user_id', dbUserId).order('created_at');
    if (!legacyChildren.error) children = legacyChildren.data || [];
  }

  const settingsRow = settingsRes.data || (await db().from('family_settings').select('*').eq('family_id', familyId).single()).data;

  return {
    family: familyInfo,
    settings: mapSettings(settingsRow, currentParent),
    children: children.map(mapChild),
    events: (eventsRes.data || []).map(mapEvent),
    expenses: (expensesRes.data || []).map(mapExpense),
    messages: (messagesRes.data || []).map(mapMessage)
  };
}

async function loadAppData() {
  if (!dbUserId) throw new Error('משתמש לא מחובר');

  if (useLegacyMode || !familyId) {
    return loadLegacyAppData();
  }

  try {
    return await loadFamilyAppData();
  } catch (err) {
    if (isFamilyDbError(err)) {
      switchToLegacyMode(err);
      return loadLegacyAppData();
    }
    throw err;
  }
}

async function saveLegacySettings(settings, includeAvatars = true) {
  const row = {
    user_id: dbUserId,
    parent_a_name: settings.parentAName,
    parent_b_name: settings.parentBName,
    current_parent: settings.currentParent,
    custody_pattern: settings.custodyPattern,
    custody_start_date: settings.custodyStartDate,
    week_schedule: buildWeekSchedulePayload(settings),
    updated_at: new Date().toISOString()
  };
  if (includeAvatars) {
    row.parent_a_avatar = settings.parentAAvatar || null;
    row.parent_b_avatar = settings.parentBAvatar || null;
  }
  const { error } = await db().from('user_settings').upsert(row);
  if (error && includeAvatars && isAvatarColumnError(error)) {
    return saveLegacySettings(settings, false);
  }
  if (error) throw error;
}

async function saveFamilySettings(settings, includeAvatars = true) {
  const row = {
    parent_a_name: settings.parentAName,
    parent_b_name: settings.parentBName,
    custody_pattern: settings.custodyPattern,
    custody_start_date: settings.custodyStartDate,
    week_schedule: buildWeekSchedulePayload(settings),
    updated_at: new Date().toISOString()
  };
  if (includeAvatars) {
    row.parent_a_avatar = settings.parentAAvatar || null;
    row.parent_b_avatar = settings.parentBAvatar || null;
  }

  const { error: settingsErr } = await db().from('family_settings').update(row).eq('family_id', familyId);
  if (settingsErr && includeAvatars && isAvatarColumnError(settingsErr)) {
    return saveFamilySettings(settings, false);
  }
  if (settingsErr) throw settingsErr;

  const { error: prefsErr } = await db().from('user_family_prefs').upsert({
    user_id: dbUserId,
    family_id: familyId,
    current_parent: settings.currentParent
  });
  if (prefsErr) throw prefsErr;
}

async function saveSettings(settings) {
  if (useLegacyMode || !familyId) {
    return saveLegacySettings(settings);
  }

  try {
    await saveFamilySettings(settings);
  } catch (err) {
    if (isFamilyDbError(err)) {
      switchToLegacyMode(err);
      return saveLegacySettings(settings);
    }
    throw err;
  }
}

async function joinFamilyByCode(code) {
  const { data, error } = await db().rpc('join_family_by_code', { p_invite_code: code });
  if (error) throw error;
  familyId = data.family_id;
  useLegacyMode = false;
  await tryLoadFamilyContext();
  return data;
}

function childInsertPayload(data, includeAvatar = true, includeFamily = true) {
  const payload = {
    user_id: dbUserId,
    name: data.name,
    birth_date: data.birthDate || null,
    school: data.school || '',
    allergies: data.allergies || '',
    notes: data.notes || ''
  };
  if (includeAvatar) payload.avatar_url = data.avatarUrl || null;
  if (includeFamily && familyId) payload.family_id = familyId;
  return payload;
}

async function createChild(data) {
  async function tryInsert(includeAvatar, includeFamily) {
    return db().from('children').insert(childInsertPayload(data, includeAvatar, includeFamily)).select().single();
  }

  let { data: row, error } = await tryInsert(true, true);
  if (error && isAvatarColumnError(error)) {
    ({ data: row, error } = await tryInsert(false, true));
  }
  if (error && isFamilyDbError(error)) {
    switchToLegacyMode(error);
    ({ data: row, error } = await tryInsert(true, false));
    if (error && isAvatarColumnError(error)) {
      ({ data: row, error } = await tryInsert(false, false));
    }
  }
  if (error) throw error;
  return mapChild(row);
}

function buildChildUpdatePayload(data, includeAvatar = true) {
  const payload = {
    name: data.name,
    birth_date: data.birthDate || null,
    school: data.school || '',
    allergies: data.allergies || '',
    notes: data.notes || ''
  };
  if (includeAvatar) payload.avatar_url = data.avatarUrl || null;
  return payload;
}

async function updateChild(id, data) {
  async function tryUpdate(includeAvatar) {
    return db().from('children').update(buildChildUpdatePayload(data, includeAvatar))
      .eq('id', id)
      .eq('user_id', dbUserId);
  }

  let { error } = await tryUpdate(true);
  if (error && isAvatarColumnError(error)) {
    ({ error } = await tryUpdate(false));
  }
  if (error && isFamilyDbError(error)) {
    switchToLegacyMode(error);
    ({ error } = await tryUpdate(true));
    if (error && isAvatarColumnError(error)) {
      ({ error } = await tryUpdate(false));
    }
  }
  if (error) throw error;
}

async function deleteChild(id) {
  let query = db().from('children').delete().eq('id', id).eq('user_id', dbUserId);
  if (familyId) query = query.eq('family_id', familyId);
  const { error } = await query;
  if (error) throw error;
}

function entityInsertPayload(base) {
  const payload = { user_id: dbUserId, ...base };
  if (familyId) payload.family_id = familyId;
  return payload;
}

async function createEvent(data) {
  const { data: row, error } = await db().from('events').insert(entityInsertPayload({
    title: data.title,
    date: data.date,
    time: data.time || '',
    child_id: data.childId || null,
    location: data.location || '',
    notes: data.notes || '',
    created_by: data.createdBy
  })).select().single();
  if (error) throw error;
  return mapEvent(row);
}

async function updateEvent(id, data) {
  let query = db().from('events').update({
    title: data.title,
    date: data.date,
    time: data.time || '',
    child_id: data.childId || null,
    location: data.location || '',
    notes: data.notes || ''
  }).eq('id', id).eq('user_id', dbUserId);
  if (familyId) query = query.eq('family_id', familyId);
  const { error } = await query;
  if (error) throw error;
}

async function deleteEvent(id) {
  let query = db().from('events').delete().eq('id', id).eq('user_id', dbUserId);
  if (familyId) query = query.eq('family_id', familyId);
  const { error } = await query;
  if (error) throw error;
}

async function createExpense(data) {
  const { data: row, error } = await db().from('expenses').insert(entityInsertPayload({
    title: data.title,
    amount: data.amount,
    date: data.date,
    paid_by: data.paidBy,
    split_percent: data.splitPercent,
    paid: data.paid,
    category: data.category || 'אחר',
    child_id: data.childId || null,
    notes: data.notes || ''
  })).select().single();
  if (error) throw error;
  return mapExpense(row);
}

async function updateExpense(id, data) {
  let query = db().from('expenses').update({
    title: data.title,
    amount: data.amount,
    date: data.date,
    paid_by: data.paidBy,
    split_percent: data.splitPercent,
    paid: data.paid,
    category: data.category || 'אחר',
    child_id: data.childId || null,
    notes: data.notes || ''
  }).eq('id', id).eq('user_id', dbUserId);
  if (familyId) query = query.eq('family_id', familyId);
  const { error } = await query;
  if (error) throw error;
}

async function deleteExpense(id) {
  let query = db().from('expenses').delete().eq('id', id).eq('user_id', dbUserId);
  if (familyId) query = query.eq('family_id', familyId);
  const { error } = await query;
  if (error) throw error;
}

async function markExpensePaid(id) {
  let query = db().from('expenses').update({ paid: true }).eq('id', id).eq('user_id', dbUserId);
  if (familyId) query = query.eq('family_id', familyId);
  const { error } = await query;
  if (error) throw error;
}

async function createMessage(text, sender) {
  const { data: row, error } = await db().from('messages').insert(entityInsertPayload({ text, sender })).select().single();
  if (error) throw error;
  return mapMessage(row);
}

async function deleteAllUserData() {
  if (familyId) {
    await Promise.all([
      db().from('messages').delete().eq('family_id', familyId),
      db().from('expenses').delete().eq('family_id', familyId),
      db().from('events').delete().eq('family_id', familyId),
      db().from('children').delete().eq('family_id', familyId)
    ]);
    await db().from('family_settings').update({
      parent_a_name: 'הורה א',
      parent_b_name: 'הורה ב',
      custody_pattern: 'alternating-weeks',
      custody_start_date: new Date().toISOString().split('T')[0],
      week_schedule: { 0: 'a', 1: 'a', 2: 'a', 3: 'b', 4: 'b', 5: 'b', 6: 'b' }
    }).eq('family_id', familyId);
  } else {
    await Promise.all([
      db().from('messages').delete().eq('user_id', dbUserId),
      db().from('expenses').delete().eq('user_id', dbUserId),
      db().from('events').delete().eq('user_id', dbUserId),
      db().from('children').delete().eq('user_id', dbUserId)
    ]);
  }
}

async function importAppData(data) {
  await deleteAllUserData();
  await saveSettings(data.settings);
  for (const child of data.children || []) await createChild(child);
  for (const event of data.events || []) await createEvent(event);
  for (const expense of data.expenses || []) await createExpense(expense);
  for (const msg of data.messages || []) await createMessage(msg.text, msg.sender);
}

async function seedDemoDataToDb() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 5);

  await saveSettings({
    parentAName: 'דנה',
    parentBName: 'יוסי',
    currentParent: familyInfo?.myParentRole || 'a',
    custodyPattern: 'alternating-weeks',
    custodyStartDate: today.toISOString().split('T')[0],
    weekSchedule: { 0: 'a', 1: 'a', 2: 'a', 3: 'b', 4: 'b', 5: 'b', 6: 'b' }
  });

  const child1 = await createChild({ name: 'נועה', birthDate: '2016-03-15', school: 'בית ספר יסודי אילנות', allergies: 'אגוזים', notes: '' });
  const child2 = await createChild({ name: 'איתי', birthDate: '2019-07-22', school: 'גן חובה שקד', allergies: '', notes: '' });

  await createEvent({ title: 'רופא משפחה — נועה', date: tomorrow.toISOString().split('T')[0], time: '16:30', childId: child1.id, location: 'קופ"ח כללית', notes: 'בדיקה שנתית', createdBy: 'a' });
  await createEvent({ title: 'אספת הורים בבית הספר', date: nextWeek.toISOString().split('T')[0], time: '09:00', childId: child1.id, location: 'בית ספר יסודי', notes: '', createdBy: 'b' });
  await createExpense({ title: 'חוג שחייה — נועה', amount: 450, date: today.toISOString().split('T')[0], childId: child1.id, paidBy: 'a', splitPercent: 50, paid: false, category: 'חוגים', notes: '' });
  await createExpense({ title: 'תשלום גן — איתי', amount: 2800, date: today.toISOString().split('T')[0], childId: child2.id, paidBy: 'b', splitPercent: 50, paid: true, category: 'חינוך', notes: 'תשלום רבעוני' });
  await createMessage('היי, מחר יש לנועה רופא ב-16:30. תוכל/י לקחת?', 'a');
  await createMessage('בטח, אקח אותה. תשלח/י לי את הכתובת?', 'b');
}
