const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const { sendMessage, getIsReady } = require('../core/whatsapp');
const eventBus = require('../core/eventBus');

const router = express.Router();

function randomDelayMs(minSec, maxSec) {
  return (Math.random() * (maxSec - minSec) + minSec) * 1000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Chrome records audio/webm;codecs=opus. WhatsApp sendAudioAsVoice requires audio/ogg;codecs=opus.
// Same Opus codec, different container — ffmpeg remuxes in ~100ms, no re-encode needed.
async function convertToOgg(base64Data) {
  const tmp = path.join(os.tmpdir(), `wa_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const inFile = tmp + '.webm';
  const outFile = tmp + '.ogg';
  try {
    fs.writeFileSync(inFile, Buffer.from(base64Data, 'base64'));
    await new Promise((resolve, reject) => {
      execFile(
        ffmpegPath,
        ['-y', '-i', inFile, '-c:a', 'libopus', '-b:a', '32k', outFile],
        { timeout: 20000 },
        (err) => { err ? reject(err) : resolve(); }
      );
    });
    return fs.readFileSync(outFile).toString('base64');
  } finally {
    try { fs.unlinkSync(inFile); } catch { /* ignore */ }
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
  }
}

async function broadcastToGroups({ groupIds, message, minDelay, maxDelay, mediaItems }) {
  for (let i = 0; i < groupIds.length; i++) {
    const groupId = groupIds[i];

    // Text sent as its own message (separate from files)
    if (message) {
      try {
        const sent = await sendMessage(groupId, message);
        eventBus.emit('message:sent', {
          groupId,
          groupName: sent?.id?.remote ?? groupId,
          type: 'text',
          timestamp: Date.now(),
        });
      } catch (err) {
        eventBus.emit('message:failed', { groupId, error: err.message, retryCount: 0 });
      }
    }

    // Each attachment sent as its own message
    for (let { data, mimetype, filename } of mediaItems) {
      try {
        // WhatsApp voice notes need audio/ogg;codecs=opus — transcode WebM if needed
        if (mimetype.startsWith('audio/') && !mimetype.startsWith('audio/ogg')) {
          data = await convertToOgg(data);
          mimetype = 'audio/ogg; codecs=opus';
        }
        const media = { mimetype, data, filename: filename || 'file' };
        const sent = await sendMessage(groupId, media, {});
        eventBus.emit('message:sent', {
          groupId,
          groupName: sent?.id?.remote ?? groupId,
          type: 'media',
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error(`[send] media failed for ${groupId}:`, err.message);
        eventBus.emit('message:failed', { groupId, error: err.message, retryCount: 0 });
      }
    }

    if (i < groupIds.length - 1) {
      await sleep(randomDelayMs(minDelay, maxDelay));
    }
  }
}

// POST /api/send
// Body: { groupIds, message?, minDelay, maxDelay, mediaItems?: [{data,mimetype,filename}] }
// Backward-compat: also accepts legacy `mediaBase64` (single object → treated as one-item array)
router.post('/', (req, res) => {
  if (!getIsReady()) {
    return res.status(503).json({ error: 'WhatsApp not ready — please scan the QR code first' });
  }

  const { groupIds, message, minDelay, maxDelay, mediaItems, mediaBase64 } = req.body;

  // Normalise media: new array format or legacy single object
  const items = Array.isArray(mediaItems) && mediaItems.length > 0
    ? mediaItems
    : mediaBase64 ? [mediaBase64] : [];

  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return res.status(400).json({ error: 'groupIds must be a non-empty array' });
  }
  if (!message && items.length === 0) {
    return res.status(400).json({ error: 'message or at least one media item is required' });
  }
  if (typeof minDelay !== 'number' || typeof maxDelay !== 'number' || minDelay < 0 || maxDelay < minDelay) {
    return res.status(400).json({ error: 'minDelay and maxDelay must be valid non-negative numbers with minDelay ≤ maxDelay' });
  }

  res.status(202).json({ ok: true, total: groupIds.length });

  broadcastToGroups({ groupIds, message, minDelay, maxDelay, mediaItems: items }).catch((err) => {
    console.error('[send] broadcast error:', err.message);
  });
});

module.exports = router;
