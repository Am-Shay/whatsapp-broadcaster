const express = require('express');
const { getIsReady } = require('../core/whatsapp');

const router = express.Router();

// GET /health — used by Railway health check; always 200 if the server is up
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    whatsapp: getIsReady() ? 'connected' : 'waiting',
    timestamp: Date.now(),
  });
});

module.exports = router;
