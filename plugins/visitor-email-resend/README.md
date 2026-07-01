# visitor-email-resend

Sends an email alert via the Resend REST API whenever the app is visited.
Replaces `visitor-email-alert-smtp`, which used nodemailer + SMTP (blocked on Railway port 587/465).

## How it works

- Listens to the `app:visited` EventBus event
- Debounces to one email per 10 minutes
- Fetches rough geolocation from `ipapi.co` (free, no key required)
- Sends an HTML email via Resend REST API

## Required env vars

| Variable        | Description                              |
|-----------------|------------------------------------------|
| `RESEND_API_KEY`| API key from resend.com                  |
| `ADMIN_EMAIL`   | Recipient — where alerts are delivered   |

## From address

Uses `onboarding@resend.dev` (Resend's shared test sender).
To use a custom domain, verify it in the Resend dashboard and update the `from` field in `index.js`.
