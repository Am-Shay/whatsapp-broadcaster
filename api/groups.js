const express = require('express');
const { getGroups } = require('../core/whatsapp');

const router = express.Router();

// GET /api/groups
router.get('/', async (req, res) => {
  try {
    const groups = await getGroups();
    res.json(groups);
  } catch (err) {
    const status = err.message === 'WhatsApp client not ready' ? 503 : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
