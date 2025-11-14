// server/src/secret-manager-example.js
// Example usage of secret-manager-client.js

const { getSecret, getSecretsBatch, clearSecretCache } = require('./secret-manager-client');

async function startupCache() {
  try {
    console.log('Fetching critical secrets at startup...');
    const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
    const loaded = await getSecretsBatch(keys, { ttlMs: 5 * 60 * 1000 });
    console.log('Loaded secrets:', Object.keys(loaded));
    // Use loaded.GOOGLE_CLIENT_ID etc. in your app initialization
  } catch (err) {
    console.error('Failed to load secrets at startup', err);
    throw err;
  }
}

// Periodic refresh example (background)
function scheduleRefresh(intervalMs = 5 * 60 * 1000) {
  setInterval(async () => {
    try {
      console.log('Refreshing secret cache...');
      // forceRefresh true to bypass cache
      await getSecretsBatch(['GOOGLE_CLIENT_SECRET'], { forceRefresh: true });
      console.log('Refresh done');
    } catch (e) {
      console.warn('Refresh failed', e.message || e);
    }
  }, intervalMs);
}

// Example: run startup cache and schedule refresh when used as a script
if (require.main === module) {
  (async () => {
    await startupCache();
    scheduleRefresh();
    console.log('Secret manager example running.');
  })();
}

module.exports = { startupCache, scheduleRefresh };
