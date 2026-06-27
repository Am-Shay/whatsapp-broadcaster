# Project: WhatsApp Group Broadcaster

## Core Purpose
A web app (hosted on Railway) that lets a user connect their WhatsApp account via QR code,
then broadcast messages (text, documents, audio, video) to multiple selected groups,
with a random delay between each send.

## Stack
- **Runtime**: Node.js 20
- **Framework**: Express (HTTP server + REST API)
- **WhatsApp**: whatsapp-web.js (QR-based session, supports all media types)
- **Frontend**: React (single page, served by Express)
- **Session storage**: Local filesystem (Railway volume) for WhatsApp session persistence
- **Hosting**: Railway
- **Plugin system**: EventBus (Node.js EventEmitter)

## Architecture Rules — READ BEFORE TOUCHING CODE
1. `core/` is LOCKED. Never add plugin logic there. Only add `eventBus.emit()` lines if a new event is needed.
2. Every non-core feature lives in `plugins/`. Each plugin is self-contained.
3. To disable a feature: set `enabled: false` in `config/app.config.js`. Never delete plugin folders.
4. Secrets go in `.env` only. Never hardcode tokens, emails, or keys.
5. Update the "Active Plugins" section below whenever a plugin is added or removed.

## Folder Structure
```
whatsapp-broadcaster/
├── CLAUDE.md                        ← YOU ARE HERE
├── package.json
├── .env                             ← secrets (not committed)
├── .env.example                     ← committed, no secrets
├── railway.json                     ← Railway deployment config
│
├── core/
│   ├── whatsapp.js                  ← QR auth, send message, get groups, all media
│   ├── eventBus.js                  ← Node EventEmitter singleton
│   ├── pluginLoader.js              ← reads app.config.js, initializes plugins
│   └── server.js                    ← Express app, mounts API routes, serves frontend
│
├── api/
│   ├── qr.js                        ← GET /api/qr (returns QR base64 PNG or null)
│   ├── status.js                    ← GET /api/status (connected, phone, name)
│   ├── groups.js                    ← GET /api/groups
│   ├── send.js                      ← POST /api/send
│   ├── disconnect.js                ← POST /api/disconnect
│   └── health.js                    ← GET /health (Railway health check)
│
├── plugins/
│   └── visitor-email-alert/         ← sends email when someone opens the app link
│       ├── index.js
│       ├── config.js
│       └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── QRScreen.jsx         ← shows QR, waits for scan
│   │   │   ├── GroupSelector.jsx    ← searchable multi-select dropdown of groups
│   │   │   ├── MessageComposer.jsx  ← text input + multi-file attach + voice recorder
│   │   │   └── DelayPicker.jsx      ← min/max seconds slider
│   │   └── index.js
│   └── dist/                        ← built output, served by Express
│
├── config/
│   └── app.config.js                ← feature flags + plugin registry (uses absolute paths)
│
├── tests/
│   ├── core/
│   └── plugins/
│
├── Dockerfile                       ← node:20-slim + Chromium deps; builds frontend inside image
├── .dockerignore
├── railway.json                     ← builder: DOCKERFILE, healthcheck: /health
└── DEPLOY.md                        ← step-by-step Railway setup guide
```

## Core Events (EventBus)
These events are emitted by core. Plugins listen to them — never the other way around.

| Event | Payload | When |
|---|---|---|
| `app:visited` | `{ ip, userAgent, timestamp }` | Any request hits the app |
| `whatsapp:qr` | `{ qr }` | New QR code generated |
| `whatsapp:ready` | `{ phone, name }` | QR scanned, session ready |
| `whatsapp:disconnected` | `{}` | Session lost |
| `message:sent` | `{ groupId, groupName, type, timestamp }` | Message sent successfully |
| `message:failed` | `{ groupId, error, retryCount }` | Send failed |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Always 200 if Express is up; returns `{status, whatsapp, timestamp}` |
| `GET` | `/api/qr` | `{qr: "data:image/png;base64,…", connected: false}` or `{qr: null, connected: true}` |
| `GET` | `/api/status` | `{connected: bool, phone?, name?}` |
| `GET` | `/api/groups` | `[{id, name}]` — 503 if WhatsApp not ready |
| `POST` | `/api/send` | See body schema below |
| `POST` | `/api/disconnect` | Logs out the current WhatsApp session; client reconnects and shows a new QR |
| `GET` | `/api/version` | `{version: "1.0.0"}` — reads from `package.json` |

### POST /api/send body
```json
{
  "groupIds":  ["123@g.us"],
  "message":   "optional text — sent as a separate message, not a caption",
  "minDelay":  0,
  "maxDelay":  0,
  "mediaItems": [
    { "data": "<base64>", "mimetype": "image/jpeg", "filename": "photo.jpg" },
    { "data": "<base64>", "mimetype": "audio/ogg; codecs=opus", "filename": "voice_message.ogg" }
  ]
}
```
- `mediaItems` is an array; each attachment is sent as its own separate WhatsApp message
- Text (`message`) is also sent as its own message (not a caption on the first file)
- Legacy `mediaBase64` (single object) still accepted for backward compatibility
- Audio mimetypes (`audio/*`) are automatically sent as WhatsApp voice notes
- Frontend sends **one group at a time** and controls the delay loop; backend receives `minDelay: 0, maxDelay: 0`
- Returns `202 { ok: true, total: N }` immediately; sends are async in the background

## whatsapp.js Exports

| Export | Signature | Notes |
|---|---|---|
| `getGroups()` | `async () → [{id, name}]` | Throws if not ready |
| `sendMessage()` | `async (groupId, content, opts?) → Message` | content = string \| file path \| MessageMedia |
| `getClient()` | `() → Client \| null` | Raw whatsapp-web.js client |
| `getIsReady()` | `() → bool` | True after QR is scanned |

## Active Plugins
| Plugin | What it does | Status |
|---|---|---|
| `visitor-email-alert` | Emails ADMIN_EMAIL when the app is visited; debounced to 1 email / 10 min | enabled |

## Architectural Decisions (record of non-obvious choices)

| Decision | Why |
|---|---|
| Frontend controls send delay loop, not backend | Enables real-time per-group status panel in the UI; backend gets `minDelay: 0, maxDelay: 0` |
| Media sent as base64 JSON (`mediaItems` array) | Avoids a separate upload endpoint and multer dependency; 50 MB Express JSON limit set; supports multiple attachments per send |
| Text and files sent as separate messages (no caption) | Cleaner multi-attachment UX: each item is independently visible in WhatsApp |
| `POST /api/disconnect` calls `client.logout()` | Clears the session so a fresh QR appears; `disconnected` event fires → `scheduleReconnect()` → new QR in ~5s |
| `GET /health` mounted before `app:visited` middleware | Prevents Railway's health-check pings from triggering visitor-alert emails |
| `loadPlugins()` called inside `app.listen()` callback | Ensures plugins register event listeners only after the server is accepting requests |
| Plugin paths in `app.config.js` use `path.join(__dirname, …)` | Makes paths absolute so `pluginLoader.js` can `require()` them from any directory |
| Railway deployment uses `Dockerfile` not Nixpacks | Nixpacks cannot install the Chromium system libraries puppeteer needs on Debian slim |
| `visitor-email-alert` debounced to 1 email / 10 min | Prevents inbox flood when Railway health checker or crawlers hit the URL repeatedly |
| `sendAudioAsVoice: true` auto-applied for `audio/*` mimetypes | Detected by both file extension (path) and mimetype (MessageMedia) so voice notes work from both code paths |

## How to Run Locally
```bash
npm install
npm install --prefix frontend   # install frontend deps
npm run build                   # build React → frontend/dist/
npm start                       # serves on http://localhost:3000
```

Or for live-reload during development:
```bash
npm run dev   # concurrently: Express (port 3000) + Vite dev server (port 5173)
```

## How to Deploy
See **DEPLOY.md** for the full Railway setup guide.

Summary: push to `main` → Railway builds the Dockerfile → container starts → scan QR at the public URL.
WhatsApp session is stored at `/data/session` (Railway persistent volume mounted at `/data`).

## Environment Variables (.env.example)
```
PORT=3000
SESSION_PATH=/data/session
ADMIN_EMAIL=your@email.com
EMAIL_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

## Adding a New Feature — Checklist
1. [ ] Classify: is it core (sending WA messages) or a plugin? → almost always a plugin
2. [ ] Check if the event you need already exists in the table above
3. [ ] If not, add ONE `eventBus.emit('event:name', data)` line to the relevant core file
4. [ ] Create `plugins/[feature-name]/index.js` with `{ name, initialize, teardown }`
5. [ ] Add to `config/app.config.js` with `enabled: true`
6. [ ] Add plugin README.md
7. [ ] Update "Active Plugins" table above
8. [ ] Verify: a crash in the plugin does NOT crash the app (try/catch in initialize)
