const express = require('express');
const { version } = require('../package.json');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ version });
});

module.exports = router;
