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
