const express = require('express');
const { getIsReady, getClient } = require('../core/whatsapp');

const router = express.Router();

// GET /api/status
router.get('/', (req, res) => {
  const connected = getIsReady();
  if (!connected) {
    return res.json({ connected: false });
  }

  const info = getClient()?.info;
  res.json({
    connected: true,
    phone: info?.wid?.user ?? null,
    name: info?.pushname ?? null,
  });
});

module.exports = router;
