require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const eventBus = require('./eventBus');

const SESSION_PATH = process.env.SESSION_PATH || './data/session';
const RECONNECT_DELAY_MS = 5000;

const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.opus']);

let client = null;
let isReady = false;
let isInitializing = false;
let initStartedAt = null;
let stage = 'disconnected';
let skipNextReconnect = false;

// Groups cache — populated immediately when WhatsApp is ready, before Chrome
// gets busy with background message sync. Served for all subsequent requests.
let groupsCache = null;
let groupsCacheTime = 0;
const GROUPS_CACHE_TTL_MS = 5 * 60 * 1000; // refresh every 5 minutes

function buildClient() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
      ],
    },
  });
}

function scheduleReconnect() {
  console.log(`[whatsapp] reconnecting in ${RECONNECT_DELAY_MS}ms…`);
  setTimeout(initializeClient, RECONNECT_DELAY_MS);
}

// Fetches groups directly from the WhatsApp Web page store.
// Returns an array of {id, name} or throws on timeout/error.
async function fetchGroupsFromPage() {
  const TIMEOUT_MS = 30000;
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`fetchGroups timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
  );

  // Try fast path: direct store evaluation (no full chat serialisation)
  const result = await Promise.race([
    client.pupPage.evaluate(() => {
      try {
        return window.Store.Chat.getModelsArray()
          .filter(c => c.isGroup)
          .map(c => ({ id: c.id._serialized, name: c.formattedTitle || c.name || '' }));
      } catch (e) {
        return { __error: e.message };
      }
    }),
    timeout,
  ]);

  if (result && result.__error) {
    // Store.Chat not available — fall back to the full getChats() path
    console.warn('[whatsapp] Store.Chat unavailable, falling back to getChats():', result.__error);
    const chats = await Promise.race([client.getChats(), timeout]);
    return chats
      .filter(c => c.isGroup)
      .map(c => ({ id: c.id._serialized, name: c.name }));
  }

  return result;
}

// Pre-warms the groups cache right when WhatsApp is ready, before Chrome
// starts the heavy background message sync that makes evaluations hang.
async function warmGroupsCache() {
  try {
    console.log('[whatsapp] warming groups cache…');
    const groups = await fetchGroupsFromPage();
    groupsCache = groups;
    groupsCacheTime = Date.now();
    console.log(`[whatsapp] groups cache ready — ${groups.length} groups`);
  } catch (err) {
    console.error('[whatsapp] groups cache warm failed:', err.message);
  }
}

async function initializeClient() {
  if (isInitializing || isReady) return;
  isInitializing = true;
  initStartedAt = Date.now();
  stage = 'initializing';

  if (client) {
    try { await client.destroy(); } catch { /* ignore */ }
    client = null;
  }
  client = buildClient();

  client.on('loading_screen', () => {
    stage = 'browser_starting';
  });

  client.on('qr', (qr) => {
    stage = 'qr_ready';
    eventBus.emit('whatsapp:qr', { qr });
  });

  client.on('authenticated', () => {
    stage = 'connecting';
  });

  client.on('ready', () => {
    isReady = true;
    isInitializing = false;
    initStartedAt = null;
    stage = 'ready';
    const { wid, pushname } = client.info;
    eventBus.emit('whatsapp:ready', { phone: wid.user, name: pushname });
    console.log(`[whatsapp] ready — ${pushname} (${wid.user})`);

    // Warm the cache immediately — Chrome is idlest right at ready time
    warmGroupsCache();
  });

  client.on('auth_failure', (msg) => {
    console.error('[whatsapp] auth failure:', msg);
    isReady = false;
    isInitializing = false;
    stage = 'disconnected';
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    isInitializing = false;
    stage = 'disconnected';
    groupsCache = null;
    groupsCacheTime = 0;
    eventBus.emit('whatsapp:disconnected', {});
    console.log('[whatsapp] disconnected:', reason);
    if (skipNextReconnect) {
      skipNextReconnect = false;
      return;
    }
    scheduleReconnect();
  });

  client.initialize().catch((err) => {
    console.error('[whatsapp] initialization error:', err.message);
    isReady = false;
    isInitializing = false;
    scheduleReconnect();
  });
}

// Called by api/disconnect — stops the client without triggering auto-reconnect.
async function disconnectClient() {
  skipNextReconnect = true;
  isReady = false;
  isInitializing = false;
  stage = 'disconnected';
  groupsCache = null;
  groupsCacheTime = 0;
  if (client) {
    try { await client.destroy(); } catch { /* ignore */ }
    client = null;
  }
}

async function getGroups() {
  if (!isReady) throw new Error('WhatsApp client not ready');

  // Serve from cache if fresh
  if (groupsCache && Date.now() - groupsCacheTime < GROUPS_CACHE_TTL_MS) {
    return groupsCache;
  }

  // Cache miss or stale — fetch live and update cache
  const groups = await fetchGroupsFromPage();
  groupsCache = groups;
  groupsCacheTime = Date.now();
  return groups;
}

async function sendMessage(groupId, content, extraOpts = {}) {
  if (!isReady) throw new Error('WhatsApp client not ready');

  // Pre-built MessageMedia (from base64 upload)
  if (content instanceof MessageMedia) {
    const isAudio = content.mimetype?.startsWith('audio/');
    const opts = isAudio ? { sendAudioAsVoice: true, ...extraOpts } : extraOpts;
    return client.sendMessage(groupId, content, opts);
  }

  // Plain text
  const looksLikePath = typeof content === 'string' && fs.existsSync(content);
  if (!looksLikePath) {
    return client.sendMessage(groupId, content, extraOpts);
  }

  // File path
  const media = MessageMedia.fromFilePath(content);
  const ext = path.extname(content).toLowerCase();
  if (AUDIO_EXTENSIONS.has(ext)) {
    return client.sendMessage(groupId, media, { sendAudioAsVoice: true, ...extraOpts });
  }
  return client.sendMessage(groupId, media, extraOpts);
}

function getClient() { return client; }
function getIsReady() { return isReady; }
function getIsInitializing() { return isInitializing; }
function getInitStartedAt() { return initStartedAt; }
function getStage() { return stage; }

initializeClient();

module.exports = { getGroups, sendMessage, getClient, getIsReady, getIsInitializing, getInitStartedAt, getStage, initializeClient, disconnectClient };
