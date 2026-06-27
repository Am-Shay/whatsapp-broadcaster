const express = require('express');
const fs = require('fs');
const { disconnectClient } = require('../core/whatsapp');

const router = express.Router();

const SESSION_PATH = process.env.SESSION_PATH || './data/session';

// POST /api/disconnect — stops the client and wipes the local session so it
// does not auto-authenticate on the next initializeClient() call.
router.post('/', async (req, res) => {
  try {
    await disconnectClient();
    try {
      fs.rmSync(SESSION_PATH, { recursive: true, force: true });
      fs.mkdirSync(SESSION_PATH, { recursive: true });
    } catch (e) {
      console.warn('[disconnect] could not clear session files:', e.message);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
