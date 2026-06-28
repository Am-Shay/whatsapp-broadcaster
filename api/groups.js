const express = require('express');
const { getGroups } = require('../core/whatsapp');

const router = express.Router();

// GET /api/groups
router.get('/', async (req, res) => {
  console.log('[groups] handler called');
  try {
    const groups = await getGroups();
    console.log(`[groups] returning ${groups.length} groups`);
    res.json(groups);
  } catch (err) {
    console.error('[groups] error:', err.message);
    const status = err.message === 'WhatsApp client not ready' ? 503 : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
