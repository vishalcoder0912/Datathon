/**
 * @file agent-memory.js
 * @description Unified memory layer for agents — in-process with optional
 * persistence hooks for Redis / DB backends.
 *
 * Provides:
 *  - Short-term (per-request) memory via ContextMemory
 *  - Long-term (cross-request) memory via AgentMemory
 *  - Schema similarity indexing via SemanticSchemaMemory
 */

// ---------------------------------------------------------------------------
// ContextMemory — per-request scratch pad (lives as long as the context)
// ---------------------------------------------------------------------------

export class ContextMemory {
  constructor(requestId) {
    this.requestId = requestId;
    this._store    = new Map();
    this._createdAt = Date.now();
  }

  set(key, value) { this._store.set(key, value); return this; }
  get(key)        { return this._store.get(key); }
  has(key)        { return this._store.has(key); }
  delete(key)     { return this._store.delete(key); }
  clear()         { this._store.clear(); }

  /** Return all entries as a plain object. */
  dump() {
    return Object.fromEntries(this._store);
  }

  get size() { return this._store.size; }
}

// ---------------------------------------------------------------------------
// AgentMemory — cross-request, per-agent long-term memory
// ---------------------------------------------------------------------------

/**
 * Stores key-value memories that survive across multiple requests.
 * Backed by a JS Map (in-process). Extend with `setPersistenceBackend()`
 * to delegate reads/writes to Redis or a database.
 */
export class AgentMemory {
  /**
   * @param {string} agentId     - Owner agent's ID
   * @param {object} [opts]
   * @param {number} [opts.maxEntries=500] - LRU eviction threshold
   * @param {number} [opts.ttlMs]          - Optional TTL per entry (ms)
   */
  constructor(agentId, { maxEntries = 500, ttlMs = null } = {}) {
    this.agentId    = agentId;
    this.maxEntries = maxEntries;
    this.ttlMs      = ttlMs;

    /** @type {Map<string, { value: any, writtenAt: number }>} */
    this._store  = new Map();

    /** Optional async persistence backend */
    this._backend = null;
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  /**
   * Store a value under a key.
   *
   * @param {string} key
   * @param {any}    value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    // LRU eviction — remove oldest entry if over limit
    if (this._store.size >= this.maxEntries) {
      const oldestKey = this._store.keys().next().value;
      this._store.delete(oldestKey);
    }

    this._store.set(key, { value, writtenAt: Date.now() });

    if (this._backend?.set) {
      await this._backend.set(`${this.agentId}:${key}`, value);
    }
  }

  /**
   * Retrieve a value.
   *
   * @param {string} key
   * @returns {Promise<any|undefined>}
   */
  async get(key) {
    const entry = this._store.get(key);
    if (!entry) {
      // Try backend if available
      if (this._backend?.get) {
        return this._backend.get(`${this.agentId}:${key}`);
      }
      return undefined;
    }

    // Check TTL
    if (this.ttlMs && Date.now() - entry.writtenAt > this.ttlMs) {
      this._store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /** @returns {Promise<boolean>} */
  async has(key) {
    return (await this.get(key)) !== undefined;
  }

  /** @returns {Promise<boolean>} */
  async delete(key) {
    const existed = this._store.delete(key);
    if (this._backend?.delete) {
      await this._backend.delete(`${this.agentId}:${key}`);
    }
    return existed;
  }

  /** Clear all in-process entries. */
  async clear() {
    this._store.clear();
  }

  // -------------------------------------------------------------------------
  // Persistence backend
  // -------------------------------------------------------------------------

  /**
   * Attach an external persistence backend.
   *
   * The backend must implement:
   *   async get(key): any
   *   async set(key, value): void
   *   async delete(key): void
   *
   * Example — a Redis client wrapper:
   *   memory.setPersistenceBackend(redisAdapter);
   *
   * @param {object} backend
   */
  setPersistenceBackend(backend) {
    this._backend = backend;
  }

  // -------------------------------------------------------------------------
  // Diagnostics
  // -------------------------------------------------------------------------

  getStatus() {
    return {
      agentId:       this.agentId,
      entryCount:    this._store.size,
      maxEntries:    this.maxEntries,
      ttlMs:         this.ttlMs,
      hasBackend:    !!this._backend,
    };
  }
}

// ---------------------------------------------------------------------------
// SemanticSchemaMemory — schema similarity index
// ---------------------------------------------------------------------------

/**
 * Lightweight schema similarity store.
 *
 * Stores fingerprints of previously seen schemas so the orchestrator can
 * re-use analysis plans without re-running all agents.
 *
 * Similarity is computed via Jaccard similarity on column name sets.
 * Replace `_similarity()` with a real embedding model for production.
 */
export class SemanticSchemaMemory {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxSchemas=200]     - Max schemas to remember
   * @param {number} [opts.similarityThreshold=0.75]
   */
  constructor({ maxSchemas = 200, similarityThreshold = 0.75 } = {}) {
    this.maxSchemas          = maxSchemas;
    this.similarityThreshold = similarityThreshold;

    /** @type {Map<string, { schema: object, plan: any, hitCount: number }>} */
    this._index = new Map();
  }

  // -------------------------------------------------------------------------
  // Store / Lookup
  // -------------------------------------------------------------------------

  /**
   * Store a schema profile alongside the analytics plan that was generated for it.
   *
   * @param {object} schemaProfile   - Normalised schema profile
   * @param {any}    analyticsPlan   - The plan to cache
   * @returns {string}               - Schema fingerprint key
   */
  store(schemaProfile, analyticsPlan) {
    const key = this._fingerprint(schemaProfile);

    // LRU eviction
    if (this._index.size >= this.maxSchemas) {
      const lruKey = this._lruKey();
      this._index.delete(lruKey);
    }

    this._index.set(key, {
      schema:   schemaProfile,
      plan:     analyticsPlan,
      hitCount: 0,
      storedAt: Date.now(),
    });

    return key;
  }

  /**
   * Find the most similar stored schema.
   *
   * @param {object} schemaProfile
   * @returns {{ match: object, plan: any, similarity: number } | null}
   */
  findSimilar(schemaProfile) {
    let bestKey        = null;
    let bestSimilarity = 0;

    for (const [key, entry] of this._index.entries()) {
      const sim = this._similarity(schemaProfile, entry.schema);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestKey        = key;
      }
    }

    if (bestKey && bestSimilarity >= this.similarityThreshold) {
      const entry = this._index.get(bestKey);
      entry.hitCount++;
      return { match: entry.schema, plan: entry.plan, similarity: bestSimilarity };
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Create a stable string key from a schema profile.
   * Uses sorted column names to be order-independent.
   */
  _fingerprint(schemaProfile) {
    const cols = (schemaProfile.columns ?? [])
      .map(c => `${c.name}:${c.type}`)
      .sort()
      .join('|');
    return `${schemaProfile.domain ?? 'generic'}::${cols}`;
  }

  /**
   * Jaccard similarity between two schema's column name sets.
   * Returns a value in [0, 1].
   */
  _similarity(a, b) {
    const setA = new Set((a.columns ?? []).map(c => c.name.toLowerCase()));
    const setB = new Set((b.columns ?? []).map(c => c.name.toLowerCase()));

    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union        = new Set([...setA, ...setB]).size;

    return union === 0 ? 0 : intersection / union;
  }

  /** Return the key with the lowest hit count (least recently used proxy). */
  _lruKey() {
    let minHits = Infinity;
    let lruKey  = null;
    for (const [key, entry] of this._index.entries()) {
      if (entry.hitCount < minHits) {
        minHits = entry.hitCount;
        lruKey  = key;
      }
    }
    return lruKey;
  }

  // -------------------------------------------------------------------------
  // Diagnostics
  // -------------------------------------------------------------------------

  getStatus() {
    return {
      storedSchemas:       this._index.size,
      maxSchemas:          this.maxSchemas,
      similarityThreshold: this.similarityThreshold,
      topSchemas: [...this._index.entries()]
        .sort(([, a], [, b]) => b.hitCount - a.hitCount)
        .slice(0, 5)
        .map(([key, e]) => ({ key, hitCount: e.hitCount, domain: e.schema.domain })),
    };
  }
}

// ---------------------------------------------------------------------------
// Global singletons
// ---------------------------------------------------------------------------

export const globalSchemaMemory = new SemanticSchemaMemory();
