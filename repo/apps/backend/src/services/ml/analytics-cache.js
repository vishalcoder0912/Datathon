export class AnalyticsCache {
  constructor({ ttlMs = 10 * 60 * 1000, maxEntries = 500 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value) {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }

    this.store.set(key, { value, createdAt: Date.now() });
    return value;
  }

  clear() {
    this.store.clear();
  }
}

export const analyticsCache = new AnalyticsCache({
  ttlMs: Number(process.env.ML_ANALYTICS_CACHE_TTL_MS || 10 * 60 * 1000),
  maxEntries: Number(process.env.ML_ANALYTICS_CACHE_MAX_ENTRIES || 500),
});
