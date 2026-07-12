// Environment configuration with validation
import dotenv from 'dotenv';
import { MODELS } from './model-router.js';

dotenv.config();

const PROVIDERS = Object.freeze([
  'ollama',
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'groq',
  'mistral',
  'deepseek',
  'together',
  'fireworks',
  'perplexity',
  'xai',
  'cohere',
  'azure_openai',
]);

function hasValue(value) {
  return Boolean(String(value || '').trim());
}

function getConfiguredProviders() {
  const providers = [];

  if (process.env.OLLAMA_ENABLED !== 'false') providers.push('ollama');
  if (hasValue(process.env.GOOGLE_API_KEY)) providers.push('gemini');
  if (hasValue(process.env.OPENAI_API_KEY)) providers.push('openai');
  if (hasValue(process.env.ANTHROPIC_API_KEY)) providers.push('anthropic');
  if (hasValue(process.env.OPENROUTER_API_KEY)) providers.push('openrouter');
  if (hasValue(process.env.GROQ_API_KEY)) providers.push('groq');
  if (hasValue(process.env.MISTRAL_API_KEY)) providers.push('mistral');
  if (hasValue(process.env.DEEPSEEK_API_KEY)) providers.push('deepseek');
  if (hasValue(process.env.TOGETHER_API_KEY)) providers.push('together');
  if (hasValue(process.env.FIREWORKS_API_KEY)) providers.push('fireworks');
  if (hasValue(process.env.PERPLEXITY_API_KEY)) providers.push('perplexity');
  if (hasValue(process.env.XAI_API_KEY)) providers.push('xai');
  if (hasValue(process.env.COHERE_API_KEY)) providers.push('cohere');
  if (hasValue(process.env.AZURE_OPENAI_API_KEY) && hasValue(process.env.AZURE_OPENAI_ENDPOINT)) providers.push('azure_openai');

  return providers;
}

function getDynamicProviderPriority() {
  const envPriority = process.env.AI_PROVIDER_PRIORITY || 'ollama,gemini,openai,anthropic';
  const configured = getConfiguredProviders();
  const requested = envPriority.split(',').map((provider) => provider.trim()).filter(Boolean);

  if (process.env.AI_PROVIDER_PRIORITY) {
    const safeRequested = requested.filter((provider) => PROVIDERS.includes(provider));
    const availableRequested = safeRequested.filter((provider) => configured.includes(provider));
    return availableRequested.length ? availableRequested : configured;
  }

  return configured.length > 0 ? configured : ['ollama'];
}

const providerModel = (name, fallback) => process.env[`${name}_MODEL`] || fallback;

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  ollama: {
    baseUrl: process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434',
    enabled: process.env.OLLAMA_ENABLED !== 'false',
    primaryModel: process.env.OLLAMA_MODEL || 'qwen3:8b',
    chatModel: process.env.OLLAMA_CHAT_MODEL || 'qwen3:8b',
    fastModel: process.env.OLLAMA_FAST_MODEL || 'qwen3:4b',
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || MODELS.embedding,
    timeout: parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10),
    maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.3'),
    topP: parseFloat(process.env.OLLAMA_TOP_P || '0.9'),
    frequencyPenalty: parseFloat(process.env.OLLAMA_FREQUENCY_PENALTY || '0.0'),
  },

  models: {
    mainAnalyst: MODELS.mainAnalyst,
    dashboardPlanner: MODELS.dashboardPlanner,
    chatbot: MODELS.chatbot,
    kpiValidator: MODELS.kpiValidator,
    chartValidator: MODELS.chartValidator,
    factChecker: MODELS.factChecker,
    jsonValidator: MODELS.jsonValidator,
    coding: MODELS.coding,
    fast: MODELS.fast,
    quickChat: MODELS.quickChat,
    embedding: MODELS.embedding,
  },

  gemini: {
    apiKey: process.env.GOOGLE_API_KEY || '',
    enabled: hasValue(process.env.GOOGLE_API_KEY),
    model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    timeout: 60000,
    maxTokens: 4096,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    enabled: hasValue(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    timeout: 60000,
    maxTokens: 4096,
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    enabled: hasValue(process.env.ANTHROPIC_API_KEY),
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
    timeout: 60000,
    maxTokens: 4096,
  },

  openrouter: { apiKey: process.env.OPENROUTER_API_KEY || '', enabled: hasValue(process.env.OPENROUTER_API_KEY), model: providerModel('OPENROUTER', 'openai/gpt-4o-mini') },
  groq: { apiKey: process.env.GROQ_API_KEY || '', enabled: hasValue(process.env.GROQ_API_KEY), model: providerModel('GROQ', 'llama-3.1-70b-versatile') },
  mistral: { apiKey: process.env.MISTRAL_API_KEY || '', enabled: hasValue(process.env.MISTRAL_API_KEY), model: providerModel('MISTRAL', 'mistral-large-latest') },
  deepseek: { apiKey: process.env.DEEPSEEK_API_KEY || '', enabled: hasValue(process.env.DEEPSEEK_API_KEY), model: providerModel('DEEPSEEK', 'deepseek-chat') },
  together: { apiKey: process.env.TOGETHER_API_KEY || '', enabled: hasValue(process.env.TOGETHER_API_KEY), model: providerModel('TOGETHER', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo') },
  fireworks: { apiKey: process.env.FIREWORKS_API_KEY || '', enabled: hasValue(process.env.FIREWORKS_API_KEY), model: providerModel('FIREWORKS', 'accounts/fireworks/models/llama-v3p1-70b-instruct') },
  perplexity: { apiKey: process.env.PERPLEXITY_API_KEY || '', enabled: hasValue(process.env.PERPLEXITY_API_KEY), model: providerModel('PERPLEXITY', 'sonar-pro') },
  xai: { apiKey: process.env.XAI_API_KEY || '', enabled: hasValue(process.env.XAI_API_KEY), model: providerModel('XAI', 'grok-2-latest') },
  cohere: { apiKey: process.env.COHERE_API_KEY || '', enabled: hasValue(process.env.COHERE_API_KEY), model: providerModel('COHERE', 'command-r-plus') },
  azureOpenai: {
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || '',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    enabled: hasValue(process.env.AZURE_OPENAI_API_KEY) && hasValue(process.env.AZURE_OPENAI_ENDPOINT),
  },

  ai: {
    providerPriority: getDynamicProviderPriority(),
    fallbackEnabled: process.env.ENABLE_AI_FALLBACK !== 'false',
    localOnlyMode: process.env.LOCAL_AI_ONLY === 'true',
    timeout: parseInt(process.env.AI_TIMEOUT_MS || '120000', 10),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
    configuredProviders: getConfiguredProviders(),
    supportedProviders: PROVIDERS,
  },

  database: {
    path: process.env.DATABASE_PATH || './data/insightflow.db',
    dataDir: process.env.DATA_DIR || './data',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    verbose: process.env.VERBOSE_LOGGING === 'true',
  },

  features: {
    localNlp: process.env.LOCAL_NLP_ENABLED !== 'false',
    autoChartGeneration: process.env.AUTO_CHART_GENERATION !== 'false',
    correlationAnalysis: process.env.CORRELATION_ANALYSIS !== 'false',
    outlierDetection: process.env.OUTLIER_DETECTION !== 'false',
    chatHistory: process.env.CHAT_HISTORY_ENABLED !== 'false',
    smartChart: process.env.SMARTCHART_ENABLED !== 'false',
  },

  rateLimit: {
    rpm: parseInt(process.env.AI_RATE_LIMIT_RPM || '10', 10),
    rph: parseInt(process.env.AI_RATE_LIMIT_RPH || '100', 10),
    cooldownAfterErrorMs: parseInt(process.env.AI_COOLDOWN_AFTER_ERROR_MS || '30000', 10),
  },
};

export function validateConfig() {
  const errors = [];

  if (Number.isNaN(config.server.port) || config.server.port < 1 || config.server.port > 65535) {
    errors.push('Invalid PORT: must be between 1 and 65535');
  }

  try {
    new URL(config.ollama.baseUrl);
  } catch {
    errors.push('Invalid OLLAMA_HOST/OLLAMA_BASE_URL: must be a valid URL');
  }

  const invalidProviders = config.ai.providerPriority.filter((provider) => !PROVIDERS.includes(provider));
  if (invalidProviders.length > 0) {
    errors.push(`Invalid AI providers: ${invalidProviders.join(', ')}`);
  }

  if (!config.database.path) {
    errors.push('DATABASE_PATH is required');
  }

  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach((error) => console.error(`   - ${error}`));
    process.exit(1);
  }

  console.log('Configuration validation passed');
  return true;
}

export function printConfigSummary() {
  console.log('\n===== AI CONFIGURATION SUMMARY =====');
  console.log(`Ollama: ${config.ollama.enabled ? 'enabled' : 'disabled'} at ${config.ollama.baseUrl}`);
  console.log(`Primary Ollama model: ${config.ollama.primaryModel}`);
  console.log(`Local only mode: ${config.ai.localOnlyMode}`);
  console.log(`Fallback enabled: ${config.ai.fallbackEnabled}`);
  console.log(`Supported providers: ${config.ai.supportedProviders.join(', ')}`);
  console.log(`Configured providers: ${getAvailableProviders().join(', ') || 'none'}`);
  console.log(`Priority: ${config.ai.providerPriority.join(' -> ')}`);
  console.log('='.repeat(40));
}

export function getAvailableProviders() {
  return getConfiguredProviders();
}

export default config;
