/**
 * @file agent-message-bus.js
 * @description Lightweight in-process pub-sub message bus for inter-agent communication.
 *
 * Agents publish structured messages to named channels.
 * Other agents subscribe to receive them synchronously or asynchronously.
 *
 * This is intentionally simple — no persistence, no external broker.
 * Swap with Redis Pub/Sub or NATS for distributed deployments.
 */

// ---------------------------------------------------------------------------
// AgentMessage — typed message envelope
// ---------------------------------------------------------------------------

export class AgentMessage {
  /**
   * @param {object} opts
   * @param {string}   opts.fromAgentId   - Sender agent ID
   * @param {string}   opts.toAgentId     - Target agent ID (or '*' for broadcast)
   * @param {string}   opts.channel       - Logical channel name (e.g. 'schema.ready')
   * @param {any}      opts.payload       - The message body
   * @param {string}   [opts.requestId]   - Correlation ID for tracing
   * @param {string}   [opts.replyTo]     - Channel to send a response to (optional)
   */
  constructor({ fromAgentId, toAgentId = '*', channel, payload, requestId = null, replyTo = null }) {
    this.id          = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.fromAgentId = fromAgentId;
    this.toAgentId   = toAgentId;
    this.channel     = channel;
    this.payload     = payload;
    this.requestId   = requestId;
    this.replyTo     = replyTo;
    this.timestamp   = Date.now();
  }
}

// ---------------------------------------------------------------------------
// AgentMessageBus
// ---------------------------------------------------------------------------

export class AgentMessageBus {
  constructor() {
    /**
     * channel → Set of subscriber callbacks
     * @type {Map<string, Set<Function>>}
     */
    this._subscribers = new Map();

    /** Message history — last N messages per channel (for replay / debugging) */
    this._historyLimit = 50;

    /** @type {Map<string, AgentMessage[]>} */
    this._history = new Map();

    /** Total messages published since startup */
    this._totalPublished = 0;
  }

  // -------------------------------------------------------------------------
  // Publish
  // -------------------------------------------------------------------------

  /**
   * Publish a message to a channel.
   * All subscribers on that channel are called synchronously in order.
   *
   * @param {string}   channel        - e.g. 'schema.ready', 'analytics.plan'
   * @param {any}      payload        - The message body
   * @param {object}   [opts]         - Optional message metadata
   * @param {string}   [opts.fromAgentId]
   * @param {string}   [opts.toAgentId]
   * @param {string}   [opts.requestId]
   * @param {string}   [opts.replyTo]
   * @returns {AgentMessage}          - The created message (for chaining / debugging)
   */
  publish(channel, payload, opts = {}) {
    const message = new AgentMessage({ channel, payload, ...opts });
    this._record(channel, message);
    this._totalPublished++;

    const subscribers = this._subscribers.get(channel) ?? new Set();
    const wildcardSubscribers = this._subscribers.get('*') ?? new Set();

    for (const fn of [...subscribers, ...wildcardSubscribers]) {
      try {
        fn(message);
      } catch (err) {
        console.error(`[AgentMessageBus] Subscriber error on channel "${channel}":`, err.message);
      }
    }

    return message;
  }

  /**
   * Async publish — awaits all subscriber Promises before returning.
   * Use when subscribers do async work and ordering matters.
   *
   * @param {string} channel
   * @param {any}    payload
   * @param {object} [opts]
   * @returns {Promise<void>}
   */
  async publishAsync(channel, payload, opts = {}) {
    const message = new AgentMessage({ channel, payload, ...opts });
    this._record(channel, message);
    this._totalPublished++;

    const subscribers = [
      ...(this._subscribers.get(channel) ?? []),
      ...(this._subscribers.get('*') ?? []),
    ];

    await Promise.allSettled(
      subscribers.map(fn => {
        try { return Promise.resolve(fn(message)); } catch (e) { return Promise.reject(e); }
      })
    );

    return message;
  }

  // -------------------------------------------------------------------------
  // Subscribe / Unsubscribe
  // -------------------------------------------------------------------------

  /**
   * Subscribe to a channel.
   *
   * @param {string}   channel   - Channel name or '*' for all messages
   * @param {Function} listener  - Called with (AgentMessage) on every publish
   * @returns {Function}         - Unsubscribe function (call to remove the listener)
   */
  subscribe(channel, listener) {
    if (!this._subscribers.has(channel)) {
      this._subscribers.set(channel, new Set());
    }
    this._subscribers.get(channel).add(listener);

    // Return an unsubscribe handle
    return () => this.unsubscribe(channel, listener);
  }

  /**
   * One-time subscription — listener fires once then auto-unsubscribes.
   *
   * @param {string}   channel
   * @param {Function} listener
   * @returns {Promise<AgentMessage>}  - Resolves when the message arrives
   */
  once(channel, listener) {
    return new Promise(resolve => {
      const unsubscribe = this.subscribe(channel, (msg) => {
        unsubscribe();
        listener?.(msg);
        resolve(msg);
      });
    });
  }

  /**
   * Remove a specific listener from a channel.
   *
   * @param {string}   channel
   * @param {Function} listener
   * @returns {boolean}
   */
  unsubscribe(channel, listener) {
    const subs = this._subscribers.get(channel);
    if (!subs) return false;
    return subs.delete(listener);
  }

  /** Remove ALL listeners on a given channel. */
  clearChannel(channel) {
    return this._subscribers.delete(channel);
  }

  /** Remove ALL listeners on ALL channels. */
  clearAll() {
    this._subscribers.clear();
  }

  // -------------------------------------------------------------------------
  // History / diagnostics
  // -------------------------------------------------------------------------

  /**
   * Get recent messages published to a channel (newest last).
   *
   * @param {string} channel
   * @param {number} [limit=10]
   * @returns {AgentMessage[]}
   */
  getHistory(channel, limit = 10) {
    const history = this._history.get(channel) ?? [];
    return history.slice(-limit);
  }

  /** Return a snapshot of bus health for monitoring endpoints. */
  getStatus() {
    const channels = {};
    for (const [channel, subs] of this._subscribers.entries()) {
      channels[channel] = {
        subscribers:    subs.size,
        recentMessages: (this._history.get(channel) ?? []).length,
      };
    }

    return {
      totalPublished:  this._totalPublished,
      activeChannels:  this._subscribers.size,
      channels,
    };
  }

  /** Internal: append a message to the channel's history, honouring the limit. */
  _record(channel, message) {
    if (!this._history.has(channel)) this._history.set(channel, []);
    const hist = this._history.get(channel);
    hist.push(message);
    if (hist.length > this._historyLimit) hist.shift();
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

export const globalMessageBus = new AgentMessageBus();

// ---------------------------------------------------------------------------
// Standard channel names — import these to avoid magic strings
// ---------------------------------------------------------------------------
export const CHANNELS = Object.freeze({
  SCHEMA_READY:         'schema.ready',
  ANALYTICS_PLAN_READY: 'analytics.plan.ready',
  TOOLS_SELECTED:       'tools.selected',
  EXECUTION_COMPLETE:   'execution.complete',
  CRITIQUE_READY:       'critique.ready',
  ORCHESTRATION_DONE:   'orchestration.done',
  AGENT_ERROR:          'agent.error',
  PROVIDER_SELECTED:    'provider.selected',
});
