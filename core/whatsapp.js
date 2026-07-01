require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const eventBus = require('./eventBus');

const SESSION_PATH      = process.env.SESSION_PATH || './data/session';
const RECONNECT_DELAY_MS = 5000;

let sock              = null;   // Baileys socket
let isReady           = false;
let isInitializing    = false;
let initStartedAt     = null;
let stage             = 'disconnected';
let skipNextReconnect = false;
let connectedUser     = null;  // { phone, name }
let lastKnownPhone    = null;
let lastKnownName     = null;
let disconnectReason  = null;  // 'user_initiated' | 'connection_lost'

let groupsCache       = null;
let groupsCacheTime   = 0;
const GROUPS_CACHE_TTL_MS = 5 * 60 * 1000;
let groupsFetchPromise = null;

function scheduleReconnect() {
  console.log(`[whatsapp] reconnecting in ${RECONNECT_DELAY_MS}ms…`);
  setTimeout(initializeClient, RECONNECT_DELAY_MS);
}

// ── groups ────────────────────────────────────────────────────────────────────

async function fetchGroups() {
  if (!sock) throw new Error('WhatsApp client not ready');
  const groupMap = await sock.groupFetchAllParticipating();
  return Object.values(groupMap)
    .filter(g => g.id && g.subject)
    .map(g => ({ id: g.id, name: g.subject }));
}

async function warmGroupsCache() {
  try {
    console.log('[whatsapp] warming groups cache…');
    const groups = await getGroups();
    console.log(`[whatsapp] groups cache ready — ${groups.length} groups`);
  } catch (err) {
    console.error('[whatsapp] groups cache warm failed:', err.message);
  }
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

async function initializeClient() {
  if (isInitializing || isReady) return;
  isInitializing = true;
  initStartedAt  = Date.now();
  stage          = 'initializing';

  try {
    fs.mkdirSync(SESSION_PATH, { recursive: true });

    let logger;
    try { logger = require('pino')({ level: 'silent' }); } catch {}

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

    let version;
    try { ({ version } = await fetchLatestBaileysVersion()); } catch {}

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ['WhatsApp Broadcaster', 'Chrome', '1.0.0'],
    });

    // Capture reference so stale close events from a previous socket are ignored.
    // Without this, a delayed close event from the old socket after disconnect
    // nulls `sock` and corrupts state even after a new socket is already running.
    const thisSock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      if (thisSock !== sock) return; // superseded socket — ignore
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[whatsapp] QR generation triggered — emitting whatsapp:qr');
        stage = 'qr_ready';
        eventBus.emit('whatsapp:qr', { qr });
        console.log('[whatsapp] QR code ready');
      }

      // Brief "connecting" phase between QR scan and session open
      if (connection === 'connecting' && stage === 'qr_ready') {
        stage = 'connecting';
      }

      if (connection === 'open') {
        const user  = sock.user ?? {};
        const rawId = user.id ?? '';
        // Baileys id format: "15551234567:12@s.whatsapp.net"
        const phone = rawId.split(':')[0].split('@')[0];
        const name  = user.name || user.notify || '';

        connectedUser  = { phone, name };
        lastKnownPhone = phone;
        lastKnownName  = name;
        disconnectReason = null;
        // Patch .info so api/status.js (which reads client.info.wid.user) works unchanged
        sock.info = { wid: { user: phone }, pushname: name };

        isReady        = true;
        isInitializing = false;
        initStartedAt  = null;
        stage          = 'ready';

        eventBus.emit('whatsapp:ready', { phone, name });
        console.log(`[whatsapp] ready — ${name} (${phone})`);
        warmGroupsCache();
      }

      if (connection === 'close') {
        const statusCode    = lastDisconnect?.error?.output?.statusCode;
        const loggedOut     = statusCode === DisconnectReason.loggedOut;
        const restartNeeded = statusCode === DisconnectReason.restartRequired;

        // Capture before state reset wipes these values
        const wasReady     = isReady;
        const reason       = disconnectReason ?? 'connection_lost';
        const phone        = lastKnownPhone;
        const disconnName  = lastKnownName;

        isReady          = false;
        isInitializing   = false;
        initStartedAt    = null;
        stage            = 'disconnected';
        connectedUser    = null;
        groupsCache      = null;
        groupsCacheTime  = 0;
        sock             = null;
        disconnectReason = null;
        console.log('[whatsapp] disconnected — code:', statusCode, '— reason:', reason, '— wasReady:', wasReady);
        // Only emit if the session was actually open — skips spurious Baileys
        // restartRequired closes that fire during the QR handshake before 'open'.
        if (wasReady || reason === 'user_initiated') {
          eventBus.emit('whatsapp:disconnected', { phone, name: disconnName, reason });
        }

        if (skipNextReconnect)  { skipNextReconnect = false; return; }
        if (loggedOut)          { console.log('[whatsapp] logged out — awaiting new session'); return; }
        if (restartNeeded)      { console.log('[whatsapp] restart required'); initializeClient(); return; }
        scheduleReconnect();
      }
    });

  } catch (err) {
    console.error('[whatsapp] initialization error:', err.message);
    isReady        = false;
    isInitializing = false;
    stage          = 'disconnected';
    scheduleReconnect();
  }
}

async function disconnectClient() {
  disconnectReason  = 'user_initiated';
  skipNextReconnect = true;
  isReady           = false;
  isInitializing    = false;
  stage             = 'disconnected';
  connectedUser     = null;
  groupsCache       = null;
  groupsCacheTime   = 0;
  if (sock) { try { sock.end(undefined); } catch {} sock = null; }
}

// ── public API ────────────────────────────────────────────────────────────────

async function getGroups() {
  if (!isReady) throw new Error('WhatsApp client not ready');

  if (groupsCache && Date.now() - groupsCacheTime < GROUPS_CACHE_TTL_MS) {
    return groupsCache;
  }

  // Deduplicate concurrent requests
  if (!groupsFetchPromise) {
    groupsFetchPromise = fetchGroups()
      .then(groups => {
        groupsCache        = groups;
        groupsCacheTime    = Date.now();
        groupsFetchPromise = null;
        return groups;
      })
      .catch(err => {
        groupsFetchPromise = null;
        throw err;
      });
  }

  return groupsFetchPromise;
}

async function sendMessage(groupId, content) {
  if (!isReady) throw new Error('WhatsApp client not ready');

  // File path (legacy — not sent by api/send.js, kept for programmatic use)
  if (typeof content === 'string' && fs.existsSync(content)) {
    const buf = fs.readFileSync(content);
    const ext = path.extname(content).toLowerCase();
    if (new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.opus']).has(ext)) {
      return sock.sendMessage(groupId, { audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: true });
    }
    if (new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']).has(ext)) {
      return sock.sendMessage(groupId, { image: buf });
    }
    if (new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm']).has(ext)) {
      return sock.sendMessage(groupId, { video: buf });
    }
    return sock.sendMessage(groupId, { document: buf, fileName: path.basename(content) });
  }

  // Plain text
  if (typeof content === 'string') {
    return sock.sendMessage(groupId, { text: content });
  }

  // MessageMedia-like object: { data (base64), mimetype, filename }
  // api/send.js creates these via new MessageMedia(mimetype, data, filename)
  if (content && typeof content.data === 'string' && content.mimetype) {
    const buf      = Buffer.from(content.data, 'base64');
    const { mimetype, filename } = content;

    if (mimetype.startsWith('audio/')) {
      return sock.sendMessage(groupId, { audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: true });
    }
    if (mimetype.startsWith('image/')) return sock.sendMessage(groupId, { image: buf });
    if (mimetype.startsWith('video/')) return sock.sendMessage(groupId, { video: buf });
    return sock.sendMessage(groupId, { document: buf, mimetype, fileName: filename || 'file' });
  }

  throw new Error('sendMessage: unsupported content type');
}

// Returns the Baileys socket, augmented with .info for api/status.js compatibility.
// api/status.js reads client.info.wid.user and client.info.pushname.
function getClient()        { return isReady ? sock : null; }
function getIsReady()       { return isReady; }
function getIsInitializing(){ return isInitializing; }
function getInitStartedAt() { return initStartedAt; }
function getStage()         { return stage; }

initializeClient();

module.exports = {
  getGroups,
  sendMessage,
  getClient,
  getIsReady,
  getIsInitializing,
  getInitStartedAt,
  getStage,
  initializeClient,
  disconnectClient,
};
