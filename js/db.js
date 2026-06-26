let dbUserId = null;

function setDbUser(userId) {
  dbUserId = userId;
}

function getDbUser() {
  return dbUserId;
}

function db() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase לא מחובר');
  return client;
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

function mapSettings(row) {
  if (!row) {
    return structuredClone(DEFAULT_DATA.settings);
  }
  return {
    parentAName: row.parent_a_name,
    parentBName: row.parent_b_name,
    currentParent: row.current_parent,
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

async function ensureUserData(userId) {
  setDbUser(userId);
  const { data: settings } = await db()
    .from('user_settings')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!settings) {
    const { error } = await db().from('user_settings').insert({ user_id: userId });
    if (error) throw error;
  }
}

async function loadAppData() {
  if (!dbUserId) throw new Error('משתמש לא מחובר');

  const [settingsRes, childrenRes, eventsRes, expensesRes, messagesRes] = await Promise.all([
    db().from('user_settings').select('*').eq('user_id', dbUserId).single(),
    db().from('children').select('*').eq('user_id', dbUserId).order('created_at'),
    db().from('events').select('*').eq('user_id', dbUserId).order('date'),
    db().from('expenses').select('*').eq('user_id', dbUserId).order('date', { ascending: false }),
    db().from('messages').select('*').eq('user_id', dbUserId).order('created_at')
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (childrenRes.error) throw childrenRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (expensesRes.error) throw expensesRes.error;
  if (messagesRes.error) throw messagesRes.error;

  return {
    settings: mapSettings(settingsRes.data),
    children: (childrenRes.data || []).map(mapChild),
    events: (eventsRes.data || []).map(mapEvent),
    expenses: (expensesRes.data || []).map(mapExpense),
    messages: (messagesRes.data || []).map(mapMessage)
  };
}

async function saveSettings(settings) {
  const { error } = await db().from('user_settings').update({
    parent_a_name: settings.parentAName,
    parent_b_name: settings.parentBName,
    current_parent: settings.currentParent,
    custody_pattern: settings.custodyPattern,
    custody_start_date: settings.custodyStartDate,
    week_schedule: settings.weekSchedule,
    updated_at: new Date().toISOString()
  }).eq('user_id', dbUserId);
  if (error) throw error;
}

async function createChild(data) {
  const { data: row, error } = await db().from('children').insert({
    user_id: dbUserId,
    name: data.name,
    birth_date: data.birthDate || null,
    school: data.school || '',
    allergies: data.allergies || '',
    notes: data.notes || ''
  }).select().single();
  if (error) throw error;
  return mapChild(row);
}

async function updateChild(id, data) {
  const { error } = await db().from('children').update({
    name: data.name,
    birth_date: data.birthDate || null,
    school: data.school || '',
    allergies: data.allergies || '',
    notes: data.notes || ''
  }).eq('id', id).eq('user_id', dbUserId);
  if (error) throw error;
}

async function deleteChild(id) {
  const { error } = await db().from('children').delete().eq('id', id).eq('user_id', dbUserId);
  if (error) throw error;
}

async function createEvent(data) {
  const { data: row, error } = await db().from('events').insert({
    user_id: dbUserId,
    title: data.title,
    date: data.date,
    time: data.time || '',
    child_id: data.childId || null,
    location: data.location || '',
    notes: data.notes || '',
    created_by: data.createdBy
  }).select().single();
  if (error) throw error;
  return mapEvent(row);
}

async function updateEvent(id, data) {
  const { error } = await db().from('events').update({
    title: data.title,
    date: data.date,
    time: data.time || '',
    child_id: data.childId || null,
    location: data.location || '',
    notes: data.notes || ''
  }).eq('id', id).eq('user_id', dbUserId);
  if (error) throw error;
}

async function deleteEvent(id) {
  const { error } = await db().from('events').delete().eq('id', id).eq('user_id', dbUserId);
  if (error) throw error;
}

async function createExpense(data) {
  const { data: row, error } = await db().from('expenses').insert({
    user_id: dbUserId,
    title: data.title,
    amount: data.amount,
    date: data.date,
    paid_by: data.paidBy,
    split_percent: data.splitPercent,
    paid: data.paid,
    category: data.category || 'אחר',
    child_id: data.childId || null,
    notes: data.notes || ''
  }).select().single();
  if (error) throw error;
  return mapExpense(row);
}

async function updateExpense(id, data) {
  const { error } = await db().from('expenses').update({
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
  if (error) throw error;
}

async function deleteExpense(id) {
  const { error } = await db().from('expenses').delete().eq('id', id).eq('user_id', dbUserId);
  if (error) throw error;
}

async function markExpensePaid(id) {
  const { error } = await db().from('expenses').update({ paid: true })
    .eq('id', id).eq('user_id', dbUserId);
  if (error) throw error;
}

async function createMessage(text, sender) {
  const { data: row, error } = await db().from('messages').insert({
    user_id: dbUserId,
    text,
    sender
  }).select().single();
  if (error) throw error;
  return mapMessage(row);
}

async function deleteAllUserData() {
  await Promise.all([
    db().from('messages').delete().eq('user_id', dbUserId),
    db().from('expenses').delete().eq('user_id', dbUserId),
    db().from('events').delete().eq('user_id', dbUserId),
    db().from('children').delete().eq('user_id', dbUserId)
  ]);
  await db().from('user_settings').update({
    parent_a_name: 'הורה א',
    parent_b_name: 'הורה ב',
    current_parent: 'a',
    custody_pattern: 'alternating-weeks',
    custody_start_date: new Date().toISOString().split('T')[0],
    week_schedule: { 0: 'a', 1: 'a', 2: 'a', 3: 'b', 4: 'b', 5: 'b', 6: 'b' }
  }).eq('user_id', dbUserId);
}

async function importAppData(data) {
  await deleteAllUserData();
  await saveSettings(data.settings);

  for (const child of data.children || []) {
    await createChild(child);
  }
  for (const event of data.events || []) {
    await createEvent(event);
  }
  for (const expense of data.expenses || []) {
    await createExpense(expense);
  }
  for (const msg of data.messages || []) {
    await createMessage(msg.text, msg.sender);
  }
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
    currentParent: 'a',
    custodyPattern: 'alternating-weeks',
    custodyStartDate: today.toISOString().split('T')[0],
    weekSchedule: { 0: 'a', 1: 'a', 2: 'a', 3: 'b', 4: 'b', 5: 'b', 6: 'b' }
  });

  const child1 = await createChild({ name: 'נועה', birthDate: '2016-03-15', school: 'בית ספר יסודי אילנות', allergies: 'אגוזים', notes: '' });
  const child2 = await createChild({ name: 'איתי', birthDate: '2019-07-22', school: 'גן חובה שקד', allergies: '', notes: '' });

  await createEvent({
    title: 'רופא משפחה — נועה',
    date: tomorrow.toISOString().split('T')[0],
    time: '16:30',
    childId: child1.id,
    location: 'קופ"ח כללית',
    notes: 'בדיקה שנתית',
    createdBy: 'a'
  });

  await createEvent({
    title: 'אספת הורים בבית הספר',
    date: nextWeek.toISOString().split('T')[0],
    time: '09:00',
    childId: child1.id,
    location: 'בית ספר יסודי',
    notes: '',
    createdBy: 'b'
  });

  await createExpense({
    title: 'חוג שחייה — נועה',
    amount: 450,
    date: today.toISOString().split('T')[0],
    childId: child1.id,
    paidBy: 'a',
    splitPercent: 50,
    paid: false,
    category: 'חוגים',
    notes: ''
  });

  await createExpense({
    title: 'תשלום גן — איתי',
    amount: 2800,
    date: today.toISOString().split('T')[0],
    childId: child2.id,
    paidBy: 'b',
    splitPercent: 50,
    paid: true,
    category: 'חינוך',
    notes: 'תשלום רבעוני'
  });

  await createMessage('היי, מחר יש לנועה רופא ב-16:30. תוכל/י לקחת?', 'a');
  await createMessage('בטח, אקח אותה. תשלח/י לי את הכתובת?', 'b');
}
