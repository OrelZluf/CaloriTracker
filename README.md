# CaloriTrack 🥗

אפליקציית מעקב קלוריות חכמה עם ניתוח AI לארוחות.

## תכונות

- 🔐 **התחברות עם Google** – כניסה מהירה ומאובטחת
- 📸 **ניתוח תמונה** – צלם ארוחה וקבל ניתוח תזונתי מלא
- ✏️ **ניתוח טקסט** – תאר ארוחה במילים וקבל פירוט מרכיבים
- 📊 **דשבורד** – מעקב יומי, שבועי וחודשי עם גרפים
- 🎯 **יעד קלוריות** – הגדר יעד יומי ועקוב אחרי ההתקדמות

## טכנולוגיות

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | Angular 22 |
| Backend | Node.js + Express |
| Database | SQLite |
| AI | Google Gemini 3.5 Flash |
| Auth | Google OAuth 2.0 |

## התקנה

### דרישות מקדימות
- Node.js 20+
- Gemini API Key ([קבל מפתח](https://aistudio.google.com/))
- Google OAuth Client ID ([יצירה](https://console.cloud.google.com/))

### שרת (Backend)

```bash
cd server
npm install
# עדכן את .env עם המפתחות שלך
npm run dev
```

### לקוח (Frontend)

```bash
cd client
npm install
ng serve
```

### הגדרות

עדכן את הקובץ `server/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_client_id
JWT_SECRET=your_secret_key
```

עדכן את ה-Google Client ID ב:
- `client/src/app/features/auth/login/login.ts`

## שימוש

1. פתח את `http://localhost:4200`
2. התחבר עם חשבון Google
3. הוסף ארוחה – צלם תמונה או כתוב תיאור
4. צפה בדשבורד עם הנתונים שלך

## רישיון

MIT
