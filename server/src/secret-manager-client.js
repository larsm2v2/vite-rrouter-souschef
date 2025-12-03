// server/src/secret-manager-client.js
// Helper to fetch Google Secret Manager secrets at runtime with a simple in-memory cache.
// Usage:
//   const { getSecret, getSecretsBatch, clearSecretCache } = require('./secret-manager-client');

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
let client = null;
function getClient() {
  if (!client) {
    try {
      client = new SecretManagerServiceClient();
    } catch (err) {
      console.error('Failed to create SecretManagerServiceClient:', err);
      throw err;
    }
  }
  return client;
}

// Simple in-memory cache
// cache[resourceName] = { value: string, expiresAt: timestamp }
const cache = Object.create(null);

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function nowMs() { return Date.now(); }

function buildResourceName(projectId, secretName, version = 'latest') {
  return `projects/${projectId}/secrets/${secretName}/versions/${version}`;
}

async function getSecret(opts = {}) {
  if (!opts || !opts.name) throw new Error('getSecret: opts.name required');

  const name = opts.name;
  const version = opts.version || 'latest';
  const ttlMs = (typeof opts.ttlMs === 'number') ? opts.ttlMs : DEFAULT_TTL_MS;
  const forceRefresh = !!opts.forceRefresh;

  let resourceName = name;
  if (!name.startsWith('projects/')) {
    const projectId = opts.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCLOUD_PROJECT_ID;
    if (!projectId) throw new Error('getSecret: projectId not supplied and GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT not set');
    resourceName = buildResourceName(projectId, name, version);
  }

  const cacheKey = `${resourceName}`;
  if (!forceRefresh) {
    const entry = cache[cacheKey];
    if (entry && entry.expiresAt > nowMs()) {
      return entry.value;
    }
  }

  const theClient = getClient();
  const [accessResponse] = await theClient.accessSecretVersion({ name: resourceName });
  const payload = accessResponse.payload && accessResponse.payload.data
    ? accessResponse.payload.data.toString('utf8')
    : '';

  cache[cacheKey] = { value: payload, expiresAt: nowMs() + ttlMs };
  return payload;
}

async function getSecretsBatch(names = [], options = {}) {
  const tasks = names.map(n => {
    if (typeof n === 'string') return getSecret({ name: n, projectId: options.projectId, version: options.version, ttlMs: options.ttlMs, forceRefresh: options.forceRefresh });
    const { name, version } = n;
    return getSecret({ name, version, projectId: options.projectId, ttlMs: options.ttlMs, forceRefresh: options.forceRefresh });
  });
  const results = await Promise.all(tasks);
  const out = {};
  for (let i = 0; i < names.length; i++) {
    const key = (typeof names[i] === 'string') ? names[i] : names[i].name;
    out[key] = results[i];
  }
  return out;
}

function clearSecretCache(name, version = 'latest', projectId) {
  const resourceName = name.startsWith('projects/') ? name : buildResourceName(projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCLOUD_PROJECT_ID, name, version);
  delete cache[resourceName];
}

module.exports = {
  getSecret,
  getSecretsBatch,
  clearSecretCache,
  _cache: cache,
};
