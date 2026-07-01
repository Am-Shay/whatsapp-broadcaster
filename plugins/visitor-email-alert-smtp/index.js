const nodemailer = require('nodemailer');
const config = require('./config');

const DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes

let lastSentAt = 0;
let transporter = null;

function getTransporter() {
  if (!transporter) {
    const secure = config.smtp.port === 465;
    console.log(`[visitor-email-alert-smtp] creating transporter — host: ${config.smtp.host}, port: ${config.smtp.port}, secure: ${secure} (${secure ? 'SMTPS/TLS' : 'STARTTLS'})`);
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure,
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

  console.log(`[visitor-email-alert-smtp] sending email to ${config.adminEmail}`);

  try {
    const info = await getTransporter().sendMail({
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
    console.log(`[visitor-email-alert-smtp] email sent — messageId: ${info.messageId}`);
  } catch (err) {
    console.error(`[visitor-email-alert-smtp] email FAILED — ${err.message}`);
  }
}

module.exports = {
  name: 'visitor-email-alert-smtp',

  initialize(eventBus) {
    console.log('[visitor-email-alert-smtp] initialize called — SMTP config:', {
      host: config.smtp.host || '(not set)',
      port: config.smtp.port,
      user: config.smtp.user ? '(set)' : '(not set)',
      pass: config.smtp.pass ? '(set)' : '(not set)',
      adminEmail: config.adminEmail || '(not set)',
    });

    if (!config.adminEmail || !config.smtp.user) {
      console.warn('[visitor-email-alert-smtp] ADMIN_EMAIL or SMTP_USER not set — plugin disabled');
      return;
    }

    eventBus.on('app:visited', (payload) => { sendAlert(payload); });

    console.log('[visitor-email-alert-smtp] initialized');
  },

  teardown() {
    transporter?.close?.();
    transporter = null;
  },
};
