# Context for Claude (claude.ai)
# הדבק קובץ זה בתחילת כל שיחה חדשה עם claude.ai

## תפקידנו
- **אני (המשתמש)**: מנחה את הפיתוח — מתאר בקשות בעברית
- **אתה (claude.ai)**: כותב פרומפטים מדויקים באנגלית
- **Claude Code (CLI)**: מריץ את הפרומפטים ובונה את הקוד בפועל

---

## הפרויקט
**שם**: WhatsApp Group Broadcaster
**מטרה**: אפליקציית ווב שמאפשרת לשלוח הודעות (טקסט, מסמכים, קול, וידאו) למספר קבוצות WhatsApp במקביל עם השהיה רנדומלית בין שליחות.

**גישה**: משתמש נכנס דרך QR (כמו WhatsApp Web), בוחר קבוצות, מכין הודעה ושולח.

---

## Stack
- **Backend**: Node.js + Express
- **WhatsApp**: whatsapp-web.js (QR auth)
- **Frontend**: React + Vite
- **Hosting**: Railway
- **Plugin system**: EventBus (Node EventEmitter)

---

## מיקום פרויקט (Windows)
```
C:\workspace\claude-cowork\whatsapp-groups-sender
```

## הרצה מקומית
```bash
cd C:\workspace\claude-cowork\whatsapp-groups-sender
npm start
# פתח: http://localhost:3000
```

## בניית Frontend
```bash
cd frontend
npm run build
cd ..
npm start
```

---

## ארכיטקטורה — כללים קבועים
1. `core/` — נעול. לא מוסיפים לו לוגיקה של features
2. `plugins/` — כל feature חדש שאינו core נכנס לכאן
3. EventBus — core עושה emit, plugins מאזינים בלבד
4. `.env` — כל הסודות. לעולם לא hardcode
5. להשבית feature: `enabled: false` ב-`config/app.config.js` — לא מוחקים

---

## סטטוס פיתוח

### הושלם ✅
- Session 1: Project skeleton
- Session 2: WhatsApp QR connection (core/whatsapp.js)
- Session 3: API routes (groups, send, qr, status)
- Session 4: Frontend QR Screen
- Session 5: Frontend Main UI (GroupSelector, MessageComposer, DelayPicker)
- Session 6: Plugin — visitor-email-alert
- Session 7: Railway deployment config
- האפליקציה רצה על localhost:3000 ✅
- אינדיקטור חיבור + כפתור התנתקות ב-header
- Group search כ-dropdown עם חיפוש
- סטטוס שליחה inline (לא לצאת מהמסך)
- תמיכה במספר קבצים + הקלטת קול
- הצגת קבוצות שנבחרו כ-chips עם כפתור הסרה
- הצגת גרסת האפליקציה (מ-package.json דרך GET /api/version)
- Countdown timer בין שליחות (frontend בלבד)
- כפתור Clear לאיפוס כל השדות
- Tooltip על כל הכפתורים (מופיע אחרי שנייה)
- תיקון disconnect — לא חוזר אוטומטית, מנקה session
- Semantic Versioning אוטומטי לפי Conventional Commits:
  - standard-version + husky + commitlint
  - fix: → PATCH, feat: → MINOR, feat!: → MAJOR
  - npm run release לקידום גרסה

### בביצוע / ממתין 🔄
- [ריק — כל הפיצ'רים הושלמו]

### פיצ'רים עתידיים 📋
- [יתווספו כאן לפי הצורך]

---

## API Endpoints
| Method | Path | תיאור |
|--------|------|-------|
| GET | /api/status | סטטוס חיבור WhatsApp |
| GET | /api/qr | QR code כ-base64 |
| GET | /api/groups | רשימת קבוצות |
| POST | /api/send | שליחת הודעה לקבוצות |
| GET | /api/version | גרסת האפליקציה מ-package.json |

## Events (EventBus)
| Event | Payload | מתי |
|-------|---------|-----|
| `app:visited` | `{ ip, userAgent, timestamp }` | כל בקשה לשרת |
| `whatsapp:qr` | `{ qr }` | QR חדש נוצר |
| `whatsapp:ready` | `{ phone, name }` | התחברות הצליחה |
| `whatsapp:disconnected` | `{}` | התנתקות |
| `message:sent` | `{ groupId, groupName, type, timestamp }` | הודעה נשלחה |
| `message:failed` | `{ groupId, error, retryCount }` | שליחה נכשלה |

---

## Plugins פעילים
| Plugin | סטטוס | תיאור |
|--------|-------|-------|
| visitor-email-alert | enabled (requires SMTP config) | שולח מייל לאדמין כשמישהו פותח את האפליקציה |

---

## הערות חשובות
- puppeteer דורש Chrome — הותקן ידנית בפרויקט
- frontend/src/index.js שונה ל-index.jsx (תיקון vite JSX bug)
- SMTP לא מוגדר עדיין — visitor-email-alert מושבת

## עדכון אחרון
- האפליקציה עלתה ל-Railway בהצלחה ✅
- GitHub repo: https://github.com/Am-Shay/whatsapp-broadcaster
- Railway region: US West (קליפורניה)
- WhatsApp מתריע על מיקום שרת — נורמלי, לוחצים "קישור המכשיר"
- בביצוע: Loading indicator עם סטטוס בזמן אמת + elapsed time
  - שלבים: initializing → browser_starting → qr_ready → connecting → ready
  - הודעות עידוד אחרי 30/60 שניות
  - Backend: הוספת שדות "stage" ו-"uptimeSeconds" ל-GET /api/status
- POST /api/disconnect מוסיף ל-API
- SMTP עדיין לא מוגדר ב-Railway Variables

## עדכון Session אחרונה
- גרסה נוכחית: v1.2.0 (על master, עדיין לא על main)
- לינק Railway: https://myapp-production-feb0.up.railway.app
- GitHub: https://github.com/Am-Shay/whatsapp-broadcaster

### בעיות ידועות שטופלו
- node_modules נדחפו ל-GitHub (צריך .gitignore)
- .wwebjs_cache נדחף ל-GitHub (צריך להוסיף ל-.gitignore)
- data/session/session נדחף ל-GitHub (צריך להוסיף ל-.gitignore)
- commitlint דורש Node 22, Railway מריץ Node 20 — פתרון: הוסף NODE_VERSION=22 ב-Railway Variables

### בעיה פתוחה — חשוב לתקן ⚠️
- יש שני branches: master (עבודה) ו-main (Railway)
- Railway עוקב אחרי main, עבודה נעשית על master
- צריך לאחד ל-main בלבד
- scripts/release.bat דוחף ל-master במקום main
- גרסה באפליקציה מציגה v1.0.0 במקום v1.2.0

### לביצוע בפגישה הבאה
1. אחד branches — master → main, מחק master
2. עדכן release.bat לדחוף ל-main
3. הוסף NODE_VERSION=22 ב-Railway Variables
4. הוסף ל-.gitignore: node_modules/, .wwebjs_cache/, data/
5. בדוק שגרסה מתעדכנת נכון באפליקציה

## כלל חדש — חובה לפני כל Release ⚠️
לפני כל npm run ship:win — חובה לבדוק מקומית:
1. npm start — האפליקציה עולה ללא שגיאות?
2. http://localhost:3000 — הUI נטען?
3. http://localhost:3000/api/status — מחזיר JSON תקין?
4. http://localhost:3000/api/groups — מחזיר מערך קבוצות?
5. רק אחרי שכל הבדיקות עוברות → npm run ship:win

## לקח מהשטח
- api/groups.js לא היה רשום ב-core/server.js — באג שהתגלה רק בפרודקשן
- הסיבה: לא נבדק מקומית לפני push
- הפתרון: תמיד בדוק מקומית לפני כל release

## עדכון Session — מעבר ל-Baileys ✅
- בעיה: whatsapp-web.js היה איטי ולא יציב — תלוי ב-Chrome/Puppeteer בתוך Railway
- פתרון: מעבר מלא ל-@whiskeysockets/baileys — WebSocket ישיר, ללא דפדפן
- גרסת Baileys: 6.7.23 (stable) — לא 7.0.0-rc13 (RC לא יציב, גרם לכשל חיבור)
- core/whatsapp.js נכתב מחדש עם Baileys, אותו API ציבורי (getGroups, sendMessage, getClient, getIsReady)
- api/send.js תוקן — הוסר MessageMedia (whatsapp-web.js), הוחלף באובייקט פשוט {mimetype, data, filename}
- session files נמחקו לפני סריקת QR חדשה — הכרחי בכל שינוי גרסת Baileys
- QR מהיר עכשיו (כמו בפרויקט הישן whatsapp-sender)
- בדיקה מקומית עברה בהצלחה — מחובר, groups נטענים מהר

## גרסה נוכחית: v2.0.0
- feat!: migrate from whatsapp-web.js to Baileys for faster, more stable connection
- Breaking change — מעבר מלא מ-whatsapp-web.js ל-Baileys 6.7.23
- package.json allowScripts תוקן (rc13 → 6.7.23)
- Push בוצע ל-main — Railway אמור להתחיל deploy אוטומטית

## Released v2.0.0 ✅
- Migration to Baileys completed and shipped
- commit: feat! migrate from whatsapp-web.js to Baileys
- Pushed to main, tagged v2.0.0, Railway auto-deploying
- Next: verify Railway deploy succeeded and QR loads fast in production

## Branch Strategy הוקם ✅
- main = production (v2.0.0 live, משתמש מחובר) — אסור לגעת ישירות
- develop = פיתוח שוטף — בטוח להריץ npm run ship:win
- npm run promote = הדרך היחידה לעדכן production (merge develop → main → ship)
- scripts/release.bat ו-release.sh branch-aware: develop→develop, main→שואל אישור, other→חסום
- CLAUDE.md מעודכן עם סעיף "## Branching Strategy"
- Currently on: develop, main untouched at v2.0.0

## כללי עבודה מעכשיו
- כל פיתוח חדש → על develop בלבד
- בדיקה מקומית → npm start על develop
- לשגר ל-production → רק npm run promote, באופן מודע

## Session — staging environment + הצלחת התיקון ✅
- הוקם staging service ב-Railway שעוקב אחרי develop branch
- לינק staging: https://whatsapp-broadcaster-production.up.railway.app
- לינק production: https://myapp-production-feb0.up.railway.app
- staging אין לו volume נפרד — צריך QR חדש בכל restart (מקובל לצורך בדיקות)

## Bug שנפתר — disconnect+QR race condition
- לחיצה על Disconnect לא הביאה QR חדש
- Root cause: connection.update event של socket ישן דרס את הsocket החדש
- Fix ב-core/whatsapp.js: capture thisSock ב-makeWASocket, ובודקים if (thisSock !== sock) return
- Fix נוסף: GET /api/status מפעיל initializeClient אוטומטית כשאין client
- שני התיקונים על develop, נבדקו בהצלחה ב-staging

## Merge conflict flow שנפתר
- Git Bash לא הצליח לפתוח C:\Windows\notepad.exe בזמן merge
- פתרון: git commit --no-edit לסגירת merge commit
- להימנע בעתיד: git merge develop --no-edit

## גרסה 2.0.2 בדרך ל-production
- npm run promote רץ עכשיו
- merged develop → main
- מכיל: race condition fix + auto-reconnect trigger from /api/status

## תובנות שנרשמות
- דיברנו על צורך בבדיקה על שרת אמיתי לפני promote, לא רק מקומי — staging הוא הפתרון
- כלל להוסיף: bug fix על develop → בדיקה על staging → רק אז promote ל-main
