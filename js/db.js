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
  if (msg.includes('family_settings')) return 'חסרות טבלאות משפחה — הרץ/י את family-migration.sql ב-Supabase';
  if (msg.includes('ensure_user_family')) return 'חסרה פונקציית משפחה — הרץ/י את family-migration.sql ב-Supabase';
  if (msg.includes('row-level security') || msg.includes('RLS')) return 'שגיאת הרשאות — הרץ/י את fix-data.sql ב-Supabase';
  if (msg.includes('JWT')) return 'פג תוקף ההתחברות — התחבר/י מחדש';
  return msg || 'שגיאה בשמירה';
}

function normalizeWeekSchedule(schedule) {
  const defaults = { 0: 'a', 1: 'a', 2: 'a', 3: 'b', 4: 'b', 5: 'b', 6: 'b' };
  if (!schedule || typeof schedule !== 'object') return { ...defaults };
  const result = { ...defaults };
  Object.entries(schedule).forEach(([key, value]) => {
    result[parseInt(key, 10)] = value;
  });
  return result;
}

function mapSettings(row, currentParent) {
  if (!row) return structuredClone(DEFAULT_DATA.settings);
  return {
    parentAName: row.parent_a_name,
    parentBName: row.parent_b_name,
    currentParent: currentParent || row.current_parent || 'a',
    custodyPattern: row.custody_pattern,
    custodyStartDate: row.custody_start_date,
    weekSchedule: normalizeWeekSchedule(row.week_schedule)
  };
}

function mapChild(row) {
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date || '',
    school: row.school || '',
    allergies: row.allergies || '',
    notes: row.notes || ''
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
    await db().from('family_settings').insert({ family_id: familyId });
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

  const settingsRow = settingsRes.data || (await db().from('family_settings').select('*').eq('family_id', familyId).single()).data;

  return {
    family: familyInfo,
    settings: mapSettings(settingsRow, currentParent),
    children: (childrenRes.data || []).map(mapChild),
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
  return loadFamilyAppData();
}

async function saveSettings(settings) {
  if (useLegacyMode || !familyId) {
    const { error } = await db().from('user_settings').upsert({
      user_id: dbUserId,
      parent_a_name: settings.parentAName,
      parent_b_name: settings.parentBName,
      current_parent: settings.currentParent,
      custody_pattern: settings.custodyPattern,
      custody_start_date: settings.custodyStartDate,
      week_schedule: settings.weekSchedule,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    return;
  }

  const { error: settingsErr } = await db().from('family_settings').update({
    parent_a_name: settings.parentAName,
    parent_b_name: settings.parentBName,
    custody_pattern: settings.custodyPattern,
    custody_start_date: settings.custodyStartDate,
    week_schedule: settings.weekSchedule,
    updated_at: new Date().toISOString()
  }).eq('family_id', familyId);
  if (settingsErr) throw settingsErr;

  const { error: prefsErr } = await db().from('user_family_prefs').upsert({
    user_id: dbUserId,
    family_id: familyId,
    current_parent: settings.currentParent
  });
  if (prefsErr) throw prefsErr;
}

async function joinFamilyByCode(code) {
  const { data, error } = await db().rpc('join_family_by_code', { p_invite_code: code });
  if (error) throw error;
  familyId = data.family_id;
  useLegacyMode = false;
  await tryLoadFamilyContext();
  return data;
}

function childInsertPayload(data) {
  const payload = {
    user_id: dbUserId,
    name: data.name,
    birth_date: data.birthDate || null,
    school: data.school || '',
    allergies: data.allergies || '',
    notes: data.notes || ''
  };
  if (familyId) payload.family_id = familyId;
  return payload;
}

async function createChild(data) {
  const { data: row, error } = await db().from('children').insert(childInsertPayload(data)).select().single();
  if (error) throw error;
  return mapChild(row);
}

async function updateChild(id, data) {
  let query = db().from('children').update({
    name: data.name,
    birth_date: data.birthDate || null,
    school: data.school || '',
    allergies: data.allergies || '',
    notes: data.notes || ''
  }).eq('id', id).eq('user_id', dbUserId);
  if (familyId) query = query.eq('family_id', familyId);
  const { error } = await query;
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
