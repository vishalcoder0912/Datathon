/**
 * @file workflows.js
 * @description Workflow definitions for the agentic pipeline.
 *
 * A workflow is an ordered sequence of agent IDs that defines
 * which agents run, in what order, and under what conditions.
 *
 * The Orchestrator Agent reads these definitions to plan its execution.
 */

// ---------------------------------------------------------------------------
// Workflow types
// ---------------------------------------------------------------------------
export const WORKFLOW_TYPES = Object.freeze({
  STANDARD:     'standard',
  CUSTOM_GOAL:  'custom_goal',
  QUICK:        'quick',          // Fewer agents — faster response
  DEEP:         'deep',           // All agents — most thorough analysis
  EXPERIMENTAL: 'experimental',   // A/B testing workflows
});

// ---------------------------------------------------------------------------
// Workflow definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} WorkflowStep
 * @property {string}    agentId        - Agent to invoke
 * @property {boolean}   [required]     - If false, failure here is non-fatal
 * @property {boolean}   [parallel]     - Run concurrently with previous parallel steps
 * @property {string}    [condition]    - JS expression evaluated against ExecutionContext
 * @property {string}    [description]  - Human-readable explanation
 */

/**
 * @typedef {object} WorkflowDefinition
 * @property {string}         id           - Unique workflow identifier
 * @property {string}         name         - Display name
 * @property {string}         type         - One of WORKFLOW_TYPES
 * @property {string}         description
 * @property {WorkflowStep[]} steps
 * @property {object}         [options]    - Extra settings (timeoutMs, etc.)
 */

/** @type {Record<string, WorkflowDefinition>} */
export const WORKFLOWS = {

  // ── Standard Analysis (default) ──────────────────────────────────────────
  STANDARD: {
    id:          'workflow-standard',
    name:        'Standard Analysis',
    type:        WORKFLOW_TYPES.STANDARD,
    description: 'Full pipeline: schema → plan → tools → execute → critique → dashboard.',
    options: {
      timeoutMs:      90_000,
      includeReasoning: true,
    },
    steps: [
      {
        agentId:     'schema-analyzer',
        required:    true,
        description: 'Profile dataset columns, detect domain, assign roles.',
      },
      {
        agentId:     'analytics-planner',
        required:    true,
        description: 'Plan metrics & insights based on the schema profile.',
      },
      {
        agentId:     'tool-router',
        required:    true,
        description: 'Select compatible tools from the tool registry.',
      },
      {
        agentId:     'executor',
        required:    true,
        description: 'Execute selected tools against the dataset.',
      },
      {
        agentId:     'critic',
        required:    false,   // Non-fatal — dashboard still ships without critique
        description: 'Validate results, flag anomalies, score quality.',
      },
      {
        agentId:     'orchestrator',
        required:    true,
        description: 'Aggregate all results into the final dashboard response.',
      },
    ],
  },

  // ── Quick Analysis (fewer agents) ────────────────────────────────────────
  QUICK: {
    id:          'workflow-quick',
    name:        'Quick Analysis',
    type:        WORKFLOW_TYPES.QUICK,
    description: 'Streamlined 3-agent pipeline for fast initial insights. Skips critique.',
    options: {
      timeoutMs:        30_000,
      includeReasoning: false,
    },
    steps: [
      {
        agentId:     'schema-analyzer',
        required:    true,
        description: 'Profile dataset.',
      },
      {
        agentId:     'analytics-planner',
        required:    true,
        description: 'Plan core metrics only.',
      },
      {
        agentId:     'executor',
        required:    true,
        description: 'Execute top-5 priority tools.',
      },
    ],
  },

  // ── Custom Goal ───────────────────────────────────────────────────────────
  CUSTOM_GOAL: {
    id:          'workflow-custom-goal',
    name:        'Custom Goal Analysis',
    type:        WORKFLOW_TYPES.CUSTOM_GOAL,
    description: 'User provides a specific goal. Orchestrator tailors the agent chain.',
    options: {
      timeoutMs:        120_000,
      includeReasoning: true,
      allowDynamicSteps: true,  // Orchestrator may add/skip steps based on goal
    },
    steps: [
      {
        agentId:     'schema-analyzer',
        required:    true,
        description: 'Profile dataset.',
      },
      {
        agentId:     'analytics-planner',
        required:    true,
        description: 'Plan metrics aligned to user goal.',
      },
      {
        agentId:     'tool-router',
        required:    true,
        description: 'Select tools that match goal-driven plan.',
      },
      {
        agentId:     'executor',
        required:    true,
        description: 'Execute tools.',
      },
      {
        agentId:     'critic',
        required:    false,
        description: 'Critique results against user goal.',
      },
      {
        agentId:     'orchestrator',
        required:    true,
        description: 'Produce goal-aligned dashboard.',
      },
    ],
  },

  // ── Deep Analysis ─────────────────────────────────────────────────────────
  DEEP: {
    id:          'workflow-deep',
    name:        'Deep Analysis',
    type:        WORKFLOW_TYPES.DEEP,
    description: 'Exhaustive analysis: all tools, parallel execution, multiple critique passes.',
    options: {
      timeoutMs:          180_000,
      includeReasoning:   true,
      parallelExecution:  true,
      maxTools:           20,
    },
    steps: [
      {
        agentId:     'schema-analyzer',
        required:    true,
      },
      {
        agentId:     'analytics-planner',
        required:    true,
      },
      {
        agentId:     'tool-router',
        required:    true,
      },
      {
        agentId:     'executor',
        required:    true,
        parallel:    false,
      },
      {
        agentId:     'critic',
        required:    true,  // Required in deep mode
      },
      {
        agentId:     'orchestrator',
        required:    true,
      },
    ],
  },

  // ── Experimental (A/B testing) ────────────────────────────────────────────
  EXPERIMENTAL: {
    id:          'workflow-experimental',
    name:        'Experimental (A/B)',
    type:        WORKFLOW_TYPES.EXPERIMENTAL,
    description: 'Runs two parallel analysis branches and picks the better result.',
    options: {
      timeoutMs:       120_000,
      includeReasoning: true,
      abBranches:       ['gemini', 'ollama'],  // One branch per provider
    },
    steps: [
      {
        agentId:  'schema-analyzer',
        required: true,
      },
      {
        agentId:  'analytics-planner',
        required: true,
        parallel: true,   // Branch A
      },
      {
        agentId:  'analytics-planner',
        required: true,
        parallel: true,   // Branch B (different provider)
      },
      {
        agentId:  'critic',
        required: true,
        description: 'Picks better branch.',
      },
      {
        agentId:  'orchestrator',
        required: true,
      },
    ],
  },

};

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Return a workflow definition by ID. */
export function getWorkflow(workflowId) {
  return Object.values(WORKFLOWS).find(w => w.id === workflowId) ?? null;
}

/** Return all workflow definitions. */
export function listWorkflows() {
  return Object.values(WORKFLOWS).map(w => ({
    id:          w.id,
    name:        w.name,
    type:        w.type,
    description: w.description,
    stepCount:   w.steps.length,
  }));
}

/** Select the most appropriate workflow for a given goal & options. */
export function selectWorkflow(goal = '', options = {}) {
  if (options.workflowId) {
    return getWorkflow(options.workflowId) ?? WORKFLOWS.STANDARD;
  }
  if (options.quick)      return WORKFLOWS.QUICK;
  if (options.deep)       return WORKFLOWS.DEEP;
  if (options.experimental) return WORKFLOWS.EXPERIMENTAL;
  if (goal && goal.length > 10) return WORKFLOWS.CUSTOM_GOAL;
  return WORKFLOWS.STANDARD;
}

export default WORKFLOWS;
