const appConfig = require('../config/app.config');
const eventBus = require('./eventBus');

function loadPlugins() {
  console.log(`[pluginLoader] loading ${appConfig.plugins.length} plugin(s)`);

  for (const entry of appConfig.plugins) {
    if (!entry.enabled) {
      console.log(`[pluginLoader] skipped (disabled): ${entry.name}`);
      continue;
    }

    try {
      const plugin = require(entry.path);
      plugin.initialize(eventBus);
      console.log(`[pluginLoader] loaded plugin: ${entry.name}`);
    } catch (err) {
      // A broken plugin must never take down the server
      console.error(`[pluginLoader] failed to load "${entry.name}":`, err.stack || err.message || err);
    }
  }
}

module.exports = { loadPlugins };
