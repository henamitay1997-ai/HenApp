let supabaseClient = null;
let currentUser = null;
let authListeners = [];

function getPublishableKey() {
  return SUPABASE_CONFIG.publishableKey || SUPABASE_CONFIG.anonKey;
}

function isAuthConfigured() {
  const key = getPublishableKey();
  return SUPABASE_CONFIG.url &&
    key &&
    !SUPABASE_CONFIG.url.includes('YOUR_SUPABASE') &&
    !key.includes('YOUR_SUPABASE');
}

function initAuth() {
  if (!isAuthConfigured()) return false;
  supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    getPublishableKey()
  );
  return true;
}

function getSupabase() {
  return supabaseClient;
}

function getCurrentUser() {
  return currentUser;
}

function onAuthChange(callback) {
  authListeners.push(callback);
}

function notifyAuthChange(user) {
  currentUser = user;
  authListeners.forEach(cb => cb(user));
}

async function getSession() {
  if (!supabaseClient) return null;
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

async function signUp(email, password, fullName) {
  return supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
}

async function signIn(email, password) {
  return supabaseClient.auth.signInWithPassword({ email, password });
}

async function signOut() {
  return supabaseClient.auth.signOut();
}

async function resetPassword(email) {
  return supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
}

function getUserDisplayName(user) {
  if (!user) return '';
  return user.user_metadata?.full_name || user.email?.split('@')[0] || 'משתמש';
}

function translateAuthError(message) {
  const errors = {
    'Invalid login credentials': 'אימייל או סיסמה שגויים',
    'User already registered': 'משתמש עם אימייל זה כבר קיים',
    'Password should be at least 6 characters': 'הסיסמה חייבת להכיל לפחות 6 תווים',
    'Unable to validate email address: invalid format': 'כתובת אימייל לא תקינה',
    'Email not confirmed': 'יש לאשר את האימייל לפני ההתחברות',
    'Signup requires a valid password': 'יש להזין סיסמה תקינה'
  };
  return errors[message] || message || 'שגיאה לא צפויה';
}

function watchAuthState() {
  if (!supabaseClient) return;
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    notifyAuthChange(session?.user ?? null);
  });
}
