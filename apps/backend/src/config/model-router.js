export const OLLAMA_HOST =
  process.env.OLLAMA_HOST ||
  process.env.OLLAMA_BASE_URL ||
  'http://localhost:11434';

export const MODELS = Object.freeze({
  mainAnalyst:       process.env.MAIN_ANALYST_MODEL       || 'qwen3:8b',
  dashboardPlanner:  process.env.DASHBOARD_PLANNER_MODEL  || 'qwen3:8b',
  chatbot:           process.env.CHATBOT_MODEL            || 'qwen3:8b',

  kpiValidator:      process.env.KPI_VALIDATOR_MODEL      || 'qwen3:4b',
  chartValidator:    process.env.CHART_VALIDATOR_MODEL    || 'qwen3:4b',
  factChecker:       process.env.FACT_CHECKER_MODEL       || 'qwen3:4b',
  jsonValidator:     process.env.JSON_VALIDATOR_MODEL     || 'qwen3:4b',

  coding:            process.env.CODING_MODEL             || 'qwen2.5-coder:7b',

  fast:              process.env.FAST_MODEL               || 'llama3.2:3b',
  quickChat:         process.env.QUICK_CHAT_MODEL         || 'llama3.2:3b',

  embedding:         process.env.EMBEDDING_MODEL          || 'nomic-embed-text',
});

const TASK_TO_MODEL = Object.freeze({
  main_analyst:      'mainAnalyst',
  dashboard_planner: 'dashboardPlanner',
  chatbot:           'chatbot',
  kpi_validator:     'kpiValidator',
  chart_validator:   'chartValidator',
  json_validator:    'jsonValidator',
  fact_checker:      'factChecker',
  coding:            'coding',
  fast:              'fast',
  quick_chat:        'quickChat',
  embedding:         'embedding',
});

const VALID_TASKS = new Set(Object.keys(TASK_TO_MODEL));

export function getModelForTask(taskType) {
  if (!taskType || !VALID_TASKS.has(taskType)) {
    return MODELS.mainAnalyst;
  }
  const key = TASK_TO_MODEL[taskType];
  return MODELS[key];
}

export function isEmbeddingTask(taskType) {
  return taskType === 'embedding';
}

export function isChatModel(modelName) {
  if (!modelName) return false;
  const chatModelNames = [
    MODELS.mainAnalyst,
    MODELS.dashboardPlanner,
    MODELS.chatbot,
    MODELS.kpiValidator,
    MODELS.chartValidator,
    MODELS.factChecker,
    MODELS.jsonValidator,
    MODELS.coding,
    MODELS.fast,
    MODELS.quickChat,
  ];
  return chatModelNames.some((name) => modelName.includes(name.split(':')[0]));
}

export function isEmbeddingModel(modelName) {
  if (!modelName) return false;
  return modelName.includes(MODELS.embedding.split(':')[0]);
}

export function getConfiguredModels() {
  return {
    main_analyst:      MODELS.mainAnalyst,
    dashboard_planner: MODELS.dashboardPlanner,
    chatbot:           MODELS.chatbot,
    kpi_validator:     MODELS.kpiValidator,
    chart_validator:   MODELS.chartValidator,
    json_validator:    MODELS.jsonValidator,
    fact_checker:      MODELS.factChecker,
    coding:            MODELS.coding,
    fast:              MODELS.fast,
    quick_chat:        MODELS.quickChat,
    embedding:         MODELS.embedding,
  };
}

export default {
  OLLAMA_HOST,
  MODELS,
  getModelForTask,
  isEmbeddingTask,
  isChatModel,
  isEmbeddingModel,
  getConfiguredModels,
};
