const nodemailer = require('nodemailer');
const config = require('./config');

const DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes

let lastSentAt = 0;
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

function formatDate(ts) {
  return new Date(ts).toUTCString();
}

async function sendAlert({ ip, userAgent, timestamp }) {
  const now = Date.now();
  if (now - lastSentAt < DEBOUNCE_MS) return;
  lastSentAt = now;

  await getTransporter().sendMail({
    from: config.emailFrom,
    to: config.adminEmail,
    subject: '👀 Someone opened your WhatsApp Broadcaster',
    text: [
      'Your app was visited.',
      '',
      `Time:       ${formatDate(timestamp)}`,
      `IP:         ${ip}`,
      `User-Agent: ${userAgent}`,
    ].join('\n'),
    html: `
      <p>Your WhatsApp Broadcaster was visited.</p>
      <table cellpadding="6" style="border-collapse:collapse;font-family:monospace">
        <tr><td><b>Time</b></td><td>${formatDate(timestamp)}</td></tr>
        <tr><td><b>IP</b></td><td>${ip}</td></tr>
        <tr><td><b>User-Agent</b></td><td>${userAgent}</td></tr>
      </table>
    `,
  });

  console.log('[visitor-email-alert] alert sent to', config.adminEmail);
}

module.exports = {
  name: 'visitor-email-alert',

  initialize(eventBus) {
    console.log('[visitor-email-alert] initialize called — SMTP config:', {
      host: config.smtp.host || '(not set)',
      port: config.smtp.port,
      user: config.smtp.user ? '(set)' : '(not set)',
      pass: config.smtp.pass ? '(set)' : '(not set)',
      adminEmail: config.adminEmail || '(not set)',
    });

    if (!config.adminEmail || !config.smtp.user) {
      console.warn('[visitor-email-alert] ADMIN_EMAIL or SMTP_USER not set — plugin disabled');
      return;
    }

    eventBus.on('app:visited', (payload) => {
      sendAlert(payload).catch((err) => {
        console.error('[visitor-email-alert] failed to send email:', err.message);
      });
    });

    console.log('[visitor-email-alert] initialized');
  },

  teardown() {
    transporter?.close?.();
    transporter = null;
  },
};
