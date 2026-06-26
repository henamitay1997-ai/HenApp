let authMode = 'login';

function showAuthGate(reason = 'login') {
  const gate = document.getElementById('auth-gate');
  const app = document.getElementById('app-root');
  gate.classList.remove('hidden');
  app.classList.add('hidden');
  renderAuthForm(reason);
}

function hideAuthGate() {
  document.getElementById('auth-gate').classList.add('hidden');
  document.getElementById('app-root').classList.remove('hidden');
}

function renderAuthForm(reason) {
  const container = document.getElementById('auth-content');

  if (reason === 'not-configured') {
    container.innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">👨‍👩‍👧</div>
        <h1 class="auth-title">הורים ביחד</h1>
        <p class="auth-subtitle">נדרשת הגדרת שרת אימות</p>
        <div class="auth-alert">
          יש להגדיר את פרטי Supabase בקובץ <code>js/config.js</code>.
          <br><br>
          ראה/י את המדריך: <strong>SUPABASE_SETUP.md</strong>
        </div>
      </div>
    `;
    return;
  }

  const isLogin = authMode === 'login';

  container.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">👨‍👩‍👧</div>
      <h1 class="auth-title">הורים ביחד</h1>
      <p class="auth-subtitle">ניהול הסידורים בין הורים</p>

      <div class="auth-tabs">
        <button type="button" class="auth-tab ${isLogin ? 'active' : ''}" data-auth-tab="login">התחברות</button>
        <button type="button" class="auth-tab ${!isLogin ? 'active' : ''}" data-auth-tab="register">הרשמה</button>
      </div>

      <form id="auth-form" class="auth-form">
        ${!isLogin ? `
          <div class="form-group">
            <label class="form-label">שם מלא</label>
            <input class="form-input" type="text" name="fullName" required placeholder="למשל: דנה כהן" autocomplete="name">
          </div>
        ` : ''}
        <div class="form-group">
          <label class="form-label">אימייל</label>
          <input class="form-input" type="email" name="email" required placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label">סיסמה</label>
          <input class="form-input" type="password" name="password" required minlength="6" placeholder="לפחות 6 תווים" autocomplete="${isLogin ? 'current-password' : 'new-password'}">
        </div>
        ${!isLogin ? `
          <div class="form-group">
            <label class="form-label">אימות סיסמה</label>
            <input class="form-input" type="password" name="confirmPassword" required minlength="6" placeholder="הזן/י שוב את הסיסמה" autocomplete="new-password">
          </div>
        ` : ''}
        <div id="auth-error" class="auth-error hidden"></div>
        <div id="auth-success" class="auth-success hidden"></div>
        <button type="submit" class="btn btn-primary auth-submit" id="auth-submit">
          ${isLogin ? 'התחבר' : 'הירשם'}
        </button>
      </form>

      ${isLogin ? `
        <button type="button" class="auth-link" id="forgot-password">שכחתי סיסמה</button>
      ` : `
        <p class="auth-hint">לאחר ההרשמה תישלח הודעת אישור לאימייל שלך</p>
      `}
    </div>
  `;

  setupAuthFormListeners();
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  const ok = document.getElementById('auth-success');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  if (ok) ok.classList.add('hidden');
}

function showAuthSuccess(msg) {
  const el = document.getElementById('auth-success');
  const err = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  if (err) err.classList.add('hidden');
}

function setAuthLoading(loading) {
  const btn = document.getElementById('auth-submit');
  if (btn) {
    btn.disabled = loading;
    btn.textContent = loading ? 'מתבצע...' : (authMode === 'login' ? 'התחבר' : 'הירשם');
  }
}

function setupAuthFormListeners() {
  document.querySelectorAll('[data-auth-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      authMode = tab.dataset.authTab;
      renderAuthForm('login');
    });
  });

  document.getElementById('auth-form')?.addEventListener('submit', handleAuthSubmit);

  document.getElementById('forgot-password')?.addEventListener('click', handleForgotPassword);
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const email = fd.get('email').trim();
  const password = fd.get('password');

  setAuthLoading(true);
  showAuthError('');

  try {
    if (authMode === 'register') {
      const fullName = fd.get('fullName').trim();
      const confirm = fd.get('confirmPassword');

      if (password !== confirm) {
        showAuthError('הסיסמאות אינן תואמות');
        return;
      }

      const { data, error } = await signUp(email, password, fullName);
      if (error) throw error;

      if (data.user && !data.session) {
        showAuthSuccess('נרשמת בהצלחה! בדוק/י את האימייל לאישור החשבון.');
        authMode = 'login';
        setTimeout(() => renderAuthForm('login'), 3000);
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) throw error;
    }
  } catch (err) {
    showAuthError(translateAuthError(err.message));
  } finally {
    setAuthLoading(false);
  }
}

async function handleForgotPassword() {
  const emailInput = document.querySelector('#auth-form [name="email"]');
  const email = emailInput?.value.trim();

  if (!email) {
    showAuthError('הזן/י את האימייל שלך קודם');
    emailInput?.focus();
    return;
  }

  setAuthLoading(true);
  try {
    const { error } = await resetPassword(email);
    if (error) throw error;
    showAuthSuccess('נשלח קישור לאיפוס סיסמה לאימייל שלך');
  } catch (err) {
    showAuthError(translateAuthError(err.message));
  } finally {
    setAuthLoading(false);
  }
}

function updateUserUI(user) {
  const name = getUserDisplayName(user);
  const footer = document.getElementById('sidebar-user-info');
  if (footer) footer.textContent = `מחובר/ת: ${name}`;
}

function renderAccountSettings(user, myProfile = {}) {
  const name = getUserDisplayName(user);
  const idNumber = myProfile.idNumber || '';
  return `
    <div class="card">
      <div class="card-title" style="margin-bottom:1rem">החשבון שלי</div>
      <div class="account-info">
        <div class="account-row">
          <span class="account-label">שם</span>
          <span class="account-value">${name}</span>
        </div>
        <div class="account-row">
          <span class="account-label">אימייל</span>
          <span class="account-value" dir="ltr">${user.email}</span>
        </div>
        <div class="account-row">
          <span class="account-label">ת.ז.</span>
          <span class="account-value" dir="ltr">${idNumber || '—'}</span>
        </div>
      </div>
      <p class="form-hint" style="margin-top:0.75rem">ניתן לעדכן ת.ז. בטופס «פרטי הורים» למטה — תמולא אוטומטית בטפסי חתימה</p>
      <button class="btn btn-danger" data-action="logout" style="margin-top:1rem;width:100%">התנתק</button>
    </div>
  `;
}
