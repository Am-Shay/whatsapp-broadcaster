# Claude Code Session Starter
# Copy-paste this as your FIRST message in every Claude Code session.
# Replace [...] with the actual task for today.

---

/project: WhatsApp Group Broadcaster

## What this app does
A web app on Railway. Users open a link, scan WhatsApp QR, then broadcast messages
(text / documents / audio / video) to selected groups with random delay between sends.
Every time the link is opened, an email alert is sent to the admin.

## Stack
Node.js 20 + Express + whatsapp-web.js + React frontend + Railway hosting

## Architecture — STRICT RULES
- `core/` is locked. Never add feature logic there.
- New features go in `plugins/` only, as self-contained modules.
- Plugins hook into core via EventBus (EventEmitter). Core emits events. Plugins listen.
- Plugin crashes must NOT crash the app — always try/catch in initialize().
- Secrets go in `.env` only.
- To disable a plugin: set enabled: false in config/app.config.js. Never delete.
- After every change: update CLAUDE.md (active plugins list, new events).

## Current Task
[DESCRIBE WHAT YOU WANT TO BUILD OR FIX TODAY]

Examples:
- "Build the QR authentication flow — show QR in browser, detect when scanned"
- "Add group selector UI — fetch groups from API, show checkboxes, remember selection"
- "Implement the send flow with random delay between min/max seconds"
- "Add file/audio attachment support to the message composer"
- "Debug: messages send twice sometimes"

## Constraints for this session
[OPTIONAL — add if relevant]
- Don't change the DB schema
- Keep the PR small, one feature only
- We're on Railway free tier, keep memory usage low
