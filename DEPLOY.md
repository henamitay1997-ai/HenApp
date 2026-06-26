# העלאה לשרת — הורים ביחד

האפליקציה היא אתר סטטי (HTML/CSS/JS). אפשר להעלות אותה בחינם ללא Node.js.

## אפשרות 1: Netlify Drop (הכי פשוט — 2 דקות)

1. פתח/י: **https://app.netlify.com/drop**
2. צור/י חשבון חינמי (אימייל או Google)
3. גרור/י את **כל התיקייה** `coparent-app` לאזור הגרירה
4. Netlify ייתן לך כתובת כמו: `https://random-name-123.netlify.app`
5. (אופציונלי) ב-**Site settings → Domain management** אפשר לשנות שם או לחבר דומיין

## אפשרות 2: Cloudflare Pages

1. היכנס/י ל-**https://pages.cloudflare.com**
2. **Create a project → Direct Upload**
3. העלה/י את תוכן התיקייה `coparent-app` (לא את התיקייה עצמה — את הקבצים שבתוכה)
4. לחץ/י **Deploy**

## אפשרות 3: GitHub Pages (אם יש Git)

```powershell
cd c:\Users\user\coparent-app
git init
git add .
git commit -m "Initial commit"
# צור repo ב-GitHub והרץ:
git remote add origin https://github.com/YOUR_USER/coparent-app.git
git push -u origin main
```

ב-GitHub: **Settings → Pages → Source: main branch → Save**

## אפשרות 4: Vercel

1. היכנס/י ל-**https://vercel.com**
2. **Add New → Project → Import** (או העלאה ידנית)
3. בחר/י את התיקייה `coparent-app`
4. Deploy (אין צורך ב-build command)

---

## יצירת קובץ ZIP להעלאה

ב-Windows Explorer:
1. לחץ/י ימני על `coparent-app`
2. **Send to → Compressed (zipped) folder**
3. העלה/י את ה-ZIP ל-Netlify Drop (הם יחלצו אוטומטית)

---

## התקנה כאפליקציה במובייל

לאחר שהאתר באוויר:
- **iPhone:** Safari → כפתור שיתוף → "הוסף למסך הבית"
- **Android:** Chrome → תפריט (⋮) → "הוסף למסך הבית" / "Install app"

---

## הערות חשובות

- הנתונים נשמרים **בדפדפן של כל מכשיר** (localStorage) — לא על השרת
- כדי ששני ההורים יראו אותם נתונים, צריך בעתיד להוסיף שרת + התחברות
- מומלץ לייצא גיבוי JSON מההגדרות מדי פעם
