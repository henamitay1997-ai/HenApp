const CONSENT_GUIDE_SECTIONS = [
  {
    title: 'הסכמה הורית משותפת',
    body: 'יצרנו עבורכם כלי פשוט ומכובד להסדרת ההסכמות ההוריות הנדרשות לרישום הילד/ה לפעילויות (חוגים, קייטנות, טיפולים וכו\'), בצורה המקצועית והבטוחה ביותר.'
  },
  {
    title: 'איך זה עובד?',
    items: [
      'מילוי פרטים: ההורה היוזם ממלא את פרטי הילד/ה ואת מהות ההרשמה.',
      'חתימה משותפת: המערכת מאפשרת לשני ההורים לחתום בנפרד ובאופן דיגיטלי. לאחר חתימת ההורה הראשון, יישלח קישור מאובטח להורה השני לצורך מתן הסכמתו.',
      'הפקת אישור: עם השלמת שתי החתימות, יופק מסמך רשמי המהווה אסמכתא להסכמת שני ההורים.'
    ]
  },
  {
    title: 'למה חשוב להשתמש בטופס הזה?',
    items: [
      'בהירות מול המוסד: קייטנות, חוגים ומוסדות שונים מחויבים לוודא כי ישנה הסכמה של שני ההורים. טופס זה מספק להם את השקט הנפשי והכיסוי שהם צריכים, מה שמונע עיכובים מיותרים ברישום.',
      'אחריות הורית: בחתימתכם, אתם מצהירים על הסכמתכם המשותפת. הצהרה זו משקפת אחריות ובוגרות, ומסייעת למוסד לפעול ללא חשש.',
      'תיעוד: הטופס כולל חתימה דיגיטלית עם חותמת זמן ומזהה ייחודי, המבטיחים כי המסמך קביל ומהימן לכל צורך.'
    ]
  },
  {
    title: 'הנחיות חשובות לפני החתימה:',
    items: [
      'וודאו פרטים: אנא בדקו כי פרטי הילד/ה והפעילות מולאו במדויק.',
      'הסכמה מקדימה: מומלץ לנהל שיח ביניכם כהורים על מהות הפעילות, כדי להבטיח ששניכם חותמים מתוך הבנה והסכמה מלאה.',
      'צירוף מסמכים: בעת הגשת הטופס למוסד, מומלץ לצרף צילום תעודת זהות של ההורה החותם. זהו הסטנדרט המקובל ש"פותח דלתות" ומייתר שאלות נוספות.'
    ]
  },
  {
    title: 'הבהרה',
    body: 'טופס זה נועד להסדיר את היחסים מול הספק הפרטי (החוג/הקייטנה). במקרה של מחלוקת משפטית מהותית, טופס זה אינו מחליף החלטות שיפוטיות, אך הוא מהווה הצהרת כוונות ברורה ורשמית מצד שני ההורים.',
    isDisclaimer: true
  }
];

let activeSignaturePad = null;

function getConsentDocumentCode() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `HBY-${ymd}-${rand}`;
}

function getPartnerParentRole(myRole) {
  return myRole === 'a' ? 'b' : 'a';
}

function getFamilyMemberByRole(data, role) {
  return (data.family?.members || []).find(m => m.parentRole === role) || null;
}

function getMyProfileIdNumber(data) {
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const me = getFamilyMemberByRole(data, myRole);
  return me?.idNumber || '';
}

function consentHasSignature(consent, role) {
  return role === 'a' ? !!consent.parentASignature : !!consent.parentBSignature;
}

function getConsentStatusLabel(consent) {
  if (consent.status === 'completed') return 'הושלם — שתי חתימות';
  if (consent.status === 'pending_signature') return 'ממתין לחתימת ההורה השני';
  return 'טיוטה';
}

function getConsentStatusClass(consent) {
  if (consent.status === 'completed') return 'badge-success';
  if (consent.status === 'pending_signature') return 'badge-warning';
  return 'badge-secondary';
}

function canSignConsent(consent, myRole) {
  if (consent.status === 'completed') return false;
  return !consentHasSignature(consent, myRole);
}

function needsMySignature(consent, myRole) {
  return consent.status === 'pending_signature' && !consentHasSignature(consent, myRole);
}

function getUnreadUpdatesCount(data, myRole) {
  return (data.updates || []).filter(u => {
    if (u.targetParentRole && u.targetParentRole !== myRole) return false;
    return myRole === 'a' ? !u.readByA : !u.readByB;
  }).length;
}

function renderConsentGuideHtml() {
  return `
    <div class="consent-guide card">
      <div class="card-header">
        <div class="card-title">📋 מדריך — הסכמה הורית משותפת</div>
      </div>
      <div class="consent-guide-body">
        ${CONSENT_GUIDE_SECTIONS.map(section => `
          <section class="consent-guide-section ${section.isDisclaimer ? 'is-disclaimer' : ''}">
            <h3>${section.title}</h3>
            ${section.body ? `<p>${section.body}</p>` : ''}
            ${section.items ? `<ul>${section.items.map(item => `<li>${item}</li>`).join('')}</ul>` : ''}
          </section>
        `).join('')}
      </div>
    </div>
  `;
}

function renderConsentApprovalsPage(data) {
  const consents = (data.consentForms || []).filter(c => c.formType === 'parental_activity');
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const pendingMine = consents.filter(c => needsMySignature(c, myRole));

  return `
    ${renderConsentGuideHtml()}

    ${pendingMine.length ? `
      <div class="card expense-approval-card" style="margin-top:1.25rem">
        <div class="card-header">
          <div>
            <div class="card-title">✍️ ממתין לחתימתך (${pendingMine.length})</div>
            <div class="card-subtitle">ההורה השני שלח/ה בקשה לחתימה על טופס הסכמה</div>
          </div>
        </div>
        <ul class="consent-pending-list">
          ${pendingMine.map(c => `
            <li class="consent-pending-row">
              <div>
                <strong>${escapeHtml(c.childFullName || 'ילד/ה')}</strong>
                <div class="consent-meta">${escapeHtml(c.institutionName)} · ${escapeHtml(c.activityDescription)}</div>
              </div>
              <button class="btn btn-sm btn-primary" data-action="open-consent" data-id="${c.id}">חתימה עכשיו</button>
            </li>
          `).join('')}
        </ul>
      </div>
    ` : ''}

    <div class="section-header" style="margin-top:1.25rem">
      <h2>טפסי הסכמה</h2>
      <button class="btn btn-primary" data-action="new-consent">+ טופס הסכמה הורית משותפת</button>
    </div>

    ${!data.family?.hasPartner ? `
      <div class="card consent-partner-hint">
        <p>💡 לחתימה משותפת של שני ההורים, הזמינ/י את ההורה השני למשפחה בהגדרות (קוד הצטרפות).</p>
      </div>
    ` : ''}

    ${consents.length === 0 ? `
      <div class="card">${renderEmptyState('✍️', 'אין טפסים עדיין', 'צרו טופס הסכמה הורית משותפת לחוגים, קייטנות ורישום למוסדות', 'טופס חדש', 'new-consent')}</div>
    ` : `
      <div class="card">
        <ul class="consent-list">
          ${consents.map(c => `
            <li class="consent-list-row">
              <div class="consent-list-main">
                <div class="consent-list-title">${escapeHtml(c.childFullName)} — ${escapeHtml(c.institutionName)}</div>
                <div class="consent-meta">${escapeHtml(c.activityDescription)} · ${formatDate(c.createdAt?.slice(0, 10) || '')}</div>
                <div class="consent-meta">מזהה מסמך: <code>${escapeHtml(c.documentCode)}</code></div>
              </div>
              <span class="badge ${getConsentStatusClass(c)}">${getConsentStatusLabel(c)}</span>
              <div class="consent-list-actions">
                <button class="btn btn-sm btn-secondary" data-action="open-consent" data-id="${c.id}">פתח</button>
                ${c.status === 'completed' ? `<button class="btn btn-sm btn-primary" data-action="download-consent-pdf" data-id="${c.id}">📄 PDF</button>` : ''}
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    `}
  `;
}

function renderConsentFormModalHtml(data, consent) {
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const isNew = !consent;
  const c = consent || {};
  const childOptions = data.children.map(ch =>
    `<option value="${ch.id}" ${c.childId === ch.id ? 'selected' : ''}>${escapeHtml(ch.name)}</option>`
  ).join('');

  const parentAName = c.parentAName || getParentName(data, 'a');
  const parentBName = c.parentBName || getParentName(data, 'b');
  const signedA = consentHasSignature(c, 'a');
  const signedB = consentHasSignature(c, 'b');
  const canSign = consent && canSignConsent(c, myRole);
  const myParentKey = myRole === 'a' ? 'a' : 'b';

  return `
    <form id="consent-form" class="consent-form">
      <div class="consent-form-doc-title">
        <h3>טופס הסכמה הורית משותפת לפעילות</h3>
        <p class="consent-form-sub">(מוגש ל: <span class="fill-line">${escapeHtml(c.institutionName || 'שם המוסד/הקייטנה')}</span>)</p>
        ${c.documentCode ? `<p class="consent-doc-code">מזהה מסמך: <strong>${escapeHtml(c.documentCode)}</strong></p>` : ''}
      </div>

      <div class="form-group">
        <label class="form-label">שם המוסד / קייטנה / חוג *</label>
        <input class="form-input" name="institutionName" required value="${escapeHtml(c.institutionName || '')}" ${!isNew && c.status !== 'draft' ? 'readonly' : ''}>
      </div>
      <div class="form-group">
        <label class="form-label">מהות הפעילות / ההרשמה *</label>
        <input class="form-input" name="activityDescription" required placeholder="לדוגמה: חוג שחייה, קייטנת קיץ 2026" value="${escapeHtml(c.activityDescription || '')}" ${!isNew && c.status !== 'draft' ? 'readonly' : ''}>
      </div>

      <fieldset class="consent-fieldset">
        <legend>פרטי הילד/ה</legend>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">בחירת ילד/ה מהרשימה</label>
            <select class="form-select" name="childId" id="consent-child-select" ${!isNew && c.status !== 'draft' ? 'disabled' : ''}>
              <option value="">— מילוי ידני —</option>
              ${childOptions}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">שם מלא *</label>
            <input class="form-input" name="childFullName" required value="${escapeHtml(c.childFullName || '')}" ${!isNew && c.status !== 'draft' ? 'readonly' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">ת.ז. *</label>
            <input class="form-input" name="childIdNumber" required inputmode="numeric" value="${escapeHtml(c.childIdNumber || '')}" ${!isNew && c.status !== 'draft' ? 'readonly' : ''}>
          </div>
        </div>
      </fieldset>

      <fieldset class="consent-fieldset">
        <legend>חלק א׳: הצהרת ${escapeHtml(parentAName)}</legend>
        <p class="consent-declaration">אני, <strong>${escapeHtml(parentAName)}</strong>, ת.ז. <strong>${escapeHtml(c.parentAIdNumber || '________')}</strong>, מצהיר/ה כי אני אפוטרופוס חוקי של הילד/ה, ומאשר/ת את רישומו/ה לפעילות המדוברת.</p>
        ${signedA ? `
          <div class="consent-signed-block">
            <img src="${c.parentASignature}" alt="חתימה" class="consent-signature-img">
            <div class="consent-meta">נחתם: ${formatDateTime(c.parentASignedAt)}</div>
          </div>
        ` : myRole === 'a' && canSign ? `
          <div class="form-group">
            <label class="form-label">ת.ז. הורה א׳</label>
            <input class="form-input" name="parentAIdNumber" value="${escapeHtml(c.parentAIdNumber || getMyProfileIdNumber(data))}">
          </div>
          <div class="signature-pad-wrap">
            <label class="form-label">חתימה דיגיטלית</label>
            <canvas id="signature-canvas" class="signature-canvas" width="400" height="140"></canvas>
            <button type="button" class="btn btn-sm btn-secondary" data-action="clear-signature">נקה חתימה</button>
          </div>
        ` : '<p class="consent-waiting">ממתין לחתימה</p>'}
      </fieldset>

      <fieldset class="consent-fieldset">
        <legend>חלק ב׳: הצהרת ${escapeHtml(parentBName)}</legend>
        <p class="consent-declaration">אני, <strong>${escapeHtml(parentBName)}</strong>, ת.ז. <strong>${escapeHtml(c.parentBIdNumber || '________')}</strong>, מצהיר/ה כי אני אפוטרופוס חוקי של הילד/ה, ומאשר/ת את רישומו/ה לפעילות המדוברת.</p>
        ${signedB ? `
          <div class="consent-signed-block">
            <img src="${c.parentBSignature}" alt="חתימה" class="consent-signature-img">
            <div class="consent-meta">נחתם: ${formatDateTime(c.parentBSignedAt)}</div>
          </div>
        ` : myRole === 'b' && canSign ? `
          <div class="form-group">
            <label class="form-label">ת.ז. הורה ב׳</label>
            <input class="form-input" name="parentBIdNumber" value="${escapeHtml(c.parentBIdNumber || getMyProfileIdNumber(data))}">
          </div>
          <div class="signature-pad-wrap">
            <label class="form-label">חתימה דיגיטלית</label>
            <canvas id="signature-canvas" class="signature-canvas" width="400" height="140"></canvas>
            <button type="button" class="btn btn-sm btn-secondary" data-action="clear-signature">נקה חתימה</button>
          </div>
        ` : '<p class="consent-waiting">ממתין לחתימה</p>'}
      </fieldset>

      <fieldset class="consent-fieldset consent-indemnity">
        <legend>חלק ג׳: הצהרת הסכמה משותפת (שיפוי)</legend>
        <p class="consent-declaration">שנינו, ההורים החתומים מטה, מצהירים כי הגענו להסכמה משותפת בנוגע לרישום הילד/ה. ידוע לנו כי מוסד זה מסתמך על חתימותינו אלו, ואנו מתחייבים לשפות את המוסד בגין כל טענה שתעלה כנגד הרישום, ככל ותעלה.</p>
        ${c.status === 'completed' ? '<p class="consent-completed-note">✅ שתי החתימות הושלמו — ניתן להוריד PDF</p>' : ''}
      </fieldset>
    </form>
  `;
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function initSignaturePad(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let drawing = false;
  let hasStroke = false;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    hasStroke = true;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() { drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  const pad = {
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasStroke = false;
    },
    isEmpty() { return !hasStroke; },
    toDataUrl() { return canvas.toDataURL('image/png'); }
  };

  activeSignaturePad = pad;
  return pad;
}

function destroySignaturePad() {
  activeSignaturePad = null;
}

function getConsentFormPdfHtml(data, consent) {
  const generatedAt = new Date().toLocaleString('he-IL');
  const sigA = consent.parentASignature
    ? `<img src="${consent.parentASignature}" style="max-height:60px;max-width:180px" alt="חתימה א">`
    : '____________';
  const sigB = consent.parentBSignature
    ? `<img src="${consent.parentBSignature}" style="max-height:60px;max-width:180px" alt="חתימה ב">`
    : '____________';

  return `
    <div id="consent-pdf-root" dir="rtl" style="font-family:'Heebo',Arial,sans-serif;color:#1a2332;padding:24px;background:#fff;line-height:1.6">
      <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #e2e8f0;padding-bottom:12px">
        <div style="font-size:12px;color:#64748b">הורים ביחד — הסכמה הורית משותפת</div>
        <h1 style="margin:8px 0;font-size:20px">טופס הסכמה הורית משותפת לפעילות</h1>
        <div style="font-size:12px;color:#64748b">מוגש ל: ${escapeHtml(consent.institutionName)}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px">מזהה: ${escapeHtml(consent.documentCode)} | הופק: ${escapeHtml(generatedAt)}</div>
      </div>

      <p><strong>מהות הפעילות:</strong> ${escapeHtml(consent.activityDescription)}</p>

      <h3 style="font-size:14px;margin:16px 0 8px">פרטי הילד/ה</h3>
      <p>שם מלא: <strong>${escapeHtml(consent.childFullName)}</strong> &nbsp; ת.ז.: <strong>${escapeHtml(consent.childIdNumber)}</strong></p>

      <h3 style="font-size:14px;margin:16px 0 8px">חלק א׳ — ${escapeHtml(consent.parentAName)}</h3>
      <p style="font-size:13px">אני, ${escapeHtml(consent.parentAName)}, ת.ז. ${escapeHtml(consent.parentAIdNumber)}, מצהיר/ה כי אני אפוטרופוס חוקי של הילד/ה, ומאשר/ת את רישומו/ה לפעילות המדוברת.</p>
      <p>חתימה: ${sigA} &nbsp; תאריך: ${consent.parentASignedAt ? escapeHtml(formatDateTime(consent.parentASignedAt)) : '____'}</p>

      <h3 style="font-size:14px;margin:16px 0 8px">חלק ב׳ — ${escapeHtml(consent.parentBName)}</h3>
      <p style="font-size:13px">אני, ${escapeHtml(consent.parentBName)}, ת.ז. ${escapeHtml(consent.parentBIdNumber)}, מצהיר/ה כי אני אפוטרופוס חוקי של הילד/ה, ומאשר/ת את רישומו/ה לפעילות המדוברת.</p>
      <p>חתימה: ${sigB} &nbsp; תאריך: ${consent.parentBSignedAt ? escapeHtml(formatDateTime(consent.parentBSignedAt)) : '____'}</p>

      <h3 style="font-size:14px;margin:16px 0 8px">חלק ג׳ — הצהרת הסכמה משותפת (שיפוי)</h3>
      <p style="font-size:13px">שנינו, ההורים החתומים מטה, מצהירים כי הגענו להסכמה משותפת בנוגע לרישום הילד/ה. ידוע לנו כי מוסד זה מסתמך על חתימותינו אלו, ואנו מתחייבים לשפות את המוסד בגין כל טענה שתעלה כנגד הרישום, ככל ותעלה.</p>

      <div style="margin-top:24px;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;color:#64748b">
        מסמך דיגיטלי עם חותמת זמן ומזהה ייחודי. טופס זה נועד להסדיר את היחסים מול הספק הפרטי ואינו מחליף החלטות שיפוטיות.
      </div>
    </div>
  `;
}

async function downloadConsentPdf(data, consent) {
  await loadHtml2Pdf();
  const html = getConsentFormPdfHtml(data, consent);
  const wrap = document.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.left = '-9999px';
  wrap.innerHTML = html;
  document.body.appendChild(wrap);
  const el = wrap.querySelector('#consent-pdf-root');
  const filename = `הסכמה-הורית-${consent.childFullName || 'ילד'}-${consent.documentCode}.pdf`;
  try {
    await html2pdf().set({
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(el).save();
  } finally {
    wrap.remove();
  }
}

function getConsentDeepLink(consentId) {
  const base = window.location.origin + window.location.pathname;
  return `${base}#approvals&consent=${consentId}`;
}

function renderUpdatesPage(data) {
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const updates = [...(data.updates || [])].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  const visible = updates.filter(u => !u.targetParentRole || u.targetParentRole === myRole);

  return `
    <div class="section-header">
      <h2>עדכונים</h2>
    </div>
    <p class="page-intro">הודעות, בקשות חתימה, אישורי הוצאות ועדכונים נוספים מההורה השני.</p>

    ${visible.length === 0 ? `
      <div class="card">${renderEmptyState('🔔', 'אין עדכונים', 'כשההורה השני ישלח בקשה לחתימה או עדכון — זה יופיע כאן')}</div>
    ` : `
      <ul class="updates-feed">
        ${visible.map(u => {
          const unread = myRole === 'a' ? !u.readByA : !u.readByB;
          return `
            <li class="updates-feed-item ${unread ? 'is-unread' : ''}">
              <div class="updates-feed-icon">${u.updateType === 'consent_signature' ? '✍️' : u.updateType === 'expense_approval' ? '💰' : '🔔'}</div>
              <div class="updates-feed-body">
                <div class="updates-feed-title">${escapeHtml(u.title)}</div>
                <div class="updates-feed-text">${escapeHtml(u.body)}</div>
                <div class="updates-feed-meta">${formatDateTime(u.createdAt)}</div>
              </div>
              <button class="btn btn-sm btn-primary" data-action="open-update" data-id="${u.id}">פתח</button>
            </li>
          `;
        }).join('')}
      </ul>
    `}
  `;
}

function buildConsentEmailBody(data, consent, link) {
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const senderName = getParentName(data, myRole);
  return `שלום,

${senderName} שלח/ה אליך/ אליך בקשה לחתימה על טופס הסכמה הורית משותפת.

ילד/ה: ${consent.childFullName}
מוסד: ${consent.institutionName}
פעילות: ${consent.activityDescription}

לחתימה, היכנס/י לאפליקציה «הורים ביחד»:
${link}

או: תפריט → אישורים וחתימות

בברכה,
הורים ביחד`;
}

async function sendConsentSignatureRequest(data, consent) {
  const myRole = typeof getMySenderRole === 'function' ? getMySenderRole() : 'a';
  const partnerRole = getPartnerParentRole(myRole);
  const partner = getFamilyMemberByRole(data, partnerRole);
  const link = getConsentDeepLink(consent.id);

  await createAppUpdate({
    updateType: 'consent_signature',
    title: '✍️ בקשה לחתימה על טופס הסכמה',
    body: `${getParentName(data, myRole)} מבקש/ת את חתימתך על הסכמה הורית — ${consent.childFullName}, ${consent.institutionName}`,
    linkPage: 'approvals',
    referenceId: consent.id,
    targetParentRole: partnerRole
  });

  await markConsentSentToPartner(consent.id);

  if (partner?.email) {
    const subject = encodeURIComponent('בקשה לחתימה — הסכמה הורית משותפת | הורים ביחד');
    const body = encodeURIComponent(buildConsentEmailBody(data, consent, link));
    window.location.href = `mailto:${partner.email}?subject=${subject}&body=${body}`;
  }

  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(link); } catch (_) { /* ignore */ }
  }

  return { link, partnerEmail: partner?.email || null };
}
