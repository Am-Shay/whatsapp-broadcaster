'use strict';

const { Resend } = require('resend');
const config = require('./config');

const DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes

let lastSentAt = 0;
let resendClient = null;

function getClient() {
  if (!resendClient) resendClient = new Resend(config.apiKey);
  return resendClient;
}

function formatDate(ts) {
  return new Date(ts).toUTCString();
}

// Returns true for loopback / private addresses that ipapi.co can't geo-locate.
function isPrivateIp(ip) {
  const addr = ip.replace(/^::ffff:/, '');
  return (
    addr === '::1' ||
    addr.startsWith('127.') ||
    addr.startsWith('10.') ||
    addr.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(addr)
  );
}

async function fetchGeo(ip) {
  if (isPrivateIp(ip)) return { city: 'Local', country: 'Local network' };
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'User-Agent': 'whatsapp-broadcaster-visitor-alert/1.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { city: 'Unknown', country: 'Unknown' };
    const data = await res.json();
    return {
      city:    data.city    || 'Unknown',
      country: data.country_name || 'Unknown',
    };
  } catch {
    return { city: 'Unknown', country: 'Unknown' };
  }
}

async function sendAlert({ ip, userAgent, timestamp }) {
  const now = Date.now();
  if (now - lastSentAt < DEBOUNCE_MS) return;
  lastSentAt = now;

  console.log(`[visitor-email-resend] sending email to ${config.adminEmail}`);

  const geo = await fetchGeo(ip);
  const dateStr = formatDate(timestamp);

  const { data, error } = await getClient().emails.send({
    from:    'Visitor Alert <onboarding@resend.dev>',
    to:      [config.adminEmail],
    subject: '👀 Someone opened your WhatsApp Broadcaster',
    text: [
      'Your app was visited.',
      '',
      `Time:      ${dateStr}`,
      `IP:        ${ip}`,
      `Location:  ${geo.city}, ${geo.country}`,
      `Browser:   ${userAgent}`,
    ].join('\n'),
    html: `
      <p>Your WhatsApp Broadcaster was visited.</p>
      <table cellpadding="6" style="border-collapse:collapse;font-family:monospace;font-size:14px">
        <tr><td><b>Time</b></td><td>${dateStr}</td></tr>
        <tr><td><b>IP</b></td><td>${ip}</td></tr>
        <tr><td><b>Location</b></td><td>${geo.city}, ${geo.country}</td></tr>
        <tr><td><b>Browser</b></td><td>${userAgent}</td></tr>
      </table>
    `,
  });

  if (error) {
    console.error(`[visitor-email-resend] email FAILED — ${error.message}`);
    return;
  }

  console.log(`[visitor-email-resend] email sent — id: ${data.id}`);
}

module.exports = {
  name: 'visitor-email-resend',

  initialize(eventBus) {
    console.log(`[visitor-email-resend] initialize called — key: ${config.apiKey ? '(set)' : '(not set)'}, adminEmail: ${config.adminEmail || '(not set)'}`);

    if (!config.apiKey || !config.adminEmail) {
      console.warn('[visitor-email-resend] RESEND_API_KEY or ADMIN_EMAIL not set — plugin disabled');
      return;
    }

    eventBus.on('app:visited', (payload) => { sendAlert(payload); });

    console.log('[visitor-email-resend] initialized');
  },

  teardown() {
    resendClient = null;
  },
};
