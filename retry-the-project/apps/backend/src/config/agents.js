/**
 * @file agents.js
 * @description Agent lifecycle configuration — defines every agent in the system,
 * their roles, capabilities, timeout/retry policies, and preferred AI providers.
 *
 * Import AGENT_CONFIGURATIONS to bootstrap the AgentRegistry on startup.
 */

import { AGENT_ROLES } from '../services/agentic/core/agentic-framework.js';

/**
 * @typedef {object} AgentConfig
 * @property {string}   id                  - Unique agent identifier
 * @property {string}   name                - Human-readable display name
 * @property {string}   role                - One of AGENT_ROLES values
 * @property {string[]} capabilities        - What this agent can do
 * @property {number}   timeoutMs           - Max ms before a process() call is aborted
 * @property {number}   maxRetries          - How many times to retry on failure
 * @property {string[]} preferredProviders  - AI providers in preference order
 * @property {boolean}  enabled             - Whether to register on startup
 */

/** @type {Record<string, AgentConfig>} */
export const AGENT_CONFIGURATIONS = {

  SCHEMA_ANALYZER: {
    id:                 'schema-analyzer',
    name:               'Schema Analyzer',
    role:               AGENT_ROLES.SCHEMA_ANALYZER,
    capabilities:       [
      'profile_columns',
      'detect_domain',
      'infer_column_roles',
      'calculate_quality_score',
      'suggest_metrics',
    ],
    timeoutMs:          10_000,
    maxRetries:         2,
    preferredProviders: ['ollama', 'gemini'],
    enabled:            true,
  },

  ANALYTICS_PLANNER: {
    id:                 'analytics-planner',
    name:               'Analytics Planner',
    role:               AGENT_ROLES.ANALYTICS_PLANNER,
    capabilities:       [
      'plan_metrics',
      'select_insights',
      'prioritize_calculations',
      'suggest_chart_types',
    ],
    timeoutMs:          15_000,
    maxRetries:         1,
    preferredProviders: ['gemini', 'openai', 'ollama'],
    enabled:            true,
  },

  TOOL_ROUTER: {
    id:                 'tool-router',
    name:               'Tool Router',
    role:               AGENT_ROLES.TOOL_ROUTER,
    capabilities:       [
      'discover_tools',
      'match_tasks_to_tools',
      'estimate_tool_cost',
      'sequence_tool_execution',
    ],
    timeoutMs:          5_000,
    maxRetries:         0,
    preferredProviders: [],  // Pure rule-based — no LLM needed
    enabled:            true,
  },

  EXECUTOR: {
    id:                 'executor',
    name:               'Execution Agent',
    role:               AGENT_ROLES.EXECUTOR,
    capabilities:       [
      'run_statistical_tools',
      'run_ml_tools',
      'aggregate_results',
      'handle_tool_errors',
    ],
    timeoutMs:          60_000,  // Long timeout for large datasets
    maxRetries:         2,
    preferredProviders: [],  // Deterministic — no LLM
    enabled:            true,
  },

  CRITIC: {
    id:                 'critic',
    name:               'Critic Agent',
    role:               AGENT_ROLES.CRITIC,
    capabilities:       [
      'validate_schema_consistency',
      'review_analytics_results',
      'flag_anomalous_outputs',
      'score_dashboard_quality',
    ],
    timeoutMs:          10_000,
    maxRetries:         1,
    preferredProviders: ['claude', 'gemini'],  // Claude excels at critique
    enabled:            true,
  },

  ORCHESTRATOR: {
    id:                 'orchestrator',
    name:               'Chief Analyst Orchestrator',
    role:               AGENT_ROLES.ORCHESTRATOR,
    capabilities:       [
      'coordinate_agents',
      'route_decisions',
      'aggregate_results',
      'manage_agent_failures',
      'produce_final_dashboard',
    ],
    timeoutMs:          120_000,
    maxRetries:         0,  // Orchestrator doesn't retry — it handles child retries
    preferredProviders: ['gemini', 'openai'],
    enabled:            true,
  },

};

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Return all enabled agent configs as an array. */
export function getEnabledAgentConfigs() {
  return Object.values(AGENT_CONFIGURATIONS).filter(c => c.enabled);
}

/** Look up a single config by agent ID. */
export function getAgentConfig(agentId) {
  return Object.values(AGENT_CONFIGURATIONS).find(c => c.id === agentId) ?? null;
}

/** Return configs for a given role. */
export function getConfigsByRole(role) {
  return Object.values(AGENT_CONFIGURATIONS).filter(c => c.role === role && c.enabled);
}

export default AGENT_CONFIGURATIONS;
