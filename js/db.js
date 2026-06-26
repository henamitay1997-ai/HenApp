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

function isConsentTablesMissingError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const details = (err.details || '').toLowerCase();
  const combined = `${msg} ${details}`;
  const mentionsConsent = combined.includes('consent_forms') || combined.includes('app_updates');
  if (!mentionsConsent) return false;
  if (['PGRST205', '42P01'].includes(err.code)) return true;
  return combined.includes('does not exist')
    || combined.includes('could not find')
    || combined.includes('schema cache')
    || combined.includes('not found in the schema');
}

function translateDbError(err) {
  const msg = err?.message || '';
  const details = err?.details || '';
  const combined = `${msg} ${details}`;
  if (combined.includes('parent_a_avatar') || combined.includes('parent_b_avatar') || combined.includes('avatar_url')) {
    return 'חסרות עמודות תמונה — הרץ/י ב-Supabase את AVATARS-ONLY.sql';
  }
  if (combined.includes('requires_approval') || combined.includes('approval_status') || combined.includes('agree_to_split')) {
    return 'חסרות עמודות אישור הוצאות — הרץ/י ב-Supabase את expense-approval.sql';
  }
  if (combined.includes('row-level security') || combined.includes('violates row-level security policy')) {
    if (combined.includes('consent_forms') || combined.includes('app_updates')) {
      return 'שגיאת הרשאות לטפסי אישור — הרץ/י ב-Supabase את fix-consent-tables.sql';
    }
    if (combined.includes('parent_notices')) {
      return 'שגיאת הרשאות לתזכורות — הרץ/י ב-Supabase את fix-parent-notices.sql';
    }
    return 'שגיאת הרשאות — הרץ/י ב-Supabase את RUN-NOW-EN.sql';
  }
  if (isConsentTablesMissingError(err)) {
    return 'טבלאות האישורים לא נטענו ב-API — הרץ/י consent-forms.sql ואז fix-consent-tables.sql, והמתין/י דקה';
  }
  if (combined.includes('consent_forms') || combined.includes('app_updates')) {
    return msg || 'שגיאה בשמירת טופס האישור';
  }
  if (combined.includes('id_number')) {
    return 'חסרה עמודת ת.ז. בפרופיל — הרץ/י ב-Supabase את consent-forms.sql';
  }
  if (isParentNoticesMissingError(err)) {
    return 'טבלת התזכורות לא נטענה — הרץ/י parent-notices.sql, המתין/י דקה, ורענני/י את האתר';
  }
  if (combined.includes('parent_notices')) {
    return msg || 'שגיאה בשמירת תזכורת';
  }
  if (isFamilyDbError(err)) {
    return 'בעיה בטבלאות משפחה — הרץ/י ב-Supabase את RUN-NOW-EN.sql';
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
    notes: row.notes || '',
    requiresApproval: !!row.requires_approval,
    approvalStatus: row.approval_status || 'approved',
    createdBy: row.created_by || row.paid_by || 'a',
    respondedBy: row.responded_by || null,
    agreeToSplit: row.agree_to_split !== false
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

function mapConsent(row) {
  return {
    id: row.id,
    formType: row.form_type || 'parental_activity',
    status: row.status || 'draft',
    documentCode: row.document_code,
    childId: row.child_id,
    institutionName: row.institution_name || '',
    activityDescription: row.activity_description || '',
    childFullName: row.child_full_name || '',
    childIdNumber: row.child_id_number || '',
    parentAName: row.parent_a_name || '',
    parentAIdNumber: row.parent_a_id_number || '',
    parentASignedAt: row.parent_a_signed_at,
    parentASignature: row.parent_a_signature,
    parentBName: row.parent_b_name || '',
    parentBIdNumber: row.parent_b_id_number || '',
    parentBSignedAt: row.parent_b_signed_at,
    parentBSignature: row.parent_b_signature,
    createdBy: row.created_by || 'a',
    sentToPartnerAt: row.sent_to_partner_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAppUpdate(row) {
  return {
    id: row.id,
    updateType: row.update_type || 'general',
    title: row.title,
    body: row.body || '',
    linkPage: row.link_page || 'updates',
    referenceId: row.reference_id,
    targetParentRole: row.target_parent_role,
    readByA: !!row.read_by_a,
    readByB: !!row.read_by_b,
    createdAt: row.created_at
  };
}

function mapParentNotice(row) {
  return {
    id: row.id,
    noticeType: row.notice_type || 'reminder',
    presetId: row.preset_id || '',
    title: row.title,
    description: row.description || '',
    date: row.date,
    time: row.time || '',
    childId: row.child_id || null,
    location: row.location || '',
    withPerson: row.with_person || '',
    createdBy: row.created_by || 'a',
    violatorRole: row.violator_role || null,
    requiresAck: row.requires_ack !== false,
    acknowledgedBy: row.acknowledged_by || null,
    acknowledgedAt: row.acknowledged_at,
    hasPenalty: !!row.has_penalty,
    penaltyAmount: row.penalty_amount != null ? Number(row.penalty_amount) : null,
    expenseId: row.expense_id || null,
    status: row.status || 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at
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
    const { data: profiles } = await db().from('profiles').select('id, full_name, email, id_number').in('id', userIds);
    (profiles || []).forEach(p => { profileMap[p.id] = p; });
  }

  const members = memberRows.map(m => {
    const profile = profileMap[m.user_id];
    return {
      userId: m.user_id,
      parentRole: m.parent_role,
      name: profile?.full_name || profile?.email?.split('@')[0] || 'הורה',
      email: profile?.email || '',
      idNumber: profile?.id_number || '',
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

async function loadMyProfile() {
  try {
    const { data, error } = await db().from('profiles').select('id_number').eq('id', dbUserId).maybeSingle();
    if (error) {
      if (`${error.message}`.includes('id_number')) return { idNumber: '' };
      throw error;
    }
    return { idNumber: data?.id_number || '' };
  } catch (err) {
    if (`${err?.message || ''}`.includes('id_number')) return { idNumber: '' };
    console.warn('Could not load profile', err);
    return { idNumber: '' };
  }
}

async function loadConsentAndUpdates(scopeField, scopeId) {
  const consentQuery = db().from('consent_forms').select('*').eq(scopeField, scopeId).order('created_at', { ascending: false });
  const updatesQuery = db().from('app_updates').select('*').eq(scopeField, scopeId).order('created_at', { ascending: false });
  const [consentsRes, updatesRes] = await Promise.all([consentQuery, updatesQuery]);

  if (consentsRes.error && !isConsentDbError(consentsRes.error)) throw consentsRes.error;
  if (updatesRes.error && !isConsentDbError(updatesRes.error)) throw updatesRes.error;

  return {
    consentForms: (consentsRes.error ? [] : consentsRes.data || []).map(mapConsent),
    updates: (updatesRes.error ? [] : updatesRes.data || []).map(mapAppUpdate)
  };
}

function isConsentDbError(err) {
  return isConsentTablesMissingError(err);
}

function isParentNoticesMissingError(err) {
  if (!err) return false;
  const combined = `${err?.message || ''} ${err?.details || ''}`.toLowerCase();
  if (!combined.includes('parent_notices')) return false;
  if (['PGRST205', '42P01'].includes(err.code)) return true;
  return combined.includes('does not exist') || combined.includes('schema cache') || combined.includes('could not find');
}

async function loadParentNotices(scopeField, scopeId) {
  const { data, error } = await db().from('parent_notices').select('*').eq(scopeField, scopeId).order('date', { ascending: false });
  if (error && isParentNoticesMissingError(error)) return [];
  if (error) throw error;
  return (data || []).map(mapParentNotice);
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

  const extra = await loadConsentAndUpdates('user_id', dbUserId);
  const myProfile = await loadMyProfile();
  const parentNotices = await loadParentNotices('user_id', dbUserId);

  return {
    family: null,
    settings: mapSettings(settingsRes.data, settingsRes.data?.current_parent),
    children: (childrenRes.data || []).map(mapChild),
    events: (eventsRes.data || []).map(mapEvent),
    expenses: (expensesRes.data || []).map(mapExpense),
    messages: (messagesRes.data || []).map(mapMessage),
    myProfile,
    parentNotices,
    ...extra
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
  const extra = await loadConsentAndUpdates('family_id', familyId);
  const myProfile = await loadMyProfile();
  const parentNotices = await loadParentNotices('family_id', familyId);

  return {
    family: familyInfo,
    settings: mapSettings(settingsRow, currentParent),
    children: children.map(mapChild),
    events: (eventsRes.data || []).map(mapEvent),
    expenses: (expensesRes.data || []).map(mapExpense),
    messages: (messagesRes.data || []).map(mapMessage),
    myProfile,
    parentNotices,
    ...extra
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
  const requiresApproval = !!data.requiresApproval;
  const rowPayload = {
    title: data.title,
    amount: data.amount,
    date: data.date,
    paid_by: data.paidBy,
    split_percent: data.splitPercent,
    paid: requiresApproval ? false : !!data.paid,
    category: data.category || 'אחר',
    child_id: data.childId || null,
    notes: data.notes || '',
    requires_approval: requiresApproval,
    approval_status: requiresApproval ? 'pending' : 'approved',
    created_by: data.createdBy || data.paidBy || 'a',
    agree_to_split: data.agreeToSplit !== false
  };
  const { data: row, error } = await db().from('expenses').insert(entityInsertPayload(rowPayload)).select().single();
  if (error) throw error;
  return mapExpense(row);
}

async function updateExpense(id, data) {
  const payload = {
    title: data.title,
    amount: data.amount,
    date: data.date,
    paid_by: data.paidBy,
    split_percent: data.splitPercent,
    paid: data.paid,
    category: data.category || 'אחר',
    child_id: data.childId || null,
    notes: data.notes || ''
  };
  if (data.requiresApproval != null) payload.requires_approval = !!data.requiresApproval;
  let query = db().from('expenses').update(payload).eq('id', id).eq('user_id', dbUserId);
  if (familyId) query = query.eq('family_id', familyId);
  const { error } = await query;
  if (error) throw error;
}

async function respondToExpense(id, { approvalStatus, agreeToSplit, splitPercent, respondedBy, paidBy }) {
  const payload = {
    approval_status: approvalStatus,
    responded_by: respondedBy,
    responded_at: new Date().toISOString(),
    agree_to_split: agreeToSplit !== false
  };
  if (splitPercent != null) payload.split_percent = splitPercent;
  if (approvalStatus === 'approved' && agreeToSplit === false && splitPercent == null && paidBy) {
    payload.split_percent = paidBy === 'a' ? 100 : 0;
  }
  let query = db().from('expenses').update(payload).eq('id', id);
  if (familyId) query = query.eq('family_id', familyId);
  else query = query.eq('user_id', dbUserId);
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
      db().from('children').delete().eq('family_id', familyId),
      db().from('parent_notices').delete().eq('family_id', familyId)
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

async function createConsentForm(data) {
  const myRole = data.createdBy || 'a';
  const rowPayload = {
    form_type: data.formType || 'parental_activity',
    status: 'draft',
    document_code: data.documentCode || `HBY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    child_id: data.childId || null,
    institution_name: data.institutionName || '',
    activity_description: data.activityDescription || '',
    child_full_name: data.childFullName || '',
    child_id_number: data.childIdNumber || '',
    parent_a_name: data.parentAName || '',
    parent_a_id_number: data.parentAIdNumber || '',
    parent_b_name: data.parentBName || '',
    parent_b_id_number: data.parentBIdNumber || '',
    created_by: myRole,
    updated_at: new Date().toISOString()
  };
  const { data: row, error } = await db().from('consent_forms').insert(entityInsertPayload(rowPayload)).select().single();
  if (error) throw error;
  return mapConsent(row);
}

async function updateConsentForm(id, data) {
  const payload = {
    institution_name: data.institutionName,
    activity_description: data.activityDescription,
    child_id: data.childId || null,
    child_full_name: data.childFullName,
    child_id_number: data.childIdNumber,
    parent_a_name: data.parentAName,
    parent_a_id_number: data.parentAIdNumber,
    parent_b_name: data.parentBName,
    parent_b_id_number: data.parentBIdNumber,
    status: data.status,
    updated_at: new Date().toISOString()
  };
  let query = db().from('consent_forms').update(payload).eq('id', id);
  if (familyId) query = query.eq('family_id', familyId);
  else query = query.eq('user_id', dbUserId);
  const { error } = await query;
  if (error) throw error;
}

async function signConsentForm(id, { parentRole, signature, idNumber, parentName }) {
  const prefix = parentRole === 'a' ? 'parent_a' : 'parent_b';
  const payload = {
    [`${prefix}_signature`]: signature,
    [`${prefix}_signed_at`]: new Date().toISOString(),
    [`${prefix}_id_number`]: idNumber || '',
    [`${prefix}_name`]: parentName || '',
    updated_at: new Date().toISOString()
  };

  let fetchQuery = db().from('consent_forms').select('*').eq('id', id);
  const { data: existing, error: fetchErr } = await fetchQuery.maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!existing) throw new Error('הטופס לא נמצא');

  const hasA = parentRole === 'a' ? true : !!existing.parent_a_signature;
  const hasB = parentRole === 'b' ? true : !!existing.parent_b_signature;
  payload.status = hasA && hasB ? 'completed' : 'pending_signature';

  let query = db().from('consent_forms').update(payload).eq('id', id);
  const { error } = await query;
  if (error) throw error;
}

async function markConsentSentToPartner(id) {
  const payload = {
    sent_to_partner_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  let query = db().from('consent_forms').update(payload).eq('id', id);
  if (familyId) query = query.eq('family_id', familyId);
  else query = query.eq('user_id', dbUserId);
  const { error } = await query;
  if (error) throw error;
}

async function deleteConsentForm(id) {
  let query = db().from('consent_forms').delete().eq('id', id);
  if (familyId) query = query.eq('family_id', familyId);
  else query = query.eq('user_id', dbUserId);
  const { error } = await query;
  if (error) throw error;
}

async function createAppUpdate(data) {
  const rowPayload = {
    update_type: data.updateType || 'general',
    title: data.title,
    body: data.body || '',
    link_page: data.linkPage || 'updates',
    reference_id: data.referenceId || null,
    target_parent_role: data.targetParentRole || null,
    read_by_a: false,
    read_by_b: false
  };
  const { data: row, error } = await db().from('app_updates').insert(entityInsertPayload(rowPayload)).select().single();
  if (error) throw error;
  return mapAppUpdate(row);
}

async function markAppUpdateRead(id, parentRole) {
  const field = parentRole === 'a' ? 'read_by_a' : 'read_by_b';
  let query = db().from('app_updates').update({ [field]: true }).eq('id', id);
  if (familyId) query = query.eq('family_id', familyId);
  else query = query.eq('user_id', dbUserId);
  const { error } = await query;
  if (error) throw error;
}

async function saveProfileIdNumber(idNumber) {
  const value = (idNumber || '').trim() || null;
  const { error } = await db().from('profiles').update({ id_number: value }).eq('id', dbUserId);
  if (error) throw error;
}

async function createParentNotice(data) {
  const rowPayload = {
    notice_type: data.noticeType || 'reminder',
    preset_id: data.presetId || null,
    title: data.title,
    description: data.description || '',
    date: data.date,
    time: data.time || null,
    child_id: data.childId || null,
    location: data.location || '',
    with_person: data.withPerson || '',
    created_by: data.createdBy || 'a',
    violator_role: data.violatorRole || null,
    requires_ack: data.requiresAck !== false,
    has_penalty: !!data.hasPenalty,
    penalty_amount: data.hasPenalty && data.penaltyAmount ? data.penaltyAmount : null,
    expense_id: data.expenseId || null,
    status: 'active',
    updated_at: new Date().toISOString()
  };
  const { data: row, error } = await db().from('parent_notices').insert(entityInsertPayload(rowPayload)).select().single();
  if (error) throw error;
  return mapParentNotice(row);
}

async function updateParentNotice(id, data) {
  const payload = {
    notice_type: data.noticeType,
    preset_id: data.presetId || null,
    title: data.title,
    description: data.description || '',
    date: data.date,
    time: data.time || null,
    child_id: data.childId || null,
    location: data.location || '',
    with_person: data.withPerson || '',
    violator_role: data.violatorRole || null,
    requires_ack: data.requiresAck !== false,
    has_penalty: !!data.hasPenalty,
    penalty_amount: data.hasPenalty && data.penaltyAmount ? data.penaltyAmount : null,
    expense_id: data.expenseId || null,
    updated_at: new Date().toISOString()
  };
  let query = db().from('parent_notices').update(payload).eq('id', id);
  if (familyId) query = query.eq('family_id', familyId);
  else query = query.eq('user_id', dbUserId);
  const { error } = await query;
  if (error) throw error;
}

async function acknowledgeParentNotice(id, parentRole) {
  const payload = {
    acknowledged_by: parentRole,
    acknowledged_at: new Date().toISOString(),
    status: 'acknowledged',
    updated_at: new Date().toISOString()
  };
  let query = db().from('parent_notices').update(payload).eq('id', id);
  if (familyId) query = query.eq('family_id', familyId);
  else query = query.eq('user_id', dbUserId);
  const { error } = await query;
  if (error) throw error;
}

async function linkNoticeExpense(noticeId, expenseId) {
  let query = db().from('parent_notices').update({ expense_id: expenseId, updated_at: new Date().toISOString() }).eq('id', noticeId);
  if (familyId) query = query.eq('family_id', familyId);
  else query = query.eq('user_id', dbUserId);
  const { error } = await query;
  if (error) throw error;
}

async function deleteParentNotice(id) {
  let query = db().from('parent_notices').delete().eq('id', id);
  if (familyId) query = query.eq('family_id', familyId);
  else query = query.eq('user_id', dbUserId);
  const { error } = await query;
  if (error) throw error;
}
