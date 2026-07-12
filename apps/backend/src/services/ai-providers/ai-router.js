import { geminiService } from './gemini-service.js';
import { ollamaService } from './ollama-service.js';
import { localNLPService } from './local-nlp-service.js';
import { validateDashboardActions, assessDashboardHealth } from '../guardian/dashboard-guardian.js';
import { assertNoRawRowsInString } from '../ai/llm-payload-sanitizer.js';

class AIRouter {
  constructor() {
    this.providerPriority = this.parseProviderPriority();
    this.lastUsedProvider = null;
    this.providerStats = {
      ollama: { calls: 0, successes: 0, errors: 0 },
      gemini: { calls: 0, successes: 0, errors: 0 },
      local: { calls: 0, successes: 0, errors: 0 },
    };
  }

  parseProviderPriority() {
    const priority = process.env.AI_PROVIDER_PRIORITY || 'gemini,ollama,local';
    return priority.split(',').map(p => p.trim().toLowerCase());
  }

  getProviderForTask(taskType, options = {}) {
    const mode = process.env.AI_PROVIDER_MODE || 'hybrid';
    const isGeminiAvailable = geminiService.isAvailable();
    const isOllamaAvailable = options.ollamaAvailable !== false; // Checked by health/ping

    if (mode === 'local_only') {
      return { provider: 'ollama', model: this.getOllamaModelForTask(taskType) };
    }
    if (mode === 'cloud_only') {
      return { provider: 'gemini', model: this.getGeminiModelForTask(taskType) };
    }

    // Task-based routing rules
    switch (taskType) {
      case 'dashboard_planner':
        if (isGeminiAvailable) return { provider: 'gemini', model: geminiService.mainModel };
        return { provider: 'ollama', model: ollamaService.mainModel };

      case 'chatbot':
        if (isGeminiAvailable) return { provider: 'gemini', model: geminiService.mainModel };
        return { provider: 'ollama', model: ollamaService.mainModel };

      case 'schema_analyst':
        if (isGeminiAvailable) return { provider: 'gemini', model: geminiService.mainModel };
        return { provider: 'ollama', model: ollamaService.mainModel };

      case 'json_validator':
        return { provider: 'ollama', model: ollamaService.validatorModel };

      case 'coding':
        if (isGeminiAvailable) return { provider: 'gemini', model: geminiService.advancedModel };
        return { provider: 'ollama', model: ollamaService.codingModel };

      case 'embedding':
        if (mode === 'hybrid' || mode === 'local_only') {
          return { provider: 'ollama', model: ollamaService.embeddingModel };
        }
        return { provider: 'gemini', model: geminiService.embeddingModel };

      default:
        if (isGeminiAvailable) return { provider: 'gemini', model: geminiService.mainModel };
        return { provider: 'ollama', model: ollamaService.mainModel };
    }
  }

  getOllamaModelForTask(taskType) {
    if (taskType === 'json_validator') return ollamaService.validatorModel;
    if (taskType === 'coding') return ollamaService.codingModel;
    if (taskType === 'fast_summary') return ollamaService.fastModel;
    if (taskType === 'embedding') return ollamaService.embeddingModel;
    return ollamaService.mainModel;
  }

  getGeminiModelForTask(taskType) {
    if (taskType === 'coding') return geminiService.advancedModel;
    if (taskType === 'fast_summary') return geminiService.fastModel;
    if (taskType === 'embedding') return geminiService.embeddingModel;
    return geminiService.mainModel;
  }

  scoreResponse(parsed, latencyMs, providerName) {
    if (!parsed) return 0;
    
    let score = 50; // base score for returning valid JSON

    if (parsed.schema_safe) score += 10;
    if (parsed.response_type === 'dashboard_action') score += 10;

    const actionCount = Array.isArray(parsed.actions) ? parsed.actions.length : 0;
    if (actionCount > 0 && actionCount <= 7) {
      score += 15;
    } else if (actionCount > 7) {
      score += 5; // penalize too many actions
    }

    const warningCount = Array.isArray(parsed.warnings) ? parsed.warnings.length : 0;
    score -= warningCount * 5;

    // Latency adjustment (prefer faster response)
    if (latencyMs < 3000) score += 10;
    else if (latencyMs < 10000) score += 5;

    // Reject fake / invalid properties
    if (parsed.actions) {
      const hasFakeFields = parsed.actions.some(a => !a.action || (a.action === 'create_chart' && (!a.xKey || !a.yKey)));
      if (hasFakeFields) score -= 30;
      
      const seen = new Set();
      let duplicates = 0;
      for (const a of parsed.actions) {
        if (a.action === 'create_chart') {
          const key = `${a.chart_type || a.type}|${a.xKey || a.x}|${a.yKey || a.y}`;
          if (seen.has(key)) {
            duplicates++;
          } else {
            seen.add(key);
          }
        }
      }
      score -= duplicates * 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  async runAITask(params) {
    // Ensure no raw rows exist in the task inputs
    try {
      assertNoRawRowsInString(JSON.stringify(params));
    } catch (error) {
      console.error(`[AI ROUTER BLOCKED runAITask] ${error.message}`);
      return {
        success: false,
        error: `Blocked unsafe LLM payload: ${error.message}`,
        provider: 'safe_fallback',
        response_type: 'chat',
        natural_response: 'Blocked unsafe payload. Raw rows cannot be sent to the AI.',
        actions: [],
        warnings: [error.message],
        errors: [],
        schema_safe: true
      };
    }

    const {
      taskType = 'dashboard_planner',
      schemaPacket,
      userQuery,
      dashboardState = {},
      ragContext = '',
      preferredMode = null,
      requireJson = true
    } = params;

    const providerMode = preferredMode || process.env.AI_PROVIDER_MODE || 'hybrid';
    const enableRace = process.env.AI_ENABLE_RESPONSE_RACE === 'true';

    // 1. Check availability
    const geminiAvailable = geminiService.isAvailable();
    const ollamaAvailable = await ollamaService.isAvailable();

    // 2. Race mode check (for specific commands in hybrid_best)
    const isImportantTask = ['build dashboard', 'fix dashboard', 'generate 7 useful charts', 'advanced dashboard planning', 'complex schema analysis'].some(t =>
      userQuery?.toLowerCase().includes(t)
    );

    if (providerMode === 'hybrid_best' && isImportantTask && geminiAvailable && ollamaAvailable) {
      console.log(`[aiProviderRouter] Racing Gemini and Ollama for important task: "${userQuery}"`);
      const startTime = Date.now();

      const [geminiResult, ollamaResult] = await Promise.all([
        geminiService.generateDashboardAction(schemaPacket, userQuery, dashboardState).catch(err => ({ success: false, error: err.message })),
        ollamaService.generateDashboardAction(schemaPacket, userQuery, dashboardState).catch(err => ({ success: false, error: err.message }))
      ]);

      const geminiScore = geminiResult.success && geminiResult.parsed ? this.scoreResponse(geminiResult.parsed, geminiResult.latency_ms, 'gemini') : 0;
      const ollamaScore = ollamaResult.success && ollamaResult.parsed ? this.scoreResponse(ollamaResult.parsed, ollamaResult.latency_ms, 'ollama') : 0;

      console.log(`[aiProviderRouter] Gemini score: ${geminiScore}, Ollama score: ${ollamaScore}`);

      let bestResult = null;
      let selectedProvider = 'safe_fallback';
      let selectedModel = '';
      let reason = 'Both providers failed or returned invalid responses.';

      if (geminiScore >= ollamaScore && geminiScore > 0) {
        bestResult = geminiResult;
        selectedProvider = 'gemini';
        selectedModel = geminiService.mainModel;
        reason = `Gemini selected (Score: ${geminiScore} vs Ollama: ${ollamaScore})`;
      } else if (ollamaScore > geminiScore && ollamaScore > 0) {
        bestResult = ollamaResult;
        selectedProvider = 'ollama';
        selectedModel = ollamaService.mainModel;
        reason = `Ollama selected (Score: ${ollamaScore} vs Gemini: ${geminiScore})`;
      }

      if (bestResult && bestResult.parsed) {
        // Run Guardian validation
        const guardianResult = validateDashboardActions(schemaPacket, dashboardState, bestResult.parsed.actions || []);
        
        return {
          success: true,
          provider: selectedProvider,
          selected_model: selectedModel,
          selection_reason: reason,
          response_type: 'dashboard_action',
          natural_response: bestResult.parsed.natural_response || `Generated actions using ${selectedProvider}.`,
          actions: bestResult.parsed.actions || [],
          validated_actions: guardianResult.validatedActions || [],
          warnings: [...(bestResult.parsed.warnings || []), ...guardianResult.warnings],
          errors: guardianResult.errors || [],
          schema_safe: true,
          metadata: {
            latency_ms: Date.now() - startTime,
            guardian_score: assessDashboardHealth(schemaPacket, {
              kpis: guardianResult.validatedActions.filter(a => a.action === 'create_kpi'),
              charts: guardianResult.validatedActions.filter(a => a.action === 'create_chart')
            }).score,
            provider_mode: providerMode
          }
        };
      }
    }

    // 3. Sequential routing / fallback flow
    const routing = this.getProviderForTask(taskType, { ollamaAvailable });
    let primaryService = routing.provider === 'gemini' ? geminiService : ollamaService;
    let fallbackService = routing.provider === 'gemini' ? ollamaService : geminiService;
    let primaryName = routing.provider;
    let fallbackName = routing.provider === 'gemini' ? 'ollama' : 'gemini';

    if (providerMode === 'local_only') {
      primaryService = ollamaService;
      primaryName = 'ollama';
      fallbackService = null;
    } else if (providerMode === 'cloud_only') {
      primaryService = geminiService;
      primaryName = 'gemini';
      fallbackService = null;
    }

    console.log(`[aiProviderRouter] Attempting primary provider: ${primaryName}`);
    let result;
    try {
      result = await primaryService.generateDashboardAction(schemaPacket, userQuery, dashboardState);
    } catch (err) {
      result = { success: false, error: err.message };
    }

    if (result.success && result.parsed) {
      const guardianResult = validateDashboardActions(schemaPacket, dashboardState, result.parsed.actions || []);
      return {
        success: true,
        provider: primaryName,
        selected_model: result.model,
        selection_reason: `Primary provider ${primaryName} succeeded.`,
        response_type: 'dashboard_action',
        natural_response: result.parsed.natural_response || `Generated actions using ${primaryName}.`,
        actions: result.parsed.actions || [],
        validated_actions: guardianResult.validatedActions || [],
        warnings: [...(result.parsed.warnings || []), ...guardianResult.warnings],
        errors: guardianResult.errors || [],
        schema_safe: true,
        metadata: {
          latency_ms: result.latency_ms || 0,
          guardian_score: assessDashboardHealth(schemaPacket, {
            kpis: guardianResult.validatedActions.filter(a => a.action === 'create_kpi'),
            charts: guardianResult.validatedActions.filter(a => a.action === 'create_chart')
          }).score,
          provider_mode: providerMode
        }
      };
    }

    // 4. Fallback execution
    const enableGeminiFallback = process.env.AI_ENABLE_GEMINI_FALLBACK !== 'false';
    const enableOllamaFallback = process.env.AI_ENABLE_OLLAMA_FALLBACK !== 'false';
    const allowedFallback = fallbackName === 'gemini' ? enableGeminiFallback : enableOllamaFallback;

    if (fallbackService && allowedFallback) {
      console.warn(`[aiProviderRouter] Primary ${primaryName} failed. Falling back to ${fallbackName}.`);
      let fallbackResult;
      try {
        fallbackResult = await fallbackService.generateDashboardAction(schemaPacket, userQuery, dashboardState);
      } catch (err) {
        fallbackResult = { success: false, error: err.message };
      }

      if (fallbackResult.success && fallbackResult.parsed) {
        const guardianResult = validateDashboardActions(schemaPacket, dashboardState, fallbackResult.parsed.actions || []);
        return {
          success: true,
          provider: fallbackName,
          selected_model: fallbackResult.model,
          selection_reason: `Primary failed; fell back to ${fallbackName}.`,
          response_type: 'dashboard_action',
          natural_response: fallbackResult.parsed.natural_response || `Generated actions using fallback ${fallbackName}.`,
          actions: fallbackResult.parsed.actions || [],
          validated_actions: guardianResult.validatedActions || [],
          warnings: [...(fallbackResult.parsed.warnings || []), ...guardianResult.warnings],
          errors: guardianResult.errors || [],
          schema_safe: true,
          metadata: {
            latency_ms: fallbackResult.latency_ms || 0,
            guardian_score: assessDashboardHealth(schemaPacket, {
              kpis: guardianResult.validatedActions.filter(a => a.action === 'create_kpi'),
              charts: guardianResult.validatedActions.filter(a => a.action === 'create_chart')
            }).score,
            provider_mode: providerMode
          }
        };
      }
    }

    // 5. Ultimate Fallback
    console.error('[aiProviderRouter] All providers failed or returned invalid responses. Returning safe fallback.');
    return {
      success: false,
      provider: 'safe_fallback',
      response_type: 'chat',
      natural_response: 'I understood your request, but I could not safely generate a dashboard action. Please try a specific chart, KPI, or filter request.',
      actions: [],
      warnings: ['Gemini and Ollama responses failed validation.'],
      errors: [],
      schema_safe: true
    };
  }

  // Backward compatibility with legacy AIRouter interface
  async getAvailableProviders() {
    const providers = [];
    if (geminiService.isAvailable()) {
      providers.push({ name: 'gemini', service: geminiService });
    }
    const ollamaAvailable = await ollamaService.isAvailable();
    if (ollamaAvailable) {
      providers.push({ name: 'ollama', service: ollamaService });
    }
    providers.push({ name: 'local', service: localNLPService });
    return providers;
  }

  async generateResponse(prompt, context = {}) {
    try {
      assertNoRawRowsInString(prompt);
      assertNoRawRowsInString(JSON.stringify(context));
    } catch (error) {
      console.error(`[AI ROUTER BLOCKED generateResponse] ${error.message}`);
      return {
        success: false,
        error: `Blocked unsafe LLM payload: ${error.message}`,
        provider: 'none',
        content: `I apologize, but raw rows are blocked from AI queries.`
      };
    }

    const availableProviders = await this.getAvailableProviders();
    if (availableProviders.length === 0) {
      return {
        success: false,
        error: 'No AI providers available',
        provider: 'none',
        content: 'I apologize, but no AI services are currently available.'
      };
    }

    for (const { name, service } of availableProviders) {
      try {
        const result = await service.generateResponse(prompt, context);
        if (result.success) {
          this.lastUsedProvider = name;
          return result;
        }
      } catch (error) {
        console.warn(`${name} failed during generateResponse fallback:`, error.message);
      }
    }

    return {
      success: false,
      error: 'All AI providers failed',
      provider: 'none',
      content: 'I apologize, but all AI services are currently experiencing issues.'
    };
  }

  async testAllProviders() {
    const geminiTest = await geminiService.testConnection();
    const ollamaTest = await ollamaService.testConnection();
    return {
      results: {
        gemini: geminiTest,
        ollama: ollamaTest
      },
      stats: this.providerStats
    };
  }

  async healthCheck() {
    const geminiAvailable = geminiService.isAvailable();
    const ollamaAvailable = await ollamaService.isAvailable();
    return {
      status: geminiAvailable || ollamaAvailable ? 'healthy' : 'unhealthy',
      availableProviders: [
        geminiAvailable ? 'gemini' : null,
        ollamaAvailable ? 'ollama' : null
      ].filter(Boolean)
    };
  }
}

export const aiProviderRouter = new AIRouter();
export const aiRouter = aiProviderRouter;
export default aiProviderRouter;
