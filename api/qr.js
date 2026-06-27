const express = require('express');
const QRCode = require('qrcode');
const eventBus = require('../core/eventBus');
const { getIsReady, initializeClient } = require('../core/whatsapp');

const router = express.Router();

let latestQR = null;

eventBus.on('whatsapp:qr', ({ qr }) => { latestQR = qr; });
eventBus.on('whatsapp:ready', () => { latestQR = null; });
eventBus.on('whatsapp:disconnected', () => { latestQR = null; });

// GET /api/qr
// If no client is running (e.g. after a manual disconnect), kick off a fresh
// initialization so a new QR gets generated. The isInitializing guard inside
// initializeClient() makes this safe to call on every poll.
router.get('/', async (req, res) => {
  if (getIsReady()) {
    return res.json({ qr: null, connected: true });
  }

  initializeClient();

  if (!latestQR) {
    return res.json({ qr: null, connected: false });
  }

  try {
    const dataUrl = await QRCode.toDataURL(latestQR);
    res.json({ qr: dataUrl, connected: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR image' });
  }
});

module.exports = router;
