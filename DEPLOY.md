# Deploying to Railway

## Prerequisites

- A [Railway](https://railway.app) account (free tier works)
- This repo pushed to GitHub

---

## Step 1 — Create a new Railway project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **Deploy from GitHub repo**
3. Authorise Railway to access your account and select this repository
4. Railway detects the `Dockerfile` automatically — no extra configuration needed at this step

---

## Step 2 — Set environment variables

In the Railway dashboard, open your service → **Variables** tab → **Raw Editor**, and paste:

```
PORT=3000
SESSION_PATH=/data/session
ADMIN_EMAIL=your@email.com
EMAIL_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.gmail@gmail.com
SMTP_PASS=your-app-password
```

> **Gmail tip**: use an [App Password](https://myaccount.google.com/apppasswords), not your regular password.
> The visitor email plugin self-disables if `ADMIN_EMAIL` or `SMTP_USER` are missing — the app still works without them.

---

## Step 3 — Attach a persistent volume (required for WhatsApp session)

Without a volume the WhatsApp session is lost every redeploy, forcing a new QR scan.

1. In the Railway dashboard, go to your service → **Volumes** tab
2. Click **Add Volume**
3. Set **Mount Path** to `/data`
4. Click **Create** — Railway provisions the volume and redeploys

The WhatsApp session files are stored at `/data/session` (set by `SESSION_PATH`).

---

## Step 4 — Generate a public URL

1. Go to your service → **Settings** → **Networking**
2. Click **Generate Domain**
3. Copy the `https://…railway.app` URL — this is your app's address

---

## Step 5 — First deploy

Railway builds the Docker image (≈ 3–5 min on first build because it downloads Chromium).
Once the health check at `/health` returns 200, the service is live.

Open the URL in a browser — you'll see the QR code screen.

---

## Step 6 — Connect WhatsApp

1. Open WhatsApp on your phone
2. Tap **⋮ (menu) → Linked Devices → Link a Device**
3. Scan the QR code shown in the browser
4. The app switches to the group selector — you're ready to broadcast

> The session persists across restarts as long as the volume is attached.
> If you ever need to log out, delete the contents of `/data/session` via the Railway volume UI.

---

## Health check

`GET /health` returns:

```json
{ "status": "ok", "whatsapp": "connected", "timestamp": 1234567890 }
```

`whatsapp` is `"waiting"` until the QR is scanned, `"connected"` after.
Railway only checks that the endpoint returns 200 — it doesn't care about the body.

---

## Redeployment

Push to `main` → Railway rebuilds and redeploys automatically.
The WhatsApp session survives redeploys because it lives on the volume, not in the image.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails with Chromium errors | Check that all system deps in `Dockerfile` are present; re-trigger build |
| QR keeps refreshing, never connects | Ensure the volume is mounted at `/data` and `SESSION_PATH=/data/session` is set |
| No visitor email received | Confirm `ADMIN_EMAIL`, `SMTP_USER`, and `SMTP_PASS` are set; check Railway logs for `[visitor-email-alert]` errors |
| 503 on `/api/groups` | WhatsApp isn't connected yet — scan the QR first |
