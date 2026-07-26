// Agentic model role map for InsightFlow.
// Optimized for your 5 available Ollama models:
//   nomic-embed-text:latest | llama3.2:3b | qwen3:4b | qwen3:8b | qwen2.5-coder:7b
//
// Keep this file small and explicit — swap model names in .env without touching agent logic.

import { OLLAMA_HOST as ROUTER_HOST, getModelForTask as routerGetModel } from './model-router.js';

export const OLLAMA_HOST =
  process.env.OLLAMA_HOST ||
  process.env.OLLAMA_BASE_URL ||
  ROUTER_HOST;

export const AGENTIC_MODELS = Object.freeze({
  masterPlanner:         process.env.AGENTIC_MASTER_MODEL          || routerGetModel('main_analyst'),
  schemaAnalyst:         process.env.AGENTIC_SCHEMA_MODEL          || routerGetModel('main_analyst'),
  schemaAnalystFallback: process.env.AGENTIC_SCHEMA_FALLBACK_MODEL || routerGetModel('kpi_validator'),
  dashboardGuardian:     process.env.AGENTIC_GUARDIAN_MODEL        || routerGetModel('chart_validator'),
  deepReasoner:          process.env.AGENTIC_DEEP_MODEL            || routerGetModel('main_analyst'),
  embedding:             process.env.AGENTIC_EMBED_MODEL           || routerGetModel('embedding'),
  codeAnalyst:           process.env.AGENTIC_CODE_MODEL            || routerGetModel('coding'),
  generalReasoner:       process.env.AGENTIC_GENERAL_MODEL         || routerGetModel('chatbot'),
  fallbackChat:          process.env.AGENTIC_FALLBACK_MODEL        || routerGetModel('fast'),
  friendlyChat:          process.env.AGENTIC_FRIENDLY_MODEL        || routerGetModel('quick_chat'),
});

export const AGENTIC_RUNTIME = Object.freeze({
  provider: process.env.AGENTIC_LLM_PROVIDER || 'ollama',

  useCloudDeepReasoner: process.env.AGENTIC_USE_CLOUD_DEEP_REASONER === 'true',

  timeoutMs:   Number(process.env.AGENTIC_OLLAMA_TIMEOUT_MS || 120_000),
  temperature: Number(process.env.AGENTIC_TEMPERATURE        || 0.1),
  numCtx:      Number(process.env.AGENTIC_NUM_CTX            || 8192),
});

/**
 * Return the right model name for a given task key.
 *
 * @param {'plan'|'schema'|'schemaFallback'|'guard'|'validate'|'embed'|'embedding'|
 *          'code'|'sql'|'formula'|'deep'|'reasoning'|'friendly'|'fallback'|
 *          'chat'|'synthesis'} task
 * @returns {string} Ollama model name
 */
export function getModelForTask(task) {
  switch (task) {
    case 'manager':
    case 'plan':
      return AGENTIC_MODELS.masterPlanner;

    case 'schema':
      return AGENTIC_MODELS.schemaAnalyst;
    case 'schemaFallback':
      return AGENTIC_MODELS.schemaAnalystFallback;

    case 'guard':
    case 'validate':
      return AGENTIC_MODELS.dashboardGuardian;

    case 'embed':
    case 'embedding':
    case 'similarity':
      return AGENTIC_MODELS.embedding;

    case 'code':
    case 'sql':
    case 'formula':
      return AGENTIC_MODELS.codeAnalyst;

    case 'deep':
    case 'reasoning':
      // Stays local unless AGENTIC_USE_CLOUD_DEEP_REASONER=true
      return AGENTIC_RUNTIME.useCloudDeepReasoner
        ? AGENTIC_MODELS.deepReasoner
        : AGENTIC_MODELS.generalReasoner;

    case 'friendly':
      return AGENTIC_MODELS.friendlyChat;

    case 'fallback':
      return AGENTIC_MODELS.fallbackChat;

    case 'chat':
    case 'synthesis':
    default:
      return AGENTIC_MODELS.generalReasoner;
  }
}

export function publicModelConfig() {
  return {
    provider:             AGENTIC_RUNTIME.provider,
    ollamaHost:           OLLAMA_HOST,
    useCloudDeepReasoner: AGENTIC_RUNTIME.useCloudDeepReasoner,
    roles:                { ...AGENTIC_MODELS },
    insightflowModels: {
      mainAnalyst:      AGENTIC_MODELS.schemaAnalyst,
      dashboardPlanner: AGENTIC_MODELS.schemaAnalyst,
      chatbot:          AGENTIC_MODELS.generalReasoner,
      validator:        AGENTIC_MODELS.dashboardGuardian,
      coding:           AGENTIC_MODELS.codeAnalyst,
      fast:             AGENTIC_MODELS.fallbackChat,
      embedding:        AGENTIC_MODELS.embedding,
    },
  };
}
