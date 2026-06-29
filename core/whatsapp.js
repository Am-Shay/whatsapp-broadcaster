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
const GROUPS_CACHE_TTL_MS = 5 * 60 * 1000;

// Deduplicates concurrent getGroups() calls during a live fetch.
let groupsFetchPromise = null;

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
      ],
    },
  });
}

function scheduleReconnect() {
  console.log(`[whatsapp] reconnecting in ${RECONNECT_DELAY_MS}ms…`);
  setTimeout(initializeClient, RECONNECT_DELAY_MS);
}

// Fetches groups by polling window.Store.Chat until it's available.
// If Store never appears (injection failed), triggers a client reinit and throws.
async function fetchGroupsFromPage() {
  const POLL_MS = 3000;
  // If window.Store is still absent after this long, the inject() call failed.
  const STORE_DEADLINE_MS = 15000;
  const storeDeadline = Date.now() + STORE_DEADLINE_MS;

  while (true) {
    let result;
    try {
      result = await client.pupPage.evaluate(() => {
        if (!window.Store)      return { status: 'no_store' };
        if (!window.Store.Chat) return { status: 'no_chat' };
        try {
          return window.Store.Chat.getModelsArray()
            .filter(c => c.isGroup)
            .map(c => ({ id: c.id._serialized, name: c.formattedTitle || c.name || '' }));
        } catch (e) {
          return { status: 'error', message: e.message };
        }
      });
    } catch (evalErr) {
      throw new Error(`page evaluate failed: ${evalErr.message}`);
    }

    // Success — return the groups array (may be empty if no groups yet)
    if (Array.isArray(result)) return result;

    if (result.status === 'error') throw new Error(result.message);

    // Store or Chat not initialised yet — check deadline then retry
    if (Date.now() > storeDeadline) {
      console.error('[whatsapp] window.Store unavailable after 15 s — injection failed, reinitialising');
      // Async so this function can throw before the reinit starts
      setImmediate(async () => {
        if (isInitializing) return;
        isReady = false;
        isInitializing = false;
        stage = 'disconnected';
        groupsCache = null;
        groupsCacheTime = 0;
        if (client) { try { await client.destroy(); } catch {} client = null; }
        scheduleReconnect();
      });
      throw new Error('WhatsApp injection failed — reinitialising client');
    }

    console.log(`[whatsapp] ${result.status} — retrying in ${POLL_MS / 1000}s`);
    await new Promise(r => setTimeout(r, POLL_MS));
  }
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

  if (groupsCache && Date.now() - groupsCacheTime < GROUPS_CACHE_TTL_MS) {
    return groupsCache;
  }

  // Deduplicate: if a live fetch is already running, share its promise
  if (!groupsFetchPromise) {
    groupsFetchPromise = fetchGroupsFromPage()
      .then(groups => {
        groupsCache = groups;
        groupsCacheTime = Date.now();
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
