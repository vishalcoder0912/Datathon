/**
 * @file agentic-framework.js
 * @description Core Agentic Framework — base classes and interfaces for all agents.
 *
 * This module is the single foundation all agents in InsightFlow build on.
 * Every agent extends `Agent`, every pipeline step uses `ExecutionContext`,
 * and every agent response is wrapped in `AgentResult`.
 */

// ---------------------------------------------------------------------------
// AGENT_ROLES — canonical role identifiers
// ---------------------------------------------------------------------------
export const AGENT_ROLES = Object.freeze({
  SCHEMA_ANALYZER:    'schema_analyzer',
  ANALYTICS_PLANNER:  'analytics_planner',
  TOOL_ROUTER:        'tool_router',
  EXECUTOR:           'executor',
  CRITIC:             'critic',
  ORCHESTRATOR:       'orchestrator',
  AI_PROVIDER:        'ai_provider',
  MEMORY:             'memory',
});

// ---------------------------------------------------------------------------
// Agent — abstract base class
// ---------------------------------------------------------------------------

/**
 * Abstract base class that every InsightFlow agent must extend.
 *
 * Subclasses MUST implement the `process(context)` method.
 * All metric tracking, logging, and lifecycle hooks are inherited.
 */
export class Agent {
  /**
   * @param {string} id          Unique agent identifier (e.g. 'schema-analyzer')
   * @param {string} name        Human-readable name (e.g. 'Schema Analyzer')
   * @param {string} role        One of AGENT_ROLES values
   * @param {string[]} capabilities  What this agent can do (used by registry)
   */
  constructor(id, name, role, capabilities = []) {
    if (!id || !name || !role) {
      throw new Error('Agent requires id, name, and role');
    }

    this.id           = id;
    this.name         = name;
    this.role         = role;
    this.capabilities = capabilities;

    /** @type {Map<string, any>} — in-process key-value memory */
    this.memory  = new Map();

    /** Performance counters */
    this.metrics = {
      invocationCount: 0,
      totalLatencyMs:  0,
      errorCount:      0,
      lastInvokedAt:   null,
    };
  }

  // -------------------------------------------------------------------------
  // Core lifecycle
  // -------------------------------------------------------------------------

  /**
   * Process an execution context and return an AgentResult.
   *
   * @abstract
   * @param {ExecutionContext} context
   * @returns {Promise<AgentResult>}
   */
  async process(context) {  // eslint-disable-line no-unused-vars
    throw new Error(`Agent.process() not implemented for "${this.name}" (${this.id})`);
  }

  /**
   * Convenience wrapper — times the process() call and records metrics.
   *
   * @param {ExecutionContext} context
   * @returns {Promise<AgentResult>}
   */
  async run(context) {
    const start = Date.now();
    this.metrics.lastInvokedAt = new Date().toISOString();

    try {
      const result = await this.process(context);
      const latency = Date.now() - start;
      this.recordMetric(latency, result.status);
      result.latency = latency;
      return result;
    } catch (err) {
      const latency = Date.now() - start;
      this.recordMetric(latency, 'error');

      return new AgentResult({
        agentId:   this.id,
        agentName: this.name,
        status:    'error',
        output:    null,
        reasoning: `Agent "${this.name}" threw an unhandled error: ${err.message}`,
        latency,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Memory helpers
  // -------------------------------------------------------------------------

  /** Store a value in the agent's in-process memory. */
  remember(key, value) {
    this.memory.set(key, value);
  }

  /** Retrieve a previously stored value (or `undefined`). */
  recall(key) {
    return this.memory.get(key);
  }

  /** Clear all in-process memory. */
  forgetAll() {
    this.memory.clear();
  }

  // -------------------------------------------------------------------------
  // Metrics helpers
  // -------------------------------------------------------------------------

  /**
   * Record a single invocation's outcome.
   * Called automatically by `run()`.
   *
   * @param {number} latencyMs
   * @param {'success'|'partial'|'error'} status
   */
  recordMetric(latencyMs, status = 'success') {
    this.metrics.invocationCount++;
    this.metrics.totalLatencyMs += latencyMs;
    if (status === 'error') this.metrics.errorCount++;
  }

  /** Average latency across all invocations (ms). */
  get avgLatencyMs() {
    if (this.metrics.invocationCount === 0) return 0;
    return Math.round(this.metrics.totalLatencyMs / this.metrics.invocationCount);
  }

  // -------------------------------------------------------------------------
  // Introspection
  // -------------------------------------------------------------------------

  /** Serialisable status snapshot. */
  getStatus() {
    return {
      id:           this.id,
      name:         this.name,
      role:         this.role,
      capabilities: this.capabilities,
      memorySize:   this.memory.size,
      metrics: {
        ...this.metrics,
        avgLatencyMs: this.avgLatencyMs,
        successRate: this.metrics.invocationCount > 0
          ? ((this.metrics.invocationCount - this.metrics.errorCount) /
              this.metrics.invocationCount * 100).toFixed(1) + '%'
          : 'N/A',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// ExecutionContext — immutable pipeline state
// ---------------------------------------------------------------------------

/**
 * Immutable state object threaded through every agent in a pipeline run.
 *
 * Agents never mutate this object — they call `recordAgentStep()` to produce
 * a new context with an updated `agentTrail`.
 */
export class ExecutionContext {
  /**
   * @param {object} opts
   * @param {string}  opts.datasetId       - Unique identifier for the dataset
   * @param {object}  opts.schema          - Normalised schema profile (see SchemaProfile)
   * @param {Array}   opts.rows            - Raw data rows (array of objects)
   * @param {string}  opts.goal            - User-supplied analysis goal
   * @param {string}  [opts.userId]        - Authenticated user ID (optional)
   * @param {string}  [opts.requestId]     - Unique request identifier for tracing
   * @param {number}  [opts.timestamp]     - Unix timestamp of context creation
   * @param {Array}   [opts.agentTrail]    - Ordered list of AgentStep records
   * @param {object}  [opts.options]       - Additional pass-through options
   */
  constructor({
    datasetId,
    schema       = {},
    rows         = [],
    goal         = '',
    userId       = null,
    requestId    = null,
    timestamp    = Date.now(),
    agentTrail   = [],
    options      = {},
  } = {}) {
    if (!datasetId) throw new Error('ExecutionContext requires datasetId');

    this.datasetId   = datasetId;
    this.schema      = schema;
    this.rows        = rows;
    this.goal        = goal;
    this.userId      = userId;
    this.requestId   = requestId ?? `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.timestamp   = timestamp;
    this.agentTrail  = agentTrail;
    this.options     = options;

    // Freeze to prevent accidental mutation
    Object.freeze(this);
  }

  /**
   * Produce a new context with the agent step appended to the trail.
   * Original context is unchanged.
   *
   * @param {string} agentId    - ID of the agent that just ran
   * @param {string} decision   - Human-readable summary of the agent's decision
   * @param {any}    output     - The raw output from the agent
   * @returns {ExecutionContext}
   */
  recordAgentStep(agentId, decision, output) {
    return new ExecutionContext({
      ...this,
      agentTrail: [
        ...this.agentTrail,
        {
          agentId,
          decision,
          output,
          timestamp: Date.now(),
        },
      ],
    });
  }

  /** Number of agents that have run so far. */
  get stageCount() {
    return this.agentTrail.length;
  }

  /** Last agent step recorded, or null. */
  get lastStep() {
    return this.agentTrail.length > 0
      ? this.agentTrail[this.agentTrail.length - 1]
      : null;
  }

  /** Plain-object summary suitable for logging / API responses. */
  toSummary() {
    return {
      requestId:   this.requestId,
      datasetId:   this.datasetId,
      goal:        this.goal,
      stageCount:  this.stageCount,
      rowCount:    this.rows.length,
      timestamp:   this.timestamp,
    };
  }
}

// ---------------------------------------------------------------------------
// AgentResult — standardised response envelope
// ---------------------------------------------------------------------------

/**
 * Every agent returns an `AgentResult` — the standard envelope for all
 * inter-agent communication.
 */
export class AgentResult {
  /**
   * @param {object} opts
   * @param {string}   opts.agentId        - ID of the producing agent
   * @param {string}   opts.agentName      - Name of the producing agent
   * @param {'success'|'partial'|'error'} [opts.status='success']
   * @param {any}      opts.output         - The actual result payload
   * @param {string}   [opts.reasoning]    - Human-readable explanation
   * @param {number}   [opts.latency]      - Time taken in ms (set by Agent.run)
   * @param {number}   [opts.tokensUsed]   - LLM tokens consumed (if applicable)
   * @param {string[]} [opts.nextAgentIds] - Suggested next agents to invoke
   * @param {object}   [opts.metadata]     - Any extra key-value data
   */
  constructor({
    agentId,
    agentName,
    status       = 'success',
    output,
    reasoning    = '',
    latency      = 0,
    tokensUsed   = 0,
    nextAgentIds = [],
    metadata     = {},
  }) {
    this.agentId      = agentId;
    this.agentName    = agentName;
    this.status       = status;       // 'success' | 'partial' | 'error'
    this.output       = output;
    this.reasoning    = reasoning;
    this.latency      = latency;
    this.tokensUsed   = tokensUsed;
    this.nextAgentIds = nextAgentIds;
    this.metadata     = metadata;
    this.createdAt    = new Date().toISOString();
  }

  /** Whether this result represents a successful outcome. */
  get isSuccess() { return this.status === 'success'; }

  /** Whether this result represents a partial outcome. */
  get isPartial() { return this.status === 'partial'; }

  /** Whether this result represents a failure. */
  get isError() { return this.status === 'error'; }

  /** Serialisable representation. */
  toJSON() {
    return {
      agentId:      this.agentId,
      agentName:    this.agentName,
      status:       this.status,
      reasoning:    this.reasoning,
      latency:      this.latency,
      tokensUsed:   this.tokensUsed,
      nextAgentIds: this.nextAgentIds,
      createdAt:    this.createdAt,
      // Do NOT include raw output by default — it can be very large
    };
  }
}
