# Project: WhatsApp Group Broadcaster

## Core Purpose
A web app (hosted on Railway) that lets a user connect their WhatsApp account via QR code,
then broadcast messages (text, documents, audio, video) to multiple selected groups,
with a random delay between each send.

## Stack
- **Runtime**: Node.js 20
- **Framework**: Express (HTTP server + REST API)
- **WhatsApp**: @whiskeysockets/baileys 6.7.23 (native WebSocket, no browser/Puppeteer needed)
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

## Debugging Rules — READ BEFORE FIXING ANYTHING
Before attempting any fix:
1. Read ALL files in core/ and api/
2. List every route registered in core/server.js
3. List every file in api/ and check if it is mounted in server.js
4. Report findings before touching any code
5. Test the fix locally (npm start + http://localhost:3000) before pushing to Railway

Never push a fix to Railway without verifying it works on localhost:3000 first.

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
│   ├── visitor-email-resend/        ← emails via Resend REST API on visit (active)
│   │   ├── index.js
│   │   ├── config.js
│   │   └── README.md
│   └── visitor-email-alert-smtp/   ← legacy SMTP version, disabled (kept for reference)
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
│   │   └── index.jsx
│   └── dist/                        ← built output, served by Express
│
├── config/
│   └── app.config.js                ← feature flags + plugin registry (uses absolute paths)
│
├── scripts/
│   ├── release.sh                   ← Mac/Linux release script
│   └── release.bat                  ← Windows release script (npm run ship:win)
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
| `GET` | `/api/status` | `{connected: bool, stage, phone?, name?, uptimeSeconds}` |
| `GET` | `/api/groups` | `[{id, name}]` — 503 if WhatsApp not ready |
| `POST` | `/api/send` | See body schema below |
| `POST` | `/api/disconnect` | Logs out the current WhatsApp session |
| `GET` | `/api/version` | `{version: "1.2.0"}` — reads from `package.json` |

### POST /api/send body
```json
{
  "groupIds":  ["123@g.us"],
  "message":   "optional text",
  "minDelay":  0,
  "maxDelay":  0,
  "mediaItems": [
    { "data": "<base64>", "mimetype": "image/jpeg", "filename": "photo.jpg" },
    { "data": "<base64>", "mimetype": "audio/ogg; codecs=opus", "filename": "voice_message.ogg" }
  ]
}
```

## whatsapp.js Exports

| Export | Signature | Notes |
|---|---|---|
| `getGroups()` | `async () → [{id, name}]` | Throws if not ready |
| `sendMessage()` | `async (groupId, content, opts?) → Message` | content = string or `{ data, mimetype, filename }` plain object |
| `getClient()` | `() → Client or null` | Raw Baileys socket |
| `getIsReady()` | `() → bool` | True after QR is scanned |

## Active Plugins
| Plugin | What it does | Status |
|---|---|---|
| `visitor-email-resend` | Emails ADMIN_EMAIL via Resend REST API when the app is visited; includes IP geolocation; debounced to 1 email / 10 min | enabled |
| `visitor-email-alert-smtp` | Legacy SMTP version (nodemailer) — kept for reference | disabled |

## Architectural Decisions

| Decision | Why |
|---|---|
| Frontend controls send delay loop, not backend | Enables real-time per-group status panel in the UI |
| Media sent as base64 JSON (`mediaItems` array) | Avoids multer dependency; supports multiple attachments |
| Text and files sent as separate messages | Cleaner multi-attachment UX in WhatsApp |
| `POST /api/disconnect` calls `client.logout()` | Clears session so fresh QR appears |
| `GET /health` mounted before `app:visited` middleware | Prevents health-check pings from triggering visitor emails |
| Railway deployment uses `Dockerfile` not Nixpacks | Nixpacks cannot install Chromium system libraries — **review needed:** Baileys uses native WebSocket (no Puppeteer), so Chromium deps may no longer be needed in the image |
| `visitor-email-alert` debounced to 1 email / 10 min | Prevents inbox flood from crawlers |
| Migrated from whatsapp-web.js to Baileys | whatsapp-web.js required Chrome+Puppeteer in the container, causing slow/unreliable group loading on Railway. Baileys connects via native WebSocket — faster, more stable, no browser dependency |
| Pinned Baileys to 6.7.23, not latest | `latest` resolves to 7.0.0-rc13 (unstable release candidate) which caused WhatsApp to reject the pairing after QR scan |
| `initializeClient()` called from `GET /api/status`, not just `GET /api/qr` | QRScreen only polls `/api/status` continuously; it only calls `/api/qr` once stage is `qr_ready`. Without this, reconnection after disconnect was never triggered — chicken-and-egg deadlock. The `isInitializing` guard makes it safe to call on every poll. |
| `connection.update` handler guards against stale close events (`thisSock !== sock`) | After disconnect, the old socket's `close` event fires asynchronously and can arrive after a new socket is already created. Without the guard it nulls the new socket and sets `isInitializing = false`, permanently preventing QR generation. |

## How to Run Locally
```bash
npm install
npm install --prefix frontend
npm run build
npm start
# open http://localhost:3000
```

## Release Flow
```bash
npm run ship:win   # Windows — commit + version bump + push to main
npm run ship       # Mac/Linux
```
Railway auto-deploys on every push to `main`.

## Environment Variables (.env.example)
```
PORT=3000
SESSION_PATH=/data/session
ADMIN_EMAIL=your@email.com
RESEND_API_KEY=re_...

# Legacy SMTP vars (visitor-email-alert-smtp plugin, currently disabled)
EMAIL_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
```

## Branching Strategy

| Branch | Purpose | Who deploys from here |
|---|---|---|
| `main` | **Production** — live user connected on v2.0.0, Railway deploys from here | Only via `npm run promote` |
| `develop` | **Active development** — safe to experiment, push freely | `npm run ship:win` (or `npm run ship` on Mac/Linux) |

**Rules:**
- Never push directly to `main`. All work goes to `develop` first.
- `npm run ship:win` on `develop` → commits, bumps version, pushes to `develop` only.
- `npm run ship:win` on `main` → shows a confirmation prompt before touching production.
- `npm run ship:win` on any other branch → blocked entirely.

**To release to production:**
```bash
npm run promote   # merges develop → main, then ships to Railway
```
This is the ONLY approved path from develop into production.

## Adding a New Feature — Checklist
1. [ ] Classify: is it core (sending WA messages) or a plugin? → almost always a plugin
2. [ ] Check if the event you need already exists in the table above
3. [ ] If not, add ONE `eventBus.emit('event:name', data)` line to the relevant core file
4. [ ] Create `plugins/[feature-name]/index.js` with `{ name, initialize, teardown }`
5. [ ] Add to `config/app.config.js` with `enabled: true`
6. [ ] Add plugin README.md
7. [ ] Update "Active Plugins" table above
8. [ ] Verify: a crash in the plugin does NOT crash the app (try/catch in initialize)
