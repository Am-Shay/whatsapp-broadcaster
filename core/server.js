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
app.use('/api/qr', require('../api/qr'));
app.use('/api/status', require('../api/status'));
app.use('/api/groups', require('../api/groups'));
app.use('/api/send', require('../api/send'));
app.use('/api/disconnect', require('../api/disconnect'));
app.use('/api/version', require('../api/version'));

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
