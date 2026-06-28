require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const eventBus = require('./eventBus');
const { loadPlugins } = require('./pluginLoader');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check bypasses the visitor-event middleware
app.use('/health', require('../api/health'));

app.use((req, res, next) => {
  eventBus.emit('app:visited', {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: Date.now(),
  });
  next();
});

// API routes
const apiRoutes = [
  ['/api/qr',         '../api/qr'],
  ['/api/status',     '../api/status'],
  ['/api/groups',     '../api/groups'],
  ['/api/send',       '../api/send'],
  ['/api/disconnect', '../api/disconnect'],
  ['/api/version',    '../api/version'],
];

for (const [path, mod] of apiRoutes) {
  try {
    app.use(path, require(mod));
    console.log(`[server] route registered: ${path}`);
  } catch (err) {
    console.error(`[server] FAILED to register ${path}: ${err.message}`);
  }
}

// Serve React frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  loadPlugins();
});

module.exports = app;
