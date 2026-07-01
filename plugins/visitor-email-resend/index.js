'use strict';

const { Resend } = require('resend');
const config = require('./config');

const DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes — visitor alert
const CONNECTION_DEBOUNCE_MS    = 60 * 1000;      // 60 seconds — connection alert
const DISCONNECTION_DEBOUNCE_MS = 5 * 60 * 1000;  // 5 minutes  — disconnection alert
const DISCONNECTION_GRACE_MS    = 2 * 60 * 1000;  // 2 minutes  — blip grace period

let lastSentAt = 0;
let lastConnectionSentAt = 0;
let lastDisconnectionSentAt = 0;
let pendingDisconnectTimer = null; // cancelled if Baileys reconnects within the grace window
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
  const remaining = DEBOUNCE_MS - (now - lastSentAt);
  if (remaining > 0) {
    console.log(`[visitor-email-resend] APP:VISITED debounce active — skipping (${Math.ceil(remaining / 1000)}s remaining)`);
    return;
  }
  lastSentAt = now;

  console.log(`[visitor-email-resend] APP:VISITED calling sendAlert() — sending email to ${config.adminEmail}`);

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

async function sendConnectionAlert({ phone, name }) {
  const now = Date.now();
  const remaining = CONNECTION_DEBOUNCE_MS - (now - lastConnectionSentAt);
  if (remaining > 0) {
    console.log(`[visitor-email-resend] WHATSAPP:READY debounce active — skipping (${Math.ceil(remaining / 1000)}s remaining)`);
    return;
  }
  lastConnectionSentAt = now;

  console.log(`[visitor-email-resend] WHATSAPP:READY calling sendConnectionAlert() — sending email to ${config.adminEmail}`);

  const dateStr = formatDate(now);

  const { data, error } = await getClient().emails.send({
    from:    'Visitor Alert <onboarding@resend.dev>',
    to:      [config.adminEmail],
    subject: '✅ WhatsApp Broadcaster — user connected',
    text: [
      'A user connected to your WhatsApp Broadcaster.',
      '',
      `Time:   ${dateStr}`,
      `Phone:  +${phone}`,
      `Name:   ${name || '(unknown)'}`,
    ].join('\n'),
    html: `
      <p>A user connected to your WhatsApp Broadcaster.</p>
      <table cellpadding="6" style="border-collapse:collapse;font-family:monospace;font-size:14px">
        <tr><td><b>Time</b></td><td>${dateStr}</td></tr>
        <tr><td><b>Phone</b></td><td>+${phone}</td></tr>
        <tr><td><b>Name</b></td><td>${name || '(unknown)'}</td></tr>
      </table>
    `,
  });

  if (error) {
    console.error(`[visitor-email-resend] email FAILED — ${error.message}`);
    return;
  }

  console.log(`[visitor-email-resend] email sent — id: ${data.id}`);
}

const REASON_LABELS = {
  user_initiated: 'User initiated (Disconnect button)',
  connection_lost: 'Connection lost (unexpected)',
};

async function sendDisconnectionAlert({ phone, name, reason }) {
  const now = Date.now();
  const remaining = DISCONNECTION_DEBOUNCE_MS - (now - lastDisconnectionSentAt);
  if (remaining > 0) {
    console.log(`[visitor-email-resend] WHATSAPP:DISCONNECTED debounce active — skipping (${Math.ceil(remaining / 1000)}s remaining)`);
    return;
  }
  lastDisconnectionSentAt = now;

  const reasonLabel = REASON_LABELS[reason] ?? reason ?? 'Unknown';
  console.log(`[visitor-email-resend] WHATSAPP:DISCONNECTED calling sendDisconnectionAlert() — reason: ${reason}`);

  const dateStr = formatDate(now);

  const { data, error } = await getClient().emails.send({
    from:    'Visitor Alert <onboarding@resend.dev>',
    to:      [config.adminEmail],
    subject: '⚠️ WhatsApp Broadcaster — user disconnected',
    text: [
      'A user disconnected from your WhatsApp Broadcaster.',
      '',
      `Time:    ${dateStr}`,
      `Phone:   ${phone ? `+${phone}` : 'Unknown'}`,
      `Name:    ${name || 'Unknown'}`,
      `Reason:  ${reasonLabel}`,
    ].join('\n'),
    html: `
      <p>A user disconnected from your WhatsApp Broadcaster.</p>
      <table cellpadding="6" style="border-collapse:collapse;font-family:monospace;font-size:14px">
        <tr><td><b>Time</b></td><td>${dateStr}</td></tr>
        <tr><td><b>Phone</b></td><td>${phone ? `+${phone}` : 'Unknown'}</td></tr>
        <tr><td><b>Name</b></td><td>${name || 'Unknown'}</td></tr>
        <tr><td><b>Reason</b></td><td>${reasonLabel}</td></tr>
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

    eventBus.on('app:visited', (payload) => {
      console.log('[visitor-email-resend] APP:VISITED handler fired');
      sendAlert(payload);
    });

    eventBus.on('whatsapp:disconnected', (payload) => {
      console.log('[visitor-email-resend] WHATSAPP:DISCONNECTED handler fired — payload:', JSON.stringify(payload));

      if (payload.reason === 'user_initiated') {
        // Explicit logout — send immediately, no auto-reconnect expected
        sendDisconnectionAlert(payload);
        return;
      }

      // Connection blip — wait before sending; cancel if Baileys reconnects first
      if (pendingDisconnectTimer) clearTimeout(pendingDisconnectTimer);
      pendingDisconnectTimer = setTimeout(() => {
        pendingDisconnectTimer = null;
        console.log('[visitor-email-resend] WHATSAPP:DISCONNECTED grace period elapsed — sending disconnect email');
        sendDisconnectionAlert(payload);
      }, DISCONNECTION_GRACE_MS);
      console.log(`[visitor-email-resend] WHATSAPP:DISCONNECTED grace period started — will email in ${DISCONNECTION_GRACE_MS / 1000}s if no reconnect`);
    });

    eventBus.on('whatsapp:ready', (payload) => {
      console.log('[visitor-email-resend] WHATSAPP:READY handler fired');

      if (pendingDisconnectTimer) {
        // Reconnected within the grace period — this is a blip, suppress both emails
        clearTimeout(pendingDisconnectTimer);
        pendingDisconnectTimer = null;
        console.log('[visitor-email-resend] WHATSAPP:READY blip reconnect — suppressing both disconnect and connect emails');
        return;
      }

      sendConnectionAlert(payload);
    });

    console.log('[visitor-email-resend] initialized');
  },

  teardown() {
    if (pendingDisconnectTimer) { clearTimeout(pendingDisconnectTimer); pendingDisconnectTimer = null; }
    resendClient = null;
  },
};
