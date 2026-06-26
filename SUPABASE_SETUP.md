# הגדרת Supabase — התחברות והרשמה

## שלב 1: צור פרויקט Supabase

1. היכנס/י ל-[supabase.com](https://supabase.com) וצור/י חשבון
2. **New Project** → בחר/י שם (למשל `henapp`) וסיסמה לבסיס הנתונים
3. המתן/י ~2 דקות עד שהפרויקט מוכן

## שלב 2: העתק מפתחות

1. בפרויקט: **Settings → API**
2. העתק/י:
   - **Project URL** (למשל `https://xxxxx.supabase.co`)
   - **Publishable key** (`sb_publishable_...`) או **anon public** key

3. פתח/י את `js/config.js` והדבק/י:

```javascript
const SUPABASE_CONFIG = {
  url: 'https://xxxxx.supabase.co',
  publishableKey: 'sb_publishable_...'
};
```

## שלב 3: הפעל אימות אימייל

1. **Authentication → Providers → Email** — ודא/י ש-Email מופעל
2. **Authentication → URL Configuration**:
   - **Site URL:** כתובת האתר שלך (למשל `https://henapp.vercel.app`)
   - **Redirect URLs:** הוסף/י את אותה כתובת

### לפיתוח מקומי
הוסף/י גם:
- `http://localhost:8080`
- `http://127.0.0.1:5500`

## שלב 4: הרץ SQL (חובה!)

1. **SQL Editor → New query**
2. העתק/י את **כל** התוכן מ-`supabase/schema.sql`
3. לחץ/י **Run**

זה יוצר את כל הטבלאות: הגדרות, ילדים, אירועים, הוצאות והודעות.
כל הנתונים נשמרים בענן לפי משתמש.

## שלב 5: פרוס מחדש

אחרי עדכון `config.js`:

```powershell
cd c:\Users\user\coparent-app
git add .
git commit -m "Configure Supabase auth"
git push
```

אם מחובר ל-Vercel — הפריסה תתבצע אוטומטית.

---

## בדיקה

1. פתח/י את האתר
2. לחץ/י **הרשמה** → מלא/י שם, אימייל וסיסמה
3. בדוק/י את האימייל לאישור (אם אימות אימייל מופעל)
4. התחבר/י עם האימייל והסיסמה

---

## הערות

- מפתח `anon` בטוח לשימוש בצד הלקוח (מוגן ע"י Row Level Security)
- **אל** תשתף/י את מפתח `service_role`
- כל משתמש רואה רק את הנתונים שלו בדפדפן (localStorage לפי user ID)
- בשלב הבא: סנכרון ענן בין שני ההורים דרך Supabase Database
