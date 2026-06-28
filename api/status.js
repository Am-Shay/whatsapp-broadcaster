const express = require('express');
const { getIsReady, getClient, getInitStartedAt, getStage } = require('../core/whatsapp');

const router = express.Router();

// GET /api/status
router.get('/', (req, res) => {
  const connected = getIsReady();
  const uptimeSeconds = Math.floor(process.uptime());

  if (!connected) {
    return res.json({
      connected: false,
      stage: getStage(),
      initStartedAt: getInitStartedAt(),
      uptimeSeconds,
    });
  }

  const info = getClient()?.info;
  res.json({
    connected: true,
    stage: 'ready',
    phone: info?.wid?.user ?? null,
    name: info?.pushname ?? null,
    uptimeSeconds,
  });
});

module.exports = router;
