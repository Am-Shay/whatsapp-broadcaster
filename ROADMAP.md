# Development Roadmap — WhatsApp Broadcaster

## Phase 1 — Skeleton (do this first, in this order)

### Session 1: Project Setup
Claude Code prompt:
"Set up a new Node.js project with Express. Create the folder structure exactly as in CLAUDE.md.
Create package.json with dependencies: express, whatsapp-web.js, puppeteer, cors, dotenv, nodemailer, eventemitter3.
Create .env.example with all variables from CLAUDE.md. Create railway.json for Railway deployment.
Do NOT implement any logic yet — just the skeleton with placeholder files."

### Session 2: Core — WhatsApp Connection
Claude Code prompt:
"Implement core/whatsapp.js. It must:
1. Initialize whatsapp-web.js client with LocalAuth (session saved to SESSION_PATH env var)
2. Emit eventBus events: whatsapp:qr (with QR string), whatsapp:ready (with phone+name), whatsapp:disconnected
3. Export functions: getGroups() → array of {id, name}, sendMessage(groupId, content) where content can be text, file path, or audio
4. Handle reconnection automatically.
Do not implement API routes yet."

### Session 3: API Layer
Claude Code prompt:
"Implement Express API routes in api/:
- GET /api/qr → returns current QR as base64 image (or null if already connected)
- GET /api/status → returns {connected: bool, phone, name}
- GET /api/groups → returns array of {id, name} from whatsapp.getGroups()
- POST /api/send → body: {groupIds: [], message: string, minDelay: number, maxDelay: number, mediaPath?: string}
  Send to each group with random delay between minDelay-maxDelay seconds.
  Emit message:sent or message:failed events after each send.
Mount all routes in core/server.js."

### Session 4: Frontend — QR Screen
Claude Code prompt:
"Build frontend/src/components/QRScreen.jsx.
Poll GET /api/status every 2 seconds. If not connected, fetch GET /api/qr and show QR image.
When status becomes connected, show phone number and name, then call onConnected() prop.
Style: centered, clean, mobile-friendly. Use only inline styles or CSS modules — no Tailwind."

### Session 5: Frontend — Main UI
Claude Code prompt:
"Build the main broadcast UI. Components needed:
- GroupSelector.jsx: fetches /api/groups, shows checkboxes, supports select-all
- MessageComposer.jsx: textarea for text, file upload button (all types), audio record button using MediaRecorder API
- DelayPicker.jsx: two number inputs — min seconds and max seconds
- App.jsx: orchestrates all components, sends POST /api/send with all data, shows progress (X/N sent)
Keep state in App.jsx. No external state library."

---

## Phase 2 — Plugin: Visitor Email Alert

### Session 6: Email Plugin
Claude Code prompt:
"Implement the visitor-email-alert plugin.
File: plugins/visitor-email-alert/index.js
On event app:visited (emitted by core/server.js on every incoming request):
  - Extract IP, User-Agent, timestamp from the event payload
  - Send an email to ADMIN_EMAIL using nodemailer + SMTP config from .env
  - Debounce: don't send more than 1 email per 10 minutes (store last sent time in memory)
Plugin must fail gracefully — if email fails, log the error but don't crash.
Register it in config/app.config.js with enabled: true.
Add visitor-email-alert to the Active Plugins list in CLAUDE.md."

---

## Phase 3 — Deploy to Railway

### Session 7: Railway Deployment
Claude Code prompt:
"Prepare the project for Railway deployment:
1. railway.json with correct start command and health check
2. Dockerfile (Railway can use it for puppeteer/chromium dependencies)
3. Verify SESSION_PATH uses Railway volume mount
4. Add a /health endpoint that returns 200
5. Make sure the React frontend is built and served by Express in production
6. Write a DEPLOY.md with step-by-step Railway setup instructions including volume configuration"

---

## Rule for every session
Start with the SESSION_STARTER.md template.
End by asking Claude: "Update CLAUDE.md with any new events, plugins, or architectural decisions made this session."
