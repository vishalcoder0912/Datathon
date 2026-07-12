/**
 * @file agent-registry.js
 * @description Agent Registry — manages agent lifecycle and discovery.
 *
 * Use the exported `globalRegistry` singleton in application code.
 * Import `AgentRegistry` directly only for testing or isolated scopes.
 */

import { AGENT_ROLES } from './agentic-framework.js';

// ---------------------------------------------------------------------------
// AgentRegistry
// ---------------------------------------------------------------------------

export class AgentRegistry {
  constructor() {
    /** @type {Map<string, import('./agentic-framework.js').Agent>} */
    this._agents = new Map();

    /** @type {Map<string, Function[]>} — role → list of listener callbacks */
    this._listeners = new Map();
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register an agent with the registry.
   *
   * @param {import('./agentic-framework.js').Agent} agent
   * @throws {Error} if the agent is missing required fields or is already registered
   */
  register(agent) {
    if (!agent || !agent.id || !agent.name || !agent.role) {
      throw new Error('Agent must have id, name, and role before registering');
    }

    if (this._agents.has(agent.id)) {
      throw new Error(
        `Agent "${agent.id}" is already registered. Use replace() to overwrite.`
      );
    }

    this._agents.set(agent.id, agent);
    this._emit('register', agent);
    console.log(`[AgentRegistry] ✅ Registered "${agent.name}" (${agent.id}) as ${agent.role}`);
    return this; // allow chaining
  }

  /**
   * Replace an existing registration (useful during hot-reload / testing).
   *
   * @param {import('./agentic-framework.js').Agent} agent
   */
  replace(agent) {
    if (this._agents.has(agent.id)) {
      this._emit('unregister', this._agents.get(agent.id));
    }
    this._agents.set(agent.id, agent);
    this._emit('register', agent);
    console.log(`[AgentRegistry] 🔄 Replaced agent "${agent.id}"`);
    return this;
  }

  /**
   * Remove an agent from the registry.
   *
   * @param {string} agentId
   * @returns {boolean} true if the agent existed and was removed
   */
  unregister(agentId) {
    const agent = this._agents.get(agentId);
    if (!agent) return false;

    this._agents.delete(agentId);
    this._emit('unregister', agent);
    console.log(`[AgentRegistry] 🗑️  Unregistered "${agentId}"`);
    return true;
  }

  // -------------------------------------------------------------------------
  // Lookup
  // -------------------------------------------------------------------------

  /**
   * Get a single agent by ID.
   *
   * @param {string} agentId
   * @returns {import('./agentic-framework.js').Agent|undefined}
   */
  getAgent(agentId) {
    return this._agents.get(agentId);
  }

  /**
   * Get a single agent by ID, throwing if not found.
   *
   * @param {string} agentId
   * @returns {import('./agentic-framework.js').Agent}
   */
  requireAgent(agentId) {
    const agent = this._agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" is not registered. Available: ${this.listIds().join(', ')}`);
    }
    return agent;
  }

  /**
   * Return all agents that have a given role.
   *
   * @param {string} role  — one of AGENT_ROLES values
   * @returns {import('./agentic-framework.js').Agent[]}
   */
  getAgentsByRole(role) {
    return [...this._agents.values()].filter(a => a.role === role);
  }

  /**
   * Return all agents that have ALL the specified capabilities.
   *
   * @param {string[]} requiredCapabilities
   * @returns {import('./agentic-framework.js').Agent[]}
   */
  findByCapabilities(requiredCapabilities) {
    return [...this._agents.values()].filter(agent =>
      requiredCapabilities.every(cap => agent.capabilities.includes(cap))
    );
  }

  // -------------------------------------------------------------------------
  // Enumeration
  // -------------------------------------------------------------------------

  /** List all registered agent IDs. */
  listIds() {
    return [...this._agents.keys()];
  }

  /**
   * Return a lightweight summary of every registered agent.
   * Safe to expose via API (does not include internal state or data).
   */
  listAgents() {
    return [...this._agents.values()].map(a => ({
      id:           a.id,
      name:         a.name,
      role:         a.role,
      capabilities: a.capabilities,
    }));
  }

  /** Total number of registered agents. */
  get size() {
    return this._agents.size;
  }

  // -------------------------------------------------------------------------
  // Status & diagnostics
  // -------------------------------------------------------------------------

  /**
   * Return a comprehensive status object — useful for health-check endpoints.
   */
  getStatus() {
    const roleBreakdown = {};
    for (const role of Object.values(AGENT_ROLES)) {
      roleBreakdown[role] = 0;
    }
    for (const agent of this._agents.values()) {
      if (roleBreakdown[agent.role] !== undefined) {
        roleBreakdown[agent.role]++;
      } else {
        roleBreakdown[agent.role] = 1;
      }
    }

    return {
      totalAgents:   this.size,
      roleBreakdown,
      agents:        this.listAgents(),
    };
  }

  /**
   * Collect and return metrics from all registered agents.
   */
  collectMetrics() {
    const metrics = {};
    for (const agent of this._agents.values()) {
      metrics[agent.id] = agent.getStatus?.() ?? { id: agent.id };
    }
    return metrics;
  }

  // -------------------------------------------------------------------------
  // Event system (lightweight pub-sub for lifecycle hooks)
  // -------------------------------------------------------------------------

  /**
   * Subscribe to registry events.
   *
   * @param {'register'|'unregister'} event
   * @param {Function} listener  — called with the affected Agent
   */
  on(event, listener) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(listener);
    return this; // chainable
  }

  /** Internal: fire all listeners for an event. */
  _emit(event, agent) {
    const listeners = this._listeners.get(event) ?? [];
    for (const fn of listeners) {
      try { fn(agent); } catch { /* listener errors must not crash the registry */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

export const globalRegistry = new AgentRegistry();
