require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodePath = require('path');
const eventBus = require('./eventBus');
const { loadPlugins } = require('./pluginLoader');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Log every incoming request so we can see what Railway forwards
app.use((req, res, next) => {
  console.log(`[server] ${req.method} ${req.path}`);
  next();
});

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

for (const [routePath, mod] of apiRoutes) {
  try {
    app.use(routePath, require(mod));
    console.log(`[server] route registered: ${routePath}`);
  } catch (err) {
    console.error(`[server] FAILED to register ${routePath}: ${err.message}`);
  }
}

// Serve React frontend
app.use(express.static(nodePath.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(nodePath.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  loadPlugins();
});

module.exports = app;
