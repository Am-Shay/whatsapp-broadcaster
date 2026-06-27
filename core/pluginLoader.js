const appConfig = require('../config/app.config');
const eventBus = require('./eventBus');

function loadPlugins() {
  for (const entry of appConfig.plugins) {
    if (!entry.enabled) {
      console.log(`[plugins] skipped (disabled): ${entry.name}`);
      continue;
    }

    try {
      const plugin = require(entry.path);
      plugin.initialize(eventBus);
    } catch (err) {
      // A broken plugin must never take down the server
      console.error(`[plugins] failed to load "${entry.name}":`, err.message);
    }
  }
}

module.exports = { loadPlugins };
